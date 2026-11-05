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
GitHub secrets cannot be read back. Keep copies of the passphrase (random, 32 or more characters)
and both R2 keys in a password manager, outside GitHub. Without the passphrase a backup is
unreadable.

What the backup does not hold: Worker secrets, the Cloudflare Access policy, Vimeo domain
allowlists, DNS and routes. Those are listed in [deploying.md](deploying.md) and must be re-created
by hand in a disaster. Staff roles are in D1, so they are restored.

Check each morning that the latest run is green. A red run is a missed backup.

## Restore

Restoring into a fresh D1 and bucket is the safe default: nothing existing is overwritten, and
you can compare before switching. `wrangler d1 execute --file` of an export onto a database that
already has tables fails on `CREATE TABLE`.

Decrypted data must never be inside the repo. Use `~/ew-restore`, and delete it when finished.
Commands say where to run them. `<repo>` is your checkout of englishwind-learn.

1. **Get the file.** Actions, Backup, the run you want, Artifacts, download the zip and unzip it
   into `~/ew-restore`. You get `englishwind-learn-<env>-<date>.tar.gz.gpg`.
2. **Decrypt.** Run in `~/ew-restore`:

   ```sh
   cd ~/ew-restore
   gpg --decrypt englishwind-learn-production-2026-11-12.tar.gz.gpg | tar -xz
   cat backup/MANIFEST.txt   # environment, time, table count, r2_objects
   ```

   You now have `~/ew-restore/backup/d1.sql` and `~/ew-restore/backup/r2/`.

3. **Rehearse locally first** (no Cloudflare needed). Run in `<repo>`:

   ```sh
   cd <repo>
   node scripts/backup-verify.mjs ~/ew-restore/backup/d1.sql
   ```

   It prints the row count per table (keep this output for step 8) and fails if a table from the
   migrations is missing.

4. **Create a fresh database and bucket.** Run in `<repo>`:

   ```sh
   pnpm wrangler d1 create englishwind-learn-restored
   pnpm wrangler r2 bucket create englishwind-learn-files-restored
   ```

5. **Load the data.** Run in `<repo>`. The export includes the `d1_migrations` table, so later
   deploys will not re-run migrations.

   ```sh
   cd <repo>
   pnpm wrangler d1 execute englishwind-learn-restored --remote --file ~/ew-restore/backup/d1.sql
   ```

6. **Re-upload the files.** Keys must stay exactly as in the backup, because `resources.r2_key`
   points at them. The backup's R2 keys are read-only, so create a separate R2 API token with
   write (Object Read and Write) access to the new bucket, and use that one. Do not add it to
   GitHub. Run in `~/ew-restore`:

   ```sh
   cd ~/ew-restore
   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_DEFAULT_REGION=auto \
     AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
     aws s3 sync backup/r2 s3://englishwind-learn-files-restored \
     --endpoint-url "https://<account id>.r2.cloudflarestorage.com"
   ```

7. **Point the Worker at them.** In `<repo>/wrangler.jsonc`, put the new database name and
   `database_id` and the new bucket name in the environment being restored, then run
   `pnpm deploy:<env>` in `<repo>`. To restore into the existing resources instead (say the
   database was emptied), skip step 4, delete the damaged database or bucket contents first, and
   reuse the existing names. Do this only when the damage is understood, and take a fresh manual
   backup before you start.

8. **Verify.**
   - `curl https://<host>/api/health` returns ok.
   - Row counts match the step 3 output. Run in `<repo>`:
     `pnpm wrangler d1 execute DB --remote --env <env> --command "SELECT (SELECT COUNT(*) FROM students) AS students, (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM grants) AS grants, (SELECT COUNT(*) FROM resources) AS resources"`.
   - The object count matches `r2_objects` in the manifest:
     `aws s3 ls s3://englishwind-learn-files-restored --recursive --endpoint-url ... | wc -l`
     (same credentials as step 6).
   - Sign in as a student with a current grant and download one worksheet.
   - Delete `~/ew-restore` when done.

## Rehearsal

A backup nobody has restored is a hope. Rehearse once on staging before launch and again after any
change to the backup job: run the workflow for staging, then do steps 1 to 8 against a throwaway
`-restored` database and bucket, and delete them afterwards. Note the date and result in
[plans/11-backups.md](../plans/11-backups.md).
