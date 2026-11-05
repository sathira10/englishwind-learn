import type { ButtonHTMLAttributes, MouseEvent, Ref } from "react";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  ref?: Ref<HTMLButtonElement>;
  variant?: "primary" | "secondary";
  /** A 1px border instead of the underline, for a secondary beside a primary. */
  outline?: boolean;
  /** `ew-btn-sm`: narrower padding, still 48px high. Sticky bars and inline field actions. */
  small?: boolean;
  /** Work is under way. Stays focusable (so focus is not lost), ignores clicks. */
  loading?: boolean;
  /** Replaces the label while loading, for example "Saving". */
  loadingLabel?: string;
};

export function Button({
  variant = "primary",
  outline = false,
  small = false,
  loading = false,
  loadingLabel,
  type = "button",
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    "ew-btn",
    variant === "primary" ? "ew-btn-primary" : "ew-btn-secondary",
    outline && "ew-btn-outline",
    small && "ew-btn-sm",
  ]
    .filter(Boolean)
    .join(" ");

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      onClick={handleClick}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
    >
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
