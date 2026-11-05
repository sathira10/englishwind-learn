# Workflow

Every feature goes through the same loop. Clear the agent's context between tasks.

1. **Spec.** Copy `plans/TEMPLATE.md` and fill in the spec: inputs and outputs with units,
   reference cases with expected results, out of scope, how it is checked. Sathira agrees it
   before any code is written.
2. **Plan.** Break the slice into steps, each one PR you can describe in one sentence. Pure
   logic in `src/domain/` comes before the route, and the route before the screen.
3. **One small diff.** Do one step on a branch. If it grows past one sentence, split it.
4. **Checks.** `pnpm check` passes. CI runs it again with the Playwright smoke test.
5. **Review in a fresh context.** A new session (or a subagent) that didn't write the diff
   reviews it against [review.md](review.md), using `/code-review`.
6. **Merge.** Then mark the step done in the plan file.

## Rules

- Project state lives in the repo: the plan file says where a slice stands. Don't rely on what
  an agent remembers from an earlier session.
- A structural choice or a scope limit gets an ADR in [adr/](adr).
- An agent may propose properties to test; Sathira approves each one. Agents often report bugs
  that aren't bugs, so check a finding before acting on it.
- Use the mid-tier model by default and a stronger one only when a task needs it.
- Judge the process by [metrics.md](metrics.md), not by how fast it feels. Get an outside code
  review now and then.
