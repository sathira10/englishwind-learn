import { normalizeEmail } from "../../domain/email";
import { EMAIL_SEND_LIMIT } from "./create-auth";

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Per-address cap on login-code sends, kept in `rate_limits` beside Better Auth's per-IP rows.
 * The key holds a hash, never the address. One upsert statement, so concurrent requests cannot
 * both slip under the cap. Fixed window: `last_request` is when the window started.
 * Returns false when the address has used up its sends.
 */
export async function consumeEmailSend(db: D1Database, email: string, now = Date.now()) {
  const key = `otp-email:${await sha256Hex(normalizeEmail(email))}`;
  const { window, max } = EMAIL_SEND_LIMIT;
  const windowStart = now - window * 1000;
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (id, key, count, last_request) VALUES (?1, ?2, 1, ?3)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN last_request <= ?4 THEN 1 ELSE count + 1 END,
         last_request = CASE WHEN last_request <= ?4 THEN ?3 ELSE last_request END
       RETURNING count`,
    )
    .bind(crypto.randomUUID(), key, now, windowStart)
    .first<{ count: number }>();
  return (row?.count ?? 1) <= max;
}
