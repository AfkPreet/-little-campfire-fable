# Little Monsoon: Art Bible

The visual spec every piece of code art is built against. It extends spec section 8 (`docs/BUILD_PROMPT.md`) and never contradicts it. Numbers here are logical pixels at 1x (the pipeline paints at 2x).

## 0. Locked foundations (from the spec)

- Side-view storybook. Flat vector shapes, soft gradients, rounded silhouettes, no sharp corners. Outlines are a darker shade of the fill at 2-3 px, never black. Depth and mood come from color, mist and glow, not black shadows.
- Base palette and lighting keys live in `src/config/palette.ts`; nothing else may hold a hex. Rain blends 40% toward `#9AA6B8` and desaturates 30%.
- Never: pure black or white, neon, harsh red, gray drop shadows, hard-edged boxes, emoji as art, placeholder rectangles, photos, copied characters or logos.
- Touchstones (style only): Alto's Odyssey for parallax and atmosphere, A Short Hike for pacing, Sumikko Gurashi for soft character simplicity.

## 1. The world

**Title:** Little Monsoon. Subtitle: "a tiny camping trip".

**Place:** Nerale Thota, the jamun-grove clearing on **Manjukere** (Mist Lake), a reservoir backwater on a coffee estate in Kodagu, in the Western Ghats of Karnataka, about five hours west of Bengaluru. The water is a drowned valley arm: still, teal-green, with pale dead-tree snags standing in the shallows and a short bamboo jetty with a tethered coracle. A laterite path climbs left to the estate gate and Doddamma's one-room shop. The teased next campsite is **Mallige Falls**.

**Season:** one soft "first rains" fortnight. Coffee blossom, jamun fruit, pre-monsoon fireflies and the first long rains all happen at once; nobody should try to make the weather table seasonally exact.

**Cuisine:** "Malnad estate cooking" (akki otti, kadubu, saaru, payasa, huggi, ganji, meen fry, kaapi). Every Kannada dish name carries a one-line English flavor text. Deity names stay out of the game entirely.

**Currency:** cowries (kavade). Icon: a cream shell with a soft rose lip, two shapes, readable at 24 px. Prices print as a number beside the shell icon; in prose, "120 cowries". The code symbol stays `c`.

**Lead instrument:** venu (bamboo flute) in its low, breathy register over felt piano. The fallback score's plucks are voiced veena-like, and the flute goes quiet at night.

**Sounds of the place:** the Malabar whistling thrush's long gliding whistle at dawn, bamboo creaking in gusts, rain in long steady sheets (a sound to sleep to), crickets, water lapping at the snags.

## 2. Accent colors (added to `palette.ts` as `ACCENTS`)

All at or under 40% HSB saturation.

| Token | Hex | HSB sat | Use |
| --- | --- | --- | --- |
| laterite | #C99886 | 33% | Red-earth path, fire-ring stones, coracle rim, clay pot, estate wall blocks. Darkens to deep rust in rain. Never brighter than this. |
| reservoir | #8FB5B0 | 21% | The teal-green water by day, lily pads, the Monsoon Loach's bands, the kettle. Separates water from the powder sky. |
| marigold | #DFBE8F | 36% | Doddamma's shawl, marigold garlands, jackfruit flesh, kaapi froth, Honey Whisker, the guardian's hump scales. |
| jamun | #9A7F9F | 20% | Jamun berries and purple path stains, Jamun Sharbat and Payasa, the Firefly Catfish, dusk shadow under the jamun tree. |

Derived colors (computed, never hard-coded): squirrel fur = `mix(bark, cream, 0.3)`; buffalo hide = `mix(ink, lavender, 0.55)`; bamboo culm = `mix(butter, sage, 0.45)`; wet laterite = `shade(laterite, -0.25)`.

## 3. Layer plan (the Camp scene)

Logical height 720. World width **2600** (about 2.5 iPad screens). The camera follows the hero with soft easing and clamps to the world. Everything below is in world units; y grows downward.

