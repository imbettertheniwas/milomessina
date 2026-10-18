# FOMO / PULSE

A standalone live campus data sculpture at `https://milomessina.com/eyes`. It uses the existing `/api/campuswars/` aggregate feed; it does not change the admin, write registrations, or include credentials.

Run `CAMPUS_PREVIEW_PORT=4186 node server/campuswars-preview.mjs`, then open `http://127.0.0.1:4186/fomo/pulse/`. The preview proxies the existing production aggregate endpoint. The page and adjacent modules are static and need to be deployed on the same origin as that endpoint. The `/eyes` and `/eyes/` routes serve this page.

## Terminal 002

Uses the original FOMO mark vectors from `village-floor-logo.js` and the existing FOMO wordmark. The default eye sculpture is extruded from the exact mark paths, layered with outlines, scanning guide rings and one particle per member. Focus isolates the selected chapter; Spread changes orbit separation; Drift toggles automatic movement.

A scrolling campus ticker, local pinned watchlist, sortable and searchable chapter table, sector and target filters, and daily/cumulative chart controls connect the scene to exact counts. Chart periods are 7D, 30D and all available registration dates (capped at 730 days). Session movement is net change since the first fresh snapshot in this page session, not a historical 24-hour metric. Pins persist locally; private admin data is never stored. Signal analysis is calculated from source counts, not an LLM or a predictive model.

Thirteen data tests pass. Terminal interactions verified in the browser: pins, focus, query filtering, target-status filtering, sort controls, chart mode/range switching, four scene modes, and 390px/320px layouts. The table intentionally scrolls horizontally on narrow screens.

## Visual grammar

- FOMO eyes: registration particles inhabit the official FOMO silhouette; chapter nuclei orbit the eyes.
- Organism: one nucleus per chapter record; nucleus radius grows with the square root of joined members. One orbiting light per registration (sampled and explicitly relabeled if total exceeds 18,000). Woven core, dust, guide rings and filaments are expressive structure, not measurements.
- Constellation: chapters group by exact school name on a spherical arrangement. Colors are deterministic by school, using a repeating palette. The sphere has no geographic meaning.
- Helix: vertical position and winding follow chapter registration date. Continuous strands are date guides, not additional data.
- Inspector: exact joined and active counts, the integer-ceiling 80% target, remaining count and chapter registration date. Over-roster counts remain intact.
- Histogram: chapter records registered by UTC date, trailing 30 days based on the received snapshot. It is not member signup history. Click a day to filter the directory.

The feed is polled every 30 seconds while visible. Existing upstream caching may add delay. Initial loads do not announce existing members. Positive count deltas trigger a comet, expanding ring, notification and optional user-enabled sound; multiple arrivals queue. This aggregate source does not include identities or exact signup times, and count corrections may appear as arrivals. Decreases are not arrival events. Failed reads retain the displayed data, show its age and retry with backoff. Old snapshots are rejected. No synthetic registrations are added. The preview-animation button is visibly labeled and does not change counts or event history.

Motion can be paused, system reduced-motion preferences are respected, directory controls are keyboard accessible, and details remain available if WebGL fails. School aliases and duplicate chapter records remain distinct because the source does not provide verified deduplication rules.

## Research

Reviewed before implementation:
- Nadieh Bremer on X: https://x.com/NadiehBremer — organic, intricate data-art work and the Searching for Birds announcement: https://x.com/NadiehBremer/status/2021891221451641285
- onformative, MakeOurMark: https://onformative.com/work/makeourmark-who-are-you/ — a collective sculpture built from social contributions.
- Twitter, Topography of Tweets: https://blog.x.com/official/en_us/a/2013/the-topography-of-tweets.html — data as a spatial landscape.

## Validation

`node --test fomo/pulse/tests/model.test.mjs`

Browser checks: all three layouts; live totals; directory search and selection; arrival preview; 390px and 320px no horizontal overflow. Final browser error/warning log was clean after correcting the initial particle shader. Screenshots in `output/pulse/`. No production writes were used in verification.

## Member and goal sounds

Sound on enables a soft two-note member chime (~0.72 seconds) and a louder rising goal celebration (~3.69 seconds). A goal sound replaces the ordinary chime for an observed positive member-count update that crosses the rounded-up 80% target. Initial loads, already-qualified chapters and roster-only edits do not trigger goal celebrations. Muting stops playing/scheduled voices. Both sounds have labeled preview buttons; previews enable audio via the browser click and do not change data. Sound controls are available on mobile.

Validation: 13 model tests pass. `tests/audio.html` renders both sounds with OfflineAudioContext: goal peak 0.087 versus member peak 0.029, with neither clipping. Browser goal preview enabled the audio context successfully with no runtime errors.

## State coverage

The States we’re in section derives coverage from the current chapter snapshot and the existing NCES/official-campus location catalog in `school-states.mjs`. It counts U.S. states with registered chapters, including zero-member chapters; Ontario and unknown locations remain separate. Known school aliases share one school in state totals while distinct chapter records and reported members are retained. Selecting a state filters the chapter market and combines with existing sector, search and progress filters. Unmapped new schools remain explicitly unconfirmed until their locations are verified. No counts are stored in the location catalog.

Run `node --test fomo/pulse/tests/*.test.mjs` for data and state-aggregation checks.

## Members per day

