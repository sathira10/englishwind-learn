# Icon

The interface icon set: ten stroked 24-unit SVGs drawn in `currentColor`, so each takes the `fg-*` colour around it. The SVG files live in `assets/Interface/`. Inline them; do not load them as `<img>`, because an image cannot take `currentColor`.

Names: `check`, `close`, `arrow-left`, `arrow-right`, `chevron-right`, `chevron-down`, `download`, `play`, `busy`, `sign-out`.

| Icon | Use |
| --- | --- |
| `check` | LessonCompleteMark, an approved StatusLabel, the Checkbox tick |
| `close` | The Toast's dismiss button, closing a dialog, a rejected StatusLabel |
| `arrow-left` | "Back to the course", "Previous: …" (in place of the ` ←` glyph) |
| `arrow-right` | "Next: …", "Open", "Review" (in place of the ` →` glyph) |
| `chevron-right` | A ListRow that is a link (decorative) |
| `chevron-down` | Select (decorative) |
| `download` | Worksheet links ("Download: …") |
| `play` | Lesson rows and the VimeoFrame fallback |
| `busy` | A Button with `loading` |
| `sign-out` | The header's "Sign out" (optional) |

Props: `name`; `size` (`sm`, 20px `icon-sm`, the default; or `md`, 24px `icon-md`).

Rules:
- Use `sm` beside a visible label. The icon is decorative there: `aria-hidden="true"`, `focusable="false"`.
- Use `md` only when the icon is the whole control. Put it in `ew-icon-btn`, which is a `tap-min` (44px) target, and give the button an `aria-label` such as "Dismiss" or "Close".
- An icon never stands in for a word. Status is never shown by an icon or a colour alone.
- Arrows follow the label they belong to: `arrow-left` goes before the text, `arrow-right` after it.
- `busy` spins only under `prefers-reduced-motion: no-preference`; otherwise it stays still.

Markup:

```html
<a class="ew-link" href="…">Next: Lesson 4 <svg class="ew-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
<button class="ew-icon-btn" type="button" aria-label="Dismiss"><svg class="ew-icon ew-icon-md" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
```
