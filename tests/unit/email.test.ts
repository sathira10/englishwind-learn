import { describe, expect, it } from "vitest";
import { maskEmail, nameFromEmail, normalizeEmail } from "../../src/domain/email";

describe("email helpers (plan 03)", () => {
  it("normalizes by trimming and lower-casing", () => {
    expect(normalizeEmail("  Kasun.P@Gmail.COM ")).toBe("kasun.p@gmail.com");
  });

  it("masks all but the first letter of the local part", () => {
    expect(maskEmail("Kasun@Gmail.com")).toBe("k***@gmail.com");
    expect(maskEmail("a@b.lk")).toBe("a***@b.lk");
  });

  it("masks a value with no @ completely", () => {
    expect(maskEmail("not-an-email")).toBe("***");
  });

  it("never leaves the full address in a masked value", () => {
    expect(maskEmail("amma.perera@yahoo.com")).not.toContain("amma.perera");
  });

  it("takes a default name from the part before the @", () => {
    expect(nameFromEmail("Nimali@x.lk")).toBe("nimali");
    expect(nameFromEmail("@x.lk")).toBe("student");
  });
});
