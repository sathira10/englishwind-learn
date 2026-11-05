# 0002: One Worker serves the SPA and the API

6 November 2026. Accepted.

## Context

The app needs static files with single-page fallback and an API on the same host. The launch
plan puts the learning app, admin and API in one Worker.

## Decision

One Worker with static assets (`not_found_handling: single-page-application`) and
`run_worker_first: ["/api/*"]`. The API is a Hono app; request and response shapes are Zod
schemas in `src/shared/` used by both sides. Development uses `@cloudflare/vite-plugin`, so
`pnpm dev` runs the Worker in `workerd` beside the Vite dev server.

## Consequences

- One origin: no CORS, cookies are first-party.
- Asset requests never run Worker code, so they cost nothing and can't leak protected data.
  Protected files must never be in `public/`.
- The environment is fixed at build time (`CLOUDFLARE_ENV`), so staging and production are
  separate builds.
