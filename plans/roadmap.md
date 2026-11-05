# Roadmap to launch

6 November 2026. Baseline: `main` after the scaffold (plan 00).

The order of slices from the EnglishWind Launch Plan, cut so each one ships with its own tests.
Each slice gets its own plan file before it starts. The public site and its order form are in
`englishwind-web`, not here.

Not cut under any schedule (launch plan): a grant checked on every lesson and file request,
worksheets only from private R2, approve-once for bank transfers, and a tested backup restore.

## Before launch

| # | Slice | Done when |
| --- | --- | --- |
| 01 | Data model: first D1 migration (students, courses, course_publications, resources, offers, orders, grants, lesson_progress, staff_roles, audit_log) | Migration applies locally and on staging; schema tests pass |
| 02 | Grant rules in `src/domain/`: is a grant current, 3-year access from the purchase date, extend, revoke | Reference cases and approved properties pass; mutation testing added here |
| 03 | Auth: Better Auth on D1, Google sign-in, then email code, rate limits in D1 | A test student signs in on staging and the login email arrives |
| 04 | Blueprint course definition from `../blueprint-v1`, with a publish command that writes it to D1 | Course and 13 lessons readable through the API for a granted student |
| 05 | Lesson and worksheet access: grant check on every lesson and file route, worksheets streamed from private R2 | A student with a grant gets lessons and files; one without gets nothing |
| 06 | Student screens: My Courses, course page, lesson player (Vimeo), mark complete, last lesson visited | Exit check of launch week 2 passes on staging |
| 07 | Bank-transfer orders in `src/domain/`: pending order with a reference, approve once, creates the grant | Reference cases pass, including approve-twice and class-linked prices |
| 08 | Admin access: Cloudflare Access JWT verified, role from `staff_roles` | Amma opens a staging admin page on her phone |
| 09 | Admin screens: home queue, approve or reject, create order, student search and detail, grant, extend, revoke, attach order, audit log | Amma approves a test transfer on her phone and the student gets access unaided |
| 10 | Emails: login code, order received with transfer instructions, access granted | Delivery checked on Gmail, Yahoo and the providers students use |
| 11 | Operations: daily D1 export and R2 copy outside Cloudflare, one restore done | Restore rehearsed and written down |
| 12 | Migration: 5 existing buyers imported with 3 years from their original dates | All 5 sign in on the new app |

## After launch

1. Lemon Squeezy checkout as a payment adapter (signed webhook, event dedup, refunds revoke one grant).
2. PayHere adapter, once approved.
3. Second course, family course publishing, expiry reminders, sales reports.
