import { describe, expect, it } from "vitest";
import { WHATSAPP, whatsappUrl } from "../../src/shared/contact";

describe("whatsappUrl (Q26)", () => {
  it("links to the site's number, digits only", () => {
    expect(whatsappUrl()).toBe("https://wa.me/94776408668");
    expect(WHATSAPP.display.replace(/\D/g, "")).toBe(WHATSAPP.number);
  });

  it("encodes a prefilled message", () => {
    expect(whatsappUrl("Transfer receipt for EW-7KQ4XM & more")).toBe(
      "https://wa.me/94776408668?text=Transfer%20receipt%20for%20EW-7KQ4XM%20%26%20more",
    );
  });
});
