# Little Campfire: Claude Code Build Prompt

Oct 30, 2026 · @Preet

## 1. Your role and working rules

You are building **Little Campfire** (working title): a serene, kawaii 2D camping game for the browser, touch-first. This prompt is the output of my pre-build interview, so treat it as the locked spec and do not re-interview me.

- **Autonomy:** build end to end through the milestones in section 11. Make reasonable calls yourself and log each in `DECISIONS.md`. Stop and ask only when blocked by something only I can do, such as a Vercel login.
- **Beauty first:** visual quality is the top priority. Write no gameplay code until the M0 style board passes your own screenshot review (section 11).
- **You invent the world:** setting, hero, companion, shopkeeper, guardian, final title and currency are yours to design at M0, within sections 4 and 8.
- **Files you maintain:**
  - `ART_BIBLE.md`: the visual spec you write at M0 and build against.
  - `DECISIONS.md`: every decision as chosen / rejected / why. Seed it with section 2.
  - `REVIEW.md`: screenshot rubric scores and fixes per milestone.
  - `MUSIC_BRIEF.md`: prompts for the music files I will generate (section 9).
  - `HANDOFF.md`: written last; lets a fresh session resume weeks later.
- **Environment:** I run Claude Code on Windows, later also macOS. Keep every script cross-platform (npm scripts, no bash-only commands).
- **If time or context runs short,** cut in this order: rare moments, companion, decor variety. Never cut visual polish, the journal or the mystery.

## 2. Locked decisions

These were settled in the interview. Build on them; do not revisit them.

| Area | Chosen | Rejected | Why |
| --- | --- | --- | --- |
| Genre | Cozy camping sim | Survival with hunger and warmth meters | Threat kills the serene feel; the hook is curiosity instead |
| Pressure | One positive-only Contentment level, no fail state | Soft or real survival stakes | Satisfaction should only rise; nothing punishes |
| Look | 2D side-view storybook, layered parallax | 3D diorama, 2D top-down, pixel art | Most reliably gorgeous from pure code; the others need hand-made art or are risky in one pass |
| Art source | 100% drawn in code | AI-generated sprites and backgrounds | Code art can bounce, blink and relight for dawn, night and rain; generated art cannot, and its style drifts |
| Palette | Muted pastels | Bright candy pastels, warm picture-book | Serene first, cute second; relights beautifully |
| World | You invent the setting, hero critter and cast | A fixed setting | My call: you design one coherent world, then lock it in `ART_BIBLE.md` |
| Food | Fishing and foraging | Hunting, traps, gardening | Eating cute critters breaks kawaii; gardening adds scope |
| Feel | Gentle tap-timing fishing; drag-and-stir recipe discovery | Skill minigames, idle auto-play | Engaging without stress |
| Shelter | Pitch a tent, then decorate | Build from parts, one-tap tent | A satisfying setup plus self-expression |
| Structure | 7-day trip on a soft clock, then optional free play | Endless sandbox, several campsites in v1 | A clear arc without 3x the art |
| Economy | Starting budget; sell extras to earn | Fixed budget only, daily allowance | Creates the core loop |
| Hooks | Journal and mystery at full depth; companion and rare moments light, triggered by Contentment | All four at full depth | Four separate systems would thin out polish; the journal is the one spine |
| Sound | Lo-fi plus nature. Music: files I generate in Higgsfield. SFX, ambience and a fallback score in code | All-code music, no music | Music is code's weak spot; the game must still sound complete without the files |
| Platform | Browser, touch-first, landscape | Keyboard-first, phone portrait | Mostly played on iPad; mouse still works |
| Build | Autonomous milestones with screenshot self-review | Pausing for my review, one straight pass | Self-critique is where the visual quality comes from |
| Ship | Vercel | Local only, Higgsfield community | A shareable link that opens on iPad |

## 3. The game on one page

**Pitch:** a tiny critter takes a 7-day camping trip on a small budget: shop for gear, pitch a cozy tent, fish and forage, cook by the fire, and slowly uncover the gentle guardian that glows in the water on rainy nights.

**Pillars** (every feature serves at least one; cut what serves none):

1. **Serene:** no rushing timers, no fail states, no harsh sounds or colors. Rain on the tent should feel like a reward.
2. **Kawaii:** round, soft, bouncy. Everything reacts to touch with squash, sparkle and a cute sound.
3. **Curious:** there is always a "?" to fill: an unseen fish, an undiscovered recipe, the next mystery clue.

**Core loop, one in-game day:**

1. Dawn: wake up, weather revealed, forage spots refreshed.
2. Shop (optional): buy gear, staples and decor; sell spare fish and dishes.
3. Camp: pitch or decorate the tent, forage around the clearing.
4. Water: fish; species change with time of day and weather.
5. Fire: cook ingredients into dishes; eat, save or sell them.
6. Night: fireflies, stars or rain; sit by the fire; choose when to sleep.
7. Sleep: a day summary card, then the next dawn.

