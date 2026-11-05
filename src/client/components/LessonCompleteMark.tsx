/**
 * Marks a lesson the student has finished. Words on a `surface-dark` field, because the design
 * system has no tick icon (OPEN-QUESTIONS Q25). Nothing is drawn for a lesson not yet complete.
 */
export function LessonCompleteMark({ complete }: { complete: boolean }) {
  if (!complete) return null;
  return (
    <span className="inline-flex min-h-8 items-center bg-surface-dark px-3 text-base font-bold text-fg-on-dark">
      Complete
    </span>
  );
}
