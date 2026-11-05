# Agent guide

Conventions for any coding agent or person working in this repo. Add a rule under "Pitfalls"
only after the same mistake has happened twice. If a rule can be a script, hook or CI check,
make it one instead.

## What this repo is

The EnglishWind learning app at learn.englishwind.lk: the student app, the family admin
(`/admin`) and the API, served by one Cloudflare Worker. The public site is the separate
`englishwind-web` repo. The plan it follows is the EnglishWind Launch Plan; `plans/roadmap.md`
holds the order of work.

## How work is done

Every change goes through [docs/workflow.md](docs/workflow.md): spec, plan, one small diff,
`pnpm check`, a review in a fresh context, merge. Specs and plans are in [plans/](plans/README.md),
and structural decisions are in [docs/adr/](docs/adr). Read the plan for the slice before
editing, and update it when scope changes.

## Boundaries

- Never edit `tests/reference/`. Those cases are checked by hand. If one looks wrong, stop and
  say so. See [docs/testing.md](docs/testing.md).
- Every request for a lesson, Vimeo ID or worksheet checks for a current grant on the server.
  Worksheets come only from private R2, streamed by the Worker.
- `/admin` trusts no header it hasn't verified: the Access JWT, then the role in `staff_roles`.
- Pure logic goes in `src/domain/` with tests before any route or screen uses it.
- Review against [docs/review.md](docs/review.md) before calling a change done.

## Stack

pnpm only, TypeScript strict, React 19 + React Router, Tailwind v4 configured in CSS, Hono +
Zod, D1 through Drizzle with SQL migrations, Vitest + Playwright. No new dependency without
asking. Design rules: [design-system/README.md](design-system/README.md); semantic tokens only,
`fg-*` for text colour, light theme only.

## Commits

Conventional commits, short imperative lower-case subject, one logical change each. A commit an
agent wrote ends with an `Agent: yes` trailer ([docs/metrics.md](docs/metrics.md)).

## Commands

See `scripts` in `package.json`. `pnpm check` is the gate and must pass before every commit.

## Pitfalls

<!-- Added when a mistake repeats. -->
