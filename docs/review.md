# Review checklist

The failure modes to look for in every diff, most costly first. A reviewer names which ones
apply and checks each.

## Access

- A route returns a lesson, a Vimeo ID or a worksheet without checking for a current grant on
  the server. Hiding a link in the UI is not a check.
- An R2 key, bucket path or long-lived signed URL reaches the client. Worksheets stream through
  the Worker.
- `/admin` or an admin API trusts the `Cf-Access-Authenticated-User-Email` header, or any other
  header, without verifying the Access JWT and then the role in `staff_roles`.
- A staff action that changes an order or grant writes no `audit_log` row.

## Money and orders

- A bank transfer can be approved twice, or approval creates two grants. Approval must be
  idempotent.
- Amounts stored as floats or as rupees with decimals. Money is integer LKR cents.
- A payment adapter writes orders or grants in its own shape instead of through the shared
  order and grant functions.

## Data

- Work that must be all-or-nothing done in several D1 calls instead of one `batch()`. D1 has no
  interactive transactions.
- A schema change made without a new SQL migration, or an applied migration edited.
- Access periods counted in months or days instead of the 3-year rule from the purchase date,
  or dates compared without a timezone. Store UTC; show Asia/Colombo.

## Secrets and privacy

- A secret in a `PUBLIC_*` variable, in `wrangler.jsonc` `vars`, or in the client bundle.
- Email addresses, names or phone numbers in logs or error messages.

## Design

- Raw colours outside `design-system/tokens.css` (`pnpm check:tokens` catches most).
- Text under 16px, tap targets under 44px, or a control with no visible focus.
- A fact (price, access period, bank details) typed into a component instead of read from data.

## Tests

- A test changed so a failing change passes. Ask why the test was wrong.
- Logic with no test in `src/domain/`, or a route tested only through the UI.
