import type { ReactNode } from "react";
import { whatsappUrl } from "../../shared/contact";

/** An inline link that opens a WhatsApp chat with EnglishWind, in a new tab. */
export function WhatsAppLink({ children, text }: { children: ReactNode; text?: string }) {
  return (
    <a href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer" className="ew-link">
      {children}
    </a>
  );
}
