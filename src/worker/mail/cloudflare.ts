import type { Mailer } from "./mailer";

// Cloudflare Email Service sender. Off until Sathira sets up the sending domain
// (plans/OPEN-QUESTIONS.md Q6). Every message fails the same way until then; once configured it
// will render with src/domain/email-templates.ts and send from noreply@, replies to hello@.
export function createCloudflareMailer(): Mailer {
  const notConfigured = async (): Promise<void> => {
    throw new Error("Cloudflare Email Service is not configured (Q6)");
  };
  return {
    sendLoginCode: notConfigured,
    orderReceived: notConfigured,
    accessGranted: notConfigured,
    orderRejected: notConfigured,
  };
}