| Band | Scroll | y range | Contents | Paint and tint |
| --- | --- | --- | --- | --- |
| Sky | 0 | 0-420 (sky meets the far shoreline at y 420; ridges sit on it from y 170) | Lighting-key gradient (a painted 4x256 texture stretched, repainted when the lighting changes). Soft sun or crescent moon with bloom, 2-3 rounded clouds drifting at 0.03, stars from dusk, 2-3 egret V-shapes by day. | Exact key colors. Clouds cream at 70% alpha tinted toward the horizon. |
| Far ridges | 0.08 / 0.10 / 0.13 | 170-320 | Three stacked, rounded hump-chains of the Ghats (crest tops near y 190, 235, 280; humps 46-68 px tall); the highest carries bare grass domes (shola country). A slow mist band slides between chains 2 and 3. | **White-painted**: painted in cream/near-white and tinted with `lighting.far`, `lighting.ridgeMid`, `lighting.mid` so atmospheric perspective comes from the tint. Chain 1 lightest. |
| Estate slope | 0.25 | 290-420 | The coffee estate as a real middle ground: three loose rows of round coffee bushes with earth paths, 8-10 silver oaks that read at this scale (trunk 3-4 px, 70-90 px tall, feathery crown, one zigzag pepper vine), a clump of areca palms with starburst crowns, a small homestay whose window glows at night, the far shoreline at y 420. A second thin mist band at its base. | White-painted silhouette tinted with `lighting.estate`; darker values baked in for trunks and bush shading. |
| Water | 1 (surface) | 420-600 | The lake surface behind the clearing: the lowest ridge chain and the estate mirrored (flipped, squashed to 60%, alpha ~0.3) with a gentle horizontal ripple, sun or moon path, raindrop rings in rain, 3 lily-pad clusters near the shore, a far coracle fisher drifting by day. | Base = `reservoir` by day, tinted by `lighting.waterTint`; the reflection is a flipped, squashed copy of the bands at low alpha. |
| Shallows | 0.5 | 450-600 | 6 pale drowned snags 90-150 px tall with stubby limbs standing in the water (one with a cormorant drying its wings by day), reed clumps, a wisp of mist. | Snags in `mix(cream, lavender, 0.4)` outlined; tinted with `lighting.nearTint`. |
| Clearing | 1 | 560-720 | Grass bank, surface at **y 600**. Laterite path arriving from off-left, the fire ring, 3 tent spots, 7 forage spots, the big jamun tree and bamboo clump, the jackfruit tree, the shore, the jetty, the coracle, the moon-lily rock pool. Hero, tent, decor, fire and companion live here. | Full palette. Tinted with `lighting.groundTint` (props and characters with `charTint`). Firelight pool warms everything within ~260 px of the fire at night. |
| Fringe | 1.3 | 640-720 | Thin lemongrass blades and delicate paired-leaflet fern fronds, a few fallen jamun, coffee-blossom petals drifting by day, drips in rain. Blades sway with per-blade phase and partly overlap the hero's feet; clusters fade out past the bank end so they never cover open water. The bank's laterite earth face is only y 640-676, lightened with cream, under an overhanging grass lip. | `shade(moss, -0.1)` at 85% alpha with soft edges; tinted with `lighting.fgTint`. |

**Clearing layout (x in world units, ground y 600):**

