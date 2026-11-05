import { useEffect, useState, type MouseEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { lessonLabel, signInUrl } from "../../domain/student-screens";
import { lessonResponse, progressResponse, type LessonResponse } from "../../shared/access";
import { ApiError, getJson, postJson } from "../api";
import { Button } from "../components/Button";
import { ButtonLink } from "../components/ButtonLink";
import { LessonCompleteMark } from "../components/LessonCompleteMark";
import { useToast } from "../components/toast-context";
import { VimeoFrame } from "../components/VimeoFrame";
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

export function LessonPage() {
  const { courseId = "", key = "" } = useParams();
  const base = `/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(key)}`;
  const load = useLoad(`lesson:${courseId}:${key}`, () => getJson(base, lessonResponse));

  // Record the visit once the lesson has loaded, so "continue where you left off" finds it.
  // Only a loaded lesson counts: a student without access writes nothing.
  const ready = load.state === "ready";
  const navigate = useNavigate();

  const location = useLocation();
  const here = location.pathname + location.search;
  useEffect(() => {
    if (!ready) return;
    postJson(`${base}/visit`, progressResponse).catch((err: unknown) => {
      // The session ended while the lesson was open: sign in again and come back.
      if (err instanceof ApiError && err.status === 401)
        navigate(signInUrl(here), { replace: true });
    });
  }, [ready, base, here, navigate]);

  return (
    <Shell>
      {load.state === "loading" ? <Loading /> : null}
      {load.state === "ready" ? (
        <LessonView key={`${courseId}:${key}`} data={load.data} base={base} />
      ) : null}
      {load.state === "no_access" ? <NoAccessScreen /> : null}
      {load.state === "not_found" ? <NotFoundScreen /> : null}
      {load.state === "unverified" ? <UnverifiedScreen /> : null}
      {load.state === "error" ? <ErrorScreen onRetry={load.reload} /> : null}
    </Shell>
  );
}

function LessonView({ data, base }: { data: LessonResponse; base: string }) {
  const { view, progress } = data;
  const { lesson } = view;
  const toast = useToast();
  const navigate = useNavigate();

  // A native link to the API would show raw JSON if the session expired after the lesson
  // loaded. Check first with HEAD; on 401 go to sign-in and come back here.
  async function downloadWorksheet(e: MouseEvent<HTMLAnchorElement>) {
    const href = e.currentTarget.href;
    e.preventDefault();
    const res = await fetch(href, { method: "HEAD", credentials: "same-origin" }).catch(() => null);
    if (res?.status === 401) {
      navigate(signInUrl(window.location.pathname + window.location.search), { replace: true });
      return;
    }
    window.location.assign(href);
  }
  const location = useLocation();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [completedNow, setCompletedNow] = useState(false);
  const complete = completedNow || (progress?.completedAt ?? null) !== null;
  const courseUrl = `/courses/${view.courseId}`;

  async function markComplete() {
    setSaving(true);
    setFailed(false);
    try {
      await postJson(`${base}/complete`, progressResponse);
      setCompletedNow(true);
      toast.show("Lesson marked complete.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate(signInUrl(location.pathname + location.search), { replace: true });
        return;
      }
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="grid gap-6">
      <Link to={courseUrl} className="ew-link font-bold">
        ← Back to the course
      </Link>

      <div className="grid gap-2">
        <p className="m-0 text-base text-fg-muted">
          {view.moduleLabel}: {view.moduleName}
          {lesson.number !== null ? ` · ${lessonLabel(lesson.number)}` : ""}
        </p>
        <PageHeading>{lesson.title}</PageHeading>
      </div>

      <VimeoFrame
        videoId={lesson.vimeoId}
        title={lesson.title}
        fallback={
          <p className="m-0">
            This video isn't available yet. Message us on WhatsApp and we'll sort it out.
          </p>
        }
      />

      {lesson.blurb ? <p className="m-0 max-w-measure text-body text-fg">{lesson.blurb}</p> : null}

      {lesson.worksheets.length > 0 ? (
        <section aria-labelledby="worksheets" className="grid gap-4">
          <h2 id="worksheets" className="m-0 font-display text-h3 font-semibold text-fg-strong">
            Class materials and resources
          </h2>
          <ul role="list" className="m-0 grid list-none gap-2 p-0">
            {lesson.worksheets.map((w) => (
              <li key={w.id} className="m-0">
                <a
                  className="ew-btn ew-btn-secondary ew-btn-outline"
                  href={`/api/worksheets/${encodeURIComponent(w.id)}`}
                  download
                  onClick={(e) => void downloadWorksheet(e)}
                >
                  Download: {w.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4">
        {complete ? (
          <div>
            <LessonCompleteMark complete />
          </div>
        ) : (
          <div className="grid justify-items-start gap-2">
            <Button onClick={markComplete} loading={saving} loadingLabel="Saving">
              Mark complete
            </Button>
            {failed ? (
              <p className="ew-notice" role="alert">
                We couldn't save that. Check your connection and try again.
              </p>
            ) : null}
          </div>
        )}
      </div>

      <nav aria-label="Lessons" className="flex flex-wrap gap-4">
        {view.previous ? (
          <ButtonLink to={`${courseUrl}/lessons/${view.previous.key}`} variant="secondary" outline>
            ← Previous: {view.previous.title}
          </ButtonLink>
        ) : null}
        {view.next ? (
          <ButtonLink to={`${courseUrl}/lessons/${view.next.key}`} variant="secondary" outline>
            Next: {view.next.title} →
          </ButtonLink>
        ) : null}
      </nav>
    </article>
  );
}
