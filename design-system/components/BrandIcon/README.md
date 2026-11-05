# BrandIcon

The WhatsApp, YouTube and Facebook marks as 20px inline SVGs filled with `currentColor`, decorative beside a visible label.

Prop: `name` (`whatsapp` | `youtube` | `facebook`). The colour comes from `data-brand-icon`: `brand-*` on `bg` and `surface` (each has a dark-theme value), `brand-*-on-dark` inside `data-surface="navy"`, and the text colour inside a primary button or `footer`. Never use one without a text label, and add no other icons.
