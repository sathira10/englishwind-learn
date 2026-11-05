import {
  courseDefinition,
  publishedCourse,
  type CourseDefinition,
  type LessonView,
  type PublishedCourse,
} from "../shared/course.ts";

// Plan 04. Pure transforms over the course definition: no I/O. The publish script and the
// tests call these; slice 05's routes will use lessonView on a stored publication.

export type ValidationResult =
  { ok: true; course: CourseDefinition } | { ok: false; errors: string[] };

/** Checks a definition: shape, unique keys, and worksheet keys under courses/<courseId>/. */
export function validateCourse(input: unknown): ValidationResult {
  const parsed = courseDefinition.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(course)"}: ${i.message}`),
    };
  }
  const course = parsed.data;
  const errors: string[] = [];
  const keys = new Set<string>();
  const files = new Set<string>();
  const ids = new Map<string, string>();
  const prefix = `courses/${course.id}/`;
  for (const lesson of course.modules.flatMap((m) => m.lessons)) {
    if (keys.has(lesson.key)) errors.push(`lesson ${lesson.key}: duplicate key`);
    keys.add(lesson.key);
    for (const ws of lesson.worksheets) {
      const where = `lesson ${lesson.key} worksheet "${ws.label}"`;
      if (!ws.file.startsWith(prefix) || ws.file.length === prefix.length) {
        errors.push(`${where}: file must start with ${prefix}`);
      } else if (ws.file.split("/").some((part) => part === "" || part === "..")) {
        errors.push(`${where}: file has an empty or '..' path part`);
      }
      if (files.has(ws.file)) errors.push(`${where}: file ${ws.file} is used twice`);
      files.add(ws.file);
      // Resource ids come from the file name alone, so two files with the same name in
      // different folders would share an id and fail to publish.
      const id = worksheetId(course.id, ws.file);
      if (ids.has(id) && ids.get(id) !== ws.file) {
        errors.push(`${where}: file name gives id ${id}, already used by ${ids.get(id)}`);
      }
      ids.set(id, ws.file);
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, course };
}

export function moduleLabel(index: number): string {
  return `Module ${index}`;
}

/** '00' (the welcome) has no number; '07' is lesson 7. */
export function lessonNumber(key: string): number | null {
  const n = Number.parseInt(key, 10);
  return n === 0 ? null : n;
}

/**
 * Deterministic resource id from the file, so publishing again updates the same row even when
 * worksheets are reordered or moved to another lesson: `courses/blueprint/lesson-03.pdf` is
 * `blueprint-lesson-03`.
 */
export function worksheetId(courseId: string, file: string): string {
  const name = file.slice(file.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");
  return `${courseId}-${name}`;
}

export type ResourceRow = {
  id: string;
  courseId: string;
  lessonKey: string;
  kind: "worksheet";
  label: string;
  r2Key: string;
  contentType: string;
};

export type Publication = {
  /** The student-facing course. Holds no R2 keys. */
  content: PublishedCourse;
  /** `content` as stored in course_publications.content_json. */
  contentJson: string;
  /** Rows to upsert into resources. Server only. */
  resources: ResourceRow[];
};

/** Throws if the definition is invalid. */
export function toPublication(def: CourseDefinition): Publication {
  const checked = validateCourse(def);
  if (!checked.ok) throw new Error(`Invalid course:\n${checked.errors.join("\n")}`);
  const resources: ResourceRow[] = [];
  const content: PublishedCourse = {
    courseId: def.id,
    title: def.title,
    intro: def.intro,
    modules: def.modules.map((m, index) => ({
      index,
      label: moduleLabel(index),
      name: m.name,
      ...(m.blurb ? { blurb: m.blurb } : {}),
      lessons: m.lessons.map((l) => ({
        key: l.key,
        number: lessonNumber(l.key),
        title: l.title,
        vimeoId: l.vimeoId,
        ...(l.blurb ? { blurb: l.blurb } : {}),
        worksheets: l.worksheets.map((w) => {
          const id = worksheetId(def.id, w.file);
          resources.push({
            id,
            courseId: def.id,
            lessonKey: l.key,
            kind: "worksheet",
            label: w.label,
            r2Key: w.file,
            contentType: "application/pdf",
          });
          return { id, label: w.label };
        }),
      })),
    })),
  };
  // Belt and braces: what we store must be a valid student-facing course.
  publishedCourse.parse(content);
  return { content, contentJson: JSON.stringify(content), resources };
}

/** Lessons in teaching order, across modules. */
export function orderedLessons(course: PublishedCourse) {
  return course.modules.flatMap((m) => m.lessons.map((lesson) => ({ lesson, module: m })));
}

/** The lesson with its module label and its neighbours; null if the key is unknown. */
export function lessonView(course: PublishedCourse, key: string): LessonView | null {
  const all = orderedLessons(course);
  const at = all.findIndex((x) => x.lesson.key === key);
  const here = all[at];
  if (!here) return null;
  const link = (x: (typeof all)[number] | undefined) =>
    x ? { key: x.lesson.key, title: x.lesson.title } : null;
  return {
    courseId: course.courseId,
    lesson: here.lesson,
    moduleLabel: here.module.label,
    moduleName: here.module.name,
    previous: link(all[at - 1]),
    next: link(all[at + 1]),
  };
}

const q = (s: string) => `'${s.replaceAll("'", "''")}'`;

/**
 * The SQL that publishes a definition: upsert the resources, then insert the next version.
 * One statement per entry, each on a single line (D1 test batches take them one by one; the
 * publish script joins them into a file). `courseId` must already exist in `courses`.
 */
export function publishStatements(
  def: CourseDefinition,
  opts: { now: number; publishedBy: string },
): string[] {
  const { contentJson, resources } = toPublication(def);
  const statements = resources.map(
    (r) =>
      `INSERT INTO resources (id, course_id, lesson_key, kind, label, r2_key, content_type, bytes, created_at) VALUES (${q(r.id)}, ${q(r.courseId)}, ${q(r.lessonKey)}, ${q(r.kind)}, ${q(r.label)}, ${q(r.r2Key)}, ${q(r.contentType)}, 0, ${opts.now}) ON CONFLICT(r2_key) DO UPDATE SET lesson_key = excluded.lesson_key, label = excluded.label, content_type = excluded.content_type;`,
  );
  statements.push(
    `INSERT INTO course_publications (id, course_id, version, content_json, published_at, published_by) SELECT lower(hex(randomblob(16))), ${q(def.id)}, COALESCE(MAX(version), 0) + 1, ${q(contentJson)}, ${opts.now}, ${q(opts.publishedBy)} FROM course_publications WHERE course_id = ${q(def.id)};`,
  );
  return statements;
}
