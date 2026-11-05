#!/usr/bin/env node
// Rehearse a restore without Cloudflare: load a decrypted D1 export into a throwaway local D1 and
// report row counts per table (docs/operations.md, plans/11-backups.md).
//
//   node scripts/backup-verify.mjs <export.sql> [migrations-dir]
//
// The migrations dir defaults to src/db/migrations. The same migrations are applied to a second
// throwaway database, and the check fails if any table they create is missing from the export.
// No dependencies: it shells out to wrangler through pnpm.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [exportArg, migrationsArg] = process.argv.slice(2);

if (!exportArg || exportArg === "--help" || exportArg === "-h") {
  console.error("usage: node scripts/backup-verify.mjs <export.sql> [migrations-dir]");
  process.exit(exportArg ? 0 : 2);
}
const exportFile = resolve(exportArg);
const migrationsDir = resolve(migrationsArg ?? join(root, "src/db/migrations"));
if (!existsSync(exportFile)) fail(`export not found: ${exportFile}`);
if (!existsSync(migrationsDir)) fail(`migrations folder not found: ${migrationsDir}`);

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function wrangler(args) {
  return execFileSync("pnpm", ["exec", "wrangler", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function execute(dir, flags) {
  return wrangler(["d1", "execute", "DB", "--local", "--persist-to", dir, ...flags]);
}

// Runs one statement against the local D1 in `dir` and returns the result rows.
function query(dir, sql) {
  const out = execute(dir, ["--json", "--command", sql]);
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
}

const tablesSql =
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name";

const work = mkdtempSync(join(tmpdir(), "ew-backup-verify-"));
const restoreDir = join(work, "restore");
const referenceDir = join(work, "reference");
let failed = false;

try {
  // 1. What the migrations say the database should contain.
  const sqlFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (sqlFiles.length === 0) fail(`no .sql files in ${migrationsDir}`);
  for (const f of sqlFiles) execute(referenceDir, ["--file", join(migrationsDir, f), "--yes"]);
  const expected = query(referenceDir, tablesSql).map((r) => r.name);

  // 2. Apply the export to an empty database, as a restore would.
  execute(restoreDir, ["--file", exportFile, "--yes"]);
  const actual = query(restoreDir, tablesSql).map((r) => r.name);

  // 3. Row counts per table.
  // One query per table: D1 caps the terms in a compound SELECT.
  const counts = actual.map((t) => ({
    table: t,
    rows: query(restoreDir, `SELECT COUNT(*) AS rows FROM "${t}"`)[0].rows,
  }));

  const width = Math.max(5, ...counts.map((c) => c.table.length));
  console.log(`${"table".padEnd(width)}  rows`);
  for (const c of counts) console.log(`${c.table.padEnd(width)}  ${c.rows}`);

  const missing = expected.filter((t) => !actual.includes(t));
  const extra = actual.filter((t) => !expected.includes(t));
  if (missing.length) {
    failed = true;
    console.log(`\nMISSING tables (in migrations, not in export): ${missing.join(", ")}`);
  }
  if (extra.length)
    console.log(`\nnote: tables in export but not in migrations: ${extra.join(", ")}`);
  const courses = counts.find((c) => c.table === "courses");
  if (courses && courses.rows === 0) {
    failed = true;
    console.log("\ncourses is empty: the export has no data (was it made with --no-data?)");
  }
  console.log(
    failed ? "\nFAIL" : `\nOK: ${actual.length} tables restored, schema matches the migrations`,
  );
} catch (err) {
  console.error(`FAIL: ${err.message}\n${err.stdout ?? ""}\n${err.stderr ?? ""}`);
  failed = true;
} finally {
  rmSync(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
