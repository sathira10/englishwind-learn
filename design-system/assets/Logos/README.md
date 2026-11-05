# Logos

EnglishWind has no logo. The wordmark is the name set as type in Archivo 700 (`ew-display`), in `fg-strong` on page grounds and `fg-on-dark` on navy. Never draw it.

- `mark.svg`: the E mark, single ink (`currentColor`; shows black in an `<img>`). Source for the favicon and app icons only.
- `favicon.svg`: the E in `fg-on-dark` on `surface-dark`, with a `highlight` bar beneath it and 4px corners. The yellow bar is the one place the mark meets `highlight`.
- `icon-512.png`: the app icon generated from the mark.

The site's icon generator still reads `accent` for the bar; it must read `highlight` before the icons are regenerated, or the bar turns navy on navy.
