import type { ReactNode } from "react";
import { Link } from "react-router";

type ButtonLinkProps = {
  to: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  outline?: boolean;
};

/** A link that looks like a Button (`ew-btn`): 48px high, same focus ring. For navigation. */
export function ButtonLink({
  to,
  children,
  variant = "primary",
  outline = false,
}: ButtonLinkProps) {
  const classes = [
    "ew-btn",
    variant === "primary" ? "ew-btn-primary" : "ew-btn-secondary",
    outline && "ew-btn-outline",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Link to={to} className={classes}>
      {children}
    </Link>
  );
}
