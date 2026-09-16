# Working together on visit requests

This feature lives on codex/hq-visit-requests, not main.

1. Review the draft pull request and try its local preview.
2. Keep changes on this branch; use normal commits and pushes.
3. Fetch origin/main before final review. If someone else changed the same file,
   resolve those differences here and rerun checks. Do not force-push shared work.
4. Configure a separate test spreadsheet and test deployment first, as described
   in VISITS-SETUP.md. Preview deployments must not use production storage.
5. Have the repository owner review and merge. Merging main may trigger the site's
   existing Vercel production deployment.
6. Keep the existing visitor link active until a real submission to the new form
   appears in Visit requests. Moving old visitor records is a separate operation.

The existing Apps Script receiver, ledger and attendance data are not changed.
No production settings or visitor records are included in this branch.

Rollback: revert the feature's merge commit through a new PR. Keep the private
visit spreadsheet so already received requests remain available to the team.
