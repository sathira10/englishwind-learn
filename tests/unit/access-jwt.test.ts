import { describe, expect, it } from "vitest";
import { base64UrlDecode, checkAccessClaims, decodeJwt } from "../../src/domain/access-jwt";

// Plan 08 (admin access): pure decoding and claim rules. These mirror plan 08's reference table
// pending Sathira's copy in tests/reference/ (Q10).

const NOW = 1_800_000_000;
const expected = { audience: "aud1", issuer: "https://team.cloudflareaccess.com", nowSeconds: NOW };
const good = {
  aud: ["aud1"],
  iss: "https://team.cloudflareaccess.com",
  exp: NOW + 600,
  iat: NOW - 5,
  email: "Amma@Example.com",
};

function b64(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("base64UrlDecode", () => {
  it("decodes unpadded url-safe input", () => {
    expect(new TextDecoder().decode(base64UrlDecode(b64("hello?>")))).toBe("hello?>");
  });
  it("rejects non-canonical trailing bits and padding", () => {
    // "Q" and "R" decode to the same byte through atob; only the canonical spelling is allowed.
    expect(base64UrlDecode("YQ")).toEqual(new Uint8Array([97]));
    expect(() => base64UrlDecode("YR")).toThrow();
    expect(() => base64UrlDecode("YQ==")).toThrow();
  });
  it("rejects characters outside the alphabet and impossible lengths", () => {
    expect(() => base64UrlDecode("ab+/")).toThrow();
    expect(() => base64UrlDecode("a")).toThrow();
  });
});

describe("decodeJwt", () => {
  it("splits a compact token", () => {
    const token = `${b64('{"alg":"RS256"}')}.${b64('{"a":1}')}.${b64("sig")}`;
    const jwt = decodeJwt(token);
    expect(jwt?.header).toEqual({ alg: "RS256" });
    expect(jwt?.payload).toEqual({ a: 1 });
    expect(jwt?.signingInput).toBe(token.slice(0, token.lastIndexOf(".")));
  });
  it.each(["", "a.b", "a.b.c.d", "..", "!!.!!.!!", `${b64("[]")}.${b64("{}")}.${b64("s")}`])(
    "returns null for %j",
    (token) => {
      expect(decodeJwt(token)).toBeNull();
    },
  );
});

describe("checkAccessClaims", () => {
  it("returns the lower-cased email for good claims", () => {
    expect(checkAccessClaims(good, expected)).toBe("amma@example.com");
  });
  it("accepts aud as a string", () => {
    expect(checkAccessClaims({ ...good, aud: "aud1" }, expected)).toBe("amma@example.com");
  });
  it.each([
    ["wrong aud", { aud: ["other"] }],
    ["no aud", { aud: undefined }],
    ["wrong iss", { iss: "https://evil.cloudflareaccess.com" }],
    ["expired beyond leeway", { exp: NOW - 61 }],
    ["no exp", { exp: undefined }],
    ["exp as string", { exp: String(NOW + 600) }],
    ["nbf in the future", { nbf: NOW + 61 }],
    ["iat in the future", { iat: NOW + 61 }],
    ["no email", { email: undefined }],
    ["email without @", { email: "amma" }],
  ])("rejects %s", (_name, override) => {
    expect(checkAccessClaims({ ...good, ...override }, expected)).toBeNull();
  });
  it("allows 60 seconds of clock leeway but never more", () => {
    expect(checkAccessClaims({ ...good, exp: NOW - 59 }, expected)).not.toBeNull();
    expect(checkAccessClaims({ ...good, nbf: NOW + 59 }, expected)).not.toBeNull();
    expect(
      checkAccessClaims({ ...good, exp: NOW - 100 }, { ...expected, leewaySeconds: 3600 }),
    ).toBeNull();
  });
  it("fails closed when expectations are empty", () => {
    expect(checkAccessClaims(good, { ...expected, audience: "" })).toBeNull();
    expect(checkAccessClaims(good, { ...expected, issuer: "" })).toBeNull();
  });
});
