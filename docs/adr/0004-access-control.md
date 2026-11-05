# 0004: Grants on the server, private R2, Access plus role for admin

6 November 2026. Accepted.

## Context

Paid lessons and worksheets must reach only students with a current grant. The old app shipped
worksheets in its public deploy, safe only while every route to it sat behind Access. Amma
approves payments from her phone.

## Decision

- The API returns a Vimeo ID or streams a worksheet only after finding a current grant for the
  signed-in student. Access is 3 years from the purchase date.
- Worksheets live in a private R2 bucket and are streamed by the Worker. No public bucket, no
  long-lived signed URLs.
- Students sign in with Better Auth on D1: Google first, email code second, rate limits stored
  in D1.
- `/admin` sits behind Cloudflare Access. The Worker verifies the Access JWT and then checks
  the email's role in `staff_roles` on every admin request.
- Vimeo embeds are domain-locked per video; Cloudflare Stream is the fallback.

## Consequences

- Access never depends on a URL staying secret.
- Every lesson and file route needs a test for "no grant gets nothing".
- Two checks guard admin, so a misconfigured Access policy alone doesn't open it.
