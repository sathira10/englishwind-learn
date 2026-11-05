import { describe, expect, it } from "vitest";
import { accessEnd, extend, revoke } from "./grants";

const MAX_DATE = 8_640_000_000_000_000;
const g = { startsAt: 0, endsAt: 1_000, revokedAt: null };

describe("input checks", () => {
  it("accessEnd rejects bad years with a clear message", () => {
    expect(() => accessEnd(0, 0)).toThrow(/years must be a positive integer/);
  });

  it("accessEnd rejects a non-integer start", () => {
    expect(() => accessEnd(1.5, 1)).toThrow(/startsAt must be an integer/);
    expect(() => accessEnd(Number.NaN, 1)).toThrow(/startsAt must be an integer/);
  });

  it("accessEnd rejects an end beyond the representable range", () => {
    expect(() => accessEnd(MAX_DATE - 1, 1)).toThrow(/out of range/);
  });

  it("extend reports a bad now as invalid-time", () => {
    expect(extend(g, 1, Number.NaN)).toEqual({ ok: false, error: "invalid-time" });
    expect(extend(g, 1, 0.5)).toEqual({ ok: false, error: "invalid-time" });
  });

  it("extend reports an end beyond the range as invalid-time", () => {
    expect(extend(g, 1, MAX_DATE - 1)).toEqual({ ok: false, error: "invalid-time" });
  });

  it("extend and revoke do not change the input grant", () => {
    const copy = { ...g };
    extend(g, 1, 0);
    revoke(g, 5);
    expect(g).toEqual(copy);
  });
});
