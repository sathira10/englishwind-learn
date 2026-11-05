# Plan 05: Lesson and worksheet access

5 November 2026. Baseline: `claude/integration` at `502a800`.

After this slice a signed-in student with a current grant can read their course, open a lesson
(with its Vimeo id), mark it complete and download its worksheet, and a student without one gets
nothing.

## Spec

### Inputs and outputs

All routes are under `/api`, behind `requireStudent`. The student id comes from the session.
Grants are read from D1 at request time and checked with `hasAccess` (plan 02). Shapes are zod
schemas in `src/shared/access.ts`, strict, with no field for an R2 key.

| Route                                           | Success                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `GET /courses`                                  | `{ courses: [{ courseId, title, accessEndsAt }] }`, current grants only     |
| `GET /courses/:courseId`                        | `{ course: PublishedCourse, accessEndsAt, progress[] }`, latest publication |
| `GET /courses/:courseId/lessons/:key`           | `{ view: LessonView, progress \| null }`, includes `vimeoId`                |
| `POST /courses/:courseId/lessons/:key/complete` | `{ progress }`; upsert, keeps the first `completedAt`, sets `lastVisitedAt` |
| `POST /courses/:courseId/lessons/:key/visit`    | `{ progress }`; upsert `lastVisitedAt`, never clears `completedAt`          |
| `GET /worksheets/:resourceId`                   | The PDF bytes streamed from private R2                                      |

Times are epoch milliseconds (UTC). Worksheet headers: `Content-Type` from `resources`,
`Content-Disposition: attachment; filename="<label>.pdf"` (from the label, never the key),
`Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`.

### Status codes (decision)

| Situation                                                            | Answer                           |
| -------------------------------------------------------------------- | -------------------------------- |
| No session                                                           | 401 `{ error: "unauthorized" }`  |
| No current grant (none, expired, revoked, not started, other course) | **403** `{ error: "no_access" }` |
| Unknown course, unknown or malformed lesson key, unknown resource    | 404 `{ error: "not_found" }`     |
| Worksheet row exists but the R2 object is missing                    | 404 `{ error: "not_found" }`     |

403 is used for every missing grant, on every route, with an identical body that carries no
Vimeo id, key or title. The course (or resource) is looked up before the grant, so a student
without a grant can learn that a course or resource id exists; course ids are public on the site
and worksheet ids are guessable by design (`<course>-lesson-NN`). `GET /courses` lists nothing
(200, empty) rather than failing. No grant means no progress is written.

### Reference cases

Mirror of tests in `tests/unit/lesson-access.test.ts`, pending Sathira's copy in
`tests/reference/` (Q10).

| Case | Given                                                  | Expected                                                    |
| ---- | ------------------------------------------------------ | ----------------------------------------------------------- |
| R1   | No session, any route                                  | 401                                                         |
| R2   | Signed in, no grant, every content route               | 403 `no_access`, no Vimeo id, key or PDF bytes; no progress |
| R3   | Expired grant; revoked grant; grant not started yet    | 403 on every content route; `GET /courses` is empty         |
| R4   | Grant for another course only                          | 403 for this course; `GET /courses` lists the other one     |
| R5   | Current grant                                          | Course (13 lessons) with progress; lesson with `vimeoId`    |
| R6   | Current grant, worksheet in R2                         | PDF bytes identical to the object, attachment headers       |
| R7   | Current grant, worksheet missing in R2                 | 404                                                         |
| R8   | Unknown course, lesson `99` or `abc`, unknown resource | 404                                                         |
| R9   | Complete twice, then visit                             | One row; first `completedAt` kept; `lastVisitedAt` moves    |

### Properties

- [ ] No response body or header of any student route contains an R2 key (approved: no)
- [ ] A route that returns course content answers 200 only if `hasAccess` is true at request time (approved: no)

### Out of scope

Screens (slice 06), staff reading content, signed URLs or range requests for worksheets, caching,
Vimeo domain-level privacy (Q9), real `resources.bytes`.

### How it is checked

- Tests: `tests/unit/lesson-access.test.ts` on real local D1 and R2 in workerd, through the real
  app and Better Auth sign-in; every route is hit with no session and with no grant.
- Manual: on staging after Q1 and Q8, a granted test student downloads a worksheet.
- Review failure modes: a route returning content without a grant check, an R2 key or Vimeo id
  in an error, a worksheet served with an inline disposition or cacheable.

## Steps

1. **Types, routes, tests, plan.** One PR. Done when `pnpm check` passes.

## Decisions

403 over 404 for missing grants, as above: the student sees "you don't have access" rather than a
page that looks broken. No new ADR.
