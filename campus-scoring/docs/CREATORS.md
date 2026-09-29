# Creator measurement protocol

## Current release

No campus has a completed, comparable student-creator census. `verified_creators_per_1000` is null for every school. Documented student content programs and campus-specific university-advertised content roles are infrastructure proxies only. Advertised opportunities receive an additional quality discount; they do not prove that a role was filled, remains open, or establishes a current creator roster. Observation notes preserve dates and scope. A university social account's followers are not attributed to enrolled student creators. A general ambassador job advertisement open nationally is not evidence of campus creator presence. Unfound programs are missing, not zero.

## Repeatable census

Use the same process, eligibility rules, platforms, lookback window and search effort at every campus. Version these rules with the dataset:

1. Fix an observation date and the preceding 90-day content window. Include public TikTok, Instagram and YouTube accounts only where collection is permitted.
2. Confirm current student affiliation from a self-published public bio plus a recent campus/student reference, or an official current university creator-program roster. Record the evidence URLs and observation dates; do not infer student status from physical appearance or a campus hashtag alone.
3. Treat a creator as a distinct person, deduplicated across platforms using explicit public cross-links or confirmed identity. An account held by a club, university or Greek chapter is an organization, not an individual student creator.
4. Require at least three original public posts in the 90-day window. Record publicly observable follower counts, post dates, views and engagements separately where the platform exposes them. Do not estimate hidden impressions or use a hashtag's cumulative views as enrolled-student reach.
5. Keep a candidate log with inclusion/exclusion reasons, platform access limits, query terms, queried directories, evidence timestamps, and deduplication decisions. Do not imply an exhaustive census from a handful of searchable profiles.
6. Calculate `1,000 * eligible_unique_students / verified_same-scope_undergraduates`. Label it an **observed lower-bound density** unless the roster and coverage are demonstrably exhaustive. Report searched platforms and unavailable metrics alongside it.
7. When reliable identity/activity evidence cannot be obtained, preserve null. When a known complete roster contains no qualifying active creators, zero can be reported with the complete-roster evidence; unsuccessful searches do not justify zero.

The thresholds above are prospective model policy, not claims about the current campuses. Obtain client consent and appropriate permissions before collecting or importing nonpublic creator analytics; this model does not require private profiles or demographic inference.

## Suggested observation record

Use a header-only collection table rather than fabricated sample people:

`campus_unitid, creator_key, public_profile_url, platform, affiliation_evidence_url, affiliation_observed_at, activity_window_start, activity_window_end, original_posts_in_window, public_followers, observed_views, observed_engagements, deduplication_evidence, inclusion_status, exclusion_reason`

Keep individual-level outreach data private. Publish aggregate campus measurements with sufficient source/method coverage notes. Program presence should remain a separate metric even after a census is available; it measures recruitment infrastructure, not the size of the creator market.
