// The one WhatsApp number in the app (Q26). It is the public site's number
// (englishwind-web/src/data/site.ts); change it in both places together.
export const WHATSAPP = {
  display: "+94 77 640 8668",
  number: "94776408668",
} as const;

/** A wa.me link, optionally with a message already typed in. */
export function whatsappUrl(text?: string): string {
  const base = `https://wa.me/${WHATSAPP.number}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
