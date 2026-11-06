import { env, exports } from "cloudflare:workers";
import { Hono } from "hono";
import { beforeAll, describe, expect, it } from "vitest";
import { createKeyProvider, JWKS_MIN_REFETCH_MS, type Jwk } from "../../src/worker/admin/access";
import { audit } from "../../src/worker/admin/audit";
import { requireStaff, type AdminEnv } from "../../src/worker/admin/staff";
import { createAdmin } from "../../src/worker/routes/admin";

// Plan 08 (admin access). Real WebCrypto RSA keys sign the tokens; the JWKS fetcher is injected.
// Real D1 for staff_roles and audit_log.

const TEAM = "ew-test.cloudflareaccess.com";
const AUD = "aud-tag-123";
const NOW_MS = 1_800_000_000_000;
const NOW_S = NOW_MS / 1000;
const vars = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };
const bindings = { DB: env.DB, FILES: env.FILES, ...vars } as Env;

const RSA = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

function b64url(input: string | ArrayBuffer) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function keyPair(kid: string) {
  const pair = (await crypto.subtle.generateKey(RSA, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid, alg: "RS256" };
  return { kid, privateKey: pair.privateKey, jwk: jwk as Jwk };
}

let main: Awaited<ReturnType<typeof keyPair>>;
let other: Awaited<ReturnType<typeof keyPair>>;

async function sign(
  key: typeof main,
  claims: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
) {
  const payload = {
    aud: [AUD],
    iss: `https://${TEAM}`,
    exp: NOW_S + 3600,
    iat: NOW_S - 10,
    email: "Amma@Example.com",
    ...claims,
  };
  const input = `${b64url(JSON.stringify({ alg: "RS256", kid: key.kid, ...header }))}.${b64url(JSON.stringify(payload))}`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key.privateKey,
    new TextEncoder().encode(input),
  );
  return `${input}.${b64url(sig)}`;
}

function app() {
  const keys = createKeyProvider(
    async () => {
      return [main.jwk];
    },
    () => NOW_MS,
  );
  return createAdmin({ keys, now: () => NOW_MS });
}

function call(token?: string, init: RequestInit = {}, e: Env = bindings, a = app()) {
  const headers = new Headers(init.headers);
  if (token) headers.set("Cf-Access-Jwt-Assertion", token);
  return a.request("/me", { ...init, headers }, e);
}

beforeAll(async () => {
  main = await keyPair("kid-main");
  other = await keyPair("kid-other");
  await env.DB.batch([
    env.DB.prepare("INSERT INTO staff_roles (email, role, created_at) VALUES (?, 'owner', ?)").bind(
      "amma@example.com",
      NOW_MS,
    ),
    env.DB.prepare("INSERT INTO staff_roles (email, role, created_at) VALUES (?, 'admin', ?)").bind(
      "helper@example.com",
      NOW_MS,
    ),
  ]);
});