**Session shape:** dawn to dusk takes about 8 real minutes in the world; night lasts until the player chooses to sleep. Days 1 to 7 make one trip, about an hour. After Day 7 the Trip Album plays, then free play continues.

**Contentment** is the only meter. It rises from cozy acts, never drains, and starts each dawn from a baseline set by how comfy the camp is. It shows as the hero's expression and a small glowing lantern in the HUD, never as a number. Its tiers unlock good things (section 5).

## 4. World and characters (you invent these at M0)

Design one coherent world before any gameplay, write it into `ART_BIBLE.md`, and log each choice in `DECISIONS.md` with 2 rejected alternatives.

**Setting rules:**

- A real-feeling natural place with a body of water (lake, river bend or cove), a camp clearing and a path to a small shop.
- It must layer beautifully in side view: at least 4 depth bands (far ridges, mid hills or forest, near trees, ground) with mist between them.
- It must look lovely at dawn, day, golden hour, dusk, night and in rain.
- Specific beats generic. A distinctive regional flavor (food, objects, a lead music instrument) is welcome; keep it respectful and grounded in real details.
- Name the place, the water and the next campsite (for the end-of-trip teaser).

**Cast** (all original; none may resemble an existing character):

| Role | Rules |
| --- | --- |
| Hero | A small round animal native to, or plausible in, the setting. Kawaii proportions (section 8). Readable at 90-120 px tall. A name plus one personality quirk shown in idle animations. |
| Shopkeeper | A larger, older, gentle animal behind the counter. 8-10 warm one-line greetings and tips. |
| Companion | A shy small creature, a different species from the hero. Peeks from bushes before it is befriended. |
| Guardian | A huge, soft, glowing water spirit, fish- or whale-like. Calm, round, slow-blinking. Never caught or eaten: it is met. |

**Naming:** pick the final title (2-3 words, cozy, easy to say; check it is not an existing well-known game), a cute in-world currency that fits the setting (rupees are fine if the setting is Indian), and names for every fish, forage item and dish. Reskin the tables in section 6 to the setting's flavor but keep their numbers.

## 5. Systems

### Time and weather

- Dawn → day → golden hour → dusk → night. Dawn to dusk takes about 8 real minutes in the world and pauses in menus, the shop, the journal and cooking.
- Night holds until the player sleeps. No forced bedtime, no penalty for staying up.
- Weather is rolled at dawn and lasts through the night: Clear 50%, Light rain 30%, Misty morning 15% (mist burns off by midday), Golden evening 5%. Rain may gently start or stop mid-day (10% per day).
- Guarantees: Day 1 is Clear. If no rainy night has happened by Day 4, Night 4 rains. The mystery has its own guarantee (below).

### Contentment

- A hidden 0-100 value. Each dawn it starts at a baseline of 10 + tent bonus + 2 per placed decor item, capped at 40. It never goes down during a day.
- Gains: eating a dish (its value in section 6), a new fish species +10, a new recipe +8, first placement of a decor item +5, releasing a fish +2, sitting by the fire at night +1 per 10 s (max +10 a night), resting in the tent doorway while it rains +1 per 10 s (max +10 a day), sharing a dish with the companion +6, a rare moment +8.
- Tiers: 0-39 cozy, 40-69 content, 70-99 glowing, 100 blissful. Each tier changes the hero's expression and idle.
- Unlocks: content lets the companion appear; glowing is needed for the mystery finale; blissful guarantees that night's rare moment (a shooting star if clear, a moonbow if rainy).

### Shop and economy

- Start with 120c. Tabs: Camp, Fishing, Kitchen, Pantry, Cozy, Sell. Prices are fixed.
- Day 1: the shopkeeper tags 3 essentials (a tent, a rod, one cookware). They cost about 80-95c, leaving 25-40c for bait, staples or a lantern: a small, pleasant packing puzzle.
- Leaving without an essential asks once. Nobody can get stuck: forage items sell and regrow daily, and sleeping without a tent is allowed (under the stars, tent bonus +0).
- Fish, forage and dishes sell at listed prices. Dishes are worth more than their raw ingredients, so cooking pays.
- The Bamboo Steamer and the Moon Blossom spot unlock after mystery clue 3.

### Shelter and decor

- At camp, 3 flat spots glow as soft dotted outlines. Tap one: the tent unfolds flat and 4 pegs glow.
- Tap each peg: a "tok", a star pop, a tiny nudge. After the 4th, the tent springs up with squash and stretch and a jingle.
- Tapping the tent offers Rest (sit in the doorway) and, at night, Sleep. Buying a bigger tent swaps it in place.
- Decor mode: drag items from the backpack to snap points. Hang points sit on the tent and branches, ground points ring the clearing, and the hammock needs the two-tree point. Tap a placed item to move or store it.
- Everything placed animates: lanterns sway, flags flutter, chimes tinkle in gusts.

### Fishing

