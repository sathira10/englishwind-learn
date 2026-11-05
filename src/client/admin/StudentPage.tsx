import { useState } from "react";
import { useParams } from "react-router";
import { formatLkr } from "../../domain/orders";
import { formatColomboDate, formatColomboDateTime } from "../../domain/time";
import type { AdminCourse, AdminGrant, AdminOrder, StudentDetail } from "../../shared/admin";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { StatusLabel } from "../components/StatusLabel";
import { TextField } from "../components/TextField";
import { useToast } from "../components/toast-context";
import { adminApi, errorMessage, useAdminLoad } from "./api";
import { Select } from "./Select";

type Action =
  | { kind: "extend"; grant: AdminGrant }
  | { kind: "revoke"; grant: AdminGrant }
  | { kind: "grant" }
  | { kind: "attach"; order: AdminOrder }
  | null;

const GRANT_WORDS = {
  current: "Has access",
  upcoming: "Starts later",
  ended: "Access ended",
  revoked: "Revoked",
} as const;

/** One student: their access, orders and progress, with the actions that change them. */
export default function StudentPage() {
  const { id = "" } = useParams();
  const [detail, reload] = useAdminLoad<StudentDetail>(`/students/${encodeURIComponent(id)}`);
  const [pending] = useAdminLoad<{ orders: AdminOrder[] }>("/orders?status=pending");
  const [courses] = useAdminLoad<{ courses: AdminCourse[] }>("/courses");
  const toast = useToast();

  const [action, setAction] = useState<Action>(null);
  const [years, setYears] = useState("1");
  const [reason, setReason] = useState("");
  const [courseId, setCourseId] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  function open(next: Action) {
    setYears("1");
    setReason("");
    setProblem("");
    setCourseId("");
    setAction(next);
  }

  async function confirm() {
    if (!action) return;
    setBusy(true);
    setProblem("");
    let res;
    let done = "";
    if (action.kind === "extend") {
      res = await adminApi("POST", `/grants/${action.grant.id}/extend`, { years: Number(years) });
      done = `Extended access by ${years} ${years === "1" ? "year" : "years"}.`;
    } else if (action.kind === "revoke") {
      if (!reason.trim()) {
        setBusy(false);
        setProblem("Add a reason.");
        return;
      }
      res = await adminApi("POST", `/grants/${action.grant.id}/revoke`, { reason });
      done = "Access revoked.";
    } else if (action.kind === "grant") {
      const chosen = courseId || (courses.state === "ready" ? courses.data.courses[0]?.id : "");
      res = await adminApi("POST", `/students/${id}/grants`, { courseId: chosen });
      done = "Access given.";
    } else {
      res = await adminApi("POST", `/orders/${action.order.id}/attach`, { studentId: id });
      done = `Attached ${action.order.reference} to this student.`;
    }
    setBusy(false);
    if (!res.ok) {
      setProblem(errorMessage(res.error));
      return;
    }
    setAction(null);
    toast.show(done);
    reload();
  }

  if (detail.state === "loading") return <p className="m-0 text-body text-fg">Loading...</p>;
  if (detail.state === "error") {
    return (
      <EmptyState title="We can't open that student" headingLevel={2}>
        {detail.message}
      </EmptyState>
    );
  }
  const { student, grants, orders, progress } = detail.data;
  const known = new Set(orders.map((o) => o.id));
  const attachable = [
    ...orders.filter((o) => o.status === "pending" && o.studentId !== student.id),
    ...(pending.state === "ready"
      ? pending.data.orders.filter((o) => o.studentId !== student.id && !known.has(o.id))
      : []),
  ];
  const firstCourse = courses.state === "ready" ? courses.data.courses[0]?.id : "";

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="m-0 font-display text-h2 font-bold text-fg-strong">{student.name}</h1>
        <p className="m-0 text-body text-fg [overflow-wrap:anywhere]">{student.email}</p>
        {student.phone ? <p className="m-0 text-body text-fg">{student.phone}</p> : null}
        <p className="m-0 text-base text-fg-muted">Joined {formatColomboDate(student.createdAt)}</p>
      </div>

      <section className="grid gap-4" aria-labelledby="access">
        <h2 id="access" className="m-0 font-display text-h3 font-semibold text-fg-strong">
          Access
        </h2>
        {grants.length === 0 ? (
          <EmptyState title="No access yet">
            Approve an order, or give access by hand below.
          </EmptyState>
        ) : null}
        <ul className="m-0 grid list-none gap-4 p-0">
          {grants.map((g) => (
            <li key={g.id} className="ew-panel m-0 grid gap-3 bg-surface">
              <div>
                <p className="m-0 text-body font-bold text-fg-strong">{g.courseTitle}</p>
                <p className="m-0 text-base font-bold text-fg-strong">{GRANT_WORDS[g.state]}</p>
              </div>
              <p className="m-0 text-base text-fg">
                {formatColomboDate(g.startsAt)} to {formatColomboDate(g.endsAt)}
                {g.orderId ? "" : " (given by hand)"}
              </p>
              {g.revokedAt !== null ? (
                <p className="m-0 text-base text-fg">
                  Revoked {formatColomboDateTime(g.revokedAt)} by {g.revokedBy}. Reason: {g.reason}
                </p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  <Button
                    variant="secondary"
                    outline
                    onClick={() => open({ kind: "extend", grant: g })}
                  >
                    Extend
                  </Button>
                  <Button
                    variant="secondary"
                    outline
                    onClick={() => open({ kind: "revoke", grant: g })}
                  >
                    Revoke
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div>
          <Button variant="secondary" outline onClick={() => open({ kind: "grant" })}>
            Give access by hand
          </Button>
        </div>
      </section>

      <section className="grid gap-4" aria-labelledby="orders">
        <h2 id="orders" className="m-0 font-display text-h3 font-semibold text-fg-strong">
          Orders
        </h2>
        {orders.length === 0 ? <p className="m-0 text-body text-fg">No orders.</p> : null}
        <ul className="m-0 grid list-none gap-2 p-0">
          {orders.map((o) => (
            <li key={o.id} className="m-0 flex items-center justify-between gap-4 bg-surface p-4">
              <span className="min-w-0 text-base text-fg">
                <span className="block font-bold text-fg-strong">{o.reference}</span>
                {o.offerLabel}, {formatLkr(o.amountCents)}
                <span className="block text-fg-muted">{formatColomboDateTime(o.createdAt)}</span>
              </span>
              <StatusLabel status={o.status} />
            </li>
          ))}
        </ul>
        {attachable.length > 0 ? (
          <div className="grid gap-2">
            <h3 className="m-0 text-body font-bold text-fg-strong">Attach a waiting order</h3>
            <p className="m-0 text-base text-fg-muted">
              For a buyer who paid with a different email. Approving it then gives this student
              access.
            </p>
            <ul className="m-0 grid list-none gap-2 p-0">
              {attachable.map((o) => (
                <li key={o.id} className="m-0 grid gap-2 bg-surface p-4 text-base text-fg">
                  <span>
                    <span className="block font-bold text-fg-strong">{o.reference}</span>
                    {o.buyerName}, {o.buyerEmail}, {formatLkr(o.amountCents)}
                  </span>
                  <div>
                    <Button
                      variant="secondary"
                      outline
                      small
                      onClick={() => open({ kind: "attach", order: o })}
                    >
                      Attach to this student
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4" aria-labelledby="progress">
        <h2 id="progress" className="m-0 font-display text-h3 font-semibold text-fg-strong">
          Progress
        </h2>
        {progress.length === 0 ? (
          <p className="m-0 text-body text-fg">No lessons opened yet.</p>
        ) : null}
        {progress.map((p) => (
          <p key={p.courseId} className="m-0 text-body text-fg">
            <strong className="text-fg-strong">{p.courseTitle}:</strong> {p.completedLessons}{" "}
            {p.completedLessons === 1 ? "lesson" : "lessons"} completed
            {p.lastVisitedAt !== null
              ? `, last opened ${formatColomboDateTime(p.lastVisitedAt)}`
              : ""}
            .
          </p>
        ))}
      </section>

      <ConfirmDialog
        open={action !== null}
        title={
          action?.kind === "extend"
            ? "Extend access"
            : action?.kind === "revoke"
              ? "Revoke access"
              : action?.kind === "attach"
                ? "Attach this order?"
                : "Give access by hand"
        }
        confirmLabel={
          action?.kind === "extend"
            ? "Extend access"
            : action?.kind === "revoke"
              ? "Revoke access"
              : action?.kind === "attach"
                ? "Attach order"
                : "Give access"
        }
        busy={busy}
        busyLabel="Saving"
        onConfirm={confirm}
        onClose={() => setAction(null)}
      >
        <div className="grid gap-4">
          {action?.kind === "extend" ? (
            <>
              <p className="m-0">
                {action.grant.courseTitle} now ends on {formatColomboDate(action.grant.endsAt)}.
                Years are added to that date, or to today if access has ended.
              </p>
              <Select label="Add" value={years} onChange={(e) => setYears(e.target.value)}>
                <option value="1">1 year</option>
                <option value="2">2 years</option>
                <option value="3">3 years</option>
              </Select>
            </>
          ) : null}
          {action?.kind === "revoke" ? (
            <>
              <p className="m-0">
                {student.name} loses access to {action.grant.courseTitle} straight away.
              </p>
              <TextField
                label="Reason"
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
            </>
          ) : null}
          {action?.kind === "grant" ? (
            <>
              <p className="m-0">
                {student.name} gets the full access period, starting now. No order is linked.
              </p>
              <Select
                label="Course"
                value={courseId || firstCourse}
                onChange={(e) => setCourseId(e.target.value)}
              >
                {courses.state === "ready"
                  ? courses.data.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.accessYears} years)
                      </option>
                    ))
                  : null}
              </Select>
            </>
          ) : null}
          {action?.kind === "attach" ? (
            <p className="m-0">
              {action.order.reference} from {action.order.buyerName} ({action.order.buyerEmail})
              will give {student.name} access when you approve it.
            </p>
          ) : null}
          {problem ? (
            <p className="ew-notice" role="alert">
              {problem}
            </p>
          ) : null}
        </div>
      </ConfirmDialog>
    </div>
  );
}
