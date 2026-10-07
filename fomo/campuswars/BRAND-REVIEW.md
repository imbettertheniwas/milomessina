# Greek Village — FOMO brand review

Reviewed against [FOMO Brand Guidelines](https://www.figma.com/design/hxsVfyYNYuVDKInFKHlBzq/fomo-Brand-Guidelines?node-id=6117-2) on October 7, 2026.

## Source rules

- Primary blue `#516AF6`, secondary blue `#4A36FF`, navy `#221D4B`, white `#EAEDFF`.
- Aeonik Regular for body text, Medium for subheads, Bold for headings and calls to action.
- Preserve original symbol and wordmark proportions and use the approved color pairings. Do not recolor the pupil cutouts independently, distort the artwork, or lose contrast against its background.
- Partnership lockups separate fomo and the partner mark with a divider and space.

## Applied

The school picker, loading screen, navigation, controls, chapter drawer, dialogs, toast, and starter panel now share the brand palette. Primary actions use secondary blue with pale white text for contrast. Existing school and chapter colors remain school identities; landscape, architectural finishes, metal and other physical materials remain natural.

Outlined wordmark paths come from the existing original `landingpage/assets/fomo-wordmark.svg`; the symbol keeps the original paths already used by the village. Canvas wordmarks now use those paths instead of typed approximations. Vehicles, the campus banner, jet, helicopter, stadium, entrance banner, chapter badge, leaderboard, rank badges, population sign, claim lot and trophy branding were reviewed and adjusted. The blimp uses a separated fomo / Discord lockup. The leaderboard reverse no longer adds glow or an outline to the mark. Aeonik canvas signs redraw after fonts load where needed.

`village-brand.js` owns the canvas palette and outlined wordmark. The CSS palette is declared in `styles.css`. `tests/brand-gallery.html` provides a visual review of the main generated textures. Versioned module imports and preloads were updated together.

## Verification

- Release checkout on latest main: all 75 focused checks passed.

- Initial focused scene tests: 33 passed.
- Full village suite: 300 passed; one preload-graph check identified the missing new brand-module preload.
- After adding that preload, all 20 targeted module-loading, helipad, stadium and leaderboard checks passed.
- Final vehicle, blimp, entrance and module-loading verification: all 40 checks passed after correcting texture proportions.
- Browser review: desktop school picker, campus arrival and chapter drawer; 390px phone picker, school selection and chapter drawer (no horizontal overflow or browser errors); rendered brand texture gallery.
- Release prepared from the latest main branch with only the brand-review changes. Existing unrelated working-tree edits and newer Greek-letter corrections were preserved.
