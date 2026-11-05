// Keeps tests/reference/ as Sathira wrote it (docs/adr/0006).
//   node scripts/check-reference.mjs                  every commit in history, plus the working tree
//   node scripts/check-reference.mjs --range A..B     commits in a range (CI)
//   node scripts/check-reference.mjs --commit-msg F   the staged change about to be committed (hook)
// A change under tests/reference/ (other than its README) needs this trailer in its commit message.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const DIR = "tests/reference/";
const EXEMPT = new Set([`${DIR}README.md`]);
const TRAILER = /^Reference-Approved: Sathira$/m;

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const guarded = (paths) => paths.filter((path) => path.startsWith(DIR) && !EXEMPT.has(path));
const lines = (text) => text.split("\n").filter(Boolean);
const args = process.argv.slice(2);
const failures = [];

if (args[0] === "--commit-msg") {
  const touched = guarded(lines(git("diff", "--cached", "--name-only")));
  const message = readFileSync(args[1], "utf8");
  if (touched.length && !TRAILER.test(message)) {
    failures.push(`this commit changes ${touched.join(", ")}`);
  }
} else {
  const range = args[0] === "--range" ? [args[1]] : [];
  const hasHead = (() => {
    try {
      git("rev-parse", "--verify", "HEAD");
      return true;
    } catch {
      return false;
    }
  })();
  if (hasHead) {
    for (const sha of lines(git("rev-list", ...(range.length ? range : ["HEAD"]), "--", DIR))) {
      const touched = guarded(lines(git("show", "--name-only", "--format=", sha)));
      if (touched.length && !TRAILER.test(git("show", "-s", "--format=%B", sha))) {
        failures.push(`commit ${sha.slice(0, 7)} changes ${touched.join(", ")}`);
      }
    }
  }
  if (!range.length) {
    // Plain path lists, not `git status` columns: the leading space of an unstaged change would
    // be lost to trim() and cut the path short.
    const dirty = guarded([
      ...new Set([
        ...lines(git("diff", "--cached", "--name-only", "--", DIR)),
        ...lines(
          git("ls-files", "--modified", "--deleted", "--others", "--exclude-standard", "--", DIR),
        ),
      ]),
    ]);
    if (dirty.length) failures.push(`uncommitted changes to ${dirty.join(", ")}`);
  }
}

if (failures.length) {
  console.error(
    `tests/reference/ is changed without Sathira's approval:\n  ${failures.join("\n  ")}\n` +
      "Only Sathira changes reference cases, committing with the trailer `Reference-Approved: Sathira`.\n" +
      "If a case looks wrong, stop and say so (docs/testing.md).",
  );
  process.exit(1);
}
console.log("check-reference: ok");
