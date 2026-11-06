import { createMiddleware } from "hono/factory";
import type { Mailer } from "../mail/mailer";
import type { Auth } from "./create-auth";
import { findLinkedStudent, linkStudent } from "./link-student";

export interface StudentContext {
  userId: string;
  studentId: string;
  email: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    auth: Auth;
    student: StudentContext;
    mailer: Mailer;
    /** The request's `ctx.waitUntil`; undefined when there is no execution context. */
    waitUntil: ((promise: Promise<unknown>) => void) | undefined;
  };
};

/**
 * Signed-in students only: 401 JSON otherwise. Puts { userId, studentId, email } on the context.
 * The student id comes from the server-side session, never from the request. The student row is
 * looked up by user_id first; only when there is none (the sign-in hook missed it) does this try
 * to link, which needs a verified email: 403 `email_not_verified` otherwise, 409 `account_conflict`
 * when the email's student row belongs to someone else.
 */
export const requireStudent = createMiddleware<AppEnv>(async (c, next) => {
  // returnHeaders: when Better Auth extends the session (updateAge), it also sends a fresh cookie
  // with the new expiry. Those Set-Cookie headers go on whatever response this request ends with,
  // so an active student's browser cookie rolls forward with the session in D1.
  const { headers: authHeaders, response: session } = await c.var.auth.api.getSession({
    headers: c.req.raw.headers,
    returnHeaders: true,
  });
  const forwardCookies = () => {
    for (const cookie of authHeaders.getSetCookie())
      c.header("set-cookie", cookie, { append: true });
  };
  if (!session) {
    forwardCookies();
    return c.json({ error: "unauthorized" }, 401);
  }
  const { id: userId, email, name, emailVerified } = session.user;

  let studentId = (await findLinkedStudent(c.env.DB, userId))?.id;
  if (!studentId) {
    const result = await linkStudent(c.env.DB, { id: userId, email, name, emailVerified });
    if (result.status === "unverified") return c.json({ error: "email_not_verified" }, 403);
    if (result.status === "conflict") return c.json({ error: "account_conflict" }, 409);
    studentId = result.studentId;
  }
  c.set("student", { userId, studentId, email });
  await next();
  forwardCookies();
});
