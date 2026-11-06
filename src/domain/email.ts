// Pure email helpers (plans/03-auth.md). No I/O.

/** The one spelling we store and compare: trimmed and lower-case. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** `kasun@gmail.com` -> `k***@gmail.com`. For log lines, which must not hold a full address. */
export function maskEmail(email: string): string {
  const [local = "", domain] = normalizeEmail(email).split("@");
  if (domain === undefined) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

/** The part before the `@`, used as a student's name until they give one. */
export function nameFromEmail(email: string): string {
  return normalizeEmail(email).split("@")[0] || "student";
}
