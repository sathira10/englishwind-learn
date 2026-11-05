import { Hono } from "hono";
import { BANK_DETAILS } from "../../shared/bank";
import {
  orderRequest,
  type OfferResponse,
  type OrderErrorResponse,
  type OrderResponse,
} from "../../shared/orders";
import { createPendingOrder } from "../orders/repo";
import { consumeLimit, sha256Hex } from "../rate-limit";

// Public order API (plan 13, ADR 0007). No sign-in, so every guard is here: same-origin only,
// JSON only, validated fields, and a cap per IP and per email in `rate_limits`.
export const ORDER_IP_LIMIT = { window: 60 * 60, max: 10 } as const;
export const ORDER_EMAIL_LIMIT = { window: 60 * 60, max: 5 } as const;

type OrderEnv = { Bindings: Env };

const error = (code: string, fields?: Record<string, string>): OrderErrorResponse =>
  fields ? { error: code, fields } : { error: code };

export const orders = new Hono<OrderEnv>().post("/", async (c) => {
  // The page posts from its own origin; a request with no Origin or another one is not the page.
  if (c.req.header("origin") !== new URL(c.req.url).origin) return c.json(error("forbidden"), 403);
  const type = c.req.header("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (type !== "application/json") return c.json(error("unsupported_media_type"), 415);

  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  if (!(await consumeLimit(c.env.DB, `order-ip:${await sha256Hex(ip)}`, ORDER_IP_LIMIT))) {
    return c.json(error("too_many_requests"), 429);
  }

  const raw = await c.req.json().catch(() => undefined);
  if (raw === undefined) return c.json(error("invalid_json"), 400);
  const parsed = orderRequest.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "body");
      fields[key] ??= issue.message;
    }
    return c.json(error("invalid_request", fields), 422);
  }
  const body = parsed.data;

  // Check the offer before charging the per-email quota, so requests that cannot create an
  // order cannot lock a buyer's address out.
  const offer = await c.env.DB.prepare("SELECT label FROM offers WHERE id = ? AND active = 1")
    .bind(body.offer)
    .first<{ label: string }>();
  if (!offer) return c.json(error("offer_not_found"), 404);

  if (
    !(await consumeLimit(c.env.DB, `order-email:${await sha256Hex(body.email)}`, ORDER_EMAIL_LIMIT))
  ) {
    return c.json(error("too_many_requests"), 429);
  }

  const created = await createPendingOrder(c.env.DB, {
    offerId: body.offer,
    name: body.name,
    email: body.email,
    phone: body.phone,
  });
  if (!created.ok) return c.json(error("offer_not_found"), 404);

  return c.json(
    {
      reference: created.value.order.reference,
      amountCents: created.value.order.amountCents,
      label: offer.label,
      bank: BANK_DETAILS,
    } satisfies OrderResponse,
    201,
  );
});

export const offers = new Hono<OrderEnv>().get("/:slug", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT id, label, price_cents FROM offers WHERE id = ? AND active = 1",
  )
    .bind(c.req.param("slug"))
    .first<{ id: string; label: string; price_cents: number }>();
  if (!row) return c.json(error("not_found"), 404);
  return c.json({
    slug: row.id,
    label: row.label,
    priceCents: row.price_cents,
  } satisfies OfferResponse);
});
