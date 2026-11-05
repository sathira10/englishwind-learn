import type { Context } from "hono";
import type { AdminEnv } from "./staff";

/**
 * An audit_log insert for the signed-in staff member. It is returned unexecuted so the caller
 * puts it in the same db.batch() as the change it records (no interactive transactions in D1).
 * Keep `data` free of personal details beyond ids.
 */
export function audit(
  c: Context<AdminEnv>,
  action: string,
  entityType: string,
  entityId: string,
  data?: unknown,
): D1PreparedStatement {
  return c.env.DB.prepare(
    `INSERT INTO audit_log (id, at, actor_email, action, entity_type, entity_id, data_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    Date.now(),
    c.get("staff").email,
    action,
    entityType,
    entityId,
    data === undefined ? null : JSON.stringify(data),
  );
}
