# fomo Campus Wars

## Live village population sign

A two-sided sign on the far-left hilltop lawn, clear of the FOMO facade, shows total
**members joined** and the number of registered chapters. It sums every chapter
from the existing `/api/campuswars` feed, whose server adapter reads Arya's admin;
it does not count active-roster denominators or decorative campus visitors.
The existing 30–33-second refresh updates one shared sign texture independently
of house rebuilding and scene streaming. Saved or disconnected data is labeled
as last known, and the live label expires after 90 seconds without fresh data.
The off-white sign uses black lettering and two slim metal posts embedded in
the hillside. Its canvas description exposes the total to assistive technology. `tests/population.test.mjs` covers count
corrections, additions/removals, unchanged-count recovery, freshness and resource
reuse.

## Backyard pool reward

Every chapter unlocks a furnished backyard when joined members reach `ceil(active * 0.8)`. The original house styles and rank-based sizes remain. The rejected campus-house replicas and address catalog have been removed. Already-qualified chapters receive their pool on the first snapshot; live changes add or remove it with current eligibility. A small chapter reaching its goal before 15 members receives its completed house too.

Backyards sit behind the houses within existing Greek Row blocks. Raised stone paving encloses a recessed tiled basin with entry steps, curved steel ladder, rippling turquoise water, a subtle sky reflection and underwater glow in Party mode. Loungers, towels, a sun umbrella, a bench, planters, fences and a connecting path finish the terrace. **View backyard pool** in chapter details moves the camera behind the selected house and closes the drawer.

Water shares the existing activity clock and pause/reduced-motion behavior. Repeated furnishings batch with the village, and all pools share one water geometry and material per scene. No extra lights, reflection render passes or new members are added. Crowds cannot be relocated into the backyards. Pending streamed scenes and disposal use the existing renderer lifecycle.

`tests/backyards.test.mjs` covers the goal boundary, small rosters, live upgrades and corrections, lot clearance, member totals, water pause/night state, shared rendering resources and disposal. The camera tests cover the backyard view on desktop and phones.

## Rasmr and Orangie helicopter arrival

The **Helipad** control visits a new stop beside the stadium and replays their Maybach arrival. Both guests step out, walk over, stand together, board the helicopter and fly before returning. Distinct builds, clothes, name labels and locally served face textures use public visual references. These are stylized likenesses, not exact scans. The sequence shares activity pause and reduced-motion behavior and survives live roster updates. See [references and preview details](helipad-references.md).

## Live member arrivals

Fresh increases in the public joined counts from Arya’s admin bring one anonymous avatar per added member down under a large purple-and-ivory parachute. The descent takes nine seconds, with gentle sway and staggered arrivals. Suspension lines connect the canopy to raised hands; the canopy collapses after touchdown and the person joins the existing crowd. Exact member counts remain unchanged.

On entry, the browser replays recorded arrivals from the previous five minutes, including when the first live counts match the saved village. The replay waits for the intro to finish or be skipped. Repeated polls do not replay the same arrivals; stale responses, expired history and count decreases cannot create arrivals. Pausing and reduced-motion settings apply.

The source exposes totals, not individual signup timestamps. History therefore records when a count increase was observed. The legacy endpoint keeps this history within each warm server instance; a cold instance cannot reconstruct earlier arrivals. Saved browser history also supports reloads. Gaps of five minutes or more establish a new baseline instead of treating older registrations as recent. No member identities are exposed.

The existing polling interval is 30–33 seconds. `tests/arrivals-gallery.html` previews airborne, touchdown, settled and night views without submitting registrations. Arrival and history tests cover initial replay, freshness, deduplication, lawn touchdown, exact totals, pause, reduced motion, construction and scene replacement.

## Large villages and road hover

Above 80 chapters, the renderer retains all addresses, ranks, colors and navigation metadata while constructing house models around the camera. Scene construction is spread across frames, and selecting a distant house prepares its neighborhood before moving the camera. Paused activity continues pending house loads. Repeated roofs, signs and school banners share resources; banners allocate higher-resolution artwork as they approach the camera. Distant people use compact animated silhouettes at small projected sizes, and their detailed models return on approach. Display pixel density remains unchanged.

