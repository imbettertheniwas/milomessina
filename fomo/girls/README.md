# FOMO Girls — mission board

Public portal at `/girls` (also `/girls/`), with assets under `/fomo/girls/`. Visitors explore contribution missions in any
order, select their interests, and provide one profile when ready to save.
There is no sequential quiz. A featured $100 mission leads the board; compact cards, tap choices, an optional random picker, and a views-to-earnings slider
provide the interaction. Cards react to pointer position on desktop; added
items animate toward the compact Continue button. The old list sidebar is removed. Reduced-motion preferences disable animation.
Reward terms and steps sit inside expandable details. Every screen has a Continue shortcut
once an option is added.

## Contributions and incentives

- **Fraternity referral:** $100 when the referred fraternity completes onboarding
  and FOMO verifies attribution. Pinning or submitting never earns a payout.
- **Videos:** the slider uses the existing `/fomo/submit/` calculator: $2 per
  1,000 qualifying views, capped at $5,000 per approved video. The one-time
  $25 creator approval bonus is separate. Defaults to 100K views / $200.
- **Stories:** $20 per approved story, with the brief confirmed before posting.
  Stored as `stories`, separately from `creator`; both share creator-profile fields.
- **Dinner content:** dinner comped after attendance and agreed content are
  completed. The invitation, deliverables, and comp details are confirmed first.
  Just attending or bringing friends does not claim the content comp.
- **Internship:** selection for campus leadership, with responsibility and
  decision-making scope defined by the assigned role. The five existing campus
  roles are offered as interests; submitting does not confer a role.

Mission details capture creator activity/platform/audience,
fraternity reach plus target chapter/university, dinner interest/contribution,
and internship role. The final profile captures college status, student school,
name, email, city, optional Instagram, and contact consent. Unexplored missions
are stored as `skip`, not negative qualifications. Removing a mission clears its
fields. Returning visitors can recover their draft in the same browser tab.

The saved playbook provides a copyable fraternity introduction. It does not send
messages, mint an attributed referral link, automatically verify onboarding,
issue payments, approve content, reserve a dinner, or award an internship.
It is a saved-plan snapshot, not a live earnings dashboard.

## Main FOMO/Campus spreadsheet

`config.js` targets the same Apps Script deployment as `fomo/assets/form.js`.
`_api: girls`, `action: join`, `flow: missions-v2` writes to the `girls` tab
of that existing spreadsheet. The full receiver lives in
`fomo/setup/apps-script.gs`.

The receiver stores mission IDs, structured `planned` mission states, the
fraternity target, dinner contribution, and desired internship role alongside
existing profile fields. The server sets the fraternity offer to $100, records
`onboarding pending`, records content-dinner rewards as
`attendance and content pending`, and initializes verified earnings to zero.
It never trusts client-supplied reward amounts or completion claims.
Operations must verify attribution, onboarding, content completion, and payments
through the team's existing process. No automated status synchronization exists.

The Girls-specific $100 offer does not modify the existing general referral
ladder in `fomo/refer/tiers.js`. Treat it as its own campaign; this implementation
does not stack or award that ladder's rewards.

A v1 `girls` sheet gains columns at the end without rewriting prior records.
Retries deduplicate by submission UUID under the shared script lock. A public
signup cannot read or edit the list. Formula prefixes are escaped. The client
requires a versioned receipt so an older receiver cannot silently acknowledge
missions it did not save.

**Spreadsheet service deployment is separate from the site push:** update the existing shared Apps Script project with the
complete backend while preserving its deployed CONFIG and Script Properties,
then deploy a new version of the existing service. GET should report
`girlsMissions: true`. Publish the website through its normal release process.
Live Google Sheet writes and payments have not been tested or activated here.

## Verification

- Preview: `node server/campuswars-preview.mjs`, then
  `http://127.0.0.1:4179/fomo/girls/`.
- Tests: `node --test tests/girls-earnings.test.mjs tests/girls-input.test.mjs tests/girls-route.test.mjs tests/girls-portal.test.mjs tests/portals-sheet.test.mjs tests/referrals-sheet.test.mjs`.
- Isolated end-to-end QA: `node tests/preview-girls.mjs`, port 4181. The first
  request simulates an outdated receiver; retry runs the real backend in a VM
  against an in-memory sheet. No Google writes. Restarting clears test rows.

72 tests pass, covering all five mission types, existing profile validation,
reward tampering, conditional dinner comps, v1 schema migration, stale-field
cleanup, idempotency, and existing form/referral regressions. Browser checks
cover pinning every mission, reload recovery, the one-profile save, failed save
and retry, and desktop/mobile layouts.

The compact UI was checked at desktop, 390px, and 320px widths, including tap
choice capture, list recovery after reload, random exploration, and failed-save
retry against the local receiver. No browser console errors were observed.

The updated cover art is CSS-rendered: a story preview, an influencer-dinner receipt,
and a campus internship pass. Mobile uses one card per row. Slider input does not
open the video dialog. Estimates never enter the payout or signup payload.
