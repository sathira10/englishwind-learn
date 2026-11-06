# StatusLabel

App only (englishwind-learn, `src/client/components/StatusLabel.tsx`; mapping in `src/domain/status-label.ts`). Shows Pending, Approved or Rejected with no new colours. The word always says the status. The treatment, and for two of them an icon, says it a second way:

- Pending: outline (a 1px `fg-strong` border on `bg`), no icon.
- Approved: fill (`accent` with `accent-fg` text) and a `check` icon before the word.
- Rejected: struck-through word on `bg` and a `close` icon before it.

Classes: `ew-status` plus `ew-status-pending`, `ew-status-approved` or `ew-status-rejected`. Text is bold 16px, the label is 32px high and in sentence case. The icons are 20px and decorative. Prop: `status` (`pending` | `approved` | `rejected`). It is not interactive.
