import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { signInUrl } from "../domain/student-screens";
import { ApiError } from "./api";

export type Load<T> =
  | { state: "loading" }
  | { state: "ready"; data: T }
  | { state: "no_access" }
  | { state: "not_found" }
  | { state: "unverified" }
  | { state: "error" };

/**
 * Loads from the student API once per `key`. A 401 sends the student to sign-in with the current
 * path as the way back; the other known answers become states the screen can show.
 */
export function useLoad<T>(key: string, load: () => Promise<T>): Load<T> & { reload: () => void } {
  const [result, setResult] = useState<{ key: string; value: Load<T> } | null>(null);
  const [tick, setTick] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const here = location.pathname + location.search;

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setResult({ key, value: { state: "ready", data } });
      },
      (err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          navigate(signInUrl(here), { replace: true });
          return;
        }
        const value: Load<T> =
          err instanceof ApiError && err.code === "no_access"
            ? { state: "no_access" }
            : err instanceof ApiError && err.status === 404
              ? { state: "not_found" }
              : err instanceof ApiError && err.code === "email_not_verified"
                ? { state: "unverified" }
                : { state: "error" };
        setResult({ key, value });
      },
    );
    return () => {
      cancelled = true;
    };
    // `load` is a fresh closure each render; `key` and `tick` say when to load again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const current: Load<T> = result && result.key === key ? result.value : { state: "loading" };
  return { ...current, reload };
}
