# Countdown

Four flat `bg` cells (Days, Hours, Mins, Secs) with `data`-style digits that tick once a second. No colour change as time runs out: the number is the urgency.

Props: `target` (ISO 8601 with an explicit offset), `class`. After the target passes, the clock gives way to the `ended` slot, which says what happens next. Omit it when the time is unconfirmed. Digits update without live announcements. The ticking digits are the motion budget's one exception, recorded in the brand book.
