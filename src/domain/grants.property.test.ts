// Proposed properties from plans/02-grant-rules.md. None is approved yet (approved: no); they
// run now so the code is checked meanwhile. Sathira approves each one in the plan.
import fc from "fast-check";
import { describe, it } from "vitest";
import { accessEnd, extend, isCurrent, revoke, type Grant } from "./grants";

const DAY = 24 * 60 * 60 * 1000;
// 2000-01-01 to 2100-01-01, in epoch ms.
const instant = fc.integer({ min: 946_684_800_000, max: 4_102_444_800_000 });
const years = fc.integer({ min: 1, max: 10 });
const grantArb = fc
  .record({ startsAt: instant, years, revokedAt: fc.option(instant, { nil: null }) })
  .map(({ startsAt, years, revokedAt }): Grant => ({
    startsAt,
    endsAt: accessEnd(startsAt, years),
    revokedAt,
  }));

describe("grant properties (proposed, approved: no)", () => {
  it("P1: endsAt is after startsAt", () => {
    fc.assert(fc.property(instant, years, (s, y) => accessEnd(s, y) > s));
  });

  it("P2: access lasts at least years*365 days and at most years*366+1 days", () => {
    fc.assert(
      fc.property(instant, years, (s, y) => {
        const len = accessEnd(s, y) - s;
        return len >= y * 365 * DAY && len <= (y * 366 + 1) * DAY;
      }),
    );
  });

  it("P3: no grant is current at or after its end", () => {
    fc.assert(
      fc.property(grantArb, fc.nat({ max: 10 * 365 * DAY }), (g, extra) => {
        return !isCurrent(g, g.endsAt + extra);
      }),
    );
  });

  it("P4: extend never shortens, and counts from the later of end and now", () => {
    fc.assert(
      fc.property(grantArb, years, instant, (g, y, now) => {
        const r = extend({ ...g, revokedAt: null }, y, now);
        return (
          r.ok &&
          r.value.endsAt > g.endsAt &&
          r.value.endsAt === accessEnd(Math.max(g.endsAt, now), y)
        );
      }),
    );
  });

  it("P5: revoke is idempotent and keeps the first revokedAt", () => {
    fc.assert(
      fc.property(grantArb, instant, instant, (g, t1, t2) => {
        const once = revoke({ ...g, revokedAt: null }, t1);
        const twice = revoke(once, t2);
        return once.revokedAt === t1 && twice.revokedAt === t1;
      }),
    );
  });

  it("P6: a revoked grant is never current from revokedAt on", () => {
    fc.assert(
      fc.property(grantArb, instant, fc.nat({ max: 5 * 365 * DAY }), (g, t, extra) => {
        return !isCurrent(revoke({ ...g, revokedAt: null }, t), t + extra);
      }),
    );
  });

  it("P7: a revoked grant cannot be extended", () => {
    fc.assert(
      fc.property(grantArb, years, instant, (g, y, now) => {
        const r = extend(revoke(g, now), y, now);
        return !r.ok && r.error === "revoked";
      }),
    );
  });
});
