# Toast

App only (englishwind-learn, `src/client/components/Toast.tsx`, `toast-context.ts`; queue rules in `src/domain/toast-queue.ts`). A short confirmation such as "Order approved."

Wrap the app in `ToastProvider` once, then call `useToast().show(message, { durationMs? })`. The provider renders one always-present `role="status"` `aria-live="polite"` region fixed at the bottom of the viewport, so each new toast is announced.

A toast is `ew-toast`: a navy (`surface-dark`) band with `fg-on-dark` text, a 1px `line` border, `radius-control`, no shadow, and a width of `toast-max` (26rem). The dismiss control is a 24px `close` icon in an `ew-icon-btn` (44px target) with `aria-label="Dismiss"`.

It leaves by itself after 4 s plus 40 ms per character (10 s at most). It pauses while hovered or focused, and at most 3 show at once. A repeat of a message that is still showing is ignored.

Nothing animates in or out. Use a toast for confirmation only. An error the student must act on belongs next to the field or button as an `ew-notice`.
