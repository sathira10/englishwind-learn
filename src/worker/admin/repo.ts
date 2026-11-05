// D1 reads and writes behind the admin routes (plan 09). Pure rules stay in src/domain/; each
// mutation here is one db.batch() that ends in its audit statement, written only if the change
// before it took effect, so a refused or repeated action leaves no trace.
import { extend, grantState, newGrant, revoke, type Grant } from "../../domain/grants";
import type {
  AdminCourse,
  AdminGrant,
  AdminOffer,
  AdminOrder,
  AdminStudent,
  AuditEntry,
  AuditPage,
  CourseProgressSummary,
  OrderStatus,
  StudentDetail,
} from "../../shared/admin";
import { auditStatement } from "./audit";

// ---- Orders ----

interface OrderListRow {
  id: string;
  reference: string;
  status: OrderStatus;
  amount_cents: number;
  offer_id: string;
  offer_label: string;
  needs_staff_check: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  created_at: number;
  decided_at: number | null;
  decided_by: string | null;
  note: string | null;
}

const ORDER_SELECT = `SELECT o.id, o.reference, o.status, o.amount_cents, o.offer_id,
  f.label AS offer_label, f.needs_staff_check, o.buyer_name, o.buyer_email, o.buyer_phone,
  o.student_id, s.name AS student_name, s.email AS student_email, o.created_at, o.decided_at,
  o.decided_by, o.note
  FROM orders o JOIN offers f ON f.id = o.offer_id
  LEFT JOIN students s ON s.id = o.student_id`;

function toAdminOrder(r: OrderListRow): AdminOrder {
  return {
    id: r.id,
    reference: r.reference,
    status: r.status,
    amountCents: r.amount_cents,
    offerId: r.offer_id,
    offerLabel: r.offer_label,
    needsStaffCheck: r.needs_staff_check === 1,
    buyerName: r.buyer_name,
    buyerEmail: r.buyer_email,
    buyerPhone: r.buyer_phone,
    studentId: r.student_id,
    student:
      r.student_id && r.student_name !== null && r.student_email !== null
        ? { id: r.student_id, name: r.student_name, email: r.student_email }
        : null,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
    decidedBy: r.decided_by,
    note: r.note,
  };
}

export async function listOrders(db: D1Database, status: OrderStatus): Promise<AdminOrder[]> {
  const order = status === "pending" ? "ASC" : "DESC";
  const { results } = await db
    .prepare(`${ORDER_SELECT} WHERE o.status = ? ORDER BY o.created_at ${order}, o.id LIMIT 100`)
    .bind(status)
    .all<OrderListRow>();
  return results.map(toAdminOrder);
}

export async function getAdminOrder(db: D1Database, id: string): Promise<AdminOrder | null> {
  const row = await db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).bind(id).first<OrderListRow>();
  return row ? toAdminOrder(row) : null;
}

export type AttachError = "not_found" | "student_not_found" | "not_pending" | "conflict";

/** Link a pending order to a student, so approving it grants access to that account. */
export async function attachOrder(
  db: D1Database,
  orderId: string,
  studentId: string,
  staffEmail: string,
  now: number = Date.now(),
): Promise<{ ok: true; order: AdminOrder } | { ok: false; error: AttachError }> {
  const order = await getAdminOrder(db, orderId);
  if (!order) return { ok: false, error: "not_found" };
  const student = await db
    .prepare("SELECT id FROM students WHERE id = ?")
    .bind(studentId)
    .first<{ id: string }>();
  if (!student) return { ok: false, error: "student_not_found" };
  if (order.status !== "pending") return { ok: false, error: "not_pending" };

  const [update] = await db.batch([
    db
      .prepare("UPDATE orders SET student_id = ? WHERE id = ? AND status = 'pending'")
      .bind(studentId, orderId),
    auditStatement(
      db,
      staffEmail,
      "order.attach",
      "order",
      orderId,
      { studentId, previousStudentId: order.studentId },
      { onlyIfChanged: true, at: now },
    ),
  ]);
  // Decided between our read and the update: nothing changed and no audit row was written.
  if ((update?.meta.changes ?? 0) === 0) return { ok: false, error: "conflict" };
  const after = await getAdminOrder(db, orderId);
  if (!after) return { ok: false, error: "not_found" };
  return { ok: true, order: after };
}

