import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** What will happen, in a sentence or two. */
  children: ReactNode;
  /** Says what happens: "Approve order", never "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  /** The confirmed action is running: the confirm button shows `busyLabel` and Esc is ignored. */
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  /** Cancel, Esc. The caller sets `open` to false. */
  onClose: () => void;
};

/**
 * A native <dialog> opened with showModal(): the browser makes the rest of the page inert (focus
 * stays inside), returns focus to the opener on close, and fires `cancel` on Esc. Focus starts on
 * Cancel so Enter never confirms by accident.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  busy = false,
  busyLabel,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="app-dialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onKeyDown={(event) => {
        // Wrap Tab inside the dialog so focus never reaches the browser's own controls.
        if (event.key !== "Tab") return;
        const buttons = [
          ...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled)"),
        ];
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        // Keep the dialog open until the caller sets `open` to false, so state never disagrees.
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id={titleId} className="m-0 font-display text-h3 font-semibold text-fg-strong">
        {title}
      </h2>
      <div id={bodyId} className="mt-4 text-base text-fg">
        {children}
      </div>
      <div className="mt-8 flex flex-wrap gap-4">
        <Button variant="primary" loading={busy} loadingLabel={busyLabel} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" outline disabled={busy} onClick={onClose} ref={cancelRef}>
          {cancelLabel}
        </Button>
      </div>
    </dialog>
  );
}
