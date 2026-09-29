# Methodology · version 1.0

## Intended use

Prioritize campus research and activation planning under a stated client brief. This release is a transparent heuristic built from observed public data. It has not been calibrated or validated against campaign outcomes. All policy choices—weights, normalization anchors, quality multipliers and rollout bonuses—are explicit model parameters, not measured campus facts.

## Discovery universe

The union of Niche's top 50 party/social schools and The Princeton Review's 25 “Lots of Greek Life” schools produces 68 distinct institutions in the retrieved 2027-edition lists. These are two independent student-review publishers, not two rewrites of one list. Match by NCES UNITID. Require at least 5,000 Fall 2023 undergraduates, producing 53 eligible institutions. Select the largest 50 by that verified count; deterministic tie-break by UNITID. The 18 other candidates and their exclusion reasons remain in the audit.

University fraternity/sorority offices supply independent primary evidence for subsequent scoring. Discovery ranks carry **zero opportunity-score weight**. Absence from either discovery list is not evidence of a weak campus and never blocks later additions. This initial sample is not a census of U.S. universities or a claim that these are the nation's objectively best 50 party schools. Large-campus and publisher-review selection biases are explicit.

## Observation schema and provenance

Each campus is identified by UNITID and institutional/campus scope. Each metric stores `value`, `status`, `source_ids`, `data_year`, `qualifier` and `note`. A missing value is JSON null or a blank CSV cell. Missing reason, scope mismatch, and reported-but-unscored institutional reference are separate concepts.

Source records retain the actual URL, publisher, date accessed, data year (where specified), source type and explanatory notes. Downloaded federal/geographic releases also have SHA-256 checksums and file sizes. University prose is paraphrased into brief extraction notes; copyrighted pages are not republished wholesale. `outputs/observations.csv` expands source references to URLs, publishers and access dates for each raw observation.

Directory identity and coordinates use HD2024. Enrollment/sex uses EF2023A, EFALEVEL=2. Age uses EF2023B, LSTUDY=2 (note: this code differs from the enrollment survey). Residence uses EF2023C and refers only to first-time degree/certificate-seeking entrants. Distance education uses EF2023A_DIST, EFDELEV=2. Completions use C2024_A, AWLEVEL=5, MAJORNUM=1. The code strips trailing whitespace from NCES field names before processing.

IPEDS flags R (reported), C (analyst corrected), G (generated from other data), and Z (explicit implied zero) are accepted. A/B/D/H/J/K/L/N/P/S and other nonusable/suppressed/imputed flags are excluded. Z is a source-supplied zero, not a gap filled by the model. G is deterministic source derivation, not modeled imputation; the flag remains in committed extracts. Counts are never inferred from suppressed cells. A missing constituent makes its derived ratio/sum unavailable.

Fall 2024 enrollment endpoints tested during collection returned 404. The model therefore pins the successfully retrieved Fall 2023 comparable tables and labels their age. It does not claim newer enrollment data do not exist, nor substitute an unrelated 12-month headcount for fall enrollment. Updating the release requires a reviewed dictionary/scope comparison, not merely relabeling the year.

## Category weights

All weights are editable; they need not sum to 100 because the engine normalizes their total.

| Category | Default | Beverage | Beauty | Fintech | Default rationale |
|---|---:|---:|---:|---:|---|
| Enrollment | 20 | 20 | 10 | 25 | Scale of student opportunity, tempered by logarithmic size anchors |
| Demographic fit | 10 | 10 | 20 | 10 | Broad 18–24 audience assumption until a client brief supplies targets |
| Greek ecosystem | 25 | 35 | 10 | 5 | Priority social distribution network for the initial universe |
| Creator ecosystem | 15 | 10 | 30 | 10 | Important channel, with substantial uncertainty left visible |
| Relevant programs/clubs | 10 | 5 | 10 | 20 | Observable ambassador/marketing talent infrastructure |
| Existing customers | 5 | 5 | 5 | 15 | Client footprint can guide launch priority; no client data supplied |
| Activation economics | 5 | 5 | 5 | 3 | Limits expensive opportunities while actual budgets are unavailable |
| Geography | 5 | 3 | 3 | 5 | Accessibility and travel clustering, plus separate portfolio constraints |
| Historical performance | 5 | 7 | 7 | 7 | Reserve room for comparable client outcomes rather than fictional results |

