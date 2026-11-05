import { createElement, type ReactNode } from "react";

type EmptyStateProps = {
  /** Says what is true, plainly: "No orders waiting". */
  title: string;
  /** One sentence on why, or what to do next. */
  children?: ReactNode;
  /** The next step, usually a Button. */
  action?: ReactNode;
  headingLevel?: 2 | 3;
};

/** A flat `surface` panel for a list with nothing in it. Reassures, then offers a next step. */
export function EmptyState({ title, children, action, headingLevel = 3 }: EmptyStateProps) {
  return (
    <div className="ew-panel bg-surface">
      {createElement(
        `h${headingLevel}`,
        { className: "m-0 font-display text-h3 font-semibold text-fg-strong" },
        title,
      )}
      {children ? <p className="m-0 mt-2 max-w-measure text-base text-fg">{children}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
