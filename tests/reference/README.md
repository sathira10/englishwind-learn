# Reference cases

Hand-checked cases that define correct behaviour: grant periods, prices, approval rules. Sathira
writes or approves every file here, and agents never edit this folder (docs/testing.md,
docs/adr/0006).

- A commit that changes anything here except this README needs a `Reference-Approved: Sathira`
  trailer. `scripts/check-reference.mjs` enforces it in the `commit-msg` hook, `pnpm check` and
  CI.
- Each case states its source: where the expected value came from (the launch plan, a bank
  record, a worked example).
- If a case looks wrong, raise it. Don't change the code or the case to get past it.

The first cases arrive with slice 02 (grant rules), from the reference table in its plan.
