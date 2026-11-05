# Nav

The main navigation: a full-width `nav` band with the "EnglishWind" wordmark set as `h3`-size Archivo type on the left and the product and help links on the right.

Links come from `site.nav`: Live Class, Blueprint Course, Help. Nav links capitalize each word, the one exception to the site's sentence case. It sets `data-surface="navy"`, so text is `fg-on-dark` and links underline in their own colour on hover. The band is `nav`, not `accent`, so it keeps white text in both themes. From 640px the links sit inline, followed by the theme switch. Below 640px they fold into a native `<details>` "Menu" with a text +/− marker: a full-width `nav` panel of 44px rows, theme switch last. The menu works without JavaScript; the theme switch is a 44px button showing a moon (light page) or a sun (dark page), icon-only inline with an `aria-label`, and with "Dark theme" / "Light theme" beside the mark in the phone menu. It stays hidden until its script runs.
