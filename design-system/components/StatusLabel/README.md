# StatusLabel

App only (`src/client/components/StatusLabel.tsx`; mapping in `src/domain/status-label.ts`). Pending, Approved or Rejected with no new colours. The word always says it, and a treatment says it a second way:

- Pending: outline (1px `fg-strong` border on `bg`).
- Approved: fill (`accent` with `accent-fg` text).
- Rejected: struck through, on `bg`.

Bold 16px, 32px high, sentence case. Prop: `status` (`pending` | `approved` | `rejected`). It is not interactive.
