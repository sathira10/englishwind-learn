import type { Mailer } from "./mailer";

type WaitUntil = (promise: Promise<unknown>) => void;
type Log = (line: string) => void;

/**
 * Runs a send so that it cannot fail the caller. A failure is logged with the message name and
 * the error type only: never the address, and never the error text, which may echo it. With
 * `waitUntil` the send continues after the response and this answers "queued"; without it (some
 * test callers) the send is awaited and the answer says how it went.
 */
export async function sendSafely(
  waitUntil: WaitUntil | undefined,
  name: string,
  send: () => Promise<void>,
  log: Log = console.error,
): Promise<"sent" | "queued" | "failed"> {
  let outcome: "sent" | "failed" = "sent";
  const run = Promise.resolve()
    .then(send)
    .catch((error: unknown) => {
      outcome = "failed";
      log(`[mail] ${name} failed (${error instanceof Error ? error.name : typeof error})`);
    });
  if (waitUntil) {
    waitUntil(run);
    return "queued";
  }
  await run;
  return outcome;
}

/** The page a student opens to sign in. Slice 06 builds the screen at this path. */
export function signInUrl(baseUrl: string): string {
  return new URL("/sign-in", baseUrl).toString();
}

interface GrantedRow {
  email: string;
  name: string;
  title: string;
  ends_at: number;
}

/**
 * Emails the student that their access is ready. Slice 09 calls this after `approveOrder`
 * (when `granted` is true). Reads the order's grant, course and student from D1 and answers
 * "skipped" when the order has no grant. Never throws: a mail problem must not undo an approval.
 */
export async function notifyAccessGranted(
  env: Pick<Env, "DB" | "BETTER_AUTH_URL">,
  mailer: Mailer,
  orderId: string,
  options: { waitUntil?: WaitUntil; log?: Log } = {},
): Promise<"sent" | "queued" | "failed" | "skipped"> {
  const log = options.log ?? console.error;
  let row: GrantedRow | null;
  try {
    row = await env.DB.prepare(
      `SELECT s.email AS email, s.name AS name, c.title AS title, g.ends_at AS ends_at
       FROM grants g
       JOIN students s ON s.id = g.student_id
       JOIN courses c ON c.id = g.course_id
       WHERE g.order_id = ?`,
    )
      .bind(orderId)
      .first<GrantedRow>();
  } catch {
    log("[mail] accessGranted failed (lookup)");
    return "failed";
  }
  if (!row) return "skipped";
  const { email, name, title, ends_at } = row;
  return sendSafely(
    options.waitUntil,
    "accessGranted",
    () =>
      mailer.accessGranted(email, {
        name,
        courseTitle: title,
        endsAt: ends_at,
        signInUrl: signInUrl(env.BETTER_AUTH_URL),
      }),
    log,
  );
}
