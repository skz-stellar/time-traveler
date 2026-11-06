# Time Traveler

A small, dependency-free UTC-to-timezone converter, embedded directly on
https://skz-stellar.github.io/ as a reusable `<time-traveler>` element.

- Defaults to America/Phoenix: MST, UTC−07:00 year-round.
- Accepts `2026-11-06T21:30:00Z`, `2026-11-06 21:30 UTC`, or `21:30 UTC`.
- A missing timezone is treated as UTC; other numeric offsets are rejected.
- A time without a date uses today's UTC date. Include a date for historical
  conversions or daylight-saving transitions.
- Uses the browser's Intl timezone database, including daylight-saving rules.
- Fractional seconds are retained at millisecond precision; extra digits are truncated.
- Stores only the selected timezone under `time-traveler.time-zone` in localStorage.
  No timestamps, history, analytics, or network calls. Storage failures do not stop conversion.

## Embed

Copy `core.js`, `time-traveler.js`, and `time-traveler.css` into one directory:

```html
<script type="module" src="apps/time-traveler/time-traveler.js"></script>
<time-traveler></time-traveler>
```

The component uses an external stylesheet inside its shadow root, inherits the
host's interface font, and uses IBM Plex Mono where the host provides it.
The homepage supplies the surrounding glass card, background, and bundled fonts.
Keep `script-src 'self'`, `style-src 'self'`, and `connect-src 'none'` in the host CSP.

The homepage vendors these three runtime files in `apps/time-traveler/`.
After changing this repository, run the tests and refresh those copies.

## Local preview and tests

```sh
python3 -m http.server 8080 --bind 127.0.0.1
# Open http://127.0.0.1:8080/
npm test
```

The standalone preview uses bundled IBM Plex fonts under their SIL Open Font License.
Node 22+ is sufficient for tests; there are no npm dependencies.
