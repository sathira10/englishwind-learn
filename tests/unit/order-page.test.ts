import { describe, expect, it } from "vitest";
import page from "../../src/client/OrderPage.tsx?raw";
import { BANK_DETAILS } from "../../src/shared/bank";

// Plan 13 step 3. The page is checked by reading its source: its copy rules and that no fact is
// typed into it. The API behind it is covered by orders-api.test.ts.
describe("order page source", () => {
  it('never says "books"', () => {
    expect(page.toLowerCase()).not.toMatch(/\bbooks?\b/);
    expect(page).toContain("class materials and resources");
  });

  it("types no bank detail or price; it shows what the API returns", () => {
    for (const value of Object.values(BANK_DETAILS)) expect(page).not.toContain(value);
    expect(page).not.toMatch(/\bLKR \d/);
  });

  it("uses no raw colour", () => {
    expect(page).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|text-\[/);
  });
});
