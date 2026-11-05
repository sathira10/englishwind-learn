import { statusLabel, type ReviewStatus, type StatusTreatment } from "../../domain/status-label";

const treatmentClasses: Record<StatusTreatment, string> = {
  outline: "border border-fg-strong bg-bg text-fg-strong",
  fill: "border border-accent bg-accent text-accent-fg",
  strike: "border border-transparent bg-bg text-fg-strong line-through",
};

/** Pending, Approved or Rejected. The word always says it; the treatment says it a second way. */
export function StatusLabel({ status }: { status: ReviewStatus }) {
  const { text, treatment } = statusLabel(status);
  return (
    <span
      className={`inline-flex min-h-8 items-center px-3 text-base font-bold ${treatmentClasses[treatment]}`}
      data-status={status}
    >
      {text}
    </span>
  );
}
