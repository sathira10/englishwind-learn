# VimeoFrame

App only (englishwind-learn, `src/client/components/VimeoFrame.tsx`; URL in `src/domain/vimeo.ts`). A 16:9 frame on `surface-dark-alt` that holds the Vimeo player: `https://player.vimeo.com/video/<id>?dnt=1&title=0&byline=0&portrait=0`. There is no tap-to-load, because the videos are private and locked to our domains.

Props:
- `videoId`: numeric. Anything else shows the fallback.
- `title`: required, the iframe's accessible name.
- `fallback`: the friendly message and next step, passed by the caller.
- `unavailable`: set when the caller knows Vimeo refused.

Browsers fire no `error` event when an iframe fails. Vimeo's refusal page cannot be detected from outside the iframe without its player SDK, so the caller decides when to show the fallback. The fallback panel's link to the lesson's video starts with a 20px `play` icon.

The ID is rendered only after the server has checked the student's grant. At most one video per section.