| x | Thing |
| --- | --- |
| 0-220 | Laterite path climbing off-left to the estate gate; a laterite-block gatepost at 160 with a mango-leaf toran. Tapping the path edge (x < 120) heads to the shop. |
| 300 | Giant bamboo clump: 5-7 culms arching right over the water, sparse leaf tufts, top at y 120. Creaks in gusts. |
| 420 | Jamun thicket 1 (berry forage; companion peek spot). |
| 560 / 760 / 960 | The three tent spots (dotted outlines). |
| 640 | Fallen silver-oak mushroom log 1. |
| 1180 | Fire ring of laterite stones, fire center at (1180, 588). The floor cushion sits at 1110, the bookshelf at 1260. |
| 1250 | The big round jamun tree behind the fire: crown about 420 px wide of 4-5 soft cloud lobes, top at y 190, jamun dots only on the lower lobes, a thick trunk with a visible lowest branch. Fireflies rise from its crown at dusk. Hang points on the lowest branch (see `world/layout.ts`). |
| 1320 | Lemongrass herb patch. |
| 1400 | Jamun thicket 2 (berry forage; companion peek spot). |
| 1425 | Hammock two-tree point (between the jamun tree and the jackfruit tree). |
| 1500 | Mushroom log 2. |
| 1600 | Jackfruit tree (nut forage), two or three fruit hanging low; trunk at 1600, crown top y 230. |
| 1720 | Shore: the bank slopes down to the water at y 615. The moon-lily rock pool at (1760, 612), night only after clue 3. |
| 1820-2080 | Bamboo jetty, deck at y 592, 4 posts into the water. Fishing happens here; the companion sits at its base. |
| 2130 | The coracle, tethered to the last post, bobbing slowly. |
| 2080-2600 | Open water: the fishing tap zone is any water point with x > 1740 and y between 400 and 600, plus the band directly beside the jetty. |

Ground decor points (Potted Hibiscus, Cushion, Rug, Bookshelf, Telescope): a ring of 6 points around the fire and tent spots at y 600. Hang points: 2 on the tent (Teak-Leaf), 4 (Monsoon Dome), 6 (Little Homestay), plus the two jamun branches; Fairy Lights span any two hang points.

## 4. Lighting

`src/world/lighting.ts` produces one `Lighting` per frame from `dayT` (0 first light, 1 full night) and weather. Scenes never pick colors by time themselves.

- White-painted bands (far ridges, estate slope) get `setTint(far | mid)`.
- Real-colored layers get multiply tints: `nearTint` (shallows), `groundTint` (clearing), `fgTint` (fringe), `charTint` (hero, companion, props), `waterTint`.
- Mist: two drifting cream-lavender bands (alpha from `lighting.mist`), one between ridges 2-3, one at the estate base. In a misty morning they rise to swallow the estate slope, then burn off from the top down by midday.
- Night: never black. Firelight pool (additive radial, flicker) at the fire; lantern pools; a soft moon path on the water; 20-40 fireflies in the bamboo and jamun; a subtle vignette at `lighting.vignette`.
- Golden hour: a warm rim-light line on bamboo culms and the jamun crown (a butter stroke at 50% alpha baked into a second "rim" texture that fades in with `lighting.warmth` by day and `lighting.sun`).
- Rain: all colors through `rainify`, thicker mist, drips off bamboo leaves and the tent edge, rings on the water, laterite to deep rust, tent window glows.

## 5. Character sheets

All characters: kawaii proportions (head at least as big as the body), bean or round silhouette, stubby limbs, big ink oval eyes with 1-2 cream highlight dots, tiny mouth, blush ovals at 60% alpha, no realistic nose. Built from separate parts (textures) in a Container so each animates alone. Expressions: neutral, happy, blissful, surprised, sleepy, munching. Idle: breathing scaleY 1.00-1.03 on a 2.4 s sine, blinks every 2-5 s, ear or tail flick, eyes glance toward nearby interactables, plus the quirk. Walk: hop-walk with a 4-6 px bob, squash 0.92/1.06 on landing, dust puffs.

### Chikki, the hero (Indian palm squirrel)

