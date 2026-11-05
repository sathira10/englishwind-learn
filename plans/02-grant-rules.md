# Plan 02: grant rules

5 November 2026. Baseline: `claude/slice-00-launch-roadmap` (plan 00 and the roadmap).

After this slice the app has one tested answer to "may this student watch lessons right now, and
until when": three years of access from the start date, extend, revoke. Nothing calls it yet
(slice 01 holds the table, slice 05 the routes).

## Spec

### Inputs and outputs

All code is in `src/domain/grants.ts`: pure functions, no I/O, no imports from `db/`, `worker/`
or `client/`. Times are integer epoch milliseconds (UTC). Asia/Colombo is a fixed UTC+05:30 with
no daylight saving, so calendar arithmetic runs on the instant shifted by 5h30.

| Name                         | Type and unit                                                         | Notes                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Grant`                      | `{ startsAt: number; endsAt: number; revokedAt: number \| null }`, ms | Matches the `grants` columns slice 01 adds, without importing them.                                                                                                                              |
| `accessEnd(startsAt, years)` | `(ms, positive integer) => ms`                                        | Same Colombo wall-clock time `years` calendar years later. 29 Feb in a non-leap end year gives 1 March (Q12). Throws `RangeError` for non-positive or non-integer years, or a non-integer start. |
| `newGrant(startsAt, years)`  | `=> { startsAt, endsAt }`                                             | `endsAt = accessEnd(startsAt, years)`. Launch uses 3 years from approval (Q11).                                                                                                                  |
| `isCurrent(grant, now)`      | `=> boolean`                                                          | `startsAt <= now < endsAt` and (`revokedAt === null` or `now < revokedAt`). The end instant is over.                                                                                             |
| `hasAccess(grants, now)`     | `=> boolean`                                                          | Any grant is current.                                                                                                                                                                            |
| `extend(grant, years, now)`  | `=> { ok: true, value: Grant } \| { ok: false, error }`               | New end = `accessEnd(max(endsAt, now), years)` (Q13). Errors: `revoked`, `invalid-years`, `invalid-time`. A revoked grant is never extended.                                                     |
| `revoke(grant, now)`         | `=> Grant`                                                            | Sets `revokedAt = now`. Already revoked: returned unchanged, so the first time is kept.                                                                                                          |
| `colomboDate(instant)`       | `ms => 'YYYY-MM-DD'`                                                  | The Colombo calendar date, for display and tests.                                                                                                                                                |

Times are UTC in storage and Asia/Colombo on screen. Access periods are calendar years, never 365
days or months.

### Reference cases

Hand-worked. Colombo is UTC+05:30, so Colombo time minus 5h30 is UTC. Implemented as
`tests/unit/grants.reference-mirror.test.ts` until Sathira approves them and copies them to
`tests/reference/` (Q10).

| Case | Given                                                                  | Expected                                                                        |
| ---- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| R1   | Start 2026-11-16 10:00 Colombo (04:30Z), 3 years                       | End 2029-11-16 10:00 Colombo (2029-11-16 04:30Z)                                |
| R2   | Start 2028-02-29 10:00 Colombo (04:30Z), 3 years (2031 is not leap)    | End 2031-03-01 10:00 Colombo (2031-03-01 04:30Z)                                |
| R3   | Start 2026-12-31 23:30 Colombo (2026-12-31 18:00Z), 3 years            | End 2029-12-31 23:30 Colombo (2029-12-31 18:00Z)                                |
| R4   | Start 2026-01-01 02:00 Colombo (2025-12-31 20:30Z), 3 years            | End 2029-01-01 02:00 Colombo (2028-12-31 20:30Z): UTC date differs from Colombo |
| R5   | Start 2028-02-29 10:00 Colombo, 4 years (2032 is leap)                 | End 2032-02-29 10:00 Colombo                                                    |
| R6   | Start 2024-02-29 00:00 Colombo (2024-02-28 18:30Z), 1 year             | End 2025-03-01 00:00 Colombo (2025-02-28 18:30Z)                                |
| R7   | Grant 2026-11-16 10:00 to 2029-11-16 10:00 Colombo                     | Not current 1 ms before start; current at start; current 1 ms before end        |
| R8   | Same grant, now = 2029-11-16 10:00 Colombo exactly                     | Not current                                                                     |
| R9   | Same grant, revoked at 2027-06-01 12:00 Colombo                        | Current at 11:59:59 that day; not current at 12:00:00; not current later        |
| R10  | Same grant, `extend` 1 year at 2028-01-10 12:00 Colombo (before end)   | End 2030-11-16 10:00 Colombo                                                    |
| R11  | Same grant, `extend` 1 year at 2030-03-05 15:00 Colombo (after end)    | End 2031-03-05 15:00 Colombo                                                    |
| R12  | Revoked grant, `extend` 1 year (before or after its end)               | `{ ok: false, error: 'revoked' }`                                               |
| R13  | Revoke at 2027-06-01 12:00, then again at 2027-09-01 12:00 Colombo     | `revokedAt` stays 2027-06-01 12:00 Colombo                                      |
| R14  | `hasAccess` with no grants; one ended grant; one ended and one current | false; false; true                                                              |
| R15  | `newGrant(2026-11-16 10:00 Colombo, 3)`                                | `{ startsAt, endsAt: 2029-11-16 10:00 Colombo }`                                |
| R16  | Years 0, -1, 1.5, NaN, Infinity                                        | `accessEnd` throws `RangeError`; `extend` returns `invalid-years`               |
| R17  | `colomboDate` of 2026-12-31 18:00Z and 2026-12-31 18:30Z               | `2026-12-31` and `2027-01-01`                                                   |

### Properties

Proposed by the agent, running as tests in `src/domain/grants.property.test.ts` with fast-check
(instants between 2000 and 2100, 1 to 10 years). Sathira approves each before it counts as a
rule.

- [ ] P1: `accessEnd(s, y) > s` (approved: no)
- [ ] P2: access length is at least `y * 365` days and at most `y * 366 + 1` days (approved: no)
- [ ] P3: `isCurrent` is false for every `now >= endsAt` (approved: no)
- [ ] P4: `extend` never shortens the grant, and its new end is `accessEnd(max(endsAt, now), y)` (approved: no)
- [ ] P5: `revoke` is idempotent and keeps the first `revokedAt` (approved: no)
- [ ] P6: a revoked grant is never current at or after `revokedAt` (approved: no)
- [ ] P7: a revoked grant can never be extended (approved: no)

### Out of scope

- The `grants` table and queries (slice 01), the routes that check grants (slice 05), the
  extend and revoke screens (slice 09).
- Who gets a grant and what the start date is for each order (slice 07 and Q11): this slice takes
  the start as an input.
- Several overlapping grants being merged into one end date: `hasAccess` only asks if any is
  current.

### How it is checked

- Tests: reference mirror cases and unit edge cases in `tests/unit/` and `src/domain/`; property
  tests next to the code. All run in `pnpm test` under the Workers pool.
- Mutation testing: Stryker over `src/domain/` (`pnpm mutation`, weekly in
  `.github/workflows/mutation.yml`, not in `pnpm check`). It uses `vitest.domain.config.ts`
  (plain Node, only the domain tests) because Stryker's runner can't drive the Workers pool.
  A surviving mutant means a test is missing; fix the test, not the threshold.
- Failure modes from `docs/review.md`: dates and access periods without a timezone or with
  months instead of the 3-year rule (this slice is the answer to that one).

## Steps

1. **Rules and tests.** `src/domain/grants.ts`, the reference mirror tests, edge-case tests and the
   proposed property tests. Done when `pnpm check` passes.
2. **Mutation testing.** `fast-check`, `@stryker-mutator/core` and `@stryker-mutator/vitest-runner`
   as dev dependencies (approved in plan 00), `stryker.config.json`, `vitest.domain.config.ts`,
   `pnpm mutation`, the weekly workflow. Done when `pnpm mutation` runs and survivors are
   explained or killed.

## Result

First local run (5 Nov, Stryker 10.1.1, Vitest 5.1): the first version scored 78.76% (15
survivors, 9 uncovered). All the leap-year survivors pointed at one thing: my own `isLeapYear`
branch was dead code, because `Date.UTC` already rolls 29 February of a non-leap year to 1 March.
I deleted the branch (R2, R5 and R6 pin the behaviour) and added edge-case tests for the input
checks. Final score: **100%** (86 killed, 1 timeout, 0 survived, 0 uncovered) over `grants.ts`.

## Decisions

No ADR. Defaults taken from OPEN-QUESTIONS: Q12 (29 Feb ends 1 March), Q13 (extend from the later
of end and now), and Q11 is the caller's concern (the start is an input). `isCurrent` treats a
revocation as taking effect at `revokedAt`, so a grant revoked in the future is still current
until then; slice 09 revokes with "now", so this only matters for backdated or scheduled values.
