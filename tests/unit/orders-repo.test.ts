import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { colomboDate } from "../../src/domain/grants";
import { isValidReference } from "../../src/domain/orders";
import {
  approveOrder,
  createPendingOrder,
  getOrder,
  rejectOrder,
} from "../../src/worker/orders/repo";

// Plan 13 / plan 07 step 2. Real D1. These cases mirror plan 13's reference table (R1, R5 to R8)
// pending Sathira's copy in tests/reference/. The seed offers come from migration 0001.

const db = env.DB;
const AMMA = { email: "amma@example.com" };
let n = 0;
const buyer = (offerId = "blueprint") => ({
  offerId,
  name: "Kasun Perera",
  email: `Buyer${++n}-${Date.now()}@Example.com`,
  phone: "+94 77 123 4567",
});

async function count(sql: string, ...args: unknown[]) {
  const row = await db
    .prepare(sql)
    .bind(...args)
    .first<{ c: number }>();
  return row?.c ?? 0;
}

describe("createPendingOrder", () => {
  it("stores a pending order priced from the offer, with a valid reference", async () => {
    const res = await createPendingOrder(db, buyer());
    if (!res.ok) throw new Error(res.error);
    const { order } = res.value;
    expect(order.status).toBe("pending");
    expect(order.amountCents).toBe(1_000_000);
    expect(isValidReference(order.reference)).toBe(true);
    const row = await db
      .prepare("SELECT buyer_email, provider FROM orders WHERE id = ?")
      .bind(order.id)
      .first<{ buyer_email: string; provider: string }>();
    expect(row?.provider).toBe("bank_transfer");
    expect(row?.buyer_email).toBe(row?.buyer_email.toLowerCase());
  });

  it("answers offer_not_found for an unknown offer", async () => {
    expect(await createPendingOrder(db, buyer("nope"))).toEqual({
      ok: false,
      error: "offer_not_found",
    });
  });

  it("refuses an inactive offer", async () => {
    await db
      .prepare(
        "INSERT INTO offers (id, course_id, label, price_cents, needs_staff_check, active, created_at) VALUES ('old', 'blueprint', 'Old', 100, 0, 0, 1)",
      )
      .run();
    expect(await createPendingOrder(db, buyer("old"))).toEqual({
      ok: false,
      error: "inactive_offer",
    });
  });

  it("redraws the reference after a collision (R8)", async () => {
    const first = await createPendingOrder(db, buyer());
    if (!first.ok) throw new Error("setup");
    const taken = first.value.order.reference;
    const draws = [taken, taken, "EW-ZZZZZZ"];
    const res = await createPendingOrder(db, buyer(), { newReference: () => draws.shift()! });
    if (!res.ok) throw new Error(res.error);
    expect(res.value.order.reference).toBe("EW-ZZZZZZ");
  });
});

