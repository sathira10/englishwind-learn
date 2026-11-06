import { maskEmail } from "../../domain/email";
import {
  accessGrantedEmail,
  orderReceivedEmail,
  orderRejectedEmail,
} from "../../domain/email-templates";
import type { Mailer } from "./mailer";

// Local and test sender. Logs the code so a developer can sign in, but only a masked address:
// no full email in logs (docs/review.md). Other messages log the subject (it carries the order
// reference or course) and no body.
export function createConsoleMailer(log: (line: string) => void = console.log): Mailer {
  return {
    async sendLoginCode(to, code) {
      log(`[mail:console] login code ${code} for ${maskEmail(to)}`);
    },
    async orderReceived(to, data) {
      log(`[mail:console] "${orderReceivedEmail(data).subject}" to ${maskEmail(to)}`);
    },
    async accessGranted(to, data) {
      log(`[mail:console] "${accessGrantedEmail(data).subject}" to ${maskEmail(to)}`);
    },
    async orderRejected(to, data) {
      log(`[mail:console] "${orderRejectedEmail(data).subject}" to ${maskEmail(to)}`);
    },
  };
}
