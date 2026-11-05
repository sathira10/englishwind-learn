# Plan 09: admin screens

5 November 2026. Baseline: `claude/slice-13-order-form` (integration plus the order repository).

After this slice Amma opens `/admin` on her phone, sees the pending transfers, approves one, and the
student has access without anyone else touching anything. She can also add an order for a phone or
WhatsApp buyer, find a student, grant, extend or revoke access, attach an order to a student, and
read the audit log.

## Spec

Defaults come from `OPEN-QUESTIONS.md` Q18 (no buyer cancel or expiry; the queue shows age), Q19
(optional free-text reject reason, no email on reject), Q20 (English only), Q13 (extend from the
later of end and now) and plan 08's CSRF note.

### Inputs and outputs

All routes are under `/api/admin`, behind `requireStaff` (owner or admin). Errors are
`{ error, fields? }`. Times are UTC epoch ms in the API and Asia/Colombo on screen. Money is integer
LKR cents.

| Route                         | Body or query                                             | Result and errors                                                                |
| ----------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /orders?status=`         | `pending` (default), `approved`, `rejected`               | `{ orders }`, oldest first for pending, newest first otherwise, at most 100      |
| `POST /orders/:id/approve`    | `{ staffChecked?: boolean }`                              | `{ order, granted }`; 404 `not_found`; 409 `rejected`, `staff_check_required`    |
| `POST /orders/:id/reject`     | `{ reason?: string (max 500) }`                           | `{ order }`; 404; 409 `already_approved`                                         |
| `POST /orders`                | `{ offer, name, email, phone }`                           | 201 `{ order }`; 404 `offer_not_found`; 422. Same field rules as plan 13         |
| `POST /orders/:id/attach`     | `{ studentId }`                                           | `{ order }`; 404 `not_found` or `student_not_found`; 409 `not_pending`           |
| `GET /students?q=`            | 2 to 100 characters                                       | `{ students }` (at most 25) matching email, name or phone, case-insensitive      |
| `GET /students/:id`           | -                                                         | `{ student, grants, orders, progress }`; 404                                     |
| `POST /students/:id/grants`   | `{ courseId, years? }`                                    | 201 `{ grant }`; 404; 409 `already_has_access`. `years` defaults to the course's |
| `POST /grants/:id/extend`     | `{ years: integer 1 to 10 }`                              | `{ grant }`; 404; 409 `revoked`, `conflict`                                      |
| `POST /grants/:id/revoke`     | `{ reason: string 1 to 500 }`                             | `{ grant }`; 404. Revoking again keeps the first time and reason                 |
| `GET /audit?before=&limit=`   | `before` is an opaque cursor; limit 1 to 100 (default 50) | `{ entries, next }`, newest first; `next` is null on the last page               |
| `GET /offers`, `GET /courses` | -                                                         | Active offers and courses, for the forms                                         |

CSRF: the `CF_Authorization` cookie authenticates cross-site requests, so every POST, PUT, PATCH and
DELETE requires `Content-Type: application/json` (415 otherwise) and an `Origin` header equal to the
request's own origin (403 if missing or different). Both checks run after `requireStaff`, so a
non-staff caller always gets 401 or 403 first.

Every mutation is one `db.batch()` that ends in its audit statement. Audit actions: `order.approve`,
`order.reject`, `order.create_manual`, `order.attach`, `grant.create`, `grant.extend`,
`grant.revoke`. `staffChecked` is honoured only as the literal `true` in an explicit field.

### Reference cases

Also normal tests in `tests/unit/admin-routes.test.ts`, pending Sathira's copy in
`tests/reference/` (Q10).

| Case | Given                                                                 | Expected                                                                                   |
| ---- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| R1   | Any admin route, no token; or a verified email with no staff row      | 401; 403. No student or order data in the body                                             |
| R2   | A POST with `text/plain`; a POST with no Origin or another Origin     | 415; 403. Nothing written                                                                  |
| R3   | Approve a pending order, then again                                   | One grant ending 3 years after the start, one `order.approve` row; 2nd is `granted: false` |
| R4   | Approve a `needs_staff_check` order without, then with `staffChecked` | 409 `staff_check_required`, still pending; then approved                                   |
| R5   | Grant ends 2026-12-01; extend 1 year at 2026-11-05                    | Ends 2027-12-01, one `grant.extend` row                                                    |
| R6   | Extend a revoked grant                                                | 409 `revoked`, unchanged                                                                   |
| R7   | Revoke twice with different reasons                                   | `revokedAt` and reason of the first; one `grant.revoke` row                                |
| R8   | Grant a course the student already has a current grant for            | 409 `already_has_access`, no row                                                           |
| R9   | Attach a pending order to a student with another email, then approve  | The grant belongs to that student; no extra student row                                    |
| R10  | Manual order for a phone buyer                                        | Pending order at the offer's price with a reference and a `order.create_manual` row        |
| R11  | Search `%` or `_`                                                     | Matches only literal characters                                                            |

### Properties

- [ ] No admin route returns 2xx to a request without a verified staff token (approved: no)
- [ ] An order has at most one grant however approvals and attaches interleave (approved: no)

### Out of scope

Emailing the buyer on approval (slice 10). Moving an approved order's grant to another student.
Editing a student's details. Deleting anything. Per-role rules (owner and admin may do the same).
Sinhala text (Q20).

### How it is checked

- Tests: real D1 for every route (`tests/unit/admin-routes.test.ts`); pure time formatting in
  `src/domain/`.
- Manual (needs Q3 and Q4): on a phone, place a test order at `/order/blueprint`, open `/admin`,
  approve it, sign in as the student and open the course.
- Failure modes from `docs/review.md`: trusting a header, a mutation with no audit row, approving
  twice, several D1 calls where one `batch()` is needed.

## Steps

1. **Admin API.** Routes, CSRF guard, repository, schemas in `src/shared/admin.ts`, tests.
   Done when R1 to R11 pass.
2. **Screens.** Queue, create order, student search and detail, audit log under `/admin`.
   Done when `pnpm check` passes and the pages work at 375px.

## Decisions

- Attach is allowed for pending orders only: once approved, the grant already belongs to a student.
- A manual order is an ordinary pending order (provider `bank_transfer`); the audit row says it was
  entered by staff. Amma still approves it once the transfer arrives.
- `approveOrder` no longer creates a student row for the buyer's email when the order is attached
  to a student.
- No ADR: this implements ADR 0004 and plan 08's CSRF note.
