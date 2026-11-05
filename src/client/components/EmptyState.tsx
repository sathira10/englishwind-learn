import { createElement, type ReactNode } from "react";

type EmptyStateProps = {
  /** Says what is true, plainly: "No orders waiting". */
  title: string;
  /** One sentence on why, or what to do next. */
  children?: ReactNode;
  /** The next step, usually a Button. */
  action?: ReactNode;
  headingLevel?: 1 | 2 | 3;
  /** Moves focus to the heading when it appears, for a screen that replaces the page. */
  focusHeading?: boolean;
};

/** A flat `surface` panel for a list with nothing in it. Reassures, then offers a next step. */
export function EmptyState({
  title,
  children,
  action,
  headingLevel = 3,
  focusHeading = false,
}: EmptyStateProps) {
  return (
    <div className="ew-panel bg-surface">
      {createElement(
        `h${headingLevel}`,
        {
          className: "m-0 font-display text-h3 font-semibold text-fg-strong",
          ...(focusHeading
            ? { tabIndex: -1, ref: (el: HTMLElement | null) => el?.focus({ preventScroll: true }) }
            : {}),
        },
        title,
      )}
      {children ? <p className="m-0 mt-2 max-w-measure text-base text-fg">{children}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
