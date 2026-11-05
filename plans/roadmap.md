# Roadmap to launch

5 November 2026. Baseline: `main` at `8b7bdc2` (scaffold, plan 00, done).

Launch is **Monday 16 November 2026**: bank-transfer sales end to end, the 5 existing buyers
learning on the new app. The order of slices follows the EnglishWind Launch Plan, cut so each
one ships with its own tests. Each slice gets its own plan file and its own branch
(`claude/slice-NN-name`) and PR into `main`. Slices that depend on an unmerged one branch from
it, so their PRs stack; merge them in number order.

Not cut under any schedule (launch plan): a grant checked on every lesson and file request,
worksheets only from private R2, approve-once for bank transfers, and a tested backup restore.

What needs Sathira, and the default each slice builds on until answered, is in
[OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).

## Before launch

Waves run in parallel where slices don't touch the same code. Dates are when the PR should be
up for review, so that Sathira's review and the staging checks fit the remaining week.

| #   | Slice                                                                                                                                               | Depends on | PR by  | Done when                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------- |
| 01  | Data model: first D1 migration (students, courses, course_publications, resources, offers, orders, grants, lesson_progress, staff_roles, audit_log) | 00         | 6 Nov  | Migration applies locally and on staging; schema tests pass                         |
| 02  | Grant rules in `src/domain/`: is a grant current, 3-year access from the start date, extend, revoke                                                 | 00         | 6 Nov  | Reference cases and approved properties pass; mutation testing added here           |
| 07  | Bank-transfer order rules in `src/domain/`: pending order with a reference, approve once, reject, class-linked prices                               | 00         | 6 Nov  | Reference cases pass, including approve-twice and class-linked prices               |
| 03  | Auth: Better Auth on D1, email code first, Google second, rate limits in D1                                                                         | 01         | 8 Nov  | A test student signs in on staging and the login email arrives                      |
| 04  | Blueprint course definition from `blueprint-v1`, with a publish command that writes it to D1                                                        | 01         | 8 Nov  | Course and 13 lessons readable through the API for a granted student                |
| 08  | Admin access: Cloudflare Access JWT verified, role from `staff_roles`                                                                               | 01         | 8 Nov  | Amma opens a staging admin page on her phone                                        |
| 05  | Lesson and worksheet access: grant check on every lesson and file route, worksheets streamed from private R2                                        | 02, 03, 04 | 9 Nov  | A student with a grant gets lessons and files; one without gets nothing             |
| 13  | Order form and order API: a buyer places a bank-transfer order on learn.englishwind.lk and sees the transfer instructions                           | 03, 07     | 10 Nov | A test order shows in D1 with its reference, and the buyer sees the bank details    |
| 09  | Admin screens: home queue, approve or reject, create order, student search and detail, grant, extend, revoke, attach order, audit log               | 07, 08     | 11 Nov | Amma approves a test transfer on her phone and the student gets access unaided      |
| 06  | Student screens: sign-in, My Courses, course page, lesson player (Vimeo), mark complete, last lesson visited                                        | 05         | 11 Nov | A granted student watches a lesson and downloads a worksheet on staging, on a phone |
| 10  | Emails: login code, order received with transfer instructions, access granted                                                                       | 03, 13, 09 | 12 Nov | Delivery checked on Gmail, Yahoo and the providers students use                     |
| 11  | Operations: daily D1 export and R2 copy outside Cloudflare, one restore done                                                                        | 01         | 12 Nov | Restore rehearsed and written down                                                  |
| 12  | Migration: 5 existing buyers imported with 3 years from their original dates                                                                        | 02, 04     | 13 Nov | All 5 sign in on the new app                                                        |
| 14  | App components: button, dialog, toast, list row, empty state, status label, lesson-complete mark, Vimeo frame, 3:1 text field                       | 00         | 9 Nov  | Every component shown at /dev/components passes the design rules at 375px           |

13 is new on 5 Nov: the launch plan puts a bank-transfer order form on the public site, and its
API has to live here. ADR 0007 puts the form itself on the app's host too. The public site's
Blueprint button then only needs a link (englishwind-web, separate work).

### Sathira's path to launch

Things only Sathira can do, in the order the slices need them. Each is also a row in
[OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).

1. 6–7 Nov: review and merge 00, 01, 02, 07. Approve the reference cases in plans 02 and 07 and
   commit them to `tests/reference/` with the trailer.
2. 7 Nov: create the Cloudflare resources and GitHub secrets in [docs/deploying.md](../docs/deploying.md),
   a staging host, and the Access application for `/admin`.
3. 8 Nov: Google OAuth client, email sending domain, R2 upload of the 8 worksheets.
4. 10 Nov: add the staging and production hosts to every Vimeo video's allowlist.
5. 12–14 Nov: Amma's phone rehearsal, the 5 buyers' purchase dates, restore rehearsal.
6. 15–16 Nov: production deploy, DNS for learn.englishwind.lk, site button pointed at the order
   form, sign-in message to the 5 buyers.

### Cut line

If the week runs short, in this order: Google sign-in (launch with email code only), then the
admin's create-order and attach-order screens (Amma uses the order form on a buyer's behalf),
then audit-log browsing (rows are still written). Never the four rules above.

## After launch

1. Lemon Squeezy checkout as a payment adapter (signed webhook, event dedup, refunds revoke one grant).
2. PayHere adapter, once approved.
3. Second course, family course publishing, expiry reminders, sales reports.