These profiles are illustrative strategic priorities, not claims about all beverage, beauty or fintech customers. In particular, the beauty profile does not assume a gender target. Gender/sex and residency target metrics have zero default within-category weight; clients must explicitly set both their target and weight. Race/ethnicity and international characteristics are descriptive and disabled by default. Age bins do not establish legal-age eligibility for individual participants; no age-specific conversion is inferred from them.

## Normalization and aggregation

All anchors are fixed, versioned policy parameters, not percentiles recalculated against each cohort. This lets a new university receive the same score without moving every previous university's score.

- Linear: `100 * clamp((x - min)/(max - min), 0, 1)`.
- Inverse linear for costs/distances: `100 - linear_score`.
- Logarithmic: `100 * clamp((ln(1+x)-ln(1+min))/(ln(1+max)-ln(1+min)), 0, 1)`.
- Target match: `100 * max(0, 1 - abs(x-target)/tolerance)`.

Negative weights, nonfinite values, invalid anchors and all-zero category weights are rejected. Every available metric receives its normalization even when its current weight is zero; unweighted descriptive fields do not affect the result. See METRICS.md for every metric, anchor, weight, calculation and refresh cadence.

Let category weight be `Wc`; let within-category metric weight be `wm`. Its global requested weight is `gm = Wc * wm / sum(w in that category)`. A missing metric retains its requested weight in coverage, but contributes neither a zero nor a fabricated value to the observed-score numerator.

**Category score:** weighted mean of available metrics in that category. Category completeness is available within-category weight divided by all requested within-category weight. A category with no observations has a null score, never 50 or 0.

**Campus Opportunity Score (observed):** `sum(gm * normalized_m, observed) / sum(gm, observed)`. This is normalized to 0–100. Overall ranking sorts by this score, then completeness, then UNITID. Rankings are provisional; a campus with missing metrics can rise in observed ranking because its unknown weaknesses are not measured.

**Weighted completeness:** `100 * sum(gm, observed) / sum(gm, all)`. **All-field data completeness** separately counts available defined fields divided by all defined fields, including descriptive and currently disabled fields. Never confuse those two percentages.

**Evidence-supported floor:** `sum(gm * normalized_m, observed) / sum(gm, all)`.

**Unresolved upper bound:** `(sum(gm * normalized_m, observed) + 100 * sum(gm, missing)) / sum(gm, all)`.

The floor is the worst-case normalized-score bound over currently unknown components, not an imputed raw observation. Neither bound is a statistical confidence interval. Where a reported input itself is approximate or a lower bound, the score is conditional on that qualified observation; the range does not additionally model its measurement error. Ranking intervals may overlap substantially.

## Confidence rubric

Quality is a documented analyst rubric, not a probability of correctness or an empirical confidence interval:

1. Source base: federal primary 0.98; university primary or supplied client data 0.95; open geographic data 0.80.
2. Freshness multiplier: `max(0.4, 1 - 0.1 * years_since_data_year)`. Use the greatest four-digit year explicitly present in the observation/source year string. An unspecified data year gets 0.75; accessing an undated page today does not make its numbers current. Future-published FY2027 policy rates get age zero but remain labeled not-yet-effective.
3. Source-reported rounding, approximations, lower bounds, or audited subsets: multiply by 0.85.
4. Federal lodging benchmark used as a commercial-cost proxy: multiply by 0.75. Geographic proxy: 0.90. Relevant-award talent proxy: 0.85. Student content-program presence as a creator proxy: 0.60. Campus-specific advertised content opportunities receive a further 0.75 multiplier because advertisements do not establish current staffing.
5. Explicitly broader Greek ecosystem definitions receive an additional 0.80 comparability multiplier.

For derived observations with multiple sources, use the lowest source quality. Campus `confidence_score` is the weighted average quality over observed scoring inputs; `evidence_confidence_score` includes the missing-weight denominator. Quality is displayed alongside, not silently folded into, the opportunity score. Do not interpret high observed-data quality as high completeness.

## Important proxies and scope decisions

