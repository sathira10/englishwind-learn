# Plan 14: App components

5 November 2026. Baseline: `claude/slice-00-launch-roadmap`.

After this slice the student screens (06) and the admin screens (09) can be built from a small set of
React components that follow the design system, instead of each screen inventing its own button,
dialog and list.

## Spec

The components are thin React wrappers over the design system's `ew-*` classes, tokens and the
Tailwind role mappings in `src/client/styles/global.css`. No second component library, no new
colours, no new dependency. Source: the launch plan (27 Oct), "the apps need these additions".

### Inputs and outputs

| Component            | Props                                                                                                   | Renders                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Button`             | `variant` primary or secondary, `outline`, `small`, `loading`, `loadingLabel`, `disabled`, native props | `<button class="ew-btn ...">`, 48px high. Loading sets `aria-busy` and `aria-disabled`, drops clicks |
| `ConfirmDialog`      | `open`, `title`, `children`, `confirmLabel`, `cancelLabel`, `busy`, `onConfirm`, `onClose`              | Native `<dialog>` opened with `showModal()`. The browser traps focus; Esc calls `onClose`            |
| `ToastProvider`      | wraps the app; `useToast().show(message, { durationMs? })`                                              | One always-present polite live region; each toast dismisses itself and has a Dismiss button          |
| `ListRow`            | `title`, `meta`, `trailing`, and one of `to` (link), `onClick` (button) or neither (static row)         | `<li>`; the whole row is the 44px+ target when it is a link or a button                              |
| `EmptyState`         | `title`, `children`, `action`, `headingLevel`                                                           | A flat `surface` panel with a heading, a sentence and an optional next step                          |
| `StatusLabel`        | `status`: `pending`, `approved` or `rejected`                                                           | Text plus a treatment: outline, fill or struck through. Never colour alone                           |
| `LessonCompleteMark` | `complete: boolean`                                                                                     | A navy "Complete" label when true, nothing when false                                                |
| `VimeoFrame`         | `videoId`, `title` (required), `fallback: ReactNode`, `unavailable?`                                    | 16:9 frame with the player iframe, or the fallback when the caller says so or the frame errors       |
| `TextField`          | `label`, `hint`, `error`, `optional`, native input props                                                | Label, hint, `ew-field` input (1px `line` border), `ew-notice` for an error                          |

Pure logic, in `src/domain/` with tests:

| Function                      | Input and output                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `toastReducer(state, action)` | `add` appends a toast with the next id (a blank message or a repeat of one still showing is ignored; at most 3 show, the oldest goes first); `dismiss` removes one by id |
| `toastDuration(message)`      | Milliseconds on screen: 4000 plus 40 per character, between 4000 and 10000                                                                                               |
| `statusLabel(status)`         | `{ text, treatment }`: pending is "Pending" and outline, approved is "Approved" and fill, rejected is "Rejected" and strike                                              |
| `vimeoPlayerUrl(id)`          | `https://player.vimeo.com/video/<id>?dnt=1&title=0&byline=0&portrait=0`, or `null` unless the id is 1 to 15 digits with no leading 0                                     |

### Reference cases

Plain unit tests in `tests/unit/` mirroring this table, pending Sathira's copy in `tests/reference/`.

| Case | Given                                                   | Expected                                                                    |
| ---- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| R1   | `vimeoPlayerUrl("76979871")`                            | `https://player.vimeo.com/video/76979871?dnt=1&title=0&byline=0&portrait=0` |
| R2   | `vimeoPlayerUrl("12abc")`, `""`, `"0123"`, `"../x?y=1"` | `null`                                                                      |
| R3   | `statusLabel("pending")`                                | `{ text: "Pending", treatment: "outline" }`                                 |
| R4   | `statusLabel("approved")`                               | `{ text: "Approved", treatment: "fill" }`                                   |
| R5   | `statusLabel("rejected")`                               | `{ text: "Rejected", treatment: "strike" }`                                 |
| R6   | `toastDuration("Saved")`                                | `4200`                                                                      |
| R7   | `toastDuration` of 500 characters                       | `10000`                                                                     |
| R8   | add "A", "B", "C", "D"                                  | items B, C, D with ids 2, 3, 4 (A dropped)                                  |
| R9   | add "A", add "A"                                        | one toast                                                                   |
| R10  | add "A", dismiss its id                                 | no toasts; dismissing an unknown id changes nothing                         |

