# Operations

Backups and restore. The plan and the reasoning are in [plans/11-backups.md](../plans/11-backups.md).

## What is backed up

Every night at 02:00 in Colombo (20:30 UTC), `.github/workflows/backup.yml` makes one encrypted
file per run: a D1 export (schema and data) and a copy of every object in the R2 bucket. It is kept
as a GitHub workflow artifact for 30 days, named `englishwind-learn-<env>-<YYYY-MM-DD>`.
Production runs on the schedule. To back up staging, or to take an extra copy before a risky
change, run the workflow by hand from the Actions tab and pick the environment.

Secrets (repository level, see [deploying.md](deploying.md)): `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `BACKUP_PASSPHRASE`.
Keep the passphrase somewhere other than GitHub (a password manager). Without it a backup is
unreadable.

Check each morning that the latest run is green. A red run is a missed backup.

## Restore

Restoring into a fresh D1 and bucket is the safe default: nothing existing is overwritten, and
you can compare before switching. `wrangler d1 execute --file` of an export onto a database that
already has tables fails on `CREATE TABLE`.

1. **Get the file.** Actions, Backup, the run you want, Artifacts, download the zip and unzip it.
   You get `englishwind-learn-<env>-<date>.tar.gz.gpg`.
2. **Decrypt into an empty folder.**

   ```sh
   mkdir restore && cd restore
   gpg --decrypt ../englishwind-learn-production-2026-11-12.tar.gz.gpg | tar -xz
   cat backup/MANIFEST.txt   # environment, time, table and object counts
   ```

   You now have `backup/d1.sql` and `backup/r2/`.

3. **Rehearse locally first** (no Cloudflare needed), from the repo root:

   ```sh
   node scripts/backup-verify.mjs restore/backup/d1.sql
   ```

   It prints the row count per table and fails if a table from the migrations is missing.

4. **Create a fresh database and bucket.**

   ```sh
   pnpm wrangler d1 create englishwind-learn-restored
   pnpm wrangler r2 bucket create englishwind-learn-files-restored
   ```

5. **Load the data.** The export includes the `d1_migrations` table, so later deploys will not
   re-run migrations.

   ```sh
   pnpm wrangler d1 execute englishwind-learn-restored --remote --file restore/backup/d1.sql
   ```

6. **Re-upload the files.** wrangler uploads one object at a time; the S3 API does the whole
   folder (keys must stay exactly as in the backup, because `resources.r2_key` points at them).
   Use the same R2 access keys as the backup job.

   ```sh
   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_DEFAULT_REGION=auto \
     aws s3 sync restore/backup/r2 s3://englishwind-learn-files-restored \
     --endpoint-url "https://<account id>.r2.cloudflarestorage.com"
   ```

7. **Point the Worker at them.** In `wrangler.jsonc`, put the new database name and `database_id`
   and the new bucket name in the environment being restored, then `pnpm deploy:<env>`.
   To restore into the existing resources instead (say the database was emptied), skip step 4,
   delete the damaged database or bucket contents first, and reuse the existing names. Do this
   only when the damage is understood, and take a fresh manual backup before you start.

8. **Verify.**
   - `curl https://<host>/api/health` returns ok.
   - Row counts match `node scripts/backup-verify.mjs` from step 3, and the manifest:
     `pnpm wrangler d1 execute DB --remote --env <env> --command "SELECT COUNT(*) FROM grants"`
     for `students`, `orders`, `grants` and `resources`.
   - Sign in as a student with a current grant and download one worksheet.
   - Delete the plaintext `restore/` folder when done.

## Rehearsal

A backup nobody has restored is a hope. Rehearse once on staging before launch and again after any
change to the backup job: run the workflow for staging, then do steps 1 to 8 against a throwaway
`-restored` database and bucket, and delete them afterwards. Note the date and result in
[plans/11-backups.md](../plans/11-backups.md).
