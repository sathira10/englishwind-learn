# Design brief: icons and app elements (Q25)

**Status, 6 November 2026: landed upstream and synced.** All of it is in `englishwind-web/design-system` (branch `feat/design-system-icons`) and the design-system artifact, and here through `pnpm ds:sync`. It adds `components/Icon` and `assets/Interface/` (ten icons), the Select, Checkbox and Loading components, and the eight app components moved upstream. New tokens: `dialog-max`, `toast-max`, `row-min`, `radius-control`, `overlay-scrim` (opaque, an alias of `surface-dark`), `icon-sm` and `icon-md`. `shadow-overlay` is not a token: the system has no shadows, and the README's Overlays rule says so. The app-level custom properties in `global.css` are gone. Still to do in a follow-up slice: switching the components to the icons, and building Select and Checkbox to the new specs.

6 November 2026. For Sathira, to add upstream in `englishwind-web/design-system`, then bring back
here with `pnpm ds:sync`. The app is built word-only for now (slice 14). Once this lands, the app
switches to these icons and elements.

## 1. Rule change

The design-system README, under "Imagery and iconography", allows only the three brand marks and the
theme switch's moon and sun. Amend it to allow one small set of UI icons:

- One set, one stroke weight, drawn in `currentColor` (so it follows `fg-*`). No icon library;
  SVGs live in the design system like `BrandIcon`.
- 20px beside a visible label. 24px when an icon is the whole control, inside a target of at least
  44px (`tap-min`), with an `aria-label`.
- Icons are additions to labels. Status is never shown by an icon or colour alone.

## 2. Icons the app needs

| Icon           | Where it's used now (word or glyph)                                                                    | Size / use                      |
| -------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Tick / check   | `LessonCompleteMark` ("Complete") on the course page and lesson page; approved status                  | 20px with label                 |
| Close (×)      | Toast "Dismiss" button; dialog close                                                                   | 24px control                    |
| Arrow left     | "← Back to the course", "← Previous: …" (lesson page)                                                  | 20px with label                 |
| Arrow right    | "Next: … →" (lesson page), "Open →" (My Courses), "Review →" (admin queue rows)                        | 20px with label                 |
| Chevron right  | A `ListRow` that is a link: shows the row leads somewhere                                              | 20px, decorative                |
| Chevron down   | Native `<select>` in the admin (`ew-field`)                                                            | 20px, decorative                |
| Download       | Worksheet links ("Download: …")                                                                        | 20px with label                 |
| Play           | Lesson rows; the Vimeo fallback panel                                                                  | 20px with label                 |
| Busy / loading | `Button` with `loading` (now only swaps the label, e.g. "Saving")                                      | 20px, no spin if reduced motion |
| Sign out       | Optional, header "Sign out"                                                                            | 20px with label                 |
| WhatsApp mark  | Already a brand mark in `BrandIcon`; confirm it may appear in the app's "message us on WhatsApp" links | 20px with label                 |

## 3. Tokens to add to `tokens.json`

These are now app-only custom properties in `src/client/styles/global.css` and should become tokens:

| Token              | Value here now                             | Note                                          |
| ------------------ | ------------------------------------------ | --------------------------------------------- |
| `--dialog-max`     | `28rem`                                    | Dialog width                                  |
| `--toast-max`      | `26rem`                                    | Toast width                                   |
| `--row-min`        | `var(--tap-min)`                           | List row height                               |
| `--radius-control` | `var(--radius-sm)`                         | Controls and overlays                         |
| `--shadow-overlay` | `none`                                     | Overlays separate by a 1px `line` border      |
| `--overlay-scrim`  | `color-mix(surface-dark 60%, transparent)` | Replace with an **opaque** scrim colour token |

## 4. Components to define upstream

Their READMEs already exist in this repo's `design-system/components/` and should move upstream so
`ds:sync` owns them: ConfirmDialog, Toast, ListRow, EmptyState, StatusLabel, LessonCompleteMark,
VimeoFrame, TextField.

Also missing from the design system:

- **Select**: an `ew-field` variant with the chevron-down icon (admin `Select.tsx`).
- **Checkbox**: a styled checkbox with the tick icon, 24px box, 48px row (admin `Checkbox.tsx`
  now uses the native input with `accent-accent`).
- **Loading state**: what "Loading..." looks like on a page and inside a button.
- **StatusLabel**: confirm the outline, fill and strike treatments for pending, approved and
  rejected, or add the tick and close icons to them.
