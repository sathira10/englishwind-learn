import { createMiddleware } from "hono/factory";

// The CF_Authorization cookie authenticates cross-site requests too, so a state-changing admin
// route must be sure the request came from our own page (plan 08, plan 09). A cross-site form
// cannot send JSON, and a cross-site fetch cannot send JSON without a preflight we never grant.
// The Origin header must also equal our own origin; a request with none is refused.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const requireSameOriginJson = createMiddleware(async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();
  if (c.req.header("origin") !== new URL(c.req.url).origin) {
    return c.json({ error: "forbidden" }, 403);
  }
  const type = c.req.header("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (type !== "application/json") return c.json({ error: "unsupported_media_type" }, 415);
  await next();
});
