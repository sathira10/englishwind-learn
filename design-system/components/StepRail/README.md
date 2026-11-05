# StepRail

An ordered list of steps, `space-12` apart: register, buy and help only. Order is carried by position and by the words. There is no drawn rail, no hairline and no 01 / 02 / 03 markers.

`StepRail` wraps `Rail` (an `<ol role="list">`). Each `Step` takes `title` (an `h3`-size `ew-heading`) and `headingLevel` (2 or 3: renders the title as a heading so screen readers can jump between steps; use it on /help). (Its `n` prop is accepted but not rendered.) The step body is the slot, `space-3` below, often holding a CopyField or WhatsAppButton. Phases and agendas use `ew-numbered` instead.
