# Metrics

Judge whether agent work is helping by numbers, not by how fast it feels.

## Commit labels

- A commit an agent wrote ends with an `Agent: yes` trailer.
- A commit that fixes an earlier commit adds `Fixes-Commit: <sha>`, or uses `git commit --fixup`.
- Reverts use `git revert`, which keeps `This reverts commit <sha>` in the message.

## Report

`pnpm metrics` (`scripts/metrics.mjs`) reads git history and prints, for the last 30 days by
default (`pnpm metrics -- --days 90`):

- commits in total and the share an agent wrote
- agent commits later reverted
- agent commits that needed a fix-up commit
- agent commits whose lines were mostly rewritten within 14 days

CI pass rate and cost per feature come from outside git: the GitHub Actions history once there
is a remote, and the usage page for cost. Note them in the slice's plan file when it's done.

Look at the numbers once a slice is merged. A rising revert or fix-up rate means the specs or
the reviews need to get stricter.