1. Tap the water within reach of the dock or shore. The hero casts in a soft arc; the bobber lands with rings.
2. Wait 3-10 s (Wiggly Bait shortens it by 40%). 0-2 fake nibbles twitch the bobber, with no penalty.
3. Bite: the bobber dips, a "!" pops and a ring flashes. Tap anywhere within the window: 1.4 s base, 1.9 s with the Willow or Moonlight Rod.
4. Hit: an automatic reel (1.2 s), then a catch card with name, size in cm, rarity stars and a "NEW!" ribbon if first. Choose Keep, or Let go (+2 Contentment; little hearts as it swims off).
5. Miss: the fish flicks its tail and swims away. No penalty.

Bite table: among fish in season right now, weight common 60, uncommon 30, rare 10. The Moonlight Rod doubles rare; Sparkle Bait triples it. The Golden Whisker is a separate 1% roll on every bite. When a fish that needs a better rod is in season, show the rod hint after 3 casts.

### Foraging

- 7 spots around the clearing: 2 berry bushes, 2 mushroom logs, 1 herb patch, 1 nut tree, and a night-only Moon Blossom spot on the shore (after clue 3).
- Tap a spot: the hero walks over and picks with a hop; 1-3 items arc into the basket icon with a sparkle trail. Spots regrow overnight.

### Cooking

- Tap the fire (at night it offers Cook or Sit). The cooking view is a close-up of the fire; pick one owned cookware.
- Drag 1-3 ingredients from the basket tray into it. Stir by circling a finger twice, or hold 1.5 s with Reduce motion on.
- Steam, bubbles and a sizzle for about 2.5 s; then the dish pops onto a plate with sparkles and its name. First time: a "NEW RECIPE!" ribbon and a journal stamp.
- Matching: the cookware plus the exact ingredient set, order ignored. "Any fish" accepts any species.
- A combination that matches nothing makes Mystery Mush (sells for 2c, +3 Contentment, a funny face). It is not a recipe.
- Then choose Eat, Save, or Share (when the companion is near).

### Journal (the spine)

- A hand-drawn notebook with page turns. Tabs: Fish (8), Recipes (16), Moments (6), Friends (1), Mystery (5 clues), Trip (a page per day).
- Undiscovered entries are soft silhouettes with "???" and a one-line hint. 36 stamps in total; the cover shows progress.
- Badges: Happy Camper at 20 stamps; Guardian Friend for finishing the mystery.

### Companion (light)

- When Contentment is content (40+) at dusk or night and the player holds a dish, the companion's eyes peek and blink from a bush. Tapping it makes it hide.
- Sharing a dish while it is near counts as one visit. Shares on 3 different days befriend it.
- Then it follows the hero around camp, sleeps by the fire, sits on the dock while fishing and wiggles when the hero eats. Friends tab: 3 hearts.

### Rare moments (light)

Checked at dawn and at night (table in section 6). Each plays a soft chime, shows a handwritten banner, adds a journal stamp and gives +8 Contentment.

### Mystery (full depth): the guardian in the water

1. First night: a faint glow drifts far out on the water for about 6 s while the hero is outside. Journal: "A soft glow, far out on the water. The moon? It moved like it was breathing."
2. The dawn after the first rainy night, a sparkle on the shore: the Glimmering Scale. Journal: "A scale, warm to the touch. Too big for any fish I know."
3. Entering the shop with the scale triggers the legend (section 7) and a recipe card. The Bamboo Steamer and Moon Blossom spot unlock. Journal: "The guardian rises on rainy nights for someone truly content. It's fond of Moonlight Dumplings."
4. Cook Moonlight Dumplings: steamer + Flour + Moon Blossom + Night Glowfin. Journal: "Moonlight Dumplings. They glow a little."
5. On a rainy night with Contentment glowing (70+), carry the dumplings to the dock and a "Leave an offering" bubble appears. The finale runs about 45 s (skippable on replays): the rain softens, the glow grows, and the guardian rises, slow-blinks, nuzzles the dock and eats with a happy rumble. The clouds part to stars and a moonbow; fireflies swirl. Gift: the Guardian Lantern, and the next campsite appears on the Trip Album map. Journal: "I met the guardian. I think it said thank you."

Guarantee: once step 4 is done, the next night rains. If unfinished by Day 7, the mystery carries into free play.

### Trip end

