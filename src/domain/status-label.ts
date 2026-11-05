// Pending / Approved / Rejected without new colours: the word always says it, and the treatment
// (outline, fill, strike) says it a second way for anyone who cannot tell tones apart.

export const reviewStatuses = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];
export type StatusTreatment = "outline" | "fill" | "strike";

const labels: Record<ReviewStatus, { text: string; treatment: StatusTreatment }> = {
  pending: { text: "Pending", treatment: "outline" },
  approved: { text: "Approved", treatment: "fill" },
  rejected: { text: "Rejected", treatment: "strike" },
};

export function statusLabel(status: ReviewStatus): { text: string; treatment: StatusTreatment } {
  return { ...labels[status] };
}

export function isReviewStatus(value: string): value is ReviewStatus {
  return (reviewStatuses as readonly string[]).includes(value);
}
