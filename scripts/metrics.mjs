// Is agent work helping? Counts from git history (docs/metrics.md).
//   node scripts/metrics.mjs [--days 30]
import { execFileSync } from "node:child_process";

const DAY = 86_400;
const REWRITE_WINDOW = 14 * DAY;
const daysArg = process.argv.indexOf("--days");
const days = daysArg > 0 ? Number(process.argv[daysArg + 1]) : 30;
const now = Math.floor(Date.now() / 1000);

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 << 20 });

// One record per commit: sha, time, subject, body.
const SEP = "\x1e";
const commits = git("log", `--since=${days}.days`, `--format=%H%x1f%ct%x1f%s%x1f%B${SEP}`)
  .split(SEP)
  .map((record) => record.trim())
  .filter(Boolean)
  .map((record) => {
    const [sha, time, subject, body] = record.split("\x1f");
    return { sha, time: Number(time), subject, body };
  });

const isAgent = (commit) => /^Agent: yes$/m.test(commit.body);
const agent = commits.filter(isAgent);
const agentShas = new Set(agent.map((commit) => commit.sha));

// Every commit, not only this window, can revert or fix an agent commit from the window.
const later = git("log", `--format=%B${SEP}`)
  .split(SEP)
  .map((record) => record.trim())
  .filter(Boolean);
const target = (pattern) =>
  new Set(later.flatMap((text) => [...text.matchAll(pattern)].map((match) => match[1])));
const reverted = target(/This reverts commit ([0-9a-f]{7,40})/g);
const fixed = target(/^Fixes-Commit: ([0-9a-f]{7,40})$/gm);
const fixupSubjects = new Set(
  later.flatMap((text) => {
    const match = text.split("\n")[0].match(/^fixup! (.+)$/);
    return match ? [match[1]] : [];
  }),
);
const matches = (set, sha) => [...set].some((prefix) => sha.startsWith(prefix));

const revertedAgent = agent.filter((commit) => matches(reverted, commit.sha));
const fixedAgent = agent.filter(
  (commit) => matches(fixed, commit.sha) || fixupSubjects.has(commit.subject),
);

// Rewritten soon: of the lines an agent commit added, the share gone 14 days later.
function survival(commit) {
  const cutoff = git("rev-list", "-1", `--before=${commit.time + REWRITE_WINDOW}`, "HEAD").trim();
  let added = 0;
  let kept = 0;
  for (const line of git("show", "--numstat", "--format=", commit.sha).split("\n")) {
    const [plus, , file] = line.split("\t");
    if (!file || plus === "-") continue;
    added += Number(plus);
    try {
      const blame = git("blame", "--line-porcelain", cutoff, "--", file);
      kept += blame.split("\n").filter((row) => row.startsWith(commit.sha)).length;
    } catch {
      // File deleted or renamed by the cutoff: none of its lines survive here.
    }
  }
  return { added, kept };
}
const old = agent.filter((commit) => now - commit.time >= REWRITE_WINDOW);
const rewritten = old.filter((commit) => {
  const { added, kept } = survival(commit);
  return added > 0 && kept / added < 0.5;
});

const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "n/a");
const rows = [
  ["Commits", commits.length],
  ["Written by an agent", `${agent.length} (${pct(agent.length, commits.length)})`],
  [
    "Agent commits reverted",
    `${revertedAgent.length} (${pct(revertedAgent.length, agent.length)})`,
  ],
  [
    "Agent commits needing a fix-up",
    `${fixedAgent.length} (${pct(fixedAgent.length, agent.length)})`,
  ],
  [
    "Agent commits mostly rewritten within 14 days",
    old.length
      ? `${rewritten.length} of ${old.length} old enough (${pct(rewritten.length, old.length)})`
      : "none old enough yet",
  ],
];
console.log(`Last ${days} days\n`);
for (const [label, value] of rows) console.log(`${label.padEnd(48)} ${value}`);
for (const commit of [...revertedAgent, ...fixedAgent, ...rewritten]) {
  if (agentShas.has(commit.sha)) console.log(`  ${commit.sha.slice(0, 7)} ${commit.subject}`);
}
console.log("\nCI pass rate and cost per feature: see docs/metrics.md.");