describe("GET /api/admin/me", () => {
  it("returns email and role for a valid token and a staff email", async () => {
    const res = await call(await sign(main));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "amma@example.com", role: "owner" });
  });

  it("compares the email case-insensitively", async () => {
    const res = await call(await sign(main, { email: "HELPER@EXAMPLE.COM" }));
    expect(await res.json()).toEqual({ email: "helper@example.com", role: "admin" });
  });

  it("accepts the token from the CF_Authorization cookie", async () => {
    const token = await sign(main);
    const res = await call(undefined, { headers: { Cookie: `CF_Authorization=${token}` } });
    expect(res.status).toBe(200);
  });

  it("answers 403 for a verified email with no staff role", async () => {
    const res = await call(await sign(main, { email: "stranger@example.com" }));
    expect(res.status).toBe(403);
  });

  it.each([
    ["wrong aud", { aud: ["someone-else"] }],
    ["wrong iss", { iss: "https://evil.cloudflareaccess.com" }],
    ["expired", { exp: NOW_S - 120 }],
    ["no email", { email: undefined }],
  ])("answers 401 for %s", async (_n, claims) => {
    expect((await call(await sign(main, claims))).status).toBe(401);
  });

  it("answers 401 for a bad signature", async () => {
    const [h, p] = (await sign(main)).split(".");
    const forged = (await sign(main, { email: "stranger@example.com" })).split(".")[2];
    expect((await call(`${h}.${p}.${forged}`)).status).toBe(401);
    // Signed by a different key under the main kid.
    const imposter = await sign({ ...other, kid: "kid-main" });
    expect((await call(imposter)).status).toBe(401);
  });

  it("answers 401 when only the unused trailing bits of the signature are changed", async () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const token = await sign(main);
    expect((await call(token)).status).toBe(200);
    // A 256-byte signature ends in a 2-char group whose last 4 bits are unused.
    const last = token.at(-1) as string;
    const altered = alphabet[alphabet.indexOf(last) ^ 1];
    expect((await call(token.slice(0, -1) + altered)).status).toBe(401);
  });

  it("answers 401 for alg none and for HS256", async () => {
    const payload = b64url(
      JSON.stringify({
        aud: [AUD],
        iss: `https://${TEAM}`,
        exp: NOW_S + 3600,
        email: "amma@example.com",
      }),
    );
    const none = `${b64url(JSON.stringify({ alg: "none", kid: "kid-main" }))}.${payload}.`;
    expect((await call(none)).status).toBe(401);
    expect((await call(`${none}x`)).status).toBe(401);
    expect((await call(await sign(main, {}, { alg: "HS256" }))).status).toBe(401);
  });

  it("answers 401 without a token or with garbage", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("not.a.jwt")).status).toBe(401);
  });

  it("answers 401 for an unknown kid", async () => {
    expect((await call(await sign(other))).status).toBe(401);
  });

  it("does not trust Cf-Access-Authenticated-User-Email", async () => {
    const res = await call(undefined, {
      headers: { "Cf-Access-Authenticated-User-Email": "amma@example.com" },
    });
    expect(res.status).toBe(401);
  });

  it("answers 401 when the Access vars are unset or empty (fail closed)", async () => {
    const token = await sign(main);
    expect((await call(token, {}, { ...bindings, ACCESS_TEAM_DOMAIN: "" })).status).toBe(401);
    expect((await call(token, {}, { ...bindings, ACCESS_AUD: "" })).status).toBe(401);
    expect((await call(token, {}, { DB: env.DB, FILES: env.FILES } as Env)).status).toBe(401);
  });

  it("answers 401 when the certs cannot be fetched", async () => {
    const keys = createKeyProvider(async () => {
      throw new Error("offline");
    });
    const res = await call(
      await sign(main),
      {},
      bindings,
      createAdmin({ keys, now: () => NOW_MS }),
    );
    expect(res.status).toBe(401);
  });

  it("is served by the Worker and closed when Access is not configured", async () => {
    const res = await exports.default.fetch("https://learn.test/api/admin/me");
    expect(res.status).toBe(401);
  });
});

describe("requireStaff roles", () => {
  it("answers 403 when the role is not in the list", async () => {
    const keys = createKeyProvider(
      async () => [main.jwk],
      () => NOW_MS,
    );
    const guarded = new Hono<AdminEnv>().get(
      "/owner-only",
      requireStaff(["owner"], { keys, now: () => NOW_MS }),
      (c) => c.text("ok"),
    );
    const ask = async (email: string) =>
      guarded.request(
        "/owner-only",
        { headers: { "Cf-Access-Jwt-Assertion": await sign(main, { email }) } },
        bindings,
      );
    expect((await ask("amma@example.com")).status).toBe(200);
    expect((await ask("helper@example.com")).status).toBe(403);
  });
});

