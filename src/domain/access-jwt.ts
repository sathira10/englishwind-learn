// Pure parts of Cloudflare Access JWT checking (plans/08-admin-access.md): decoding and claim
// rules. Signature verification and key fetching live in src/worker/admin/ because they use
// WebCrypto and the network. Nothing here trusts a token: it only reads one.

export const CLOCK_LEEWAY_SECONDS = 60;

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  /** `<header>.<payload>` exactly as sent: the bytes the signature covers. */
  signingInput: string;
  signature: Uint8Array;
}

export function base64UrlDecode(input: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(input) || input.length % 4 === 1) {
    throw new Error("invalid base64url");
  }
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  // atob ignores unused low bits in the last character, so two spellings decode to the same
  // bytes. Accept only the canonical one: re-encode and compare.
  if (base64UrlEncode(bytes) !== input) throw new Error("non-canonical base64url");
  return bytes;
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeJsonObject(part: string): Record<string, unknown> {
  const value: unknown = JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("not an object");
  }
  return value as Record<string, unknown>;
}

/** Splits and decodes a compact JWT. Returns null for anything malformed. */
export function decodeJwt(token: string): DecodedJwt | null {
  const parts = token.split(".");
  const [head, body, sig] = parts;
  if (parts.length !== 3 || !head || !body || !sig) return null;
  try {
    return {
      header: decodeJsonObject(head),
      payload: decodeJsonObject(body),
      signingInput: `${head}.${body}`,
      signature: base64UrlDecode(sig),
    };
  } catch {
    return null;
  }
}

export interface ClaimExpectations {
  /** The Access application's AUD tag. */
  audience: string;
  /** `https://<team>.cloudflareaccess.com`. */
  issuer: string;
  /** Current time, epoch seconds. */
  nowSeconds: number;
  leewaySeconds?: number;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Returns the lower-cased email when every claim checks out, otherwise null. */
export function checkAccessClaims(
  payload: Record<string, unknown>,
  expected: ClaimExpectations,
): string | null {
  const leeway = Math.min(expected.leewaySeconds ?? CLOCK_LEEWAY_SECONDS, CLOCK_LEEWAY_SECONDS);
  const { aud, iss, exp, nbf, iat, email } = payload;

  if (expected.audience === "" || expected.issuer === "") return null;
  const audiences = typeof aud === "string" ? [aud] : Array.isArray(aud) ? aud : [];
  if (!audiences.includes(expected.audience)) return null;
  if (iss !== expected.issuer) return null;
  if (!isNumber(exp) || exp <= expected.nowSeconds - leeway) return null;
  if (nbf !== undefined && (!isNumber(nbf) || nbf > expected.nowSeconds + leeway)) return null;
  if (iat !== undefined && (!isNumber(iat) || iat > expected.nowSeconds + leeway)) return null;
  if (typeof email !== "string" || !email.includes("@")) return null;
  return email.trim().toLowerCase();
}
