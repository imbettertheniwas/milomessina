# Release validation

Validated on 2026-09-29:

- `npm run build` reproduces the 50-campus database, all four profile rankings and four 20-campus launch cohorts from the committed extracts.
- `npm test`: 21 passing tests, including missing versus zero, bounds, fixed-anchor invariance, source requirements, geographic constraints, infeasible rollout, client import arithmetic, undefined CAC and public-data isolation.
- Python scripts compile successfully. Observation ledger has 2,150 campus/metric rows (50 × 43); every available numeric observation resolves to a source record.
- DOM interaction smoke checks passed for initial ranking, launch cohort, campus evidence/source links, profile changes, search, invalid all-zero weights, reset and methodology navigation.
- Monochrome dashboard redesign: live desktop browser verified 50 score markers, 50 map markers, 20 highlighted cohort campuses, nine coverage signals, chart-to-detail navigation, expandable evidence, settings drawer, profile recalculation and cohort tabs. Responsive CSS covers phone widths; a separate phone-viewport browser run was unavailable.

These tests validate data structure and deterministic calculations. They do not validate campaign predictive accuracy, causal attribution, creator availability, current campus permitting or actual event economics. Those limits are documented in METHODOLOGY.md and RESEARCH_LOG.md.
