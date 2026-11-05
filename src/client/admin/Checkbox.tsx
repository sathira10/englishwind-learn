import { useId, type InputHTMLAttributes } from "react";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className" | "id"> & {
  label: string;
};

/** A checkbox whose whole row is the tap target (48px high), with the browser's own focus ring. */
export function Checkbox({ label, ...rest }: CheckboxProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex min-h-12 cursor-pointer items-center gap-3 text-base text-fg-strong"
    >
      <input {...rest} id={id} type="checkbox" className="size-6 shrink-0 accent-accent" />
      <span>{label}</span>
    </label>
  );
}