Road hover now coalesces pointer events to one hit check per animation frame and rejects empty pavement before testing blimp triangles. It also releases a stale mouse drag when the button is no longer down. A burst of 1,000 road-hover events is covered by the input regression test. These changes address excess hover work and unintended camera movement; the exact reported flashing artifact has not been independently reproduced.

`tests/scale-gallery.html` creates 1,000 houses and 20,000 members without modifying live data, with controls for house 1,000, a wide view, the stadium, night and pause. Local browser checks reached approximately 58–60 FPS in a narrow street/house view. The fixed desktop stress view (2560 × 1440 drawing pixels, 2,380 visible members) reached approximately 28–30 FPS after loading, with about 760 draws and 3.8 million triangles. This is a working scaling baseline, not a guarantee of 60 FPS on every device. Further work should prioritize broad-view GPU cost and transitions while neighborhoods are being prepared.

## Memorial football stadium

The Stadium control visits a dedicated football ground at `(0, 200 + rowExtension)`, beyond the athletics block with a full block separating it from Greek Row. Its reserved district prevents campus buildings and walkers from appearing inside the bowl. The stadium includes a marked 100-yard field and end zones, goalposts, tiered seats, aisles and handrails, press boxes, concessions, gate signs, four floodlight towers, and a changing exhibition scoreboard. It stays in place as surrounding districts stream, and moves outward with the campus when Greek Row grows.

There are 2,732 independently waving and bouncing spectators and 22 helmeted players. The continuous exhibition alternates possessions through the snap, an airborne pass, a catch, a touchdown and a return to formation. Crowd animation runs on the GPU; player and scoreboard updates pause when offscreen and resume at the current village animation time. Existing Pause activity and reduced-motion behavior apply to the match. Party mode illuminates the stadium field and light banks. Spectators and players are scenery and do not affect registrations or standings.

The stadium is procedural 3D scenery in the village's visual style, rather than photoreal footage. Its fixed budget is under 40 meshes, 7,000 instances and 850,000 triangles; existing campus scenery retains its previous separate limits. The full 148-test suite passed, followed by the stadium tests after the final player refinements. Browser checks covered daylight, night, the stands, the sideline, and the 390 × 844 phone layout without rendering errors. `tests/stadium-gallery.html` provides independent views and a touchdown/pause preview; `node --test fomo/campuswars/tests/stadium.test.mjs` checks location, streaming, continuity, culling, pause and rendering budgets.

## Individual people and campus routines

Campus visitors and chapter members now keep stable clothing and appearance traits: four outfit families, five hairstyles, different builds, skin tones, caps, sunglasses, shoe colors and backpacks with shoulder straps. Academic students have individual idle profiles, departure offsets and destination wait times. They branch toward the academic halls, while readers occupy a loose lawn gathering. Sports participants wear athletic clothing. Chapter and sidewalk walkers pause and glance around on individual schedules, easing smoothly into and out of each stop. Conversation groups share irregular speaker choices and quiet intervals rather than rotating through every member in order.

Movement remains on the existing routes. The random choices are seeded per identity and time interval; they remain consistent after pausing, streaming away, or refreshing the same scene. Destination heading transitions now ease through corners and waits, including repeated start/end points. Registration totals, construction assignments and game rules remain unchanged. Clothing details reuse existing instance batches, and campus accessories allocate slots only when present. Existing automated scenery limits remain in place; device frame rates have not been benchmarked for this change.

`tests/human-gallery.html` provides chapter, quad and sidewalk close-ups with daylight/night and pause controls. The full suite, `node --test fomo/campuswars/tests/*.test.mjs`, covers individual stop/start continuity, irregular conversations, stable appearances after roster growth, academic building clearance, destination turns, rendering bounds and paused/offscreen catch-up. Day/night close-ups were also inspected in the local browser.

## College-town neighborhoods

