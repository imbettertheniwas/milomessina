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

Open http://localhost:4187/hqvisitform/ to preview the public form.
The preview uses memory and has no production credentials. Internal guest-list
access is disabled in this standalone preview. Restarting clears test requests;
no test records are bundled or sent to the real spreadsheet.

## Storage setup (project owner)

Use the complete **`fomo/setup/apps-script.gs`** file. It includes visit requests
and hours alongside the ledger, approvals, Undo, attendance, profiles, campus,
and posts. A separate visits file is no longer needed.

1. Open the existing spreadsheet → Extensions → Apps Script.
2. Preserve any custom `CONFIG` values, then replace the main script contents
   with the entire `fomo/setup/apps-script.gs` file and restore those values.
   If a separate `visits.gs` exists containing only the old visit module,
   remove that duplicate code after saving a copy. Keep unrelated script files.
3. Keep all existing Script Properties, including `VISITS_SERVICE_SECRET` and
   any `VISITS_SHEET_ID`. The service secret must match the existing Vercel
   configuration; do not generate a new secret when restoring the code.
4. Deploy → Manage deployments → select the existing deployment → edit →
   New version → Deploy. Keep the existing /exec URL.
5. Open that /exec URL. It must report `"visits": true`, `"visitHours": true`,
   and `"ledger": true`. Saving alone does not publish a new version.

This restores code only. Do not clear or recreate spreadsheet tabs.

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
