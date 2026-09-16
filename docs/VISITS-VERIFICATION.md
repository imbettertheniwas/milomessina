# Visit-request verification

Verified locally on 2026-09-16 against base commit
11d82c868838dcf9765367b498a326b2abe7803e.

## Feature checks

- Standalone React/TypeScript form build passed.
- 11 Node tests passed: server-side access control, secure signed sessions,
  cross-origin rejection, exact-time validation and storage, retry deduplication,
  throttling, concurrent-edit conflicts, formula-safe spreadsheet text handling,
  fail-closed configuration and existing inline-script parsing.
- Browser test used the isolated localhost preview and a synthetic guest:
  September 17, 2026 at 2:15 PM appeared in the team list; a status change and
  team note persisted across refresh; status filtering and Copy form link worked;
  Lock requests removed the guest details; the existing Ledger view still opened.
- The form build serves its assets from /hqvisitform/ so both slash and no-slash
  entry URLs can load without resolving assets against the wrong directory.
- No production visitor data, Google Apps Script deployment, Vercel environment
  setting or live website was changed.

## Existing regression suite

The landing page, campus village and creator form suites were run against both
the unchanged main checkout and this feature worktree in the same environment.

Both runs: 259 tests, 233 passed, 26 failed. The failing test names match exactly;
there were no additional failures on the feature branch. Failures concern the
existing landing intro test harness (module import parsing) and the existing
local preview routing/media tests. They have not been folded into this feature.

## Still required before production

The owner must configure separate test storage and server environment variables,
then verify the deployed Vercel-to-Apps-Script connection. Local tests use a
mocked Apps Script environment and the browser uses memory, so neither proves
a live Google deployment is configured correctly. Mobile-device testing and
review of the shared-password access model also remain part of owner acceptance.

See VISITS-SETUP.md and VISITS-COLLABORATION.md. This is a draft, unmerged feature.


## Concurrent collaborator change preserved

Before publication, main advanced to 93ab90a09bf4ecee8a90673dc460b8fff69b2697,
adding the Chapters view and a commits endpoint. It was merged into this feature
branch, preserving both routes and the existing function configuration.
The only manual merge resolution was additive Vercel configuration: the new
commits function and visit-request function are both retained.
The feature tests were rerun after merging. The broader test sources and their
dependencies were unchanged by the collaborator's update.
