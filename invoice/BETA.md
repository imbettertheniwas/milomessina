# Beta group

Beta is one permanent branch of Internal. Milo and Arya manage every beta intern from **Beta** at `/internal#/beta`. The permanent public signup link is `/internal/beta`; it does not expire and never needs to be recreated. There is no batch picker or batch-creation step.

## Joining and returning

The same link opens a guided introduction, collects name, email, phone number, GitHub username and an optional portfolio website, and lets the intern review their details before joining. The guide explains attendance, public internship projects on GitHub, and the two-week recap. Joining creates the profile immediately without a password or manual access-code entry.

The device remembers the profile and renews its short-lived session automatically. A private personal return link opens that profile on another device. Signing out removes the device’s remembered access. Operators can replace a lost personal link; replacing it closes the previous personal link and sessions. Personal links remain private to their owner, while the permanent signup link is shared with new interns.

Each intern’s join date in New York is **Day 1**. Day 14, thirteen calendar days later, is the end of their initial beta period and their recap due date. These dates come from the original join timestamp and do not move when a profile is edited. Existing members keep their records and original join dates. Attendance accepts past or current dates within the intern’s own period; late recap submissions remain possible.

## What people can see

Beta interns see their group’s names, GitHub accounts, portfolio links and attendance, plus their own contact details and recap. Bare domains open over HTTPS; the Beta workspace home page lists intern names linked to their portfolio sites. They can change their own attendance and write, save and submit their own recap. Both written recap sections—what they learned and what they accomplished—are required to submit; work links are optional.

Milo and Arya see all beta profiles, email addresses, phone numbers, attendance, public GitHub activity, recap drafts/submissions and private evaluation notes. Both can update profiles, portfolio links, notes and access status, replace personal return links, and delete interns. Deletion requires an inline confirmation naming the intern, permanently removes their profile, attendance and recap, and invalidates their existing personal link and sessions. The permanent group invite stays available; deleting an intern does not ban a new signup. Pausing or graduating someone preserves their records and closes their beta access. Reopening access lets a saved personal link obtain a fresh session.

GitHub activity counts public authored commits in owned, non-fork repositories for the dates shown. Private work and other owners’ repositories are outside that counter. Partial results and request failures are labeled. Submitted identity and GitHub usernames are self-reported; the join form does not verify account ownership.

Beta participants stay out of `internal_roster`. Their sessions cannot access the team’s money, schedules, posts, portals, referrals or visits APIs, even if a beta participant enters the name Milo or Arya. The normal team passcode remains unchanged. Milo and Arya have matching full admin controls in the normal Internal dashboard; admin power is granted by the verified core session, not a beta display name.

## Backend and deployment

The website and Apps Script require separate releases. Install the complete `fomo/setup/apps-script.gs`, retaining the existing deployed version for rollback and preserving all live `CONFIG` values and Script Properties. If the project contains duplicated full source files, update their implementations consistently so an older definition cannot override the new one. Update the existing web-app deployment with a new version while keeping its `/exec` URL and existing access settings.

The backend retains the existing `INTERNAL_BETA_SECRET`; changing it would invalidate saved personal links and old invites. The authenticated operator’s first Beta read initializes the one group if needed and pins its ID in `INTERNAL_BETA_GROUP_ID`. Public `betagroup` reads never create groups or write configuration. `betajoin` accepts the stable `beta` invitation alias. Previously issued opaque invitation links continue to resolve to their original groups for compatibility. Additional group creation is refused; old records are not deleted or reassigned.

Legacy batch rows remain internal storage details. They do not impose a shared expiry or deadline on the permanent signup link. Individual periods come from each member’s original join time.

The existing storage tabs are retained:

| Tab | Stores |
| --- | --- |
| `internal_beta_batches` | Existing group identity and legacy invitation metadata |
| `internal_beta_members` | Stable profile ID, group ID, contact details, GitHub, optional portfolio website, access status, private notes, personal-link hash, retry hash and original join timestamp |
| `internal_beta_attendance` | Participant-owned daily attendance |
| `internal_beta_recaps` | Participant-owned recap draft/submission and work links |
| `internal_beta_deletions` | Removed profile ID, consumed join-attempt hash and deletion timestamp; no contact details, notes or recap |

An existing email within the group cannot create or take over another profile. Signup retries require the original random join request and matching details, and safely recover after a lost success response. Definite validation failures let the intern correct their details. Deletion keeps only a consumed join-attempt marker so retrying an old signup cannot recreate the same personal access link. Earlier member schemas append missing phone and retry-hash columns without replacing records; do not change headers manually.

The website contains no sample roster or fallback records. All real signup, attendance and recap data uses the shared Internal service. Tests use isolated records and never submit fake interns to production.

## Verification

Run `node --test tests/*.test.mjs`. Check both Milo and Arya’s full admin controls, ordinary-intern restrictions, beta name collisions, the permanent plain-link join, remembered profile and personal-link return, individual Day 1/Day 14 dates, signup retries, attendance ownership, recap privacy and existing internal/visits functionality. Production checks should verify the real group and link without adding fake profiles.
