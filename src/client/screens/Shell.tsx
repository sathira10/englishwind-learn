import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/Button";
import { ButtonLink } from "../components/ButtonLink";
import { EmptyState } from "../components/EmptyState";
import { postRaw } from "../api";

/**
 * The page's h1. It takes focus when it appears, so after a route change a keyboard or screen
 * reader user starts at the new page's title. Screens remount it per page (and per lesson).
 */
export function PageHeading({ children }: { children: ReactNode }) {
  // Focus once on mount. An inline ref callback would run again on every re-render (a new
  // function each time) and pull focus out of a field the student is typing in.
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h1 tabIndex={-1} ref={ref} className="m-0 font-display text-h2 font-bold text-fg-strong">
      {children}
    </h1>
  );
}

/** The page frame: a slim header and a centred column. Mobile first; text never under 16px. */
export function Shell({ children, signedIn = true }: { children: ReactNode; signedIn?: boolean }) {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  async function signOut() {
    setLeaving(true);
    try {
      await postRaw("/api/auth/sign-out", {});
    } finally {
      navigate("/sign-in", { replace: true });
    }
  }

  return (
    <>
      <header className="bg-surface-dark" data-surface="navy">
        <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-4 py-2">
          <Link to="/" className="ew-link font-display text-h4 font-bold">
            EnglishWind
          </Link>
          {signedIn ? (
            <nav aria-label="Account" className="flex items-center gap-2">
              <Link to="/" className="ew-link px-2 font-bold">
                My courses
              </Link>
              <Button variant="secondary" small onClick={signOut} loading={leaving}>
                Sign out
              </Button>
            </nav>
          ) : null}
        </div>
      </header>
      <main className="py-8">
        <div className="mx-auto max-w-page px-4">{children}</div>
      </main>
    </>
  );
}

export function Loading() {
  return (
    <p role="status" className="m-0 text-base text-fg-muted">
      Loading...
    </p>
  );
}

/** The one place a course order starts at launch (plan 13). */
export const ORDER_PATH = "/order/blueprint";

export function NoAccessScreen({ level = 1 }: { level?: 1 | 2 }) {
  return (
    <div className="max-w-measure">
      <EmptyState
        title="You don't have access to this course"
        headingLevel={level}
        focusHeading
        action={
          <div className="flex flex-wrap gap-4">
            <ButtonLink to={ORDER_PATH}>Order the Blueprint course</ButtonLink>
            <ButtonLink to="/" variant="secondary" outline>
              My courses
            </ButtonLink>
          </div>
        }
      >
        Your access may have ended, or your payment may not be confirmed yet. If you think this is a
        mistake, message us on WhatsApp.
      </EmptyState>
    </div>
  );
}

export function NotFoundScreen({ level = 1 }: { level?: 1 | 2 }) {
  return (
    <div className="max-w-measure">
      <EmptyState
        title="That page isn't here"
        headingLevel={level}
        focusHeading
        action={<ButtonLink to="/">My courses</ButtonLink>}
      >
        Nothing is wrong with your course access.
      </EmptyState>
    </div>
  );
}

export function UnverifiedScreen({ level = 1 }: { level?: 1 | 2 }) {
  return (
    <div className="max-w-measure">
      <EmptyState
        title="Confirm your email first"
        headingLevel={level}
        focusHeading
        action={<ButtonLink to="/sign-in">Sign in with an email code</ButtonLink>}
      >
        Your email address isn't confirmed yet. Signing in with the 6-digit code we email you
        confirms it.
      </EmptyState>
    </div>
  );
}

export function ErrorScreen({ onRetry, level = 1 }: { onRetry?: () => void; level?: 1 | 2 }) {
  return (
    <div className="max-w-measure">
      <EmptyState
        title="That didn't load"
        headingLevel={level}
        focusHeading
        action={onRetry ? <Button onClick={onRetry}>Try again</Button> : undefined}
      >
        Check your connection and try again. Your progress is saved.
      </EmptyState>
    </div>
  );
}
