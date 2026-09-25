# Beta intern batches

This adds a separate two-week workspace at `/internal/beta`. Arya and Milo manage it from **Beta batch** in `/internal`. Beta participants never enter `internal_roster` or the main team's money, schedules, posts, portals, referrals, or visits tools.

## What is included

- Arya or Milo creates a batch with a name and first day. Its end date is the 14th calendar day, inclusive: start date plus 13 days.
- One shared invite link lets anyone holding it join immediately. It walks them through the two-week program, collects name, email, phone number and GitHub username, and lets them review those details before joining. There is no approval queue.
- The guide asks interns to make their internship projects public on GitHub so the group and Arya can follow their work. It explains attendance and the final recap before they join.
- Joining creates a profile immediately and remembers it on that device. A personal return link opens the same profile on another device. There is no beta password or manual access-code entry. A returning device renews its short-lived session automatically using its saved personal link.
- All participants have the same beta access: their batch roster, the batch's shared attendance and public GitHub activity, and their own two-week recap. Onboarding, task assignment, and check-in APIs are not included.
- Participants mark or remove only their own attendance. Dates must fall within the batch and cannot be in the future. The server uses the Apps Script project's time zone; set it to `America/New_York` to match the interface.
- A recap includes what the person learned, what they accomplished, and optional work links. Drafts can be saved, edited, submitted, and resubmitted. Both written sections are required to submit. The batch's final date is shown as the due date; late submissions remain possible.
- Arya and Milo see every batch, name, email, phone number, attendance record, recap draft/submission, linked GitHub account, and private evaluation note in `/internal` → **Beta batch**. Email and phone are visible only to the participant and operators; peers see names, GitHub accounts and attendance. Participants see their own recaps. Recap sharing with other beta participants remains a product decision; the current implementation keeps them private to the author and operators.

GitHub activity is public authored commits in owned, non-fork repositories for the batch dates. Private work and work in other owners' repositories are outside this counter. Partial results and request failures are labeled. The linked GitHub username and submitted identity are self-reported; joining does not verify email or GitHub ownership.

## Access and deployment

The regular team keeps its existing `/internal` passcode and name selector. Beta participation does not set or require `INTERNAL_LOGIN_SECRET`, change the team password, or alter the main roster. A beta session belongs to one stable member ID and is rejected by the main internal APIs.

The server creates its own `INTERNAL_BETA_SECRET` when an operator creates the first batch. This key is used only for beta invitations, personal links, and beta sessions. Nobody needs to choose or type it. Preserve that property when updating the script; changing it invalidates existing beta links and sessions. The existing visits properties and configuration remain separate.

The regular team still uses its existing shared-passcode trust model. Someone who separately knows the main team passcode can use its name selector; a beta invitation grants no main-team session.

The website and Apps Script require separate deployments. Pushing website code does not activate Apps Script handlers.

1. Open the **existing Apps Script project** behind the endpoint used by `/internal`. Preserve its current deployment version for rollback, all `CONFIG` values, and existing script properties.
2. Install the complete `fomo/setup/apps-script.gs`, preserving the deployed configuration. It includes forms, money, schedules, posts, referrals and visits alongside beta access. Keep the project time zone at `America/New_York`.
3. Update the existing web app through **Deploy → Manage deployments → Edit → New version → Deploy**. Preserve its `/exec` URL, **Execute as: Me**, and **Who has access: Anyone**.
4. Verify the capability response includes `beta: true`, `betaPasswordless: true`, and the existing service flags. Publish the matching website and server access checks before sharing invitations.
5. Sign in to `/internal` normally as Arya or Milo, create the real beta batch and save its shared invite. Opening the invitation explains the program, collects the intern's details, and creates their profile without a password.

The shared invite uses `/internal/beta#invite=BATCH-<random-token>`. The personal return link uses `/internal/beta#access=BETA-<random-token>`. Both tokens belong in URL fragments, not query parameters. The browser removes the credential fragment after successful entry; it remembers the personal link on that device. Sign out removes that device's saved access. Keep a personal return link private because it opens its owner's profile.

## Management and storage

**New invite link** replaces the previous shared link for future joins. Existing participants' personal links and sessions continue working. The original plain token cannot be recovered from the sheet.

**Replace personal return link** invalidates the participant's previous link and sessions immediately. Share the new personal link with that person directly.

Pausing or graduating a participant closes their access and preserves their record. Closing a batch pauses every participant's access. Reopening a batch or reactivating a participant lets their saved personal link obtain a fresh session; old sessions do not resume. Graduation does not add anyone to the main roster.

An email already used in the same batch cannot create or take over an existing account. A returning participant can use their remembered device or personal return link, or ask an operator for a replacement link. The same person may join a different batch as a separate batch member.

The script creates these separate tabs when first needed:

| Tab | Stores |
| --- | --- |
| `internal_beta_batches` | Batch dates, open/paused state, invitation hash and access epoch |
| `internal_beta_members` | Stable member ID, batch ID, name, email, phone, GitHub username, access status, private notes, personal-link token hash and signup retry hash |
| `internal_beta_attendance` | Participant-owned daily attendance |
| `internal_beta_recaps` | Participant-owned recap draft/submission and links |

Do not change these tab headers by hand. Earlier beta-member schemas are upgraded by appending missing phone and signup retry-hash columns without replacing records. Phone numbers keep their formatting, plus signs and leading zeroes. Text is encoded as sheet text to prevent formula execution. Public form submissions cannot write to these tabs.

The website has no sample roster or fallback beta records. Signup, attendance and recaps use the same shared Apps Script service as `/internal`; a failed save never becomes a local-only signup. The old local demo server and demo codes have been removed. Automated tests still use isolated, temporary fixture records and never write to the shared sheet.

## Verification

`node --test tests/*.test.mjs` covers the current backend and existing tools. Beta-specific tests exercise shared self-join, duplicate joins, invitation/link hashing and rotation, retry-safe signup, session revocation, unchanged core-team login, batch isolation, attendance ownership and dates, recap privacy and validation, and denial of all main internal APIs to beta identities.

After deployment, separately verify a real shared-link join, passwordless personal-link return, same-batch attendance visibility, recap draft/submission, operator private notes, closed batch access, the regular team's unchanged login, and the existing visits service. Use isolated records for signup tests; production smoke checks can validate an empty batch and its invitation without creating fake interns.
