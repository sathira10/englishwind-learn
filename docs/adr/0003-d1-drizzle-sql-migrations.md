# 0003: D1 through Drizzle, plain SQL migrations

6 November 2026. Accepted.

## Context

The data is small and relational: students, orders, grants, progress. D1 is in the same
account and close to the Worker.

## Decision

Drizzle defines the schema in `src/db/schema.ts`. `drizzle-kit generate` writes SQL migrations
to `src/db/migrations/`, and `wrangler d1 migrations apply` runs them. The SQL files are
reviewed like code and never edited once applied.

## Consequences

- D1 has no interactive transactions. Anything that must be all-or-nothing goes in one
  `batch()`, and approval flows are written to be safe to run twice.
- Each migration must work with the code already deployed, because migrations run first.
