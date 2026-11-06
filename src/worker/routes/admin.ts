import { Hono, type Context } from "hono";
import type { z } from "zod";
import {
  approveRequest,
  attachRequest,
  extendRequest,
  grantRequest,
  manualOrderRequest,
  orderStatusQuery,
  rejectRequest,
  revokeRequest,
  type AdminError,
} from "../../shared/admin";
import { requireSameOriginJson } from "../admin/csrf";
import {
  attachOrder,
  AUDIT_DEFAULT_LIMIT,
  AUDIT_MAX_LIMIT,
  auditPage,
  createGrant,
  extendGrant,
  getAdminOrder,
  listCourses,
  listOffers,
  listOrders,
  MAX_SEARCH_LENGTH,
  MIN_SEARCH_LENGTH,
  parseAuditCursor,
  revokeGrant,
  searchStudents,
  studentDetail,
} from "../admin/repo";
import { requireStaff, type AdminEnv, type RequireStaffOptions } from "../admin/staff";
import type { Mailer } from "../mail";
import { notifyAccessGranted } from "../mail/notify";
import { approveOrder, createPendingOrder, rejectOrder } from "../orders/repo";

// Every /api/admin/* route goes through requireStaff, then (for POST, PUT, PATCH, DELETE) the
// same-origin JSON check. Each mutation is one db.batch() with its audit row (plan 09).

const error = (code: string, fields?: Record<string, string>): AdminError =>
  fields ? { error: code, fields } : { error: code };

type Parsed<S extends z.ZodType> =
  { ok: true; data: z.output<S> } | { ok: false; response: Response };

/** Read and validate a JSON body. An empty body counts as `{}`, so approve needs no payload. */
async function readBody<S extends z.ZodType>(c: Context<AdminEnv>, schema: S): Promise<Parsed<S>> {
  const text = await c.req.text();
  let raw: unknown = {};
  if (text.trim() !== "") {
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, response: c.json(error("invalid_json"), 400) };
    }
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "body");
    fields[key] ??= issue.message;
  }
  return { ok: false, response: c.json(error("invalid_request", fields), 422) };
}

export interface AdminOptions extends RequireStaffOptions {
  /** Used when the parent app has not put a mailer on the context (tests, standalone use). */
  mailer?: Mailer;
}

