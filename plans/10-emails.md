# Plan 10: Transactional emails

5 November 2026. Baseline: `claude/slice-13-order-form` at `69d4851` (slices 01 to 05, 07, 08, 11, 12, 13, 14).

After this slice a buyer gets an email with the reference, the amount and the bank details as soon
as they place an order, and a student gets an email with the course, the end date and the sign-in
link once their order is approved. The login code email already exists (slice 03).

## Spec

Defaults come from `OPEN-QUESTIONS.md` (Q6, Q19) and ADR 0008. Delivery on real mailboxes is not
checked here: the Cloudflare sender is still off until Q6 is answered.

### Inputs and outputs

| Name                                               | Type and unit                                                      | Notes                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `orderReceivedEmail(data)`                         | `{ name, reference, label, amountCents, bank }` -> content         | `amountCents` is integer LKR cents, shown with `formatLkr`            |
| `accessGrantedEmail(data)`                         | `{ name, courseTitle, endsAt, signInUrl }` -> content              | `endsAt` is UTC epoch ms, shown as an Asia/Colombo date               |
| `orderRejectedEmail(data)`                         | `{ name, reference, reason? }` -> content                          | A reason line only when staff typed one                               |
| content                                            | `{ subject, text, html }`                                          | Subject is one line. HTML escapes all user text. No images, no pixels |
| `Mailer`                                           | `sendLoginCode`, `orderReceived`, `accessGranted`, `orderRejected` | Each takes `(to, data)`. Senders render with the pure templates       |
| `POST /api/orders`                                 | unchanged response                                                 | Sends `orderReceived` after the order is stored, in `waitUntil`       |
| `notifyAccessGranted(env, mailer, orderId, opts?)` | -> `sent`, `queued`, `skipped`, `failed`                           | For slice 09 to call after `approveOrder`. Never throws               |
| Sign-in link                                       | `BETTER_AUTH_URL` + `/sign-in`                                     | Slice 06 builds the screen. Until then the app's home page opens      |

Times are UTC in storage and Asia/Colombo on screen. Money is integer LKR cents.

### Reference cases

Mirrored in `tests/unit/email-templates.test.ts` and `tests/unit/order-emails.test.ts` pending
Sathira's copy in `tests/reference/` (Q10).

| Case | Given                                                             | Expected                                                                               |
| ---- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| E1   | Order received for `EW-7KQ4XM`, 1,000,000 cents                   | Text and HTML hold the reference, `LKR 10,000`, all four bank lines, the transfer note |
| E2   | Name `<script>..</script> & O'Neil`                               | HTML has it escaped; plain text keeps it as typed                                      |
| E3   | Reference with `\r\nBcc: x` in it                                 | Subject has no line break                                                              |
| E4   | Access ends 5 Nov 2029 20:00 UTC                                  | Shows `6 November 2029` (Colombo), the course name and the sign-in link                |
| E5   | Rejected with no reason, a blank reason, or a reason              | No "Note from us" line unless a non-blank reason; reason escaped in HTML               |
| E6   | Any message                                                       | No "book" in any case, no `<img>`, `<script>`, `<link>`, `<iframe>` or `url(`          |
| E7   | POST /api/orders with a capturing mailer                          | `orderReceived` called once with the buyer's email, the new reference, amount, bank    |
| E8   | POST /api/orders when the mailer throws                           | 201, order stored pending; one log line with no address                                |
| E9   | Order approved 12 Nov 2026, then `notifyAccessGranted`            | `accessGranted` to the student with the course, end 12 Nov 2029, sign-in link          |
| E10  | `notifyAccessGranted` on a pending order, and on a failing mailer | `skipped` with nothing sent; `failed` and logged, never thrown                         |

### Properties

- [ ] For any name, label or course title, no `<` or `>` from it reaches the HTML unescaped (approved: no)

### Out of scope

- The Cloudflare Email Service call itself, SPF, DKIM and the sender domain (Q6).
- Calling `notifyAccessGranted` from the admin approve route (slice 09 does it; this slice must
  not touch admin routes).
- Emailing on reject at launch (Q19: Amma messages on WhatsApp). The template and Mailer method
  exist so a later change needs no new plumbing.
- Reminder emails, receipts, Sinhala text, a mail queue or retries.

### How it is checked

- Tests: template fields and one inline snapshot; escaping; the order API with a capturing
  mailer and a throwing one; `notifyAccessGranted` over real D1; console mailer masks the
  address; Cloudflare stub behaves like `sendLoginCode`.
- Manual (after Q6): place a test order and approve it, then check Gmail, Yahoo and the providers
  students use, in inbox and spam, on a phone.
- Failure modes from `docs/review.md`: personal data in logs (the failure log has the message
  name and error type only), a failed side effect undoing the main action, HTML injection.

## Steps

1. **Templates.** Pure functions and tests in `src/domain/email-templates.ts`. Done when E1 to E6 pass.
2. **Mailer and order wiring.** Extend `Mailer`, console and Cloudflare senders, send
   `orderReceived` from `POST /api/orders` in `waitUntil`, and add `notifyAccessGranted`. Done
   when E7 to E10 pass.

## Decisions

No ADR: the Mailer interface and `waitUntil` pattern come from ADR 0008 and slice 03. The sender
address and domain stay under Q6.
