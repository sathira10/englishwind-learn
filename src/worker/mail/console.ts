import { maskEmail } from "../../domain/email";
import type { Mailer } from "./mailer";

// Local and test sender. Logs the code so a developer can sign in, but only a masked address:
// no full email in logs (docs/review.md).
export function createConsoleMailer(log: (line: string) => void = console.log): Mailer {
  return {
    async sendLoginCode(to, code) {
      log(`[mail:console] login code ${code} for ${maskEmail(to)}`);
    },
  };
}