// ---- Offers and courses ----

export async function listOffers(db: D1Database): Promise<AdminOffer[]> {
  const { results } = await db
    .prepare(
      `SELECT id, label, price_cents, needs_staff_check FROM offers WHERE active = 1
       ORDER BY price_cents DESC, id`,
    )
    .all<{ id: string; label: string; price_cents: number; needs_staff_check: number }>();
  return results.map((r) => ({
    id: r.id,
    label: r.label,
    priceCents: r.price_cents,
    needsStaffCheck: r.needs_staff_check === 1,
  }));
}

export async function listCourses(db: D1Database): Promise<AdminCourse[]> {
  const { results } = await db
    .prepare("SELECT id, title, access_years FROM courses ORDER BY title")
    .all<{ id: string; title: string; access_years: number }>();
  return results.map((r) => ({ id: r.id, title: r.title, accessYears: r.access_years }));
}

// ---- Students ----

interface StudentRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  created_at: number;
}

const toStudent = (r: StudentRow): AdminStudent => ({
  id: r.id,
  email: r.email,
  name: r.name,
  phone: r.phone,
  createdAt: r.created_at,
});

export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 100;
const SEARCH_LIMIT = 25;

/**
 * Escape LIKE wildcards so a search for `%` or `_` matches only those characters. Only A to Z
 * are lower-cased, which is all SQLite's lower() does, so JavaScript and SQL agree.
 */
