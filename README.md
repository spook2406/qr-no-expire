# QRStatic — Free Static QR Code Generator

Static English site at **https://qrstatic.app/** that makes **permanent QR codes with no expiration and no signup**. Every code is generated in the browser. Nothing the user types is uploaded, and the content is written straight into the QR, so there is no short link to expire.

## Generators

| Page | Encodes |
|---|---|
| `index.html` | URL, plain text, Wi‑Fi, email, phone (tabbed) |
| `wifi-qr-code-generator.html` | `WIFI:` join string |
| `vcard-qr-code-generator.html` | vCard 3.0 contact |
| `calendar-event-qr-code-generator.html` | iCalendar `VEVENT` (+ `.ics` download) |
| `google-review-qr-code-generator.html` | Google write-review link from a Place ID or review URL |
| `location-qr-code-generator.html` | `geo:` URI or Google Maps link |
| `phone-call-qr-code-generator.html` | `tel:` |
| `sms-qr-code-generator.html` | `SMSTO:` |
| `email-qr-code-generator.html` | `mailto:` with subject/body |
| `whatsapp-qr-code-generator.html` | `wa.me` chat link |
| `telegram-qr-code-generator.html` | `t.me` user, group, channel, or invite |
| `discord-qr-code-generator.html` | `discord.gg` invite |
| `zoom-meeting-qr-code-generator.html` | Zoom join link |
| `google-meet-qr-code-generator.html` | Google Meet join link |
| `teams-meeting-qr-code-generator.html` | Microsoft Teams meetup-join link |
| `spotify-qr-code-generator.html` | `open.spotify.com` track/album/playlist/artist |
| `google-form-qr-code-generator.html` | Google Form responder link |
| `calendly-qr-code-generator.html` | Calendly booking page |
| `totp-qr-code-generator.html` | `otpauth://` 2FA setup (TOTP/HOTP) |
| `app-store-google-play-qr-code-generator.html` | App Store + Google Play links (two codes, plus a poster) |

All generators offer PNG and SVG download plus size, error-correction, margin, and colour options. `guides/` holds the long-form articles (static vs dynamic, why codes stop working, print size, and so on).

## Layout

```
*.html                 one page per generator, plus about/contact/privacy/terms
guides/                SEO guides
css/style.css          shared styles
vendor/qrcode.min.js   bundled browser build of node-qrcode (MIT, see vendor/LICENSE-qrcode.txt)
js/qr-core.js          shared page helpers: messages, render options, downloads
js/<type>-payload.js   pure functions: validate input → payload string (unit-tested)
js/<type>-page.js      DOM glue: read the form, call the payload builder, draw the QR
js/share.js            share row shown after a QR is drawn
js/app.js              homepage tabbed generator
scripts/check-site.js  sitemap / canonical / link / script-order checks
test/*.test.js         payload unit tests (node:test)
test/e2e/              Playwright smoke test of every generator page
```

Every generator page loads its scripts with `defer`, in this order:

```html
<script defer src="vendor/qrcode.min.js"></script>
<script defer src="js/qr-core.js"></script>
<script defer src="js/<type>-payload.js"></script>
<script defer src="js/<type>-page.js"></script>
<script defer src="js/share.js"></script>
```

## Development

There is no build step. Serve the folder and open it:

```sh
npm run serve          # python3 -m http.server 8080
```

Checks (Node 20+):

```sh
npm run check          # site consistency: sitemap, canonical URLs, links, script order
npm test               # payload unit tests
npm install && npx playwright install chromium
npm run test:e2e       # browser smoke test: every generator draws, downloads, and shows share buttons
```

CI (`.github/workflows/ci.yml`) runs all three on every push to `main` and on every pull request.

### Adding a new generator

1. Write `js/<type>-payload.js` (no DOM access) and `test/<type>-payload.test.js`.
2. Write `js/<type>-page.js`, using `QRCore` for errors, options, and downloads.
3. Add `<type>-qr-code-generator.html` with the script order above and a canonical URL.
4. Add the page to `sitemap.xml` and link it from the Tools section of `index.html`.
5. Add a sample input for it in `test/e2e/smoke.test.js`.
6. Run `npm run ci`.

## Deploy

GitHub Pages from `main`, repository root. `.nojekyll` turns off Jekyll; `CNAME` points the site at `qrstatic.app`.
