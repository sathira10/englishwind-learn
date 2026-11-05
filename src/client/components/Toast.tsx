import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { initialToastState, toastReducer, type ToastItem } from "../../domain/toast-queue";
import { Button } from "./Button";
import { ToastContext, type ToastApi } from "./toast-context";

/**
 * Wrap the app once. The polite live region is always in the page, so a toast added later is
 * announced. Toasts are navy bands, dismiss themselves, and pause while hovered or focused.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(toastReducer, initialToastState);
  const dismiss = useCallback((id: number) => dispatch({ type: "dismiss", id }), []);
  const api = useMemo<ToastApi>(
    () => ({
      show: (message, options) =>
        dispatch({ type: "add", message, durationMs: options?.durationMs }),
    }),
    [],
  );

  return (
    <ToastContext value={api}>
      {children}
      <div className="app-toast-region" role="status" aria-live="polite" aria-atomic="false">
        {state.items.map((item) => (
          <ToastView key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  // Hover and focus are tracked apart: leaving one must not restart the timer while the other holds.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(item.id), item.durationMs);
    return () => clearTimeout(timer);
  }, [paused, item.id, item.durationMs, onDismiss]);

  return (
    <div
      className="app-toast flex items-center justify-between gap-4 bg-surface-dark py-2 pl-4 pr-2 text-fg-on-dark"
      data-surface="navy"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <p className="m-0 min-w-0 flex-1 text-base">{item.message}</p>
      <Button
        variant="secondary"
        small
        onClick={() => onDismiss(item.id)}
        aria-label={`Dismiss: ${item.message}`}
      >
        Dismiss
      </Button>
    </div>
  );
}
