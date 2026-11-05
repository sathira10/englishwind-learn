# Testing

Three layers, from most trusted to least.

| Layer | Where | Who writes it | Runs |
| --- | --- | --- | --- |
| Reference cases | `tests/reference/` | Sathira writes or approves each case by hand | `pnpm test` |
| Property tests | next to the code they test, `*.property.test.ts` | Agent proposes, Sathira approves each property | `pnpm test` |
| Unit and Worker tests | `tests/unit/`, or next to the code | Anyone | `pnpm test` |
| Mutation testing | `src/domain/` only | Tool | weekly in CI, from slice 02 |
| Browser smoke | `tests/e2e/` | Anyone | `pnpm test:e2e`, CI |

## Reference cases are out of agents' reach

Agents change tests to make them pass. The reference cases are the answers, so agents can't
edit them:

- `.claude/settings.json` denies Claude's file tools in `tests/reference/`.
- `scripts/check-reference.mjs` refuses a commit that touches `tests/reference/` unless its
  message has a `Reference-Approved: Sathira` trailer. The `commit-msg` hook runs it locally,
  and CI runs it on every pushed commit.

That stops accidents and Claude's own edit tools. It can't stop an agent that uses the shell and
writes the trailer itself, so only add the trailer yourself, and add CODEOWNERS for
`tests/reference/` once the repo has a GitHub remote. See ADR 0006.

If an agent thinks a reference case is wrong, it stops and says so. It does not change the case
or the code around it to get past it.

## Worker tests

Vitest runs inside `workerd` through `@cloudflare/vitest-pool-workers`, so D1 and R2 in tests
are real local bindings, not mocks. Migrations from `src/db/migrations/` are applied before the
tests run.

## Mutation testing

Added with slice 02 (grant rules): Stryker over `src/domain/`, run weekly and before launch. A
surviving mutant means a test passes whatever that code does; fix the test, not the threshold.
