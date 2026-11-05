# ConsentBanner

The analytics consent dialog, a React island: a `surface` bar docked to the bottom edge with a 2px `accent` top border, where the sticky bar sits (that bar hides while this is open). The light surface stands off both the navy bands and the white page. One sentence, then "Allow cookies" as the one filled primary button and "No thanks" as an underlined secondary text button; both keep the full control height. On phones they stack, Allow full width above No thanks; from 640px they sit beside the text, Allow on the right. The copy stays to one plain sentence and links to /privacy, which names the providers.

It renders only when an analytics provider is configured and no choice is stored. The choice persists where storage allows; nothing loads until the reader agrees. `ConsentSettingsLink` is the footer's underlined "Analytics settings" button that reopens it.
