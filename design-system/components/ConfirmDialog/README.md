# ConfirmDialog

App only (`src/client/components/ConfirmDialog.tsx`). A native `<dialog>` opened with `showModal()`: the rest of the page is inert, Tab wraps inside, Esc closes, and focus returns to the opener. Focus starts on Cancel so Enter never confirms by accident.

A `bg` panel with a 1px `line` border (borders belong to controls and dialogs), `radius-sm`, no shadow, over a scrim of `surface-dark` with transparency. Width is `--dialog-max` (28rem) and never wider than the screen minus `space-4` each side. A `h2`-level title in `h3` type, a `base` sentence on what will happen, then a primary and an outlined secondary.

Props: `open`, `title`, `children`, `confirmLabel` (says what happens: "Approve order", never "OK"), `cancelLabel` (default "Cancel"), `busy` and `busyLabel` (the confirm button shows the label and Esc is ignored), `onConfirm`, `onClose`. The caller owns `open`.

No red, no icons: the words carry the weight.
