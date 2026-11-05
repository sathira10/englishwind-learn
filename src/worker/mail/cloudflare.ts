import type { Mailer } from "./mailer";

// Cloudflare Email Service sender. Off until Sathira sets up the sending domain
// (plans/OPEN-QUESTIONS.md Q6); slice 10 wires it.
export function createCloudflareMailer(): Mailer {
  return {
    async sendLoginCode() {
      throw new Error("Cloudflare Email Service is not configured (Q6)");
    },
  };
}
