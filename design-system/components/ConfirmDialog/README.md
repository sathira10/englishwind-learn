# ConfirmDialog

App only (englishwind-learn, `src/client/components/ConfirmDialog.tsx`). A native `<dialog>` opened with `showModal()`. The rest of the page is inert, Tab wraps inside, Esc closes, and focus returns to the opener. Focus starts on Cancel so Enter never confirms by accident.

The panel is `ew-dialog`: `bg` with a 1px `line` border, `radius-control` and no shadow. It sits over the opaque `overlay-scrim`. Its width is `dialog-max` (28rem), never wider than the screen minus `space-4` on each side. Padding is `panel-space`, or `panel-space-lg` from 1024px. Inside: an `h2`-level title in `h3` type, a `base` sentence on what will happen, then a primary and a secondary button.

Props: `open`, `title`, `children`, `confirmLabel` (says what happens: "Approve order", never "OK"), `cancelLabel` (default "Cancel"), `busy` and `busyLabel` (the confirm button shows the busy icon and that label, and Esc is ignored; see Loading), `onConfirm`, `onClose`. The caller owns `open`.

Cancel is the way out, so there is no close icon by default. A dialog that has no Cancel button may add a 24px `close` icon button (`ew-icon-btn`, `aria-label="Close"`) at its top right. No red: the words carry the weight.
