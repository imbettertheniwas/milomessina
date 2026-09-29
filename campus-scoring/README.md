# Campus Scoring Model · CAMPUS OS

A standalone, dependency-light subproject for comparing U.S. campuses, configuring client priorities, and generating an auditable 20-campus launch shortlist.

**Release status: provisional public-data model.** It contains 50 real universities, sourced observations, nine scoring categories, four editable profiles, an interactive dashboard, ranked exports, and a separate geographically constrained launch cohort. Missing information is stored as `null`, never estimated. This is an interpretable decision model, not a trained prediction of activation ROI.

## Live dashboard

Production URL: https://milomessina.com/campus

The repository uses its existing Vercel deployment. `npm run build` also generates `../campus/index.html` with an explicit asset base, so both `/campus` and `/campus/` load the same source dashboard and data. Commit the generated entry point together with `campus-scoring/`. No runtime data collection, API keys, or root build changes are required.

## Start

Requires Node.js 20+ and Python 3.10+. No npm dependencies or API keys are needed to use the committed snapshot.

```bash
cd campus-scoring
npm run build
npm test
npm start
```

Open `http://localhost:8080`. Use the profile selector and category sliders; select a campus to inspect raw values, category scores, source dates, qualifiers and links. The advanced configuration editor supports individual metric weights and demographic targets. Changes in the browser are temporary until exported; they do not silently overwrite the dataset.

## Deliverables

| Output | Location |
|---|---|
| Campus database with per-metric provenance | `data/campuses.json` |
| One-row-per-campus database and ranking | `outputs/default-ranked.csv` |
| All 50 ranked campuses, with category scores | `outputs/default-ranked.json` |
| First 20 recommended campuses and rollout reasons | `outputs/default-launch20.csv` / `.json` |
| Readable launch report and profile sensitivity | `outputs/REPORT.md` |
| Every raw observation and source URL | `outputs/observations.csv` |
| Source registry | `outputs/sources.json` |
| Beverage, beauty and fintech scenarios | `outputs/{profile}-ranked.*` and `{profile}-launch20.*` |
| Rank sensitivity across all four profiles | `outputs/sensitivity.csv` |
| Metric calculations, anchors, weights, definitions | `config/metrics.json`, `docs/METRICS.md` |
| Candidate universe, including exclusions | `data/candidates.json`, `docs/UNIVERSE.md` |

Individual rank and rollout order are deliberately separate. Observed scores omit unavailable weights; the rollout selector uses the **evidence-supported score floor**, geographic caps and explicit bonuses. Compare completeness and the unresolved score range whenever comparing schools.

## What is verified, and what is missing

- Enrollment, demographic and distance-education measures: **Fall 2023 IPEDS**. They are real historical observations, not claimed to be 2026 enrollment. Tested 2024 enrollment download endpoints returned 404; the pinned 2023 files were the successfully retrieved comparable release. They should be updated before major campaign commitments.
- Degree-award measures: **2023–24 IPEDS completions**; directory/location data: **2024 IPEDS**.
- Greek-life figures: primary university pages and reports, with each observation's own period, denominator and rounding/bound qualifiers. Recognition definitions vary; professional and cultural organizations are explicitly flagged where included.
- Economics: **FY2027 GSA allowances**, published in advance and effective **October 1, 2026–September 30, 2027**, used as a forward-planning lodging benchmark. They are not current hotel quotes, venue prices or a complete activation budget.
- Geography: public airport coordinates and scheduled-service flags; straight-line distances are not travel times or airline schedules.
- Creator ecosystem: documented student content programs and campus-specific content opportunities; **no audited campus creator-density census**. Most creator observations remain unavailable.
- **No supplied client customer or campaign data.** All corresponding production fields remain blank. No historical CAC, conversion, revenue or ROI has been invented.
- Verified undergraduate-resident observations are available for two campuses. Most resident counts and comparable venue, labor, permit and transport measures remain unavailable.
- WSU's multi-campus enrollment, demographic and program values are retained as unscored institutional reference values, not attributed to Pullman.

These limits mean the current output supports a transparent research shortlist. It does **not** yet substantiate a claim that every campus has been evaluated on the client's actual customers, creator access, complete economics or previous campaign performance.

## Add another university

```bash
python3 scripts/add_school.py --unitid 193900 --reason "Client-requested expansion campus"
python3 -m pip install -r requirements-ingest.txt
python3 scripts/ingest_public.py
npm run build
```

The example UNITID is New York University; the command verifies the ID against the official directory before adding it. New schools receive the same public-data transformations and fixed normalization anchors. Uncollected Greek/creator/cost fields remain null. Existing schools are not removed, their anchors are not recalibrated, and the fixed geography reference set is not silently expanded.

Append reviewed institution-specific observations to `data/manual-evidence.json`. Each observation requires a metric ID, UNITID, numeric value, source IDs, qualifier, data year (nullable if unspecified), and a note explaining scope/calculation. Every source requires its actual URL, publisher and access date. Validate campus boundaries and recognition status before treating a school as launch-ready.

For a deliberate universe refresh, edit the reviewed candidate selection and version `data/geography-reference.json`. Retain old outputs and explain the selection change; do not confuse a discovery-ranking change with a campus's opportunity change.

## Refresh public sources

```bash
python3 -m pip install -r requirements-ingest.txt
python3 scripts/ingest_public.py --refresh
npm run build
npm test
```

This refreshes the **pinned releases**, records download SHA-256 hashes, and recreates compact institutional extracts. It does not silently move to new survey years or promote source-imputed values into observed facts. Upgrade survey-year filenames and transformations together in a reviewed version when adopting a newer release; check the official dictionary and rerun scope/denominator checks. Original full downloads are reproducible and gitignored under `data/raw/`; the small source extracts and manifest are committed.

## Client data and custom scenarios

Copy the header-only `data/client-template.csv` into `private/` and populate it from measured, aggregated first-party outcomes. There are no example customers or fabricated campaigns. Each campus row must identify its client campaign, window and attribution rule; do not mix incompatible campaigns into one row. Deduplicate customers before aggregating. Keep client files out of this public repository.

```bash
python3 scripts/import_client.py private/client.csv --client YOUR_CLIENT_ID
node scripts/build.mjs --client-data private/client-data.json
```

Client results go to gitignored `private/outputs/`. Public outputs are not overwritten. CAC with zero acquired customers is undefined and remains null. Importing a client does not make unobserved campuses' customer counts zero.

Download a configuration from the dashboard to reproduce its weights and targets:

```bash
node scripts/build.mjs --config path/to/campus-client-configuration.json
# Combine with --client-data to keep a customer-informed scenario private.
```

## Design and validation

`src/model.mjs` is the shared scoring and rollout engine used by the browser and CLI. Tests cover normalization, missing versus zero, bounds, weight scaling, stable scores when schools are added, source requirements, geographic distances, deterministic selection, hard caps, infeasible cohorts, and CSV export safety. Data processing excludes nonreported/suppressed/imputed IPEDS cells rather than guessing.

See [methodology](docs/METHODOLOGY.md), [metric dictionary](docs/METRICS.md), [creator protocol](docs/CREATORS.md), [universe audit](docs/UNIVERSE.md), and [research gaps](docs/RESEARCH_LOG.md).
