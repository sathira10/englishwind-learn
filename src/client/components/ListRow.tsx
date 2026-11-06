import type { ReactNode } from "react";
import { Link } from "react-router";

type RowContent = {
  title: ReactNode;
  /** A second line: date, amount, reference. */
  meta?: ReactNode;
  /** Right-hand side. In a link or button row it sits inside the target, so keep it to text or a
   *  StatusLabel (a text link reads "Review →"); never put a button in it. */
  trailing?: ReactNode;
};

type ListRowProps = RowContent &
  (
    | { to: string; onClick?: never }
    | { onClick: () => void; to?: never }
    | { to?: undefined; onClick?: undefined }
  );

const rowClasses =
  "group flex min-h-[var(--row-min)] w-full box-border items-center justify-between gap-4 bg-surface px-4 py-3 text-left font-[inherit] text-base text-fg no-underline";

/**
 * One row in an admin queue or a student list. A link (`to`) or button (`onClick`) row is a single
 * 44px-or-taller target, so a thumb finds it anywhere along its width. With neither it is a static
 * row, and `trailing` may then hold a real Button.
 */
export function ListRow({ title, meta, trailing, to, onClick }: ListRowProps) {
  const content = (
    <>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <span className="block font-bold text-fg-strong group-hover:underline">{title}</span>
        {meta ? <span className="block text-fg-muted">{meta}</span> : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </>
  );

  return (
    <li className="m-0 list-none p-0">
      {to !== undefined ? (
        <Link to={to} className={rowClasses}>
          {content}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={`${rowClasses} cursor-pointer border-0`}>
          {content}
        </button>
      ) : (
        <div className={rowClasses}>{content}</div>
      )}
    </li>
  );
}

/** The list the rows go in: a real <ul>, rows a step apart on the page ground. */
export function ListRows({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul
      role="list"
      aria-label={label}
      className="m-0 grid grid-cols-[minmax(0,1fr)] list-none gap-2 p-0"
    >
      {children}
    </ul>
  );
}
