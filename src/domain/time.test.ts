import { describe, expect, it } from "vitest";
import { formatAge, formatColomboDate, formatColomboDateTime } from "./time";

const MIDNIGHT_UTC = Date.UTC(2026, 10, 5); // 5 Nov 2026 00:00Z = 05:30 in Colombo

describe("Colombo time", () => {
  it("shifts by +05:30", () => {
    expect(formatColomboDateTime(MIDNIGHT_UTC)).toBe("5 Nov 2026, 5:30 am");
  });
  it("rolls over to the next Colombo day", () => {
    const late = Date.UTC(2026, 11, 31, 19, 0); // 00:30 on 1 Jan 2027 in Colombo
    expect(formatColomboDate(late)).toBe("1 Jan 2027");
    expect(formatColomboDateTime(late)).toBe("1 Jan 2027, 12:30 am");
  });
  it("uses 12 for noon and pm after it", () => {
    expect(formatColomboDateTime(Date.UTC(2026, 10, 5, 6, 30))).toBe("5 Nov 2026, 12:00 pm");
    expect(formatColomboDateTime(Date.UTC(2026, 10, 5, 10, 5))).toBe("5 Nov 2026, 3:35 pm");
  });
});

describe("formatAge", () => {
  const now = 10_000_000_000;
  it.each([
    [0, "just now"],
    [59_000, "just now"],
    [60_000, "1 min ago"],
    [59 * 60_000, "59 min ago"],
    [60 * 60_000, "1 h ago"],
    [23 * 3_600_000, "23 h ago"],
    [24 * 3_600_000, "1 day ago"],
    [49 * 3_600_000, "2 days ago"],
  ])("%i ms ago reads %s", (ago, text) => {
    expect(formatAge(now - ago, now)).toBe(text);
  });
  it("treats a future time as just now", () => {
    expect(formatAge(now + 5000, now)).toBe("just now");
  });
});