The chart switches between Chapters and Members, with daily additions and cumulative growth for 7D, 30D and ALL. Member totals are grouped by actual UTC join timestamps from the authenticated admin member export, reduced server-side to date/count pairs only. No member names, contact fields, referral identities or raw CSV are exposed. The member export may finish moments after chapter totals, so totals can briefly differ during arrivals. Today is a partial day. Clicking a member day pins its count; clicking a chapter day retains chapter-registration filtering. Missing/invalid exports show unavailable history, never fabricated zero counts, while chapter data continues refreshing.

## When members join

The hourly section uses the same authenticated member export as the daily chart. The server reduces each actual `joined` timestamp to a date and one of 24 hourly counts in `America/New_York`; daylight saving is applied to each timestamp. No member identities or raw timestamps leave the server. The existing daily chart continues using UTC dates.

The section defaults to all available history and offers trailing 7- and 30-calendar-day views, including the partial current Eastern day. It shows the busiest hour, tied peaks when applicable, and four six-hour dayparts. Percentages use only joins in the selected period. Empty periods and unavailable history are distinguished. Counts describe historical volume, not a forecast or campus-local time. The panel refreshes with the existing feed. Older snapshots without hourly aggregates still support the daily chart.

Validation: hourly/period tests cover midnight, both daylight-saving transitions, ties, missing/invalid data and aggregate privacy. Browser checks cover live-export aggregates, all period controls, keyboard hour inspection, light/dark themes, and 390px/320px layouts without page overflow.

## 3D member registrations

The Diagram data buttons above the main sculpture switch between Chapters and Member registrations in all four layouts. Member mode draws the existing aggregate member join history: one nucleus per nonempty UTC signup day and one particle per signup (sampling remains labeled above 18,000). Eyes fills the FOMO mark, Network spreads daily clusters, By month groups signup days by month, and Timeline uses actual member join dates. The school layout remains available in chapter mode. Member history has no school attribution, so member mode labels its groups as months rather than inventing school assignments. Select a daily nucleus for its exact date and count. Chapter focus is disabled in member mode; switching back restores chapter selection. Feed refreshes update history, including member-only changes, and unavailable history has an explicit retry message.

## Time on page

The fixed session timer is inspired by [Sasha Birukoff’s halogen timer](https://x.com/sashabirukoff/status/2109689050043236593), recreated with native HTML/CSS in the page’s pearl/violet and dark/violet palettes. It starts from the current document’s navigation clock, resets on reload, includes background-tab time, and catches up when the page becomes visible. No session data is stored or sent. It shows minutes/seconds, adding hours when needed. The decorative dot animation respects reduced motion and the page’s Pause motion control; elapsed time keeps counting. The timer has no live announcements, so it does not interrupt screen readers every second.

## Schools with no chapter

`/eyes#coverage` compares the 5,994 institutions in the site's NCES IPEDS HD2024 directory with the same validated, refreshing chapter snapshot used by the rest of Eyes. Any chapter record counts as presence, including zero-member records. Canonical names and unambiguous directory aliases match NCES IDs. Existing feed aliases (including the two Indiana University names) are consolidated; branch-campus institutions remain separate. Known Canadian schools are outside this U.S. directory. New unmatched or ambiguous feed names are visibly reported, never silently assigned.

The section includes all 5,994 directory institutions as its comparison universe, searchable missing-school lists, state/region and institution-level filters, a filtered text download, the 50-state/DC map, and eight additional region maps. Initial feed failures show no counts; subsequent failures retain the dated snapshot and indicate its age after two minutes. Directory load failures have a retry action. Unknown coverage means no matching chapter record, not no FOMO members or no outreach.

`data/school-coverage.json` is static geographic reference data, not a saved chapter snapshot. Rows follow its `fields` schema: NCES ID, institution name, city, state, IPEDS ICLEVEL, projected x/y, map ID. The NCES HD2024 latitude/longitude columns were projected with D3 7.9.0: `geoAlbersUsa` for the 760×470 U.S. map and `geoMercator` for 360×180 region insets. Boundaries are the existing us-atlas state topology and world-atlas 2.0.2 countries-50m (Natural Earth). Coordinates and boundary paths are precomputed so the browser does not download or execute additional mapping libraries. Institution operating status remains a 2024 snapshot. This directory includes territories and freely associated states; it is not a worldwide university census.

Data sources: https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip, https://github.com/topojson/us-atlas, https://github.com/topojson/world-atlas. Zero-member presence, aliases, ambiguous names, branch identity, filters, unavailable data, and all projected locations are covered by `tests/coverage.test.mjs`.

### Greek-life dot colors

Green, slightly larger dots mark institutions with Greek-life evidence; purple dots mean **not yet verified**, never “no Greek life.” Legend counts follow the current filters. School details, list rows, and downloaded results include the status; selected schools link to the supporting directory. Both color themes use distinct green/purple values, and text conveys the same information without depending on color.

The `greekLife` reference in `data/school-coverage.json` was checked on 2026-10-18 against the official NPC college-only locator at https://thesororitylife.com/panhellenic-map/ (650 collegiate entries; alumnae entries excluded) and the active SigEp chapter directory at https://sigep.org/chapters/ (188 entries). Campus names and locations were reconciled to NCES IDs; former names and campus variants were manually reviewed. Evidence is retained as source identifiers and listed institution names for 622 unique directory schools. Out-of-country, ambiguous, misspelled-location, and unmapped branch entries remain unassigned. Multiple councils at one institution are consolidated. These directories are not exhaustive, do not establish university recognition, and may lag campus changes. No student or officer contact details are stored. Refresh this reference and its checked date when rechecking sources; it is separate from the live FOMO coverage feed.
