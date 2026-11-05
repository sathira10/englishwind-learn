# Plan 04: Blueprint course definition and publish command

5 November 2026. Baseline: `claude/slice-01-data-model` (plan 01 is done there).

After this slice the Blueprint course (6 modules, 13 lessons) is typed data in the repo, and one
command writes it, versioned, into any environment's D1, with the worksheet PDFs' R2 keys kept on
the server side only.

## Spec

### Inputs and outputs

| Name                     | Type and unit                                                                                                                                   | Notes                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `CourseDefinition`       | `{ id, title, intro, modules[{ name, blurb?, lessons[{ key, title, vimeoId, blurb?, worksheets[{ label, file }] }] }] }`                        | Authored in `content/courses/<id>.ts`. `file` is the R2 key. Server only.                    |
| `lesson.key`             | string, two digits `'00'`..`'12'`                                                                                                               | Stable id. Progress and worksheets hang off it. Never renumbered.                            |
| `lesson.vimeoId`         | string of digits                                                                                                                                | The numeric id from the Vimeo URL.                                                           |
| `worksheet.file`         | string `courses/<courseId>/lesson-NN.pdf`                                                                                                       | Q8. Object key in the private bucket.                                                        |
| `PublishedCourse`        | same tree, plus `number`, module `index` and `label`; worksheets are `{ id, label }`                                                            | Stored as `course_publications.content_json`. No R2 key anywhere.                            |
| `LessonView`             | `{ courseId, lesson, moduleLabel, moduleName, previous, next }`                                                                                 | What slice 05 returns for one lesson.                                                        |
| `toPublication(def)`     | `{ content, contentJson, resources[] }`                                                                                                         | `resources` become `resources` rows (id, course, lesson, kind, label, r2_key, content_type). |
| `publishStatements(def)` | SQL strings, one statement each                                                                                                                 | Upsert resources, then insert version `max+1`.                                               |
| Commands                 | `pnpm course:publish <id> --env <local\|staging\|production> [--dry-run] [--by who]`; `pnpm course:upload-commands <id> [--env e] [--from dir]` |                                                                                              |

Numbering: lesson `number` is the integer value of `key`; `'00'` (the welcome) is `null` and shows
without a number. Module label is `Module <zero-based index>`. Times are epoch milliseconds (UTC)
in `published_at`.

Resource ids are deterministic (`<course>-<key>-w<n>`, e.g. `blueprint-03-w1`), so publishing
again updates the same row instead of adding one. `bytes` is stored as 0 on insert and left alone
on update: the script cannot know the size before the PDFs are uploaded, and nothing in slices 04
to 06 reads it.

### Reference cases

They are also normal tests in `tests/unit/course.test.ts`, pending Sathira's copy in
`tests/reference/` (Q10).

| Case | Given                                                                            | Expected                                                                        |
| ---- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| R1   | The Blueprint definition                                                         | Valid; 6 modules; keys `00`..`12`; worksheets on 00, 01, 03, 04, 05, 06, 07, 08 |
| R2   | Each Blueprint worksheet                                                         | `courses/blueprint/lesson-NN.pdf` where NN is its lesson key                    |
| R3   | Two lessons with key `01`                                                        | Invalid: duplicate key                                                          |
| R4   | Vimeo id `https://vimeo.com/1216572629`, `""` or `12a`                           | Invalid                                                                         |
| R5   | Worksheet file `lesson-00.pdf`, `courses/other/..`, `courses/blueprint/../x.pdf` | Invalid                                                                         |
| R6   | Lessons `00` and `07`; module positions 0..5                                     | `00` has no number, `07` is 7; labels `Module 0`..`Module 5`                    |
| R7   | Publish Blueprint to the test D1 once                                            | 1 publication (version 1) with 13 lessons; 8 resource rows                      |
| R8   | Publish it again                                                                 | Versions 1 and 2; still 8 resource rows                                         |

### Properties

- [ ] The student-facing course and lesson view never contain an R2 key, `courses/` or `.pdf` (approved: no)
- [ ] Previous of the first lesson and next of the last are null; otherwise previous(next(x)) = x (approved: no)

### Out of scope

API routes and grant checks (slice 05), screens (06), uploading the PDFs (Sathira runs the printed
commands, Q8), real sizes in `resources.bytes`, the "Sample reference" link (dropped, Q21),
changing `courses.title` or `access_years` (set by the seed migration).

### How it is checked

- Tests: `tests/unit/course.test.ts`. Domain functions are pure; the generated SQL runs on real
  local D1 in workerd.
- Manual: `pnpm course:publish blueprint --env local --dry-run` prints the SQL. After Q1, publish
  to staging and read `course_publications` back.
- Review failure modes: a worksheet key leaking to a student (the test above), publishing twice
  duplicating rows, a lesson renumbered under a student's progress.

## Steps

1. **Definition, transforms, command, tests, docs.** One PR: `content/courses/blueprint.ts`,
   `src/shared/course.ts`, `src/domain/course.ts`, `scripts/course.mjs`, tests, a section in
   `docs/deploying.md`. Done when `pnpm check` passes and the dry run prints 8 resources and 1
   publication.

## Decisions

- **`content/courses/` at the repo root, not `src/content/`.** Everything under `src/client` and
  `src/worker` can end up in a bundle. The definition holds R2 keys and is only read by the
  publish script and tests, so it lives outside `src/`. At runtime the app reads the published
  rows from D1 (one source of truth, versioned), never this file.
- **No `tsx`.** The script runs under Node's built-in type stripping
  (`node --experimental-strip-types`, stable enough in Node 22.6+; the repo requires >= 22.13).
  That needs `.ts` extensions in imports of files the script loads, so `allowImportingTsExtensions`
  is on in `tsconfig.base.json` (type-checking only, nothing is emitted).
- **The stored publication is the student-facing shape.** Slice 05 can return it (or one lesson
  of it) as is. Worksheet downloads go by `resources.id`, and the Worker looks the R2 key up in D1.
- **Keys are explicit, not derived from order**, so inserting a lesson later never renumbers
  progress. Display numbers derive from the key.
- **Lessons nest inside modules** in the definition, so a lesson's module is its position, not a
  field that can disagree.
- Each publish makes a new version even if nothing changed; the highest version is the live one.
