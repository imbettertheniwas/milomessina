# fomo Campus Wars

Static landing page for `https://milomessina.com/fomo/campuswars/`, using the existing GitHub/Vercel deployment. Three.js 0.180.0 is pinned in `vendor/` with its MIT license. The page has no new dependencies or build step. `/api/campuswars` is a Vercel Node function that reads the authenticated registration source on the server.

## Graphics and performance refinement

Rendering now keeps its initial device pixel ratio (up to 2× on desktop and mobile) instead of permanently reducing resolution after slow frames. Cached sun shadows use soft PCF filtering at their existing resolutions. Party mode has slightly stronger indirect and fill lighting so street-level people and architecture remain readable, with no extra lights or rendering passes. All models, textures, populations, activities, and controls are retained.

Campus crowds outside the camera frustum skip pose calculations and instance-buffer uploads. Conservative bounds match their existing rendering bounds, including routes and props. Newly visible crowds refresh to the current absolute animation time before rendering, including camera movement while activity is paused. Paused poses are cached; fully hidden views perform no rendering. Shared trigonometry and reusable vectors also reduce repeated calculations and temporary allocations in chapter crowds, campus people, and cyclists.

An interleaved local Node benchmark of the opening camera measured campus activity updates at **3.56 ms before / 2.78 ms after (22% less CPU time)**: median of five 90-frame samples after warmup, with the preceding source as the baseline. All nine campus chunks and 424 campus people remain; seven chunks / 358 people need animation in this view. This isolates CPU animation work, excludes GPU rendering, and is not a device FPS claim. All 111 tests pass, including exact visible-pose equivalence, paused-camera catch-up, translated culling bounds, fixed resolution under slow frames, and hidden-view suspension. Desktop daylight, night lighting, and street controls were visually checked in the local preview, including a 390 × 844 phone viewport, without rendering errors.

## Automatic chapter updates

`site.js` starts `chapter-feed.js` immediately and checks `/api/campuswars` every 30 seconds while the tab is visible. Returning to a hidden tab triggers an immediate refresh. Changes update roster cards, the selected detail panel, share text, houses, construction, banners, exact member crowds, rankings and the claim lot without reloading or resetting the camera. Unchanged chapter payloads do not rebuild the scene. Party mode and activity pause survive updates. A failed request retains the current data and shows a reconnecting status; the next refresh retries.

The function reads `https://www.aryatoufanian.com/admin/` with HTTP Basic authentication. `server/campuswars-source.mjs` recognizes the chapter table by its headers and returns an explicit allowlist of chapter identities, school, registration date and aggregate counts. It never returns registrant names, emails, phone numbers, nominations, member records or invite links. The admin progress denominator is the **80% target**; the adapter reads the separately labeled **actives** value for the full roster. Malformed or incomplete tables fail closed. Warm function instances coalesce concurrent reads and cache successful totals for at most 30 seconds. The client also imposes a timeout and validates snapshots.

Existing chapter IDs and share links remain valid. New chapters use stable source UUIDs, so the same fraternity at different universities gets separate houses. Physical lot order follows onboarding-percentage standings, using the same member-count and chapter-ID tie breakers as the leaderboard; source reorderings do not change addresses. A chapter that rises in the standings moves toward the first lots with its banners, members and rank badge, while its architectural style stays tied to identity. Exactly one empty claim lot follows the registered chapters.

`chapters.json` and the embedded HTML remain the original five-chapter fallback (117 joined / 369 active). They are labeled saved registrations until the first successful refresh. The authenticated source was read successfully during implementation and had six chapters / 118 joined, including Phi Delta Theta at Florida International University (1 / 55). This observation is not a hardcoded live total.

### Hosting activation

1. In the Vercel project serving `milomessina.com`, set the server environment variable `CAMPUSWARS_ADMIN_PASSWORD` to the admin password supplied by the owner. Set it for Production and any Preview environment that needs live data. `CAMPUSWARS_ADMIN_USERNAME` is optional and defaults to `village`.
2. Deploy this repository from its root, including `api/campuswars.mjs` and `server/campuswars-source.mjs`. No package install is required. The function duration is configured in `vercel.json`.
3. Verify `/api/campuswars` responds with `live: true`, `updatedAt` and chapter aggregates, then verify the village shows “Live onboarding.” Without the server secret, the endpoint returns 503 and the page explicitly shows saved data.