The wider village now includes Market Lane (pizza, a bar and patio, a vintage shop, a convenience store, and a record shop with apartments above), Maple Court and Porch Lane (small homes, furnished porches, side yards, laundry and mailboxes), and Willow Green (wooded slopes, walking trails, picnic areas, a pond and a timber pavilion). Shop elevations include windows on the sides and rear, fire escapes, service alleys and deliveries. Noticeboards, leaning bicycles, fences, outdoor tables and street lighting give the spaces between buildings a purpose. The existing academic buildings and chapter registration rules remain in place.

Campus visitors follow timed journeys between destinations, including class to coffee, collecting pizza, visiting records and the patio, and carrying deliveries. Pickups appear after the destination stop. Party mode illuminates storefronts, selected apartment windows and patio strings; the green gets quieter and evening groups gather at the bar patio. Ambient visitors remain scenery and never count toward chapter registrations. Routes use the existing pause/visibility clock, and newly streamed areas inherit the current lighting mode. Repeated geometry stays batched, including shared roofs; automated checks retain the existing limits of fewer than 200 scenery meshes and 22,000 instances across the tested streamed views. These checks are not device frame-rate measurements.

For a local preview with current registrations, run `node server/campuswars-preview.mjs` from the repository root and open `http://127.0.0.1:4179/fomo/campuswars/`. This localhost-only server serves the working files and forwards `/api/campuswars` to the deployed site's public aggregate feed, preserving its timestamp and stale status. It uses no admin credentials and accepts no writes. A plain static server does not serve that API and will show saved registrations instead. Production continues to use the existing Vercel endpoint. Neighborhood, route, lighting, camera and preview-feed checks are included in `node --test fomo/campuswars/tests/*.test.mjs`.

Static landing page for `https://milomessina.com/fomo/campuswars/`, using the existing GitHub/Vercel deployment. Three.js 0.180.0 is pinned in `vendor/` with its MIT license. The page has no new dependencies or build step. `/api/campuswars` is a Vercel Node function that reads the authenticated registration source on the server.

## Graphics and performance refinement

Rendering now keeps its initial device pixel ratio (up to 2× on desktop and mobile) instead of permanently reducing resolution after slow frames. Cached sun shadows use soft PCF filtering at their existing resolutions. Party mode has slightly stronger indirect and fill lighting so street-level people and architecture remain readable, with no extra lights or rendering passes. All models, textures, populations, activities, and controls are retained.

Campus crowds outside the camera frustum skip pose calculations and instance-buffer uploads. Conservative bounds match their existing rendering bounds, including routes and props. Newly visible crowds refresh to the current absolute animation time before rendering, including camera movement while activity is paused. Paused poses are cached; fully hidden views perform no rendering. Shared trigonometry and reusable vectors also reduce repeated calculations and temporary allocations in chapter crowds, campus people, and cyclists.

An interleaved local Node benchmark of the opening camera measured campus activity updates at **3.56 ms before / 2.78 ms after (22% less CPU time)**: median of five 90-frame samples after warmup, with the preceding source as the baseline. All nine campus chunks and 424 campus people remain; seven chunks / 358 people need animation in this view. This isolates CPU animation work, excludes GPU rendering, and is not a device FPS claim. All 111 tests pass, including exact visible-pose equivalence, paused-camera catch-up, translated culling bounds, fixed resolution under slow frames, and hidden-view suspension. Desktop daylight, night lighting, and street controls were visually checked in the local preview, including a 390 × 844 phone viewport, without rendering errors.

## Automatic chapter updates

`site.js` starts `chapter-feed.js` immediately and checks `/api/campuswars` every 30–33 seconds while the tab is visible. The small random offset spreads visitor requests. Returning to a hidden tab triggers an immediate refresh, including when a cancelled request is still settling. Changes update roster cards, the selected detail panel, share text, houses, construction, banners, exact member crowds, rankings and the claim lot without reloading or resetting the camera. Unchanged chapter payloads, including the first live response matching the bundled data, do not rebuild the scene. Party mode and activity pause survive updates. A failed request retains current data and shows a reconnecting status; retries back off to at most five minutes and honor the server's bounded `Retry-After`. Hidden tabs cancel in-flight requests. Older network snapshots cannot replace newer saved counts.