export function createAdmin(options?: AdminOptions) {
  return (
    new Hono<AdminEnv>()
      .use("*", async (c, next) => {
        if (options?.mailer && !c.var.mailer) c.set("mailer", options.mailer);
        await next();
      })
      .use("*", requireStaff(undefined, options))
      .use("*", requireSameOriginJson)
      .get("/me", (c) => c.json(c.get("staff")))

      .get("/offers", async (c) => c.json({ offers: await listOffers(c.env.DB) }))
      .get("/courses", async (c) => c.json({ courses: await listCourses(c.env.DB) }))

      // ---- Orders ----
      .get("/orders", async (c) => {
        const status = orderStatusQuery.safeParse(c.req.query("status") ?? "pending");
        if (!status.success)
          return c.json(error("invalid_request", { status: "Unknown status." }), 422);
        return c.json({ orders: await listOrders(c.env.DB, status.data) });
      })

      .post("/orders", async (c) => {
        const body = await readBody(c, manualOrderRequest);
        if (!body.ok) return body.response;
        const created = await createPendingOrder(
          c.env.DB,
          {
            offerId: body.data.offer,
            name: body.data.name,
            email: body.data.email,
            phone: body.data.phone,
          },
          { manualBy: c.get("staff").email },
        );
        if (!created.ok) return c.json(error("offer_not_found"), 404);
        const order = await getAdminOrder(c.env.DB, created.value.order.id);
        return c.json({ order }, 201);
      })

      .post("/orders/:id/approve", async (c) => {
        const body = await readBody(c, approveRequest);
        if (!body.ok) return body.response;
        const result = await approveOrder(c.env.DB, c.req.param("id"), c.get("staff"), {
          // Only the literal true counts; the flag is never inferred from anything else.
          staffChecked: body.data.staffChecked === true,
          expectedStudentId: body.data.studentId,
        });
        if (!result.ok) {
          return c.json(error(result.error), result.error === "not_found" ? 404 : 409);
        }
        // Fresh grant only, so a repeat approve sends nothing. notifyAccessGranted never throws.
        const mailer = c.var.mailer;
        if (result.value.granted && mailer) {
          await notifyAccessGranted(c.env, mailer, result.value.order.id, {
            waitUntil: c.var.waitUntil,
          });
        }
        return c.json({
          order: await getAdminOrder(c.env.DB, result.value.order.id),
          granted: result.value.granted,
        });
      })

      .post("/orders/:id/reject", async (c) => {
        const body = await readBody(c, rejectRequest);
        if (!body.ok) return body.response;
        const result = await rejectOrder(
          c.env.DB,
          c.req.param("id"),
          c.get("staff"),
          body.data.reason || undefined,
        );
        if (!result.ok) {
          return c.json(error(result.error), result.error === "not_found" ? 404 : 409);
        }
        return c.json({ order: await getAdminOrder(c.env.DB, result.value.order.id) });
      })

      .post("/orders/:id/attach", async (c) => {
        const body = await readBody(c, attachRequest);
        if (!body.ok) return body.response;
        const result = await attachOrder(
          c.env.DB,
          c.req.param("id"),
          body.data.studentId,
          c.get("staff").email,
        );
        if (!result.ok) {
          return c.json(
            error(result.error),
            result.error === "not_pending" || result.error === "conflict" ? 409 : 404,
          );
        }
        return c.json({ order: result.order });
      })

      // ---- Students ----
      .get("/students", async (c) => {
        const q = (c.req.query("q") ?? "").trim();
        if (q.length < MIN_SEARCH_LENGTH || q.length > MAX_SEARCH_LENGTH) {
          return c.json(
            error("invalid_request", {
              q: `Type at least ${MIN_SEARCH_LENGTH} characters to search.`,
            }),
            422,
          );
        }
        return c.json({ students: await searchStudents(c.env.DB, q) });
      })

      .get("/students/:id", async (c) => {
        const detail = await studentDetail(c.env.DB, c.req.param("id"));
        return detail ? c.json(detail) : c.json(error("not_found"), 404);
      })

      .post("/students/:id/grants", async (c) => {
        const body = await readBody(c, grantRequest);
        if (!body.ok) return body.response;
        const result = await createGrant(
          c.env.DB,
          c.req.param("id"),
          body.data.courseId,
          body.data.years,
          c.get("staff").email,
        );
        if (!result.ok) {
          return c.json(error(result.error), result.error === "already_has_access" ? 409 : 404);
        }
        return c.json({ grant: result.grant }, 201);
      })

      // ---- Grants ----
      .post("/grants/:id/extend", async (c) => {
        const body = await readBody(c, extendRequest);
        if (!body.ok) return body.response;
        const result = await extendGrant(
          c.env.DB,
          c.req.param("id"),
          body.data.years,
          c.get("staff").email,
        );
        if (!result.ok)
          return c.json(error(result.error), result.error === "not_found" ? 404 : 409);
        return c.json({ grant: result.grant });
      })

      .post("/grants/:id/revoke", async (c) => {
        const body = await readBody(c, revokeRequest);
        if (!body.ok) return body.response;
        const grant = await revokeGrant(
          c.env.DB,
          c.req.param("id"),
          body.data.reason,
          c.get("staff").email,
        );
        return grant ? c.json({ grant }) : c.json(error("not_found"), 404);
      })

      // ---- Audit log ----
      .get("/audit", async (c) => {
        const limitText = c.req.query("limit");
        const limit = limitText === undefined ? AUDIT_DEFAULT_LIMIT : Number(limitText);
        if (!Number.isInteger(limit) || limit < 1 || limit > AUDIT_MAX_LIMIT) {
          return c.json(error("invalid_request", { limit: "Use a number from 1 to 100." }), 422);
        }
        const cursorText = c.req.query("before");
        const before = cursorText === undefined ? undefined : parseAuditCursor(cursorText);
        if (cursorText !== undefined && !before) {
          return c.json(error("invalid_request", { before: "Not a valid page cursor." }), 422);
        }
        return c.json(await auditPage(c.env.DB, limit, before ?? undefined));
      })
  );
}

export const admin = createAdmin();
