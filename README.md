# englishwind-learn

The EnglishWind learning app at learn.englishwind.lk: students watch Blueprint lessons and
download worksheets, and the family approves bank transfers in `/admin`. One Cloudflare Worker
serves the React app and the API.

```sh
pnpm install
cp .dev.vars.example .dev.vars
pnpm dev          # app and API on one port, D1 and R2 simulated locally
pnpm check        # the gate: lint, types, tests, guards, build
```

`GET /api/health` answers `{ "ok": true, "db": true }` when the Worker and D1 are up.

- How work is done: [docs/workflow.md](docs/workflow.md)
- What to build next: [plans/roadmap.md](plans/roadmap.md)
- Decisions: [docs/adr/](docs/adr)
- Deploying: [docs/deploying.md](docs/deploying.md)