### Properties

- [ ] Toast ids never repeat in one state's life (approved: no)
- [ ] `toastDuration` never decreases as the message grows and stays within 4000 to 10000 (approved: no)
- [ ] `statusLabel` gives each status a different treatment (approved: no)

### Design rules every component follows

- Semantic tokens only; text is `fg-*`; body text is 16px or more; light theme only.
- Controls are 48px (`control-min`); row targets are 44px (`tap-min`) or more; every interactive
  element shows the 2px focus ring (global `:focus-visible`).
- No icons. The design system allows only brand marks and the theme switch, so the complete mark
  and the dismiss control are words (Q25).
- No shadows, gradients or fades. Overlays (dialog, toast) separate by a 1px `line` border, as the
  consent dialog does. The dialog scrim is the `surface-dark` token mixed with transparency, the
  only transparency in the app (Q25).
- `highlight` is only for the TextField error notice.
- Nothing animates, so `prefers-reduced-motion` has nothing to turn off; the bundle's
  reduced-motion rule still covers colour transitions.

### Text field border

The launch plan noted the input border was 1.4:1. In this repo `.ew-field` already uses the `line`
token, which measures 3.45:1 on `bg` and 3.12:1 on `surface` (light theme), so it meets the 3:1 rule
and `TextField` uses it unchanged. The 1.4:1 figure probably came from an older border colour. If the
public site still has it, that is an `englishwind-web` fix.

### App-level custom properties

Defined in `src/client/styles/global.css` (not in `tokens.css`, which is generated), each referencing
an existing token where one exists: `--dialog-max`, `--toast-max`, `--row-min`, `--overlay-scrim`,
`--radius-control`, `--shadow-overlay` (none). **These should move into `design-system/tokens.json`
upstream in `englishwind-web`** and come back through `pnpm ds:sync`. The new
`design-system/components/<Name>/README.md` files belong upstream too; `ds:sync` only copies over, so
it will not delete them here.

### Out of scope

- A tick icon or any other icon (Q25).
- Detecting Vimeo's refusal automatically. Vimeo shows its own error page inside the iframe and gives
  the page no event without its player SDK (a new dependency). The caller passes `unavailable`; the
  iframe's `error` event also switches to the fallback.
- Component tests with jsdom or Testing Library (not installed). Components are checked by eye at
  `/dev/components`, and the logic they use is tested in `tests/unit/`.
- Dark theme, Sinhala text, page layouts, form validation logic.

### How it is checked

- Tests: `tests/unit/app-components.test.ts`.
- Manual: `pnpm dev`, open `/dev/components` at 375px and 1280px: every component in every state, no
  sideways scroll, focus ring on every control, Esc closes the dialog, Tab stays inside it. The route
  exists only when `import.meta.env.DEV`; the production build must not contain the page.
- Failure modes from `docs/review.md`: raw colours (`pnpm check:tokens`), text under 16px, targets
  under 44px, controls with no focus state.

## Steps

1. **Pure logic.** Toast queue, status label and Vimeo URL in `src/domain/`, with the tests above.
2. **Components and styles.** The nine components, the app custom properties, and a README per
   component in `design-system/components/`.
3. **Dev page.** `/dev/components`, dev only, every component in each state; screenshots at 375px
   and 1280px.

## Decisions

No ADR: nothing structural. The two judgement calls are in OPEN-QUESTIONS Q25.
