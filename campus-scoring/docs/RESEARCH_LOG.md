# Research log and outstanding data

Release access date: 2026-09-29. 102 distinct source records. This is a bounded public-data collection, not an assertion that all public information has been exhausted. An unavailable value means no comparable verified observation was collected; it does not mean the campus has none.

## Collection decisions

- Retrieved the pinned official NCES directory, fall-enrollment/age/residency/distance and completions files. Tested 2024 enrollment ZIP variants returned 404, so this release explicitly uses comparable Fall 2023 data; it does not claim that no newer release exists elsewhere. Raw-file hashes and URLs are in data/extracts/manifest.json.
- Used official FSL reports/pages rather than third-party percentages for scoring. Undated pages remain undated. “Over”, approximate and rounded counts retain qualifiers.
- Michigan State: dated Fall 2025 report preferred over inconsistent undated chapter counts. Iowa: selected community-page percentage; a differing admissions figure is disclosed in the observation note. Miami Ohio: retained the published Spring 2026 total even though separately published subtotals do not reconcile.
- Denominators such as “student body” were not silently relabeled as undergraduate. Ole Miss participation is derived only from matching Spring 2024 member and Oxford undergraduate counts. Illinois likewise uses same-report Spring 2026 member and undergraduate counts. No percentage divides different-year membership by NCES enrollment.
- FY2027 GSA file is already published but becomes effective October 1, 2026. It is a forward-planning benchmark, not a September 2026 quote. Only exact institutional ZIP matches with unambiguous rate schedules are accepted.
- Airport observations are a snapshot of an open geographic dataset. Scheduled-service flag does not validate a flight route or trip cost.
- Reviewed content programs, campus-specific university-advertised content roles, and named club subsets supplement the first pass. Advertised opportunities are a weaker proxy, not proof of current staffing or a creator census. Exact coverage is below.
- Two university sources identify undergraduate residents; bed capacity, projected move-ins and mixed graduate/undergraduate occupancy were not substituted. No first-party customer/campaign data or comparable event quotes, staffing rates or permitting lead times were verified.

## Metric coverage

| Metric | Available | Missing |
|---|---:|---:|
| Undergraduate enrollment | 49 | 1 |
| Undergraduates taking non-distance courses | 49 | 1 |
| On-campus resident students | 2 | 48 |
| Undergraduates age 18–24 | 48 | 2 |
| Reported undergraduate women share | 49 | 1 |
| Domestic out-of-state first-time entrants | 41 | 9 |
| Age 18–19 | 48 | 2 |
| Age 20–21 | 49 | 1 |
| Age 22–24 | 48 | 2 |
| Age 25+ | 49 | 1 |
| Age unknown | 6 | 44 |
| In-state first-time entrants | 41 | 9 |
| International/nonresident share | 49 | 1 |
| Hispanic share | 49 | 1 |
| Black share | 49 | 1 |
| Asian share | 49 | 1 |
| Greek-life undergraduate participation | 26 | 24 |
| Recognized FSL organizations | 46 | 4 |
| Greek community membership | 31 | 19 |
| Verified active creators per 1,000 undergraduates | 0 | 50 |
| Documented student content program | 16 | 34 |
| Relevant bachelor awards share | 49 | 1 |
| Relevant bachelor awards | 49 | 1 |
| Verified relevant student organizations | 3 | 47 |
| Active customers per 1,000 undergraduates | 0 | 50 |
| Federal lodging allowance benchmark | 50 | 0 |
| Local activation labor hourly rate | 0 | 50 |
| Verified venue day cost | 0 | 50 |
| Published permitting lead time | 0 | 50 |
| Verified travel cost per trip | 0 | 50 |
| Federal meals/incidental allowance | 50 | 0 |
| Nearest scheduled-service airport distance | 50 | 0 |
| Metropolitan-area membership | 50 | 0 |
| Nearby reference-universe campuses | 50 | 0 |
| Campaign customer acquisition cost | 0 | 50 |
| Campaign conversion rate | 0 | 50 |
| Campaign contribution ROI | 0 | 50 |
| Qualified engagement rate | 0 | 50 |
| Samples distributed | 0 | 50 |
| Qualified leads | 0 | 50 |
| Attributed revenue | 0 | 50 |
| Ambassador-attributed conversions | 0 | 50 |
| Verified event attendance | 0 | 50 |

## Campus-specific Greek/content evidence gaps

Universal gaps above apply to every campus; the following table exposes the remaining campus-specific qualitative-research gaps. See observations.csv for missing reasons, years, qualifiers and provenance.

