// These cases mirror plan 07's reference table (plans/07-order-rules.md), pending Sathira's copy
// in tests/reference/. Do not change them to make code pass; if one looks wrong, say so.
import { describe, expect, it } from "vitest";
import {
  approve,
  isValidReference,
  normalizeReference,
  priceOrder,
  reject,
  type Offer,
  type Order,
} from "../../src/domain/orders";

const offer = (over: Partial<Offer>): Offer => ({
  id: "o",
  courseId: "blueprint",
  priceCents: 0,
  needsStaffCheck: false,
  active: true,
  ...over,
});

const order = (over: Partial<Order> = {}): Order => ({
  id: "ord1",
  reference: "EW-7KQ4XM",
  offerId: "blueprint-standard",
  amountCents: 1_000_000,
  status: "pending",
  createdAt: 1_000,
  decidedAt: null,
  decidedBy: null,
  note: null,
  ...over,
});

const AMMA = "amma@example.test";
const NOW = 5_000;

describe("plan 07 reference cases", () => {
  it("R1 Blueprint standard LKR 10,000 is 1,000,000 cents", () => {
    expect(priceOrder(offer({ priceCents: 1_000_000 }))).toEqual({
      ok: true,
      value: { amountCents: 1_000_000, needsStaffCheck: false },
    });
  });

  it("R2 class-monthly LKR 2,000 is 200,000 cents and needs a staff check", () => {
    expect(priceOrder(offer({ priceCents: 200_000, needsStaffCheck: true }))).toEqual({
      ok: true,
      value: { amountCents: 200_000, needsStaffCheck: true },
    });
  });

  it("R3 class-full LKR 0 is 0 cents and needs a staff check", () => {
    expect(priceOrder(offer({ priceCents: 0, needsStaffCheck: true }))).toEqual({
      ok: true,
      value: { amountCents: 0, needsStaffCheck: true },
    });
  });

  it("R4 inactive offer is refused", () => {
    expect(priceOrder(offer({ priceCents: 1_000_000, active: false }))).toEqual({
      ok: false,
      error: "inactive_offer",
    });
  });

  it("R5 approve pending: approved, stamped, one grant effect", () => {
    expect(approve(order(), AMMA, NOW)).toEqual({
      ok: true,
      value: {
        order: order({ status: "approved", decidedAt: NOW, decidedBy: AMMA }),
        effect: "create_grant",
      },
    });
  });

  it("R6 approve twice: second approval is ok with no grant effect", () => {
    const first = approve(order(), AMMA, NOW);
    if (!first.ok) throw new Error("expected ok");
    const second = approve(first.value.order, AMMA, NOW + 1);
    expect(second).toEqual({ ok: true, value: { order: first.value.order, effect: "none" } });
  });

  it("R7 reject then approve is an error", () => {
    const rejected = reject(order(), AMMA, NOW, "no payment found");
    if (!rejected.ok) throw new Error("expected ok");
    expect(approve(rejected.value.order, AMMA, NOW + 1)).toEqual({ ok: false, error: "rejected" });
  });

  it("R8 approve then reject is an error", () => {
    const approved = approve(order(), AMMA, NOW);
    if (!approved.ok) throw new Error("expected ok");
    expect(reject(approved.value.order, AMMA, NOW + 1)).toEqual({
      ok: false,
      error: "already_approved",
    });
  });

  it("R9 reject twice is idempotent and keeps the first decision", () => {
    const first = reject(order(), AMMA, NOW, "no payment found");
    if (!first.ok) throw new Error("expected ok");
    expect(first.value.order).toMatchObject({
      status: "rejected",
      decidedAt: NOW,
      decidedBy: AMMA,
      note: "no payment found",
    });
    const second = reject(first.value.order, "other@example.test", NOW + 9, "later");
    expect(second).toEqual({ ok: true, value: { order: first.value.order } });
  });

  it("R10 'ew7kq4xm' normalises to 'EW-7KQ4XM', which is valid", () => {
    expect(normalizeReference("ew7kq4xm")).toBe("EW-7KQ4XM");
    expect(isValidReference(normalizeReference("ew7kq4xm"))).toBe(true);
  });

  it("R11 a reference containing 'O' is invalid", () => {
    expect(isValidReference("EW-7KQ4OM")).toBe(false);
    expect(isValidReference(normalizeReference("ew-7kq4om"))).toBe(false);
  });
});
