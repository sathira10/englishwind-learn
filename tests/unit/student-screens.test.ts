// These cases mirror plan 06's reference table (S1 to S10), pending Sathira's copy in
// tests/reference/. S11 to S14 are in src/client/screens/screens.test.ts.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  classifyCodeError,
  cleanCode,
  completionCount,
  formatAccessEnd,
  lessonLabel,
  pickContinueLesson,
  safeReturnTo,
  signInUrl,
} from "../../src/domain/student-screens";
import type { PublishedCourse } from "../../src/shared/course";
import { createApp } from "../../src/worker/app";

const lesson = (key: string, number: number | null, title: string, worksheets = 0) => ({
  key,
  number,
  title,
  vimeoId: "123456",
  worksheets: Array.from({ length: worksheets }, (_, i) => ({ id: `c-${key}-${i}`, label: "W" })),
});

const course: PublishedCourse = {
  courseId: "blueprint",
  title: "The Blueprint",
  intro: "Twelve lessons.",
  modules: [
    {
      index: 0,
      label: "Module 0",
      name: "Start here",
      lessons: [lesson("00", null, "Welcome")],
    },
    {
      index: 1,
      label: "Module 1",
      name: "Speak",
      lessons: [lesson("01", 1, "First words", 1), lesson("02", 2, "More words", 2)],
    },
  ],
};

describe("formatAccessEnd", () => {
  it("S1: shows the Colombo date, not the UTC one", () => {
    // 2029-11-05 22:00 UTC is already 6 November in Colombo (UTC+05:30).
    expect(formatAccessEnd(Date.UTC(2029, 10, 5, 22, 0))).toBe("6 November 2029");
    expect(formatAccessEnd(Date.UTC(2029, 10, 5, 18, 29))).toBe("5 November 2029");
    expect(formatAccessEnd(Date.UTC(2029, 10, 5, 18, 30))).toBe("6 November 2029");
  });
});

describe("lessonLabel", () => {
  it("S2: the welcome has no number", () => {
    expect(lessonLabel(null)).toBe("Welcome");
    expect(lessonLabel(7)).toBe("Lesson 7");
  });
});

describe("pickContinueLesson", () => {
  const p = (
    lessonKey: string,
    lastVisitedAt: number | null,
    completedAt: number | null = null,
  ) => ({
    lessonKey,
    lastVisitedAt,
    completedAt,
  });

  it("S3: the most recently visited lesson, not the last completed", () => {
    expect(pickContinueLesson(course, [p("01", 100, 90), p("02", 50)])?.key).toBe("01");
    expect(pickContinueLesson(course, [p("01", 100), p("02", 200)])).toEqual({
      key: "02",
      title: "More words",
      number: 2,
    });
  });

  it("S4: nothing visited, or only a lesson no longer published, gives null", () => {
    expect(pickContinueLesson(course, [])).toBeNull();
    expect(pickContinueLesson(course, [p("01", null, 5)])).toBeNull();
    expect(pickContinueLesson(course, [p("99", 500)])).toBeNull();
  });

  it("S4b: skips a gone lesson and uses the next most recent", () => {
    expect(pickContinueLesson(course, [p("99", 500), p("01", 100)])?.key).toBe("01");
  });
});

describe("completionCount", () => {
  it("S5: counts complete lessons that are still published", () => {
    const progress = [
      { lessonKey: "00", completedAt: 1, lastVisitedAt: 1 },
      { lessonKey: "02", completedAt: null, lastVisitedAt: 2 },
      { lessonKey: "99", completedAt: 3, lastVisitedAt: 3 },
    ];
    expect(completionCount(course, progress)).toEqual({ done: 1, total: 3 });
  });
});

describe("safeReturnTo and signInUrl", () => {
  it("S6: keeps a path on this site", () => {
    expect(safeReturnTo("/courses/blueprint/lessons/03")).toBe("/courses/blueprint/lessons/03");
  });

  it("S7: refuses anything that could leave the site or loop", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\t/evil",
      "/\n/evil",
      "/%09/evil",
      "javascript:alert(1)",
      "evil",
      "",
      null,
      undefined,
      "/sign-in",
      "/sign-in?next=%2F",
    ]) {
      expect(safeReturnTo(bad), String(bad)).toBe("/");
    }
  });

  it("S8: the sign-in URL carries the way back", () => {
    expect(signInUrl("/courses/blueprint/lessons/03")).toBe(
      "/sign-in?next=%2Fcourses%2Fblueprint%2Flessons%2F03",
    );
    expect(signInUrl("/")).toBe("/sign-in");
    expect(signInUrl("//evil.example")).toBe("/sign-in");
  });
});

describe("classifyCodeError and cleanCode", () => {
  it("S9: names the failure from Better Auth's answer", () => {
    expect(classifyCodeError(400, "INVALID_OTP")).toBe("wrong_code");
    expect(classifyCodeError(400)).toBe("wrong_code");
    expect(classifyCodeError(403, "TOO_MANY_ATTEMPTS")).toBe("too_many_attempts");
    expect(classifyCodeError(403)).toBe("too_many_attempts");
    expect(classifyCodeError(429)).toBe("rate_limited");
    expect(classifyCodeError(500)).toBe("other");
    expect(classifyCodeError(0)).toBe("other");
  });

  it("S10: keeps six digits from a pasted code", () => {
    expect(cleanCode("123 456")).toBe("123456");
    expect(cleanCode("12-34-56-78")).toBe("123456");
    expect(cleanCode("abc")).toBe("");
  });
});

describe("GET /api/sign-in-options", () => {
  const ask = (bindings: Partial<Env>) =>
    createApp().fetch(new Request("https://learn.test/api/sign-in-options"), {
      ...env,
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
      ...bindings,
    } as Env);

  it("S15: Google is off until both keys are set, and no key is ever returned", async () => {
    expect(await (await ask({})).json()).toEqual({ google: false });
    expect(await (await ask({ GOOGLE_CLIENT_ID: "id" })).json()).toEqual({ google: false });
    const on = await ask({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" });
    expect(await on.json()).toEqual({ google: true });
  });
});