| Campus | Missing Greek measures | Content program | Relevant club audit |
|---|---|---|---|
| Auburn University | All three observed | Uncollected | Uncollected |
| Baylor University | Greek community membership | Observed; not density | Uncollected |
| Clemson University | All three observed | Observed; not density | Uncollected |
| Florida Agricultural and Mechanical University | Greek-life undergraduate participation, Greek community membership | Uncollected | Uncollected |
| Florida State University | All three observed | Observed; not density | Audited subset only |
| Howard University | Greek-life undergraduate participation, Greek community membership | Uncollected | Uncollected |
| Indiana University-Bloomington | All three observed | Observed; not density | Uncollected |
| James Madison University | Greek-life undergraduate participation | Uncollected | Uncollected |
| Miami University-Oxford | Recognized FSL organizations | Observed; not density | Uncollected |
| Michigan State University | All three observed | Observed; not density | Uncollected |
| Morgan State University | Greek-life undergraduate participation, Greek community membership | Uncollected | Uncollected |
| North Carolina A & T State University | Greek-life undergraduate participation, Greek community membership | Uncollected | Uncollected |
| Ohio State University-Main Campus | Greek-life undergraduate participation, Greek community membership | Observed; not density | Uncollected |
| Ohio University-Main Campus | Greek-life undergraduate participation, Greek community membership | Uncollected | Uncollected |
| Pennsylvania State University-Main Campus | All three observed | Observed; not density | Uncollected |
| Sacred Heart University | Greek-life undergraduate participation | Uncollected | Audited subset only |
| San Diego State University | Greek-life undergraduate participation | Uncollected | Uncollected |
| Syracuse University | Greek-life undergraduate participation, Greek community membership | Uncollected | Uncollected |
| Temple University | Greek-life undergraduate participation | Uncollected | Uncollected |
| Texas Christian University | All three observed | Uncollected | Uncollected |
| Texas State University | Greek-life undergraduate participation, Greek community membership | Uncollected | Uncollected |
| Texas Tech University | Greek-life undergraduate participation | Uncollected | Uncollected |
| The University of Alabama | Recognized FSL organizations, Greek community membership | Observed; not density | Uncollected |
| The University of Tampa | Greek-life undergraduate participation | Uncollected | Uncollected |
| The University of Tennessee-Knoxville | Greek community membership | Uncollected | Uncollected |
| The University of Texas at Austin | All three observed | Observed; not density | Uncollected |
| Tulane University of Louisiana | Greek community membership | Uncollected | Uncollected |
| University at Albany | Greek-life undergraduate participation, Greek community membership | Uncollected | Uncollected |
| University of Arizona | Greek-life undergraduate participation | Uncollected | Uncollected |
| University of California-Santa Barbara | All three observed | Uncollected | Uncollected |
| University of Colorado Boulder | Greek-life undergraduate participation, Greek community membership | Observed; not density | Uncollected |
| University of Dayton | Greek-life undergraduate participation | Uncollected | Uncollected |
| University of Delaware | Recognized FSL organizations, Greek community membership | Uncollected | Uncollected |
| University of Florida | All three observed | Observed; not density | Uncollected |
| University of Georgia | Greek-life undergraduate participation | Observed; not density | Uncollected |
| University of Illinois Urbana-Champaign | All three observed | Uncollected | Uncollected |
| University of Iowa | All three observed | Uncollected | Uncollected |
| University of Kansas | All three observed | Uncollected | Uncollected |
| University of Miami | Greek-life undergraduate participation | Uncollected | Uncollected |
| University of Michigan-Ann Arbor | All three observed | Observed; not density | Audited subset only |
| University of Mississippi | All three observed | Uncollected | Uncollected |
| University of Oklahoma-Norman Campus | All three observed | Uncollected | Uncollected |
| University of Pennsylvania | Greek-life undergraduate participation, Greek community membership | Uncollected | Uncollected |
| University of South Carolina-Columbia | All three observed | Observed; not density | Uncollected |
| University of Southern California | Greek-life undergraduate participation | Observed; not density | Uncollected |
| University of Virginia-Main Campus | Greek community membership | Uncollected | Uncollected |
| University of Wisconsin-Madison | All three observed | Uncollected | Uncollected |
| Vanderbilt University | Greek community membership | Uncollected | Uncollected |
| Washington State University | Greek-life undergraduate participation | Uncollected | Uncollected |
| West Virginia University | Greek-life undergraduate participation, Recognized FSL organizations, Greek community membership | Uncollected | Uncollected |
