# FOMO Campus website handoff

This package contains the landing page, Greek village, internship, role application, creator application/submission, onboarding, chapter-link and report pages; their fonts, images, videos and scripts; the chapter-feed API; and integration source and tests. `RELEASE.json` identifies the exact source commit and `SHA256SUMS.txt` verifies each packaged file.

## Greek Wars: onboarding and live data

**Existing landing-page destinations are unchanged.** “Greek Wars” in the program navigation scrolls to the Greek Wars section on the same page. “Onboard your chapter” leaves this domain and opens https://www.aryatoufanian.com/fomo/onboard/. “Explore the Greek village” stays on this domain at `/fomo/campuswars/`. The village’s “Join Greek Wars” and “Claim your lot” buttons also open Arya’s onboarding page.

See `EXTERNAL-LINKS.md` for the page-by-page inventory of links leaving this domain.

**Live fraternity/chapter onboarding data comes from Arya's site.** The included server-side `/api/campuswars` function reads authenticated registration aggregates from `https://www.aryatoufanian.com/admin/`, strips them to public chapter totals, and supplies the Greek village. The browser polls that local API about every 30 seconds, with caching and retry/backoff. It does not read the admin page directly or receive the admin credentials. `chapters.json` is the fallback snapshot, not the authoritative live source.

Data flow: **Arya's onboarding → Arya's registration/admin source → `/api/campuswars` → Greek village house sizes and standings.** Retain this integration and configure the server-only environment variables when deploying on FOMO's hosting. The ZIP alone cannot provide live data without the authorized server configuration.

## Preview

Use Node.js 22 or later. From the extracted package root:

```sh
node server/campuswars-preview.mjs
```

Open http://127.0.0.1:4179/landingpage/ in a browser. The preview supports MP4 byte-range requests required by Safari and the connected program routes. Its public chapter-feed proxy uses the existing hosted feed; if it is unavailable, the village displays its saved registration snapshot. Previewing requires no credentials. Do not open the HTML files through `file://`: modules and root-relative paths require an HTTP server.

## Hosting and integrations

Keep `/landingpage/`, `/fomo/`, and `/api/campuswars` at the host root. On Vercel, use the package root with no framework or build command; keep `api/campuswars.mjs`, `server/campuswars-source.mjs`, and `vercel.json`. The landing URL is `/landingpage/`. On a different host, serve the static routes and provide the chapter API using the included server-side source.

Live chapters require the server environment variable `CAMPUSWARS_ADMIN_PASSWORD`; `CAMPUSWARS_ADMIN_USERNAME` defaults to `village`. Obtain values from the current owner through your normal credential-sharing process. Credentials are not included. Without configuration the API returns 503 and the village visibly falls back to saved data.

The existing chapter registration links point to Arya's onboarding site. Applications, creator submissions and reports retain their existing Google Apps Script endpoint in `fomo/assets/form.js`. Its deployment source and setup instructions are in `fomo/setup/`. FOMO download, invite, Discord, school artwork and verification services remain external dependencies. This ZIP includes the integration code, not ownership of those services or their credentials. No production submissions were sent during verification.

For a move to a FOMO-owned domain, update the canonical/Open Graph URLs in `landingpage/index.html` and `fomo/campuswars/index.html`, and the sharing base URL in `fomo/campuswars/site.js`. Confirm the form endpoint, onboarding links and server environment with the service owners before switching domains. Deploy only browser assets and the chapter API; setup source, tests, this README, manifests and source documentation are handoff material.

## Safari fixes in this release

The landing page is included exactly as previously published. Its source, layout and button destinations have not been changed in this release.

- Stable mobile animation deadlines, with graphics load adapting to missed GPU frames.
- Crowd detail measured in CSS pixels instead of Retina drawing-buffer pixels; lighter ground shading on phones.
- Touch dragging continues after one finger leaves a pinch, without triggering an accidental chapter selection.
- Stable village viewport height and coalesced, deduplicated drawing-buffer resizes.
- Safari-compatible local MP4 range responses and connected-page preview routing.

## Verification

```sh
node --test landingpage/tests/*.test.mjs fomo/campuswars/tests/*.test.mjs fomo/submit/tests/*.test.mjs
```

The release was checked at phone portrait and landscape sizes, including intro completion, skip/replay, section navigation, village loading and controls. Automated checks cover playback recovery, paused/hidden rendering, Safari frame jitter, pinch continuation, streaming, API behavior and media range responses. A physical iPhone was not available for hardware testing; real-device frame rate depends on phone generation, power mode and temperature.
