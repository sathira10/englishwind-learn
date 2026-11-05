import { Hono } from "hono";
import type { HealthResponse } from "../../shared/health";

export const health = new Hono<{ Bindings: Env }>().get("/", async (c) => {
  let db = false;
  try {
    db = (await c.env.DB.prepare("SELECT 1 AS one").first<{ one: number }>())?.one === 1;
  } catch {
    // Report D1 as down rather than failing the whole check.
  }
  return c.json({ ok: true, db } satisfies HealthResponse);
});
