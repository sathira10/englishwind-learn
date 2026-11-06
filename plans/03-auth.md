# Plan 03: student auth

5 November 2026. Baseline: `claude/slice-01-data-model`.

After this slice a student can sign in with a 6-digit code sent to their email (Google too, once
Sathira adds the keys), the API knows who they are, and their account is tied to the `students`
row that holds their orders and grants. No screens yet (slice 06).

## Spec

### Inputs and outputs

| Name                                             | Type and unit                                      | Notes                                                                                                           |
| ------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/email-otp/send-verification-otp` | body `{ email, type: "sign-in" }`                  | Sends a code. Creates the user on first sign-in. Always answers `{success:true}`                                |
| `POST /api/auth/sign-in/email-otp`               | body `{ email, otp }`                              | Checks the code, sets the session cookie                                                                        |
| `GET /api/auth/*` and the rest of Better Auth    | Better Auth's own routes                           | Session, sign-out, and Google (`/sign-in/social`) when enabled                                                  |
| `GET /api/me`                                    | `{ name: string, email: string }` or 401 `{error}` | The signed-in student's own row only                                                                            |
| `requireStudent`                                 | Hono middleware                                    | 401 JSON; 403 `email_not_verified`; 409 `account_conflict`; else `c.var.student = { userId, studentId, email }` |
| `BETTER_AUTH_SECRET`                             | secret, 32+ chars                                  | `.dev.vars` locally, Worker secret elsewhere (Q7). Never in `wrangler.jsonc`                                    |
| `BETTER_AUTH_URL`                                | var, origin                                        | Public. `http://localhost:5173` locally; decides `Secure` on cookies                                            |
| `MAIL_DRIVER`                                    | var, `console` or `cloudflare`                     | `console` refuses to run on a public https host                                                                 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`       | optional secrets                                   | Google is enabled only when both are set (Q5)                                                                   |

Times are epoch milliseconds (UTC). Code lifetime 5 minutes, session lifetime 30 days (refreshed
daily on use).

New tables (migration `0002_`): `users`, `sessions`, `accounts`, `verifications`, `rate_limits`,
Better Auth's core schema with plural names. `students.user_id` is unchanged; it now holds
`users.id` (no foreign key, see ADR 0008).

Rate limits (per client IP, from `cf-connecting-ip`, per endpoint, stored in `rate_limits`):

| Endpoint                           | Limit             | Why                                                                          |
| ---------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `/email-otp/send-verification-otp` | 3 per 10 minutes  | Stops someone using us to flood an inbox                                     |
| `/sign-in/email-otp`               | 10 per 10 minutes | Guessing a 6-digit code; each code also dies after 3 wrong tries             |
| every other auth endpoint          | 60 per minute     | Better Auth's own tighter defaults for sign-in apply where they are stricter |

On top of the per-IP limits, each lower-cased address may be sent **5 codes per hour**, counted in
`rate_limits` under `otp-email:<sha256(email)>` (never the raw address). Why: the per-IP limits
alone let an attacker spread guesses and sends across many IPs. A code has 10^6 values and dies
after 3 wrong tries or 5 minutes, so one address can only be guessed at 3 times per code, and at
most 5 codes an hour means at most 15 guesses an hour whatever the number of IPs (about 1 in
67,000 per hour). The cap is checked before Better Auth's per-IP counter and answers the same 429
whether or not the address has an account. Cost: someone who knows a student's address can use
up their 5 sends and lock them out of codes for up to an hour. Accepted for launch; Amma can
message them on WhatsApp.

### Reference cases

Pending Sathira's copy in `tests/reference/`; the same cases are tests in `tests/unit/auth.test.ts`
and `tests/unit/email.test.ts`.

| Case | Given                                                                 | Expected                                                                    |
| ---- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| A1   | Signed out                                                            | `GET /api/me` 401 `{"error":"unauthorized"}`                                |
| A2   | New email asks for a code, then submits it                            | 200 and a session; `GET /api/me` 200 with that email                        |
| A3   | Wrong code                                                            | 400, no cookie                                                              |
| A4   | `students` row exists for `buyer@x.lk`, user signs in as `BUYER@X.LK` | that row's `user_id` is set; still one row; name kept                       |
| A5   | No row for the email                                                  | a row is created with the lower-cased email and the part before `@` as name |
| A6   | 4 code requests from one IP inside 10 minutes                         | 200, 200, 200, 429                                                          |
| A7   | 11 code checks from one IP inside 10 minutes                          | the 11th is 429                                                             |
| A8   | Console mailer sends to `kasun.perera@gmail.com`                      | log line holds `k***@gmail.com`, not the full address                       |
| A9   | `MAIL_DRIVER=cloudflare`                                              | sending throws "not configured" until Q6                                    |
| A11  | Same address asks for 6 codes from 6 IPs in an hour                   | 5 sent, the 6th is 429; the key holds a hash, not the address               |
| A12  | `x-forwarded-for` changes on every request, `cf-connecting-ip` fixed  | still limited (the header is ignored)                                       |
| A13  | 3 wrong guesses, then the right code                                  | refused (403), no cookie                                                    |
| A14  | User with an unverified email                                         | not linked to any `students` row; `/api/me` 403 `email_not_verified`        |
| A15  | The email's `students` row belongs to another user                    | not taken over; `/api/me` 409 `account_conflict`                            |
| A10  | Session cookie                                                        | `HttpOnly`, `Secure` (on https), `SameSite=Lax`                             |

### Properties

- [ ] Linking is idempotent: any number of sign-ins for one email leave one `students` row and
      never change an existing `user_id` (approved: no)
- [ ] `normalizeEmail` is idempotent and `maskEmail` never contains the local part beyond its
      first character (approved: no)

### Out of scope

- Sign-in screens and the Google button (slice 06). The client library is not used here.
- Sending real email (Q6, slice 10). The Cloudflare mailer is a stub that throws.
- A per-address send limit, CAPTCHA, and sign-in alerts.
- Admin sign-in. Staff use Cloudflare Access plus `staff_roles` (ADR 0004).
- Deleting or merging accounts.

### How it is checked

- Tests: `tests/unit/auth.test.ts` runs the real Hono app and Better Auth over real local D1 in
  workerd, with a mailer that captures the code. `tests/unit/email.test.ts` covers the pure
  helpers. `tests/unit/schema.test.ts` checks the new tables exist.
- Manual (staging, after Q1/Q6/Q7): request a code, receive it, sign in, `GET /api/me`.
- Review failure modes: no email in logs (masked), no secret in `wrangler.jsonc` `vars`, the
  student id comes from the session and never from the request, `/api/me` returns one row.

## Steps

1. **Domain helpers and mailer.** `src/domain/email.ts`, `src/worker/mail/`. Done when the mailer
   tests pass.
2. **Schema and migration.** Auth tables in `schema.ts`, `0002_` generated. Done when the schema
   test sees them.
3. **Auth, linking and routes.** `createAuth`, `linkStudent`, `requireStudent`, `/api/auth/*`,
   `/api/me`, vars and types. Done when the flow tests pass and `pnpm check` is green.

## Decisions

- [ADR 0008](../docs/adr/0008-auth-user-to-student.md): the auth user maps to a student by email.
- Table names are plural (`users`, ...) with Better Auth's `usePlural` option, matching the
  existing tables.
- OTPs are stored hashed. D1 has no interactive transactions, so the Drizzle adapter runs
  without them (its default).
- The auth instance is built per request; background work uses the request's `waitUntil`.
- `GOOGLE_*` are declared in `src/worker/env.d.ts` because `wrangler types` lists only
  `secrets.required`, and Google is optional.
- Staging and production `BETTER_AUTH_URL` / `MAIL_DRIVER` vars are in `wrangler.jsonc` (named
  environments do not inherit vars). The staging host is still `FILL`; rerun `pnpm types:worker`
  once it is set.
