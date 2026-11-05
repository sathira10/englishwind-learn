import { useId, type InputHTMLAttributes } from "react";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id"> & {
  id?: string;
  /** Required: a bold, sentence-case label above the field. */
  label: string;
  hint?: string;
  /** Says what to add or do, never scolds: "Add an email address or a WhatsApp number." */
  error?: string;
  /** Appends a muted "(optional)" instead of marking what is required. */
  optional?: boolean;
};

/**
 * The design system's only input: `ew-field`, 48px high, with a 1px `line` border. `line` measures
 * 3.45:1 on `bg` and 3.12:1 on `surface`, which meets the 3:1 rule for controls.
 */
export function TextField({
  id,
  label,
  hint,
  error,
  optional = false,
  type = "text",
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy =
    [rest["aria-describedby"], hint && hintId, error && errorId].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="grid gap-2">
      <label htmlFor={fieldId} className="ew-label">
        {label}
        {optional ? <span className="font-normal text-fg-muted"> (optional)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="m-0 text-base text-fg-muted">
          {hint}
        </p>
      ) : null}
      <input
        {...rest}
        id={fieldId}
        type={type}
        className="ew-field"
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <p id={errorId} className="ew-notice" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