- **Size:** 100 px tall standing (head 54, body 46), tail adds 40 px behind and above. Readable at 90 px.
- **Fur:** `mix(bark, cream, 0.3)` (warm tan, never rat-grey). Belly, muzzle and stripes: `cream`. Ear inners: `peach`. Nose: a `peach` dot. Outline: `outline(fur)`.
- **Head:** a wide rounded oval, slightly flattened; two small round ears set wide; three cream stripes run from the crown back over the body to the tail base, 3 px wide, 4 px apart. Eyes 9x11 ink ovals with two cream highlights; blush ovals 10x6.
- **Body:** a soft bean, cream belly patch. A small jute sling bag in `bark` across the chest (it is the basket icon too). Stubby arms with rounded paws; two little feet.
- **Tail:** 40% of the silhouette. A fat crescent of fur with a cream underside and five rounded tufts along the outer edge. Two textures: `tail-straight` and `tail-curl` (a "?" shape over the head).
- **Quirk, the curious tail:** in idle the tail slowly curls up over the head into a "?" (crossfade straight to curl over 900 ms, Sine.easeInOut), holds a beat, then flicks straight on the next blink. When an interactable is within 160 px the curl leans toward it.
- **Expressions:** neutral (eyes open, small smile), happy (closed arc eyes, open smile), blissful (closed eyes, bigger blush, floating hearts), surprised (round eyes, small "o" mouth; on a bite), sleepy (half-lidded, slow blink, at night), munching (cheeks puff while holding a jack seed in both paws).
- **Tier looks:** cozy = neutral; content = happy; glowing = happy with occasional sparkle; blissful = blissful with hearts.

### Doddamma, the shopkeeper (old water buffalo)

- Fills the counter frame: head and shoulders 320 px wide. Hide `mix(ink, lavender, 0.55)`; muzzle and chest blaze `cream`; sweeping crescent horns in `bark` fading to `cream` tips, a short jasmine string of cream dots looped on the left horn; half-moon spectacles with `bark` rims on a string; a `marigold` shawl over the shoulders; small ears that flick; big half-lidded ink eyes with cream highlights, slow blink every 4 s; soft blush.
- Idle: chews slowly (jaw part moves 2 px on a 1.6 s sine), nods once when you buy, ears go up when it rains.
- Voice: grandmotherly, calls the hero "putta". Ten greetings are in `src/data/dialogue.ts`.

### Puttu, the companion (Indian spotted chevrotain)

- 64 px tall. Tiny bean body in `bark`, rows of cream spots along the back and three short cream stripes on each flank, cream belly, no antlers; large round ears with peach inners; very big ink eyes with two highlights (the face is mostly eyes); slender stubby legs with tiny bark hooves; a nub tail.
- Peeking: only ears and eyes rise above the jamun thicket leaves, blink twice, sink back.
- Befriended: follows one step behind Chikki, sits on the jetty base with legs tucked, sleeps curled against the fire-ring stones, hoof-shuffle wiggle when Chikki eats.
- Must never look like Chikki at 60 px: spots not stripes on the back, ears up not round-flat, no tail.

### Bangari, the guardian (ancient humpback mahseer)

- Vast, round, slow: 900 px long when risen, filling the water from the jetty to the snags. Belly `glow` graded through `butter` to `marigold` along the hump; big round scales in a 5x3 grid, each outlined in a warmer shade and lit like paper lanterns (slow alpha pulse, 4 s); a high gentle hump behind the head; a wide calm closed mouth curving into a faint smile; two long soft barbels drifting like ribbons; sleepy half-closed ink eyes that blink once every 6 s; large translucent lotus-petal fins in `lavender` at 40% alpha; a soft bloom halo; a few bubbles rising from the hump. Never shows teeth, never opens the eyes fully, never shown caught.
- Her glow is what breathes far out on the water on the first night (a soft glow disc at the far snags, alpha 0.2-0.5 on a 3 s sine).

## 6. Props

