// These cases mirror the reference-case table in plans/02-grant-rules.md. They are unit tests
// until Sathira approves them and copies them to tests/reference/ (OPEN-QUESTIONS Q10).
// Times are written in Asia/Colombo (+05:30), as in the plan; the UTC instant is in the title.
import { describe, expect, it } from "vitest";
import {
  accessEnd,
  colomboDate,
  extend,
  hasAccess,
  isCurrent,
  newGrant,
  revoke,
  type Grant,
} from "../../src/domain/grants";

const at = (colombo: string) => Date.parse(`${colombo}+05:30`);
const grant = (startsAt: string, endsAt: string, revokedAt: string | null = null): Grant => ({
  startsAt: at(startsAt),
  endsAt: at(endsAt),
  revokedAt: revokedAt === null ? null : at(revokedAt),
});

describe("plan 02 reference cases", () => {
  it("R1: 16 Nov 2026 10:00 + 3y = 16 Nov 2029 10:00 (04:30Z both)", () => {
    expect(accessEnd(at("2026-11-16T10:00:00"), 3)).toBe(at("2029-11-16T10:00:00"));
    expect(accessEnd(at("2026-11-16T10:00:00"), 3)).toBe(Date.parse("2029-11-16T04:30:00Z"));
  });

  it("R2: 29 Feb 2028 10:00 + 3y = 1 Mar 2031 10:00 (never shorter, Q12)", () => {
    const end = accessEnd(at("2028-02-29T10:00:00"), 3);
    expect(end).toBe(at("2031-03-01T10:00:00"));
    expect(end).toBe(Date.parse("2031-03-01T04:30:00Z"));
  });

  it("R3: 31 Dec 2026 23:30 (18:00Z) + 3y = 31 Dec 2029 23:30 (18:00Z)", () => {
    const end = accessEnd(at("2026-12-31T23:30:00"), 3);
    expect(end).toBe(Date.parse("2029-12-31T18:00:00Z"));
    expect(colomboDate(end)).toBe("2029-12-31");
  });

  it("R4: 1 Jan 2026 02:00 (31 Dec 2025 20:30Z) + 3y = 1 Jan 2029 02:00 (31 Dec 2028 20:30Z)", () => {
    const end = accessEnd(at("2026-01-01T02:00:00"), 3);
    expect(end).toBe(Date.parse("2028-12-31T20:30:00Z"));
    expect(colomboDate(end)).toBe("2029-01-01");
  });

  it("R5: 29 Feb 2028 10:00 + 4y keeps 29 Feb 2032 (leap year)", () => {
    expect(accessEnd(at("2028-02-29T10:00:00"), 4)).toBe(at("2032-02-29T10:00:00"));
  });

  it("R6: 29 Feb 2024 00:00 (28 Feb 18:30Z) + 1y = 1 Mar 2025 00:00 (28 Feb 2025 18:30Z)", () => {
    const end = accessEnd(at("2024-02-29T00:00:00"), 1);
    expect(end).toBe(Date.parse("2025-02-28T18:30:00Z"));
    expect(colomboDate(end)).toBe("2025-03-01");
  });

  it("R7: a grant is current from its start until the instant before its end", () => {
    const g = grant("2026-11-16T10:00:00", "2029-11-16T10:00:00");
    expect(isCurrent(g, g.startsAt - 1)).toBe(false);
    expect(isCurrent(g, g.startsAt)).toBe(true);
    expect(isCurrent(g, g.endsAt - 1)).toBe(true);
  });

  it("R8: a grant ending exactly at now is not current", () => {
    const g = grant("2026-11-16T10:00:00", "2029-11-16T10:00:00");
    expect(isCurrent(g, at("2029-11-16T10:00:00"))).toBe(false);
  });

  it("R9: a revoked grant is current until revokedAt, then not", () => {
    const g = grant("2026-11-16T10:00:00", "2029-11-16T10:00:00", "2027-06-01T12:00:00");
    expect(isCurrent(g, at("2027-06-01T11:59:59"))).toBe(true);
    expect(isCurrent(g, at("2027-06-01T12:00:00"))).toBe(false);
    expect(isCurrent(g, at("2028-01-01T00:00:00"))).toBe(false);
  });

  it("R10: extend before expiry adds a year to the current end", () => {
    const g = grant("2026-11-16T10:00:00", "2029-11-16T10:00:00");
    const r = extend(g, 1, at("2028-01-10T12:00:00"));
    expect(r).toEqual({ ok: true, value: { ...g, endsAt: at("2030-11-16T10:00:00") } });
  });

  it("R11: extend after expiry counts from now", () => {
    const g = grant("2026-11-16T10:00:00", "2029-11-16T10:00:00");
    const r = extend(g, 1, at("2030-03-05T15:00:00"));
    expect(r).toEqual({ ok: true, value: { ...g, endsAt: at("2031-03-05T15:00:00") } });
  });

  it("R12: extending a revoked grant fails, even after it has ended", () => {
    const g = grant("2026-11-16T10:00:00", "2029-11-16T10:00:00", "2027-06-01T12:00:00");
    expect(extend(g, 1, at("2028-01-01T00:00:00"))).toEqual({ ok: false, error: "revoked" });
    expect(extend(g, 1, at("2030-01-01T00:00:00"))).toEqual({ ok: false, error: "revoked" });
  });

  it("R13: revoking twice keeps the first revokedAt", () => {
    const g = grant("2026-11-16T10:00:00", "2029-11-16T10:00:00");
    const once = revoke(g, at("2027-06-01T12:00:00"));
    const twice = revoke(once, at("2027-09-01T12:00:00"));
    expect(once.revokedAt).toBe(at("2027-06-01T12:00:00"));
    expect(twice).toEqual(once);
  });

  it("R14: access needs at least one current grant", () => {
    const old = grant("2020-01-01T09:00:00", "2023-01-01T09:00:00");
    const now = grant("2026-11-16T10:00:00", "2029-11-16T10:00:00");
    const t = at("2027-01-01T00:00:00");
    expect(hasAccess([], t)).toBe(false);
    expect(hasAccess([old], t)).toBe(false);
    expect(hasAccess([old, now], t)).toBe(true);
  });

  it("R15: newGrant gives the start and the 3-year end", () => {
    expect(newGrant(at("2026-11-16T10:00:00"), 3)).toEqual({
      startsAt: at("2026-11-16T10:00:00"),
      endsAt: at("2029-11-16T10:00:00"),
    });
  });

  it("R16: years must be a positive integer", () => {
    const s = at("2026-11-16T10:00:00");
    for (const bad of [0, -1, 1.5, Number.NaN, Infinity]) {
      expect(() => accessEnd(s, bad)).toThrow(RangeError);
      expect(extend(grant("2026-11-16T10:00:00", "2029-11-16T10:00:00"), bad, s)).toEqual({
        ok: false,
        error: "invalid-years",
      });
    }
  });

  it("R17: colomboDate shows the Colombo day, not the UTC day", () => {
    expect(colomboDate(Date.parse("2026-12-31T18:00:00Z"))).toBe("2026-12-31");
    expect(colomboDate(Date.parse("2026-12-31T18:30:00Z"))).toBe("2027-01-01");
  });
});
