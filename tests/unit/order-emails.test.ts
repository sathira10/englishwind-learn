import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { BANK_DETAILS } from "../../src/shared/bank";
import { createApp } from "../../src/worker/app";
import { createCloudflareMailer } from "../../src/worker/mail/cloudflare";
import { createConsoleMailer } from "../../src/worker/mail/console";
import { notifyAccessGranted, sendSafely, signInUrl } from "../../src/worker/mail/notify";
import { approveOrder, createPendingOrder } from "../../src/worker/orders/repo";
import { captureMailer } from "./capture-mailer";

// Plan 10: order emails over real D1 and the real Hono app. Cases E7 to E10 mirror the plan's
// reference table pending Sathira's copy in tests/reference/.

const ORIGIN = "https://learn.test";
let n = 0;
const freshIp = () => `192.0.${Math.floor(++n / 250) + 100}.${(n % 250) + 1}`;
const freshEmail = () => `mailbuyer${++n}-${Date.now()}@example.com`;

function post(app: ReturnType<typeof createApp>, email: string) {
  return app.fetch(
    new Request(`${ORIGIN}/api/orders`, {
      method: "POST",
      body: JSON.stringify({
        offer: "blueprint",
        name: "Kasun Perera",
        email,
        phone: "+94 77 123 4567",
      }),
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        "cf-connecting-ip": freshIp(),
      },
    }),
    env,
  );
}

describe("POST /api/orders sends orderReceived", () => {
  it("E7: the mailer gets the buyer's address, the reference, the amount and the bank", async () => {
    const mailer = captureMailer();
    const email = freshEmail();
    const res = await post(createApp({ mailer }), email);
    expect(res.status).toBe(201);
    const json = (await res.json()) as { reference: string };
    expect(mailer.orderReceived_).toEqual([
      {
        to: email,
        data: {
          name: "Kasun Perera",
          reference: json.reference,
          label: "Blueprint",
          amountCents: 1_000_000,
          bank: BANK_DETAILS,
        },
      },
    ]);
  });

  it("E8: still answers 201 and stores the order when the mailer throws, logging no address", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const email = freshEmail();
      const mailer = captureMailer({ failWith: new Error(`cannot reach ${email}`) });
      const res = await post(createApp({ mailer }), email);
      expect(res.status).toBe(201);
      const { reference } = (await res.json()) as { reference: string };
      const row = await env.DB.prepare("SELECT status FROM orders WHERE reference = ?")
        .bind(reference)
        .first();
      expect(row).toEqual({ status: "pending" });
      const logged = error.mock.calls.flat().join("\n");
      expect(logged).toContain("[mail] orderReceived failed");
      expect(logged).not.toContain(email);
      expect(logged).not.toContain("example.com");
    } finally {
      error.mockRestore();
    }
  });

  it("sends in the background when the request has an execution context", async () => {
    const mailer = captureMailer();
    const pending: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => void pending.push(p),
      passThroughOnException: () => {},
    } as unknown as ExecutionContext;
    const email = freshEmail();
    const res = await createApp({ mailer }).fetch(
      new Request(`${ORIGIN}/api/orders`, {
        method: "POST",
        body: JSON.stringify({
          offer: "blueprint",
          name: "Kasun Perera",
          email,
          phone: "+94 77 123 4567",
        }),
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          "cf-connecting-ip": freshIp(),
        },
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(201);
    expect(pending).toHaveLength(1);
    await Promise.all(pending);
    expect(mailer.orderReceived_.map((m) => m.to)).toEqual([email]);
  });

  it("sends nothing for an order that is refused", async () => {
    const mailer = captureMailer();
    const res = await createApp({ mailer }).fetch(
      new Request(`${ORIGIN}/api/orders`, {
        method: "POST",
        body: JSON.stringify({
          offer: "nope",
          name: "A",
          email: freshEmail(),
          phone: "0771234567",
        }),
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          "cf-connecting-ip": freshIp(),
        },
      }),
      env,
    );
    expect(res.status).toBe(404);
    expect(mailer.orderReceived_).toEqual([]);
  });
});

describe("sendSafely", () => {
  it("hands the send to waitUntil and answers queued", async () => {
    const pending: Promise<unknown>[] = [];
    const send = vi.fn(async () => {});
    const result = await sendSafely((p) => pending.push(p), "x", send);
    expect(result).toBe("queued");
    await Promise.all(pending);
    expect(send).toHaveBeenCalledOnce();
  });

  it("a send that throws synchronously is also contained", async () => {
    const lines: string[] = [];
    const result = await sendSafely(
      undefined,
      "x",
      () => {
        throw new TypeError("boom a@b.lk");
      },
      (l) => lines.push(l),
    );
    expect(result).toBe("failed");
    expect(lines).toEqual(["[mail] x failed (TypeError)"]);
  });
});

