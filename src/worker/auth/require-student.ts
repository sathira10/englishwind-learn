import { createMiddleware } from "hono/factory";
import type { Auth } from "./create-auth";
import { linkStudent } from "./link-student";

export interface StudentContext {
  userId: string;
  studentId: string;
  email: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { auth: Auth; student: StudentContext };
};

/**
 * Signed-in students only: 401 JSON otherwise. Puts { userId, studentId, email } on the context.
 * The student id comes from the server-side session, never from the request. If the sign-in hook
 * missed linking a student, linkStudent runs again here (it is idempotent).
 */
export const requireStudent = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "unauthorized" }, 401);
  const { id: userId, email, name } = session.user;
  const studentId = await linkStudent(c.env.DB, { id: userId, email, name });
  c.set("student", { userId, studentId, email });
  await next();
});
