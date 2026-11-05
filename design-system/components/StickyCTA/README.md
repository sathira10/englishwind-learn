# StickyCTA

A navy bar fixed to the bottom of the screen: the price on the left in tabular figures, a compact primary button on the right.

Props: `label` (required), `price` (defaults to the Blueprint price from site data), `href` (an explicit link wins; otherwise WhatsApp with `prefill`, placed as `<page> bar`), `prefill`, `track` (the `begin_register` placement for an in-page link). Hidden without JavaScript. It shows only after the reader has scrolled past the hero (`data-sticky-after`) and while they are scrolling up, so it never covers the heading they are about to read. It hides while they scroll down and whenever a `data-sticky-hide` element (the closing section, the footer) is in view. It slides over `duration-slow`, with no fade. The button is the inverted primary of a navy band. It pads by the safe-area inset.
