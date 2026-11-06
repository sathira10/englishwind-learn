# Loading

App only (englishwind-learn). How waiting looks. Nothing pulses, shimmers or draws a skeleton.

- **A page or section loading**: one `base` line, "Loading…", in `fg-muted`, where the content will appear, inside a `role="status"` region so it is announced. If loading fails, replace it with an `ew-notice` that says what to do next.
- **A Button with `loading`**: the label changes to say what is happening ("Saving", "Approving"), and the `busy` icon (20px, `icon-sm`) sits before the label. The button gets `aria-busy="true"` and `cursor: progress`, and ignores clicks. Its size does not change. The icon turns (`ew-icon-busy`) only under `prefers-reduced-motion: no-preference`; otherwise it stays still and the words carry the state.

```html
<p class="fg-muted" role="status">Loading…</p>
<button class="ew-btn ew-btn-primary" type="submit" aria-busy="true"><svg class="ew-icon ew-icon-busy" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3a9 9 0 1 0 9 9"/></svg> Saving</button>
```
