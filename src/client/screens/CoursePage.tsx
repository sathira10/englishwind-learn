import { useParams } from "react-router";
import {
  completionCount,
  formatAccessEnd,
  lessonLabel,
  pickContinueLesson,
} from "../../domain/student-screens";
import { courseResponse, type CourseResponse } from "../../shared/access";
import { getJson } from "../api";
import { ButtonLink } from "../components/ButtonLink";
import { LessonCompleteMark } from "../components/LessonCompleteMark";
import { ListRow, ListRows } from "../components/ListRow";
import { useLoad } from "../use-load";
import {
  ErrorScreen,
  Loading,
  NoAccessScreen,
  NotFoundScreen,
  PageHeading,
  Shell,
  UnverifiedScreen,
} from "./Shell";

export function CoursePage() {
  const { courseId = "" } = useParams();
  const load = useLoad(`course:${courseId}`, () =>
    getJson(`/api/courses/${encodeURIComponent(courseId)}`, courseResponse),
  );
  return (
    <Shell>
      {load.state === "loading" ? <Loading /> : null}
      {load.state === "ready" ? <CourseOutline data={load.data} /> : null}
      {load.state === "no_access" ? <NoAccessScreen /> : null}
      {load.state === "not_found" ? <NotFoundScreen /> : null}
      {load.state === "unverified" ? <UnverifiedScreen /> : null}
      {load.state === "error" ? <ErrorScreen onRetry={load.reload} /> : null}
    </Shell>
  );
}

export function CourseOutline({ data }: { data: CourseResponse }) {
  const { course, progress, accessEndsAt } = data;
  const done = new Set(progress.filter((p) => p.completedAt !== null).map((p) => p.lessonKey));
  const resume = pickContinueLesson(course, progress);
  const count = completionCount(course, progress);

  return (
    <div className="grid gap-8">
      <div className="grid gap-4">
        <PageHeading>{course.title}</PageHeading>
        <p className="m-0 max-w-measure text-body text-fg">{course.intro}</p>
        <p className="m-0 text-base text-fg-muted">
          {count.done} of {count.total} lessons complete. Access until{" "}
          {formatAccessEnd(accessEndsAt)}.
        </p>
        {resume ? (
          <div>
            <ButtonLink to={`/courses/${course.courseId}/lessons/${resume.key}`}>
              Continue where you left off
            </ButtonLink>
            <p className="m-0 mt-2 text-base text-fg-muted">
              {resume.number === null
                ? resume.title
                : `${lessonLabel(resume.number)}: ${resume.title}`}
            </p>
          </div>
        ) : null}
      </div>

      {course.modules.map((m) => (
        <section key={m.index} aria-labelledby={`module-${m.index}`} className="grid gap-4">
          <div className="grid gap-2">
            <h2
              id={`module-${m.index}`}
              className="m-0 font-display text-h3 font-semibold text-fg-strong"
            >
              {m.label}: {m.name}
            </h2>
            {m.blurb ? <p className="m-0 max-w-measure text-base text-fg">{m.blurb}</p> : null}
          </div>
          <ListRows label={`${m.label} lessons`}>
            {m.lessons.map((l) => (
              <ListRow
                key={l.key}
                to={`/courses/${course.courseId}/lessons/${l.key}`}
                title={l.number === null ? l.title : `${l.number}. ${l.title}`}
                meta={
                  l.worksheets.length > 0
                    ? `${l.worksheets.length} ${l.worksheets.length === 1 ? "worksheet" : "worksheets"}`
                    : undefined
                }
                trailing={<LessonCompleteMark complete={done.has(l.key)} />}
              />
            ))}
          </ListRows>
        </section>
      ))}
    </div>
  );
}
