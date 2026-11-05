# ListRow

App only (`src/client/components/ListRow.tsx`). One row in an admin queue or a student list, inside `ListRows` (a real `<ul>`, `space-2` between rows).

A flat `surface` field, at least `--row-min` (44px, `tap-min`) high: a bold `fg-strong` title, optional `fg-muted` meta line, optional trailing content. Pass `to` for a link row or `onClick` for a button row and the whole row is the target; the title underlines on hover and the global focus ring shows. With neither it is a static row.

Props: `title`, `meta`, `trailing`, and one of `to`, `onClick` or neither. In a link or button row `trailing` sits inside the target, so use text ("Review →") or a StatusLabel, never a nested button; a static row may hold a real Button. Long names and emails wrap.
