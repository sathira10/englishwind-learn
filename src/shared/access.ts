import { z } from "zod";
import { courseId, lessonKey, lessonView, publishedCourse } from "./course";

// Plan 05 (lesson and worksheet access). What the student API returns. None of these shapes has
// a field for an R2 key, and they are strict so one cannot slip in.

/** Epoch milliseconds (UTC). */
const epochMs = z.number().int();

export const lessonProgress = z.strictObject({
  lessonKey,
  completedAt: epochMs.nullable(),
  lastVisitedAt: epochMs.nullable(),
});
export type LessonProgress = z.infer<typeof lessonProgress>;

/** GET /api/courses: one row per course the student currently has access to. */
export const myCourse = z.strictObject({
  courseId,
  title: z.string(),
  /** When access ends: the latest end among the current grants. */
  accessEndsAt: epochMs,
});
export const myCoursesResponse = z.strictObject({ courses: z.array(myCourse) });
export type MyCourse = z.infer<typeof myCourse>;

/** GET /api/courses/:courseId */
export const courseResponse = z.strictObject({
  course: publishedCourse,
  accessEndsAt: epochMs,
  progress: z.array(lessonProgress),
});
export type CourseResponse = z.infer<typeof courseResponse>;

/** GET /api/courses/:courseId/lessons/:key */
export const lessonResponse = z.strictObject({
  view: lessonView,
  progress: lessonProgress.nullable(),
});
export type LessonResponse = z.infer<typeof lessonResponse>;

/** The two POST routes answer with the row they wrote. */
export const progressResponse = z.strictObject({ progress: lessonProgress });
export type ProgressResponse = z.infer<typeof progressResponse>;

/** Every error body. `no_access` is the answer for a missing, expired or revoked grant. */
export const apiError = z.strictObject({
  error: z.enum([
    "unauthorized",
    "email_not_verified",
    "account_conflict",
    "no_access",
    "not_found",
  ]),
});
