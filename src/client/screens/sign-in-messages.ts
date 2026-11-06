export type SignInProblem =
  | "send_failed"
  | "send_rate_limited"
  | "wrong_code"
  | "too_many_attempts"
  | "code_rate_limited"
  | "check_failed"
  | "unverified"
  | "google_failed";

/** What to tell the student, and what to do next. Each says one thing. */
export const signInMessages: Record<SignInProblem, string> = {
  send_failed: "We couldn't send a code. Check the email address and try again.",
  send_rate_limited:
    "Too many codes asked for. Wait a few minutes, then try again, or message us on WhatsApp.",
  wrong_code: "That code isn't right, or it has expired. Check it, or ask for a new one.",
  too_many_attempts: "Too many wrong tries. Ask for a new code below.",
  code_rate_limited: "Too many tries. Wait a few minutes, then try again.",
  check_failed: "We couldn't check the code. Check your connection and try again.",
  unverified: "Your email address isn't confirmed yet. Ask for a new code and enter it to confirm.",
  google_failed: "Google sign-in didn't work. Use the email code instead.",
};
