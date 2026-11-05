# Deploying

One Worker per environment: `englishwind-learn-staging` and `englishwind-learn` (production).
Each has its own D1 database, R2 bucket, secrets and Access policy.

## One-time setup

1. Create the resources and put their IDs in `wrangler.jsonc` where it says `FILL`:

   ```sh
   pnpm wrangler d1 create englishwind-learn-staging
   pnpm wrangler d1 create englishwind-learn
   pnpm wrangler r2 bucket create englishwind-learn-files-staging
   pnpm wrangler r2 bucket create englishwind-learn-files
   ```

2. Add the routes (learn.englishwind.lk for production, a staging host for staging) in
   `wrangler.jsonc`.
3. In GitHub: add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as secrets, and create a
   `production` environment with Sathira as a required reviewer.

## Deploy

The Cloudflare Vite plugin picks the environment at build time and writes the config that
`wrangler deploy` reads.

```sh
pnpm deploy:staging       # CLOUDFLARE_ENV=staging vite build, migrations, deploy
pnpm deploy:production
```

CI deploys staging on every push to `main`. Production runs from the same workflow by hand and
waits for approval.

## Migrations

`pnpm db:generate` writes a new SQL file from `src/db/schema.ts`. Never edit an applied one.
Deploy scripts apply pending migrations before the new code goes live, so every migration must
work with the code that's already running.
