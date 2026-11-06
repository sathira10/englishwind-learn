import { useState } from "react";
import { Link } from "react-router";
import { formatLkr } from "../../domain/orders";
import { formatAge, formatColomboDateTime } from "../../domain/time";
import type { AdminOrder } from "../../shared/admin";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { TextField } from "../components/TextField";
import { useToast } from "../components/toast-context";
import { adminApi, errorMessage, useAdminLoad } from "./api";
import { Checkbox } from "./Checkbox";

type Action = { kind: "approve" | "reject"; order: AdminOrder } | null;

/** The home screen: pending bank transfers, oldest first, each with Approve and Reject. */
export default function QueuePage() {
  const [load, reload] = useAdminLoad<{ orders: AdminOrder[] }>("/orders?status=pending");
  const toast = useToast();
  const [action, setAction] = useState<Action>(null);
  const [checked, setChecked] = useState(false);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  function open(next: Action) {
    setChecked(false);
    setReason("");
    setProblem("");
    setAction(next);
  }

  async function confirm() {
    if (!action) return;
    const { kind, order } = action;
    if (kind === "approve" && order.needsStaffCheck && !checked) {
      setProblem("Tick the box to say you checked the class enrolment.");
      return;
    }
    setBusy(true);
    setProblem("");
    const res =
      kind === "approve"
        ? await adminApi("POST", `/orders/${order.id}/approve`, {
            studentId: order.studentId,
            ...(order.needsStaffCheck ? { staffChecked: checked } : {}),
          })
        : await adminApi("POST", `/orders/${order.id}/reject`, reason.trim() ? { reason } : {});
    setBusy(false);
    if (!res.ok) {
      setProblem(errorMessage(res.error));
      // The list behind the dialog is stale; refresh it so closing shows the new recipient.
      if (res.error.error === "recipient_changed") reload();
      return;
    }
    setAction(null);
    toast.show(
      kind === "approve"
        ? `Approved ${order.reference}. ${order.buyerName} now has access.`
        : `Rejected ${order.reference}.`,
    );
    reload();
  }

  const now = Date.now();

  return (
    <div className="grid gap-6">
      <h1 className="m-0 font-display text-h2 font-bold text-fg-strong">Orders waiting</h1>
      {load.state === "loading" ? <p className="m-0 text-body text-fg">Loading...</p> : null}
      {load.state === "error" ? (
        <p className="ew-notice" role="alert">
          {load.message}
        </p>
      ) : null}
      {load.state === "ready" && load.data.orders.length === 0 ? (
        <EmptyState
          title="No orders waiting"
          action={
            <Link to="/admin/orders/new" className="ew-btn ew-btn-secondary ew-btn-outline">
              Add an order by hand
            </Link>
          }
        >
          New transfers will show here.
        </EmptyState>
      ) : null}
      {load.state === "ready" ? (
        <ul className="m-0 grid list-none gap-4 p-0">
          {load.data.orders.map((order) => (
            <li key={order.id} className="ew-panel m-0 grid gap-4 bg-surface">
              <div>
                <p className="m-0 text-body font-bold text-fg-strong">{order.reference}</p>
                <p className="m-0 text-h3 font-bold text-fg-strong">
                  {formatLkr(order.amountCents)}
                </p>
                <p className="m-0 text-base text-fg">{order.offerLabel}</p>
              </div>
              <dl className="m-0 grid gap-1 text-base text-fg">
                <div>
                  <dt className="inline text-fg-muted">Name: </dt>
                  <dd className="m-0 inline font-bold text-fg-strong">{order.buyerName}</dd>
                </div>
                <div>
                  <dt className="inline text-fg-muted">Phone: </dt>
                  <dd className="m-0 inline">
                    <a
                      href={`tel:${order.buyerPhone.replace(/[^+\d]/g, "")}`}
                      className="inline-flex min-h-12 items-center font-bold"
                    >
                      {order.buyerPhone}
                    </a>
                  </dd>
                </div>
                <div className="[overflow-wrap:anywhere]">
                  <dt className="inline text-fg-muted">Email: </dt>
                  <dd className="m-0 inline">{order.buyerEmail}</dd>
                </div>
                <div>
                  <dt className="inline text-fg-muted">Placed: </dt>
                  <dd className="m-0 inline">
                    {formatColomboDateTime(order.createdAt)} ({formatAge(order.createdAt, now)})
                  </dd>
                </div>
              </dl>
              {order.student ? (
                <p className="ew-notice">
                  Linked to {order.student.name} ({order.student.email}). Access goes to that
                  account.
                </p>
              ) : null}
              {order.needsStaffCheck ? (
                <p className="ew-notice">
                  Class offer. Check the buyer's class enrolment before you approve.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-4">
                <Button onClick={() => open({ kind: "approve", order })}>Approve</Button>
                <Button variant="secondary" outline onClick={() => open({ kind: "reject", order })}>
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <ConfirmDialog
        open={action?.kind === "approve"}
        title="Approve this order?"
        confirmLabel="Approve order"
        busy={busy}
        busyLabel="Approving"
        onConfirm={confirm}
        onClose={() => setAction(null)}
      >
        {action ? (
          <div className="grid gap-4">
            <p className="m-0">
              {action.order.amountCents === 0 ? (
                <>
                  No transfer is due for <strong>{action.order.reference}</strong>. Approve once you
                  have checked the class enrolment.{" "}
                </>
              ) : (
                <>
                  Only approve when {formatLkr(action.order.amountCents)} with the note{" "}
                  <strong>{action.order.reference}</strong> is in the bank account.{" "}
                </>
              )}
              {action.order.student
                ? `${action.order.student.name} (${action.order.student.email}) gets access straight away, not the buyer.`
                : `${action.order.buyerName} gets access straight away.`}
            </p>
            {action.order.needsStaffCheck ? (
              <Checkbox
                label="I checked the class enrolment"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
            ) : null}
            {problem ? (
              <p className="ew-notice" role="alert">
                {problem}
              </p>
            ) : null}
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={action?.kind === "reject"}
        title="Reject this order?"
        confirmLabel="Reject order"
        busy={busy}
        busyLabel="Rejecting"
        onConfirm={confirm}
        onClose={() => setAction(null)}
      >
        {action ? (
          <div className="grid gap-4">
            <p className="m-0">
              {action.order.reference} for {action.order.buyerName} will not be approved. The buyer
              is not emailed; message them on WhatsApp.
            </p>
            <TextField
              label="Reason"
              optional
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
            {problem ? (
              <p className="ew-notice" role="alert">
                {problem}
              </p>
            ) : null}
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
