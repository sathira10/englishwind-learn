# 0001: This repo is the learn app only

6 November 2026. Accepted.

## Context

The launch plan's default was one `englishwind` monorepo holding the public site and the learn
app. `englishwind-web` already ships from its own repo, and this repo was started on its own.

## Decision

This repo holds the student app, the family admin and the API: one package, no workspace.
`englishwind-web` stays separate and keeps the design system's source of truth.
`design-system/` here is a copy, checked for drift with `pnpm ds:check`.

## Consequences

- Half the config of a monorepo, and the public site's deploys don't touch the app.
- The design system can drift. `pnpm ds:check` reports it; changes flow from englishwind-web.
- If both apps later share real code, moving into `apps/` with a pnpm workspace is a contained
  change.
