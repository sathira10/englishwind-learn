// One-off import of the existing buyers (plans/12-buyer-import.md, docs/deploying.md).
//
//   pnpm buyers:import <csv> --env <local|staging|production> [--dry-run] [--course blueprint]
//
// Parses and plans with src/domain/buyer-import.ts (Node's built-in type stripping, no tsx),
// then runs the SQL with `wrangler d1 execute --file`. Nothing runs if any row is bad. Safe to
// run again: see importStatements.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const ENVS = ["local", "staging", "production"];
// The seeded courses row says 3 (migration 0001); keep in step with it.
const ACCESS_YEARS = 3;

function fail(message) {
  console.error(message);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    env: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    course: { type: "string", default: "blueprint" },
  },
});
const csvPath = positionals[0];
if (!csvPath) fail("Usage: import-buyers.mjs <csv> --env local|staging|production [--dry-run]");
const env = values.env ?? fail("--env is required (local, staging or production)");
if (!ENVS.includes(env)) fail(`--env must be one of ${ENVS.join(", ")}`);
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(values.course)) fail(`Bad course id: ${values.course}`);

const root = resolve(import.meta.dirname, "..");
const { parseBuyersCsv, planGrants, importStatements } = await import(
  pathToFileURL(join(root, "src/domain/buyer-import.ts")).href
);
const { colomboDate } = await import(pathToFileURL(join(root, "src/domain/grants.ts")).href);
const { maskEmail } = await import(pathToFileURL(join(root, "src/domain/email.ts")).href);

let text;
try {
  text = readFileSync(csvPath, "utf8");
} catch (e) {
  fail(`Cannot read ${csvPath}: ${e.message}`);
}

const now = Date.now();
const parsed = parseBuyersCsv(text);
const plan = planGrants(parsed.rows, { courseId: values.course, accessYears: ACCESS_YEARS, now });
const errors = [...parsed.errors, ...plan.errors].sort((a, b) => a.line - b.line);
if (errors.length > 0) {
  fail(
    `Not importing: ${errors.length} problem(s)\n` +
      errors.map((e) => `  line ${e.line}: ${e.message}`).join("\n"),
  );
}

for (const g of plan.grants) {
  const ended = g.ended ? "  ** ACCESS ALREADY ENDED **" : "";
  console.error(
    `line ${g.buyer.line}: ${maskEmail(g.buyer.email)}  ${colomboDate(g.startsAt)} -> ${colomboDate(g.endsAt)}${ended}`,
  );
}
const endedCount = plan.grants.filter((g) => g.ended).length;
if (endedCount > 0)
  console.error(`WARNING: ${endedCount} buyer(s) have no access left after import.`);

const sql = importStatements(plan.grants, { now }).join("\n") + "\n";
if (values["dry-run"]) {
  process.stdout.write(sql);
  console.error(`-- dry run: ${plan.grants.length} buyers, env ${env}`);
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "buyers-import-"));
const file = join(dir, "import-buyers.sql");
const target = env === "local" ? ["--local"] : ["--remote", "--env", env];
const wrangler = (args, stdio) =>
  spawnSync("pnpm", ["exec", "wrangler", "d1", "execute", "DB", ...args, ...target], {
    stdio,
    cwd: root,
    encoding: "utf8",
  });
let status = 1;
try {
  writeFileSync(file, sql);
  console.log(`Importing ${plan.grants.length} buyers into ${env}.`);
  const run = wrangler(["--file", file], "inherit");
  if (run.error) console.error(`Could not run wrangler: ${run.error.message}`);
  status = run.status ?? 1;
  if (status === 0) {
    // Report what is in the database now, not what this file planned: a buyer who already had
    // a grant keeps it.
    const list = plan.grants.map((g) => `'${g.buyer.email.replaceAll("'", "''")}'`).join(", ");
    const check = wrangler(
      [
        "--json",
        "--command",
        `SELECT s.email, g.ends_at, g.created_by FROM students s JOIN grants g ON g.student_id = s.id WHERE s.email IN (${list}) AND g.course_id = '${values.course}' ORDER BY g.starts_at`,
      ],
      "pipe",
    );
    let rows = [];
    try {
      const out = check.stdout ?? "";
      rows = JSON.parse(out.slice(out.indexOf("[")))[0].results;
    } catch {
      console.error("Imported, but could not read the grants back to check them.");
    }
    for (const g of plan.grants) {
      const found = rows.filter((r) => r.email === g.buyer.email);
      const mine = found.find((r) => r.created_by === "import");
      const what = mine
        ? `access ends ${colomboDate(mine.ends_at)}${mine.ends_at === g.endsAt ? "" : " (differs from this file)"}`
        : found.length > 0
          ? "skipped, existing grant not changed"
          : "NO GRANT FOUND";
      console.log(`line ${g.buyer.line}: ${maskEmail(g.buyer.email)}  ${what}`);
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(status);
