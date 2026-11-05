// Orders on D1 (plan 07 step 2, plan 13). The pure rules live in src/domain/orders.ts and
// src/domain/grants.ts; this file only reads rows, calls them, and writes the outcome.
// D1 has no interactive transactions, so each decision is one db.batch().
import { normalizeEmail } from "../../domain/email";
import { newGrant } from "../../domain/grants";
import {
  approve,
  generateReferenceFrom,
  grantStartFor,
  priceOrder,
  reject,
  type Order,
  type OrderStatus,
  type PriceError,
  type Result,
} from "../../domain/orders";
import { auditStatement } from "../admin/audit";

export interface Staff {
  email: string;
}

interface OrderRow {
  id: string;
  reference: string;
  offer_id: string;
  amount_cents: number;
  status: OrderStatus;
  created_at: number;
  decided_at: number | null;
  decided_by: string | null;
  note: string | null;
}

const ORDER_COLUMNS = `id, reference, offer_id, amount_cents, status, created_at, decided_at,
  decided_by, note`;

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    reference: row.reference,
    offerId: row.offer_id,
    amountCents: row.amount_cents,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    decidedBy: row.decided_by,
    note: row.note,
  };
}

export async function getOrder(db: D1Database, id: string): Promise<Order | null> {
  const row = await db
    .prepare(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = ?`)
    .bind(id)
    .first<OrderRow>();
  return row ? toOrder(row) : null;
}

const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
const fail = <E extends string>(error: E): { ok: false; error: E } => ({ ok: false, error });

// ---- Create ----

export interface NewOrder {
  offerId: string;
  name: string;
  email: string;
  phone: string;
}

export interface CreateDeps {
  now?: number;
  /** Draws a reference. Tests inject a fixed sequence to force a collision. */
  newReference?: () => string;
}

const MAX_REFERENCE_TRIES = 5;

const defaultReference = () =>
  generateReferenceFrom((count) => crypto.getRandomValues(new Uint8Array(count)));

function isReferenceCollision(error: unknown): boolean {
  const message = error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : "";
  return /UNIQUE constraint failed: orders\.reference/i.test(message);
}

export type CreateError = "offer_not_found" | PriceError;

/**
 * A pending bank-transfer order. The amount is read from the offer row through `priceOrder`;
 * nothing in `input` can change it. The reference is drawn at random and redrawn if another
 * order already has it. The order is linked to the student with that email, if there is one.
 */
export async function createPendingOrder(
  db: D1Database,
  input: NewOrder,
  deps: CreateDeps = {},
): Promise<Result<{ order: Order }, CreateError>> {
  const offer = await db
    .prepare(
      `SELECT id, course_id, price_cents, needs_staff_check, active FROM offers WHERE id = ?`,
    )
    .bind(input.offerId)
    .first<{
      id: string;
      course_id: string;
      price_cents: number;
      needs_staff_check: number;
      active: number;
    }>();
  if (!offer) return fail("offer_not_found");

  const price = priceOrder({
    id: offer.id,
    courseId: offer.course_id,
    priceCents: offer.price_cents,
    needsStaffCheck: offer.needs_staff_check === 1,
    active: offer.active === 1,
  });
  if (!price.ok) return price;

  const email = normalizeEmail(input.email);
  const now = deps.now ?? Date.now();
  const draw = deps.newReference ?? defaultReference;

  for (let attempt = 0; attempt < MAX_REFERENCE_TRIES; attempt++) {
    const id = crypto.randomUUID();
    const reference = draw();
    try {
      await db
        .prepare(
          `INSERT INTO orders
             (id, reference, student_id, buyer_email, buyer_name, buyer_phone, offer_id,
              amount_cents, provider, status, created_at)
           VALUES (?1, ?2, (SELECT id FROM students WHERE email = ?3), ?3, ?4, ?5, ?6, ?7,
                   'bank_transfer', 'pending', ?8)`,
        )
        .bind(id, reference, email, input.name, input.phone, offer.id, price.value.amountCents, now)
        .run();
    } catch (error) {
      if (isReferenceCollision(error)) continue;
      throw error;
    }
    const order = await getOrder(db, id);
    if (!order) throw new Error("order vanished after insert");
    return ok({ order });
  }
  throw new Error("could not find a free order reference");
}

// ---- Approve ----

export interface ApproveOptions {
  /**
   * Amma has checked the buyer's live class enrolment. Offers flagged `needs_staff_check`
   * (Q14) cannot be approved without it.
   */
  staffChecked?: boolean;
  now?: number;
}

export type ApproveError = "not_found" | "rejected" | "staff_check_required";

interface ApprovalRow extends OrderRow {
  needs_staff_check: number;
  course_id: string;
  access_years: number;
}

/**
 * Approve a pending order: one batch that marks the order approved only if it is still pending,
 * creates the grant (3-year rule, start at approval time) only if that update changed a row, and
 * writes the audit row only if the grant was created. Approving again, or at the same moment
 * from two places, therefore leaves exactly one grant and one audit row. `granted` says whether
 * this call was the one that created it.
 */
export async function approveOrder(
  db: D1Database,
  orderId: string,
  staff: Staff,
  options: ApproveOptions = {},
): Promise<Result<{ order: Order; granted: boolean }, ApproveError>> {
  const now = options.now ?? Date.now();
  const row = await db
    .prepare(
      `SELECT o.id, o.reference, o.offer_id, o.amount_cents, o.status, o.created_at, o.decided_at,
              o.decided_by, o.note, f.needs_staff_check, f.course_id, c.access_years
       FROM orders o
       JOIN offers f ON f.id = o.offer_id
       JOIN courses c ON c.id = f.course_id
       WHERE o.id = ?`,
    )
    .bind(orderId)
    .first<ApprovalRow>();
  if (!row) return fail("not_found");

  const decision = approve(toOrder(row), staff.email, now);
  if (!decision.ok) return decision;
  if (decision.value.effect === "none") return ok({ order: decision.value.order, granted: false });

  const staffChecked = options.staffChecked === true;
  if (row.needs_staff_check === 1 && !staffChecked) return fail("staff_check_required");

  const startsAt = grantStartFor(decision.value.order, now);
  const period = newGrant(startsAt, row.access_years);

  // Order matters: each statement reads changes() of the one before it.
  const results = await db.batch([
    // A student row for the buyer, if none has that email yet (the grant needs one).
    db
      .prepare(
        `INSERT OR IGNORE INTO students (id, email, name, phone, created_at)
         SELECT ?, lower(buyer_email), buyer_name, buyer_phone, ?
         FROM orders WHERE id = ? AND status = 'pending'`,
      )
      .bind(crypto.randomUUID(), now, orderId),
    db
      .prepare(
        `UPDATE orders
         SET status = 'approved', decided_at = ?, decided_by = ?,
             student_id = COALESCE(student_id, (SELECT id FROM students WHERE email = lower(buyer_email)))
         WHERE id = ? AND status = 'pending'`,
      )
      .bind(now, staff.email, orderId),
    db
      .prepare(
        `INSERT INTO grants (id, student_id, course_id, order_id, starts_at, ends_at, created_by, created_at)
         SELECT ?, o.student_id, ?, o.id, ?, ?, ?, ? FROM orders o
         WHERE o.id = ? AND changes() > 0`,
      )
      .bind(
        crypto.randomUUID(),
        row.course_id,
        period.startsAt,
        period.endsAt,
        staff.email,
        now,
        orderId,
      ),
    auditStatement(
      db,
      staff.email,
      "order.approve",
      "order",
      orderId,
      { offerId: row.offer_id, amountCents: row.amount_cents, staffChecked },
      { onlyIfChanged: true, at: now },
    ),
  ]);
  const granted = (results[2]?.meta.changes ?? 0) === 1;

  const after = await getOrder(db, orderId);
  if (!after) return fail("not_found");
  if (after.status === "rejected") return fail("rejected");
  return ok({ order: after, granted });
}

// ---- Reject ----

export type RejectError = "not_found" | "already_approved";

/** Reject a pending order (an optional free-text reason, Q19). Rejecting again changes nothing. */
export async function rejectOrder(
  db: D1Database,
  orderId: string,
  staff: Staff,
  reason?: string,
  now: number = Date.now(),
): Promise<Result<{ order: Order }, RejectError>> {
  const before = await getOrder(db, orderId);
  if (!before) return fail("not_found");
  const decision = reject(before, staff.email, now, reason);
  if (!decision.ok) return decision;
  if (before.status !== "pending") return ok({ order: decision.value.order });

  await db.batch([
    db
      .prepare(
        `UPDATE orders SET status = 'rejected', decided_at = ?, decided_by = ?, note = ?
         WHERE id = ? AND status = 'pending'`,
      )
      .bind(now, staff.email, reason ?? null, orderId),
    auditStatement(
      db,
      staff.email,
      "order.reject",
      "order",
      orderId,
      { offerId: before.offerId, hasReason: reason !== undefined && reason !== "" },
      { onlyIfChanged: true, at: now },
    ),
  ]);

  const after = await getOrder(db, orderId);
  if (!after) return fail("not_found");
  if (after.status === "approved") return fail("already_approved");
  return ok({ order: after });
}
