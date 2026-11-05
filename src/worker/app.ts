import { Hono } from "hono";
import { createAuth } from "./auth/create-auth";
import { consumeEmailSend } from "./auth/email-limit";
import type { AppEnv } from "./auth/require-student";
import { mailerFromEnv, type Mailer } from "./mail";
import { admin } from "./routes/admin";
import { courseRoutes } from "./routes/courses";
import { health } from "./routes/health";
import { me } from "./routes/me";
import { offers, orders } from "./routes/orders";
import { worksheets } from "./routes/worksheets";

export interface AppOptions {
  /** Tests pass a capturing mailer; otherwise MAIL_DRIVER picks one. */
  mailer?: Mailer;
}

// Only /api/* reaches this Worker (run_worker_first in wrangler.jsonc). Everything else is a
// static asset or the SPA's index.html.
export function createApp(options: AppOptions = {}) {
  const app = new Hono<AppEnv>().basePath("/api");

  // The auth instance is built per request from env (D1, secrets) and the request's waitUntil.
  app.use("*", async (c, next) => {
    let waitUntil: ((promise: Promise<unknown>) => void) | undefined;
    try {
      const ctx = c.executionCtx;
      waitUntil = (promise) => ctx.waitUntil(promise);
    } catch {
      // No execution context (some test callers): background work is awaited instead.
    }
    // Picked on first send, so a bad MAIL_DRIVER fails the send and not every request.
    const pick = () => options.mailer ?? mailerFromEnv(c.env);
    const mailer: Mailer = {
      sendLoginCode: (to, code) => pick().sendLoginCode(to, code),
      orderReceived: (to, data) => pick().orderReceived(to, data),
      accessGranted: (to, data) => pick().accessGranted(to, data),
      orderRejected: (to, data) => pick().orderRejected(to, data),
    };
    c.set("mailer", mailer);
    c.set("waitUntil", waitUntil);
    c.set("auth", createAuth(c.env, { mailer, waitUntil }));
    await next();
  });

  // Per-address cap on code sends, before Better Auth's per-IP limit. The answer is the same
  // whether or not the address has an account.
  app.post("/auth/email-otp/send-verification-otp", async (c) => {
    const body = (await c.req.raw
      .clone()
      .json()
      .catch(() => null)) as { email?: unknown } | null;
    if (typeof body?.email === "string" && !(await consumeEmailSend(c.env.DB, body.email))) {
      return c.json({ message: "Too many requests. Please try again later." }, 429);
    }
    return c.var.auth.handler(c.req.raw);
  });
  app.on(["GET", "POST"], "/auth/*", (c) => c.var.auth.handler(c.req.raw));
  app.route("/health", health);
  app.route("/me", me);
  app.route("/orders", orders);
  app.route("/offers", offers);
  app.route("/courses", courseRoutes);
  app.route("/worksheets", worksheets);
  app.route("/admin", admin);
  app.notFound((c) => c.json({ error: "not_found" }, 404));
  return app;
}
