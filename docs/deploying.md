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

## Publishing a course and uploading worksheets

The course lives in `content/courses/<id>.ts` (plans/04-course-definition.md). The app reads the
published copy in D1, so an edit to that file reaches students only after a publish.

```sh
pnpm course:publish blueprint --env local --dry-run   # print the SQL, touch nothing
pnpm course:publish blueprint --env staging           # or local, production
```

It checks the definition, then runs `wrangler d1 execute` with a SQL file that upserts the
worksheet rows in `resources` and adds the next `course_publications` version. Publishing again
makes version 2, 3 and so on and never duplicates a resource. The course row and offers must
already exist (migration `0001`), so run the migrations first. If a publish fails part way, run
it again: the resource upserts are safe to repeat. Check the first staging publish shows one new
version and 8 resources.

The worksheet PDFs are not in this repo. Print the upload commands, then run them on the Mac
that has `blueprint-v1` (the default folder is `./blueprint-v1/public/files/blueprint`; change it
with `--from`):

```sh
pnpm course:upload-commands blueprint --env staging
```

Keys are `courses/<courseId>/lesson-NN.pdf` in the private bucket. Upload before students open a
worksheet; publishing does not check that the objects exist.

## Migrations

`pnpm db:generate` writes a new SQL file from `src/db/schema.ts`. Never edit an applied one.
The Blueprint course and offers are seeded by a hand-written migration (`0001_seed_blueprint.sql`);
number later generated migrations after it (plans/01-data-model.md).
Deploy scripts apply pending migrations before the new code goes live, so every migration must
work with the code that's already running.

## Staff

`/api/admin` needs two things: the Access variables (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, set per
environment in `wrangler.jsonc`; setup in `plans/08-admin-access.md`) and a row in `staff_roles`
for each person. Emails are lower-case. Roles are `owner` and `admin`. Run once per environment
after the first migration, replacing the `FILL` emails (never commit real ones):

```sh
pnpm wrangler d1 execute DB --remote --env staging --command \
  "INSERT INTO staff_roles (email, role, created_at) VALUES
   ('FILL-sathira@example.com', 'owner', strftime('%s','now')*1000),
   ('FILL-amma@example.com', 'owner', strftime('%s','now')*1000)"
```

Use `--env production` for production. To remove someone: `DELETE FROM staff_roles WHERE email = '...'`.
