import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { hasAccess } from "../../domain/grants";
import { grants, resources } from "../../db/schema";
import { requireStudent, type AppEnv } from "../auth/require-student";

// Plan 05. Worksheets come only from the private R2 bucket, streamed by this Worker after a
// grant check on the resource's course. The R2 key is read here and never sent anywhere.

/** A safe ASCII file name from the label, with the extension the content type implies. */
function fileName(label: string, contentType: string): string {
  const base =
    label
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9 _-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "worksheet";
  return contentType === "application/pdf" ? `${base}.pdf` : base;
}

export const worksheets = new Hono<AppEnv>().get("/:resourceId", requireStudent, async (c) => {
  const db = drizzle(c.env.DB);
  const resource = await db
    .select()
    .from(resources)
    .where(eq(resources.id, c.req.param("resourceId")))
    .get();
  if (!resource) return c.json({ error: "not_found" }, 404);

  const list = await db
    .select({ startsAt: grants.startsAt, endsAt: grants.endsAt, revokedAt: grants.revokedAt })
    .from(grants)
    .where(
      and(eq(grants.studentId, c.var.student.studentId), eq(grants.courseId, resource.courseId)),
    );
  if (!hasAccess(list, Date.now())) return c.json({ error: "no_access" }, 403);

  const object = await c.env.FILES.get(resource.r2Key);
  if (!object) return c.json({ error: "not_found" }, 404);

  return new Response(object.body, {
    headers: {
      "Content-Type": resource.contentType,
      "Content-Length": String(object.size),
      "Content-Disposition": `attachment; filename="${fileName(resource.label, resource.contentType)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
