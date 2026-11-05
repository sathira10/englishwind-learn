# VimeoFrame

App only (`src/client/components/VimeoFrame.tsx`; URL in `src/domain/vimeo.ts`). A 16:9 frame on `surface-dark-alt` holding the Vimeo player: `https://player.vimeo.com/video/<id>?dnt=1&title=0&byline=0&portrait=0`. No tap-to-load: the videos are private and locked to our domains.

Props: `videoId` (numeric; anything else shows the fallback), `title` (required: the iframe's accessible name), `fallback` (the friendly message and next step, passed by the caller), `unavailable` (the caller knows Vimeo refused). The iframe's `error` event also shows the fallback. Vimeo's own refusal page cannot be detected from outside the iframe without its player SDK, so the caller decides.

The ID is only rendered after the server has checked the student's grant. At most one video per section.
