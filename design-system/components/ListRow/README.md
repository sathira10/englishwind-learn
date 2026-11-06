# ListRow

App only (englishwind-learn, `src/client/components/ListRow.tsx`). One row in an admin queue or a student list, inside `ListRows`, which is a real `<ul>` with `space-2` between rows.

A flat `surface` field, at least `row-min` (44px) high. It holds a bold `fg-strong` title, an optional `fg-muted` meta line and optional trailing content. Pass `to` for a link row or `onClick` for a button row, and the whole row becomes the target: the title underlines on hover and the global focus ring shows. A row with neither is static.

A link row ends with a 20px `chevron-right` icon in `fg-muted`. It is decorative and shows that the row leads somewhere. A button row and a static row have no chevron.

Props: `title`, `meta`, `trailing`, and one of `to`, `onClick` or neither. In a link or button row, `trailing` sits inside the target. Use text such as "Review", with an `arrow-right`, or a StatusLabel there, never a nested button. A static row may hold a real Button. Long names and emails wrap.
