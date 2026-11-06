import { useEffect, useState } from "react";
import { formatColomboDateTime } from "../../domain/time";
import type { AuditEntry, AuditPage as AuditPageData } from "../../shared/admin";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { adminApi, errorMessage } from "./api";

const ACTIONS: Record<string, string> = {
  "order.approve": "Approved an order",
  "order.reject": "Rejected an order",
  "order.create_manual": "Added an order by hand",
  "order.attach": "Attached an order to a student",
  "grant.create": "Gave access",
  "grant.extend": "Extended access",
  "grant.revoke": "Revoked access",
};

/** What happened, newest first, 50 at a time. */
export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(before: string | null) {
    setBusy(true);
    const res = await adminApi<AuditPageData>(
      "GET",
      `/audit?limit=50${before ? `&before=${encodeURIComponent(before)}` : ""}`,
    );
    setBusy(false);
    if (!res.ok) {
      setState("error");
      setMessage(errorMessage(res.error));
      return;
    }
    setEntries((old) => (before ? [...old, ...res.data.entries] : res.data.entries));
    setNext(res.data.next);
    setState("ready");
  }

  useEffect(() => {
    // Fetch the first page once on mount.
    void load(null);
  }, []);

  return (
    <div className="grid max-w-measure gap-6">
      <h1 className="m-0 font-display text-h2 font-bold text-fg-strong">Audit log</h1>
      {state === "loading" ? <p className="m-0 text-body text-fg">Loading...</p> : null}
      {state === "error" ? (
        <p className="ew-notice" role="alert">
          {message}
        </p>
      ) : null}
      {state === "ready" && entries.length === 0 ? (
        <EmptyState title="Nothing logged yet">Approvals and access changes show here.</EmptyState>
      ) : null}
      {entries.length > 0 ? (
        <ul className="m-0 grid list-none gap-2 p-0">
          {entries.map((e) => (
            <li key={e.id} className="m-0 bg-surface p-4 text-base text-fg">
              <p className="m-0 font-bold text-fg-strong">{ACTIONS[e.action] ?? e.action}</p>
              <p className="m-0 text-fg-muted">
                {formatColomboDateTime(e.at)} by {e.actorEmail}
              </p>
              <p className="m-0 [overflow-wrap:anywhere]">
                {e.entityType} {e.entityId}
              </p>
              {e.data ? (
                <p className="m-0 text-fg-muted [overflow-wrap:anywhere]">{summarise(e.data)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {next ? (
        <div>
          <Button
            variant="secondary"
            outline
            loading={busy}
            loadingLabel="Loading"
            onClick={() => load(next)}
          >
            Show older
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** `key: value` pairs from the audit data, with times shown in Colombo. */
function summarise(data: unknown): string {
  if (typeof data !== "object" || data === null) return String(data);
  return Object.entries(data)
    .map(([key, value]) =>
      /At$/.test(key) && typeof value === "number"
        ? `${key}: ${formatColomboDateTime(value)}`
        : `${key}: ${String(value)}`,
    )
    .join(", ");
}
