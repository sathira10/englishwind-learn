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
  // The Better Auth user (users.id), set when they first sign in (plans/03-auth.md, ADR 0008).
  // No foreign key: adding one to an existing table means rebuilding it under live foreign keys.
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

// Better Auth tables (plans/03-auth.md). Names and columns follow Better Auth's core schema with
// `usePlural: true`; the adapter finds a table by its export name here. Better Auth writes Date
// values, so these use `timestamp_ms` (epoch milliseconds, UTC) like every other `*_at` column.
export const users = sqliteTable("users", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(), // Better Auth lower-cases it
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text().primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text().notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [index("sessions_user_id").on(t.userId)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text().primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text(),
    password: text(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("accounts_user_id").on(t.userId)],
);

export const verifications = sqliteTable(
  "verifications",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("verifications_identifier").on(t.identifier)],
);

// Better Auth's rate limiter (storage "database"). `key` is "<ip>|<path>"; `last_request` is
// epoch milliseconds. The model name is `rateLimit`, so the export is `rateLimits` (plural).
export const rateLimits = sqliteTable("rate_limits", {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: integer("last_request").notNull(),
});
