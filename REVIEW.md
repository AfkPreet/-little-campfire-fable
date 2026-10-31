# Screenshot review log

Rubric (1-5 each): 1 serene at a glance · 2 kawaii · 3 palette and lighting match the bible · 4 clear depth (4+ bands, atmospheric fade) · 5 zero placeholder or unstyled elements · 6 no harsh edges, pure black or white, or clutter · 7 legible text and 44 pt touch targets · 8 would this screenshot make someone want to play. Anything at 3 or below gets fixed and re-shot, up to 3 rounds per milestone. Shots live in `shots/<milestone>/` (iPad 1180x820 @2x and phone 844x390 @2x); run `npm run shots m0`.

## M0: style board

### Round 1 (integrator review of the artists' boards)

| Shot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Notes and fixes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| board-palette | 5 | - | 5 | - | 5 | 5 | 5 | - | Pipeline proof only. Phaser Graphics gradient fills showed triangle seams on rounded rects: gradients now come only from painted textures (rule added to CLAUDE.md). |
| board-ui | 5 | 4 | 5 | - | 5 | 5 | 5 | 4 | Cards, nine-slices, icons and catch card all read soft and kawaii; no seams. Demo strings ("pine needles", "Bubble Carp") are demo-only. Pass. |
| board-hero | 4 | 3 | 4 | - | 5 | 4 | 5 | 3 | Face is cute and the night tint reads. Tail's regular scallops look like a gear edge; stripes drawn as arcs on the face read as wrinkles and the belly lines read as a shirt; near arm is a stiff tube. Fix: fluffy irregular S-curve tail, stripes along the back and crown only, stub arm. Re-shoot. |
| board-npcs (Puttu) | 5 | 5 | 5 | - | 5 | 5 | 5 | 4 | Spotted bean with huge eyes; peek and sleep poses are charming. Pass. |
| board-npcs (Doddamma) | 5 | 4 | 5 | - | 5 | 4 | 5 | 4 | Grandmotherly, slipped-down spectacles are a nice touch. Pass. |
| board-npcs (Bangari) | 4 | 3 | 4 | - | 5 | 4 | 5 | 3 | Plain lemon-oval body with a grid of circles: no hump, no tail fin, reads as a corn cob. Fix: fish silhouette with hump, forked lavender tail fin, overlapping scallop scales, sleepy lidded eyes. Re-shoot. |
| board-landscape, camp-* | - | - | - | - | - | - | - | - | Pending: the landscape artist is finishing the Landscape class and boards. |

Artists' own self-review rounds (from their reports): hero R1 4/4/4/3/5/4/4/3 → R3 4/5/4/4/5/4/4/4; NPCs R1 4/3/4/4/5/4/3/4 → R3 4.5/4.5/4.5/4/5/4.5/5/4.5. The integrator scores above are stricter on kawaii and on "want to play" for the hero tail and the guardian body.

### Round 2 (after the character polish)

| Shot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| board-hero | 4 | 4 | 4 | - | 5 | 4 | 5 | 4 | Tail is now a fluffy comma with irregular fur bumps and the "?" curl reads; stripes run along the back; face is clean. Pass. Minor: crown dashes show as faint forehead arcs at 100 px (acceptable). |
| board-npcs (Bangari) | 4 | 4 | 4 | - | 5 | 4 | 5 | 4 | Hump, roof-tile scallops, forked lavender tail, dorsal fin, sleepy lidded eye and blush: a gentle fish spirit. Pass. Minor: pectoral petal faint against the glow belly; barbels hang in front of the belly (fine when risen at the dock). |

### Round 2 (landscape, integrator review)

| Shot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Notes and fixes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| board-landscape (6 keys) | 4 | 3 | 4 | 3 | 5 | 4 | - | 3 | Relighting across dawn/day/golden/dusk/night/rain is lovely and consistent. But the far ridges are one faint band, the estate slope is a strip of squiggles, and a tall empty water band flattens the middle; the jamun crown dominates; the laterite earth face is heavy; ferns are dark blobs. Fix: three stacked ridge chains with their own tints (lighting now exposes far/ridgeMid/mid/estate), a real estate middle ground (y 290-420) with readable silver oaks, coffee rows and a homestay, water reduced to y 420-600 with mirrored reflection and bigger snags, jamun crown to 420 px with cloud lobes, lighter lower bank, delicate fern fronds. Re-shoot. |
| camp-night | 4 | 4 | 4 | 3 | 5 | 4 | - | 4 | Firelight pool, fireflies, moon path and stars all present and warm; the moon-lily pool glow is a nice touch. Same depth issues as above. |

