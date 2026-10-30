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
