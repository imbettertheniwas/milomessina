# HQ visit requests: setup and review

## What this branch changes

- Public form: /hqvisitform/ (existing fomo design and minute-specific times).
- Console view: /internal#/visits, also available under /invoice/#/visits.
- Copy form link and Open form at the top of the view.
- Pending / confirmed / completed / declined filters, search, guest details and
  internal notes. Saving a status does not send mail or reserve calendar time.
- Storage in a new visit_requests tab of the spreadsheet the team already
  uses, through the Apps Script deployment it already uses. No second script,
  no second /exec URL, no second spreadsheet. The ledger, attendance and campus
  form tabs are untouched, and their behaviour does not change.
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

## Storage setup (project owner)

Visit requests go into the spreadsheet the team already works in, through the
form receiver already deployed from it. `server/visits/sheet.gs` is an extra
file for that existing Apps Script project; it defines no doPost and no doGet,
so it adds a branch without touching anything the receiver already answers.

1. Open the spreadsheet, then Extensions > Apps Script. This is the existing
   project, the one holding apps-script.gs. Do not create a new project.
2. Add a file: + next to Files, choose Script, name it `visits`. Paste the
   whole of server/visits/sheet.gs into it.
3. In apps-script.gs, add the visits route beside the invoice one, directly
   under `if (body._api === 'invoice') return invoiceApi(body);`

       if (body._api === 'visits') return visitsApi(body);

   and, in doGet, add `visits: typeof visitsApi === 'function',` beside the
   `ledger:` line. Both are already in this repo's copy of apps-script.gs, so
   pasting that file over the old one does the same thing.
4. Project Settings > Script Properties: add `VISITS_SERVICE_SECRET`, at least
   32 random characters. This is NOT CONFIG.SHARED_SECRET or INVOICE_KEY, both
   of which ride along in public page source. Guest contact details must not
   sit behind a turnstile.
5. Publish it. Deploy > Manage deployments > the existing deployment > edit >
   New version > Deploy keeps the /exec URL unchanged, which is the tidiest
   result when it works.

   If that silently keeps serving the old code — which has happened on this
   project, where several deployments sat pinned to different versions — use
   Deploy > New deployment > Web app, executing as yourself, access Anyone.
   That always publishes the code as currently saved. It produces a NEW /exec
   URL, which is fine: VISITS_STORAGE_URL simply points at that one. The
   console's own ENDPOINT is a separate setting for the ledger and does not
   have to match.
6. Open the /exec URL in a browser. It must report `"visits": true` alongside
   `"ledger": true`. Apps Script serves the last DEPLOYED version, not the last
   saved one, so this check is the only proof the paste actually went live.
   Saving alone never changes what the URL serves.

The visit_requests tab is created on first use. `VISITS_SHEET_ID` is an
optional script property, needed only to put visit rows somewhere other than
the spreadsheet this script already writes to.

### If the redeploy goes wrong

Deploy > Manage deployments > edit > Version, pick the previous version, and
Deploy. That restores the receiver exactly as it was. Visit requests then
answer as disconnected until you redeploy, which is their failure mode
everywhere: nothing is lost and nothing is silently accepted.

### What sharing the spreadsheet means

- Everyone who can open the spreadsheet can read guest names, emails, social
  links and notes directly, without signing in to Internal. The internal login
  gates the console, not the sheet. Keep spreadsheet sharing to the people who
  should see guest details.
- The form receiver writes a row, and will add a column, to whatever tab name a
  request names, and it is gated only by SHARED_SECRET. A stray post aimed at
  `visit_requests` therefore lands in the same tab. It cannot forge a visit:
  the connector ignores any row whose id is not a visit UUID and tolerates
  extra columns appended to the right, so neither the console list nor the rate
  limit is affected. Such a row is clutter to delete by hand.
- Deleting or reordering the first thirteen columns of `visit_requests` by hand
  disables the feature until they are restored. Adding columns after them is
  safe.

## Vercel configuration (project owner)

Set the following server environment variables for the intended deployment:

| Variable | Value |
| --- | --- |
| VISITS_PUBLIC_ORIGIN | Exact form and console origin, e.g. https://milomessina.com |
| VISITS_STORAGE_URL | The /exec URL of the deployment that reports "visits": true |
| VISITS_SERVICE_SECRET | Same random secret as the VISITS_SERVICE_SECRET script property |

For Preview, point VISITS_SHEET_ID at a scratch copy of the spreadsheet and use
a different service secret, so preview traffic never writes real rows. Set
VISITS_PUBLIC_ORIGIN to that preview deployment's exact origin. Production
credentials should not be attached to unreviewed preview branches. Until these
are set, the view and public form display the disconnected error.

Visit requests use the existing Internal login. The server validates the internal
session before reading guest details, and only Arya can change requests or hours.
There is no separate visit password or cookie. `VISITS_SESSION_SECRET` and
`VISITS_ADMIN_PASSWORD` are no longer used; existing values can remain in Vercel.
This change needs a website deploy only, with the existing identity-enabled Apps
Script deployment. Guest storage and existing rows are unchanged.

After setting environment variables, redeploy the feature preview and test it.
An owner can merge and deploy production after review. Do not share the new
public link until a real end-to-end check succeeds.

## Expected behavior

- Public POST /api/visits validates preferred NYC date/time and contact details.
- It writes a pending request, preserves exact minutes, and returns the request
  UUID as the receipt only after storage accepts it.
- Repeated IDs do not create duplicates. A different email on the same ID fails.
- Five new requests per normalized email per rolling 24 hours.
- Team reads require a valid Internal session; updates require Arya’s session.
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
