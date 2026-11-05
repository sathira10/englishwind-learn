# Button

`ew-btn` is the only button treatment: a 48px-high, 2px-cornered control in bold 16px Libre Franklin.

- `ew-btn ew-btn-primary`: `accent` fill with `accent-fg` text, `accent-hover` on hover. One per view, for the thing the section is for. Navy in the light theme, light blue in the dark theme.
- `ew-btn ew-btn-secondary`: underlined `fg-strong` text, a `surface` fill on hover.
- On a navy band (`data-surface="navy"`), the primary inverts to a `fg-on-dark` fill with `surface-dark` text so it stands off the band; the secondary is `fg-on-dark` text and fills `fg-on-dark` on hover.
- Add `ew-btn-outline` to a secondary that sits beside a primary in an `ew-actions` row: a 1px `currentColor` border instead of the underline, so the pair reads as two buttons.
- Add `ew-btn-sm` in the sticky bar and inline field actions only. It keeps the 48px height.
- Disabled: the `disabled` attribute or `aria-disabled="true"` drops it to 50% opacity.
- Feedback is a `duration-fast` colour change only. No press motion.
- A brand mark inside a primary button takes the button's text colour.

The consumer supplies a `<button>` or `<a>` and a label that says what happens: "Message us on WhatsApp", "Subscribe", "Copy".
