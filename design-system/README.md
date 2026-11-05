EnglishWind teaches adult learners in Sri Lanka to speak English: a live class with Suranga Tennakoon, the recorded Blueprint course and free lessons. The site reads like a confident educational print document: large Archivo headlines, readable Libre Franklin copy, flat fields that step in tone, deep-navy bands, and one yellow kept for what the reader must not miss. Content and practical instructions lead every page. Nothing moves for decoration.

## Content fundamentals

- Write as a plain-spoken teacher talking to one adult learner: patient and factual, with no exaggerated sales claims. "You" is the learner, "we" is the business.
- American spelling, sentence case (main navigation links excepted: they capitalize each word), no emoji.
- Buttons say what happens, usually "Message us on WhatsApp". Other real labels: "Send registration details", "Subscribe", "Copy".
- Never promise instant fluency, shortcuts or guaranteed outcomes. Never invent seat limits, deadlines, numbers, dates or quotes. If a fact is missing, leave the claim out.
- The live class and the recorded Blueprint are distinct products. Full payment for the class includes the Blueprint; it is not a prerequisite or a free gift. The Blueprint has no live sessions.
- The Blueprint argues against school-style study (memorizing, notes, exams), never against grammar.
- Sinhala supports the explanations; English is what learners practice.
- WhatsApp is for people: registration, reminders, questions and Zoom links. Google Classroom holds recordings and practice materials. Call them "class materials and resources", never books.
- Say each point once per page.
- Errors reassure and offer a next step. A 404 says nothing is wrong with course access: "That page isn't here." Forms offer a WhatsApp fallback. Notices say what to add or do: "Add an email address or a WhatsApp number. Either one works."
- Punctuation: straight quotes; no serial comma unless a list would be ambiguous. The em dash only separates parts of a page title or email subject; body copy uses a period, colon or comma. En dashes for ranges (`Weeks 1–4`, `7:30–9:30 pm`), lowercase `pm` after a space. Fragment list items take no period. Full-sentence display headlines end with one ("You've waited long enough to speak."); label headings don't ("How to register"). Standalone text links end in ` →` (` ←` before a link back).

## Themes

- Two themes, `light` (the default) and `dark`. Every colour token has a value in each, so build with tokens and both themes work without extra rules.
- Follow the reader's setting with `prefers-color-scheme`, and let an explicit `data-theme="light"` or `data-theme="dark"` on the root override it in either direction.
- The nav carries a switch (a moon in light, a sun in dark; labelled "Dark theme" / "Light theme" in the phone menu) that sets that override and saves it. `public/theme.js` applies a saved choice before first paint; with no saved choice the site follows the system.
- Dark is not an inversion. Grounds go to deep navy (`bg`, `surface`), navy bands lighten so they still stand off the page, text goes pale, and `accent` becomes a light blue with navy `accent-fg` text. `highlight`, `portrait` and the `-on-dark` brand marks stay the same.
- Check new pairs in both themes before using them.

## Color

- The page ground is `bg`. Alternate `bg` and `surface` between topics; an inset panel uses whichever of the two contrasts with its section.
- Body copy is `fg`; headings, labels, figures and links are `fg-strong`; secondary copy is `fg-muted`. All three read on `bg` and `surface` in both themes.
- Inverse sections and the footer are `surface-dark`; closing sections where they meet the footer use `surface-dark-alt`; the main navigation is `nav`. Mark every navy band `data-surface="navy"`: it switches headings, links, labels, buttons, muted text and the focus ring to their on-dark values. Keep form panels outside that scope.
- Primary actions are `accent` with `accent-fg` text, `accent-hover` on hover. On a navy band the primary button inverts to `fg-on-dark` with `surface-dark` text, so it never sits navy on navy.
- `accent` is never a text colour or a hover colour on navy. Hover on navy keeps the colour and adds an underline.
- `highlight` (the brand yellow) has one job: drawing the eye to what the reader must act on or know. Use it for form notices (`ew-notice`), the Badge `highlight` tone and the favicon bar, always with `highlight-fg` text. Never use it for actions, headings, links, borders or decoration, and use at most one highlighted thing per view.
- `portrait` (black) only continues the teacher portrait's background.
- Secondary text on navy is `fg-on-dark-muted`, never white at reduced opacity.
- Brand marks (WhatsApp, YouTube, Facebook) keep their own colours: `brand-*` on `bg` and `surface`, `brand-*-on-dark` on navy bands. Inside a primary button and in the footer they take the text colour.
- Contrast floor: text 4.5:1 on its ground in both themes (3:1 at 24px and up); borders, focus rings and marks 3:1. Every token's usage note names the grounds it passes on.
- No gradients, no shadows, no colours outside the tokens.

