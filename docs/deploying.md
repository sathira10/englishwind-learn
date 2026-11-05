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
4. For the nightly backup ([operations.md](operations.md)), add these repository secrets as well:
   `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` (an R2 API token with read access to both
   buckets, made in the Cloudflare dashboard under R2, Manage API tokens) and `BACKUP_PASSPHRASE`
   (a random passphrase of 32 or more characters). GitHub secrets cannot be read back, so keep a
   copy of every backup secret in a password manager. `CLOUDFLARE_API_TOKEN` needs the same D1
   permission as deploying (D1 Edit); I could not confirm from wrangler that an export works
   with read-only access, so do not narrow it without testing.

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

## Importing the existing buyers

One-off, before launch (plans/12-buyer-import.md). Amma gives the buyers' names, emails and
original purchase dates; copy `tests/fixtures/buyers-sample.csv` as the template (never commit a
file with real people in it). Columns: `email`, `name`, `phone` (optional), `purchased_on`
(`YYYY-MM-DD`, Colombo date), `note` (optional).

```sh
pnpm buyers:import ~/buyers.csv --env staging --dry-run   # checks the file, prints the SQL
pnpm buyers:import ~/buyers.csv --env staging             # or local, production
```

Nothing is written if any row is bad: the script lists each problem with its line number
(duplicate email, bad or missing date, a date in the future). It prints each buyer (masked email and line number) with the planned start and end
date and warns if one has no access left. Each buyer gets a student row (an existing one is left
alone) and a grant of 3 years from the purchase date at Colombo midnight, with no order,
`created_by = 'import'`, and an `audit_log` row with actor `import`. A buyer who already has any
grant for the course is skipped and keeps that grant: fixing a date in the CSV and running again does
not change a buyer already imported (change it in the admin). After the run the script reads the
grants back and prints, per buyer, the access end now in the database or "skipped, existing grant
not changed". It is safe to run again, for example after fixing a
row. Run migrations and the course seed first. The buyers sign in with the same email address
(the row is linked on their first verified sign-in); tell them to use it. Check afterwards in the
admin that each of the 5 shows a grant ending 3 years after their purchase date.
