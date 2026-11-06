# Select

App only (englishwind-learn, `src/client/admin/Select.tsx`). A labelled native `<select>` in the TextField treatment: a bold `label`, then a 48px `ew-field` with the browser's arrow removed (`appearance: none`) and a 20px `chevron-down` icon in `fg-strong` drawn over its right edge. The icon is decorative and ignores the pointer, so a click anywhere on the field opens the list.

Props: `label` (required), `error` (an `ew-notice` with `role="alert"` below the field; the select gets `aria-invalid`), and the native select's own attributes and `<option>` children.

```html
<label class="ew-label" for="course">Course</label>
<div class="ew-select">
  <select class="ew-field" id="course">…</select>
  <svg class="ew-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg>
</div>
```