- Total enrollment and non-distance enrollment share one fixed enrollment category; they are correlated size signals, not independent market populations. Neither equals resident occupancy. On-campus residents remain null without verified occupancy data.
- First-time residency is explicitly labeled; no all-undergraduate out-of-state share is inferred. International and unknown residency are not assigned to domestic out-of-state.
- Greek participation is preferred to chapter counts. Published full-time undergraduate denominators are retained and disclosed. Membership is not divided by unrelated-year NCES enrollment. Chapter rosters may include professional, cultural or music organizations; these are marked as broader ecosystem measures rather than homogeneous social-fraternity counts. Unrecognized organizations are not assumed available for activation.
- Program composition uses actual awards, not estimated current major enrollment. Only first-major, six-digit CIP records count, avoiding first/second-major and CIP rollup double counting. Selected prefixes are 52.*, 09.*, 10.*, 50.04*, 50.06*, 19.09*, and 31.0504. Business includes marketing, entrepreneurship and hospitality. A missing relevant award row is not assumed zero. Student-club counts are audited subsets with named organizations; directory presence does not prove active membership.
- Creator-program presence establishes documented student content infrastructure. It cannot estimate influencer count, reach, brand willingness or engagement. See CREATORS.md.
- GSA ZIP matching is exact. Ambiguous or unmatched ZIPs remain missing; there is no guessed fallback county. Lodging uses an equal-month average of 12 published FY2027 rates. It is not day-weighted, not a trip quote, and excludes taxes, game-day premiums and negotiated prices. Monthly published rates remain in the database. Labor, venue, permitting and transport fields are independent of this proxy.
- Airport distance is haversine distance to a US medium/large airport flagged as having scheduled service. It does not prove a convenient flight from a client's origin. Metropolitan membership comes from IPEDS CBSATYPE, not a fabricated metro size. Geographic clustering counts schools within 200 km of a fixed reference universe, not driving distance or duplicated customers.
- WSU's IPEDS report covers multiple campuses. Its institution-level population/demographics/awards are retained as reference but excluded from the Pullman activation score until campus-specific data are verified. Other institutional boundaries and online populations still warrant review before launch.

## Recommended launch cohort

The 20 highest observed scores are exported, but are not automatically the recommended cohort. The repeatable selector:

1. Requires at least 45% weighted evidence coverage and at least four observed categories.
2. Uses each campus's evidence-supported score floor as its base selection priority.
3. Adds 4 priority points for a region not yet represented and 2 for a school within 200 km great-circle of an already selected campus.
4. Enforces no more than six schools per NCES region and two per metropolitan CBSA. Nonmetro schools are not all treated as one shared metro.
5. Selects the highest remaining marginal priority, breaking ties by individual rank then UNITID; repeats up to 20 times.

These caps/bonuses are editable strategy choices. Each chosen school retains its individual rank, observed score, evidence floor, marginal bonuses, selected nearby partners and rollout explanation. This is a deterministic greedy portfolio heuristic, not a proof of global optimality or an efficient driving itinerary. It can select fewer than 20 if constraints are infeasible; constraints are never silently relaxed. It does not quantify customer overlap, dates, staffing, weather, airport-origin fares, venue availability, or a total campaign budget. Client-specific strategic regions can be implemented as a reviewed policy extension, rather than pretending the default policy already reflects a supplied expansion plan.

## First-party outcomes

The header-only import template accepts already deduplicated, attributable campus-level aggregates. One client and one declared comparable window per campus per scenario. Blank input cells remain blank; zero is accepted only when explicitly supplied. The importer requires campaign IDs, window dates and an attribution definition. It records the source filename/hash and calculation inputs in private observations.

CAC = spend / incremental customers; conversion = incremental customers / eligible leads; contribution ROI = (attributed contribution margin - spend) / spend; engagement = qualified engagements / impressions. Rates are undefined with zero/missing denominators. A source must substantiate that customers are incremental; the importer cannot validate causal attribution on its own. Aggregate comparable campaigns by summing numerators/denominators, never by averaging rates without weights. Samples, leads, revenue, attendance and ambassador conversions are stored separately and have zero default scoring weight. Client outcomes and exports stay gitignored under private/.

## Maintenance and limitations

Refresh enrollment, demographic, awards and identity extracts annually when official comparable releases are adopted; Greek data and clubs each semester; airport and creator observations quarterly; customer counts monthly; costs and campaign outcomes for each campaign window. Date-specific vendor quotes expire with their quoted travel/event dates. Official pages can change after access; committed numeric extracts and notes are the audit snapshot.

Before asserting a client-ready launch plan, supply the client's actual audience, customer data, attributable outcomes, launch dates/budget and origin, and perform the creator/venue/permit work. Validate the model retrospectively against held-out campaign results, then adjust weights with documented out-of-sample evaluation and avoid leakage. No accuracy, CAC improvement or campaign ROI is claimed by this release.
