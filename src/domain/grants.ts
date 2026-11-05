// Grant rules: pure functions over plain values, no I/O. Times are integer epoch milliseconds
// (UTC). Sri Lanka is Asia/Colombo, a fixed UTC+05:30 with no daylight saving, so calendar
// arithmetic is done on the instant shifted by that offset. See plans/02-grant-rules.md.

export type Grant = {
  startsAt: number;
  endsAt: number;
  /** When staff revoked the grant, or null. */
  revokedAt: number | null;
};

export type GrantPeriod = Pick<Grant, "startsAt" | "endsAt">;

export type GrantError = "revoked" | "invalid-years" | "invalid-time";

export type Result<T> = { ok: true; value: T } | { ok: false; error: GrantError };

const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function isPositiveInteger(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

/**
 * The instant `years` calendar years after `startsAt`, at the same Asia/Colombo wall-clock time.
 * A start on 29 February whose end year is not a leap year ends on 1 March, never earlier
 * (Q12). Throws RangeError unless `years` is a positive integer and `startsAt` an integer.
 */
export function accessEnd(startsAt: number, years: number): number {
  if (!isPositiveInteger(years)) throw new RangeError("years must be a positive integer");
  if (!Number.isSafeInteger(startsAt)) throw new RangeError("startsAt must be an integer");
  // Date.UTC rolls 29 February in a non-leap year over to 1 March, which is the Q12 rule.
  const local = new Date(startsAt + COLOMBO_OFFSET_MS);
  const year = local.getUTCFullYear() + years;
  const end =
    Date.UTC(
      year,
      local.getUTCMonth(),
      local.getUTCDate(),
      local.getUTCHours(),
      local.getUTCMinutes(),
      local.getUTCSeconds(),
      local.getUTCMilliseconds(),
    ) - COLOMBO_OFFSET_MS;
  if (!Number.isFinite(end)) throw new RangeError("end is out of range");
  return end;
}

/** A new, unrevoked period of `accessYears` whole years from `startsAt`. */
export function newGrant(startsAt: number, accessYears: number): GrantPeriod {
  return { startsAt, endsAt: accessEnd(startsAt, accessYears) };
}

/**
 * A grant is current at `now` when it has started and not ended (`startsAt <= now < endsAt`,
 * so the end instant itself is already over) and is not revoked (`revokedAt === null` or
 * `now < revokedAt`; revocation takes effect at `revokedAt`).
 */
export function isCurrent(grant: Grant, now: number): boolean {
  if (grant.revokedAt !== null && now >= grant.revokedAt) return false;
  return grant.startsAt <= now && now < grant.endsAt;
}

/** True when any of the grants is current at `now`. */
export function hasAccess(grants: readonly Grant[], now: number): boolean {
  return grants.some((g) => isCurrent(g, now));
}

/**
 * Adds whole years to the later of the grant's current end and `now` (Q13): an ended grant is
 * extended from now. A revoked grant cannot be extended, whatever the time.
 */
export function extend(grant: Grant, years: number, now: number): Result<Grant> {
  if (!isPositiveInteger(years)) return { ok: false, error: "invalid-years" };
  if (grant.revokedAt !== null) return { ok: false, error: "revoked" };
  if (!Number.isSafeInteger(now)) return { ok: false, error: "invalid-time" };
  const from = Math.max(grant.endsAt, now);
  let endsAt: number;
  try {
    endsAt = accessEnd(from, years);
  } catch {
    return { ok: false, error: "invalid-time" };
  }
  return { ok: true, value: { ...grant, endsAt } };
}

/** Marks the grant revoked at `now`. Revoking again keeps the first `revokedAt`. */
export function revoke(grant: Grant, now: number): Grant {
  if (grant.revokedAt !== null) return grant;
  return { ...grant, revokedAt: now };
}

/** The Asia/Colombo calendar date of an instant, as `YYYY-MM-DD`. For display and tests. */
export function colomboDate(instant: number): string {
  return new Date(instant + COLOMBO_OFFSET_MS).toISOString().slice(0, 10);
}
