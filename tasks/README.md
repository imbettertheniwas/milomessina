# Campus tasks

Password-protected member workspace: `/tasks`. Operator view: `/internal#/tasks` (Milo and Arya).

`node tasks/build.mjs` generates the page from `offers.json`, `companies.json`, and `icons.json`. There are five optional core tasks and a separate chapter referral. Task card summaries include the entire header, reward description, and perks, so clicking anywhere on a closed card opens it.

## Shared tracking

`tasks/shared.js` talks to the existing internal Apps Script deployment using the `campusTasks` namespace. `fomo/setup/apps-script.gs` contains the complete backend. The existing deployment can also retain its existing `Code.gs` and duplicate `visit.gs`: route `body._api === 'campusTasks'` to `campusTasksApi(body)` in both and install the campus tasks section once as `campusTasks.gs`. Preserve existing CONFIG values, Script Properties, deployment URL, and access settings. Website and Apps Script releases are separate.

The service creates four isolated tables in the existing spreadsheet: `campus_tasks_members`, `campus_tasks_progress`, `campus_tasks_files`, and `campus_tasks_audit`. It does not rewrite existing internal records. Drafts and review snapshots are separate. Reviews check the current revision, identify the reviewer, and record feedback. Approved tasks are locked until an operator requests changes. Five approved core tasks make the $100 bonus eligible; payment controls record a completed transfer and never send money. Referral rewards are separately approved at $50 or $100.

Members create an email/password account. Web Crypto derives a 256-bit PBKDF2-SHA256 proof using a random 128-bit salt and 600,000 iterations. The server stores only its SHA-256 digest in a separate credentials table; no plaintext password or proof is kept in browser storage. Sessions use random 72-character tokens, expire after 30 days, and are revoked on sign-out. Ten failed logins per email within 15 minutes are rate-limited in a persistent table. Operator responses never include credentials or session hashes.

Existing passwordless profiles must set a password using their existing ownership token; this preserves the member ID, progress, files and reviews and invalidates the old token/link. Name and school alone cannot claim a profile. Cross-device access now uses email/password rather than private return links. Email verification and automated password recovery are not implemented. Password accounts do not enforce invitation quotas or one-person-per-school admission; those are program positioning for now.

Private calendar and step attachments remain scoped to the member or an authenticated operator. Uploads are limited to 10 MB per file. Old files remain for submitted-review history.

Local drafts are kept during service failures. Existing device-only checklists import as drafts when that browser next opens the new site; they do not become approved submissions. Records from browsers that have not returned cannot be recovered centrally. New members see that progress saves with fomo. “Load saved progress” restores the shared version after a conflict; the user confirms replacement of their local draft.

## Schools

`/api/task-schools` reads the registered school names from fomo campus admin with server-only environment credentials. Any listed school is allowed, including schools with no joins. The Apps Script rechecks this same list at registration. `school-brands.js` reuses campus identities and stores source URLs for added ESPN/official university logos; no admin contact data or passwords are exposed. The picker recognizes common abbreviations, acronyms, nicknames, and partial names, but can select only a returned school.

## Validation

`node --test tests/*.test.mjs` runs the repository tests, including task ownership, stale reviews, draft/submission separation, file access, bonus eligibility, and payment retry protection. `node tests/preview-campus-backend.mjs` starts an isolated in-memory end-to-end preview on port 5181, with synthetic accounts and files. It never writes test records to the production spreadsheet. `tests/preview-tasks.mjs` remains the basic static preview with the real read-only school source.

## Step reviews
Each checklist step has independent notes, up to five private attachments (10 MB each), and a review submission. `campus_tasks_steps` stores drafts, submitted snapshots, revisions and feedback. Admins review each step; approving every step automatically approves the task. All five approved tasks unlock the existing $100 payment record. Legacy whole-task submissions remain reviewable until a member starts using step submissions. Attachments support documents, images and short MP4/MOV files; larger videos use links. Unsynced step drafts and files stay in browser storage for retry.

## Campus network and career benefit

FOMO is the sole active company. Each offer has an explicit company ID so the presentation can expand later; adding another company still needs server task/review/reward definitions. No Icybox offers are live. All tasks are optional and independent. The progression to more capital is program copy, not an automatic budget or payment action.

The LinkedIn experience card is a preview until all five distinct FOMO core tasks are server-approved. Referral approval and checked boxes cannot unlock it. Once eligible, members can copy the experience text and add their actual dates. Team-building and internship copy describes the intended program; no team accounts or automatic job records are created.

Local-only UI fixtures: visit /qa-member-preview or /qa-member-preview?approved=5 on the isolated preview server. These synthetic accounts never reach production.

Successful signup, password sign-in, and validated saved sessions all await the school-colored welcome reveal (`welcome-reveal.js`) before rendering the workspace. A separate readiness gate keeps the header and dashboard hidden even if school data finishes loading during the intro. The local preview uses this same entry path without an injected animation. A neutral intro opens immediately while authentication runs. School data and session validation run concurrently, and saved progress loads during the two-second welcome. Members can also enter immediately. Reduced-motion users get a static welcome with manual entry. The public form stays concise. Preview the reveal with `/qa-member-preview?welcome=1`; add `&school=university-of-washington` to inspect another campus palette.
