# Plan 06: student screens

5 November 2026. Baseline: `claude/integration` (plans 03, 04, 05 and 14 merged).

After this slice a granted student can sign in on a phone, see their courses, open a lesson, watch
it, download its worksheet, mark it complete and come back to where they left off.

## Spec

### Inputs and outputs

All data comes from the slice 05 API; the screens add one small route and no new tables.

| Screen          | Path                              | Calls                                                                                                                                                                     |
| --------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in         | `/sign-in?next=<path>`            | `POST /api/auth/email-otp/send-verification-otp`, `POST /api/auth/sign-in/email-otp`, `GET /api/me`, `GET /api/sign-in-options`, `POST /api/auth/sign-in/social` (Google) |
| My Courses      | `/`                               | `GET /api/courses`                                                                                                                                                        |
| Course page     | `/courses/:courseId`              | `GET /api/courses/:courseId`                                                                                                                                              |
| Lesson page     | `/courses/:courseId/lessons/:key` | `GET` the lesson, then `POST .../visit`; `POST .../complete` from the button; worksheet links to `GET /api/worksheets/:id`                                                |
| Sign-in options | `GET /api/sign-in-options` (new)  | `{ google: boolean }`: true only when both Google keys are set. Never returns a key                                                                                       |

Pure helpers in `src/domain/student-screens.ts`:

| Helper                             | In and out                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `formatAccessEnd(ms)`              | epoch ms (UTC) to "6 November 2029", the Asia/Colombo date                                       |
| `lessonLabel(number)`              | `null` to "Welcome", 7 to "Lesson 7"                                                             |
| `pickContinueLesson(course, rows)` | the published lesson with the latest `lastVisitedAt`, or null                                    |
| `completionCount(course, rows)`    | `{ done, total }` over lessons still published                                                   |
| `safeReturnTo(path)`, `signInUrl`  | keeps only a path on this site; the sign-in URL carries it as `next`                             |
| `classifyCodeError(status, code)`  | Better Auth's answer to `wrong_code`, `too_many_attempts` (403), `rate_limited` (429) or `other` |
| `cleanCode(text)`                  | digits only, at most 6                                                                           |

Behaviour:

- **401 anywhere** sends the student to `/sign-in?next=<where they were>`; after sign-in they
  return there. **403 `no_access`** shows "You don't have access to this course" with a link to
  `/order/blueprint` (the one course at launch). **404** shows "That page isn't here" and says
  course access is fine. **403 `email_not_verified`** shows "Confirm your email first".
- Sign-in states: wrong or expired code (400), too many wrong tries (403, offers a new code),
  rate limited (429, on send and on check), send failed, unverified email, Google failed.
- Opening a lesson posts a visit after the lesson loaded (never for a student without access).
  Marking complete posts, shows the toast "Lesson marked complete." and swaps the button for the
  Complete mark. A failure shows a notice and keeps the button.
- Lesson 00 shows no number anywhere; the rest show the publication's number.
- Copy says "class materials and resources", never "books". Dates are Asia/Colombo.
- Mobile first: one column, 16px minimum text, 48px controls, the components' focus ring.

### Reference cases

Mirror of tests in `tests/unit/student-screens.test.ts`, pending Sathira's copy in
`tests/reference/` (Q10).

