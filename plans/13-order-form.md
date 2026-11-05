# Plan 13: Order form and order API

5 November 2026. Baseline: `claude/integration` at `502a800` (slices 01, 02, 03, 04, 07, 08, 11, 14).

After this slice a buyer opens `/order/blueprint` without signing in, places a bank-transfer
order, and sees the amount, the reference to put in the transfer note, and the bank details. The
order is a pending row in D1. The D1 write path that Amma's approval will use is built and tested
here (plan 07 step 2) but has no screen until slice 09.

## Spec

Defaults come from `OPEN-QUESTIONS.md` (Q11, Q14, Q15, Q16, Q18, Q19) and ADR 0007.

### Inputs and outputs

| Name                          | Type and unit                                       | Notes                                                                 |
| ----------------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| `POST /api/orders` body       | JSON `{ offer, name, email, phone }`                | `offer` is the offer slug (`offers.id`). Unknown keys are dropped     |
| `name`                        | string, trimmed, 1 to 100 characters                |                                                                       |
| `email`                       | string, trimmed and lower-cased, valid address      | At most 254 characters                                                |
| `phone`                       | string, trimmed, 7 to 20 of `+ 0-9 ( ) -` and space | The buyer's WhatsApp number (Q15)                                     |
| `POST /api/orders` 201        | `{ reference, amountCents, label, bank }`           | `amountCents` is integer LKR cents, read from the `offers` row        |
| `GET /api/offers/:slug` 200   | `{ slug, label, priceCents }`                       | Active offers only                                                    |
| Errors                        | `{ error }`, plus `fields` for 422                  | 400 bad JSON, 403 origin, 404 offer, 415 type, 422, 429               |
| Bank details                  | `src/shared/bank.ts`                                | Bank of Ceylon, Galle Fort; 0081406387; T.M.J. Tennakoon              |
| Rate limit                    | rows in `rate_limits`                               | 10 per IP per hour; 5 per email per hour. Keys hold hashes only       |
| `createPendingOrder`          | -> `Result<{ order }>`                              | Price from `priceOrder`; reference retried on a unique collision      |
| `approveOrder(id, staff, o?)` | -> `Result<{ order, granted }>`                     | One `batch()`; errors `not_found`, `rejected`, `staff_check_required` |
| `rejectOrder(id, staff, why)` | -> `Result<{ order }>`                              | One `batch()`; errors `not_found`, `already_approved`                 |

Times are UTC epoch ms in storage and Asia/Colombo on screen. Money is integer LKR cents. A client
amount in the body is ignored (Zod drops it).

### Reference cases

Mirrored in `tests/unit/orders-repo.test.ts` and `tests/unit/orders-api.test.ts` pending
Sathira's copy in `tests/reference/` (Q10).

| Case | Given                                                      | Expected                                                                         |
| ---- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| R1   | POST for `blueprint` with body `amountCents: 1`            | 201, `amountCents` 1,000,000, D1 row pending with that amount and reference      |
| R2   | POST for `nope`                                            | 404, no row                                                                      |
| R3   | POST with a bad email and empty name                       | 422 naming both fields                                                           |
| R4   | Eleven POSTs from one IP in an hour                        | the eleventh is 429                                                              |
| R5   | Approve a pending order twice, in turn and concurrently    | exactly one grant; one `order.approve` audit row; grant ends 3 years after start |
| R6   | Approve a `needs_staff_check` order without `staffChecked` | error `staff_check_required`, order still pending                                |
| R7   | Reject, then approve                                       | approve gives `rejected`; no grant                                               |
| R8   | Reference collides on the first try                        | a second reference is drawn and the order is stored                              |

### Properties

- [ ] Whatever the body says, the stored amount equals the offer's price (approved: no)
- [ ] However many times approve runs, an order has at most one grant (approved: no)

### Out of scope

- Admin screens and routes that call approve and reject (slice 09).
- Emailing the buyer (Q19: no email on reject; the access email comes with slice 09).
- Attaching the order to an account on sign-in beyond matching the email (slice 03).
- Card payments (ADR 0005).

### How it is checked

- Tests: real D1 in workerd for the repository and the API.
- Manual: `/order/blueprint` on a phone, then the row in D1.
- Failure modes from `docs/review.md`: approve twice, amount from the client, no audit row,
  personal data in logs (none are logged), bank details typed into a component.

## Steps

1. **D1 orders repository.** `src/worker/orders/` with create, approve, reject, and tests.
   This is also plan 07 step 2. Done when a double approve finds one grant.
2. **Public API.** `POST /api/orders`, `GET /api/offers/:slug`, bank details module, rate limits.
3. **Order page (built).** `/order/:offer`: form, then confirmation.

## Decisions

No ADR; ADR 0007 covers where the form lives. Offer slugs in the URL are `offers.id`, so the
class links are `/order/blueprint-class-monthly` and `/order/blueprint-class-full`, not the single
`/order/blueprint-class` that Q14 sketches.
