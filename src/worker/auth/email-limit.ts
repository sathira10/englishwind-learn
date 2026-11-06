import { z } from "zod";
import { normalizeEmail } from "../../domain/email";
import { consumeLimit, sha256Hex } from "../rate-limit";
import { EMAIL_SEND_LIMIT, OTP_SEND_LIMIT } from "./create-auth";

/** The only code request the app makes. Anything else is refused before any quota is used. */
export const sendCodeRequest = z.object({
  email: z.email().max(254),
  type: z.literal("sign-in"),
});

/**
 * Per-IP cap on code sends, checked before the per-address cap so a client already over its
 * own limit cannot spend another address's sends. Better Auth keeps its own per-IP rule too;
 * both count the same requests. The key holds a hash of the IP.
 */
export async function consumeIpSend(db: D1Database, ip: string, now = Date.now()) {
  return consumeLimit(db, `otp-ip:${await sha256Hex(ip)}`, OTP_SEND_LIMIT, now);
}

/**
 * Per-address cap on login-code sends, kept in `rate_limits` beside Better Auth's per-IP rows.
 * The key holds a hash, never the address. Returns false when the address has used up its sends;
 * that path writes nothing (see `consumeLimit`).
 */
export async function consumeEmailSend(db: D1Database, email: string, now = Date.now()) {
  const key = `otp-email:${await sha256Hex(normalizeEmail(email))}`;
  return consumeLimit(db, key, EMAIL_SEND_LIMIT, now);
}
