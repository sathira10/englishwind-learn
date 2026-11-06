# Checkbox

App only (englishwind-learn, `src/client/admin/Checkbox.tsx`). A styled checkbox whose whole row is the target. The row is at least `control-min` (48px) high, and the box is 24px (`icon-md`) with a 1px `line` border on `bg` and `radius-control`. When checked, the box fills with `accent` and shows the `check` icon in `accent-fg`. The label is `base` text in `fg-strong`.

The real `<input type="checkbox">` stays in the page, visually hidden, so keyboard, screen readers and forms work as normal. The focus ring (`focus-ring`, 2px, offset 3px) is drawn on the box. Hover darkens the border to `fg-muted`. Disabled is the box at half opacity.

Props: `label` (required) and the input's own attributes (`checked`, `onChange`, `name`, `disabled`).

```html
<label class="ew-checkbox">
  <input type="checkbox" name="send-email">
  <span class="ew-checkbox-box"><svg class="ew-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
  <span>Email the student</span>
</label>
```
