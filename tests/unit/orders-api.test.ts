import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { isValidReference } from "../../src/domain/orders";
import { BANK_DETAILS } from "../../src/shared/bank";
import { createApp } from "../../src/worker/app";
import { sha256Hex } from "../../src/worker/rate-limit";

// Plan 13 (order API). Real D1 and the real Hono app. These cases mirror plan 13's reference
// table (R1 to R4) pending Sathira's copy in tests/reference/. Rate limits key on IP and email,
// so every test uses its own of each.

const ORIGIN = "https://learn.test";
const app = createApp();
let n = 0;
const freshIp = () => `198.51.${Math.floor(++n / 250)}.${(n % 250) + 1}`;
const freshEmail = () => `buyer${++n}-${Date.now()}@example.com`;

function post(body: unknown, init: { ip?: string; headers?: Record<string, string> } = {}) {
  return app.fetch(
    new Request(`${ORIGIN}/api/orders`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        "cf-connecting-ip": init.ip ?? freshIp(),
        ...init.headers,
      },
    }),
    env,
  );
}

const valid = (extra: Record<string, unknown> = {}) => ({
  offer: "blueprint",
  name: "Kasun Perera",
  email: freshEmail(),
  phone: "+94 77 123 4567",
  ...extra,
});

describe("POST /api/orders", () => {
  it("stores a pending order and returns reference, amount and bank details (R1)", async () => {
    const body = valid();
    const res = await post({ ...body, amountCents: 1, amount: 1 });
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      reference: string;
      amountCents: number;
      bank: unknown;
    };
    expect(json.amountCents).toBe(1_000_000);
    expect(isValidReference(json.reference)).toBe(true);
    expect(json.bank).toEqual(BANK_DETAILS);
    expect(BANK_DETAILS).toMatchObject({
      bank: "Bank of Ceylon",
      branch: "Galle Fort",
      account: "0081406387",
      accountName: "T.M.J. Tennakoon",
    });

    const row = await env.DB.prepare(
      "SELECT status, amount_cents, offer_id, buyer_name, buyer_phone, provider FROM orders WHERE reference = ?",
    )
      .bind(json.reference)
      .first();
    expect(row).toEqual({
      status: "pending",
      amount_cents: 1_000_000,
      offer_id: "blueprint",
      buyer_name: "Kasun Perera",
      buyer_phone: "+94 77 123 4567",
      provider: "bank_transfer",
    });
  });

  it("prices a class offer from the row, including LKR 0", async () => {
    const res = await post(valid({ offer: "blueprint-class-full" }));
    expect(res.status).toBe(201);
    expect(((await res.json()) as { amountCents: number }).amountCents).toBe(0);
  });

  it("answers 404 for an unknown offer and stores nothing (R2)", async () => {
    const body = valid({ offer: "nope" });
    const res = await post(body);
    expect(res.status).toBe(404);
    const row = await env.DB.prepare("SELECT count(*) c FROM orders WHERE buyer_email = ?")
      .bind(body.email)
      .first<{ c: number }>();
    expect(row?.c).toBe(0);
  });

  it("does not charge a buyer's email quota for an unknown offer", async () => {
    const email = freshEmail();
    for (let i = 0; i < 6; i++)
      expect((await post(valid({ offer: "nope", email }))).status).toBe(404);
    expect((await post(valid({ email }))).status).toBe(201);
  });

  it("answers 422 naming each bad field (R3)", async () => {
    const res = await post(valid({ email: "not-an-email", name: "  " }));
    expect(res.status).toBe(422);
    const json = (await res.json()) as { fields: Record<string, string> };
    expect(Object.keys(json.fields).sort()).toEqual(["email", "name"]);
  });

  it("rejects a bad phone, a missing offer and a non-object body", async () => {
    expect((await post(valid({ phone: "abc" }))).status).toBe(422);
    expect((await post(valid({ offer: undefined }))).status).toBe(422);
    expect((await post("[]")).status).toBe(422);
  });

  it("answers 400 for malformed JSON", async () => {
    expect((await post("{nope")).status).toBe(400);
  });

  it("requires Content-Type application/json", async () => {
    const res = await post(JSON.stringify(valid()), { headers: { "content-type": "text/plain" } });
    expect(res.status).toBe(415);
  });

  it("refuses another origin and a missing one", async () => {
    expect((await post(valid(), { headers: { origin: "https://evil.example" } })).status).toBe(403);
    const noOrigin = await app.fetch(
      new Request(`${ORIGIN}/api/orders`, {
        method: "POST",
        body: JSON.stringify(valid()),
        headers: { "content-type": "application/json", "cf-connecting-ip": freshIp() },
      }),
      env,
    );
    expect(noOrigin.status).toBe(403);
  });

  it("limits each IP to 10 orders an hour (R4)", async () => {
    const ip = freshIp();
    for (let i = 0; i < 10; i++) expect((await post(valid(), { ip })).status).toBe(201);
    expect((await post(valid(), { ip })).status).toBe(429);
    expect((await post(valid())).status).toBe(201); // another IP is unaffected
  });

  it("writes nothing for an IP already at its cap", async () => {
    const ip = freshIp();
    for (let i = 0; i < 10; i++) expect((await post(valid(), { ip })).status).toBe(201);
    const key = `order-ip:${await sha256Hex(ip)}`;
    const read = () =>
      env.DB.prepare("SELECT count, last_request FROM rate_limits WHERE key = ?")
        .bind(key)
        .first<{ count: number; last_request: number }>();
    const before = await read();
    expect(before?.count).toBe(10);
    for (let i = 0; i < 3; i++) expect((await post(valid(), { ip })).status).toBe(429);
    expect(await read()).toEqual(before);
  });

  it("limits each email to 5 orders an hour, whatever the case", async () => {
    const email = freshEmail();
    for (let i = 0; i < 5; i++) expect((await post(valid({ email }))).status).toBe(201);
    expect((await post(valid({ email: email.toUpperCase() }))).status).toBe(429);
  });

  it("keeps no address in the rate limit keys", async () => {
    const email = freshEmail();
    await post(valid({ email }), { ip: "203.0.113.77" });
    const rows = await env.DB.prepare("SELECT key FROM rate_limits WHERE key LIKE 'order-%'").all<{
      key: string;
    }>();
    expect(rows.results.length).toBeGreaterThan(0);
    for (const { key } of rows.results) {
      expect(key).not.toContain(email);
      expect(key).not.toContain("203.0.113.77");
    }
  });
});

describe("GET /api/offers/:slug", () => {
  const get = (slug: string) => app.fetch(new Request(`${ORIGIN}/api/offers/${slug}`), env);

  it("returns the label and the price in cents", async () => {
    const res = await get("blueprint");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      slug: "blueprint",
      label: "Blueprint",
      priceCents: 1_000_000,
    });
  });

  it("answers 404 for an unknown or inactive offer", async () => {
    expect((await get("nope")).status).toBe(404);
    await env.DB.prepare(
      "INSERT INTO offers (id, course_id, label, price_cents, needs_staff_check, active, created_at) VALUES ('retired', 'blueprint', 'Retired', 100, 0, 0, 1)",
    ).run();
    expect((await get("retired")).status).toBe(404);
  });
});
