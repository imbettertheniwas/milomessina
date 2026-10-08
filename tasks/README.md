# Campus tasks

Public, no-sign-in task offers for members who have already onboarded a chapter, served at `/tasks` and `/tasks/`. The page is excluded from search indexing; the URL is not access-controlled.

Edit `offers.json`, then run `node tasks/build.mjs` from the repository root to regenerate the static HTML. `icons.json` contains the corresponding Lucide SVG icons. Brand assets and Aeonik fonts are served locally.

All opportunities are independent and optional. Checklists and draft updates are saved only in the visitor’s browser under `fomo-campus-tasks-v1`; this does not import or synchronize the earlier ChatGPT Site’s account progress. Visitors copy updates and send them to their existing fomo contact for review. The page does not submit, approve, or pay out rewards.

Manual verification: open the travel offer before the dinner, check an item, enter a draft, reload, and confirm the saved state. Copy the update and check the handoff message. Verify all offers and the referral bonus fit both mobile and desktop widths.

## Remembered campus profiles

The first visit asks for a name and a school. `/api/task-schools` reads the existing server-only `CAMPUSWARS_ADMIN_PASSWORD` / `CAMPUSWARS_ADMIN_USERNAME` configuration and returns only deduplicated school names and public brand fields. Every school registered in the admin is eligible; there is no 80% threshold. No credential, chapter contact, or individual member data is returned.

Names, selected schools, checklists, event-date drafts, and task updates are stored per profile in localStorage (`fomo-campus-task-profiles-v2`). Calendar files up to 10 MB are stored in IndexedDB (`fomo-task-calendar-files`) by profile ID. These are browser-local profiles, not authenticated accounts, and do not synchronize between devices. Existing v1 task drafts migrate to the first new profile. “Change person” keeps each name/school combination’s progress separate.

All five completed checklists make the visitor eligible for the stated $100 completion bonus; the interface asks them to send their updates to fomo for review. A checked item is not a server approval or payment. Calendar attachments must be sent to the fomo contact separately; the page stores them locally and provides a download.

School brand coverage combines the existing 93-campus library with ESPN team metadata and official university homepage/brand assets. Additional source URLs are retained in `school-brands.js`. Colors with low text contrast are darkened for readable controls; original school colors remain in the brand accents. Current live coverage was checked against all 136 admin-listed schools.

Validation: `node --test tests/tasks.test.mjs`. For local testing, provide the server environment and run `node tests/preview-tasks.mjs`. No test credentials belong in source.