| Case | Given                                                                                  | Expected                                                              |
| ---- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| S1   | Access ends 2029-11-05 22:00 UTC; 18:29 UTC; 18:30 UTC                                 | "6 November 2029"; "5 November 2029"; "6 November 2029"               |
| S2   | Lesson number null; 7                                                                  | "Welcome"; "Lesson 7"                                                 |
| S3   | Lesson 01 visited at 100 (completed at 90), lesson 02 at 50; then 01 at 100, 02 at 200 | continue is 01; then 02                                               |
| S4   | No rows; a row never visited; a row for lesson 99 (not published)                      | null in each case; with 99 and 01 both visited, 01                    |
| S5   | 00 complete, 02 visited only, 99 complete; 3 published lessons                         | `{ done: 1, total: 3 }`                                               |
| S6   | `/courses/blueprint/lessons/03`                                                        | kept                                                                  |
| S7   | `https://evil.example`, `//evil.example`, `/\evil`, `javascript:`, empty, `/sign-in`   | "/"                                                                   |
| S8   | Sign-in URL for a lesson path; for "/"                                                 | `/sign-in?next=%2Fcourses%2F...`; `/sign-in`                          |
| S9   | 400 `INVALID_OTP`; 403; 429; 500                                                       | wrong_code; too_many_attempts; rate_limited; other                    |
| S10  | "123 456", "12-34-56-78", "abc"                                                        | "123456", "123456", ""                                                |
| S11  | One course ending 2029-11-05 22:00 UTC                                                 | row links to `/courses/<id>`, "Access until 6 November 2029"          |
| S12  | No courses                                                                             | "No courses yet", link to `/order/blueprint`, no "books"              |
| S13  | Course page, 00 complete, 02 last visited                                              | 00 has no number, others "1." "2.", one Complete mark, continue to 02 |
| S14  | Nothing visited                                                                        | no continue link                                                      |
| S15  | `GET /api/sign-in-options` with no keys, one key, both keys                            | `{google:false}`, `{google:false}`, `{google:true}`                   |

### Properties

- [ ] `safeReturnTo` returns "/" or a string starting with a single "/" for every input (approved: no)
- [ ] `pickContinueLesson` returns null or a lesson that is in the course (approved: no)

### Out of scope

- The order form (`/order/...`, slice 13) and the admin screens (slice 09). The no-access link
  points at `/order/blueprint` and works once slice 13 lands.
- A real WhatsApp link: the repo has no number yet (Q26). The copy names WhatsApp without a link.
- Detecting that Vimeo refused a video (browsers give no event). The fallback shows only for an
  invalid id until Q9 is done and we can see what staging does.
- Offline use, resuming the video position, certificates, a profile page.

### How it is checked

- Tests: `tests/unit/student-screens.test.ts` (helpers in Node-like workerd, the list views as
  static markup, the options route). `tests/e2e/smoke.spec.ts`: signed-out visit is sent to
  sign-in with `next` kept, the screen fits 375px. It needs no email.
- Manual (staging, after Q1, Q6, Q8, Q9, on a phone): with a test student that has a grant, sign
  in with the emailed code; My Courses shows the end date; open lesson 3; the video plays; the
  worksheet downloads; Mark complete shows the toast and the Complete mark; reload the course
  page and the Continue link points at lesson 3; sign out and open the lesson link, sign in, land
  back on it. Then a student with no grant sees the no-access screen.
- Failure modes from `docs/review.md`: a Vimeo id or worksheet shown before the server checked
  the grant (the id comes only from the lesson response); no R2 key in the client (shapes are
  the strict slice 05 schemas); no email in logs; text and tap sizes; raw colours.

## Steps

1. **Domain helpers and tests.** `src/domain/student-screens.ts`. Done when S1 to S10 pass.
2. **Screens and routes.** `src/client/screens/`, `api.ts`, `use-load.ts`, `ButtonLink`,
   `GET /api/sign-in-options`. Done when S11 to S15 pass and `pnpm check` is green.
3. **Smoke test and plan.** Playwright flow and this file. Done when `pnpm test:e2e` passes.

## Decisions

- Plain `fetch` to Better Auth's routes, not its client library: two calls, no new dependency,
  and the error codes are what `classifyCodeError` reads.
- The Google button is driven by `GET /api/sign-in-options` so it hides when Q5 is unanswered.
- The sign-in screen checks `/api/me` after the code, so an unconfirmed email shows its own
  message instead of a blank course list.
- Worksheets are plain links with `download`; the cookie is sent on a same-origin navigation and
  the Worker streams the bytes (plan 05).
