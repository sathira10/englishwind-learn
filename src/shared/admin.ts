import { z } from "zod";
import type { GrantState } from "../domain/grants";
import { orderRequest } from "./orders";

// Plan 09 (admin API). Request bodies are strict: an unknown key is a 422, so a flag such as
// `staffChecked` only ever counts when it is sent by name.

export const approveRequest = z.strictObject({ staffChecked: z.boolean().optional() });
export const rejectRequest = z.strictObject({ reason: z.string().trim().max(500).optional() });
export const manualOrderRequest = orderRequest;
export const attachRequest = z.strictObject({ studentId: z.string().trim().min(1).max(100) });
export const grantRequest = z.strictObject({
  courseId: z.string().trim().min(1).max(100),
  years: z.number().int().min(1).max(10).optional(),
});
export const extendRequest = z.strictObject({ years: z.number().int().min(1).max(10) });
export const revokeRequest = z.strictObject({
  reason: z.string().trim().min(1, "Add a reason.").max(500),
});

export const orderStatusQuery = z.enum(["pending", "approved", "rejected"]);

// ---- Responses ----

export type OrderStatus = z.infer<typeof orderStatusQuery>;

export interface AdminOrder {
  id: string;
  reference: string;
  status: OrderStatus;
  amountCents: number;
  offerId: string;
  offerLabel: string;
  needsStaffCheck: boolean;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  studentId: string | null;
  /** The account that gets access when the order is approved, if one is linked. */
  student: { id: string; name: string; email: string } | null;
  createdAt: number;
  decidedAt: number | null;
  decidedBy: string | null;
  note: string | null;
}

export interface AdminStudent {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  createdAt: number;
}

export type { GrantState };

export interface AdminGrant {
  id: string;
  studentId: string;
  courseId: string;
  courseTitle: string;
  orderId: string | null;
  startsAt: number;
  endsAt: number;
  revokedAt: number | null;
  revokedBy: string | null;
  reason: string | null;
  createdBy: string;
  state: GrantState;
}

export interface CourseProgressSummary {
  courseId: string;
  courseTitle: string;
  completedLessons: number;
  lastVisitedAt: number | null;
}

export interface StudentDetail {
  student: AdminStudent;
  grants: AdminGrant[];
  orders: AdminOrder[];
  progress: CourseProgressSummary[];
}

export interface AuditEntry {
  id: string;
  at: number;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  data: unknown;
}

export interface AuditPage {
  entries: AuditEntry[];
  /** Pass as `before` for the next page; null on the last page. */
  next: string | null;
}

export interface AdminOffer {
  id: string;
  label: string;
  priceCents: number;
  needsStaffCheck: boolean;
}

export interface AdminCourse {
  id: string;
  title: string;
  accessYears: number;
}

export interface AdminError {
  error: string;
  fields?: Record<string, string>;
}
