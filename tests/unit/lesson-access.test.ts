import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { course as blueprint } from "../../content/courses/blueprint.ts";
import { publishStatements } from "../../src/domain/course.ts";
import {
  courseResponse,
  lessonResponse,
  myCoursesResponse,
  progressResponse,
} from "../../src/shared/access.ts";
import { createApp } from "../../src/worker/app";
import type { Mailer } from "../../src/worker/mail";

// Plan 05 (lesson and worksheet access). Real D1 and R2 in workerd, the real Hono app and Better
// Auth; only the mailer is swapped to capture the sign-in code. Each test makes its own student.

const ORIGIN = "https://learn.test";
const DAY = 86_400_000;
const PDF = new TextEncoder().encode("%PDF-1.4 worksheet bytes for lesson 03");
let counter = 0;

const sent: { to: string; code: string }[] = [];
const mailer: Mailer = {
  async sendLoginCode(to, code) {
    sent.push({ to, code });
  },
};
const app = createApp({ mailer });

function call(path: string, init: RequestInit & { cookie?: string; ip: string }) {
  const { cookie, ip, ...rest } = init;
  return app.fetch(
    new Request(`${ORIGIN}${path}`, {
      ...rest,
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        "cf-connecting-ip": ip,
        ...(cookie ? { cookie } : {}),
      },
    }),
    env,
  );
}

/** A signed-in student, with an `api` helper that carries their cookie. */
async function newStudent() {
  const n = ++counter;
  const email = `access-${Date.now()}-${n}@example.lk`;
  const ip = `198.51.${Math.floor(n / 250)}.${(n % 250) + 1}`;
  await call("/api/auth/email-otp/send-verification-otp", {
    method: "POST",
    body: JSON.stringify({ email, type: "sign-in" }),
    ip,
  });
  const res = await call("/api/auth/sign-in/email-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp: sent.at(-1)!.code }),
    ip,
  });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const studentId = (await env.DB.prepare("SELECT id FROM students WHERE email = ?")
    .bind(email)
    .first<string>("id"))!;
  const api = (path: string, method = "GET") => call(`/api${path}`, { method, cookie, ip });
  return { studentId, api };
}

let grantSeq = 0;
function grant(
  studentId: string,
  courseId: string,
  period: { startsAt: number; endsAt: number; revokedAt?: number | null },
) {
  return env.DB.prepare(
    "INSERT INTO grants (id, student_id, course_id, starts_at, ends_at, revoked_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, 'test', ?)",
  )
    .bind(
      `g-${Date.now()}-${++grantSeq}`,
      studentId,
      courseId,
      period.startsAt,
      period.endsAt,
      period.revokedAt ?? null,
      Date.now(),
    )
    .run();
}

const current = () => ({ startsAt: Date.now() - DAY, endsAt: Date.now() + 365 * DAY });

function publish(def: typeof blueprint, offset: number) {
  return env.DB.batch(
    publishStatements(def, { now: Date.now() + offset, publishedBy: "test" }).map((q) =>
      env.DB.prepare(q),
    ),
  );
}

const WORKSHEET = "blueprint-lesson-03";

beforeAll(async () => {
  await env.DB.batch(
    publishStatements(blueprint, { now: Date.now(), publishedBy: "test" }).map((s) =>
      env.DB.prepare(s),
    ),
  );
  // A second course with no publication, to test a grant for another course.
  await env.DB.prepare(
    "INSERT OR IGNORE INTO courses (id, title, access_years, created_at) VALUES ('other', 'Other', 1, 0)",
  ).run();
  // Every worksheet but lesson 03's is left out of R2, so "missing object" is real.
  const key = (
    await env.DB.prepare("SELECT r2_key FROM resources WHERE id = ?")
      .bind(WORKSHEET)
      .first<{ r2_key: string }>()
  )?.r2_key;
  await env.FILES.put(key!, PDF, { httpMetadata: { contentType: "application/pdf" } });
});

const ROUTES: [method: string, path: string][] = [
  ["GET", "/courses"],
  ["GET", "/courses/blueprint"],
  ["GET", "/courses/blueprint/lessons/03"],
  ["POST", "/courses/blueprint/lessons/03/complete"],
  ["POST", "/courses/blueprint/lessons/03/visit"],
  ["GET", `/worksheets/${WORKSHEET}`],
];

