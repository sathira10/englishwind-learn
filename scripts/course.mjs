// Course publishing (plans/04-course-definition.md, docs/deploying.md).
//
//   pnpm course:publish <courseId> --env <local|staging|production> [--dry-run] [--by <who>]
//   pnpm course:upload-commands <courseId> [--env <local|staging|production>] [--from <dir>]
//
// Loads content/courses/<courseId>.ts through Node's built-in type stripping (no tsx), so the
// package.json scripts run this file with --experimental-strip-types.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const ENVS = ["local", "staging", "production"];
// Keep in step with r2_buckets in wrangler.jsonc.
const BUCKETS = {
  local: "englishwind-learn-files-dev",
  staging: "englishwind-learn-files-staging",
  production: "englishwind-learn-files",
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [command, ...rest] = process.argv.slice(2);
const { values, positionals } = parseArgs({
  args: rest,
  allowPositionals: true,
  options: {
    env: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    by: { type: "string" },
    from: { type: "string" },
  },
});
const courseId = positionals[0];
if (!["publish", "upload-commands"].includes(command ?? "") || !courseId) {
  fail("Usage: course.mjs <publish|upload-commands> <courseId> [--env local|staging|production]");
}
if (values.env !== undefined && !ENVS.includes(values.env)) {
  fail(`--env must be one of ${ENVS.join(", ")}`);
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(courseId)) fail(`Bad course id: ${courseId}`);

const root = resolve(import.meta.dirname, "..");
const { validateCourse, toPublication, publishStatements } = await import(
  pathToFileURL(join(root, "src/domain/course.ts")).href
);
const mod = await import(pathToFileURL(join(root, "content/courses", `${courseId}.ts`)).href).catch(
  (e) => fail(`Cannot load content/courses/${courseId}.ts: ${e.message}`),
);

const checked = validateCourse(mod.course);
if (!checked.ok) fail(`Invalid course definition:\n  ${checked.errors.join("\n  ")}`);
const def = checked.course;
if (def.id !== courseId) fail(`content/courses/${courseId}.ts has id "${def.id}"`);

if (command === "publish") {
  const env = values.env ?? fail("--env is required (local, staging or production)");
  const publishedBy = values.by ?? process.env.USER ?? "cli";
  const sql = publishStatements(def, { now: Date.now(), publishedBy }).join("\n") + "\n";
  const { content, resources } = toPublication(def);
  const lessons = content.modules.flatMap((m) => m.lessons).length;
  if (values["dry-run"]) {
    process.stdout.write(sql);
    console.error(`-- dry run: ${lessons} lessons, ${resources.length} resources, env ${env}`);
    process.exit(0);
  }
  const file = join(mkdtempSync(join(tmpdir(), "course-publish-")), `${courseId}.sql`);
  writeFileSync(file, sql);
  const target = env === "local" ? ["--local"] : ["--remote", "--env", env];
  console.log(
    `Publishing ${courseId} (${lessons} lessons, ${resources.length} resources) to ${env}`,
  );
  console.log(`SQL: ${file}`);
  const run = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "DB", "--file", file, ...target],
    {
      stdio: "inherit",
      cwd: root,
    },
  );
  process.exit(run.status ?? 1);
}

// upload-commands
const from = values.from ?? "./blueprint-v1/public/files/blueprint";
const { resources } = toPublication(def);
const envs = values.env ? [values.env] : ENVS;
for (const env of envs) {
  console.log(`# ${env}: ${resources.length} worksheets (files read from ${from})`);
  for (const r of resources) {
    const where = env === "local" ? "--local" : "--remote";
    console.log(
      `pnpm exec wrangler r2 object put ${BUCKETS[env]}/${r.r2Key} --file ${from}/${basename(r.r2Key)} --content-type ${r.contentType} ${where}`,
    );
  }
  console.log("");
}
