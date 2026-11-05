import { checkAccessClaims, decodeJwt } from "../../domain/access-jwt";

// Verifies a Cloudflare Access JWT with WebCrypto (RS256 only). Keys come from
// https://<team domain>/cdn-cgi/access/certs. docs/adr/0004-access-control.md.

export type Jwk = JsonWebKey & { kid?: string };
export type JwksFetcher = (teamDomain: string) => Promise<Jwk[]>;

export const JWKS_TTL_MS = 10 * 60 * 1000;
/** After a fetch, an unknown kid will not trigger another one for this long. */
export const JWKS_MIN_REFETCH_MS = 30 * 1000;

const TEAM_DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export const fetchAccessJwks: JwksFetcher = async (teamDomain) => {
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`certs ${response.status}`);
  const body = (await response.json()) as { keys?: Jwk[] };
  return Array.isArray(body.keys) ? body.keys : [];
};

export interface KeyProvider {
  getKey(teamDomain: string, kid: string): Promise<CryptoKey | null>;
}

/** Caches imported keys per team domain; refetches when stale or once for an unknown kid. */
export function createKeyProvider(
  fetchJwks: JwksFetcher = fetchAccessJwks,
  now: () => number = Date.now,
): KeyProvider {
  const cache = new Map<string, { keys: Map<string, CryptoKey>; fetchedAt: number }>();
  const inflight = new Map<string, Promise<Map<string, CryptoKey>>>();
  const lastFailure = new Map<string, number>();

  async function fetchKeys(teamDomain: string) {
    const jwks = await fetchJwks(teamDomain);
    const keys = new Map<string, CryptoKey>();
    for (const jwk of jwks) {
      if (jwk.kty !== "RSA" || !jwk.kid) continue;
      try {
        keys.set(
          jwk.kid,
          await crypto.subtle.importKey(
            "jwk",
            jwk,
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["verify"],
          ),
        );
      } catch {
        // Skip a key we cannot import; the others may still be good.
      }
    }
    return keys;
  }

  /** One fetch per team domain at a time; a failure is remembered and rethrown. */
  function load(teamDomain: string): Promise<Map<string, CryptoKey>> {
    const running = inflight.get(teamDomain);
    if (running) return running;
    const started = (async () => {
      try {
        const keys = await fetchKeys(teamDomain);
        cache.set(teamDomain, { keys, fetchedAt: now() });
        lastFailure.delete(teamDomain);
        return keys;
      } catch (error) {
        lastFailure.set(teamDomain, now());
        throw error;
      } finally {
        inflight.delete(teamDomain);
      }
    })();
    inflight.set(teamDomain, started);
    return started;
  }

  return {
    async getKey(teamDomain, kid) {
      const entry = cache.get(teamDomain);
      const failedAt = lastFailure.get(teamDomain);
      const recentlyFailed = failedAt !== undefined && now() - failedAt < JWKS_MIN_REFETCH_MS;

      if (!entry || now() - entry.fetchedAt > JWKS_TTL_MS) {
        if (recentlyFailed) throw new Error("certs fetch failed recently");
        return (await load(teamDomain)).get(kid) ?? null;
      }
      const hit = entry.keys.get(kid);
      if (hit) return hit;
      if (recentlyFailed || now() - entry.fetchedAt < JWKS_MIN_REFETCH_MS) return null;
      return (await load(teamDomain)).get(kid) ?? null;
    },
  };
}

export const defaultKeyProvider = createKeyProvider();

export interface AccessConfig {
  teamDomain: string | undefined;
  audience: string | undefined;
}

/** The verified, lower-cased email, or null for any failure (including a fetch error). */
export async function verifyAccessJwt(
  token: string,
  config: AccessConfig,
  keys: KeyProvider,
  now: () => number = Date.now,
): Promise<string | null> {
  const teamDomain = config.teamDomain?.trim() ?? "";
  const audience = config.audience?.trim() ?? "";
  if (!TEAM_DOMAIN.test(teamDomain) || audience === "") return null;

  const jwt = decodeJwt(token);
  if (!jwt || jwt.header.alg !== "RS256" || typeof jwt.header.kid !== "string") return null;

  try {
    const key = await keys.getKey(teamDomain, jwt.header.kid);
    if (!key) return null;
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      jwt.signature,
      new TextEncoder().encode(jwt.signingInput),
    );
    if (!valid) return null;
  } catch {
    return null;
  }

  return checkAccessClaims(jwt.payload, {
    audience,
    issuer: `https://${teamDomain}`,
    nowSeconds: Math.floor(now() / 1000),
  });
}