/** What must never appear in any answer to someone without access. */
const SECRETS = [/\d{9,}/, /courses\/blueprint/, /\.pdf"?\b.*r2/i, /vimeo/i, /worksheet bytes/];
async function expectNothing(res: Response) {
  const text = await res.text();
  for (const s of SECRETS) expect(text).not.toMatch(s);
  expect(res.headers.get("content-disposition")).toBeNull();
  return text;
}

describe("no session", () => {
  it.each(ROUTES)("%s %s answers 401", async (method, path) => {
    const res = await call(`/api${path}`, { method, ip: "198.18.0.1" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });
});

describe("a student with no grant gets nothing, on every route", () => {
  it.each(ROUTES.slice(1))("%s %s answers 403 no_access", async (method, path) => {
    const { api } = await newStudent();
    const res = await api(path, method);
    expect(res.status).toBe(403);
    expect(JSON.parse(await expectNothing(res))).toEqual({ error: "no_access" });
  });

  it("GET /courses lists no courses", async () => {
    const { api } = await newStudent();
    const res = await api("/courses");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ courses: [] });
  });

  it("writes no progress", async () => {
    const { api, studentId } = await newStudent();
    await api("/courses/blueprint/lessons/03/complete", "POST");
    await api("/courses/blueprint/lessons/03/visit", "POST");
    const n = await env.DB.prepare("SELECT count(*) AS n FROM lesson_progress WHERE student_id = ?")
      .bind(studentId)
      .first<number>("n");
    expect(n).toBe(0);
  });
});

describe("grants that do not count", () => {
  const cases: [
    string,
    (now: number) => { startsAt: number; endsAt: number; revokedAt?: number },
  ][] = [
    ["expired", (now) => ({ startsAt: now - 400 * DAY, endsAt: now - DAY })],
    [
      "revoked",
      (now) => ({ startsAt: now - 10 * DAY, endsAt: now + DAY * 300, revokedAt: now - DAY }),
    ],
    ["not started yet", (now) => ({ startsAt: now + DAY, endsAt: now + 400 * DAY })],
  ];
  for (const [name, period] of cases) {
    it(`a ${name} grant gets 403 on every content route`, async () => {
      const { api, studentId } = await newStudent();
      await grant(studentId, "blueprint", period(Date.now()));
      for (const [method, path] of ROUTES.slice(1)) {
        const res = await api(path, method);
        expect(res.status, `${method} ${path}`).toBe(403);
        await expectNothing(res);
      }
      expect(await (await api("/courses")).json()).toEqual({ courses: [] });
    });
  }

  it("a grant for another course gives nothing on this one", async () => {
    const { api, studentId } = await newStudent();
    await grant(studentId, "other", current());
    for (const [method, path] of ROUTES.slice(1)) {
      const res = await api(path, method);
      expect(res.status, `${method} ${path}`).toBe(403);
      await expectNothing(res);
    }
    // "other" has no publication, so it is not listed either.
    const list = myCoursesResponse.parse(await (await api("/courses")).json());
    expect(list.courses).toEqual([]);
  });

  it("another student's grant does not help", async () => {
    const owner = await newStudent();
    const other = await newStudent();
    await grant(owner.studentId, "blueprint", current());
    expect((await other.api("/courses/blueprint")).status).toBe(403);
    expect((await other.api(`/worksheets/${WORKSHEET}`)).status).toBe(403);
  });
});

describe("a student with a current grant", () => {
  it("reports a future revocation as the end of access, and still allows access until then", async () => {
    const { api, studentId } = await newStudent();
    const period = current();
    const revokedAt = Date.now() + 10 * DAY;
    await grant(studentId, "blueprint", { ...period, revokedAt });
    const list = myCoursesResponse.parse(await (await api("/courses")).json());
    expect(list.courses[0]?.accessEndsAt).toBe(revokedAt);
    const body = courseResponse.parse(await (await api("/courses/blueprint")).json());
    expect(body.accessEndsAt).toBe(revokedAt);
  });

  it("sends Cache-Control: private, no-store on course and lesson JSON", async () => {
    const { api, studentId } = await newStudent();
    await grant(studentId, "blueprint", current());
    for (const path of ["/courses", "/courses/blueprint", "/courses/blueprint/lessons/03"]) {
      const res = await api(path);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control"), path).toBe("private, no-store");
    }
    expect((await api("/courses/blueprint/lessons/99")).headers.get("cache-control")).toBe(
      "private, no-store",
    );
  });

  it("lists their course with the grant end date", async () => {
    const { api, studentId } = await newStudent();
    const period = current();
    await grant(studentId, "blueprint", period);
    const list = myCoursesResponse.parse(await (await api("/courses")).json());
    expect(list.courses).toEqual([
      { courseId: "blueprint", title: "EnglishWind Blueprint", accessEndsAt: period.endsAt },
    ]);
  });

  it("gets the published course with their progress, and no R2 key", async () => {
    const { api, studentId } = await newStudent();
    await grant(studentId, "blueprint", current());
    await api("/courses/blueprint/lessons/03/complete", "POST");
    const res = await api("/courses/blueprint");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toMatch(/courses\/blueprint|\.pdf/);
    const body = courseResponse.parse(JSON.parse(text));
    expect(body.course.modules.flatMap((m) => m.lessons)).toHaveLength(13);
    expect(body.progress.map((p) => p.lessonKey)).toEqual(["03"]);
  });

  it("gets a lesson with its Vimeo id and neighbours", async () => {
    const { api, studentId } = await newStudent();
    await grant(studentId, "blueprint", current());
    const body = lessonResponse.parse(await (await api("/courses/blueprint/lessons/03")).json());
    expect(body.view.lesson.vimeoId).toMatch(/^\d+$/);
    expect(body.view.previous?.key).toBe("02");
    expect(body.view.next?.key).toBe("04");
    expect(body.progress).toBeNull();
  });

  it("answers 404 for an unknown course or lesson", async () => {
    const { api, studentId } = await newStudent();
    await grant(studentId, "blueprint", current());
    expect((await api("/courses/nope")).status).toBe(404);
    expect((await api("/courses/nope/lessons/01")).status).toBe(404);
    expect((await api("/courses/blueprint/lessons/99")).status).toBe(404);
    expect((await api("/courses/blueprint/lessons/abc")).status).toBe(404);
    expect((await api("/courses/blueprint/lessons/99/complete", "POST")).status).toBe(404);
    expect((await api("/worksheets/no-such-resource")).status).toBe(404);
  });

  it("records a visit, then a completion that keeps its first time", async () => {
    const { api, studentId } = await newStudent();
    await grant(studentId, "blueprint", current());
    const visit = progressResponse.parse(
      await (await api("/courses/blueprint/lessons/05/visit", "POST")).json(),
    );
    expect(visit.progress).toMatchObject({ lessonKey: "05", completedAt: null });
    expect(visit.progress.lastVisitedAt).toBeGreaterThan(0);

    const first = progressResponse.parse(
      await (await api("/courses/blueprint/lessons/05/complete", "POST")).json(),
    );
    expect(first.progress.completedAt).not.toBeNull();
    await new Promise((r) => setTimeout(r, 5));
    const again = progressResponse.parse(
      await (await api("/courses/blueprint/lessons/05/complete", "POST")).json(),
    );
    expect(again.progress.completedAt).toBe(first.progress.completedAt);
    expect(again.progress.lastVisitedAt).toBeGreaterThan(first.progress.lastVisitedAt!);

    // A later visit does not clear the completion.
    const later = progressResponse.parse(
      await (await api("/courses/blueprint/lessons/05/visit", "POST")).json(),
    );
    expect(later.progress.completedAt).toBe(first.progress.completedAt);
    const rows = await env.DB.prepare(
      "SELECT count(*) AS n FROM lesson_progress WHERE student_id = ?",
    )
      .bind(studentId)
      .first<number>("n");
    expect(rows).toBe(1);
  });

  it("downloads the worksheet PDF bytes with safe headers", async () => {
    const { api, studentId } = await newStudent();
    await grant(studentId, "blueprint", current());
    const res = await api(`/worksheets/${WORKSHEET}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="[\w.-]+\.pdf"$/);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-disposition")).not.toMatch(/courses\//);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF);
  });

  it("answers 404 when the object is missing from R2", async () => {
    const { api, studentId } = await newStudent();
    await grant(studentId, "blueprint", current());
    const res = await api("/worksheets/blueprint-lesson-04");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("uses the latest publication for the list title too", async () => {
    const { api, studentId } = await newStudent();
    await grant(studentId, "blueprint", current());
    const edited = structuredClone(blueprint);
    edited.title = "Blueprint, second edition";
    await publish(edited, 1);
    const body = courseResponse.parse(await (await api("/courses/blueprint")).json());
    expect(body.course.title).toBe("Blueprint, second edition");
    const list = myCoursesResponse.parse(await (await api("/courses")).json());
    expect(list.courses[0]?.title).toBe("Blueprint, second edition");
  });

  it("serves no worksheet that a later publication dropped", async () => {
    const { api, studentId } = await newStudent();
    await grant(studentId, "blueprint", current());
    expect((await api(`/worksheets/${WORKSHEET}`)).status).toBe(200);
    const dropped = structuredClone(blueprint);
    for (const m of dropped.modules) {
      for (const l of m.lessons) if (l.key === "03") l.worksheets = [];
    }
    await publish(dropped, 2);
    const res = await api(`/worksheets/${WORKSHEET}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});
