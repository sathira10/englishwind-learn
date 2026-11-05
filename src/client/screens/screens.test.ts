// Plan 06 cases S11 to S14: the screens' list views rendered to static markup.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { CourseResponse } from "../../shared/access";
import type { PublishedCourse } from "../../shared/course";
import { CourseOutline } from "./CoursePage";
import { MyCoursesList } from "./MyCourses";

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

const view = (el: React.ReactElement) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, el));

describe("student views", () => {
  it("S11: My Courses lists courses with the end date in Colombo time", () => {
    const html = view(
      createElement(MyCoursesList, {
        courses: [
          {
            courseId: "blueprint",
            title: "The Blueprint",
            accessEndsAt: Date.UTC(2029, 10, 5, 22),
          },
        ],
      }),
    );
    expect(html).toContain('href="/courses/blueprint"');
    expect(html).toContain("Access until 6 November 2029");
  });

  it("S12: the empty state says how to get access and links to the order page", () => {
    const html = view(createElement(MyCoursesList, { courses: [] }));
    expect(html).toContain("No courses yet");
    expect(html).toContain('href="/order/blueprint"');
    expect(html).not.toMatch(/\bbooks?\b/i);
  });

  it("S13: the course page numbers lessons (00 has none), marks complete, and continues", () => {
    const data: CourseResponse = {
      course,
      accessEndsAt: Date.UTC(2029, 10, 5),
      progress: [
        { lessonKey: "00", completedAt: 5, lastVisitedAt: 5 },
        { lessonKey: "02", completedAt: null, lastVisitedAt: 9 },
      ],
    };
    const html = view(createElement(CourseOutline, { data }));
    expect(html).toContain("Welcome");
    expect(html).not.toContain("0. Welcome");
    expect(html).toContain("1. First words");
    expect(html).toContain("2. More words");
    expect(html.match(/Complete</g)).toHaveLength(1);
    expect(html).toContain('href="/courses/blueprint/lessons/02"');
    expect(html).toContain("Continue where you left off");
    expect(html).toContain("1 of 3 lessons complete");
    expect(html).toContain("2 worksheets");
  });

  it("S14: no continue link before any lesson is opened", () => {
    const data: CourseResponse = { course, accessEndsAt: Date.UTC(2029, 10, 5), progress: [] };
    expect(view(createElement(CourseOutline, { data }))).not.toContain("Continue where");
  });
});
