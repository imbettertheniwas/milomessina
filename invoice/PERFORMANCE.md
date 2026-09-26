# Internal performance audit — 25 September 2026

The measurements below were captured before deployment. Existing unrelated changes were preserved. Website/API publication and a separate update of the existing Apps Script deployment are required to activate all fixes.

## Measurements

These measurements describe different layers; browser rendering and simulated upstream latency are not production page-load times.

| Check | Before | After |
| --- | ---: | ---: |
| Main-page capability requests during returning-session startup | 3 | 1 |
| Overview render, 1,000-row synthetic ledger, median of 15 calls in desktop Chrome | 68.9 ms | 1.9 ms |
| Hidden ledger rows / GitHub calendars built at startup | 1,000 / 6 | 0 / 0 |
| GitHub refresh, same 30 simulated reads at 25 ms each, median of three runs | 789 ms | 235 ms |
| Beta manager batch-sheet scans with 40 members | 43 | 2 |
| Beta manager member-sheet scans | 3 | 1 |
| Admin table scans with a selected table | 12 | 6 |
| Unchanged referral refresh: referrer/referral scans | 4 | 2 |
| Ledger subscription reads per list request | 2 | 1 |
| Twelve due recurring charges | 12 appends | 1 bulk write |
| Forty imported schedule blocks | 40 appends | 1 bulk write |
| Visits inbox before opening hours panel | 2 sequential reads | 1 read |

A separate read-only check of the deployed service measured approximately 2.51 seconds for capabilities, 2.58 seconds for sign-in, and 4.58 seconds for the ledger. Those are pre-deployment observations, not post-fix results. Apps Script/network latency remains; the changes reduce duplicate work and request contention.

## Changes

- Shared capability requests expire after 60 seconds. Concurrent ledger reads share one promise; unchanged responses skip redraw and storage writes. Version checks prevent delayed reads from overwriting completed edits, including reads started during an edit.
- The page renders the active view. Ledger rows, attendance, recurring tables, reports and GitHub calendars are built when needed. Currency formatting reuses one formatter, and per-record permission checks use indexes instead of scanning the ledger for each button.
- Posts and schedules load on activation. Overview still requests campus counts after the ledger arrives, without constructing hidden campus tables. Schedules render only their selected subtab.
- Chapters share pending reads, pause polling when hidden, reuse fresh data and avoid rebuilding an unchanged map. Visit opening hours load when expanded. Portal checks start alongside their index request.
- Beta reuses fresh public GitHub results before making another request. Searching the manager roster preserves the selected member's details; obsolete requests are cancelled.
- GitHub API reads overlap with a global limit of four, retaining the existing 60-read budget, rate-limit handling and partial-result semantics. Request and refresh deadlines bound failures. Visits reuse a short-lived positive deployment capability, while each new completed request still revalidates authorization; private visit records are not cached between requests.
- The shared backend reuses data within each response and batches recurring-charge and schedule-import writes. It retains write locks, authentication, duplicate checks, sheet-capacity handling and the complete shared backend.
- Connected read requests have deadlines so a failed upstream does not leave a loading control stuck indefinitely. Writes are not automatically retried.

## Validation

- `node --test tests/*.test.mjs`: **428 passed**, including new request-race, recovery, permission, operation-count, view-activation, timeout and cache tests.
- Connected campus API/feed tests: **22 passed**.
- Browser smoke check: **19 main dashboard views** opened with a synthetic 1,000-row ledger and simulated sheet responses, with **no JavaScript errors**. Overview visually checked at desktop and 390-pixel mobile widths. This was not a physical iPhone/Safari test.
- Syntax and `git diff --check` passed.

## Deployment

Publish the frontend and API changes through the existing website deployment. Separately update the existing Apps Script deployment with the complete `fomo/setup/apps-script.gs`, preserving CONFIG, Script Properties, service secrets and its existing `/exec` URL. `server/visits/sheet.gs` remains a synchronized reference module; it is not a replacement for the complete backend.

After deployment, verify authenticated load times and refresh/write behavior against the live service. Local checks do not prove deployment or live latency.
