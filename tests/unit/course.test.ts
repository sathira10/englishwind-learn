import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { course as blueprint } from "../../content/courses/blueprint.ts";
import {
  lessonNumber,
  lessonView,
  publishStatements,
  toPublication,
  validateCourse,
} from "../../src/domain/course.ts";
import { lessonView as lessonViewSchema, publishedCourse } from "../../src/shared/course.ts";
import type { CourseDefinition } from "../../src/shared/course.ts";

// Plan 04 (course definition). The reference table in the plan is mirrored here as R1..R6,
// pending Sathira's copy in tests/reference/. The last block runs the generated SQL against
// real local D1 in workerd.

const NOW = 1_793_836_800_000;
const lessonsOf = (c: CourseDefinition) => c.modules.flatMap((m) => m.lessons);
const clone = (): CourseDefinition => structuredClone(blueprint);

describe("blueprint definition", () => {
  it("R1: is valid, with 6 modules, 13 lessons keyed 00..12 and 8 worksheets", () => {
    const result = validateCourse(blueprint);
    expect(result.ok).toBe(true);
    expect(blueprint.modules).toHaveLength(6);
    expect(lessonsOf(blueprint).map((l) => l.key)).toEqual(
      Array.from({ length: 13 }, (_, i) => String(i).padStart(2, "0")),
    );
    const withSheets = lessonsOf(blueprint)
      .filter((l) => l.worksheets.length > 0)
      .map((l) => l.key);
    expect(withSheets).toEqual(["00", "01", "03", "04", "05", "06", "07", "08"]);
  });

  it("R2: worksheet files are courses/blueprint/lesson-NN.pdf matching the lesson key", () => {
    for (const l of lessonsOf(blueprint)) {
      for (const w of l.worksheets) expect(w.file).toBe(`courses/blueprint/lesson-${l.key}.pdf`);
    }
  });

  it("drops the example.com placeholder and says nothing about books", () => {
    const json = JSON.stringify(blueprint);
    expect(json).not.toContain("example.com");
    expect(json).not.toMatch(/\bbooks?\b/i);
  });
});

describe("validateCourse", () => {
  const errorsOf = (c: unknown) => {
    const r = validateCourse(c);
    return r.ok ? [] : r.errors;
  };

  it("R3: rejects a duplicate lesson key", () => {
    const c = clone();
    lessonsOf(c)[2]!.key = "01";
    expect(errorsOf(c).join()).toContain("duplicate key");
  });

  it("R4: rejects a non-numeric Vimeo id, including a pasted URL and a blank", () => {
    for (const bad of ["https://vimeo.com/1216572629", "", "12a"]) {
      const c = clone();
      lessonsOf(c)[0]!.vimeoId = bad;
      expect(errorsOf(c).length).toBeGreaterThan(0);
    }
  });

  it("R5: rejects a worksheet key outside courses/<courseId>/", () => {
    for (const bad of [
      "lesson-00.pdf",
      "courses/other/lesson-00.pdf",
      "/courses/blueprint/lesson-00.pdf",
      "courses/blueprint/../other/x.pdf",
      "courses/blueprint/",
    ]) {
      const c = clone();
      lessonsOf(c)[0]!.worksheets[0]!.file = bad;
      expect(errorsOf(c).length, bad).toBeGreaterThan(0);
    }
  });

  it("rejects the same file used twice and a bad key shape", () => {
    const c = clone();
    lessonsOf(c)[1]!.worksheets[0]!.file = lessonsOf(c)[0]!.worksheets[0]!.file;
    expect(errorsOf(c).join()).toContain("used twice");
    const d = clone();
    lessonsOf(d)[0]!.key = "0";
    expect(errorsOf(d).length).toBeGreaterThan(0);
  });
});

