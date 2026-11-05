# Plans

The thinking that drives the code. Each file says what to build, in what order, and why. Agents
start a slice from its plan file, not from what they remember.

## Files

| File                                     | Status                                               |
| ---------------------------------------- | ---------------------------------------------------- |
| [00-scaffold.md](00-scaffold.md)         | Done: repo, toolchain, guards, CI                    |
| [01-data-model.md](01-data-model.md)     | Done: first D1 migration, seed, schema tests         |
| [08-admin-access.md](08-admin-access.md) | Active: Access JWT verified, role from `staff_roles` |
| [roadmap.md](roadmap.md)                 | Active: the slices to launch, in order               |
| [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md)   | Active: what needs Sathira, with defaults            |
| [TEMPLATE.md](TEMPLATE.md)               | Copy for each new slice                              |

## How plans are written

- One file per slice, numbered in roadmap order: `NN-short-name.md`, copied from `TEMPLATE.md`.
- Each opens with a date and a baseline: the branch and commit it was written against.
- The spec comes first and is agreed before any code: inputs and outputs with units, reference
  cases with expected results, what is out of scope, and how the result is checked. Then the
  steps, each one PR you can describe in one sentence.
- A step names its goal, its changes and when it's done. Split anything bigger.
- Structural choices and scope limits get an ADR in `../docs/adr/`, linked from the plan.
- When a plan is finished, mark it Done here. When it is replaced, say by what.
