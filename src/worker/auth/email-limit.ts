import { normalizeEmail } from "../../domain/email";
import { consumeLimit, sha256Hex } from "../rate-limit";
import { EMAIL_SEND_LIMIT } from "./create-auth";

/**
 * Per-address cap on login-code sends, kept in `rate_limits` beside Better Auth's per-IP rows.
 * The key holds a hash, never the address. Returns false when the address has used up its sends.
 */
export async function consumeEmailSend(db: D1Database, email: string, now = Date.now()) {
  const key = `otp-email:${await sha256Hex(normalizeEmail(email))}`;
  return consumeLimit(db, key, EMAIL_SEND_LIMIT, now);
}
