import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { students } from "../../db/schema";
import { requireStudent, type AppEnv } from "../auth/require-student";

// The signed-in student's own name and email. Nothing about anyone else.
export const me = new Hono<AppEnv>().get("/", requireStudent, async (c) => {
  const { studentId } = c.var.student;
  const row = await drizzle(c.env.DB)
    .select({ name: students.name, email: students.email })
    .from(students)
    .where(eq(students.id, studentId))
    .get();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(row);
});
