// One-off import of the existing buyers (plans/12-buyer-import.md, docs/deploying.md).
//
//   pnpm buyers:import <csv> --env <local|staging|production> [--dry-run] [--course blueprint]
//
// Parses and plans with src/domain/buyer-import.ts (Node's built-in type stripping, no tsx),
// then runs the SQL with `wrangler d1 execute --file`. Nothing runs if any row is bad. Safe to
// run again: see importStatements.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
    `line ${g.buyer.line}: ${g.buyer.email}  ${colomboDate(g.startsAt)} -> ${colomboDate(g.endsAt)}${ended}`,
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

const file = join(mkdtempSync(join(tmpdir(), "buyers-import-")), "import-buyers.sql");
writeFileSync(file, sql);
const target = env === "local" ? ["--local"] : ["--remote", "--env", env];
console.log(`Importing ${plan.grants.length} buyers into ${env}. SQL: ${file}`);
const run = spawnSync(
  "pnpm",
  ["exec", "wrangler", "d1", "execute", "DB", "--file", file, ...target],
  {
    stdio: "inherit",
    cwd: root,
  },
);
process.exit(run.status ?? 1);
