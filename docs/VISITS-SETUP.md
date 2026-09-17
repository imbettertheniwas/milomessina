# HQ visit requests: setup and review

## What this branch changes

- Public form: /hqvisitform/ (existing fomo design and minute-specific times).
- Console view: /internal#/visits, also available under /invoice/#/visits.
- Copy form link and Open form at the top of the view.
- Pending / confirmed / completed / declined filters, search, guest details and
  internal notes. Saving a status does not send mail or reserve calendar time.
- Separate, server-protected visit storage. Existing ledger, attendance, campus
  forms and their Apps Script deployment are unchanged.
- No existing visit records are imported or moved.

Nothing is connected to production in this branch. With missing settings the API
returns a clear unavailable response. It never pretends a request was saved.

## Review locally without touching real records

Requires Node.js 22.13+ and npm for rebuilding the form. The checked-in public
build and local preview server can run without installing dependencies.

    node server/visits-preview.mjs

Open http://localhost:4187/internal#/visits and
http://localhost:4187/hqvisitform/ in the same browser.
Use local-preview-only-visit-pass to unlock the visit list.

The preview uses memory, has no production credentials and makes no production
storage requests. Restarting clears its test requests. It serves the console
with its old gate removed and ledger in device mode for preview ONLY; the
committed console's existing gate is unchanged. Use a fresh browser profile if
you need a clean local ledger. No test records are bundled.

The team session uses an HttpOnly, Secure, SameSite=Strict cookie. Use localhost
(not a LAN address) for the browser preview; production requires HTTPS.

## Separate test storage first (project owner)

1. Create a NEW private Google spreadsheet specifically for visit requests.
   Do not put guest records in the current ledger spreadsheet.
2. From that sheet, open Extensions > Apps Script. Use the entire
   server/visits/sheet.gs as the script.
3. In Script Properties set VISITS_SERVICE_SECRET to a unique random secret of
   at least 32 characters. Keep it out of source control and browser code.
4. Deploy this standalone script as a web app, executing as the spreadsheet
   owner, with invocation allowed for Anyone. The code itself requires the
   server-only secret on every operation; GET exposes no data.
   This deployment choice should be reviewed by the project owner.
5. Copy the resulting https://script.google.com/macros/s/.../exec URL.
   The script creates only its own visit_requests tab on first use.
6. Restrict spreadsheet sharing to the team members who need the records.

Do NOT paste this script into the current fomo receiver. No changes to that
deployment are needed. If the organization forbids anonymous Apps Script
invocation even with application authentication, use a different private store
behind createSheetStore instead.

## Vercel configuration (project owner)

Set the following server environment variables for the intended deployment:

| Variable | Value |
| --- | --- |
| VISITS_PUBLIC_ORIGIN | Exact form and console origin, e.g. https://milomessina.com |
| VISITS_STORAGE_URL | New Apps Script /exec URL |
| VISITS_SERVICE_SECRET | Same random secret as the new script property |
| VISITS_SESSION_SECRET | A DIFFERENT random secret, at least 32 characters |
| VISITS_ADMIN_PASSWORD | A separate strong team visit-access password, at least 16 characters |

Use a separate spreadsheet, secrets and password for Preview. Set
VISITS_PUBLIC_ORIGIN to that preview deployment's exact origin. Production
credentials should not be attached to unreviewed preview branches. Until these
are set, the view and public form display the disconnected error.

Share the visit-access password with approved teammates using the team's normal
private channel. It is NOT the existing page-source passcode. It grants access
only to visit requests; it does not replace or change the existing console gate.
Sessions last four hours. Rotating either the password or session secret
invalidates prior sessions. The standalone script applies a shared, short-lived
10-attempt/15-minute login limit; Apps Script cache availability is best-effort.
A shared password provides team access, not per-person identity or an audit trail.

After setting environment variables, redeploy the feature preview and test it.
An owner can merge and deploy production after review. Do not share the new
public link until a real end-to-end check succeeds.

## Expected behavior

- Public POST /api/visits validates preferred NYC date/time and contact details.
- It writes a pending request, preserves exact minutes, and returns the request
  UUID as the receipt only after storage accepts it.
- Repeated IDs do not create duplicates. A different email on the same ID fails.
- Five new requests per normalized email per rolling 24 hours.
- Authenticated team list and update actions use the signed server session.
- Concurrent status/note edits return a conflict instead of overwriting another
  person's changes. Refresh and reopen the request to get the new version.
- Guest details stay out of localStorage and public API reads.
- Spreadsheet strings have an invisible text marker to preserve dates and
  prevent formulas from executing. The connector removes exactly that marker.
- No email, calendar, delete, payment, contact-import or legacy data migration
  action is included.

## Build and verification

    npm ci --prefix visit-form
    npm run build --prefix visit-form
    node --test tests/visits.test.mjs tests/visits-sheet.test.mjs
    node --test landingpage/tests/*.test.mjs fomo/campuswars/tests/*.test.mjs fomo/submit/tests/*.test.mjs
    git diff --check

The form build updates hqvisitform/ and server/visits/validation.mjs. Commit both
alongside source changes. The main site remains a static Vercel project without
a root build command. No new root package.json is added.

## Release checks

On a separate test deployment, submit a clearly labeled test request, verify
its exact preferred time, retry the same ID, and confirm that there is one row.
Check unlock/lock, filters, notes, stale-edit conflicts and keyboard/mobile use.
Check that unauthenticated list/update requests fail and arbitrary origins fail.
Verify the ledger, attendance, campus forms and existing chapter API still work.
Coordinate handling/removal of any test data with the spreadsheet owner.

The old form at bijanizadian.com remains unchanged. Keep it available until the
team verifies the new flow; redirects or migration of its historical requests
are a separate follow-up. See VISITS-COLLABORATION.md for the Git workflow and rollback.