export function likePattern(q: string): string {
  return `%${q.replace(/[A-Z]/g, (ch) => ch.toLowerCase()).replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

/** Students whose email, name or phone contains `q`, case-insensitively. */
export async function searchStudents(db: D1Database, q: string): Promise<AdminStudent[]> {
  const pattern = likePattern(q.trim());
  const { results } = await db
    .prepare(
      `SELECT id, email, name, phone, created_at FROM students
       WHERE lower(email) LIKE ?1 ESCAPE '\\' OR lower(name) LIKE ?1 ESCAPE '\\'
          OR phone LIKE ?1 ESCAPE '\\'
       ORDER BY name COLLATE NOCASE, id LIMIT ${SEARCH_LIMIT}`,
    )
    .bind(pattern)
    .all<StudentRow>();
  return results.map(toStudent);
}

interface GrantRow {
  id: string;
  student_id: string;
  course_id: string;
  course_title: string;
  order_id: string | null;
  starts_at: number;
  ends_at: number;
  revoked_at: number | null;
  revoked_by: string | null;
  reason: string | null;
  created_by: string;
}

const GRANT_SELECT = `SELECT g.id, g.student_id, g.course_id, c.title AS course_title, g.order_id,
  g.starts_at, g.ends_at, g.revoked_at, g.revoked_by, g.reason, g.created_by
  FROM grants g JOIN courses c ON c.id = g.course_id`;

function toAdminGrant(r: GrantRow, now: number): AdminGrant {
  return {
    id: r.id,
    studentId: r.student_id,
    courseId: r.course_id,
    courseTitle: r.course_title,
    orderId: r.order_id,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    revokedAt: r.revoked_at,
    revokedBy: r.revoked_by,
    reason: r.reason,
    createdBy: r.created_by,
    state: grantState({ startsAt: r.starts_at, endsAt: r.ends_at, revokedAt: r.revoked_at }, now),
  };
}

export async function getAdminGrant(
  db: D1Database,
  id: string,
  now: number = Date.now(),
): Promise<AdminGrant | null> {
  const row = await db.prepare(`${GRANT_SELECT} WHERE g.id = ?`).bind(id).first<GrantRow>();
  return row ? toAdminGrant(row, now) : null;
}

export async function studentDetail(
  db: D1Database,
  id: string,
  now: number = Date.now(),
): Promise<StudentDetail | null> {
  const student = await db
    .prepare("SELECT id, email, name, phone, created_at FROM students WHERE id = ?")
    .bind(id)
    .first<StudentRow>();
  if (!student) return null;

  const [grants, orders, progress] = await db.batch<GrantRow | OrderListRow | ProgressRow>([
    db.prepare(`${GRANT_SELECT} WHERE g.student_id = ? ORDER BY g.starts_at DESC, g.id`).bind(id),
    // Orders linked to the student, plus unlinked ones placed with the same email.
    db
      .prepare(
        `${ORDER_SELECT} WHERE o.student_id = ?1 OR (o.student_id IS NULL AND lower(o.buyer_email) = ?2)
         ORDER BY o.created_at DESC, o.id`,
      )
      .bind(id, student.email),
    db
      .prepare(
        `SELECT p.course_id, c.title AS course_title,
                count(p.completed_at) AS completed, max(p.last_visited_at) AS last_visited_at
         FROM lesson_progress p JOIN courses c ON c.id = p.course_id
         WHERE p.student_id = ? GROUP BY p.course_id, c.title ORDER BY c.title`,
      )
      .bind(id),
  ]);

  return {
    student: toStudent(student),
    grants: (grants?.results as GrantRow[]).map((g) => toAdminGrant(g, now)),
    orders: (orders?.results as OrderListRow[]).map(toAdminOrder),
    progress: (progress?.results as ProgressRow[]).map((p): CourseProgressSummary => ({
      courseId: p.course_id,
      courseTitle: p.course_title,
      completedLessons: p.completed,
      lastVisitedAt: p.last_visited_at,
    })),
  };
}

interface ProgressRow {
  course_id: string;
  course_title: string;
  completed: number;
  last_visited_at: number | null;
}

// ---- Grants ----

export type GrantCreateError = "student_not_found" | "course_not_found" | "already_has_access";

/**
 * A manual grant from now for the course's access period (or `years`). Refused when the student
 * already has a current grant for the course: extend that one instead. The check is part of the
 * insert, so two taps cannot make two grants.
 */
export async function createGrant(
  db: D1Database,
  studentId: string,
  courseId: string,
  years: number | undefined,
  staffEmail: string,
  now: number = Date.now(),
): Promise<{ ok: true; grant: AdminGrant } | { ok: false; error: GrantCreateError }> {
  const student = await db
    .prepare("SELECT id FROM students WHERE id = ?")
    .bind(studentId)
    .first<{ id: string }>();
  if (!student) return { ok: false, error: "student_not_found" };
  const course = await db
    .prepare("SELECT access_years FROM courses WHERE id = ?")
    .bind(courseId)
    .first<{ access_years: number }>();
  if (!course) return { ok: false, error: "course_not_found" };

  const period = newGrant(now, years ?? course.access_years);
  const id = crypto.randomUUID();
  const [insert] = await db.batch([
    db
      .prepare(
        `INSERT INTO grants (id, student_id, course_id, order_id, starts_at, ends_at, created_by, created_at)
         SELECT ?1, ?2, ?3, NULL, ?4, ?5, ?6, ?4
         WHERE NOT EXISTS (
           SELECT 1 FROM grants WHERE student_id = ?2 AND course_id = ?3 AND revoked_at IS NULL
             AND starts_at <= ?4 AND ends_at > ?4)`,
      )
      .bind(id, studentId, courseId, period.startsAt, period.endsAt, staffEmail),
    auditStatement(
      db,
      staffEmail,
      "grant.create",
      "grant",
      id,
      { studentId, courseId, startsAt: period.startsAt, endsAt: period.endsAt },
      { onlyIfChanged: true, at: now },
    ),
  ]);
  if ((insert?.meta.changes ?? 0) === 0) return { ok: false, error: "already_has_access" };
  const grant = await getAdminGrant(db, id, now);
  if (!grant) throw new Error("grant vanished after insert");
  return { ok: true, grant };
}

const toDomainGrant = (g: AdminGrant): Grant => ({
  startsAt: g.startsAt,
  endsAt: g.endsAt,
  revokedAt: g.revokedAt,
});

export type ExtendError = "not_found" | "revoked" | "conflict";

/** Add whole years (domain rule: from the later of the end and now). Refused for a revoked grant. */
export async function extendGrant(
  db: D1Database,
  grantId: string,
  years: number,
  staffEmail: string,
  now: number = Date.now(),
): Promise<{ ok: true; grant: AdminGrant } | { ok: false; error: ExtendError }> {
  const before = await getAdminGrant(db, grantId, now);
  if (!before) return { ok: false, error: "not_found" };
  const result = extend(toDomainGrant(before), years, now);
  if (!result.ok) {
    if (result.error === "revoked") return { ok: false, error: "revoked" };
    throw new RangeError(result.error); // the route validated years; the time is ours
  }

  const [update] = await db.batch([
    // Only if nobody changed the grant since we read it.
    db
      .prepare("UPDATE grants SET ends_at = ? WHERE id = ? AND revoked_at IS NULL AND ends_at = ?")
      .bind(result.value.endsAt, grantId, before.endsAt),
    auditStatement(
      db,
      staffEmail,
      "grant.extend",
      "grant",
      grantId,
      { years, previousEndsAt: before.endsAt, endsAt: result.value.endsAt },
      { onlyIfChanged: true, at: now },
    ),
  ]);
  if ((update?.meta.changes ?? 0) === 0) return { ok: false, error: "conflict" };
  const grant = await getAdminGrant(db, grantId, now);
  if (!grant) return { ok: false, error: "not_found" };
  return { ok: true, grant };
}

/** Revoke now with a reason. Revoking again keeps the first time and reason and writes no row. */
export async function revokeGrant(
  db: D1Database,
  grantId: string,
  reason: string,
  staffEmail: string,
  now: number = Date.now(),
): Promise<AdminGrant | null> {
  const before = await getAdminGrant(db, grantId, now);
  if (!before) return null;
  const revoked = revoke(toDomainGrant(before), now);
  if (before.revokedAt === null) {
    await db.batch([
      db
        .prepare(
          `UPDATE grants SET revoked_at = ?, revoked_by = ?, reason = ?
           WHERE id = ? AND revoked_at IS NULL`,
        )
        .bind(revoked.revokedAt, staffEmail, reason, grantId),
      auditStatement(
        db,
        staffEmail,
        "grant.revoke",
        "grant",
        grantId,
        { studentId: before.studentId, courseId: before.courseId, hasReason: true },
        { onlyIfChanged: true, at: now },
      ),
    ]);
  }
  return getAdminGrant(db, grantId, now);
}

// ---- Audit log ----

export const AUDIT_DEFAULT_LIMIT = 50;
export const AUDIT_MAX_LIMIT = 100;

/** Cursor is `<at>.<id>` of the last row on the previous page; the order is (at, id) descending. */
export function parseAuditCursor(cursor: string): { at: number; id: string } | null {
  const dot = cursor.indexOf(".");
  if (dot < 1) return null;
  const at = Number(cursor.slice(0, dot));
  const id = cursor.slice(dot + 1);
  return Number.isSafeInteger(at) && id !== "" ? { at, id } : null;
}

export async function auditPage(
  db: D1Database,
  limit: number,
  before?: { at: number; id: string },
): Promise<AuditPage> {
  const where = before ? "WHERE at < ?1 OR (at = ?1 AND id < ?2)" : "";
  const stmt = db.prepare(
    `SELECT id, at, actor_email, action, entity_type, entity_id, data_json FROM audit_log
     ${where} ORDER BY at DESC, id DESC LIMIT ${limit + 1}`,
  );
  const { results } = await (before ? stmt.bind(before.at, before.id) : stmt).all<{
    id: string;
    at: number;
    actor_email: string;
    action: string;
    entity_type: string;
    entity_id: string;
    data_json: string | null;
  }>();
  const rows = results.slice(0, limit);
  const last = rows[rows.length - 1];
  return {
    entries: rows.map((r): AuditEntry => ({
      id: r.id,
      at: r.at,
      actorEmail: r.actor_email,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      data: parseJson(r.data_json),
    })),
    next: results.length > limit && last ? `${last.at}.${last.id}` : null,
  };
}

function parseJson(text: string | null): unknown {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