Environment values take effect on a new deployment ([Vercel documentation](https://vercel.com/docs/environment-variables)). Never put the password in a client script, static JSON, URL, or committed environment file. No cron task or running Codex session is needed: each visitor's page polls the hosted function, which reads current registrations automatically.

Registration links continue to `https://www.aryatoufanian.com/fomo/onboard/`. Joining happens on that site. Qualification remains `ceil(active * 0.8)`, and the page's existing prize rules are unchanged.

## Village and controls

Zoom-out controls and mouse/trackpad scrolling now allow a camera radius of 320 (previously 160), with the far clipping plane extended to 650. School banners hang on both side walls of completed houses and on construction scaffolds, using local official school logos, names and colors. The marks keep their proportions as houses grow and remain selectable. School identity follows the registration's university, including FIU and common aliases; new schools automatically look up matching university logo/wordmark files through the public Wikipedia API and derive a banner color from the mark. Lookup requests are shared between both banners and subsequent live updates. Missing, ambiguous or temporarily unavailable artwork retains a distinct name banner; failed lookups can retry on later updates. Sources and design notes are in [school-banner-references.md](school-banner-references.md), with a visual review in [tests/school-banner-gallery.html](tests/school-banner-gallery.html).

The first six physical lot slots are preserved, with the highest-ranked chapters assigned first. `createLots()` adds alternating houses every 19 units along a street, always followed by one claim lot. A street carries ten chapter houses down each side, twenty in all — the row at its present length; the twenty-first chapter opens the next street rather than lengthening it further. Streets stand on the campus road grid 100 units apart, opening east then west of the original boulevard, and the block each one occupies becomes a Greek block instead of an academic one. The claim lot always closes the main street: it trails the last house on the boulevard and waits one row past a full one, so it never moves onto a side street and the first street can hold twenty-one plots. `rowExtension()` extends every street together in 19-unit sections, to a maximum of 152 units, so the world stops growing once a street is full. The existing single opaque floor inserts straight street sections; its end junction, leaderboard, bonfire and northern campus move outward. Traffic loops lengthen with the row, and crowd rendering bounds include the added lots. Removed village scenes release their owned rendering resources while retaining the terrain and shared banner hardware. Houses use Georgian/classical architecture with brick, columns, porticoes, balconies, shutters, roofs and porches. Chapters with fewer than 15 joined members have foundations, exposed timber, scaffolding and staged materials; a completed house appears at 15. Completed house width, height and depth follow the displayed onboarding rank: #1 is largest, #2 is next, and each subsequent rank is smaller. Ties receive equal dimensions. Live rank changes resize houses and reposition porch members automatically; dimensions stay within their lots. The 15-member construction threshold still controls when a completed house appears.

Construction sites now derive a persistent architectural plan from chapter identity: longhouse, twin-wing, courtyard, townhouse or pavilion foundations, with distinct dimensions, bay spacing, timber, masonry, internal framing, scaffold placement and supply yards. The plan stays recognizable as the count changes. Zero-member sites also have one of five identity-seeded preparation setups: compact excavator, material gantry, pipe yard, site office or concrete formwork. Scaffold heights, footprints, accent colors and survey strings vary independently, without adding workers. Permanent framing and masonry increase with the actual registration count, and the completed house appears only at 15.

Every member of an under-15 chapter becomes exactly one construction worker. A zero-member site has no crew. Each worker has a hard hat, a tool, an individual supply lane and an offset work cycle: pick up material, turn, carry it to the structure, install it, drill/hammer/saw/lay masonry, then return for another load. Supplies travel from the hands to the work station, and feet stay planted while working. Seven independent lanes on each face keep up to 14 workers clear of walls and each other. Workers replace that chapter’s conversational people; no decorative builders inflate its count. Five shared equipment instance batches keep the scene below the existing 150-mesh test budget. Animation uses the existing village clock, so pause, reduced motion and hidden views behave consistently. Live onboarding rebuilds the crew and disposes replaced tools.

`tests/construction-gallery.html` previews chapter designs, crew counts and work cycles with explicitly labeled preview data. Automated checks cover plan uniqueness, exact counts from 0–15, continuous routes, worker spacing, tool and material motion, deterministic poses and disposal at completion.

House-mounted cloth banners now have five distinct compositions using the real fraternity palettes: blue/gold Sigma Chi, scarlet/emerald Kappa Sigma, blue/silver Phi Delta Theta, cardinal/hunter-green Phi Kappa Psi, and cherry/gray TKE. Each shows Greek letters, chapter name and the real member count. Original artwork and source references are documented in [banner-references.md](banner-references.md); [tests/banner-gallery.html](tests/banner-gallery.html) provides a flat visual review. Their 2048-pixel textures use Aeonik, woven detail, stitching and modeled eyelets. Counter-scaling preserves lettering proportions as houses grow. The original `fomo /campus` lockup now hangs across the main domed library at (0, −120), on a 29-unit-wide façade banner. It uses a 3072-pixel texture and sits in front of the columns, suspended below the cornice. The previous ground logo is removed.

On page load, `village-intro.js` supplies a 13.6-second flight through the actual village: a high dive toward the boulevard, a low street-level flyby, a climbing banked orbit above the houses, a rooftop sweep, and a return to the original composition. A quintic Hermite route carries shared velocity and acceleration through each waypoint, removing the former stop-and-start motion. The low shot stays in the street corridor and the orbit clears the rooftops. The tour is 15% shorter, with a smoother 48–72 degree lens and restrained banking. A brief daylight-to-party-lighting transition illuminates the houses during the orbit and returns to daylight before the ending; leaving the intro restores the user's selected party mode. There is no added animation loop or postprocessing pass.

The village remains unobstructed: no fact cards, chapter timeline, large copy panel or full-screen tint. Four short bottom captions explain the chapter trading competition, house growth and invitation; captions disappear between beats. Only small Pause and Skip controls persist, with a text join link on the final invitation. About retains the longer explanation and full rules. The shared visible-time clock pauses offscreen and in hidden tabs. Pause freezes the camera, lens, lighting and scenery while keeping the current caption readable. Reduced motion uses a stationary camera, default lens, static text and no lighting transition. Skip or direct camera interaction clears the intro; About can replay it.

The third title now reads “$500 ONCE ONBOARDED.” `village-money-rain.js` raises soft cloud banks and rains fluttering banknotes over completed chapter houses from 6.205–10.2 seconds, synchronized with the title reveal. Bill counts decrease with the same onboarding rank shown on each roof; ties receive equal counts. Chapters with fewer than 15 joined members and the claim lot receive none. Each bill stays above its eligible house footprint and disappears before entering its roof. The effect uses two instance batches and shared geometry. `village-money-art.js` supplies a soft, irregular cloud-density texture and a 768px banknote texture with engraved linework, a portrait medallion, denominations and warm paper grain. Camera-facing cloud puffs use feathered edges and layered shading. The subdivided paper has a gentle curl and animated flex; matte lighting, slow flutter and lateral drift replace the earlier bright, rapidly spinning rectangles. The effect runs with no shadow pass or extra animation loop. Live chapter updates rebuild recipients and release replaced instance buffers. Pause freezes the effect, skip/interaction clears it, replay resets it, and reduced motion suppresses it. Automated checks cover exclusion, ties, density order, bounds, timing, deterministic pause, replay, live updates and disposal; the cloud-and-cash reward beat was visually checked in the browser.

Before playback, `village-prewarm.js` compiles both day and party lighting and renders the money effects behind the loading cover. A one-pixel scissor limits fill work while geometry, textures and shadow variants reach the GPU. The intro clock starts after preparation completes. Live roster changes arriving during compilation are queued and warmed before playback, so their old materials are not disposed mid-compile. This removes first-use shader compilation from the night transition without changing the tour or its effects.

After the intro, the existing slow orbit resumes at 0.06 rad/s until the first camera/house interaction. Reset returns to the original composition. Drag or arrow keys orbit, Shift-drag pans, and zoom/fullscreen controls remain. Selecting a house opens its chapter drawer and updates the `#chapter=...` share link. Live data refreshes update the selected chapter without opening a closed drawer.

The empty lot has a single purple floor reading `YOUR HOUSE / CLICK TO START` across its full 15×18 surface. A hollow, flared light shaft uses a vertical alpha gradient, additive blending and BackSide rendering at 0.115–0.165 opacity. Two expanding ground rings share a 2.6-second heartbeat, four survey stakes mark the corners, and a floating “CLAIM THIS LOT” board faces the street. Both the board and floor open registration. Clicking any part of that floor follows the existing chapter registration link. The chapter roster and signup links remain usable if WebGL fails. Native sharing falls back to clipboard and then a selectable URL.

`village-competition.js` ranks all registered houses by onboarding percentage using the latest available data. Equal percentages share competition ranks; the empty lot is excluded. Floating roof badges show each rank, with gold styling, a warm spotlight and a faint light shaft on the leading house. A freestanding leaderboard sits beside the three-way intersection at `(17.5, 0, 41.8)`, facing the houses. The Leaderboard button moves the camera to its front, fitting the board to the viewport. The board shows the top five of the current chapter count; all chapters have rank badges and roster cards. It explicitly labels onboarding progress, not trading results.

## A fuller, lived-in campus

`village-districts.js` streams nine blocks around the camera. Libraries, academic halls, unions, shops, residences, a recreation center, café, fountain and courts create distinct destinations. This is a representative campus combining chapters from multiple universities, not a geographic map of an actual campus.

The density pass adds:

- Foreground picnic areas, planted edges, hedgerows, low walls, bollards, parked bicycle racks, trash/recycling pairs, newspaper boxes, sandwich signs, cabinets, hydrants and banner poles.
- 76 static parked cars in the opening nine-block neighborhood, with parking pockets painted into the existing floor and checked against building footprints. Moving traffic remains eight vehicles and twelve cyclists.
- Gutters, downspouts, window boxes, address plaques, wall lights, chimneys, vents, roof hatches and dishes. Existing modern buildings retain rooftop HVAC units and canopies. The streets carry no overhead lines or utility poles.
- A permanent, non-streamed distant ring of dormitory silhouettes and tree mass, plus a water tower, bell tower and stadium lighting. Fog density is 0.0022 so the horizon remains legible as depth.
- 424 ambient people in the opening neighborhood, concentrated at plazas, café queues, picnic areas and entrances. Academic blocks have 64 each and Greek Row has 99; quieter surrounding streets have 31–35. These are scenery counts, never registration statistics.
- Doorway arrivals/departures with an indoor pause, a dog walker and leashed dog, skateboarders, a frisbee pair, and a groundskeeper, alongside existing walking, jogging, conversation, study and basketball.

`village-district-layout.js` supplies deterministic hashing and appearance palettes. Instance seeds replace repeating clothing stripes: 24 shirt colors, eight skin tones, eight hair colors, varied hair length, 0.9–1.1 height, jackets, shorts/pants and backpacks. Building tints and lit windows vary by seed. Trees use broad, narrow and conifer silhouettes with varied scale, rotation and trunk lean.

`village-layout.js` still creates exactly one person per joined chapter member. The 104 conversational members occupy wider conversation groups of varied sizes, including pairs and a larger cluster, scattered over the lawn and porch. Placement scores prioritize body clearance. Six existing members play beer pong at three tables, and five chapter members stroll. A single speaker per group makes small gestures while listeners breathe and nod; nobody jumps or holds both arms overhead.

## Human motion and appearance

Chapter members and ambient visitors now share `village-human-motion.js`: proportional bodies, articulated hips/knees/ankles, upper/lower arms, hands, necks, shaped hair, small noses and shoes. Clothing and accessory colors remain seeded, with sleeves and exposed calves on shorts. Nearby chapter models have more rounded geometry; ambient models retain a smaller geometry budget and the same six instance batches per block.

Walking cycles follow distance traveled and individual height. Feet move backward at travel speed during ground contact, then lift and return on a continuous curve. Knees solve to fixed leg lengths, arms counter-swing, hips shift weight, shoulders counter-rotate, and heads glance ahead through rounded turns. Standing people settle into a taller relaxed stance with planted feet, subtle breathing, independent glances and smoothly eased conversation gestures. Joggers, seated students, skateboarders and people holding a leash or pushing a mower retain distinct poses.

The five chapter walkers follow a constant-speed loop around the conversation groups, with sampled clearance above half a world unit. Doorway visitors ease to a stop and turn over two seconds before returning. The groundskeeper follows a rounded route instead of reversing instantly. These are procedural routes, not a general crowd collision or navigation system; ambient visitors can still overlap when overtaking.

The motion tests check ground-contact sliding, stride-boundary continuity, leg lengths and knee direction, fixed standing feet, route speed/clearance, and continuous speaking/turning transitions. The local browser review covered character close-ups, the full village and pause/resume. The historical rendering measurements below predate this change; full-scene frame rates and updated triangle counts have not been benchmarked.

## Ground and rendering architecture

`village-streets.js` owns one persistent, opaque floor. Its 300-unit repeating texture carries roads, rounded junctions, sidewalks, crossings, bicycle lanes, parking, wheel wear, repairs, cracks, desire paths, leaf litter, damp patches, manholes, drains and chalk. There are no added overlapping decal planes. Streaming never removes or replaces the floor. Mipmaps, anisotropy and the 1–450 camera clipping range preserve surface stability.

`village-grass.js` adds a cached, seamless procedural grass texture, subtle surface-normal detail, broad dry/damp variation and soft mowing patterns. A pavement mask keeps the fine grass detail off the roads. The five chapter lawn surfaces share that material and remain outside the material-cloning batcher. A single instance batch adds 1,100 short grass tufts (16,500 triangles) around the foreground lawns, avoiding the central walks. These details are static; the leader spotlight adds no shadow-map pass.

Repeated campus geometry uses the batching/instancing helpers in `village-campus-kit.js`. Static geometry batches share material properties and use per-instance colors; animated people and their props share instance buffers. Distant scenery is batched once. Wires use thin triangular prisms, distant foliage has a modest polygon count, and tiny shoes use simpler rounded geometry to fund the additional population. Removed chunks dispose their instance buffers and owned materials/textures while shared resources remain cached.

Active people now update on every rendered frame, removing the separate 24 Hz timer that could reduce visible animation to approximately 15 Hz when combined with the old 30 Hz rendering cap. Pause, reduced-motion preferences, hidden-document and offscreen controls remain in `village.js`; no new animation loop was introduced. Rendering now retains its initial pixel ratio up to 2× on desktop and touch devices. Cached shadow maps remain 2048px desktop / 1024px touch.

## Verification and measured rendering budget

Run:

```sh
node --test fomo/campuswars/tests/*.test.mjs
```

All 63 automated checks pass, including camera/caption timing, final-only registration link, pause/resume, replay, interruption, reduced motion, slow frames, offscreen pausing, lens/bank continuity, nonzero waypoint speed with matching velocity and acceleration, street/roof clearance and restoration of daylight after skip, plus the existing live registration, competition, scene, crowd, vehicle and motion tests. The revised intro was visually reviewed on desktop and mobile. No browser console errors were observed. The measurements below are historical rendering measurements, not a new benchmark of the full-screen layout.

Density-pass measurements below predate the later empty-lot floor, library banner and surrounding-page edits. Measured in an isolated headless Chrome 142 WebGL browser using SwiftShader, with the same 1320×720 scene viewport, opening/close-up camera positions, frozen reduced-motion state and warmed cached shadows for both builds. Counters are `renderer.info.render` from the actual rendered frame, not scene-object estimates. Baseline is commit `161e653` immediately before this density pass. Its measurements differ from the older figures in the brief.

| View | Before draw calls | After draw calls | Before triangles | After triangles |
| --- | ---: | ---: | ---: | ---: |
| Opening | 201 | 177 | 631,298 | 680,432 |
| Sigma Chi close-up | 134 | 103 | 478,382 | 479,768 |

The opening is below the requested approximately 200 draws / 700,000 triangles. Initial detail exceeded the triangle limit and was reduced before shipping. Opening and chapter close-up screenshots were inspected. Browser frame rates were **not measured**; draw-call and triangle counts do not establish device FPS. No test registrations were submitted.

## Brand and architectural references

The existing fomo.family colors and Aeonik remain, with warm brick and ivory architecture. The standalone prize section and its trophy image are removed from the page, along with the corresponding navigation link. Earlier superseded artwork and prompts remain archived.

Architectural references from earlier work include [Maryland's Georgian fraternity row](https://fsl.umd.edu/about/history), [Alabama's Kappa Sigma plans](https://buildingbama.ua.edu/wp-content/uploads/2022/09/Kappa-Sigma-Stage-3.pdf), [UVA's shared campus spaces](https://www.virginia.edu/life-uva/) and [Maryland's campus circulation plan](https://facilities.umd.edu/projects-programs/campus-facilities-plan).

## Full-screen village

The Greek village is the entire page, filling the browser viewport on desktop and mobile without a surrounding header, marketing sections or footer. A small in-scene interface provides Chapters, About, registration, activity/party controls, leaderboard, reset and zoom. Chapter standings, selection details, sharing and live-update status are in an optional drawer. About contains the longer explanation, qualification rules, FAQs and replay. Registration and chapter standings remain accessible if WebGL is unavailable; the no-JavaScript fallback keeps a registration link available. Existing registration URLs, live polling and world assets are unchanged.

## Party mode

The separate Party mode button switches to a dusk sky and fog, cooler ambient light, blazing chapter windows, violet and amber uplights on the largest completed house, and a flickering bonfire at the open end of the row. Daylight materials restore when toggled off. Activity pause and reduced motion also freeze the beacon and fire; night lighting remains available without animation. Effects are added after static batching so their transforms remain animated, and add no shadow-map passes. Desktop day/night and lot close-ups plus the new controls at 390px were visually checked in the local browser with no console errors. Updated device FPS has not been benchmarked.

## Individual chapter motion and beer pong

Each member has deterministic, independent timing and movement ranges for breathing, weight shifts, torso turns, head nods, glances, and gestures. Idle movements have individual pauses; conversation groups also vary their speaking cadence. Standing feet stay planted while the body shifts subtly. Walkers each retain a steady but distinct speed of 0.59–0.87 units per second.

`village-pong.js` adds a table on each completed house’s front lawn, with two existing members, two triangular racks of six red cups, and an animated ball. Players alternate on chapter-specific schedules; the ball releases from the modeled throwing hand, arcs toward a cup, then disappears before the next turn. These are decorative games with reusable cup racks. Placement reserves room for each table and both players, away from the central path and walking loop. Tables and cups batch with static scenery; only the three balls animate. The existing activity pause, reduced-motion setting and offscreen handling apply to the games.

The added checks cover independent bounded movement with planted feet, exact member counts, table clearance, ball-release continuity, arcing shots and alternating turns. Day and night close-ups were inspected in the local browser without console errors. Device FPS was not benchmarked.

## Live integration verification

The live adapter was checked against the authenticated source (six chapters / 118 joined on September 9, 2026). All 44 automated checks pass. Automated checks cover private-field exclusion, full-roster denominators, stable identities, malformed responses, polling, unchanged updates, failure recovery, hidden tabs, expanded lots, new completed houses, continuous floor sections, crowd bounds and terrain reuse. Desktop browser testing confirmed a selected construction site becomes a completed house and new chapter cards appear without a reload or camera reset. Browser testing uses a local-only fixture to simulate new members and chapters; no test registration is submitted to the source site. Hosting activation still requires the Vercel server environment variable and a deployment.


## Refined vehicle fleet

`village-vehicles.js` supplies shared sedan, crossover and campus-shuttle models. Bodywork has beveled edges, tapered noses, real wheel openings, a narrower roof and sloped glazing. Details include grilles, separate front/rear light graphics, door seams and handles, mirrors, wipers, rear plates and five-spoke alloy wheels. Painted panels use a moderately reflective material; glazing, rubber, metal and trim have baked colors. Moving wheels roll with distance and the front pair steer through corners.

Every other moving vehicle (four of eight, including the shuttle) and every other car in each parking row is fomo-branded. Branded cars have uniform fomo-purple bodywork and white fomo graphics on both doors and the roof for aerial visibility. The texture uses the existing fomo symbol and Aeonik wordmark, with a violet background. Other vehicles retain ordinary paint colors. Parked cars share the sedan model; traffic includes all three silhouettes.

Paint, details, wheels and logos share geometry and are instanced. Moving cars use soft contact shadows that travel with them, avoiding stale silhouettes in the campus’s cached sun-shadow map. Static parked cars cast ordinary sun shadows. Vehicle resources are created lazily and released with the district; unloading individual blocks does not dispose shared vehicle assets. Existing traffic circuits, vehicle counts and activity/reduced-motion controls remain intact.

The 52 automated checks include exactly 50% branding across traffic and streamed parking rows, roof logo orientation, matching paint color, vehicle bounds, grounded wheels, outward-facing graphics, mixed branding, wheel rotation/steering and the existing district limits of fewer than 200 mesh objects and 22,000 instances. The visual harness at `tests/vehicle-gallery.html` allows inspection of each model from both sides. Desktop vehicle close-ups and village traffic were reviewed in the browser. Full-scene device FPS has not been benchmarked for this change.


## Greek Row entrance banner

A purple fabric banner with the original white fomo eyes hangs directly between the recreation center and residence buildings. Four short suspension cables attach to wall brackets on the facing facades; there are no poles or ground supports. Its placement derives from the buildings’ shared layout, with more than six units of clearance over the street. The eyes face outward on both sides. The banner follows the buildings when live chapter growth extends the row. It uses a static canvas texture, no additional animation loop, and the existing world resource disposal. The entrance is visible during the opening descent and from the settled village view.


`tests/intro-gallery.html` replays the actual village in an iframe and pauses during the reward beat for repeatable visual inspection. The refined clouds, banknotes and caption were checked in that scene without browser rendering errors. Full-scene device FPS has not been benchmarked.

## Street view navigation

Choose **Street view** to enter the boulevard at eye level. Click or tap the road to move along the block, drag to look around, and use the forward/back and exit controls. W/S and up/down arrow keys step along the street, left/right look around, and Escape returns to the overview. House clicks select the chapter while keeping the street perspective; focusing a chapter from the drawer returns to the orbit view.

Stops are spaced every 9.5 world units and extend automatically with the row. Navigation clamps at the ends, preserves its position through live house reordering, and uses the existing camera animation loop. Reduced motion snaps to the destination. Construction, rankings and navigation checks are in `tests/construction.test.mjs`, `tests/village-live.test.mjs`, `tests/street-navigation.test.mjs` and `tests/village-camera.test.mjs`. The school gallery includes South Florida, Michigan and Ohio State as automatic-lookup examples, verified with the live public API and in the browser.

House exteriors use red and brown brick, warm ivory, slate blue, sage, sandstone and other subdued traditional finishes. Each chapter is allocated a different color, independent of architectural style and ranking. Existing colors persist during live updates, and additional chapters receive unused finishes or natural shade variations. Street view draws no navigation circles or arrows on the ground; looking around uses dragging or the left/right keys.

House selection and the leading house no longer draw ground highlight rings. Chapter selection, rank labels and leader lighting continue to identify houses.

The Your neighbors popup now uses the same live onboarding-percentage ordering and tie ranks as the 3D houses, with explicit rank labels. Opening it requests a refresh. Member fractions in the popup, chapter banners and in-world leaderboard display joined members / `ceil(active * 0.8)`; percentage labels explicitly refer to the full active roster, which remains the ranking metric.
