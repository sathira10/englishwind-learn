import { useCallback, useEffect, useState } from "react";
import type { AdminError } from "../../shared/admin";

// Calls to /api/admin. A POST is always JSON from our own origin, which is what the Worker's CSRF
// guard requires (the browser adds Origin itself).

export type ApiResult<T> =
  { ok: true; status: number; data: T } | { ok: false; status: number; error: AdminError };

export async function adminApi<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api/admin${path}`, {
      method,
      headers: method === "GET" ? undefined : { "content-type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
    const data: unknown = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, status: res.status, data: data as T };
    return { ok: false, status: res.status, error: data as AdminError };
  } catch {
    return { ok: false, status: 0, error: { error: "network" } };
  }
}

/** What to tell Amma when a call failed. Plain sentences that say what to do next. */
const MESSAGES: Record<string, string> = {
  network: "We could not reach the server. Check your connection and try again.",
  unauthorized: "You are signed out. Reload the page to sign in again.",
  forbidden: "This account is not allowed to do that.",
  not_found: "That record is no longer there. Reload the page.",
  rejected: "This order was rejected, so it cannot be approved.",
  already_approved: "This order is already approved.",
  staff_check_required: "Tick the box to say you checked the class enrolment.",
  not_pending: "This order has already been decided.",
  recipient_changed:
    "This order was linked to a different account since you opened it. Close this and check again.",
  student_not_found: "That student is no longer there.",
  already_has_access: "This student already has access to that course. Extend it instead.",
  revoked: "This access was revoked, so it cannot be extended.",
  conflict: "This access changed while you were looking. Reload the page and try again.",
  offer_not_found: "That offer is not available.",
  course_not_found: "That course is not available.",
};

export function errorMessage(error: AdminError): string {
  return MESSAGES[error.error] ?? "Something went wrong. Please try again.";
}

export type Load<T> =
  { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };

/** Load a GET on mount and whenever `path` changes. `reload` fetches again. */
export function useAdminLoad<T>(path: string | null): [Load<T>, () => void] {
  const [load, setLoad] = useState<Load<T>>({ state: "loading" });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (path === null) return;
    let live = true;
    adminApi<T>("GET", path).then((res) => {
      if (!live) return;
      setLoad(
        res.ok
          ? { state: "ready", data: res.data }
          : { state: "error", message: errorMessage(res.error) },
      );
    });
    return () => {
      live = false;
    };
  }, [path, tick]);

  return [load, reload];
}
