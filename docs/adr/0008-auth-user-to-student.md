# 0008: The auth user maps to a student by email

5 November 2026. Accepted.

## Context

Better Auth owns `users`. The rest of the app (orders, grants, progress) hangs off `students`.
Orders can be placed before anyone signs in (ADR 0007), and the 5 existing buyers are imported as
`students` rows (slice 12). Those people must land on their purchases the first time they sign in.

## Decision

- `students` stays the app's record of a person; `users` is only the login. `students.user_id`
  holds `users.id`. Nothing else in the app refers to `users`.
- When Better Auth creates a user (`databaseHooks.user.create.after`), `linkStudent` upserts one
  `students` row on the lower-cased email: it sets `user_id` on an existing row, or inserts a new
  one. It is a single statement, so a race cannot create two rows. A row that already has a
  `user_id` is never taken over: the call reports a conflict (as it does when the user is already
  linked to another row, which UNIQUE(user_id) forbids).
- Only a user whose `emailVerified` is true may claim a row. Better Auth's `trustedProviders` is
  not set, so a Google login with an unverified address cannot link either.
- `requireStudent` looks the student up by `user_id` first. Only when there is none (the hook
  missed it) does it call `linkStudent`, answering 403 `email_not_verified` or 409
  `account_conflict` when that refuses.
- There is no foreign key from `students.user_id` to `users.id`. SQLite cannot add one without
  rebuilding `students` while `orders` and `grants` reference it.

## Consequences

- Whoever controls an inbox gets the purchases for that address. This is why the code is
  emailed, and why linking needs a verified email, from the code or from Google.
- A student who changes their email address will have a new `users` row and a new `students`
  row unless staff merge them by hand. There is no self-service email change.
- Code outside the auth layer takes `studentId` from `c.var.student`, never from the request.
