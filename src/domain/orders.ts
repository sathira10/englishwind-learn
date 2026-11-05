// Bank-transfer order rules (plan 07). Pure: no I/O, no imports from worker/client/db.
// Money is integer LKR cents. Times are integer epoch milliseconds (UTC).

export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };

export type OrderStatus = "pending" | "approved" | "rejected";

export interface Offer {
  id: string;
  courseId: string;
  priceCents: number;
  needsStaffCheck: boolean;
  active: boolean;
}

export interface Order {
  id: string;
  reference: string;
  offerId: string;
  amountCents: number;
  status: OrderStatus;
  createdAt: number;
  decidedAt: number | null;
  decidedBy: string | null;
  note: string | null;
}

const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
const fail = <E extends string>(error: E): { ok: false; error: E } => ({ ok: false, error });

// ---- References (OPEN-QUESTIONS Q16) ----

/** 31 characters: digits 2-9 and letters without I, L, O (and no 0/1). */
export const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const REFERENCE_PREFIX = "EW-";
export const REFERENCE_LENGTH = 6;

// Largest multiple of the alphabet size that fits in a byte: bytes at or above it are
// discarded so every character is equally likely (rejection sampling).
const ACCEPT_BELOW = Math.floor(256 / REFERENCE_ALPHABET.length) * REFERENCE_ALPHABET.length;

/**
 * Build a reference from a source of random bytes. `getBytes(n)` returns n random bytes;
 * callers pass `(n) => crypto.getRandomValues(new Uint8Array(n))`. Asks for more bytes
 * until six are accepted.
 */
export function generateReferenceFrom(getBytes: (count: number) => Uint8Array): string {
  let code = "";
  while (code.length < REFERENCE_LENGTH) {
    const bytes = getBytes(REFERENCE_LENGTH - code.length);
    if (bytes.length === 0) throw new RangeError("random source returned no bytes");
    for (const byte of bytes) {
      const char = referenceCharFor(byte);
      if (char !== null && code.length < REFERENCE_LENGTH) code += char;
    }
  }
  return REFERENCE_PREFIX + code;
}

/** The character one random byte stands for, or null when the byte is discarded. */
export function referenceCharFor(byte: number): string | null {
  return byte < ACCEPT_BELOW ? REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]! : null;
}

/** Build a reference from a fixed byte buffer. Throws if the buffer runs out. */
export function generateReference(randomBytes: Uint8Array): string {
  let offset = 0;
  return generateReferenceFrom((count) => {
    const chunk = randomBytes.subarray(offset, offset + count);
    if (chunk.length < count) throw new RangeError("not enough random bytes");
    offset += count;
    return chunk;
  });
}

const REFERENCE_PATTERN = new RegExp(`^EW-[${REFERENCE_ALPHABET}]{${REFERENCE_LENGTH}}$`);

export function isValidReference(s: string): boolean {
  return REFERENCE_PATTERN.test(s);
}

/**
 * Tidy a reference as typed in a bank note: trim, upper-case, and put the dash back when it is
 * missing. It does not decide validity; call `isValidReference` on the result.
 */
export function normalizeReference(s: string): string {
  const upper = s.trim().toUpperCase();
  const match = /^EW[\s\-\u2010-\u2015]*(\S+)$/.exec(upper);
  return match ? REFERENCE_PREFIX + match[1] : upper;
}

// ---- Money ----

function isCents(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 0;
}

export type PriceError = "inactive_offer" | "invalid_price";

/** The amount to charge comes from the offer, never from user input. */
export function priceOrder(
  offer: Offer,
): Result<{ amountCents: number; needsStaffCheck: boolean }, PriceError> {
  if (!offer.active) return fail("inactive_offer");
  if (!isCents(offer.priceCents)) return fail("invalid_price");
  return ok({ amountCents: offer.priceCents, needsStaffCheck: offer.needsStaffCheck });
}

/** 1_000_000 -> "LKR 10,000"; 200_050 -> "LKR 2,000.50"; 0 -> "LKR 0". */
export function formatLkr(cents: number): string {
  if (!isCents(cents)) throw new RangeError("cents must be a non-negative integer");
  const rupees = Math.floor(cents / 100);
  const rest = cents % 100;
  const whole = rupees.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return rest === 0 ? `LKR ${whole}` : `LKR ${whole}.${rest.toString().padStart(2, "0")}`;
}

// ---- Decisions ----

export type GrantEffect = "create_grant" | "none";

/** Pending -> approved. Approving again is a no-op, so a second approval never makes a grant. */
export function approve(
  order: Order,
  staffEmail: string,
  now: number,
): Result<{ order: Order; effect: GrantEffect }, "rejected"> {
  switch (order.status) {
    case "pending":
      return ok({
        order: { ...order, status: "approved", decidedAt: now, decidedBy: staffEmail },
        effect: "create_grant",
      });
    case "approved":
      return ok({ order, effect: "none" });
    case "rejected":
      return fail("rejected");
  }
}

/** Pending -> rejected. Revoking an approved order is a grant action, not a reject. */
export function reject(
  order: Order,
  staffEmail: string,
  now: number,
  note?: string,
): Result<{ order: Order }, "already_approved"> {
  switch (order.status) {
    case "pending":
      return ok({
        order: {
          ...order,
          status: "rejected",
          decidedAt: now,
          decidedBy: staffEmail,
          note: note ?? order.note,
        },
      });
    case "rejected":
      return ok({ order });
    case "approved":
      return fail("already_approved");
  }
}

/** The 3 years start when staff approve (OPEN-QUESTIONS Q11). */
export function grantStartFor(_order: Order, approvedAt: number): number {
  return approvedAt;
}
