import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { hasAccess, isCurrent, type Grant } from "../../domain/grants";
import { lessonView } from "../../domain/course";
import { courseId as courseIdSchema, publishedCourse } from "../../shared/course";
import type {
  CourseResponse,
  LessonResponse,
  MyCourse,
  ProgressResponse,
} from "../../shared/access";
import { coursePublications, courses, grants, lessonProgress } from "../../db/schema";
import { requireStudent, type AppEnv } from "../auth/require-student";

// Plan 05. Every route is behind requireStudent, and every one that returns course content reads
// the student's grants from D1 at request time and checks them with hasAccess. A missing,
// expired or revoked grant is 403 `no_access` with no other detail; an unknown course or lesson
// is 404 (the course is looked up first, so a student without a grant learns only that a course
// exists, which the public site already says).

type Db = ReturnType<typeof drizzle>;

const progressColumns = {
  lessonKey: lessonProgress.lessonKey,
  completedAt: lessonProgress.completedAt,
  lastVisitedAt: lessonProgress.lastVisitedAt,
};

function grantsFor(db: Db, studentId: string, courseId: string): Promise<Grant[]> {
  return db
    .select({ startsAt: grants.startsAt, endsAt: grants.endsAt, revokedAt: grants.revokedAt })
    .from(grants)
    .where(and(eq(grants.studentId, studentId), eq(grants.courseId, courseId)));
}

export const courseRoutes = new Hono<AppEnv>().use(requireStudent);

courseRoutes.get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const now = Date.now();
  const rows = await db
    .select({
      courseId: grants.courseId,
      title: courses.title,
      startsAt: grants.startsAt,
      endsAt: grants.endsAt,
      revokedAt: grants.revokedAt,
    })
    .from(grants)
    .innerJoin(courses, eq(courses.id, grants.courseId))
    .where(eq(grants.studentId, c.var.student.studentId));
  const byCourse = new Map<string, MyCourse>();
  for (const r of rows) {
    if (!isCurrent(r, now)) continue;
    const seen = byCourse.get(r.courseId);
    if (!seen || r.endsAt > seen.accessEndsAt) {
      byCourse.set(r.courseId, { courseId: r.courseId, title: r.title, accessEndsAt: r.endsAt });
    }
  }
  return c.json({ courses: [...byCourse.values()] });
});

type Denied = { error: "not_found" | "no_access" };

/**
 * The course must exist (404) and the student must hold a current grant for it (403). Returns
 * what the handlers need, or the error to answer with.
 */
async function authorize(env: Env, studentId: string, courseId: string) {
  const db = drizzle(env.DB);
  if (!courseIdSchema.safeParse(courseId).success) return { error: "not_found" } as Denied;
  const course = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.id, courseId))
    .get();
  if (!course) return { error: "not_found" } as Denied;
  const now = Date.now();
  const list = await grantsFor(db, studentId, courseId);
  if (!hasAccess(list, now)) return { error: "no_access" } as Denied;
  const endsAt = Math.max(...list.filter((g) => isCurrent(g, now)).map((g) => g.endsAt));
  return { db, now, endsAt, studentId, courseId };
}

async function latestCourse(db: Db, courseId: string) {
  const row = await db
    .select({ contentJson: coursePublications.contentJson })
    .from(coursePublications)
    .where(eq(coursePublications.courseId, courseId))
    .orderBy(desc(coursePublications.version))
    .limit(1)
    .get();
  return row ? publishedCourse.parse(JSON.parse(row.contentJson)) : null;
}

const denied = (d: Denied) => Response.json(d, { status: d.error === "not_found" ? 404 : 403 });

courseRoutes.get("/:courseId", async (c) => {
  const a = await authorize(c.env, c.var.student.studentId, c.req.param("courseId"));
  if ("error" in a) return denied(a);
  const course = await latestCourse(a.db, a.courseId);
  if (!course) return denied({ error: "not_found" });
  const progress = await a.db
    .select(progressColumns)
    .from(lessonProgress)
    .where(and(eq(lessonProgress.studentId, a.studentId), eq(lessonProgress.courseId, a.courseId)));
  return c.json({ course, accessEndsAt: a.endsAt, progress } satisfies CourseResponse);
});

courseRoutes.get("/:courseId/lessons/:key", async (c) => {
  const a = await authorize(c.env, c.var.student.studentId, c.req.param("courseId"));
  if ("error" in a) return denied(a);
  const key = c.req.param("key");
  const course = await latestCourse(a.db, a.courseId);
  const view = course && lessonView(course, key);
  if (!view) return denied({ error: "not_found" });
  const progress =
    (await a.db
      .select(progressColumns)
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.studentId, a.studentId),
          eq(lessonProgress.courseId, a.courseId),
          eq(lessonProgress.lessonKey, key),
        ),
      )
      .get()) ?? null;
  return c.json({ view, progress } satisfies LessonResponse);
});

/** Upserts the progress row. `complete` keeps the first completion time on a repeat. */
async function record(env: Env, studentId: string, courseId: string, key: string, done: boolean) {
  const a = await authorize(env, studentId, courseId);
  if ("error" in a) return denied(a);
  const course = await latestCourse(a.db, a.courseId);
  if (!course || !lessonView(course, key)) return denied({ error: "not_found" });
  const row = await a.db
    .insert(lessonProgress)
    .values({
      studentId,
      courseId,
      lessonKey: key,
      completedAt: done ? a.now : null,
      lastVisitedAt: a.now,
    })
    .onConflictDoUpdate({
      target: [lessonProgress.studentId, lessonProgress.courseId, lessonProgress.lessonKey],
      set: done
        ? {
            lastVisitedAt: a.now,
            completedAt: sql`coalesce(${lessonProgress.completedAt}, ${a.now})`,
          }
        : { lastVisitedAt: a.now },
    })
    .returning(progressColumns)
    .get();
  return Response.json({ progress: row } satisfies ProgressResponse);
}

courseRoutes.post("/:courseId/lessons/:key/complete", (c) =>
  record(c.env, c.var.student.studentId, c.req.param("courseId"), c.req.param("key"), true),
);
courseRoutes.post("/:courseId/lessons/:key/visit", (c) =>
  record(c.env, c.var.student.studentId, c.req.param("courseId"), c.req.param("key"), false),
);