### Round 3 (landscape, integrator review): M0 passes

| Shot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| board-landscape (6 keys) | 4 | 4 | 5 | 4 | 5 | 4 | - | 4 | Three ridge chains stack with their own tints; the estate middle ground reads (coffee rows, silver oaks with pepper vines, areca, homestay); water has reflections, lily pads and tall pale snags; the jamun is a soft cloud-lobed tree; bank is light with a grass lip; ferns are delicate. Pass. |
| camp-day | 4 | 4 | 4 | 4 | 5 | 4 | - | 4 | Full-frame day view keeps the top 40% as sky and ridges. Nit (not blocking): the coffee-bush rows read as a repeating dot pattern in flat daylight; soften in the M4 polish pass. |
| camp-night, camp-rain, camp-dawn-mist, camp-golden | 4 | 4 | 5 | 4 | 5 | 4 | - | 4 | Firelight pool, fireflies, moon path; rain is cooler with streaks and rings; mist dissolves the ridges top-down; golden rim warmth. Pass. |

**M0 verdict:** every board scores 4 or more on every applicable rubric line. Style board passed; gameplay code may begin (M1).

## M1: vertical slice

### Round 1 (integrator review of phase-1 scenes)

| Shot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Notes and fixes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title | 5 | 4 | 5 | 4 | 5 | 4 | 4 | 4 | Live dusk camp, fireflies, glowing logo: pass. Fix later: the hero's sleep pose is a rotated lying-on-back rig and reads as fallen over; needs a curled-up sleeping texture. Dotted tent spots show on the title (hide when a tent is pitched or on the title). |
| shop | 4 | 4 | 5 | - | 4 | 5 | 5 | 4 | Clean, warm, legible; Doddamma and the greeting card work. Fix: the money icon is a generic coin, the bible says cowrie shell (kit coin texture repainted); the Monsoon Dome icon is a flat triangle, should read as a dome. |
| cooking | 4 | 4 | 4 | - | 5 | 4 | 5 | 4 | Kettle close-up, basket chips and fire read well. The tawa icon is heavy ink; soften with a bark rim. Pass. |

### Round 2 (camp shots, after fixes): M1 passes

| Shot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| camp-day (iPad, phone) | 4 | 4 | 4 | 4 | 5 | 4 | 5 | 4 | Round 1 had a dark block top-right: the parallax used `camera.scrollX`, which is not the view's left edge under camera zoom; now uses `camera.worldView.x`. Bamboo culms were clipped by their 340 px texture; widened to 480. HUD (cowrie, day/phase, lantern, backpack, journal) reads at both sizes. |
| camp-night | 5 | 4 | 5 | 4 | 5 | 4 | 5 | 5 | Moon path, stars, fireflies in the bamboo, lit shop window and tent, firefly-lit thicket ring. Nit for M4: the laterite gatepost looks washed out under the shop lantern's additive glow. |
| title | 5 | 4 | 5 | 4 | 5 | 4 | 4 | 4 | Sleep pose is now a curled nap (lean back, tail over like a blanket). Pass. |
| day-summary | 4 | 4 | 4 | - | 4 | 5 | 5 | 3 | Card and bloom are fine but the midtrip debug state has no page data so no highlight lines show; verify with a played day in M4 and give the bloom a petal-opening animation. Not blocking. |

**M1 verdict:** `npm run smoke` plays Day 1 (buy essentials, pitch, forage, fish, cook, eat, sleep), reloads and resumes on Day 2 with no console errors; every shot scores 4 or more except the day-summary "want to play" line, carried to M4 polish.

## M2: full systems

### Round 1 (integrator review of phase 1)

| Shot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Notes and fixes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| journal-fish | 5 | 4 | 5 | - | 5 | 5 | 5 | 4 | Notebook with paper tabs, rose stamps, "???" silhouettes with hints, rarity stars: the spine of the game reads. Fix: the page counter sat under the previous-page button (moved left). |
| moment-rainbow | 5 | 4 | 5 | 4 | 5 | 4 | 5 | 5 | Soft six-band arc over the ridges with the handwritten banner at dawn. Fix: "over the Manjukere" became "over Manjukere" (proper noun; the same article dropped from the legend and album lines). |

### Round 2 (phase 2, integrator review)

