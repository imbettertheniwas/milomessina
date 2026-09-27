# Rasmr and Orangie helicopter arrival

Public visual references reviewed September 15, 2026:

- [Rasmr's own post with Orangie, January 15, 2025](https://x.com/rasmr_eth/status/1879615612823261545): the video preview shows Rasmr on the left in a navy DEGODS hoodie, with short dark hair, pronounced eyebrows and a narrower face. Orangie is on the right with a fuller build, light-brown curls, dark rectangular glasses and a black BALENCIAGA graphic shirt.
- [Rasmr's stream announcement](https://x.com/rasmr_eth/status/2067284591962947993), public image-search preview: additional face/hair reference.

The characters are 3D likenesses with image-generated face textures based on the reference, clothing graphics and distinct builds. The September 27 revision maps the portrait onto a shaped facial surface, retaining modeled hair, ears and glasses from every angle. Fitted clothing, printed graphics, hands, sneakers and articulated knees/elbows replace the original simplified bodies. Procedural faces provide a fallback if the local texture cannot load. They are not scans or photorealistic digital doubles. Names above their heads make them identifiable at the village's small scale. The generated atlas is served locally. The original reference is kept alongside it for provenance and is not loaded by the scene. No personal records or external image requests are used at runtime.

The Maybach and helicopter are original procedural models. The scene is fictional scenery, not footage of an actual visit or a claim of endorsement. Guests do not affect chapter registrations.

The revised aircraft uses a continuous fuselage with fitted glazing, structural window seals, tapered tail, separate sliding door, rotor mechanism and speed-dependent rotor blur. The Maybach has shaped panels, wheel-arch openings, framed glazing, a leather cabin and outward-opening passenger doors. A small local sky reflection is shared across polished surfaces. Geometry is batched by finish within each moving part; vertex colors preserve distinct surfaces while keeping the original scene budget below 140 meshes and 130,000 triangles.

The second Maybach pass uses the [Mercedes-Maybach S-Class exterior reference](https://www.mbusa.com/en/vehicles/class/maybach-s-class/sedan) for the two-tone finish, upright grille and polished wheels. It adds smoother hood/roof profiles, closed body seams and C pillars, curved rear lenses and trim, twenty-slot wheels tucked inside the fenders, differentiated paint/chrome/rubber finishes, and local reflections preserved after batching. The existing rolling radius and door articulation are retained.

## Scene

The dedicated apron is at `(100, 200 + rowExtension)`, beside the stadium. Existing campus districts remain in place; distant scenery is excluded from the apron. **Helipad** frames the stop and restarts the 96-second arrival: drive in, open doors, exit, walk, stand outside together, board, close the door, take off, return and ride away. Paused and reduced-motion visits show both guests outside together. All motion uses the village activity clock. The permanent object survives roster changes and follows row extension.

`tests/helipad-gallery.html` provides repeatable scene, front/profile portrait, front/side/rear car, helicopter, night, boarding and flight views, plus a scrubbable timeline. `tests/helipad.test.mjs` checks timing, continuity, pause, reset, relocation, guests, outward door movement, independent portrait surfaces, vertex-color preservation and resource disposal.

## Face asset generation

Built-in image generation produced `assets/helipad/creator-face-atlas.png` using `assets/helipad/rasmr-orangie-reference.webp`. Prompt: Create a square 1024×1024 two-panel portrait atlas. Left: Rasmr, preserving his narrow face, thick dark eyebrows, short dark hair, light olive skin and slight stubble. Right: Orangie, preserving his fuller face, light skin, light-brown curls and dark rectangular glasses. Front-facing neutral expressions, head only, soft diffuse light, plain tan background, natural skin texture, no text or borders. Preserve each identity from the reference.

Full generation prompt (built-in image generation):

> Create a texture atlas for a 3D game, using the two real adult men in the reference image. Preserve the identity and likeness of each person carefully. Output a square 1024x1024 image split into two equal width vertical portrait panels, each 512x1024. LEFT: Rasmr, man on left of reference, narrow face, pronounced thick dark eyebrows, short dark hair, light olive skin, slight stubble. RIGHT: Orangie, man on right of reference, fuller face, light skin, curly light-brown hair and dark rectangular eyeglasses. Each portrait must be perfectly front-facing, neutral relaxed closed-mouth expression, eyes open looking straight ahead. Frame ONLY entire head from crown to chin, no neck, no shoulders, no clothes. In each panel head centered at panel center, the head silhouette occupies 90 percent panel width and 84 percent panel height, top of hair at 8 percent panel height, chin at 92 percent. Soft flat diffuse neutral light, no cast shadows, no environment, plain warm tan background. Photoreal natural skin texture and exact recognizable facial features from the reference, no caricature, no drawing, no text, no borders. This is an albedo texture asset, NOT a scene or a character model.

## Validation

The September 27 revision passed all 250 village tests. After the final model refinements, all nine focused helipad/module-loading checks passed; all six helipad checks were rerun after the portrait blend change. Browser review covered the integrated village stop, front/profile portraits, Maybach, helicopter boarding, night materials and a 390×844 layout. This is browser viewport validation, not a physical-phone performance test. These checks validate the local model and preview; deployment verification is separate.

The second Maybach pass passed all 10 focused helipad/module-loading checks, including wheel clearance and retained paint reflections. Desktop browser review covered front, rear, side, open doors and night lighting; the console reported no warnings or errors. These visual checks were performed in the local preview.