The function reads `https://www.aryatoufanian.com/admin/` with HTTP Basic authentication. `server/campuswars-source.mjs` recognizes the chapter table by its headers and returns an explicit allowlist of chapter identities, school, registration date and aggregate counts. It never returns registrant names, emails, phone numbers, nominations, member records or invite links. The admin progress denominator is the **80% target**; the adapter reads the separately labeled **actives** value for the full roster. Malformed or incomplete tables fail closed. Source reads time out after eight seconds and stop after 8 MiB of decoded bytes, including chunked or compressed responses. The browser has a twelve-second timeout and validates snapshots.

Warm function instances coalesce concurrent reads and cache successful totals for 30 seconds. Only sanitized public snapshots are eligible for Vercel CDN caching. The CDN freshness lifetime subtracts time already spent in the instance cache, followed by a 30-second background revalidation window. Browsers revalidate using ETags; HEAD and unchanged conditional requests omit the body. Error and saved-data responses use `no-store`. This uses [Vercel's documented cache headers](https://vercel.com/docs/caching/cache-control-headers); edge-cache hits and regional behavior still need verification on a deployed preview.

During a source outage, a warm instance retains its last verified snapshot for at most five minutes, with `stale: true` and its original timestamp. The browser shows reconnecting status for stale data or timestamps older than 90 seconds. Source retry delays grow from five seconds to one minute per instance, including cold failures; success resets them. Cold instances have no durable saved snapshot, so the browser's saved public data remains the fallback. `X-Chapter-Cache`, `Server-Timing`, and `Retry-After` expose fixed operational states without disclosing source errors or credentials. Shared-cache behavior is regional, not a globally coordinated source lock.

### Scaling verification (September 13, 2026)

Chapter crowd animation now checks conservative per-lawn visibility bounds before calculating member poses. It uploads only changed instance ranges and catches newly visible people up to the current animation clock, including while paused. Every member and the existing resolution, geometry, lighting and activities remain present. Surrounding campus crowd culling continues independently.

Run `node --test fomo/campuswars/tests/*.test.mjs` for the full regression suite and `node fomo/campuswars/tests/benchmark-scalability.mjs` for the repeatable synthetic benchmark. Coverage includes 1,000 simultaneous requests sharing one source read per instance, 1,000 distinct school records, privacy allowlisting, cache expiration, ETags, outages, recovery, bounded streams, tab cancellation, unchanged-data handling, and exact visible-pose equivalence across multiple streets.

The local 60-chapter / 1,200-member benchmark animated 160 visible members in its fixed street-facing view. Across six interleaved 60-frame samples after warmup, median animation CPU time was **8.960 ms for all members versus 1.343 ms with visibility checks (85.0% lower)**. A synthetic 1,000-request burst completed with one source read and 1,000 successful responses. These measurements exclude network latency, real upstream response time, CDN behavior, canvas textures and GPU rendering; they are not production capacity or FPS guarantees. Browser checks with local saved-data fixtures verified daylight, live status, paused street navigation and party lighting without console warnings or errors.

Remaining capacity limits: changed chapter payloads still synchronously rebuild the full village (the synthetic 60-chapter build took about 1.06 seconds even without browser textures). Static houses and global crowd buffers also remain resident for all schools. Before claiming support for a substantially larger world, replace full rebuilds with incremental chapter updates and spatial scene streaming, measure total frame time and memory on phones, and load-test a deployed preview. At larger traffic volumes, a durable public snapshot updated from registration events would remove the admin HTML source from visitor request handling. This repository does not contain that registration backend or a provisioned shared data store.

Existing chapter IDs and share links remain valid. New chapters use stable source UUIDs, so the same fraternity at different universities gets separate houses. Physical lot order follows onboarding-percentage standings, using the same joined-member-count and chapter-ID tie breakers as the leaderboard; source reorderings do not change addresses. A chapter that rises in the standings moves toward the first lots with its banners, members and rank badge, while its architectural style stays tied to identity. Exactly one empty claim lot follows the registered chapters.

`chapters.json` and the embedded HTML remain the original five-chapter fallback (117 joined / 369 active). They are labeled saved registrations until the first successful refresh. The authenticated source was read successfully during implementation and had six chapters / 118 joined, including Phi Delta Theta at Florida International University (1 / 55). This observation is not a hardcoded live total.

### Hosting activation

1. In the Vercel project serving `milomessina.com`, set the server environment variable `CAMPUSWARS_ADMIN_PASSWORD` to the admin password supplied by the owner. Set it for Production and any Preview environment that needs live data. `CAMPUSWARS_ADMIN_USERNAME` is optional and defaults to `village`.
2. Deploy this repository from its root, including `api/campuswars.mjs` and `server/campuswars-source.mjs`. No package install is required. The function duration is configured in `vercel.json`.
3. Verify `/api/campuswars` responds with `live: true`, `updatedAt` and chapter aggregates, then verify the village shows “Live onboarding.” Without the server secret, the endpoint returns 503 and the page explicitly shows saved data.

Environment values take effect on a new deployment ([Vercel documentation](https://vercel.com/docs/environment-variables)). Never put the password in a client script, static JSON, URL, or committed environment file. No cron task or running Codex session is needed: each visitor's page polls the hosted function, which reads current registrations automatically.

Registration links continue to `https://www.aryatoufanian.com/fomo/onboard/`. Joining happens on that site. Qualification remains `ceil(active * 0.8)`, and the page's existing prize rules are unchanged.

## Village and controls

Zoom-out controls and mouse/trackpad scrolling now allow a camera radius of 320 (previously 160), with the far clipping plane extended to 650. School banners hang on both side walls of completed houses and on construction scaffolds, using local official school logos, names and colors. The marks keep their proportions as houses grow and remain selectable. School identity follows the registration's university, including FIU and common aliases; new schools automatically look up matching university logo/wordmark files through the public Wikipedia API and derive a banner color from the mark. Lookup requests are shared between both banners and subsequent live updates. Missing, ambiguous or temporarily unavailable artwork retains a distinct name banner; failed lookups can retry on later updates. Sources and design notes are in [school-banner-references.md](school-banner-references.md), with a visual review in [tests/school-banner-gallery.html](tests/school-banner-gallery.html).

The first six physical lot slots are preserved, with the highest-ranked chapters assigned first. `createLots()` adds alternating houses every 19 units along a street, always followed by one claim lot. A street carries ten plots down each side, twenty in all — the row at its present length. The main street reserves one of those twenty for the claim lot, so the boulevard holds the nineteen best-ranked houses and the twentieth chapter opens the next street rather than lengthening the row; later streets carry twenty houses each. Streets stand on the campus road grid 100 units apart, opening east then west of the original boulevard, and the block each one occupies becomes a Greek block instead of an academic one. The claim lot always closes the main street: it waits beside the last house while the boulevard fills in around it, and never moves onto a side street. `rowExtension()` extends every street together in 19-unit sections, to a maximum of 133 units, so the world stops growing once a street is full. The existing single opaque floor inserts straight street sections; its end junction, leaderboard, bonfire and northern campus move outward. Traffic loops lengthen with the row, and crowd rendering bounds include the added lots. Removed village scenes release their owned rendering resources while retaining the terrain and shared banner hardware. Houses use Georgian/classical architecture with brick, columns, porticoes, balconies, shutters, roofs and porches. Chapters with fewer than 15 joined members have foundations, exposed timber, scaffolding and staged materials; a completed house appears at 15. Completed house width, height and depth follow the displayed onboarding rank: #1 is largest, #2 is next, and each subsequent rank is smaller. Ties receive equal dimensions. Live rank changes resize houses and reposition porch members automatically; dimensions stay within their lots. The 15-member construction threshold still controls when a completed house appears.

Construction sites now derive a persistent architectural plan from chapter identity: longhouse, twin-wing, courtyard, townhouse or pavilion foundations, with distinct dimensions, bay spacing, timber, masonry, internal framing, scaffold placement and supply yards. The plan stays recognizable as the count changes. Zero-member sites also have one of five identity-seeded preparation setups: compact excavator, material gantry, pipe yard, site office or concrete formwork. Scaffold heights, footprints, accent colors and survey strings vary independently, without adding workers. Permanent framing and masonry increase with the actual registration count, and the completed house appears only at 15.

Every member of an under-15 chapter becomes exactly one construction worker. A zero-member site has no crew. Each worker has a hard hat, a tool, an individual supply lane and an offset work cycle: pick up material, turn, carry it to the structure, install it, drill/hammer/saw/lay masonry, then return for another load. Supplies travel from the hands to the work station, and feet stay planted while working. Seven independent lanes on each face keep up to 14 workers clear of walls and each other. Workers replace that chapter’s conversational people; no decorative builders inflate its count. Five shared equipment instance batches keep the scene below the existing 150-mesh test budget. Animation uses the existing village clock, so pause, reduced motion and hidden views behave consistently. Live onboarding rebuilds the crew and disposes replaced tools.

`tests/construction-gallery.html` previews chapter designs, crew counts and work cycles with explicitly labeled preview data. Automated checks cover plan uniqueness, exact counts from 0–15, continuous routes, worker spacing, tool and material motion, deterministic poses and disposal at completion.

House-mounted cloth banners now have five distinct compositions using the real fraternity palettes: blue/gold Sigma Chi, scarlet/emerald Kappa Sigma, blue/silver Phi Delta Theta, cardinal/hunter-green Phi Kappa Psi, and cherry/gray TKE. Each shows Greek letters, chapter name and the real member count. Original artwork and source references are documented in [banner-references.md](banner-references.md); [tests/banner-gallery.html](tests/banner-gallery.html) provides a flat visual review. Their 2048-pixel textures use Aeonik, woven detail, stitching and modeled eyelets. Counter-scaling preserves lettering proportions as houses grow. The original `fomo /campus` lockup now hangs across the main domed library at (0, −120), on a 29-unit-wide façade banner. It uses a 3072-pixel texture and sits in front of the columns, suspended below the cornice. The previous ground logo is removed.

On page load, `village-intro.js` supplies a 13.6-second flight through the actual village: a high dive toward the boulevard, a low street-level flyby, a climbing banked orbit above the houses, a rooftop sweep, and a return to the original composition. A quintic Hermite route carries shared velocity and acceleration through each waypoint, removing the former stop-and-start motion. The low shot stays in the street corridor and the orbit clears the rooftops. The tour is 15% shorter, with a smoother 48–72 degree lens and restrained banking. A brief daylight-to-party-lighting transition illuminates the houses during the orbit and returns to daylight before the ending; leaving the intro restores the user's selected party mode. There is no added animation loop or postprocessing pass.

The village remains unobstructed: no fact cards, chapter timeline, large copy panel or full-screen tint. Four short bottom captions explain the chapter trading competition, house growth and invitation; captions disappear between beats. Only small Pause and Skip controls persist, with a text join link on the final invitation. About retains the longer explanation and full rules. The shared visible-time clock pauses offscreen and in hidden tabs. Pause freezes the camera, lens, lighting and scenery while keeping the current caption readable. Reduced motion uses a stationary camera, default lens, static text and no lighting transition. Skip or direct camera interaction clears the intro; About can replay it.

The third title now reads “$500 ONCE ONBOARDED.” `village-money-rain.js` raises soft cloud banks and rains fluttering banknotes over completed chapter houses from 6.205–10.2 seconds, synchronized with the title reveal. Bill counts decrease with the same onboarding rank shown on each roof; ties receive equal counts. Chapters with fewer than 15 joined members and the claim lot receive none. Each bill stays above its eligible house footprint and disappears before entering its roof. The effect uses two instance batches and shared geometry. `village-money-art.js` supplies a soft, irregular cloud-density texture and a 768px banknote texture with engraved linework, a portrait medallion, denominations and warm paper grain. Camera-facing cloud puffs use feathered edges and layered shading. The subdivided paper has a gentle curl and animated flex; matte lighting, slow flutter and lateral drift replace the earlier bright, rapidly spinning rectangles. The effect runs with no shadow pass or extra animation loop. Live chapter updates rebuild recipients and release replaced instance buffers. Pause freezes the effect, skip/interaction clears it, replay resets it, and reduced motion suppresses it. Automated checks cover exclusion, ties, density order, bounds, timing, deterministic pause, replay, live updates and disposal; the cloud-and-cash reward beat was visually checked in the browser.

Before playback, `village-prewarm.js` compiles both day and party lighting and renders the money effects behind the loading cover. A one-pixel scissor limits fill work while geometry, textures and shadow variants reach the GPU. The intro clock starts after preparation completes. Live roster changes arriving during compilation are queued and warmed before playback, so their old materials are not disposed mid-compile. This removes first-use shader compilation from the night transition without changing the tour or its effects.

After the intro, the existing slow orbit resumes at 0.06 rad/s until the first camera/house interaction. Reset returns to the original composition. In normal mode, hold WASD to fly its orbit anchor across the ground in the current viewing direction. Diagonals keep the same speed, and flight remains available while activity is paused or reduced motion is enabled. Releasing the key, leaving the village, or switching focus stops travel. Drag or arrow keys orbit, Shift-drag pans, and scrolling, pinching, +/− keys or the zoom buttons zoom around the new anchor. Reset restores the original anchor. Normal-mode flight works without first clicking the canvas and after using the view controls; typing in fields, chapter drawer navigation, About and browser shortcuts retain their keyboard behavior. Scrolling over the scene zooms without requiring canvas focus. Selecting a house opens its chapter drawer and updates the `#chapter=...` share link. Live data refreshes update the selected chapter without opening a closed drawer.

The empty lot has a single purple floor reading `YOUR HOUSE / CLICK TO START` across its full 15×18 surface. A hollow, flared light shaft uses a vertical alpha gradient, additive blending and BackSide rendering at 0.115–0.165 opacity. Two expanding ground rings share a 2.6-second heartbeat, four survey stakes mark the corners, and a floating “CLAIM THIS LOT” board faces the street. Both the board and floor open registration. Clicking any part of that floor follows the existing chapter registration link. The chapter roster and signup links remain usable if WebGL fails. Native sharing falls back to clipboard and then a selectable URL.

`village-competition.js` ranks all registered houses by onboarding percentage using the latest available data. Percentage ties are broken by joined-member totals; chapters share competition ranks only when both totals and percentages match; the empty lot is excluded. Floating roof badges show each rank, with gold styling, a warm spotlight and a faint light shaft on the leading house. A freestanding leaderboard sits beside the three-way intersection at `(17.5, 0, 41.8)`, facing the houses. The Leaderboard button moves the camera to its front, fitting the board to the viewport. The board continuously scrolls the top ten of the current chapter count, advancing one row every 3.2 seconds with fixed headings. Activity pause freezes the scroll, and reduced-motion mode shows the complete top ten without movement. Its reverse face carries spray-painted original FOMO eyes with purple overspray; all chapters have rank badges and roster cards. It explicitly labels onboarding progress, not trading results.

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

Each member has deterministic, independent timing and movement ranges for breathing, weight shifts, torso turns, head nods, glances, and gestures. Idle movements have individual pauses; conversation groups also vary their speaking cadence. Standing feet stay planted while the body shifts subtly. Walkers each have a distinct cruising speed of 0.59–0.87 units per second, with individual eased pauses added by the campus routines update.

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

Choose **Street view** to enter the boulevard at eye level. Click or tap the road to move along the block, drag to look around, and use the forward/back and exit controls. W/S and up/down arrow keys step along the street, A/D and left/right look around, scrolling zooms the lens, and Escape returns to the overview. House clicks select the chapter while keeping the street perspective; focusing a chapter from the drawer returns to the orbit view.

Stops are spaced every 9.5 world units and extend automatically with the row. Navigation clamps at the ends, preserves its position through live house reordering, and uses the existing camera animation loop. Reduced motion snaps to the destination. Construction, rankings and navigation checks are in `tests/construction.test.mjs`, `tests/village-live.test.mjs`, `tests/street-navigation.test.mjs` and `tests/village-camera.test.mjs`. The school gallery includes South Florida, Michigan and Ohio State as automatic-lookup examples, verified with the live public API and in the browser.

House exteriors use red and brown brick, warm ivory, slate blue, sage, sandstone and other subdued traditional finishes. Each chapter is allocated a different color, independent of architectural style and ranking. Existing colors persist during live updates, and additional chapters receive unused finishes or natural shade variations. Street view draws no navigation circles or arrows on the ground; looking around uses dragging or the left/right keys.

House selection and the leading house no longer draw ground highlight rings. Chapter selection, rank labels and leader lighting continue to identify houses.

The Your neighbors popup now uses the same live onboarding-percentage ordering and tie ranks as the 3D houses, with explicit rank labels. Opening it requests a refresh. Member fractions in the popup, chapter banners and in-world leaderboard display joined members / `ceil(active * 0.8)`; percentage labels explicitly refer to the full active roster, which remains the ranking metric.


### FOMO Discord blimp

A modeled purple FOMO blimp flies a continuous 110-second oval above the village. The redesigned airship has a satin purple hull, pearl underside, curved tail fins, panoramic cabin windows and spinning twin propellers. A large white Discord Clyde symbol and lowercase fomo wordmark are painted directly onto both sides with transparent artwork; there is no rectangular banner. The hull uses one surface for both paint finishes to avoid flickering. The Discord symbol comes from [Discord’s official brand assets](https://discord.com/branding). Clicking or tapping the blimp opens `https://discord.gg/FhvKtyvFJp` in a new tab. A native Discord link in the controls (under More on phones) provides keyboard access. Dragging and pinching do not open the invite.

The blimp shares the existing activity clock, pauses with Pause activity and reduced-motion defaults, and suspends when the village or browser tab is hidden. It uses local canvas artwork, shared geometry/materials, and no extra lights, shadow passes, timers or downloaded model. It stays separate from roster rebuilds. The 118 automated checks include lap continuity, flight heading/clearance, picking both sides, pause/resume, reduced motion, hidden-view suspension and gesture handling. Desktop and 390 × 844 previews were checked in daylight and party mode; clicking the actual blimp opened the exact invite without browser errors.


## Main campus hill

The original fomo campus building and its two academic halls now stand six world units above Greek Row on a grass-covered hill. A level academic quad connects their entrances, with three flights of broad stone steps, landings and handrails descending toward the boulevard. A separate switchback walk follows the hillside with level turning pads. Trees, benches, bicycle parking, planted stone edges, a flagpole and a campus noticeboard give the approach a collegiate scale.

`village-campus-hill.js` shares its terrain and path heights with the ambient students, including the coffee-shop visitors coming from Greek Row. Only the original academic block is raised; surrounding streets retain their original elevations. The hill uses the existing grass material and district streaming/disposal system.

The visual preview at `tests/campus-hill-gallery.html` includes quad, street-level, overhead and day/night views. The 140 automated checks pass, including foundation support, road-edge elevations, stair and ramp grades, rendered student heights and removal/recreation of the streamed hill. Daylight and night views were checked in the local browser. Full-scene device frame rates were not benchmarked.

### Pool yards and activity

Greek Row keeps the rear-yard strips clear on every street. The café and basketball court sit beyond the rear walks, and the fountain moves with the end of an extended row. Eligible chapters move up to six existing members into bathing suits: two swimmers in separate lap lanes, loungers on deck chairs, and poolside conversation. Their identities and the visible roster count are preserved. Pool animation shares the village clock, including pause and reduced motion.
