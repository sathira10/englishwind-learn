import { drizzle } from "drizzle-orm/d1";
import { eq, sql } from "drizzle-orm";
import { nameFromEmail, normalizeEmail } from "../../domain/email";
import { students } from "../../db/schema";

export interface AuthUserRef {
  id: string;
  email: string;
  name?: string | null;
  emailVerified: boolean;
}

export type LinkResult =
  | { status: "linked"; studentId: string }
  // The auth user's email is not verified, so it must not claim a student row (ADR 0008).
  | { status: "unverified" }
  // The row for this email belongs to a different user, or this user is already linked to
  // another row (UNIQUE user_id).
  | { status: "conflict" };

/**
 * Finds the student already linked to this auth user. No writes.
 */
export async function findLinkedStudent(db: D1Database, userId: string) {
  return (
    (await drizzle(db)
      .select({ id: students.id })
      .from(students)
      .where(eq(students.userId, userId))
      .get()) ?? null
  );
}

/**
 * Attaches a signed-in auth user to its `students` row (ADR 0008). Only a user whose email is
 * verified may claim a row. The row is found by lower-cased email, so orders placed before
 * sign-in and the migrated buyers join the account (ADR 0007). With no row, one is created. One
 * upsert statement, so two sign-ins racing cannot make two rows. A row linked to a different
 * user is never taken over.
 */
export async function linkStudent(
  db: D1Database,
  user: AuthUserRef,
  now = Date.now(),
): Promise<LinkResult> {
  if (!user.emailVerified) return { status: "unverified" };
  const orm = drizzle(db);
  const email = normalizeEmail(user.email);
  try {
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
      .returning({ id: students.id, userId: students.userId });
    if (row!.userId !== user.id) return { status: "conflict" };
    return { status: "linked", studentId: row!.id };
  } catch (error) {
    // UNIQUE(user_id): this user is already linked to a row under another email.
    if (error instanceof Error && /UNIQUE|constraint/i.test(`${error.message} ${error.cause}`)) {
      return { status: "conflict" };
    }
    throw error;
  }
}
