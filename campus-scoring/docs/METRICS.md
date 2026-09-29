# Metric dictionary

Generated from the committed configuration and observations. All anchors and weights are editable policy choices. Zero-weight fields remain descriptive until enabled. Missing observations are null, excluded from observed means, and retained in completeness and unresolved-score bounds.

For every metric below, `outputs/observations.csv` records the raw value, normalization, effective default weight, confidence, period, qualifier, URL, publisher and access date for every campus. Quality uses the rubric in METHODOLOGY.md. A stated prospective source is a collection plan, not a claim that data were collected.

## enrollment

Default category weight: **20**. Non-distance students receive the most weight because campaigns need a physically addressable audience; total size provides scale, while verified residents would measure a concentrated audience.

### `undergraduates` — Undergraduate enrollment

IPEDS fall undergraduate full- and part-time headcount; reporting institution boundary.

- Unit: students. Normalization: log, anchors 5000 to 50000.
- Within-category weight: 0.3; effective default weight: 6 of 100.
- Calculation/scope: EFALEVEL=2; EFTOTLT. Full-time plus part-time undergraduates.
- Coverage: 49/50. Update: annual.
- Sources: [EF2023A](https://nces.ed.gov/ipeds/datacenter/data/ef2023a.zip)

### `non_distance_undergraduates` — Undergraduates taking non-distance courses

Undergraduate headcount less exclusively distance-education students; physical-addressability proxy, not residents.

- Unit: students. Normalization: log, anchors 5000 to 50000.
- Within-category weight: 0.5; effective default weight: 10 of 100.
- Calculation/scope: EFDELEV=2; EFDETOT minus EFDEEXC. At least some non-distance courses; not residence-hall occupancy.
- Coverage: 49/50. Update: annual.
- Sources: [EF2023A_DIST](https://nces.ed.gov/ipeds/datacenter/data/ef2023a_dist.zip)

### `on_campus_residents` — On-campus resident students

Verified undergraduate residents in university-owned/operated housing; capacity is not occupancy.

- Unit: students. Normalization: log, anchors 1000 to 15000.
- Within-category weight: 0.2; effective default weight: 4 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 2/50. Update: annual.
- Sources: [review-2ce9eda415b1](https://www.housing.wisc.edu/future-residents/); [review-9d5969dca67f](https://newkensington.psu.edu/content/parent-and-family-guide-2024)

## demographics

Default category weight: **10**. The default brief is a broad 18–24 audience. Other demographic fields are descriptive; clients must explicitly enable their own target and weight.

### `age_18_24_pct` — Undergraduates age 18–24

Sum of 18–19, 20–21 and 22–24 undergraduate age bins divided by all-age undergraduate count.

- Unit: percent. Normalization: linear, anchors 0 to 100.
- Within-category weight: 1; effective default weight: 10 of 100.
- Calculation/scope: Sum EFBAGE 4,5,6 / EFBAGE 1; LSTUDY=2. Unknown ages remain in denominator.
- Coverage: 48/50. Update: annual.
- Sources: [EF2023B](https://nces.ed.gov/ipeds/datacenter/data/ef2023b.zip)

### `women_pct` — Reported undergraduate women share

IPEDS reported women / undergraduate total. Disabled by default; client supplies an appropriate target. Not gender identity.

- Unit: percent. Normalization: target=50, tolerance=50.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: 100 * EFTOTLW / EFTOTLT. IPEDS reported sex classification; not gender identity.
- Coverage: 49/50. Update: annual.
- Sources: [EF2023A](https://nces.ed.gov/ipeds/datacenter/data/ef2023a.zip)

### `out_of_state_freshmen_pct` — Domestic out-of-state first-time entrants

US first-time entrants minus in-state entrants / all first-time entrants. Not all-undergraduate mix.

- Unit: percent. Normalization: target=50, tolerance=50.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: (US-resident first-time entrants minus in-state entrants) / all entrants; international and unknown are not silently counted as out-of-state.
- Coverage: 41/50. Update: annual.
- Sources: [EF2023C](https://nces.ed.gov/ipeds/datacenter/data/ef2023c.zip)

### `age_18_19_pct` — Age 18–19

Descriptive IPEDS undergraduate percentage (residency fields refer only to first-time entrants). Disabled by default.

- Unit: percent. Normalization: linear, anchors 0 to 100.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: LSTUDY=2; EFBAGE=4; EFAGE09 / all-age EFAGE09.
- Coverage: 48/50. Update: annual.
- Sources: [EF2023B](https://nces.ed.gov/ipeds/datacenter/data/ef2023b.zip)

### `age_20_21_pct` — Age 20–21

Descriptive IPEDS undergraduate percentage (residency fields refer only to first-time entrants). Disabled by default.

- Unit: percent. Normalization: linear, anchors 0 to 100.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: LSTUDY=2; EFBAGE=5; EFAGE09 / all-age EFAGE09.
- Coverage: 49/50. Update: annual.
- Sources: [EF2023B](https://nces.ed.gov/ipeds/datacenter/data/ef2023b.zip)

### `age_22_24_pct` — Age 22–24

Descriptive IPEDS undergraduate percentage (residency fields refer only to first-time entrants). Disabled by default.

- Unit: percent. Normalization: linear, anchors 0 to 100.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: LSTUDY=2; EFBAGE=6; EFAGE09 / all-age EFAGE09.
- Coverage: 48/50. Update: annual.
- Sources: [EF2023B](https://nces.ed.gov/ipeds/datacenter/data/ef2023b.zip)

### `age_25_plus_pct` — Age 25+

Descriptive IPEDS undergraduate percentage (residency fields refer only to first-time entrants). Disabled by default.

- Unit: percent. Normalization: linear, anchors 0 to 100.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: LSTUDY=2; EFBAGE=7; EFAGE09 / all-age EFAGE09.
- Coverage: 49/50. Update: annual.
- Sources: [EF2023B](https://nces.ed.gov/ipeds/datacenter/data/ef2023b.zip)

### `age_unknown_pct` — Age unknown

Descriptive IPEDS undergraduate percentage (residency fields refer only to first-time entrants). Disabled by default.

- Unit: percent. Normalization: linear, anchors 0 to 100.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: LSTUDY=2; EFBAGE=14; EFAGE09 / all-age EFAGE09.
- Coverage: 6/50. Update: annual.
- Sources: [EF2023B](https://nces.ed.gov/ipeds/datacenter/data/ef2023b.zip)

### `in_state_freshmen_pct` — In-state first-time entrants

Descriptive IPEDS undergraduate percentage (residency fields refer only to first-time entrants). Disabled by default.

- Unit: percent. Normalization: linear, anchors 0 to 100.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: In-state first-time degree-seeking entrants / all first-time entrants. NOT all-undergraduate residency.
- Coverage: 41/50. Update: annual.
- Sources: [EF2023C](https://nces.ed.gov/ipeds/datacenter/data/ef2023c.zip)

### `international_pct` — International/nonresident share

Descriptive IPEDS undergraduate percentage (residency fields refer only to first-time entrants). Disabled by default.

- Unit: percent. Normalization: linear, anchors 0 to 100.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: 100 * EFNRALT / EFTOTLT. Descriptive only by default.
- Coverage: 49/50. Update: annual.
- Sources: [EF2023A](https://nces.ed.gov/ipeds/datacenter/data/ef2023a.zip)

### `hispanic_pct` — Hispanic share

Descriptive IPEDS undergraduate percentage (residency fields refer only to first-time entrants). Disabled by default.

- Unit: percent. Normalization: linear, anchors 0 to 100.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: 100 * EFHISPT / EFTOTLT. Descriptive only by default.
- Coverage: 49/50. Update: annual.
- Sources: [EF2023A](https://nces.ed.gov/ipeds/datacenter/data/ef2023a.zip)

### `black_pct` — Black share

Descriptive IPEDS undergraduate percentage (residency fields refer only to first-time entrants). Disabled by default.

- Unit: percent. Normalization: linear, anchors 0 to 100.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: 100 * EFBKAAT / EFTOTLT. Descriptive only by default.
- Coverage: 49/50. Update: annual.
- Sources: [EF2023A](https://nces.ed.gov/ipeds/datacenter/data/ef2023a.zip)

### `asian_pct` — Asian share

Descriptive IPEDS undergraduate percentage (residency fields refer only to first-time entrants). Disabled by default.

- Unit: percent. Normalization: linear, anchors 0 to 100.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: 100 * EFASIAT / EFTOTLT. Descriptive only by default.
- Coverage: 49/50. Update: annual.
- Sources: [EF2023A](https://nces.ed.gov/ipeds/datacenter/data/ef2023a.zip)

## greek

Default category weight: **25**. Participation share receives 60% of category weight; chapter breadth 30%; absolute member scale 10%. These are related measures of the same ecosystem, not additive student populations.

### `greek_pct` — Greek-life undergraduate participation

University-published undergraduate participation, or same-period members/undergraduates from one report. Full-time-only denominators are labeled.

- Unit: percent. Normalization: linear, anchors 0 to 60.
- Within-category weight: 0.6; effective default weight: 15 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 26/50. Update: semester.
- Sources: [primary-1](https://ofsl.sl.ua.edu/); [primary-11](https://studentlife.utexas.edu/sfl/our-community.php); [primary-14](https://miamioh.edu/life-at-miami/student-involvement/fraternity-sorority-life/about/facts-and-stats/); [primary-17](https://seal.sa.ucsb.edu/fraternity-sorority-life); [primary-18](https://greeks.wp2.olemiss.edu/wp-content/uploads/sites/42/2024/06/UM-Fraternity-Sorority-Academic-Report-Spring-2024.pdf); [primary-19](https://fsl.umich.edu/article/community-statistics); [primary-2](https://studentaffairs.fsu.edu/article/leadership-training-supports-greek-organization-success); [primary-20](https://fsl.uiowa.edu/community); [primary-23](https://studentaffairs.virginia.edu/subsite/fsl/about/frequently-asked-questions); [primary-30](https://www.vanderbilt.edu/student-affairs/greek-life/annual-awards-and-reports/); [primary-32](https://studentaffairs.auburn.edu/greek/articles/2026/07/2025-26-greek-community-report-released.php); [primary-6](https://greek.tulane.edu/our-community); [review-0d27ccdb7052](https://grin.sc.edu/uofsc/posts/2026/08/rushtok-hashtag-uofsc-sorority-recruitment-greek-life-usc-most-potential-new-members.php); [review-1362efcb49ab](https://www.ou.edu/content/dam/studentlife/fsps/fsps-assets/fsps-site-documents/experience-guides/2026%20Fraternity%20and%20Sorority%20Experience%20Guide.pdf); [review-15c7129ae87a](https://studentaffairs.psu.edu/sites/default/files/2024_PSU_FSLProgramReviewReport.pdf); [review-3e2094c88bfa](https://kusfl.ku.edu/about); [review-4c6e7f4aa1eb](https://greeks.tcu.edu/wp-content/uploads/2026/08/Averages-and-Comparison-Spring-2026.pdf); [review-5d67a1998a9f](https://greeks.ufl.edu/wp-content/uploads/2026/05/26-27-Guide-to-Florida-Greeks.pdf); [review-655080560e8d](https://www.udel.edu/students/involvement/fsll/policies/becoming-a-recognized-fraternity-or-sorority/); [review-7c18273636fc](https://fsl.msu.edu/about/Fall%202025%20FSL%20Semester%20Report.pdf); [review-aa8f25dd62b7](https://family.iu.edu/involvement-belonging/sororities-fraternities/joining/how-to-join.html); [review-ab00ca7f94e8](https://media.clemson.edu/studentaffairs/website-documents/division/about/annual-reports/impact-report-2024-25.pdf); [review-b0b0274e893b](https://magazine.web.baylor.edu/news/story/2025/lasting-impact); [review-bea28af363a6](https://studentlife.utk.edu/gogreek/community-statistics/); [review-c3d591e293a1](https://parent.wisc.edu/parents-and-family-resources/student-involvement-and-community/); [review-c9005e714267](https://fsaffairs.illinois.edu/programs/grade-reports/2026/spring-PHC)

### `greek_chapters` — Recognized FSL organizations

Office-published recognized FSL ecosystem count. Scope may include professional/cultural groups; bounds and broader definitions are labeled.

- Unit: organizations. Normalization: linear, anchors 0 to 80.
- Within-category weight: 0.3; effective default weight: 7.5 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 46/50. Update: semester.
- Sources: [primary-10](https://studentlife.utexas.edu/sfl/find-a-chapter.php); [primary-13](https://www.ohio.edu/student-affairs/assessment/reports/annual); [primary-15](https://doso.studentaffairs.miami.edu/greek-life/councils-chapters/index.html); [primary-16](https://www.colorado.edu/greeks/); [primary-19](https://fsl.umich.edu/article/community-statistics); [primary-2](https://studentaffairs.fsu.edu/article/leadership-training-supports-greek-organization-success); [primary-20](https://fsl.uiowa.edu/community); [primary-21](https://www.sc.edu/about/offices_and_divisions/fraternity_and_sorority_life/); [primary-22](https://studentaffairs.virginia.edu/subsite/fsl/recruitment-intake/prospective-members-parents); [primary-24](https://studentaffairsassessment.ku.edu/sites/studentaffairsassessment/files/images/Student%20Affairs%202023-2024%20Annual%20Impact%20Report-compressed_1.pdf); [primary-25](https://studentaffairs.temple.edu/student-leadership-engagement/fraternity-sorority-life); [primary-26](https://www.jmu.edu/osl/fsl/potential-members/how-to-join.shtml); [primary-27](https://www.albany.edu/student-engagement-belonging/student-activities/fraternity-and-sorority-life); [primary-29](https://fsl.dos.txst.edu/); [primary-3](https://greeklife.uga.edu/our-story/); [primary-31](https://www.vanderbilt.edu/student-affairs/greek-life/); [primary-34](https://greeks.tcu.edu/); [primary-35](https://fsl.web.baylor.edu/meet-community); [primary-36](https://www.sacredheart.edu/sacred-heart-life/student-events--activities/fraternity--sorority-life/); [primary-38](https://www.famu.edu/students/student-activities/greek-life/councils-and-chapters.php); [primary-39](https://studentaffairs.howard.edu/activities/fsl); [primary-40](https://ofsl.universitylife.upenn.edu/chapters/); [primary-41](https://experience.syracuse.edu/student-engagement/greek-life/councils-and-chapters/); [primary-47](https://fsl.usc.edu/); [primary-48](https://greek.arizona.edu/organizations); [primary-5](https://fsl.wisc.edu/); [primary-6](https://greek.tulane.edu/our-community); [primary-8](https://activities.osu.edu/involvement/get-involved-guide/gig-sfl/); [primary-9](https://fsaffairs.illinois.edu/information/snapshot); [review-091eac730a78](https://studentaffairs.psu.edu/sites/default/files/2024_PSU_FSLProgramReviewReport.pdf); [review-0ea048cba0b7](https://udayton.edu/life/involvement/greek/index.php); [review-13117f3df44e](https://www.ut.edu/campus-life/fraternity-and-sorority-life/recruitment-intake); [review-1362efcb49ab](https://www.ou.edu/content/dam/studentlife/fsps/fsps-assets/fsps-site-documents/experience-guides/2026%20Fraternity%20and%20Sorority%20Experience%20Guide.pdf); [review-20a248ae9cfa](https://sacd.sdsu.edu/student-life-leadership/fraternity-and-sorority-life); [review-49262ac94d14](https://www.morgan.edu/osld/greeklife); [review-583f7763205d](https://olemiss.edu/greeks/); [review-5d67a1998a9f](https://greeks.ufl.edu/wp-content/uploads/2026/05/26-27-Guide-to-Florida-Greeks.pdf); [review-6a31436b2e06](https://www.ncat.edu/campus-life/student-affairs/departments/student-activities/greek-life/chapter-status.php); [review-77bd028b4565](https://pullman.wsu.edu/community-life/); [review-7b5f573fe495](https://seal.sa.ucsb.edu/fraternity-sorority-life); [review-7c18273636fc](https://fsl.msu.edu/about/Fall%202025%20FSL%20Semester%20Report.pdf); [review-aa8f25dd62b7](https://family.iu.edu/involvement-belonging/sororities-fraternities/joining/how-to-join.html); [review-ab00ca7f94e8](https://media.clemson.edu/studentaffairs/website-documents/division/about/annual-reports/impact-report-2024-25.pdf); [review-bea28af363a6](https://studentlife.utk.edu/gogreek/community-statistics/); [review-d73ea7f3241b](https://www.depts.ttu.edu/fsl/); [review-e649b2ecd67a](https://studentaffairs.auburn.edu/greek/)

### `greek_members` — Greek community membership

Reported membership; never divide by a different-year enrollment to invent participation.

- Unit: students. Normalization: log, anchors 0 to 12000.
- Within-category weight: 0.1; effective default weight: 2.5 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 31/50. Update: semester.
- Sources: [primary-11](https://studentlife.utexas.edu/sfl/our-community.php); [primary-14](https://miamioh.edu/life-at-miami/student-involvement/fraternity-sorority-life/about/facts-and-stats/); [primary-15](https://doso.studentaffairs.miami.edu/greek-life/councils-chapters/index.html); [primary-17](https://seal.sa.ucsb.edu/fraternity-sorority-life); [primary-18](https://greeks.wp2.olemiss.edu/wp-content/uploads/sites/42/2024/06/UM-Fraternity-Sorority-Academic-Report-Spring-2024.pdf); [primary-19](https://fsl.umich.edu/article/community-statistics); [primary-2](https://studentaffairs.fsu.edu/article/leadership-training-supports-greek-organization-success); [primary-20](https://fsl.uiowa.edu/community); [primary-21](https://www.sc.edu/about/offices_and_divisions/fraternity_and_sorority_life/); [primary-24](https://studentaffairsassessment.ku.edu/sites/studentaffairsassessment/files/images/Student%20Affairs%202023-2024%20Annual%20Impact%20Report-compressed_1.pdf); [primary-25](https://studentaffairs.temple.edu/student-leadership-engagement/fraternity-sorority-life); [primary-32](https://studentaffairs.auburn.edu/greek/articles/2026/07/2025-26-greek-community-report-released.php); [primary-36](https://www.sacredheart.edu/sacred-heart-life/student-events--activities/fraternity--sorority-life/); [primary-4](https://greeklife.uga.edu/wp-content/uploads/sites/9/2025/05/Fall-2024-Greek-Life-Grade-Report.pdf); [primary-46](https://studentlife.indiana.edu/involvement-belonging/sororities-fraternities/index.html); [primary-47](https://fsl.usc.edu/); [primary-5](https://fsl.wisc.edu/); [review-091eac730a78](https://studentaffairs.psu.edu/sites/default/files/2024_PSU_FSLProgramReviewReport.pdf); [review-0ea048cba0b7](https://udayton.edu/life/involvement/greek/index.php); [review-13117f3df44e](https://www.ut.edu/campus-life/fraternity-and-sorority-life/recruitment-intake); [review-1362efcb49ab](https://www.ou.edu/content/dam/studentlife/fsps/fsps-assets/fsps-site-documents/experience-guides/2026%20Fraternity%20and%20Sorority%20Experience%20Guide.pdf); [review-20a248ae9cfa](https://sacd.sdsu.edu/student-life-leadership/fraternity-and-sorority-life); [review-3bf088a0125d](https://greeks.ufl.edu/wp-content/uploads/2026/05/26-27-Guide-to-Florida-Greeks.pdf); [review-4c6e7f4aa1eb](https://greeks.tcu.edu/wp-content/uploads/2026/08/Averages-and-Comparison-Spring-2026.pdf); [review-77bd028b4565](https://pullman.wsu.edu/community-life/); [review-7c18273636fc](https://fsl.msu.edu/about/Fall%202025%20FSL%20Semester%20Report.pdf); [review-ab00ca7f94e8](https://media.clemson.edu/studentaffairs/website-documents/division/about/annual-reports/impact-report-2024-25.pdf); [review-b5d5b8198254](https://greek.arizona.edu/sites/default/files/2026-01/Fall-2025-Chapter-Academic-Membership-Performance-Reports.pdf); [review-c5f95944d825](https://www.jmu.edu/osl/fsl/about/index.shtml); [review-c9005e714267](https://fsaffairs.illinois.edu/programs/grade-reports/2026/spring-PHC); [review-d73ea7f3241b](https://www.depts.ttu.edu/fsl/)

## creators

Default category weight: **15**. An audited creator rate would carry 70%; documented content infrastructure carries 30%. Program presence alone cannot substantiate creator density.

### `verified_creators_per_1000` — Verified active creators per 1,000 undergraduates

Deduplicated public student creator census under docs/CREATORS.md. No audited census yet.

- Unit: creators/1,000. Normalization: linear, anchors 0 to 10.
- Within-category weight: 0.7; effective default weight: 10.5 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 0/50. Update: quarterly.
- Sources: Not collected. Prospective: Audited public creator roster + same-scope undergraduate denominator; CREATORS.md

### `creator_program_present` — Documented student content program

Official evidence of a student content program or campus-specific university-advertised student content role. Advertised opportunities are qualified and discounted; no filled position or current creator roster is implied. A weak recruitment-infrastructure proxy, not creator density. Unknown is not zero.

- Unit: indicator. Normalization: linear, anchors 0 to 1.
- Within-category weight: 0.3; effective default weight: 4.5 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 16/50. Update: semester.
- Sources: [primary-42](https://sl.ua.edu/students/student-life-ambassadors/); [primary-43](https://brand.uga.edu/social-media/social-media-ambassadors/); [primary-44](https://www.colorado.edu/education/student-life/student-ambassadors); [review-34c33924bd78](https://lsa.umich.edu/comm/undergraduates/academic-opportunities/internship-resources.html); [review-3d81986beddb](https://advertising.utexas.edu/news/tower-bridge-communications-university-texas-austin); [review-46225f32a56e](https://annenberg.usc.edu/events/content-creator-academy); [review-462ac2cf66fa](https://cas.ed.sc.edu/about/offices_and_divisions/student_affairs/student-services/student_life/student_media/index.php); [review-699a57f456f7](https://careernetwork.msu.edu/jobs/msu-international-studies-and-programs-student-social-media-and-digital-content-creator/); [review-72f419d12d50](https://sportsandsociety.osu.edu/student-engagement/meet-our-interns); [review-87c1af0c2e15](https://plus.college.indiana.edu/our-team/social-media-internship.html); [review-893c61b65978](https://career.clemson.edu/jobs/clemson-university-campus-recreation-social-media-intern-fall-2026/); [review-8fa950184759](https://studentmedia.artsandsciences.baylor.edu/); [review-9125e4da57a5](https://www.psu.edu/news/administration/story/commagency-students-bring-penn-states-capital-day-life-through-storytelling); [review-c288875cf2bd](https://dialcenter.clas.ufl.edu/2026/02/04/to-learn-lead-and-communicate-with-impact-ambassador-leadership-program/); [review-e1bec07e7cbb](https://miamioh.edu/centers-institutes/division-of-student-life/work-in-student-life/student-employment-opportunities.html); [review-f0927a28ccb4](https://jimmorancollege.fsu.edu/student-engagement/student-organizations)

## programs

Default category weight: **10**. Relevant degree share carries 70%; award volume 20%; audited organizations 10%. Academic awards are a repeatable talent-pipeline proxy, not ambassador availability.

### `relevant_awards_pct` — Relevant bachelor awards share

Relevant first-major bachelor awards / all first-major bachelor awards; selected six-digit CIP codes, not current enrollment.

- Unit: percent. Normalization: linear, anchors 0 to 50.
- Within-category weight: 0.7; effective default weight: 7 of 100.
- Calculation/scope: Relevant first-major bachelor awards / CIP=99 total bachelor awards. No second-major double counting.
- Coverage: 49/50. Update: annual.
- Sources: [C2024_A](https://nces.ed.gov/ipeds/datacenter/data/c2024_a.zip)

### `relevant_awards` — Relevant bachelor awards

First-major bachelor awards in business, communications, media technology, design/fashion, film/photo and sports management; overlapping prefixes deduplicated.

- Unit: awards. Normalization: log, anchors 0 to 5000.
- Within-category weight: 0.2; effective default weight: 2 of 100.
- Calculation/scope: AWLEVEL=5; MAJORNUM=1; unique six-digit CIP records in 52.*,09.*,10.*,50.04*,50.06*,19.09*,31.0504. Awards are not current major enrollment.
- Coverage: 49/50. Update: annual.
- Sources: [C2024_A](https://nces.ed.gov/ipeds/datacenter/data/c2024_a.zip)

### `relevant_clubs` — Verified relevant student organizations

Deduplicated audited directory subset with names in evidence note. Lower bound on relevant organizations; not proof of active members.

- Unit: organizations. Normalization: linear, anchors 0 to 30.
- Within-category weight: 0.1; effective default weight: 1 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 3/50. Update: semester.
- Sources: [primary-45](https://sacredheart.smartcatalogiq.com/en/2024-2025/2024-2025-undergraduate-catalog/university-life/student-clubs-and-organizations/); [review-34c33924bd78](https://lsa.umich.edu/comm/undergraduates/academic-opportunities/internship-resources.html); [review-f0927a28ccb4](https://jimmorancollege.fsu.edu/student-engagement/student-organizations)

## customers

Default category weight: **5**. A same-scope active-customer rate is the only enabled footprint metric. No client data were supplied.

### `customers_per_1000` — Active customers per 1,000 undergraduates

Client-specific, same-window deduplicated active customers / campus undergraduates; school match methodology required.

- Unit: customers/1,000. Normalization: linear, anchors 0 to 100.
- Within-category weight: 1; effective default weight: 5 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 0/50. Update: monthly.
- Sources: Not collected. Prospective: Supplied attributable client aggregate export, imported privately

## cost

Default category weight: **5**. Lodging 40%, labor and venue 20% each, permitting and travel 10% each. Lodging is only an administrative benchmark; remaining costs are uncollected.

### `lodging_proxy_usd` — Federal lodging allowance benchmark

Equal-month average FY2027 GSA lodging allowance for matched campus ZIP. Proxy only; not a hotel quote.

- Unit: USD/night. Normalization: linear inverse, anchors 100 to 300.
- Within-category weight: 0.4; effective default weight: 2 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 50/50. Update: annual.
- Sources: [gsa](https://www.gsa.gov/system/files/FY2027PerDiemZipCode_Validated090126.xlsx)

### `labor_hourly_usd` — Local activation labor hourly rate

Verified local occupation wage or dated vendor quote with occupation and scope specified.

- Unit: USD/hour. Normalization: linear inverse, anchors 15 to 45.
- Within-category weight: 0.2; effective default weight: 1 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 0/50. Update: annual.
- Sources: Not collected. Prospective: Dated local staffing vendor quote; an explicitly labeled BLS occupation proxy can be added separately

### `venue_day_usd` — Verified venue day cost

Comparable dated venue quote for standard activation; event size and inclusions required.

- Unit: USD/day. Normalization: linear inverse, anchors 0 to 5000.
- Within-category weight: 0.2; effective default weight: 1 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 0/50. Update: per campaign.
- Sources: Not collected. Prospective: Dated venue quote or published rental schedule

### `permit_days` — Published permitting lead time

Published campus commercial-activation lead time; not a subjective difficulty rating.

- Unit: days. Normalization: linear inverse, anchors 0 to 60.
- Within-category weight: 0.1; effective default weight: 0.5 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 0/50. Update: per campaign.
- Sources: Not collected. Prospective: Published campus permitting policy for the specified event type

### `travel_quote_usd` — Verified travel cost per trip

Dated quote with origin, campaign dates, traveler count and baggage/ground transport scope.

- Unit: USD/trip. Normalization: linear inverse, anchors 100 to 2000.
- Within-category weight: 0.1; effective default weight: 0.5 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 0/50. Update: per campaign.
- Sources: Not collected. Prospective: Dated origin/destination, dates, mode and party-size quote

### `meals_proxy_usd` — Federal meals/incidental allowance

GSA administrative benchmark, reported separately from verified activation costs.

- Unit: USD/day. Normalization: linear inverse, anchors 50 to 100.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: FY2027 meals/incidental allowance. Not local labor or event budget.
- Coverage: 50/50. Update: annual.
- Sources: [gsa](https://www.gsa.gov/system/files/FY2027PerDiemZipCode_Validated090126.xlsx)

## geography

Default category weight: **5**. Nearest scheduled-service airport distance carries 60%; metro membership and cluster potential 20% each. This is preliminary accessibility, not a travel itinerary.

### `airport_km` — Nearest scheduled-service airport distance

Haversine distance to US medium/large airport with scheduled_service=yes; not road distance, fare or route availability.

- Unit: km. Normalization: linear inverse, anchors 0 to 150.
- Within-category weight: 0.6; effective default weight: 3 of 100.
- Calculation/scope: Haversine great-circle distance to nearest US large/medium airport with scheduled_service=yes. Not drive time, route frequency, or fare.
- Coverage: 50/50. Update: quarterly.
- Sources: [HD2024](https://nces.ed.gov/ipeds/datacenter/data/hd2024.zip); [airports](https://davidmegginson.github.io/ourairports-data/airports.csv)

### `metro_presence` — Metropolitan-area membership

IPEDS CBSATYPE=1. Does not measure metro population or proximity to downtown.

- Unit: indicator. Normalization: linear, anchors 0 to 1.
- Within-category weight: 0.2; effective default weight: 1 of 100.
- Calculation/scope: IPEDS metropolitan CBSA membership; not metro population or downtown distance.
- Coverage: 50/50. Update: annual.
- Sources: [HD2024](https://nces.ed.gov/ipeds/datacenter/data/hd2024.zip)

### `nearby_campuses` — Nearby reference-universe campuses

Other fixed reference campuses within 200 km great-circle; cohort-defined cluster opportunity.

- Unit: campuses. Normalization: linear, anchors 0 to 5.
- Within-category weight: 0.2; effective default weight: 1 of 100.
- Calculation/scope: Count within 200 km great-circle of fixed geography-reference.json; not road routing or shared-customer overlap.
- Coverage: 50/50. Update: annual.
- Sources: [HD2024](https://nces.ed.gov/ipeds/datacenter/data/hd2024.zip)

## performance

Default category weight: **5**. CAC 35%, conversion 25%, contribution ROI 25%, engagement 15%. Output volumes remain descriptive to avoid rewarding spend alone.

### `cac_usd` — Campaign customer acquisition cost

Comparable campaign spend / incremental acquired customers, with attribution window and client ID.

- Unit: USD/customer. Normalization: linear inverse, anchors 0 to 150.
- Within-category weight: 0.35; effective default weight: 1.75 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 0/50. Update: per campaign.
- Sources: Not collected. Prospective: Supplied attributable client aggregate export, imported privately

### `conversion_pct` — Campaign conversion rate

100 * attributed new customers / eligible measured leads; sum numerators and denominators across comparable campaigns.

- Unit: percent. Normalization: linear, anchors 0 to 20.
- Within-category weight: 0.25; effective default weight: 1.25 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 0/50. Update: per campaign.
- Sources: Not collected. Prospective: Supplied attributable client aggregate export, imported privately

### `roi_pct` — Campaign contribution ROI

100 * (attributable contribution margin minus activation spend) / activation spend; not gross revenue ROAS.

- Unit: percent. Normalization: linear, anchors -100 to 200.
- Within-category weight: 0.25; effective default weight: 1.25 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 0/50. Update: per campaign.
- Sources: Not collected. Prospective: Supplied attributable client aggregate export, imported privately

### `engagement_pct` — Qualified engagement rate

100 * qualified engagements / observed impressions, using consistent platform definitions.

- Unit: percent. Normalization: linear, anchors 0 to 15.
- Within-category weight: 0.15; effective default weight: 0.75 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 0/50. Update: per campaign.
- Sources: Not collected. Prospective: Supplied attributable client aggregate export, imported privately

### `samples` — Samples distributed

First-party campaign outcome with client, campaign, dates, attribution and denominator definitions. Stored without automatic scoring.

- Unit: samples. Normalization: linear, anchors 0 to 10000.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 0/50. Update: per campaign.
- Sources: Not collected. Prospective: Supplied attributable client aggregate export, imported privately

### `leads` — Qualified leads

First-party campaign outcome with client, campaign, dates, attribution and denominator definitions. Stored without automatic scoring.

- Unit: leads. Normalization: linear, anchors 0 to 10000.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 0/50. Update: per campaign.
- Sources: Not collected. Prospective: Supplied attributable client aggregate export, imported privately

### `revenue_usd` — Attributed revenue

First-party campaign outcome with client, campaign, dates, attribution and denominator definitions. Stored without automatic scoring.

- Unit: USD. Normalization: linear, anchors 0 to 10000.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 0/50. Update: per campaign.
- Sources: Not collected. Prospective: Supplied attributable client aggregate export, imported privately

### `ambassador_conversions` — Ambassador-attributed conversions

First-party campaign outcome with client, campaign, dates, attribution and denominator definitions. Stored without automatic scoring.

- Unit: customers. Normalization: linear, anchors 0 to 10000.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 0/50. Update: per campaign.
- Sources: Not collected. Prospective: Supplied attributable client aggregate export, imported privately

### `event_attendance` — Verified event attendance

First-party campaign outcome with client, campaign, dates, attribution and denominator definitions. Stored without automatic scoring.

- Unit: people. Normalization: linear, anchors 0 to 10000.
- Within-category weight: 0; effective default weight: 0 of 100.
- Calculation/scope: Per-campus calculation/scope notes in observations.csv; definition below applies to all.
- Coverage: 0/50. Update: per campaign.
- Sources: Not collected. Prospective: Supplied attributable client aggregate export, imported privately