describe("notifyAccessGranted", () => {
  async function approvedOrder() {
    const email = freshEmail();
    const created = await createPendingOrder(env.DB, {
      offerId: "blueprint",
      name: "Nimali Silva",
      email,
      phone: "+94 77 123 4567",
    });
    if (!created.ok) throw new Error("order not created");
    const approvedAt = Date.UTC(2026, 10, 12, 4, 0, 0);
    const approved = await approveOrder(
      env.DB,
      created.value.order.id,
      { email: "amma@example.com" },
      { now: approvedAt },
    );
    if (!approved.ok) throw new Error("not approved");
    return { id: created.value.order.id, email };
  }

  it("E9: tells the student the course, the end date in Colombo time and the sign-in link", async () => {
    const { id, email } = await approvedOrder();
    const mailer = captureMailer();
    expect(await notifyAccessGranted(env, mailer, id)).toBe("sent");
    expect(mailer.accessGranted_).toHaveLength(1);
    const [sent] = mailer.accessGranted_;
    expect(sent?.to).toBe(email);
    expect(sent?.data).toMatchObject({
      name: "Nimali Silva",
      courseTitle: expect.any(String),
      signInUrl: signInUrl(env.BETTER_AUTH_URL),
    });
    // Approved 12 Nov 2026, 09:30 Colombo, three years: 12 Nov 2029.
    expect(sent?.data.endsAt).toBe(Date.UTC(2029, 10, 12, 4, 0, 0));
    expect(signInUrl("https://learn.englishwind.lk")).toBe("https://learn.englishwind.lk/sign-in");
  });

  it("E10: skips an order with no grant, and never throws when the send fails", async () => {
    const pending = await createPendingOrder(env.DB, {
      offerId: "blueprint",
      name: "Not Yet",
      email: freshEmail(),
      phone: "+94 77 123 4567",
    });
    if (!pending.ok) throw new Error("order not created");
    const mailer = captureMailer();
    expect(await notifyAccessGranted(env, mailer, pending.value.order.id)).toBe("skipped");
    expect(await notifyAccessGranted(env, mailer, "no-such-order")).toBe("skipped");
    expect(mailer.accessGranted_).toEqual([]);

    const { id } = await approvedOrder();
    const lines: string[] = [];
    const failing = captureMailer({ failWith: new Error("down") });
    expect(await notifyAccessGranted(env, failing, id, { log: (l) => lines.push(l) })).toBe(
      "failed",
    );
    expect(lines).toEqual(["[mail] accessGranted failed (Error)"]);
  });

  it("skips an order whose grant was revoked", async () => {
    const { id } = await approvedOrder();
    await env.DB.prepare("UPDATE grants SET revoked_at = ? WHERE order_id = ?")
      .bind(Date.now(), id)
      .run();
    const mailer = captureMailer();
    expect(await notifyAccessGranted(env, mailer, id)).toBe("skipped");
    expect(mailer.accessGranted_).toEqual([]);
  });
});

describe("mailers", () => {
  const received = {
    name: "Kasun",
    reference: "EW-7KQ4XM",
    label: "Blueprint",
    amountCents: 1_000_000,
    bank: BANK_DETAILS,
  };

  it("the console mailer logs the subject and a masked address for every message", async () => {
    const lines: string[] = [];
    const mailer = createConsoleMailer((l) => lines.push(l));
    await mailer.orderReceived("kasun.perera@gmail.com", received);
    await mailer.accessGranted("kasun.perera@gmail.com", {
      name: "Kasun",
      courseTitle: "Blueprint",
      endsAt: Date.UTC(2029, 10, 12),
      signInUrl: "https://learn.test/sign-in",
    });
    await mailer.orderRejected("kasun.perera@gmail.com", {
      name: "Kasun",
      reference: "EW-7KQ4XM",
      reason: "private reason",
    });
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line).toContain("k***@gmail.com");
      expect(line).not.toContain("kasun.perera");
      expect(line).not.toContain("private reason");
    }
    expect(lines[0]).toContain("Your EnglishWind order EW-7KQ4XM");
  });

  it("the Cloudflare stub fails every message the same way until Q6 is answered", async () => {
    const mailer = createCloudflareMailer();
    await expect(mailer.sendLoginCode("a@b.lk", "1")).rejects.toThrow(/not configured/);
    await expect(mailer.orderReceived("a@b.lk", received)).rejects.toThrow(/not configured/);
    await expect(
      mailer.accessGranted("a@b.lk", { name: "A", courseTitle: "B", endsAt: 0, signInUrl: "x" }),
    ).rejects.toThrow(/not configured/);
    await expect(mailer.orderRejected("a@b.lk", { name: "A", reference: "EW-1" })).rejects.toThrow(
      /not configured/,
    );
  });
});
