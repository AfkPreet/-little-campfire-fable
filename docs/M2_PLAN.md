# M2 plan: full systems

Everything the spec lists for M2: all items, fish, forage, recipes and decor (data is complete since M0); selling (Shop Sell tab, done in M1); weather with its guarantees; Contentment tiers and unlocks; every journal tab; the companion; rare moments. Plus decor mode, which the spec puts under Shelter.

## Work packages

| Package | Owns | Builds on |
| --- | --- | --- |
| **Journal** | `src/scenes/Journal.ts`, `src/art/journal.ts` (notebook cover, paper, tabs, stamps, badges, page-turn), `src/ui/JournalPages.ts` | `state.journal`, `data` tables, `STRINGS.journal`, `stampCount`, `checkBadges`; fish icons `fish-<id>`, dish icons `dish-<id>` |
| **Decor mode** | `src/systems/decorMode.ts`, `src/entities/Decor.ts`, `src/art/decor.ts` (11 items with idle animation parts: lantern sway + glow pool, toran flutter, chime tinkle, rug warm tint at night, fairy lights twinkle, bookshelf, hammock, telescope, guardian lantern) | `camp.tent.hangPoints()`, `LAYOUT.decorGround`, `LAYOUT.hammockPoint`, store `placeDecor/moveDecor/storeDecor`, backpack overlay in HUD |
| **Companion** | `src/systems/companionFlow.ts` | `Companion` rig, `state.journal.companion`, `companionVisit`, Cooking `companionNear`, thickets in `LAYOUT` |
| **Weather + moments** | `src/systems/weatherFlow.ts`, `src/systems/moments.ts`, `src/art/moments.ts` (shooting star streak, rainbow arc, moonbow, misty-sunrise banner art, handwritten banner card) | `clock.rollNewDayWeather/maybeMiddayChange`, `data/moments.ts` (`rollMoments`, `momentChance`), `recordMoment`, `landscape.setWeather`, fx (fireflies swirl, stars) |
| **Contentment** | lantern tiers in HUD (done), hero tier expressions in Camp (`tierOf` → `setExpression`), unlock gates (companion at content, finale at glowing, blissful rare moment) | `contentment.ts` |

## Rules to honor (spec section 5)

- Weather rolled at dawn: clear 50 / rain 30 / mist 15 / golden 5; Day 1 clear; Night 4 rains if no rainy night yet; rain may start or stop mid-day (10%, once); mist burns off by midday. `endDay()` already rolls; Camp must apply `state.weather` to the landscape and ambience at dawn and after a midday change, and mark `flags.firstRainyNight/lastRainyNight`.
- Companion: when tier ≥ content at dusk or night and the player holds a dish, eyes peek from a thicket; tapping it hides it; sharing a dish while near counts a visit; visits on 3 different days befriend it; then it follows, sleeps by the fire, sits on the jetty, wiggles when the hero eats. Friends tab shows 3 hearts.
- Rare moments: checked at dawn and at night (table in spec section 6); each plays a chime, shows a handwritten banner, adds a journal stamp, +8 Contentment. Blissful guarantees that night's moment (shooting star if clear, moonbow if rainy). Firefly swirl needs 20 s sitting by the fire on a clear night.
- Journal: tabs Fish (8), Recipes (16), Moments (6), Friends (1), Mystery (5), Trip (a page per day); undiscovered entries are soft silhouettes with "???" and the hint line; cover shows "{n} / 36 stamps"; badges Happy Camper at 20, Guardian Friend at the finale.
- Decor: drag from the backpack to snap points (hang points on the tent and the jamun branch; ground points ring the clearing; the hammock needs the two-tree point); tap a placed item to move or store it; first placement +5 Contentment; everything placed animates.

## Shots (m2)

journal-fish, journal-recipes, journal-mystery, decorated-camp-night, companion-peek, moment-shooting-star, moment-rainbow.
