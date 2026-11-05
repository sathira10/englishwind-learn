import { Hono } from "hono";
import { createAuth } from "./auth/create-auth";
import type { AppEnv } from "./auth/require-student";
import { mailerFromEnv, type Mailer } from "./mail";
import { health } from "./routes/health";
import { me } from "./routes/me";

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
    const mailer: Mailer = {
      sendLoginCode: (to, code) => (options.mailer ?? mailerFromEnv(c.env)).sendLoginCode(to, code),
    };
    c.set("auth", createAuth(c.env, { mailer, waitUntil }));
    await next();
  });

  app.on(["GET", "POST"], "/auth/*", (c) => c.var.auth.handler(c.req.raw));
  app.route("/health", health);
  app.route("/me", me);
  app.notFound((c) => c.json({ error: "not_found" }, 404));
  return app;
}
