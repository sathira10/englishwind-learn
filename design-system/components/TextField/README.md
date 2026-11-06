# TextField

The only input treatment: a bold sentence-case `label`, an optional muted hint, and a 48px field on `bg` (untinted, on any panel) inside an even 1px `line` border that darkens to `fg-muted` on hover.

Props: `id`, `name`, `label` (required); `type` (`text` | `email` | `tel`); `optional` (appends a muted "(optional)" instead of marking what's required); `hint` (wired to `aria-describedby`). Other attributes pass through to the `<input>`.

The border is `line` (3:1 or better on `bg` and `surface` in both themes). Validation is an `ew-notice` below the field: never red, never scolding.

The learn app's `TextField` (React) renders the same markup and adds `error` (an `ew-notice` with `role="alert"`, the input gets `aria-invalid`). Select uses this treatment with a chevron.
