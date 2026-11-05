# CopyField

A value on a `surface` field with a small secondary Copy button, for account numbers and message templates.

Props: `value` (required), `label` (a bold label above), `multiline` (a preformatted block, button below on phones). Copy tries the Clipboard API, then a legacy copy, then selects the text for manual copying. The button reads "Copied" for two seconds and a polite live region announces it. Values use tabular figures.
