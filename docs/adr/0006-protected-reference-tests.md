# 0006: Reference tests are out of agents' reach

6 November 2026. Accepted.

## Context

Agents change tests to make them pass. The hand-checked cases (grant periods, prices, approval
rules) are the definition of correct, so they need to stay as Sathira wrote them.

## Decision

`tests/reference/` holds them. Claude's file tools are denied there in `.claude/settings.json`.
`scripts/check-reference.mjs` refuses commits touching the folder without a
`Reference-Approved: Sathira` trailer; the `commit-msg` hook and CI run it.

## Consequences

- Accidental edits and Claude's edit tools are blocked.
- An agent using the shell could still write the trailer itself. The trailer is added only by
  Sathira, and CODEOWNERS on `tests/reference/` makes GitHub enforce review once there is a
  remote.
- A wrong reference case is fixed by Sathira, never worked around.
