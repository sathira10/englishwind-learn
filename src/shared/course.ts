import { z } from "zod";

// Plan 04 (course definition). Two shapes of the same course:
//   - CourseDefinition: what we author in content/courses/*.ts. Worksheets carry the private R2
//     object key, so this shape never leaves the server or the publish script.
//   - PublishedCourse: what is stored in course_publications.content_json and what the API
//     returns to a student. It has worksheet ids from the resources table, never R2 keys.

export const courseId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use a lower-case slug");
/** Stable lesson key: two digits, '00' is the welcome. Progress rows hang off it. */
export const lessonKey = z.string().regex(/^\d{2}$/, "use two digits, like '07'");
/** The numeric id from the Vimeo URL. */
export const vimeoId = z.string().regex(/^\d+$/, "use the numeric Vimeo id, not a URL");

const text = z.string().trim().min(1);

export const worksheetDefinition = z.object({
  label: text,
  /** R2 object key, `courses/<courseId>/<file>`. Server only. */
  file: text,
});

export const lessonDefinition = z.object({
  key: lessonKey,
  title: text,
  vimeoId,
  blurb: text.optional(),
  worksheets: z.array(worksheetDefinition),
});

export const moduleDefinition = z.object({
  name: text,
  blurb: text.optional(),
  lessons: z.array(lessonDefinition).min(1),
});

export const courseDefinition = z.object({
  id: courseId,
  title: text,
  intro: text,
  modules: z.array(moduleDefinition).min(1),
});

export type CourseDefinition = z.infer<typeof courseDefinition>;

// Student-facing shapes. Strict, so a stray r2 key can never validate.

export const publishedWorksheet = z.strictObject({
  /** resources.id. The download route (slice 05) looks the R2 key up from it. */
  id: z.string().min(1),
  label: text,
});

export const publishedLesson = z.strictObject({
  key: lessonKey,
  /** 1..12 for taught lessons; null for the welcome, which shows without a number. */
  number: z.number().int().positive().nullable(),
  title: text,
  vimeoId,
  blurb: text.optional(),
  worksheets: z.array(publishedWorksheet),
});

export const publishedModule = z.strictObject({
  /** Zero-based position. */
  index: z.number().int().nonnegative(),
  /** "Module 0", "Module 1", ... */
  label: text,
  name: text,
  blurb: text.optional(),
  lessons: z.array(publishedLesson).min(1),
});

export const publishedCourse = z.strictObject({
  courseId,
  title: text,
  intro: text,
  modules: z.array(publishedModule).min(1),
});

export type PublishedCourse = z.infer<typeof publishedCourse>;
export type PublishedLesson = z.infer<typeof publishedLesson>;

const lessonLink = z.strictObject({ key: lessonKey, title: text });

/** One lesson with its place in the course: what the lesson screen needs. */
export const lessonView = z.strictObject({
  courseId,
  lesson: publishedLesson,
  moduleLabel: text,
  moduleName: text,
  previous: lessonLink.nullable(),
  next: lessonLink.nullable(),
});

export type LessonView = z.infer<typeof lessonView>;
