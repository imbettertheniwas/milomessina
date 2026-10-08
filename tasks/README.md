# Campus tasks

Public member workspace: `/tasks`. Operator view: `/internal#/tasks` (Milo and Arya).

`node tasks/build.mjs` generates the page from `offers.json` and `icons.json`. There are five optional core tasks and a separate chapter referral. Task card summaries include the entire header, reward description, and perks, so clicking anywhere on a closed card opens it.

## Shared tracking

`tasks/shared.js` talks to the existing internal Apps Script deployment using the `campusTasks` namespace. `fomo/setup/apps-script.gs` contains the complete backend. The existing deployment can also retain its existing `Code.gs` and duplicate `visit.gs`: route `body._api === 'campusTasks'` to `campusTasksApi(body)` in both and install the campus tasks section once as `campusTasks.gs`. Preserve existing CONFIG values, Script Properties, deployment URL, and access settings. Website and Apps Script releases are separate.

The service creates four isolated tables in the existing spreadsheet: `campus_tasks_members`, `campus_tasks_progress`, `campus_tasks_files`, and `campus_tasks_audit`. It does not rewrite existing internal records. Drafts and review snapshots are separate. Reviews check the current revision, identify the reviewer, and record feedback. Approved tasks are locked until an operator requests changes. Five approved core tasks make the $100 bonus eligible; payment controls record a completed transfer and never send money. Referral rewards are separately approved at $50 or $100.

Members remain passwordless. A random 72-character bearer token is stored in their local profile, hashed on the server, and included in a private return link's fragment for another device. A name and school alone never unlock an existing server record. Losing both the browser storage and private link means a new profile, rather than exposing another person's records. Internal listing, reviews, and payment records require the existing authenticated Milo/Arya operator session. Private calendar files are stored in a dedicated Drive folder and downloaded only after member ownership or operator authorization. Uploads are limited to 10 MB and 20 files per profile. Old files remain for submitted-review history.

Local drafts are kept during service failures. Existing device-only checklists import as drafts when that browser next opens the new site; they do not become approved submissions. Records from browsers that have not returned cannot be recovered centrally. New members see that progress saves with fomo. “Load saved progress” restores the shared version after a conflict; the user confirms replacement of their local draft.

## Schools

`/api/task-schools` reads the registered school names from fomo campus admin with server-only environment credentials. Any listed school is allowed, including schools with no joins. The Apps Script rechecks this same list at registration. `school-brands.js` reuses campus identities and stores source URLs for added ESPN/official university logos; no admin contact data or passwords are exposed. The picker recognizes common abbreviations, acronyms, nicknames, and partial names, but can select only a returned school.

## Validation

`node --test tests/*.test.mjs` runs the repository tests, including task ownership, stale reviews, draft/submission separation, file access, bonus eligibility, and payment retry protection. `node tests/preview-campus-backend.mjs` starts an isolated in-memory end-to-end preview on port 5181, with synthetic accounts and files. It never writes test records to the production spreadsheet. `tests/preview-tasks.mjs` remains the basic static preview with the real read-only school source.

## Step reviews
Each checklist step has independent notes, up to five private attachments (10 MB each), and a review submission. `campus_tasks_steps` stores drafts, submitted snapshots, revisions and feedback. Admins review each step; approving every step automatically approves the task. All five approved tasks unlock the existing $100 payment record. Legacy whole-task submissions remain reviewable until a member starts using step submissions. Attachments support documents, images and short MP4/MOV files; larger videos use links. Unsynced step drafts and files stay in browser storage for retry.
