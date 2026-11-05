import { createCloudflareMailer } from "./cloudflare";
import { createConsoleMailer } from "./console";
import type { Mailer } from "./mailer";

export type { AccessGrantedData, Mailer, OrderReceivedData, OrderRejectedData } from "./mailer";
export { notifyAccessGranted, sendSafely, signInUrl } from "./notify";

/** Picks the sender from MAIL_DRIVER. The console sender prints login codes, so it refuses to
 *  run on a public https host. */
export function mailerFromEnv(env: Pick<Env, "MAIL_DRIVER" | "BETTER_AUTH_URL">): Mailer {
  const driver: string = env.MAIL_DRIVER;
  if (driver === "cloudflare") return createCloudflareMailer();
  if (driver === "console") {
    const { protocol, hostname } = new URL(env.BETTER_AUTH_URL);
    if (protocol === "https:" && hostname !== "localhost") {
      throw new Error("MAIL_DRIVER=console would print login codes on a public host");
    }
    return createConsoleMailer();
  }
  throw new Error(`Unknown MAIL_DRIVER: ${driver}`);
}
