# Plan 12: buyer import

5 November 2026. Baseline: `claude/integration` at `502a800`.

After this slice Amma (or Sathira) can load the 5 existing Blueprint buyers from a CSV with one
command: each gets a student row and a 3-year grant from their original purchase date, and signs
in later with the same email.

## Spec

### Inputs and outputs

Pure code in `src/domain/buyer-import.ts` (no I/O); `scripts/import-buyers.mjs` reads the file and
runs the SQL: `pnpm buyers:import <csv> --env local|staging|production [--dry-run]`.

| Name                              | Type and unit                                                   | Notes                                                                                                                                                         |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSV columns                       | `email`, `name`, `phone?`, `purchased_on`, `note?`              | Header row names them, any order. `purchased_on` is a Colombo calendar date `YYYY-MM-DD` (Q22: a row without one is refused).                                 |
| `parseBuyersCsv(text)`            | `=> { rows, errors }`                                           | Emails through `normalizeEmail`. Errors carry the 1-based file line. Duplicate email (after normalising), bad email, empty name, bad or empty date.           |
| `colomboMidnight(date)`           | `'YYYY-MM-DD' => epoch ms \| null`                              | Start of that Colombo day (UTC+05:30). `null` for a non-date such as 2026-02-30.                                                                              |
| `planGrants(rows, opts)`          | `opts = { courseId, accessYears, now }` => `{ grants, errors }` | `startsAt = colomboMidnight`, `endsAt = accessEnd(startsAt, accessYears)` (plan 02, Q12). A date after `now` is an error. `ended` is true if `endsAt <= now`. |
| `importStatements(plan, { now })` | `=> string[]`                                                   | Idempotent SQL, one statement per line (below).                                                                                                               |

Times are UTC epoch ms in storage and Asia/Colombo on screen. The script uses `accessYears = 3`
(the seeded `courses` row) and course `blueprint`.

### Reference cases

Hand-worked, `now` = 2026-11-05 12:00 Colombo. Implemented as `tests/unit/buyer-import.test.ts`
until Sathira copies them to `tests/reference/` (Q10).

| Case | Given                                                        | Expected                                                                               |
| ---- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| B1   | purchased_on 2026-03-14                                      | Start 2026-03-13 18:30Z (Colombo midnight), end 2029-03-13 18:30Z (2029-03-14 Colombo) |
| B2   | 2025-12-31                                                   | Ends 2028-12-31 Colombo                                                                |
| B3   | 2024-02-29 (2027 is not leap)                                | Ends 2027-03-01 Colombo (Q12)                                                          |
| B4   | 2028-02-29 with now before it / after 2028-03-01             | Error "in the future" / ends 2031-03-01 Colombo                                        |
| B5   | 2026-01-01                                                   | Start 2025-12-31 18:30Z: the UTC date differs from Colombo                             |
| B6   | 2023-11-05 at now 2026-11-05 00:00 / 23:59:59 the day before | `ended` true (the end instant is over) / false; 2020-01-15 ended, 2023-11-06 not       |
| B7   | `a@example.org` on line 2 and `A@Example.ORG` on line 4      | One row kept; error on line 4, "duplicate email, first seen on line 2"                 |
| B8   | dates 2026-02-30, 2026-13-01, 14/03/2026, empty, 2026-3-4    | One error each with its own line number; no rows                                       |
| B9   | purchased_on 2026-11-06 / 2026-11-05                         | Error "in the future" / accepted                                                       |
| B10  | `tests/fixtures/buyers-sample.csv` (5 fake buyers)           | 5 rows, no errors, ends 2029-03-14, 2028-12-31, 2027-03-01, 2029-10-01, 2029-01-01     |

### Properties

- [ ] P1: running `importStatements` twice (or later, with another clock) leaves every row in
      `students`, `grants` and `audit_log` as it was after the first run (approved: no)
- [ ] P2: a student who already has any grant for the course gets no second one (approved: no)
- [ ] P3: an existing `students` row is never changed by the import (approved: no)

Checked as tests on real local D1, not with fast-check.

### Out of scope

- Orders: no history of the original payments is created (see Decisions).
- Emailing the buyers (slice 10 and Amma's WhatsApp message); revoking or extending (slice 09).
- Lesson progress from the old app, if any.

### How it is checked

- Unit tests of the parser and planner (B1 to B10 and edge cases); the generated SQL run once,
  twice and a third time with a later clock on local D1 in the Workers pool.
- Imported student links on first verified sign-in: `linkStudent` test (slice 03 / ADR 0008), the
  row is found by lower-case email, `user_id` is set, name and grant are kept.
- Manual: `pnpm buyers:import tests/fixtures/buyers-sample.csv --env local` twice, then count rows
  (5 students, 5 grants, 5 audit rows both times). Done once in this slice.
- Failure modes from `docs/review.md`: access periods and timezones (Colombo midnight, 29 Feb),
  a grant for someone with no right to it (no grant when one exists).

## Steps

1. **Parser, planner and SQL.** `src/domain/buyer-import.ts`, tests, sample CSV. Done when
   `pnpm check` passes.
2. **Script and docs.** `scripts/import-buyers.mjs`, `pnpm buyers:import`, section in
   `docs/deploying.md`. Done when a local run twice leaves the same rows.
3. **On staging, then production (Sathira / Amma, 12-14 Nov).** Real CSV from Amma (Q22), a dry
   run, import, then a sign-in test by each buyer.

## Decisions

- **No historical orders.** `grants.order_id` is nullable (NULL means a manual grant, plan 01), so
  the import creates no `orders` row. An order needs a reference, an offer, an amount and a phone
  that we do not have for old purchases, and would show in Amma's queue and sales reports. The
  grant is marked by `created_by = 'import'` and `reason = 'Imported buyer. <note>'`. Cost: the
  admin shows these buyers without an order; Amma can attach one later (slice 09).
- **An existing student row is left as it is** (`ON CONFLICT(email) DO NOTHING`): a buyer who
  already signed in keeps their own name.
- **"Has any grant for the course" means skip**, including revoked or ended ones, so a re-run never
  restores access staff removed. Idempotence of the audit row is by `grant.import` per grant id.
- **An ended grant is still imported but flagged** by the script (warning on stderr); a purchase
  date in the future is refused.
- `accessYears` is fixed at 3 in the script, matching the seeded course row. Q22 already covers the
  CSV; the template is `tests/fixtures/buyers-sample.csv` (fake example.org data).
