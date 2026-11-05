import { useId, type SelectHTMLAttributes } from "react";

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "id"> & {
  label: string;
  error?: string;
};

/** A labelled native select in the same 48px control style as TextField. */
export function Select({ label, error, children, ...rest }: SelectProps) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="ew-label">
        {label}
      </label>
      <select {...rest} id={id} className="ew-field" aria-invalid={error ? true : undefined}>
        {children}
      </select>
      {error ? (
        <p className="ew-notice" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
