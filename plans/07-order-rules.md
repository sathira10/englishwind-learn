# Plan 07: Bank-transfer order rules

5 November 2026. Baseline: `claude/slice-00-launch-roadmap`.

After this slice the order rules are written down and tested as pure functions: how a reference is
made, what an order costs, and what approving or rejecting does, so the later order API and admin
screens only call them.

## Spec

Defaults come from `OPEN-QUESTIONS.md` (Q11, Q14, Q16, Q18). Sathira has not answered yet; the
code builds on the defaults.

### Inputs and outputs

| Name                               | Type and unit                                            | Notes                                                        |
| ---------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| `Offer.priceCents`                 | integer, LKR cents                                       | The only source of an order's amount                         |
| `Offer.needsStaffCheck`            | boolean                                                  | Class prices: Amma checks enrolment before approving (Q14)   |
| `Offer.active`                     | boolean                                                  | Inactive offers cannot be ordered                            |
| `Order.status`                     | `pending`, `approved`, `rejected`                        | No buyer cancel, no expiry (Q18)                             |
| `Order.createdAt`, `decidedAt`     | integer epoch ms UTC (`decidedAt` may be null)           |                                                              |
| `Order.decidedBy`                  | staff email, or null                                     |                                                              |
| `generateReference`                | random bytes -> `EW-` + 6 chars                          | Alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (31 chars) (Q16)  |
| `generateReferenceFrom`            | `(n) => Uint8Array` -> reference                         | Callers pass `crypto.getRandomValues`; rejection sampling    |
| `normalizeReference`               | string -> string                                         | Trim, upper-case, put the dash back; does not judge validity |
| `isValidReference`                 | string -> boolean                                        | Exactly `EW-` + 6 alphabet characters                        |
| `priceOrder(offer)`                | -> `Result<{ amountCents, needsStaffCheck }>`            | Errors `inactive_offer`, `invalid_price`                     |
| `approve(order, email, now)`       | -> `Result<{ order, effect: 'create_grant' \| 'none' }>` | Error `rejected`                                             |
| `reject(order, email, now, note?)` | -> `Result<{ order }>`                                   | Error `already_approved`                                     |
| `grantStartFor(order, approvedAt)` | -> epoch ms                                              | The approval time (Q11)                                      |
| `formatLkr(cents)`                 | integer cents -> string                                  | Throws on negative or non-integer                            |

All results are `{ ok: true, value } | { ok: false, error }`. Times are UTC in storage and
Asia/Colombo on screen. Money is integer LKR cents.

### Reference cases

Mirrored in `tests/unit/orders.reference-mirror.test.ts` until Sathira copies them to
`tests/reference/` (Q10).

| Case | Given                                               | Expected                                                                      |
| ---- | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| R1   | Blueprint standard, LKR 10,000, active              | ok, `amountCents` 1,000,000, no staff check                                   |
| R2   | class-monthly, LKR 2,000, needs staff check         | ok, `amountCents` 200,000, staff check                                        |
| R3   | class-full, LKR 0, needs staff check                | ok, `amountCents` 0, staff check                                              |
| R4   | Offer inactive, price 1,000,000                     | error `inactive_offer`                                                        |
| R5   | Approve a pending order as Amma at time T           | ok; status `approved`, `decidedAt` T, `decidedBy` Amma; effect `create_grant` |
| R6   | Approve the result of R5 again                      | ok; same order unchanged; effect `none` (one grant only)                      |
| R7   | Reject a pending order, then approve it             | approve gives error `rejected`                                                |
| R8   | Approve a pending order, then reject it             | reject gives error `already_approved`                                         |
| R9   | Reject a pending order with a note, reject it again | both ok; second returns the first decision unchanged (time, staff, note)      |
| R10  | Normalise `ew7kq4xm`                                | `EW-7KQ4XM`, and it is valid                                                  |
| R11  | Validate `EW-7KQ4OM` (letter O)                     | invalid                                                                       |

Also hand-checked in ordinary tests: `formatLkr(1_000_000)` is `LKR 10,000`, `200_050` is
`LKR 2,000.50`, `0` is `LKR 0`; a grant starts at the approval time, not the order time.

### Properties

Not built in this step (fast-check arrives with slice 02).

- [ ] `approve` applied any number of times to the same order yields at most one `create_grant` effect (approved: no)
- [ ] `normalizeReference(generateReferenceFrom(src))` equals the generated reference (approved: no)
- [ ] Every generated reference passes `isValidReference` (approved: no)
- [ ] `normalizeReference` is idempotent (approved: no)
- [ ] A decided order (`approved` or `rejected`) never changes status through `approve` or `reject` (approved: no)
- [ ] `formatLkr` of a whole-rupee amount has no decimal point (approved: no)

### Out of scope

- Writing to D1, audit rows, and the grant itself (step 2 below).
- Retrying on a reference collision, and the order form, API and admin screens (slices 13, 09).
- Expiry or buyer cancel (Q18). Revoking an approved order (a grant action, slice 02).

### How it is checked

- Tests: `tests/unit/orders.reference-mirror.test.ts` (cases above) and `tests/unit/orders.test.ts`
  (alphabet, length, bias over a deterministic byte source, formatting, defensive inputs).
- Review failure modes from `docs/review.md`: approval twice must not make two grants; amounts
  are integer cents; the amount never comes from the client.

## Steps

1. **Pure rules.** `src/domain/orders.ts` with the types, reference helpers, pricing, `approve`,
   `reject`, `grantStartFor`, `formatLkr`, and the tests above. Done when `pnpm check` passes.
2. **D1 write path (later).** Approve = one `batch()` of a conditional
   `UPDATE orders SET status='approved', decided_at=?, decided_by=? WHERE id=? AND status='pending'`
   plus `INSERT` of the grant (start from `grantStartFor`) and an `audit_log` row. The
   `UNIQUE(order_id)` on `grants` makes a double submit fail instead of making a second grant;
   when the UPDATE changes no row, re-read the order and answer with `approve()`'s idempotent
   result. Reject is a conditional UPDATE the same way. Done when a Worker test approves twice
   concurrently and finds one grant.
3. **Property tests (later).** Add the properties above once Sathira approves them.

## Decisions

No ADR. Reference format and grant start are defaults in `OPEN-QUESTIONS.md` (Q11, Q16).
