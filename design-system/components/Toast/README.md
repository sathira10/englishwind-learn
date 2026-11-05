# Toast

App only (`src/client/components/Toast.tsx`, `toast-context.ts`; queue rules in `src/domain/toast-queue.ts`). A short confirmation such as "Order approved."

Wrap the app in `ToastProvider` once; call `useToast().show(message, { durationMs? })`. The provider renders one always-present `role="status"` `aria-live="polite"` region fixed at the bottom of the viewport, so each new toast is announced. A toast is a navy (`surface-dark`) band with `fg-on-dark` text, a 1px `line` border, and a secondary "Dismiss" button. It leaves by itself after 4 s plus 40 ms a character (10 s at most), pauses while hovered or focused, and at most 3 show at once. A repeat of a message still showing is ignored.

Nothing animates in or out. Use a toast for confirmation only; an error the student must act on belongs next to the field or button as an `ew-notice`.
