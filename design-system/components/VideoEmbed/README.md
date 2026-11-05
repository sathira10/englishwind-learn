# VideoEmbed

A 16:9 poster on `surface-dark-alt` that loads YouTube's privacy-enhanced player only after the reader presses play. Without JavaScript it is a plain link to the video.

Props: `id` (a null id renders nothing, so video slots can be filled in later), `title` (used in "Play the video: …"), `thumb` (a local poster; AVIF and WebP at 480/768/1280 are generated beside it). At most one video per section, and each video appears on one page only. The play control's focus ring must not be clipped by the poster's overflow.