## Type

- Archivo states, Libre Franklin explains. Both are self-hosted Latin subsets (`fonts/`).
- Every page title uses `display-1`, one shared scale from 44 to 80px. It never shrinks below 44px; long titles wrap instead.
- Every section heading is `h2`, including legal-page sections; aside and subsection headings are `h3`. `display-2` is only for the closing section's heading.
- Reading copy is `body` (18px, 1.6 leading) held to the 65ch `measure`. Navigation, controls, hints and metadata are `base` (16px), the floor for any text. `small` (14px) is for copyright and legal asides only.
- Prices, schedules and counts use tabular figures (`ew-mono`). The one figure a section is about uses `data`.
- Headlines use one face and one colour, with no decorative underlines and no kicker above them. A label (`label`) is sentence-case bold body text, never a kicker.

## Layout and spacing

- Full-width content is capped at `container-page` (68rem). Prose pages (/help, /privacy, /terms) use `container-narrow` (46rem); running copy holds to `measure` (65ch).
- Text sections split 5/7 from 1024px and stack below; sections with media split 6/6.
- Every section, heroes included, uses `ew-section`: `section-space` (64px), `section-space-sm` (80px) from 640px, `section-space-lg` (96px) from 1024px. Each section owns its full padding.
- `ew-section-grid` gaps are `section-gap` (32px) stacked and `section-gap-lg` (48px) on desktop. Panels use `ew-panel`: `panel-space` (24px), `panel-space-lg` (40px) on desktop.
- Inside components, space by the step scale: `space-6` heading to copy, `space-4` between paragraphs and fields, `space-8` before actions, `space-12` between steps.
- Use width tokens, not one-off measures: `heading-measure` (22ch) or `heading-measure-wide` (24ch) for headlines, `measure` for copy.
- At 320px, navigation, content, controls and sticky actions fit without sideways scroll.

## Shape, interaction and motion

- Square panels, no shadows, `radius-sm` (2px) on buttons and fields only. Surfaces separate by a step in tone. Borders belong to controls and the consent dialog, never to sections or panels.
- Buttons and inputs are at least `control-min` (48px) high; links in navigation, footers and link rows have `tap-min` (44px) targets through `ew-link`. Links inside running prose stay inline.
- `ew-btn` is the only button treatment: `ew-btn-primary` or `ew-btn-secondary`. `ew-btn-sm` is for the sticky bar and inline field actions.
- Every control shows a 2px `focus-ring` outline, offset 3px, never clipped by its container: `focus-ring` on page grounds, `focus-ring-on-dark` on navy.
- Motion is `duration-fast` colour changes on controls and the sticky bar sliding over `duration-slow`. No press animation, no fades, no scroll entrances, no image drift. Reduced motion removes even those. The one exception is the Countdown's ticking digits.
- Videos load YouTube only after play and fall back to a plain link.

## Sequences

- `StepRail` is for steps only: register, buy and help. It draws no rail and no index numbers; order comes from position and words.
- `LessonRail` is the lesson index, built from the lesson data.
- Other sequences (the twelve weeks, the webinar agenda) use filled `ew-numbered` bands with no index numbers.
- At most one video per section; each video appears on one page only.

## Imagery and iconography

- Photography is the teacher's own portrait and posters, cropped deliberately. No stock imagery or illustration.
- There is no logo. The wordmark is "EnglishWind" set in Archivo 700 as type. The `E` mark (`assets/Logos/mark.svg`) only appears in the favicon and app icons, on `surface-dark` with a `highlight` bar.
- The only icons are the three brand marks, at 20px beside a visible label, and the theme switch's moon and sun (`ThemeIcon`, drawn in the text colour). No icon library, no emoji.

## Avoid

Palette-specific utilities, inline visual values, opacity-tinted colours, gradients, rounded cards, shadows, borders between sections, icon libraries, invented urgency, and facts typed into page templates.

## Using the components

The site's components are Astro, so this system ships their markup with `components/bundle.css` (the site's shared treatments as plain classes) rather than a script bundle. Each component's README lists its props and the markup it renders; build with those classes on top of `tokens.css`.

Not synced: `DesignSystemShowcase` (the site's dev-only specimen route) and `ConsentSettingsLink` as its own card (it is described under ConsentBanner). The fluid display sizes live in `bundle.css` as `--fluid-*`; `tokens.json` records their largest size. This system is ahead of the site: the dark theme, `highlight`, `nav`, the step scale and the inverted primary on navy are not in the site's code yet.
