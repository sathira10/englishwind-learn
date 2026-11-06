import {
  accessGrantedEmail,
  loginCodeEmail,
  orderReceivedEmail,
  orderRejectedEmail,
  type EmailContent,
} from "../../domain/email-templates";
import type { Mailer } from "./mailer";

// Cloudflare Email Service sender, through the `EMAIL` send_email binding (wrangler.jsonc).
// Sends from noreply@englishwind.lk with replies to hello@ (Q6). The sending domain must be
// onboarded in the Cloudflare dashboard first (docs/deploying.md); until then every send fails
// and the callers log the failure without the address.
export const MAIL_FROM = { name: "EnglishWind", email: "noreply@englishwind.lk" } as const;
export const MAIL_REPLY_TO = "hello@englishwind.lk";

/** The part of the `SendEmail` binding this sender uses. */
type Sender = { send(message: EmailMessageBuilder): Promise<unknown> };

export function createCloudflareMailer(binding: Sender): Mailer {
  const send = async (to: string, content: EmailContent): Promise<void> => {
    await binding.send({
      to,
      from: MAIL_FROM,
      replyTo: MAIL_REPLY_TO,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  };
  return {
    sendLoginCode: (to, code) => send(to, loginCodeEmail(code)),
    orderReceived: (to, data) => send(to, orderReceivedEmail(data)),
    accessGranted: (to, data) => send(to, accessGrantedEmail(data)),
    orderRejected: (to, data) => send(to, orderRejectedEmail(data)),
  };
}
