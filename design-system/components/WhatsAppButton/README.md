# WhatsAppButton

A button that opens a WhatsApp chat with the business, with the WhatsApp mark before its label.

Props: `label` (required), `variant` (`primary` default, or `secondary`), `prefill` (message text), `from` (the placement, set as `data-wa-from` for analytics and never added to the message; defaults to the page path). The link comes from `whatsappLink` in site data and opens in a new tab with `rel="noopener"`. Inside a primary button the mark takes the button's text colour; in a secondary one it is `brand-whatsapp` (`brand-whatsapp-on-dark` on navy).