- **Tents:** Teak-Leaf Tent (a simple A-frame in `sage` with a `cream` door flap, 2 hang points), Monsoon Dome (a round dome in `powder`-tinted cream with a `laterite` rim and a small window that glows at night, 4 hang points), Little Homestay Kit (a tiny red-tiled cabin in cream laterite blocks with a lit window at night, 6 hang points). All built from parts: floor sheet, poles, canopy, door, pegs, so the pitch animation (unfold flat, four pegs glow, spring up with squash) works for every tier.
- **Fire ring:** laterite stones in a ring, logs in `bark`, flame layers in `ember` and `glow` (three flickering teardrops at different phases), embers and a firelight pool at night.
- **Jetty and coracle:** bamboo deck planks in `mix(butter, sage, 0.45)` with `bark` posts; the coracle a round bowl with a `laterite` rim and woven lines, bobbing 3 px on a 2.8 s sine.
- **Forage spots:** jamun thickets (round bushes with purple dots), fallen silver-oak logs with small mushrooms, a lemongrass patch (tall blades), the jackfruit tree (rough bark trunk, big oval fruit), the moon-lily rock pool (a few stones, one glowing white lily at night).
- **Fishing:** a slim bamboo or cane rod held in the paws, a cream-and-rose bobber, a line drawn as a 1.5 px ink-alpha curve, bite rings.
- **Basket:** the jute sling bag; forage items arc into it with a sparkle trail.
- **Decor (11):** Potted Hibiscus (nods), Paper Lantern (sways; warm pool at night), Floor Cushion, Mango-Leaf Toran (flutters), Bamboo Chime (tinkles), Jamkhana Rug (warms at night), Fairy Lights (twinkle), Little Bookshelf, Hammock (naps), Star Telescope, Guardian Lantern (never goes out).
- **Shop:** exterior as a stilt-free one-room estate angadi: cream-washed laterite-block walls, red-tiled roof patched with tin, mango-leaf toran over the door, a bench under a jackfruit tree, a lantern under the awning at night. Interior view: a teak counter, jars of chikki and dried mushrooms, sacks of red rice, honey bottles, a rack of rods, a stack of bamboo steamers, Doddamma behind the counter.

## 7. UI kit

- Cards: cream, radius 20, outline a darker cream shade, soft ink shadow (blur 12, y 4, alpha 0.15) baked into the texture margins, faint paper grain. Buttons: primary `rose` with cream text, secondary cream with ink text, disabled desaturated with a wobble; all 44 px or taller; squish on press.
- Fonts: Baloo 2 (UI), Patrick Hand (journal, banners, catch-card names).
- HUD icons: cowrie shell (money), sun/moon (clock), a small paper lantern (Contentment: its glow grows with the tier; never a number), jute bag (backpack), notebook (journal). Rarity as stars.
- Toasts: a cream pill at top-center, 2.5 s. Action bubbles: speech bubbles with a tail and pill buttons.
- Journal: a hand-drawn notebook with page turns, paper grain, hand font, "???" silhouettes with hints, 36 stamps on the cover.

## 8. Composition and camera

- The hero stands on the lower third (feet at y 600). The top 40% of the frame is sky and ridges. At most 3 interactables glow at once, and only when the hero is within 180 px (a soft breathing outline).
- Camera: follows the hero with lerp 0.08 (no easing under Reduce motion), clamped to the world; width flexes with the aspect ratio so wide screens simply see more world.
- Every touch target is 44 px or larger; nothing is hover-only.

## 9. Screens

- **Title:** the live camp at dusk: fire lit, fireflies rising from the jamun, Chikki dozing against the tent. Logo "Little Monsoon" in Baloo 2 700 with a soft glow, subtitle in Patrick Hand.
- **Intro:** three storybook pages on cream cards with small painted vignettes (Chikki with a cowrie jar; the lake; the shop door).
- **Shop:** interior view with Doddamma behind the counter on the left third; tabs and item cards on the right; the greeting in a speech bubble.
- **Camp:** the world above.
- **Cooking:** a close-up of the fire with the chosen cookware; the basket tray at the bottom; steam and sizzle.
- **Journal:** full-screen notebook; tabs as paper tabs on the right edge.
- **Trip Album:** scrapbook pages with a Contentment bloom (a flower whose petals open with the day's peak), polaroid-style cards, and a postcard of Mallige Falls.

## 10. Risks the art must handle

- Chikki could read as a mouse or rat: keep the tail at 40% of the silhouette, stripes cream not grey, fur warm tan; test at 90 px beside Puttu.
- Laterite sits near harsh red: never brighter than #C99886.
- Reservoir teal must separate from the powder sky at every key, especially dusk and rain.
- At scroll 0.25, silver oak with pepper vine, snags and areca crowns must simplify to trunk-plus-zigzag, pale posts and starbursts.
- Draw bamboo, silver oak, snags and the coracle first; cut areca and tree fern first if time runs short.
