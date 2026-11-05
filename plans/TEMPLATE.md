# Plan NN: <slice name>

<date>. Baseline: `<branch>` at `<commit>`.

One sentence: what a student, Amma or Sathira can do after this slice that they couldn't before.

## Spec

Agree this section before writing code.

### Inputs and outputs

| Name | Type and unit | Notes |
| --- | --- | --- |
| | e.g. `amountCents: integer, LKR cents` | |

Times are UTC in storage and Asia/Colombo on screen. Money is integer LKR cents.

### Reference cases

Hand-checked examples with the expected result. These become `tests/reference/` cases, written
or approved by Sathira.

| Case | Given | Expected |
| --- | --- | --- |
| | | |

### Properties

Rules that hold for every input (for property tests). The agent may propose them; Sathira
approves each one before it becomes a test.

- [ ] <property> (approved: no)

### Out of scope

-

### How it is checked

- Tests: which layer covers what.
- Manual: what to look at on staging, and on which device.
- Failure modes from `docs/review.md` that apply here.

## Steps

Each step is one PR you can describe in one sentence. Logic before UI.

1. **<step>.** Goal, changes, done when.

## Decisions

Link any ADR this slice adds.
