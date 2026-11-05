# SubscribeForm

One form for two jobs: newsletter signups on the homepage and live-class enquiries on /classes. Name, then email address and WhatsApp number side by side as alternatives, then a primary button.

Props: `idPrefix`, `subject` (the inbox subject that tells leads apart), `buttonLabel` (default "Subscribe"), `redirect` (no-JS return URL, default `/#<idPrefix>-done`), `doneMessage` (default "You're on the list. You'll hear from us when the next free lessons go up.").

It posts to Web3Forms with a honeypot and no CAPTCHA, shows a live status, offers retry and a WhatsApp fallback on failure, and replaces itself with a `surface` card on success. Without JavaScript the form posts natively and Web3Forms returns the visitor to the `redirect` URL; its `#<idPrefix>-done` fragment targets the confirmation card, and CSS `:target` shows it in place of the form, so a native send is acknowledged too. It collects interest; it never registers or takes payment.

Notices (validation, send failure, JavaScript off) are `ew-notice`: `highlight-fg` on `highlight`, a sentence saying what to add or do next, with links in the notice's own colour. Never red, never scolding.

`showNote` defaults to `true`. Set it to `false` to omit the explanatory slot and privacy link, as on the live class enquiry form.
