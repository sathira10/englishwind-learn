export async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Fixed-window counter in `rate_limits`, beside Better Auth's per-IP rows. `key` should hold a
 * hash, never an address. One upsert statement, so concurrent requests cannot both slip under
 * the cap. `last_request` is when the window started. Returns false once `max` is used up.
 */
export async function consumeLimit(
  db: D1Database,
  key: string,
  limit: { window: number; max: number },
  now = Date.now(),
) {
  const windowStart = now - limit.window * 1000;
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
  return (row?.count ?? 1) <= limit.max;
}
