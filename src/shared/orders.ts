import { z } from "zod";
import type { BankDetails } from "./bank";

// POST /api/orders (plan 13). There is no amount field: the price is read from the offer row on
// the server, and Zod drops any key not listed here.
export const orderRequest = z.object({
  offer: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1, "Add your name.").max(100),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Add a valid email address.")),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Add your WhatsApp number, for example +94 77 123 4567."),
});

export type OrderRequest = z.infer<typeof orderRequest>;

export interface OrderResponse {
  reference: string;
  amountCents: number;
  label: string;
  bank: BankDetails;
}

export interface OfferResponse {
  slug: string;
  label: string;
  priceCents: number;
}

export interface OrderErrorResponse {
  error: string;
  /** For 422: field name -> message. */
  fields?: Record<string, string>;
}
