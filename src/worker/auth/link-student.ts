import { drizzle } from "drizzle-orm/d1";
import { sql } from "drizzle-orm";
import { nameFromEmail, normalizeEmail } from "../../domain/email";
import { students } from "../../db/schema";

export interface AuthUserRef {
  id: string;
  email: string;
  name?: string | null;
}

/**
 * Attaches a signed-in auth user to its `students` row (ADR 0008). The row is found by
 * lower-cased email, so orders placed before sign-in and the migrated buyers join the account
 * (ADR 0007). With no row, one is created. One upsert statement, so two sign-ins racing cannot
 * make two rows. A row already linked to a user keeps that link.
 * Returns the student id.
 */
export async function linkStudent(db: D1Database, user: AuthUserRef, now = Date.now()) {
  const orm = drizzle(db);
  const email = normalizeEmail(user.email);
  const [row] = await orm
    .insert(students)
    .values({
      id: crypto.randomUUID(),
      email,
      name: user.name?.trim() || nameFromEmail(email),
      userId: user.id,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: students.email,
      set: { userId: sql`coalesce(${students.userId}, excluded.user_id)` },
    })
    .returning({ id: students.id });
  return row!.id;
}