describe("numbering and navigation", () => {
  it("R6: the welcome has no number, lesson 07 is 7, modules are labelled Module 0..5", () => {
    expect(lessonNumber("00")).toBeNull();
    expect(lessonNumber("07")).toBe(7);
    const { content } = toPublication(blueprint);
    expect(content.modules.map((m) => m.label)).toEqual([
      "Module 0",
      "Module 1",
      "Module 2",
      "Module 3",
      "Module 4",
      "Module 5",
    ]);
    const numbers = content.modules.flatMap((m) => m.lessons.map((l) => l.number));
    expect(numbers).toEqual([null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("previous and next cross module boundaries; ends are null; unknown key is null", () => {
    const { content } = toPublication(blueprint);
    expect(lessonView(content, "00")?.previous).toBeNull();
    expect(lessonView(content, "00")?.next?.key).toBe("01");
    const v = lessonView(content, "04");
    expect(v?.previous?.key).toBe("03");
    expect(v?.next?.key).toBe("05");
    expect(v?.moduleLabel).toBe("Module 2");
    expect(lessonView(content, "12")?.next).toBeNull();
    expect(lessonView(content, "99")).toBeNull();
  });
});

describe("student-facing view", () => {
  it("never includes an r2 key or bucket path", () => {
    const { content, contentJson, resources } = toPublication(blueprint);
    const views = lessonsOf(blueprint).map((l) => lessonView(content, l.key));
    const everything = contentJson + JSON.stringify(views);
    expect(everything).not.toContain("courses/");
    expect(everything).not.toContain(".pdf");
    expect(everything).not.toMatch(/r2|bucket/i);
    for (const r of resources) expect(everything).not.toContain(r.r2Key);
  });

  it("carries worksheet ids that match the resource rows", () => {
    const { content, resources } = toPublication(blueprint);
    const ids = content.modules.flatMap((m) =>
      m.lessons.flatMap((l) => l.worksheets.map((w) => w.id)),
    );
    expect(ids.sort()).toEqual(resources.map((r) => r.id).sort());
  });

  it("the student schemas reject an extra r2Key field", () => {
    const { content } = toPublication(blueprint);
    const bad = structuredClone(content);
    (bad.modules[0]!.lessons[0]!.worksheets[0] as Record<string, unknown>).r2Key = "courses/x.pdf";
    expect(publishedCourse.safeParse(bad).success).toBe(false);
    const view = lessonView(content, "00")!;
    expect(lessonViewSchema.safeParse(view).success).toBe(true);
    expect(lessonViewSchema.safeParse({ ...view, r2Key: "courses/x.pdf" }).success).toBe(false);
  });
});

describe("generated SQL on D1", () => {
  const db = env.DB;
  const publish = (now: number) =>
    db.batch(publishStatements(blueprint, { now, publishedBy: "test" }).map((s) => db.prepare(s)));
  const count = async (sql: string) => (await db.prepare(sql).first<number>("n"))!;

  it("publishes 1 publication with 13 lessons and 8 resources; again makes version 2 only", async () => {
    await publish(NOW);
    expect(await count("SELECT count(*) AS n FROM course_publications")).toBe(1);
    expect(await count("SELECT count(*) AS n FROM resources WHERE course_id = 'blueprint'")).toBe(
      8,
    );
    const first = await db
      .prepare("SELECT version, content_json FROM course_publications")
      .first<{ version: number; content_json: string }>();
    expect(first?.version).toBe(1);
    const stored = publishedCourse.parse(JSON.parse(first!.content_json));
    expect(stored.modules.flatMap((m) => m.lessons)).toHaveLength(13);

    await publish(NOW + 1000);
    const { results } = await db
      .prepare("SELECT version FROM course_publications ORDER BY version")
      .all<{ version: number }>();
    expect(results.map((r) => r.version)).toEqual([1, 2]);
    expect(await count("SELECT count(*) AS n FROM resources WHERE course_id = 'blueprint'")).toBe(
      8,
    );
  });

  it("an edited label updates the existing resource row", async () => {
    const edited = clone();
    edited.modules[0]!.lessons[0]!.worksheets[0]!.label = "Welcome sheet";
    await db.batch(
      publishStatements(edited, { now: NOW + 2000, publishedBy: "test" }).map((s) => db.prepare(s)),
    );
    const row = await db
      .prepare("SELECT label FROM resources WHERE id = 'blueprint-00-w1'")
      .first<{ label: string }>();
    expect(row?.label).toBe("Welcome sheet");
    expect(await count("SELECT count(*) AS n FROM resources WHERE course_id = 'blueprint'")).toBe(
      8,
    );
  });

  it("escapes single quotes in copy", async () => {
    // "Why You Still Can't Speak English" has an apostrophe.
    const { results } = await db
      .prepare("SELECT content_json FROM course_publications WHERE version = 1")
      .all<{ content_json: string }>();
    expect(results[0]!.content_json).toContain("Can't Speak");
  });
});
