import { formatAccessEnd } from "../../domain/student-screens";
import { myCoursesResponse, type MyCourse } from "../../shared/access";
import { getJson } from "../api";
import { ButtonLink } from "../components/ButtonLink";
import { EmptyState } from "../components/EmptyState";
import { ListRow, ListRows } from "../components/ListRow";
import { useLoad } from "../use-load";
import { ErrorScreen, Loading, ORDER_PATH, Shell, UnverifiedScreen } from "./Shell";

export function MyCourses() {
  const load = useLoad("courses", () => getJson("/api/courses", myCoursesResponse));
  return (
    <Shell>
      <h1 className="m-0 mb-6 font-display text-h2 font-bold text-fg-strong">My courses</h1>
      {load.state === "loading" ? <Loading /> : null}
      {load.state === "ready" ? <MyCoursesList courses={load.data.courses} /> : null}
      {load.state === "unverified" ? <UnverifiedScreen /> : null}
      {load.state === "error" || load.state === "not_found" || load.state === "no_access" ? (
        <ErrorScreen onRetry={load.reload} />
      ) : null}
    </Shell>
  );
}

export function MyCoursesList({ courses }: { courses: readonly MyCourse[] }) {
  if (courses.length === 0) {
    return (
      <div className="max-w-measure">
        <EmptyState
          title="No courses yet"
          headingLevel={2}
          action={<ButtonLink to={ORDER_PATH}>Order the Blueprint course</ButtonLink>}
        >
          Your course appears here once your payment is confirmed. If you've already paid, message
          us on WhatsApp.
        </EmptyState>
      </div>
    );
  }
  return (
    <ListRows label="Your courses">
      {courses.map((c) => (
        <ListRow
          key={c.courseId}
          to={`/courses/${c.courseId}`}
          title={c.title}
          meta={`Access until ${formatAccessEnd(c.accessEndsAt)}`}
          trailing={<span aria-hidden="true">Open →</span>}
        />
      ))}
    </ListRows>
  );
}
