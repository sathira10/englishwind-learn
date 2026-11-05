# 0007: The order form lives on the app's host

5 November 2026. Accepted (default until Sathira says otherwise; plans/OPEN-QUESTIONS.md Q14, Q15).

## Context

The launch plan puts a bank-transfer order form behind the public site's Blueprint button.
`englishwind-web` is static Astro with a strict CSP and no server code, and orders must land in
this app's D1 with a reference Amma can match against a bank SMS.

## Decision

The form is a page of this app at `/order/:offer` (for example `/order/blueprint`), posting to
`POST /api/orders` on the same origin. The public site's button is a plain link to it. Buyers do
not need an account to order: the order stores the email they give, and it attaches to the
account with that email when they first sign in. Amma can also attach it by hand.

## Consequences

- No CORS, no new origin in the site's CSP, and the site stays static.
- The order API is public, so it is rate limited per IP in D1 and validates every field with Zod.
  It never returns another buyer's data.
- The price shown and charged is read from the `offers` row on the server, never from the form.