| Shot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Notes and fixes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| companion-peek | 5 | 5 | 5 | 4 | 3 | 4 | 5 | 5 | Puttu's ears and huge eyes above the jamun thicket at dusk with the "Something is peeking..." toast: charming. Fail on line 5: a green-and-black checker strip on the tent is Phaser's missing-texture pattern, from the half-finished decor mode (Mango-Leaf Toran placed before its texture existed). Carried to the decor-finish round. |

### Round 3 (decor, mystery, album; integrator review)

| Shot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Notes and fixes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| decorated-camp-night | 5 | 4 | 5 | 4 | 5 | 4 | 5 | 5 | Paper lantern glowing by the dome, mango-leaf toran on the tent, menu button under the day label. The missing-texture strip is gone. Pass. |
| decor-mode | 4 | 4 | 5 | - | 5 | 5 | 5 | 4 | Toast, tray (hibiscus, chime) and Done read; snap rings show only while dragging. Pass. |
| legend (shop) | 5 | 4 | 5 | - | 5 | 5 | 5 | 4 | "Oh my. Where did you find this scale?" with Tap to continue; cowrie icons in the shop now. Pass. |
| album-postcard | 4 | 4 | 5 | - | 4 | 5 | 5 | 4 | Scrapbook grid page, washi tape, the Mallige Falls postcard and the two trip buttons. Nit: the dotted stamp outline on the postcard reads as a placeholder; soften in M4. |
| finale-rise / finale-moonbow (round 1) | 4 | 3 | 5 | 4 | 5 | 4 | 5 | 4 | At 0.64 scale Bangari filled the right half like a yellow wall with her tail off-screen. Fix: scale 0.5, and the finale camera leaves the hero and pans toward her so the whole body and tail are in frame; the phone frame already reads beautifully (fairy lights, fire, moonbow, whole guardian). Re-shoot. |
| finale-moonbow (round 2) | 5 | 4 | 5 | 4 | 5 | 4 | 5 | 5 | Whole guardian with her lavender tail at the jetty, fireflies swirling, the moonbow over the ridges, Chikki blissful with the glowing kadubu plate. Pass. |

**M2/M3 verdict:** journal, weather, moments, tiers, companion, decor, mystery, finale, album, free play and settings are in; every shot scores 4 or more except the postcard's "placeholder" line, carried to M4 polish.

## M4: polish and ship (final shot list, `npm run shots m4`)

| Shot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title | 5 | 4 | 5 | 4 | 5 | 4 | 4 | 4 | Dusk camp, fireflies, glowing logo, curled-up Chikki; tent-spot markers hidden. |
| intro | 4 | 4 | 5 | - | 5 | 5 | 5 | 4 | Three storybook cards with painted vignettes. |
| shop | 4 | 4 | 5 | - | 5 | 5 | 5 | 4 | Cowrie icons, dome icon, leaf tags on essentials. |
| camp-dawn / day / golden / dusk / night / rain | 5 | 4 | 5 | 4 | 5 | 4 | 5 | 4 | All six keys read; fireflies at dusk and night; rain cooler with streaks and rings. Nit kept for later: the laterite gatepost reads pale under the shop lantern glow at dusk. |
| fishing-bite | 5 | 4 | 5 | 4 | 5 | 4 | 5 | 5 | Chikki on the jetty with the rod, the "!" and bobber, bait pill, cormorant on a snag, far coracle. (`?bite=1` now fires on a wall-clock timer.) |
| catch-card | 5 | 5 | 5 | - | 5 | 5 | 5 | 5 | Pebble Danio, size, stars, Keep / Let go over the dimmed camp. |
| cooking-result | 4 | 4 | 5 | - | 5 | 4 | 5 | 4 | NEW RECIPE ribbon, dish icon with sparkles, Eat / Save; the toast briefly overlaps the cookware row. |
| decorated-camp-night | 5 | 4 | 5 | 4 | 5 | 4 | 5 | 5 | Lantern glow by the dome, toran, fairy lights. |
| journal-fish | 5 | 4 | 5 | - | 5 | 5 | 5 | 4 | Counter no longer hidden. |
| mystery-finale | 5 | 4 | 5 | 4 | 5 | 4 | 5 | 5 | Whole guardian at the jetty, fireflies, moonbow. |
| album-postcard | 4 | 4 | 5 | - | 5 | 5 | 5 | 4 | Stamp placeholder replaced. |

**M4 verdict:** every final screenshot scores 4 or more on all applicable rubric lines at iPad and phone sizes. `npm run smoke` (Day 1 + reload) and `npm run trip` (Days 1-7, album, free play on Day 8, new trip keeping the journal) pass with no console errors. Not done: the Vercel deploy (no credentials in this environment; see HANDOFF.md).
