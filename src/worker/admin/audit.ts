import type { Context } from "hono";
import type { AdminEnv } from "./staff";

/**
 * An audit_log insert, returned unexecuted so the caller puts it in the same db.batch() as the
 * change it records (no interactive transactions in D1). Keep `data` free of personal details
 * beyond ids. With `onlyIfChanged` the row is written only when the statement just before it in
 * the batch changed a row, so a refused or repeated action leaves no trace.
 */
export function auditStatement(
  db: D1Database,
  actorEmail: string,
  action: string,
  entityType: string,
  entityId: string,
  data?: unknown,
  options: { onlyIfChanged?: boolean; at?: number } = {},
): D1PreparedStatement {
  const values = [
    crypto.randomUUID(),
    options.at ?? Date.now(),
    actorEmail,
    action,
    entityType,
    entityId,
    data === undefined ? null : JSON.stringify(data),
  ];
  const sql = options.onlyIfChanged
    ? `INSERT INTO audit_log (id, at, actor_email, action, entity_type, entity_id, data_json)
       SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0`
    : `INSERT INTO audit_log (id, at, actor_email, action, entity_type, entity_id, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`;
  return db.prepare(sql).bind(...values);
}

/** An audit_log insert for the signed-in staff member (see `auditStatement`). */
export function audit(
  c: Context<AdminEnv>,
  action: string,
  entityType: string,
  entityId: string,
  data?: unknown,
): D1PreparedStatement {
  return auditStatement(c.env.DB, c.get("staff").email, action, entityType, entityId, data);
}
