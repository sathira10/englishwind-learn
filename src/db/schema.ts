// Drizzle schema for D1 (plans/01-data-model.md). After a change, run `pnpm db:generate` to
// write the SQL migration to src/db/migrations/ and review it. Never edit an applied one.
//
// Conventions: text primary keys (crypto.randomUUID() unless noted), times are integer epoch
// milliseconds in `*_at` columns (UTC), money is integer LKR cents, enums are CHECK constraints.
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const students = sqliteTable("students", {
  id: text().primaryKey(),
  email: text().notNull().unique(), // stored lower-case
  name: text().notNull(),
  phone: text(),
  // Links to the auth user added in slice 03. No foreign key until that table exists.
  userId: text("user_id").unique(),
  createdAt: integer("created_at").notNull(),
});

export const courses = sqliteTable("courses", {
  id: text().primaryKey(), // slug, e.g. 'blueprint'
  title: text().notNull(),
  accessYears: integer("access_years").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const coursePublications = sqliteTable(
  "course_publications",
  {
    id: text().primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    version: integer().notNull(),
    contentJson: text("content_json").notNull(), // modules and lessons
    publishedAt: integer("published_at").notNull(),
    publishedBy: text("published_by").notNull(),
  },
  (t) => [uniqueIndex("course_publications_course_version").on(t.courseId, t.version)],
);

export const resources = sqliteTable(
  "resources",
  {
    id: text().primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    lessonKey: text("lesson_key").notNull(),
    kind: text().notNull(),
    label: text().notNull(),
    r2Key: text("r2_key").notNull().unique(), // never leaves the server
    contentType: text("content_type").notNull(),
    bytes: integer().notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    check("resources_kind_check", sql`${t.kind} in ('worksheet')`),
    index("resources_course_lesson").on(t.courseId, t.lessonKey),
  ],
);

export const offers = sqliteTable(
  "offers",
  {
    id: text().primaryKey(), // slug, e.g. 'blueprint-class-monthly'
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    label: text().notNull(),
    priceCents: integer("price_cents").notNull(),
    needsStaffCheck: integer("needs_staff_check", { mode: "boolean" }).notNull().default(false),
    active: integer({ mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [check("offers_price_check", sql`${t.priceCents} >= 0`)],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text().primaryKey(),
    reference: text().notNull().unique(), // e.g. EW-7KQ4XM
    studentId: text("student_id").references(() => students.id),
    buyerEmail: text("buyer_email").notNull(),
    buyerName: text("buyer_name").notNull(),
    buyerPhone: text("buyer_phone").notNull(),
    offerId: text("offer_id")
      .notNull()
      .references(() => offers.id),
    amountCents: integer("amount_cents").notNull(), // copied from the offer at order time
    provider: text().notNull().default("bank_transfer"),
    providerRef: text("provider_ref"),
    status: text().notNull().default("pending"),
    createdAt: integer("created_at").notNull(),
    decidedAt: integer("decided_at"),
    decidedBy: text("decided_by"), // staff email
    note: text(),
  },
  (t) => [
    check("orders_status_check", sql`${t.status} in ('pending','approved','rejected')`),
    check("orders_amount_check", sql`${t.amountCents} >= 0`),
    index("orders_status_created").on(t.status, t.createdAt),
    index("orders_buyer_email").on(t.buyerEmail),
  ],
);

export const grants = sqliteTable(
  "grants",
  {
    id: text().primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    // UNIQUE: the database half of approve-once, one grant per order. NULL for manual grants.
    orderId: text("order_id")
      .unique()
      .references(() => orders.id),
    startsAt: integer("starts_at").notNull(),
    endsAt: integer("ends_at").notNull(),
    revokedAt: integer("revoked_at"),
    revokedBy: text("revoked_by"),
    reason: text(),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("grants_student_course").on(t.studentId, t.courseId)],
);

export const lessonProgress = sqliteTable(
  "lesson_progress",
  {
    studentId: text("student_id")
      .notNull()
      .references(() => students.id),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    lessonKey: text("lesson_key").notNull(),
    completedAt: integer("completed_at"),
    lastVisitedAt: integer("last_visited_at"),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.courseId, t.lessonKey] })],
);

export const staffRoles = sqliteTable(
  "staff_roles",
  {
    email: text().primaryKey(), // lower-case
    role: text().notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [check("staff_roles_role_check", sql`${t.role} in ('owner','admin')`)],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text().primaryKey(),
    at: integer().notNull(),
    actorEmail: text("actor_email").notNull(),
    action: text().notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    dataJson: text("data_json"),
  },
  (t) => [index("audit_log_entity").on(t.entityType, t.entityId), index("audit_log_at").on(t.at)],
);
