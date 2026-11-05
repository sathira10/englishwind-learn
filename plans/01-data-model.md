# Plan 01: data model

5 November 2026. Baseline: `claude/slice-00-launch-roadmap` at `80346f9`.

After this slice the database has every table the launch needs, and the Blueprint course and its
three offers are already in it, so later slices build on a real schema instead of guessing.

## Spec

### Inputs and outputs

The output is the schema in `src/db/schema.ts`, the generated migration
`src/db/migrations/0000_opposite_kate_bishop.sql`, and a hand-written seed migration
`0001_seed_blueprint.sql`. No routes, no screens.

Conventions: ids are text primary keys (`crypto.randomUUID()`) except where a slug is stated;
times are integer epoch milliseconds (UTC) in `*_at` columns; money is integer LKR cents;
enums are CHECK constraints; booleans are `integer` 0/1. D1 enforces foreign keys by default.

| Table                 | Columns (type and unit)                                                                                                                                                                                                                                              | Constraints and indexes                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `students`            | id, email (lower-case), name, phone null, user_id null, created_at                                                                                                                                                                                                   | email unique; user_id unique; no FK on user_id until the auth table exists (slice 03)                  |
| `courses`             | id (slug), title, access_years int, created_at                                                                                                                                                                                                                       |                                                                                                        |
| `course_publications` | id, course_id FK, version int, content_json text, published_at, published_by                                                                                                                                                                                         | unique (course_id, version)                                                                            |
| `resources`           | id, course_id FK, lesson_key, kind, label, r2_key, content_type, bytes int, created_at                                                                                                                                                                               | r2_key unique (never leaves the server); kind in ('worksheet'); index (course_id, lesson_key)          |
| `offers`              | id (slug), course_id FK, label, price_cents int, needs_staff_check bool, active bool, created_at                                                                                                                                                                     | price_cents >= 0                                                                                       |
| `orders`              | id, reference, student_id FK null, buyer_email, buyer_name, buyer_phone, offer_id FK, amount_cents int (copied from the offer at order time), provider (default 'bank_transfer'), provider_ref null, status, created_at, decided_at null, decided_by null, note null | reference unique; status in ('pending','approved','rejected'); index (status, created_at), buyer_email |
| `grants`              | id, student_id FK, course_id FK, order_id FK null, starts_at, ends_at, revoked_at null, revoked_by null, reason null, created_by, created_at                                                                                                                         | order_id unique (database half of approve-once); index (student_id, course_id)                         |
| `lesson_progress`     | student_id FK, course_id FK, lesson_key, completed_at null, last_visited_at null                                                                                                                                                                                     | primary key (student_id, course_id, lesson_key)                                                        |
| `staff_roles`         | email (lower-case, primary key), role, created_at                                                                                                                                                                                                                    | role in ('owner','admin')                                                                              |
| `audit_log`           | id, at, actor_email, action, entity_type, entity_id, data_json null                                                                                                                                                                                                  | index (entity_type, entity_id); index (at)                                                             |

Seed (`0001_seed_blueprint.sql`, a separate hand-written migration so staging and production get
it too). The prices are facts from the EnglishWind Launch Plan (27 Oct):

| Offer id                  | Price (LKR) | `price_cents` | `needs_staff_check` |
| ------------------------- | ----------- | ------------- | ------------------- |
| `blueprint`               | 10,000      | 1,000,000     | no                  |
| `blueprint-class-monthly` | 2,000       | 200,000       | yes                 |
| `blueprint-class-full`    | 0           | 0             | yes                 |

The course `blueprint` has `access_years` 3. Not in this slice: `rate_limits` (slice 03 owns it).

### Reference cases

Hand-checked values. They are also normal tests in `tests/unit/schema.test.ts`, pending
Sathira's copy in `tests/reference/` (Q10).

| Case | Given                                  | Expected                                    |
| ---- | -------------------------------------- | ------------------------------------------- |
| R1   | Fresh database after all migrations    | `blueprint` course with access_years 3      |
| R2   | Same                                   | Offers priced 1,000,000 / 200,000 / 0 cents |
| R3   | Insert an offer with price_cents = -1  | Rejected by CHECK                           |
| R4   | Insert an order with status 'refunded' | Rejected by CHECK                           |
| R5   | Two grants with the same order_id      | Second rejected by UNIQUE                   |

### Properties

- [ ] Every grant row has at most one order, and every order at most one grant (approved: no)
- [ ] No row can hold a negative price or amount (approved: no)

### Out of scope

Any code that reads or writes these tables (later slices), Better Auth tables, `rate_limits`,
the staff seed (Q4, slice 08), and the 5 existing buyers (slice 12).

### How it is checked

- Tests: `tests/unit/schema.test.ts` against real local D1 in workerd: tables exist, seed values,
  CHECK and UNIQUE constraints, foreign keys on, manual grants (NULL order) allowed.
- Manual: `pnpm db:migrate:local` once to see it apply; on staging after Q1.
- Review failure modes: approve-twice (the unique index), money as integer cents.

## Steps

1. **Schema, migration, seed, tests.** One PR: `schema.ts`, generated SQL, seed SQL, tests. Done
   when `pnpm check` passes and the migration applies from empty.

## Decisions

- `orders.amount_cents` also has a `>= 0` CHECK (not in the brief; same rule as offers).
- `lesson_progress`, `grants`, `orders` use foreign keys with the default NO ACTION, so a student
  with history cannot be hard-deleted by accident.
- Seed `created_at` is fixed at 2026-11-05T00:00:00Z (1793836800000) so the migration is
  deterministic.
- The seed is a drizzle custom migration (`drizzle-kit generate --custom --name=seed_blueprint`),
  so it is in `meta/_journal.json` and the next generated migration is numbered `0002_`. Write
  later hand-written SQL the same way.
