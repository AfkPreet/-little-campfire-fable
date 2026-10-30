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
