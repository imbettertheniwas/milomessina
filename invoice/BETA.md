# Beta intern batches

This adds a separate two-week workspace at `/internal/beta`. Arya and Milo manage it from **Beta batch** in `/internal`. Beta participants never enter `internal_roster` or the main team's money, schedules, posts, portals, referrals, or visits tools.

## What is included

- Arya or Milo creates a batch with a name and first day. Its end date is the 14th calendar day, inclusive: start date plus 13 days.
- One shared invite link lets anyone holding it join immediately. It walks them through the two-week program, collects name, email, phone number and GitHub username, and lets them review those details before joining. There is no approval queue.
- The guide asks interns to make their internship projects public on GitHub so the group and Arya can follow their work. It explains attendance and the final recap before they join.
- Each person gets a separate random personal access code when joining. They should save it before dismissing the recovery card. That code restores their own account on another browser or after their six-hour session expires.
- All participants have the same beta access: their batch roster, the batch's shared attendance and public GitHub activity, and their own two-week recap. Onboarding, task assignment, and check-in APIs are not included.
- Participants mark or remove only their own attendance. Dates must fall within the batch and cannot be in the future. The server uses the Apps Script project's time zone; set it to `America/New_York` to match the interface.
- A recap includes what the person learned, what they accomplished, and optional work links. Drafts can be saved, edited, submitted, and resubmitted. Both written sections are required to submit. The batch's final date is shown as the due date; late submissions remain possible.
- Arya and Milo see every batch, name, email, phone number, attendance record, recap draft/submission, linked GitHub account, and private evaluation note in `/internal` → **Beta batch**. Email and phone are visible only to the participant and operators; peers see names, GitHub accounts and attendance. Participants see their own recaps. Recap sharing with other beta participants remains a product decision; the current implementation keeps them private to the author and operators.

GitHub activity is public authored commits in owned, non-fork repositories for the batch dates. Private work and work in other owners' repositories are outside this counter. Partial results and request failures are labeled. The linked GitHub username and submitted identity are self-reported; joining does not verify email or GitHub ownership.

## Access setup

The old frontend `PASSCODE` / `CONFIG.INVOICE_KEY` is public page data. It cannot protect the main team's records from beta users. Beta activation therefore requires a new private team sign-in secret stored only in Apps Script properties.

1. Open the **existing Apps Script project** that serves the `/exec` endpoint used in `invoice/index.html` and the FOMO forms.
2. In **Project Settings → Script properties**, add `INTERNAL_LOGIN_SECRET` with a new private random value of at least 16 characters. It must differ from `CONFIG.INVOICE_KEY`. Do not put it in frontend source, a URL, this repository, or a beta invitation.
3. Preserve all existing script properties, including the visits service secret, spreadsheet settings, and any existing integration settings. Preserve the `CONFIG` values already used by the deployed script.
4. Set the project's time zone to `America/New_York`.
5. Share the new private sign-in secret only with the trusted regular team. They continue using the existing name selector on `/internal`; Arya and Milo remain the operators. The selector is a trusted-team identity choice, not individual identity verification.

Setting or changing the private secret expires existing core sessions. Once the first batch is created, the script stores `INTERNAL_PRIVATE_AUTH_REQUIRED=true`. Removing the secret or changing it to a short/public value then fails closed rather than restoring the public fallback login. Do not clear this property to recover access; restore a valid private secret.

Changing `INTERNAL_LOGIN_SECRET` also invalidates existing personal beta codes and shared invitations because their hashes are bound to that secret. After a planned secret change, sign in as an operator, create a new invite for each open batch, and reset personal codes for existing participants. Existing participant records, attendance, notes, and recaps remain intact.

## Deployment procedure — not performed by this build

The website and Apps Script are two separate deployments. Local checks do not publish either one.

1. Keep a copy of the currently deployed Apps Script and its `CONFIG` values.
2. Replace the script code with the **complete** `fomo/setup/apps-script.gs`, restoring the current deployment's `CONFIG` values as needed. This single file includes the existing forms, money, schedules, posts, internal console, referrals, and visits service alongside beta access. Do not paste only the beta section or replace the project with the visits-only script.
3. Save, then use **Deploy → Manage deployments → Edit → Version: New version → Deploy** on the existing web app. Preserve **Execute as: Me** and **Who has access: Anyone**. Updating the existing deployment preserves its `/exec` URL. The public web-app setting permits form and invite requests; sensitive actions are authorized inside the script.
4. Open the deployment's `/exec` URL. The JSON capability response should include `beta: true`, `privateLogin: true`, and the existing service flags such as `visits`, `visitHours`, `ledger`, and `campus`.
5. Publish the matching website changes, including `vercel.json` route/header changes and the beta assets under `invoice/`. If the Apps Script URL changes, update all consumers together rather than changing only the beta page.
6. Sign in to `/internal` with the new private team secret as Arya or Milo. Open **Beta batch**, create a test batch, save its invitation, and join in a separate browser profile before inviting the real cohort.

The shared invite has this shape:

```text
https://milomessina.com/internal/beta#invite=BATCH-<random-token>
```

The token belongs in the URL fragment, not in a query parameter. The plain workspace URL is `https://milomessina.com/internal/beta`; returning participants use their personal `BETA-…` code there. Codes and invite tokens are revealed once and stored only as hashes in the sheet.

## Management and storage

**New invite link** replaces the previous shared link for future joins. Existing participants' personal codes and sessions continue working. The original plain token cannot be recovered from the sheet.

**Reset personal access code** invalidates the participant's previous code and sessions immediately. Save the new code and share it with that person directly.

Pausing or graduating a participant closes their access and preserves their record. Closing a batch pauses every participant's access. Reopening a batch or reactivating a participant requires them to sign in again; old sessions do not resume. Graduation does not add anyone to the main roster.

An email already used in the same batch cannot create or take over an existing account. A returning participant must use their personal code or ask an operator to reset it. The same person may join a different batch as a separate batch member.

The script creates these separate tabs when first needed:

| Tab | Stores |
| --- | --- |
| `internal_beta_batches` | Batch dates, open/paused state, invitation hash and access epoch |
| `internal_beta_members` | Stable member ID, batch ID, name, email, phone, GitHub username, access status, private notes and personal-code hash |
| `internal_beta_attendance` | Participant-owned daily attendance |
| `internal_beta_recaps` | Participant-owned recap draft/submission and links |

Do not change these tab headers by hand. The previous beta-member schema is upgraded by appending the phone column without replacing records. Phone numbers keep their formatting, plus signs and leading zeroes. Text is encoded as sheet text to prevent formula execution. Public form submissions cannot write to these tabs.

The website has no sample roster or fallback beta records. Signup, attendance and recaps use the same shared Apps Script service as `/internal`; a failed save never becomes a local-only signup. The old local demo server and demo codes have been removed. Automated tests still use isolated, temporary fixture records and never write to the shared sheet.

## Verification

`node --test tests/*.test.mjs` covers the current backend and existing tools. Beta-specific tests exercise shared self-join, duplicate joins, invitation/code hashing and rotation, session revocation, private-secret downgrade protection, batch isolation, attendance ownership and dates, recap privacy and validation, and denial of all main internal APIs to beta identities.

After deployment, separately verify a real shared-link join, personal-code return, same-batch attendance visibility, recap draft/submission, operator private notes, closed batch access, a regular team's login, and the existing visits service. No production deployment, real invitation, or live spreadsheet mutation is part of this local build.