- After sleeping on Night 7, the Trip Album opens: a scrapbook page per day (the Contentment bloom shows that day's peak), best catch, most-cooked dish, moments seen, the companion's page, the mystery outcome, and a postcard teasing the next campsite.
- Buttons: Stay a little longer (free play: Day 8, 9 and on) and Start a new trip (keeps journal and badges; resets money, gear and camp).

## 6. Content tables

The numbers are balanced; keep them. Reskin names and flavor to your setting at M0 and record the mapping in `DECISIONS.md`. Prices use the in-world currency, written "c" here.

### Gear

| Item | Tab | Price | Effect |
| --- | --- | --- | --- |
| Leaf Tent | Camp | 40 | Basic shelter; tent bonus +0; 2 hang points |
| Dome Tent | Camp | 90 | Tent bonus +5; 4 hang points; rain sounds extra cozy inside |
| Little Cabin Kit | Camp | 220 | Tent bonus +10; 6 hang points; a lit window at night |
| Bamboo Rod | Fishing | 25 | Catches every fish not marked Willow Rod+ |
| Willow Rod | Fishing | 80 | Bite window 1.9 s; catches Willow Rod+ fish |
| Moonlight Rod | Fishing | 180 | Willow Rod perks; glows at night; rare fish twice as likely |
| Wiggly Bait (x5) | Fishing | 5 | Bites come 40% sooner |
| Sparkle Bait (x3) | Fishing | 15 | Rare fish 3x as likely |
| Kettle | Kitchen | 15 | Drinks |
| Clay Pot | Kitchen | 20 | Soups, porridge, pudding |
| Skillet | Kitchen | 30 | Grills, pancakes, skewers |
| Bamboo Steamer | Kitchen | 45 | Buns and dumplings; appears after mystery clue 3 |

Bait: one per cast, picked from a small toggle beside the rod while fishing (None, Wiggly, Sparkle).

### Pantry staples (1 portion each)

| Item | Price |
| --- | --- |
| Rice | 4 |
| Flour | 4 |
| Tea leaves | 5 |
| Honey | 6 |
| Spice pouch | 3 |

### Fish

| Fish | Rarity | When | Rod | Sell |
| --- | --- | --- | --- | --- |
| Pebble Minnow | Common | Any time | Any | 6 |
| Bubble Carp | Common | Any time | Any | 8 |
| Blushing Trout | Common | Day | Any | 9 |
| Dusk Perch | Uncommon | Dusk | Any | 18 |
| Rain Loach | Uncommon | Rain, any time | Any | 20 |
| Night Glowfin | Uncommon | Night | Willow Rod+ | 24 |
| Petal Koi | Rare | Misty dawn | Willow Rod+ | 45 |
| Golden Whisker | Rare | Any time, 1% per bite | Any | 60 |

"Day" means morning through golden hour. Bite weights renormalize over the fish in season. Sizes vary ±30% around each species' base; the journal keeps the best.

### Forage

| Item | Where | When | Sell |
| --- | --- | --- | --- |
| Sweet Berries | Berry bushes | Day | 2 |
| Puffcap Mushrooms | Mushroom logs | Any time; double yield after rain | 3 |
| Wild Herbs | Herb patch | Any time | 2 |
| Forest Nuts | Nut tree | Day | 3 |
| Moon Blossom | Shore spot | Night, after clue 3 | Not sellable |

### Recipes

| # | Dish | Cookware | Ingredients | Sell | Contentment | Journal hint |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Herb Tea | Kettle | Wild Herbs | 8 | +8 | Just leaves and hot water |
| 2 | Honey Tea | Kettle | Tea leaves, Honey | 14 | +10 | Golden and sweet |
| 3 | Berry Cordial | Kettle | Sweet Berries, Honey | 14 | +10 | Pink and sweet |
| 4 | Spiced Tea | Kettle | Tea leaves, Spice pouch | 12 | +12 | Warms you to the toes |
| 5 | Mushroom Soup | Clay Pot | Puffcap Mushrooms, Wild Herbs | 16 | +12 | Earthy and green |
| 6 | Fish Congee | Clay Pot | Any fish, Rice | 20 | +14 | Soft rice and something from the water |
| 7 | Campfire Stew | Clay Pot | Any fish, Puffcap Mushrooms, Wild Herbs | 30 | +18 | The woods and the water in one pot |
| 8 | Berry Rice Pudding | Clay Pot | Rice, Sweet Berries, Honey | 24 | +16 | Dessert from the pot |
| 9 | Nutty Porridge | Clay Pot | Rice, Forest Nuts, Honey | 22 | +14 | A crunchy breakfast |
| 10 | Grilled Fish | Skillet | Any fish | Fish price x1.5 | +10 | Simple and smoky |
| 11 | Herb-Butter Fish | Skillet | Any fish, Wild Herbs, Spice pouch | 30 | +16 | Fancy fish |
| 12 | Fluffy Pancakes | Skillet | Flour, Honey | 16 | +12 | Flip, flip! |
| 13 | Berry Pancakes | Skillet | Flour, Sweet Berries, Honey | 22 | +14 | Fluffy, with a pink surprise |
| 14 | Mushroom Skewers | Skillet | Puffcap Mushrooms, Spice pouch | 14 | +10 | On a stick, over the flames |
| 15 | Cloud Buns | Bamboo Steamer | Flour, Honey, Forest Nuts | 26 | +16 | Soft as a cloud |
| 16 | Moonlight Dumplings | Bamboo Steamer | Flour, Moon Blossom, Night Glowfin | Not sellable | +25 | The legend's favorite |

A dish never sells for less than 1.25x the value of its ingredients (staples count at their shop price), so a rare fish makes a pricier dish.

### Decor (Cozy tab)

| Item | Price | Placement | Behavior |
| --- | --- | --- | --- |
| Potted Flower | 10 | Ground | Nods in the wind |
| Paper Lantern | 12 | Hang | Sways; warm light pool at night |
| Floor Cushion | 12 | Ground | The hero sits on it by the fire |
| Bunting Flags | 15 | Hang | Flutter in gusts |
| Wind Chime | 18 | Hang | Tinkles in gusts |
| Woven Rug | 25 | Ground | Colors warm up at night |
| String Lights | 30 | Hang, spans two points | Twinkle at night |
| Little Bookshelf | 40 | Ground | The hero reads there at night (counts as sitting by the fire) |
| Hammock | 60 | Two-tree point | The hero naps in it (counts as sitting by the fire) |
| Star Telescope | 120 | Ground | Shooting star chance +15% |
| Guardian Lantern | Gift | Hang | Never goes out; adds +5 to the baseline instead of +2 |

### Rare moments

| Moment | Trigger | Chance |
| --- | --- | --- |
| Shooting star | Clear night | 8% a night; +15% with the telescope; always when blissful |
| Rainbow | Dawn after a rainy night | 50% |
| Firefly swirl | Clear night, after 20 s sitting by the fire | 25% |
| Misty sunrise | Misty dawn | Always, first time only |
| Golden Whisker | Catching one | 1% per bite |
| Moonbow | Rainy night when blissful | Always; also appears in the mystery finale |

## 7. Controls and UI copy

### Input (touch first; the mouse mirrors touch exactly)

- Tap the ground: walk there. Tap an interactable: walk to it. Single-action things act at once (forage); multi-action things show bubbles (fire: Cook, Sit; tent: Rest, Sleep, Decorate).
- Tap the water near the dock or shore: cast there. During a bite, tap anywhere to hook.
- Drag: ingredients into the pot; decor onto snap points.
- Stir: circle a finger twice (hold 1.5 s with Reduce motion on).
- Keyboard extras: A/D or arrow keys walk, E or Space interact, J journal, B backpack, Esc menu.
- Every touch target is at least 44 pt; no hover-only UI. Disable iOS double-tap zoom, page bounce, long-press callouts and text selection. Respect safe areas.
- Landscape only. In portrait, show a card where the hero tilts its head: "Turn your device sideways".

### HUD (minimal, rounded, paper-textured; nothing red)

- Top-left: currency icon and amount.
- Top-right: "Day 2 · Morning" with a sun or moon icon that morphs through the day. Time labels: Dawn, Morning, Afternoon, Golden hour, Dusk, Night.
- Bottom-left: the Contentment lantern, no number. Tap it: "Feeling cozy" / "Feeling content" / "Glowing" / "Blissful".
- Bottom-right: Backpack and Journal buttons.
- Action bubbles: "Fish", "Forage", "Cook", "Sit", "Rest", "Sleep", "Decorate", "Share", "Leave an offering".
- Toasts (top-center, fade after 2.5 s): "Caught a {Fish}! ({size} cm)", "New recipe: {Dish}!", "Journal updated", "It slipped away... maybe next time!"

### Screens and literal strings

- **Title:** logo "{Title}", subtitle "a tiny camping trip", buttons "Begin your trip", "Continue" (only with a save), "Settings"; footer "Best with sound on · v0.1". The background is the live camp at dusk: fire, fireflies, the hero dozing.
- **Intro** (storybook pages, tap to turn, "Skip" top-right): "{Hero} has been saving up for a little camping trip." / "Seven days. A quiet place by the water. Nothing to do but be cozy." / "First, a stop at the shop..."
- **Shop:** header "{Shopkeeper}'s General Store". Item card: name, price, one flavor line, "Buy" (or "Owned"). Too pricey: the button wobbles and the shopkeeper says "Saving up for that one?" Day 1: "First trip? You'll want a tent, a rod and something to cook in." (essentials get a small leaf tag). Leaving without one: "Sure you're ready?" with "Back to shopping" / "Head out anyway". Sell tab: each item with its price, "Sell" and a quantity stepper. Exit: "Head to camp".
- **Legend** (mystery clue 3, three shopkeeper lines): "Oh my. Where did you find this scale?" / "Old campers say a gentle guardian lives in the {Water}. It rises on rainy nights, for someone truly content." / "And they say it loves Moonlight Dumplings. Here, take my old recipe card."
- **Camp:** "Pick a cozy spot for your tent" → "Tap the pegs!" → "Home sweet home!" Decor mode: "Drag to decorate. Tap an item to move or store it." Sleep prompt: "Turn in for the night?" with "Sleep" / "Stay up a bit".
- **Day summary:** "Day {n} done", the Contentment bloom, up to 3 highlight lines ("Caught 4 fish", "Cooked Honey Tea (new!)", "Moment: Firefly swirl"), then "Sweet dreams..."
- **Fishing:** catch card buttons "Keep" / "Let go". Rod hint: "Something big is down there... a sturdier rod might help."
- **Cooking:** tray label "Basket". Hints: "Drag up to 3 ingredients into the pot", then "Stir!" Results: "Eat", "Save", "Share with {Companion}". No cookware: "You'll need a pot or pan for that. The shop has some!" No match: "Mystery Mush... it's... edible?"
- **Companion:** "Something is peeking from the bushes...", "It nibbled the {Dish} and looked very pleased.", "{Companion} wants to stay with you!"
- **Rare moments:** "A shooting star! Make a wish.", "A rainbow over the {Water}!", "The fireflies are dancing.", "Everything is wrapped in soft mist.", "A Golden Whisker! It's practically glowing.", "A moonbow... that's rare."
- **Journal:** cover "{Hero}'s Journal" with "{n} / 36 stamps". Tabs "Fish", "Recipes", "Moments", "Friends", "Mystery", "Trip". Locked entries show "???" and their hint.
- **Trip Album:** cover "{Title}: Trip 1". Mystery page: "You met the guardian of {Water}." or "The glow is still out there..." Postcard: "Next trip: {Next campsite}. Coming soon." Buttons "Stay a little longer" / "Start a new trip".
- **Settings:** sliders "Music", "Sounds", "Ambience"; toggles "Reduce motion", "Large text"; "Start a new trip" (confirm: "Start over? Your gear and camp reset; your journal stays." with "Keep camping" / "Start over"); "Erase everything" (confirm: "This clears your journal too." with "Cancel" / "Erase").

## 8. Art bible (locked parts)

Everything is drawn in code from these tokens. At M0, write `ART_BIBLE.md` extending this section (never contradicting it) with your setting's layer plan, character sheets and UI kit.

**Style:** side-view storybook. Flat vector shapes with soft gradients and rounded silhouettes; no sharp corners anywhere. Outlines are a darker shade of the fill at 2-3 px (at 1x), never black. Depth and mood come from color, mist and glow, not black shadows.

### Base palette

Single source of truth in `palette.ts`. Setting accents may be added at HSB saturation of 40% or less (ember excepted) and must be logged.

| Token | Hex | Use |
| --- | --- | --- |
| cream | #F6EFE6 | Paper, highlights, UI cards |
| butter | #F2DFA7 | Sunlight, warm accents |
| peach | #F2B8A0 | Dawn, food |
| rose | #D9A0A6 | Flowers, UI accents |
| blush | #EFA3A8 | Cheeks, at 60% alpha |
| lavender | #B9AACB | Mist, far ridges |
| powder | #A9C3D9 | Day sky, water |
| sage | #A8BFA0 | Foliage |
| moss | #7E9C82 | Deep foliage, near trees |
| bark | #8C6F5E | Wood, tent poles, ground edges |
| ink | #4A4250 | Eyes, text, the darkest value (never #000) |
| ember | #F29E6B | Fire; the only saturated warm |
| glow | #FFD59A | Firelight, lanterns, fireflies |

### Lighting keys

Interpolate smoothly between keys; each key also tints every layer.

| Key | Sky top | Horizon | Mood |
| --- | --- | --- | --- |
| Dawn | #C9B6D6 | #F4C9B8 | Lavender to peach, low mist |
| Day | #A9C9E3 | #E8F0EC | Clear and airy, light shadows |
| Golden hour | #E8C3A0 | #F6E3B4 | Warm rim light on everything |
| Dusk | #8E86B5 | #E9A9A6 | Purple-pink, first stars |
| Night | #2F3558 | #5B5E86 | Soft indigo, never black; warm firelight pool |
| Rain (overlay) | Blend 40% toward #9AA6B8 | Blend 40% toward #9AA6B8 | Desaturate 30%, thicker mist, cooler |

### Depth and atmosphere

- At least 4 parallax bands plus the sky (scroll factors about 0.1, 0.25, 0.5 and 1.0), and a foreground band (1.3) of grass and leaves that partly overlaps the scene.
- Atmospheric perspective: farther bands are lighter, lower in contrast and tinted toward the horizon color. Mist bands drift slowly between ridges.
- Water reflects the scene: mirrored layers at lower alpha with a gentle horizontal ripple, a sun or moon path, raindrop rings in rain.

### Characters (hero, companion, shopkeeper, guardian)

- Kawaii proportions: head at least as big as the body, a bean or round silhouette, stubby limbs.
- Big ink oval eyes with 1-2 cream highlight dots, a tiny mouth, blush ovals, no realistic nose.
- Built from separate parts (head, body, ears, eyes, limbs, tail) so each animates on its own.
- Expressions: neutral, happy (^ ^), blissful (closed eyes, bigger blush, floating hearts or notes), surprised (on a bite), sleepy (night), munching (cheeks puff).
- Idle: breathing (scaleY 1.00 to 1.03 on a 2.4 s sine), blinks every 2-5 s, an ear or tail flick, eyes glancing toward nearby interactables, plus the quirk you invent.
- Walk: a bouncy hop-walk (4-6 px bob), squash on landing (0.92 / 1.06), tiny dust puffs.

### Motion and juice

- Ease everything: easeOutBack for pops, easeInOutSine for loops. Nothing moves linearly except rain.
- Every pickup, button press and spawn squashes and stretches (0.85 / 1.15, then settles).
- Wind: grass blades sway with per-blade phase, trees sway, and gusts every 8-15 s move lanterns, chimes and flags.
- Particles: fireflies (20-40 at night, noise-driven wander, glow pulse), embers, steam, 2-layer rain with splashes and drips off the tent edge, drifting petals or leaves by day, sparkles on discoveries.
- Light: a flickering firelight pool at night (radial, additive) that warms the hero and tent; lantern pools; soft bloom on fire, fireflies, moon, lanterns and the guardian; a subtle vignette, stronger at night.

### UI kit

- Rounded cards (radius 20 px), soft shadows tinted with ink (blur 12, y 4, alpha 0.15), faint paper grain; buttons squish on press.
- Fonts, self-hosted via @fontsource: a rounded sans (Baloo 2, Nunito or Fredoka) for UI; a handwritten face (Patrick Hand or Caveat) for the journal and banners.
- Rarity shows as stars, never by color alone.

### Composition

The hero sits on the lower third; the top 40% of the frame is mostly sky and ridges. At most 3 interactables glow at once, and only when the hero is near (a soft breathing outline).

### Never

Pure black or white, neon, harsh red, gray drop shadows, hard-edged boxes, emoji as art, placeholder rectangles, photos, or any copied character or logo.

### Touchstones (style only; never copy)

Alto's Odyssey for parallax, gradients and atmosphere. A Short Hike for cozy pacing. Sumikko Gurashi for soft character simplicity.

## 9. Audio

The game must sound complete with zero audio files. Music files I generate in Higgsfield are an upgrade the game detects at boot.

- **SFX (synthesized with the Web Audio API, no files):** footstep pats on grass, bobber plip, splash, bite bloop, reel whirr, a catch fanfare (3 rising marimba-like notes), item pop, basket bounce, peg tok, tent spring, page flip, button squish, sizzle (filtered noise), bubbling pot, a soft kettle whistle, discovery chime, wind-chime tinkles, a companion squeak, and a gentle "nope" for disabled buttons (never a buzzer).
- **Ambience (code):** birdsong by day, crickets at night, rain (bandpassed pink noise with random drips) with a muffled variant in the tent doorway, fire crackle (short random noise bursts), wind (low-passed noise with slow gusts), water lapping. Crossfade by time, weather and the hero's position.
- **Music style:** soft lo-fi at 70-80 BPM; a lead instrument that fits your setting over felt piano or Rhodes; brushed drums by day, no drums at night.
- **Music files (optional):** `public/audio/music_day.mp3`, `music_rain.mp3`, `music_night.mp3` and `finale.mp3`. At boot, check which exist and crossfade between them by time and weather (4 s fades). When `finale.mp3` exists it replaces the loop during the finale. Duck music by 30% under the catch fanfare.
- **Fallback score** for any missing file: generative lo-fi in Web Audio (a slow Imaj7, vi7, IVmaj7, V loop; soft FM keys; sparse kalimba-like plucks on the pentatonic scale; faint vinyl noise; sparser and slower at night).
- **`MUSIC_BRIEF.md`:** one generation prompt per file with instrumental, BPM, key, instruments (lead matched to your setting), mood, length (120-150 s for loops, 40-60 s for the finale) and "loop-friendly: no fade in or out, ends on the tonic". Add where to drop the files.
- **Mixing and iOS:** unlock audio on the first tap. Music, sound and ambience volumes persist. Nothing is louder than the music bed except the catch fanfare.

## 10. Tech spec

- **Stack:** Vite + TypeScript + Phaser 3 (latest 3.x, pinned). No runtime dependencies beyond Phaser and fonts. Rejected: PixiJS (renderer only, more plumbing), raw Canvas (no scenes or tweens; heavy glow on iPad), Three.js (3D not chosen).
- **Procedural art pipeline:** at boot, draw every sprite into textures with Canvas 2D (gradients, rounded paths, soft shadows) at 2x scale, then render them as Phaser images with tints and FX. One module per thing (`art/hero.ts`, `art/tent.ts` and so on), colors only from `palette.ts`. Never redraw Graphics every frame.
- **Scenes:** Boot (textures, fonts, audio check), Title, Intro, Shop, Camp (the world), overlays for HUD, Cooking and Journal, and Album.
- **State:** one typed `GameState` store, saved to localStorage under a versioned key with migrations. Autosave after every meaningful action and on `visibilitychange` and `pagehide`. Seeded RNG (seed saved) for weather and bites.
- **Data-driven content:** `data/items.ts`, `fish.ts`, `forage.ts`, `recipes.ts`, `decor.ts`, `moments.ts`, `mystery.ts`, `dialogue.ts`. No magic numbers or UI strings in scene code.
- **Layout:** landscape-first. Logical height 720; width flexes with the aspect ratio (wide screens show more world) instead of letterboxing. The HUD anchors to safe-area edges.
- **Crispness:** render at the device pixel ratio, capped at 2. Text and edges must look sharp on a Retina iPad.
- **Performance:** 60 fps on an M-series iPad and at least 50 fps on a mid-range Android phone. At most about 400 live particles, pooled. No hitches on scene changes.
- **Accessibility:** Reduce motion (no camera easing or nudges, fewer particles, stir becomes hold), Large text, a visual cue for every audio cue, nothing conveyed by color alone.
- **Home-screen app:** web manifest, theme color, apple-touch-icon and standalone display, so it can be added to an iPad home screen and run full-screen. No service worker in v1 (avoids stale-cache bugs).
- **Debug hooks** (dev builds, or `?debug=1`): `?scene=`, `?time=dawn|day|golden|dusk|night`, `?weather=clear|rain|mist`, `?day=`, `?seed=`, `?state=fresh|midtrip|finale`, a free-money button, and `window.__game` helpers that let scripts trigger fishing, cooking and sleep.

## 11. Build plan and self-review loop

Work through the milestones in order. Each ends with the screenshot review below; do not start the next until it passes.

1. **M0, world and style board:** invent the world and cast (section 4), write `ART_BIBLE.md` and seed `DECISIONS.md`. Build a style board scene (`?scene=styleboard`) showing the hero's expressions and walk, the companion, shopkeeper and guardian, the palette, the camp landscape at all 5 times of day plus rain, and UI parts (card, button, toast, catch card). No gameplay code yet.
2. **M1, vertical slice:** title → intro → shop → camp → pitch the tent → fish → forage → cook (4 recipes) → eat → sleep → summary → Day 2 dawn. Save and reload work. Core SFX and ambience are in.
3. **M2, full systems:** all items, fish, forage, recipes and decor; selling; weather with its guarantees; Contentment tiers; every journal tab; the companion; rare moments.
4. **M3, mystery and trip end:** all 5 clues, the finale, the Trip Album, the teaser, free play and new trip.
5. **M4, polish and ship:** a juice pass (every interaction has motion, sound and particles), the audio mix and fallback score, accessibility toggles, a performance check, icons, social image and manifest, deploy, `MUSIC_BRIEF.md` and `HANDOFF.md`.

### Screenshot review (after every milestone)

- Install Playwright with Chromium as a dev dependency. `npm run shots` starts the game and, using the debug hooks, saves PNGs to `shots/<milestone>/` at iPad landscape (1180 x 820, scale 2) and phone landscape (844 x 390, scale 2).
- Shot list (as each becomes available): title, shop, camp at dawn, day, golden hour, dusk, night with fire and fireflies, rain, fishing bite, catch card, cooking result, decorated camp at night, journal fish page, mystery finale, Trip Album.
- Open every screenshot and score it 1-5 on:
  1. Serene at a glance
  2. Kawaii
  3. Palette and lighting match the bible
  4. Clear depth (4+ bands, atmospheric fade)
  5. Zero placeholder or unstyled elements
  6. No harsh edges, pure black or white, or clutter
  7. Legible text and touch targets of 44 pt or more
  8. Would this screenshot make someone want to play?
- Fix anything scoring 3 or below, re-shoot and re-score, up to 3 polish rounds per milestone. Log scores and fixes in `REVIEW.md`.

### Smoke test

`npm run smoke` uses Playwright and the debug hooks to play Day 1 (buy essentials, pitch, catch a fish, cook, sleep), reload, and confirm the save. It fails on any console error. Run it after every milestone from M1 on.

## 12. Done, out of scope, ship

### Done when

- [ ] A full trip, Day 1 to the Trip Album, plays on iPad Safari by touch with no console errors.
- [ ] Every final screenshot scores 4 or more on all 8 rubric lines.
- [ ] No placeholder art anywhere; every visual comes from code and `palette.ts`.
- [ ] 60 fps on iPad, with no hitches on scene changes.
- [ ] A mid-day reload resumes exactly where the player was.
- [ ] The game sounds complete with no music files, and dropping in the 4 files upgrades it with no code change.
- [ ] Deployed, with the live URL printed.

### Out of scope for v1

Other campsites (teaser only), multiplayer, accounts or cloud saves, monetization, voice acting, gardening, traps, and hunting of any kind (never).

### Ship

1. `npm run build`, then deploy with `npx vercel --prod`. If not logged in, stop and tell me to run `npx vercel login`.
2. Render icons (32, 180, 192 and 512 px) from the hero's face using the same art code, and a 1200 x 630 social image (the camp at dusk with the title) for link previews.
3. Meta description: "{Title}: a tiny, cozy camping trip. Fish, forage, cook by the fire, and meet the gentle guardian of the water."
4. Print the live URL.

### Handoff

Finish with `HANDOFF.md`: what was built, where each system lives, known issues, the top 5 next ideas, and a paste-ready prompt to resume in a fresh session.
