import type { LessonProgress } from "../shared/access.ts";
import type { PublishedCourse } from "../shared/course.ts";
import { colomboDate } from "./grants.ts";
import { orderedLessons } from "./course.ts";

// Plan 06. Pure helpers for the student screens: no I/O, no React.

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "5 November 2029": the Asia/Colombo calendar date of an instant, for the student to read. */
export function formatAccessEnd(instant: number): string {
  const [year, month, day] = colomboDate(instant).split("-").map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${year}`;
}

/** "Welcome" for lesson 00, else "Lesson 7". The welcome shows no number. */
export function lessonLabel(number: number | null): string {
  return number === null ? "Welcome" : `Lesson ${number}`;
}

/** The lesson the student opened most recently, or null if they have opened none. */
export function pickContinueLesson(
  course: PublishedCourse,
  progress: readonly LessonProgress[],
): { key: string; title: string; number: number | null } | null {
  const lessons = orderedLessons(course);
  let best: { key: string; at: number } | null = null;
  for (const p of progress) {
    if (p.lastVisitedAt === null) continue;
    // Progress for a lesson that is no longer published cannot be opened.
    if (!lessons.some((x) => x.lesson.key === p.lessonKey)) continue;
    if (best === null || p.lastVisitedAt > best.at)
      best = { key: p.lessonKey, at: p.lastVisitedAt };
  }
  const found = lessons.find((x) => x.lesson.key === best?.key);
  if (!found) return null;
  return { key: found.lesson.key, title: found.lesson.title, number: found.lesson.number };
}

/** How many of the course's lessons are complete. Progress for lessons no longer listed is ignored. */
export function completionCount(
  course: PublishedCourse,
  progress: readonly LessonProgress[],
): { done: number; total: number } {
  const done = new Set(progress.filter((p) => p.completedAt !== null).map((p) => p.lessonKey));
  const keys = orderedLessons(course).map((x) => x.lesson.key);
  return { done: keys.filter((k) => done.has(k)).length, total: keys.length };
}

/**
 * Where to go after sign-in. Only a path on this site is kept, so a crafted link cannot send the
 * student elsewhere. Anything else, and the sign-in page itself, becomes "/".
 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  if (value === "/sign-in" || value.startsWith("/sign-in?")) return "/";
  return value;
}

/** The sign-in URL that comes back to `path` afterwards. */
export function signInUrl(path: string): string {
  const next = safeReturnTo(path);
  return next === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;
}

export type CodeProblem = "wrong_code" | "too_many_attempts" | "rate_limited" | "other";

/**
 * Names what went wrong when the code is checked. Better Auth answers 400 for a wrong or expired
 * code, 403 once the 3 tries are used up, and 429 from the rate limits.
 */
export function classifyCodeError(status: number, code?: string): CodeProblem {
  if (status === 429) return "rate_limited";
  if (status === 403 || code === "TOO_MANY_ATTEMPTS") return "too_many_attempts";
  if (status === 400 || code === "INVALID_OTP" || code === "OTP_EXPIRED") return "wrong_code";
  return "other";
}

/** Keeps only digits and cuts to 6, so a pasted "123 456" works. */
export function cleanCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}
