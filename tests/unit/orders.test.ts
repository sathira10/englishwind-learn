import { describe, expect, it } from "vitest";
import {
  REFERENCE_ALPHABET,
  formatLkr,
  generateReference,
  generateReferenceFrom,
  grantStartFor,
  isValidReference,
  normalizeReference,
  priceOrder,
  type Order,
} from "../../src/domain/orders";

describe("generateReference", () => {
  it("emits EW- plus 6 alphabet characters", () => {
    const ref = generateReference(Uint8Array.from([0, 1, 2, 3, 4, 5]));
    expect(ref).toBe("EW-234567");
    expect(isValidReference(ref)).toBe(true);
  });

  it("skips biased bytes (248 and above) and asks for more", () => {
    const asked: number[] = [];
    const ref = generateReferenceFrom((n) => {
      asked.push(n);
      return asked.length === 1
        ? Uint8Array.from([255, 248, 0, 247, 250, 31])
        : Uint8Array.from([1, 2, 3, 4, 5, 6]).slice(0, n);
    });
    // First batch accepts 0 -> '2', 247 -> 'Z' (247 % 31 = 30), 31 -> '2' (31 % 31 = 0).
    expect(ref).toBe("EW-2Z2345");
    expect(asked).toEqual([6, 3]);
  });

  it("throws when a fixed buffer runs out", () => {
    expect(() => generateReference(Uint8Array.from([255, 255, 255]))).toThrow();
  });

  it("is uniform over a deterministic source covering every accepted byte equally", () => {
    const counts = new Map<string, number>();
    let next = 0;
    for (let i = 0; i < 248 * 4; i++) {
      const ref = generateReferenceFrom((n) => {
        const out = new Uint8Array(n);
        for (let j = 0; j < n; j++) out[j] = next++ % 256;
        return out;
      });
      counts.set(ref[3]!, (counts.get(ref[3]!) ?? 0) + 1);
    }
    expect(counts.size).toBe(REFERENCE_ALPHABET.length);
    const values = [...counts.values()];
    // Every character is hit about equally often; no character is favoured by a byte wrap.
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(8);
  });

  it("works with crypto.getRandomValues and only uses the alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const ref = generateReferenceFrom((n) => crypto.getRandomValues(new Uint8Array(n)));
      expect(ref).toMatch(/^EW-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    }
  });
});

describe("normalizeReference / isValidReference", () => {
  it("accepts typed variants", () => {
    expect(normalizeReference("  ew-7kq4xm ")).toBe("EW-7KQ4XM");
    expect(normalizeReference("EW 7KQ4XM")).toBe("EW-7KQ4XM");
    expect(normalizeReference("EW-7KQ4XM")).toBe("EW-7KQ4XM");
  });

  it("rejects wrong length, look-alikes and other prefixes", () => {
    const bad = ["EW-7KQ4X", "EW-7KQ4XMM", "EW-7KQ4X1", "EW-7KQ4X0", "EW-7KQ4XI", "EW-7KQ4XL"];
    for (const s of [...bad, "XX-7KQ4XM", ""]) {
      expect(isValidReference(s)).toBe(false);
    }
  });
});

describe("priceOrder", () => {
  const base = { id: "o", courseId: "c", needsStaffCheck: false, active: true };

  it("rejects non-integer, negative and NaN prices", () => {
    for (const priceCents of [10.5, -1, Number.NaN]) {
      expect(priceOrder({ ...base, priceCents })).toEqual({ ok: false, error: "invalid_price" });
    }
  });
});

describe("formatLkr", () => {
  it("formats whole rupees, cents and zero", () => {
    expect(formatLkr(1_000_000)).toBe("LKR 10,000");
    expect(formatLkr(200_050)).toBe("LKR 2,000.50");
    expect(formatLkr(200_005)).toBe("LKR 2,000.05");
    expect(formatLkr(0)).toBe("LKR 0");
    expect(formatLkr(99)).toBe("LKR 0.99");
    expect(formatLkr(123_456_700)).toBe("LKR 1,234,567");
  });

  it("throws on invalid cents", () => {
    expect(() => formatLkr(-1)).toThrow();
    expect(() => formatLkr(1.5)).toThrow();
  });
});

describe("grantStartFor", () => {
  it("is the approval time, not the order time", () => {
    expect(grantStartFor({ createdAt: 1 } as Order, 9_999)).toBe(9_999);
  });
});
