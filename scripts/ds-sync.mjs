// Keeps design-system/ in step with englishwind-web, which owns it (docs/adr/0001).
//   node scripts/ds-sync.mjs           copy the source over this repo's copy
//   node scripts/ds-sync.mjs --check   list drift and exit 1 if there is any
// Local only: CI has no sibling checkout, so a missing source is reported and skipped.
import { cpSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SOURCE = process.env.DS_SOURCE ?? "../englishwind-web/design-system";
const TARGET = "design-system";
// What this app takes. Photography and the brand icons stay in the site; the interface icons come too.
const PATHS = [
  "tokens.css",
  "tokens.json",
  "README.md",
  "fonts",
  "components",
  "assets/Logos",
  "assets/Interface",
];
const check = process.argv.includes("--check");

if (!existsSync(SOURCE)) {
  console.log(`ds-sync: ${SOURCE} not found, skipped`);
  process.exit(0);
}

function files(root) {
  if (!existsSync(root)) return [];
  if (!statSync(root).isDirectory()) return [root];
  return readdirSync(root)
    .filter((name) => name !== ".DS_Store")
    .flatMap((name) => files(join(root, name)));
}

const drift = [];
for (const path of PATHS) {
  const source = join(SOURCE, path);
  const target = join(TARGET, path);
  const names = new Set([
    ...files(source).map((file) => relative(source, file)),
    ...files(target).map((file) => relative(target, file)),
  ]);
  for (const name of names) {
    const a = join(source, name);
    const b = join(target, name);
    if (!existsSync(a)) drift.push(`only here: ${b}`);
    else if (!existsSync(b)) drift.push(`missing: ${b}`);
    else if (!readFileSync(a).equals(readFileSync(b))) drift.push(`differs: ${b}`);
  }
  if (!check) cpSync(source, target, { recursive: true });
}

if (check && drift.length) {
  console.error(`Design system differs from ${SOURCE}:\n${drift.join("\n")}`);
  console.error("Run `pnpm ds:sync` to take the source's version.");
  process.exit(1);
}
console.log(check ? "ds-sync: in step" : `ds-sync: copied from ${SOURCE}`);