describe("key cache", () => {
  it("fetches once, then serves from cache until the TTL", async () => {
    let calls = 0;
    let clock = NOW_MS;
    const keys = createKeyProvider(
      async () => {
        calls++;
        return [main.jwk];
      },
      () => clock,
    );
    await keys.getKey(TEAM, "kid-main");
    await keys.getKey(TEAM, "kid-main");
    expect(calls).toBe(1);
    clock += 11 * 60 * 1000;
    await keys.getKey(TEAM, "kid-main");
    expect(calls).toBe(2);
  });

  it("shares one in-flight fetch between concurrent requests", async () => {
    let calls = 0;
    const keys = createKeyProvider(
      async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 20));
        return [main.jwk];
      },
      () => NOW_MS,
    );
    const results = await Promise.all([1, 2, 3, 4].map(() => keys.getKey(TEAM, "kid-main")));
    expect(calls).toBe(1);
    expect(results.every((k) => k !== null)).toBe(true);
  });

  it("does not hammer the certs endpoint after a failed fetch", async () => {
    let calls = 0;
    let clock = NOW_MS;
    const keys = createKeyProvider(
      async () => {
        calls++;
        throw new Error("offline");
      },
      () => clock,
    );
    await expect(keys.getKey(TEAM, "kid-main")).rejects.toThrow();
    await expect(keys.getKey(TEAM, "kid-main")).rejects.toThrow();
    expect(calls).toBe(1);
    clock += JWKS_MIN_REFETCH_MS + 1;
    await expect(keys.getKey(TEAM, "kid-main")).rejects.toThrow();
    expect(calls).toBe(2);
  });

  it("refetches once for an unknown kid, not on every request", async () => {
    let calls = 0;
    let clock = NOW_MS;
    let published = [main.jwk];
    const keys = createKeyProvider(
      async () => {
        calls++;
        return published;
      },
      () => clock,
    );
    await keys.getKey(TEAM, "kid-main");
    expect(await keys.getKey(TEAM, "kid-other")).toBeNull();
    expect(calls).toBe(1); // too soon after the last fetch
    clock += JWKS_MIN_REFETCH_MS + 1;
    published = [main.jwk, other.jwk];
    expect(await keys.getKey(TEAM, "kid-other")).not.toBeNull();
    expect(calls).toBe(2);
    expect(await keys.getKey(TEAM, "kid-nope")).toBeNull();
    expect(calls).toBe(2);
  });
});

describe("audit()", () => {
  it("returns a statement that records the staff email, and batches with a change", async () => {
    const keys = createKeyProvider(
      async () => [main.jwk],
      () => NOW_MS,
    );
    const a = new Hono<AdminEnv>().post(
      "/x",
      requireStaff(undefined, { keys, now: () => NOW_MS }),
      async (c) => {
        await c.env.DB.batch([
          c.env.DB.prepare(
            "INSERT INTO staff_roles (email, role, created_at) VALUES ('new@example.com', 'admin', ?)",
          ).bind(NOW_MS),
          audit(c, "staff.add", "staff", "new@example.com", { role: "admin" }),
          audit(c, "noop", "staff", "none"),
        ]);
        return c.text("ok");
      },
    );
    const res = await a.request(
      "/x",
      { method: "POST", headers: { "Cf-Access-Jwt-Assertion": await sign(main) } },
      bindings,
    );
    expect(res.status).toBe(200);

    const rows = await env.DB.prepare(
      "SELECT * FROM audit_log WHERE entity_type = 'staff' ORDER BY action",
    ).all<Record<string, unknown>>();
    expect(rows.results).toHaveLength(2);
    expect(rows.results[0]).toMatchObject({
      actor_email: "amma@example.com",
      action: "noop",
      entity_id: "none",
      data_json: null,
    });
    expect(rows.results[1]).toMatchObject({
      actor_email: "amma@example.com",
      action: "staff.add",
      data_json: '{"role":"admin"}',
    });
    expect(typeof rows.results[1]?.at).toBe("number");
  });
});