describe("approveOrder", () => {
  it("approves once: one grant, one audit row, 3 years from approval (R5)", async () => {
    const created = await createPendingOrder(db, buyer());
    if (!created.ok) throw new Error("setup");
    const id = created.value.order.id;
    const t = Date.UTC(2026, 10, 16, 4, 0, 0);

    const first = await approveOrder(db, id, AMMA, { now: t });
    expect(first.ok && first.value.granted).toBe(true);
    const second = await approveOrder(db, id, AMMA, { now: t + 5000 });
    expect(second.ok && second.value.granted).toBe(false);

    expect(await count("SELECT count(*) c FROM grants WHERE order_id = ?", id)).toBe(1);
    expect(
      await count(
        "SELECT count(*) c FROM audit_log WHERE entity_id = ? AND action = 'order.approve'",
        id,
      ),
    ).toBe(1);
    const grant = await db
      .prepare("SELECT starts_at, ends_at, student_id, course_id FROM grants WHERE order_id = ?")
      .bind(id)
      .first<{ starts_at: number; ends_at: number; student_id: string; course_id: string }>();
    expect(grant?.starts_at).toBe(t);
    expect(colomboDate(grant!.ends_at)).toBe("2029-11-16");
    expect(grant?.course_id).toBe("blueprint");
    const order = await getOrder(db, id);
    expect(order).toMatchObject({ status: "approved", decidedAt: t, decidedBy: AMMA.email });
    const student = await db
      .prepare("SELECT id FROM students WHERE id = ?")
      .bind(grant!.student_id)
      .first();
    expect(student).not.toBeNull();
  });

  it("makes one grant when approved concurrently (R5)", async () => {
    const created = await createPendingOrder(db, buyer());
    if (!created.ok) throw new Error("setup");
    const id = created.value.order.id;
    const results = await Promise.all(Array.from({ length: 5 }, () => approveOrder(db, id, AMMA)));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.ok && r.value.granted)).toHaveLength(1);
    expect(await count("SELECT count(*) c FROM grants WHERE order_id = ?", id)).toBe(1);
    expect(await count("SELECT count(*) c FROM audit_log WHERE entity_id = ?", id)).toBe(1);
  });

  it("reuses an existing student with the same email", async () => {
    const b = buyer();
    await db
      .prepare("INSERT INTO students (id, email, name, created_at) VALUES ('stu-x', ?, 'X', 1)")
      .bind(b.email.toLowerCase())
      .run();
    const created = await createPendingOrder(db, b);
    if (!created.ok) throw new Error("setup");
    await approveOrder(db, created.value.order.id, AMMA);
    const grant = await db
      .prepare("SELECT student_id FROM grants WHERE order_id = ?")
      .bind(created.value.order.id)
      .first<{ student_id: string }>();
    expect(grant?.student_id).toBe("stu-x");
  });

  it("needs the staff check for class offers (R6)", async () => {
    const created = await createPendingOrder(db, buyer("blueprint-class-monthly"));
    if (!created.ok) throw new Error("setup");
    const id = created.value.order.id;
    expect(await approveOrder(db, id, AMMA)).toEqual({ ok: false, error: "staff_check_required" });
    expect((await getOrder(db, id))?.status).toBe("pending");
    expect(await count("SELECT count(*) c FROM grants WHERE order_id = ?", id)).toBe(0);
    const done = await approveOrder(db, id, AMMA, { staffChecked: true });
    expect(done.ok && done.value.granted).toBe(true);
  });

  it("answers not_found for an unknown order", async () => {
    expect(await approveOrder(db, "missing", AMMA)).toEqual({ ok: false, error: "not_found" });
  });
});

describe("rejectOrder", () => {
  it("rejects with a reason and an audit row; then approve gives rejected, no grant (R7)", async () => {
    const created = await createPendingOrder(db, buyer());
    if (!created.ok) throw new Error("setup");
    const id = created.value.order.id;
    const res = await rejectOrder(db, id, AMMA, "no payment found");
    expect(res.ok && res.value.order).toMatchObject({
      status: "rejected",
      decidedBy: AMMA.email,
      note: "no payment found",
    });
    expect(await rejectOrder(db, id, AMMA, "again")).toMatchObject({ ok: true });
    expect(
      await count(
        "SELECT count(*) c FROM audit_log WHERE entity_id = ? AND action = 'order.reject'",
        id,
      ),
    ).toBe(1);
    expect(await approveOrder(db, id, AMMA)).toEqual({ ok: false, error: "rejected" });
    expect(await count("SELECT count(*) c FROM grants WHERE order_id = ?", id)).toBe(0);
  });

  it("cannot reject an approved order", async () => {
    const created = await createPendingOrder(db, buyer());
    if (!created.ok) throw new Error("setup");
    await approveOrder(db, created.value.order.id, AMMA);
    expect(await rejectOrder(db, created.value.order.id, AMMA)).toEqual({
      ok: false,
      error: "already_approved",
    });
  });
});
