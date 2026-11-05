# Plan 11: backups and restore

5 November 2026. Baseline: `claude/slice-01-data-model` at `be3f6ae`.

After this slice every night a copy of the database and the worksheets sits outside Cloudflare,
and Sathira has a written, rehearsable way to bring the app back from it. This is a "never cut"
item in the launch plan.

## Spec

### Inputs and outputs

| Name          | Type and unit                                                                                                    | Notes                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| D1 export     | SQL text (`wrangler d1 export --remote`)                                                                         | Schema and data, including `d1_migrations`              |
| R2 copy       | every object in the env's bucket, same keys                                                                      | Via the S3-compatible API; wrangler cannot list objects |
| Backup file   | `englishwind-learn-<env>-<UTC date>.tar.gz.gpg`                                                                  | Tarball of `d1.sql`, `r2/`, `MANIFEST.txt`; gpg AES256  |
| Schedule      | daily 20:30 UTC (02:00 Colombo)                                                                                  | Production. Staging only by manual run                  |
| Retention     | 30 days                                                                                                          | GitHub workflow artifact, `retention-days: 30`          |
| Secrets       | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `BACKUP_PASSPHRASE` | Repository secrets, passed only through step `env`      |
| Verify script | `node scripts/backup-verify.mjs <export.sql> [migrations-dir]`                                                   | Row counts per table; exit 1 if a table is missing      |

Times are UTC in storage and Asia/Colombo on screen. Where the copy lives is Q23: the default is a
GitHub workflow artifact; the answer may move it to Drive or S3 (only the upload step changes).

### Reference cases

Hand-checked. The rehearsal on staging is a step for Sathira once Q1 and Q23 are answered.

| Case | Given                                                            | Expected                                                            |
| ---- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| R1   | Export of a freshly migrated local D1, run through backup-verify | 11 tables, `courses` 1 row, `offers` 3, `d1_migrations` 2, exit 0   |
| R2   | Export made with `--table courses` only                          | backup-verify reports the other 9 tables missing and exits 1        |
| R3   | A backup file and the wrong passphrase                           | gpg refuses to decrypt; the job also test-decrypts before uploading |

### Properties

- [ ] A backup artifact is never readable without `BACKUP_PASSPHRASE` (approved: no)
- [ ] No secret value appears in the workflow log or the artifact (approved: no)
- [ ] The job fails, and so shows red, if any of D1 export, R2 copy or encryption fails (approved: no)

### Out of scope

Point-in-time recovery (D1 Time Travel is a separate Cloudflare feature, useful but inside
Cloudflare, so it does not replace this). Backing up Vimeo videos, the Access policy, Worker
secrets, or the code (GitHub holds the code). Moving the copy off GitHub (Q23). Alerting beyond
GitHub's failed-run email.

### How it is checked

- Locally (done, below): export from the local D1, run backup-verify, test the encrypt and
  decrypt commands from the workflow. `pnpm check` for lint and formatting.
- Not testable here: the workflow itself, the remote export and the R2 sync need Cloudflare
  credentials. The first manual run on staging proves them.
- Manual, for Sathira after Q1 and Q23: add the three secrets, run Backup for staging, then
  follow [docs/operations.md](../docs/operations.md) steps 1 to 8 into a throwaway `-restored`
  database and bucket, and note the date here.
- Failure modes from `docs/review.md`: secrets only via `env`, `contents: read`,
  `persist-credentials: false`, job limited to `main`.

## Steps

1. **Workflow, verify script, restore docs.** One PR: `backup.yml`, `scripts/backup-verify.mjs`,
   `docs/operations.md`, secrets in `docs/deploying.md` and Q23. Done when `pnpm check` passes and
   backup-verify passes on a local export.
2. **Rehearse on staging (Sathira).** After Q1 and Q23. Done when a restore into a throwaway
   database and bucket passes the verification list and the result is recorded below.

## Local test record (5 November 2026)

- `pnpm db:migrate:local` applied both migrations.
- `wrangler d1 export DB --local --output export.sql` is supported (wrangler 4.157.0). The export
  includes `d1_migrations` and uses plain `CREATE TABLE`, so it only loads into an empty database.
- `node scripts/backup-verify.mjs export.sql` gave: audit_log 0, course_publications 0, courses 1,
  d1_migrations 2, grants 0, lesson_progress 0, offers 3, orders 0, resources 0, staff_roles 0,
  students 0; "OK: 11 tables restored, schema matches the migrations" (R1).
- A `--table courses` export failed with nine missing tables and exit 1 (R2).
- gpg symmetric encrypt, decrypt and `tar -tz` of a tarball with those parts worked with a
  passphrase on stdin (the commands in the workflow).
- The workflow YAML parses; it has not run on GitHub. Staging rehearsal: not done (needs Q1/Q23).

## Decisions

- R2 is copied with `aws s3 sync` because `wrangler r2 object` has only get, put and delete (no
  list). It needs an R2 API token; no new dependency (the aws CLI is on the runner).
- The job uses repository secrets, not a GitHub environment, so the production approval gate does
  not stop the nightly run.
- D1 is exported with `wrangler d1 export DB --remote --env <env>`, so the database comes from
  `wrangler.jsonc` and cannot drift from what the Worker uses. The bucket names in the workflow
  repeat `wrangler.jsonc` and must change with it.
- backup-verify queries one table per call: D1 limits the terms in a compound SELECT.
