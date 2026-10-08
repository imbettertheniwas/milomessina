# Campus tasks

Public, no-sign-in task offers for members who have already onboarded a chapter, served at `/tasks` and `/tasks/`. The page is excluded from search indexing; the URL is not access-controlled.

Edit `offers.json`, then run `node tasks/build.mjs` from the repository root to regenerate the static HTML. `icons.json` contains the corresponding Lucide SVG icons. Brand assets and Aeonik fonts are served locally.

All opportunities are independent and optional. Checklists and draft updates are saved only in the visitor’s browser under `fomo-campus-tasks-v1`; this does not import or synchronize the earlier ChatGPT Site’s account progress. Visitors copy updates and send them to their existing fomo contact for review. The page does not submit, approve, or pay out rewards.

Manual verification: open the travel offer before the dinner, check an item, enter a draft, reload, and confirm the saved state. Copy the update and check the handoff message. Verify all offers and the referral bonus fit both mobile and desktop widths.
