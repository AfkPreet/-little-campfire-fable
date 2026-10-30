# M1 plan: the vertical slice

Title → intro → shop → camp → pitch the tent → fish → forage → cook (4 recipes) → eat → sleep → summary → Day 2 dawn. Save and reload work. Core SFX and ambience are in. `npm run smoke` plays Day 1 headlessly.

Everything below builds on what M0 shipped: `state/` (store, actions, save, clock, contentment), `data/` (tables, rules, strings), `ui/` (kit, Card, Button, Toast, Bubble, Modal, CatchCard, controls), `fx/` (particles, juice), `audio/`, `entities/` (Hero, Companion, Shopkeeper, Guardian), `world/Landscape` + `world/layout` (LAYOUT positions) + `world/lighting`.

## Scenes

| Scene | Key | Responsibility |
| --- | --- | --- |
| Boot | `Boot` | Fonts, paint every texture family (hero, companion, shopkeeper, guardian, landscape + props, ui, fx), `initStore()` from save or `?state=`, `installAutosave`, `audio.unlockOnFirstGesture(window)`, `validateData()` in dev, then start `?scene=` or Title (Continue → Camp). |
| Title | `Title` | Live `Landscape` at dusk (fire lit, fireflies), Chikki dozing by the tent spot, logo, "Begin your trip" / "Continue" (only with a save) / "Settings", footer "Best with sound on · v0.1". |
| Intro | `Intro` | Three storybook cards (strings in `dialogue.ts`), tap to turn, "Skip" top-right, then Shop with `flags.introSeen`. |
| Shop | `Shop` | Doddamma bust left third with a greeting bubble; tabs Camp / Fishing / Kitchen / Pantry / Cozy / Sell; item cards (name, price with cowrie icon, flavor, Buy or Owned); too pricey → button wobble + "Saving up for that one?"; Day 1 essentials leaf-tagged + line; leaving without one asks once (Modal); Sell tab with stepper; exit "Head to camp" → Camp. Pauses the clock. |
| Camp | `Camp` | The world. Owns `Landscape` (parallax), `Hero`, camera follow, the clock (advances `state.dayT`, lighting, weather), interactables, and the day's flows (tent pitching, fishing, foraging, fire actions, rest/sleep). Launches `HUD` in parallel. |
| HUD | `HUD` | Fixed camera UI: money (cowrie icon + amount), "Day n · Phase" with sun/moon icon, Contentment lantern (tap → tier label), Backpack and Journal buttons, toasts, modals, action bubbles live in HUD space but are positioned from world points via the Camp camera. |
| Cooking | `Cooking` | Overlay scene: fire close-up, cookware picker (owned only), basket tray (drag 1-3 ingredients into the pot), stir gesture (circle twice; hold 1.5 s with Reduce motion), sizzle/steam 2.5 s, dish pop + name + NEW RECIPE ribbon, Eat / Save / Share. Pauses the clock. |
| DaySummary | `DaySummary` | Overlay card: "Day n done", Contentment bloom, up to 3 highlight lines, "Sweet dreams...", then Camp at the next dawn. |

## Camp internals (contracts the systems code against)

```ts
// src/scenes/Camp.ts exposes
camp.landscape: Landscape; camp.hero: Hero; camp.worldCam: Camera;
camp.registerInteractable(i: Interactable): void;   // src/world/Interactable.ts
camp.pauseClock(reason) / camp.resumeClock(reason);
camp.showActions(worldX, worldY, actions: {label, onPick}[]) // HUD bubble via camera transform
camp.walkHeroTo(x): Promise<void>;
camp.events: 'phase' | 'dawn' | 'night' | 'weather'  (Phaser EventEmitter)
```

- `Interactable { id, x, y, radius, zone(hit area ≥ 44 px), labelFor(state): string | string[], onTap(camp) }`. The Camp's pointer handler hit-tests interactables first, then the water zone (`x > LAYOUT.shoreX && 400 < y < 600` → fishing), else ground → `walkHeroTo(x)`. The three nearest interactables within 180 px breathe a glow ring (`kit.breathingRing`).
- Systems in `src/systems/`: `clockRunner.ts` (tick + lighting + weather + timed Contentment gains), `tentFlow.ts` (spot → unfold → 4 pegs → spring → "Home sweet home!"), `fishing.ts` (cast → wait 3-10 s with fake nibbles → bite window → reel → CatchCard; miss → toast), `foraging.ts` (walk → hop pick → items arc with `sparkleTrail` → `addForage`), `fireFlow.ts` (Cook → Cooking scene; Sit → +1/10 s), `restFlow.ts` (Rest in doorway, Sleep → `endDay()` → DaySummary), `audioGlue.ts` (ui events → sfx; ambience from camp state each 250 ms).
- Depth: everything on the ground goes into `landscape.layers.actors` and `landscape.sortActors()` runs after moves.

## Smoke test

`scripts/smoke.mjs`: Playwright, `?debug=1&noaudio=1&state=fresh&scene=camp`, drives `window.__game.api` helpers exposed by Camp in debug builds: `buyEssentials()`, `pitchTent(spot)`, `forage(spotId)`, `fish({force: 'minnow'})`, `cook('kettle', ['herbs'])`, `eatLastDish()`, `sleep()`, then reloads and checks `load()` gives Day 2. Fails on any console error.

## Shots (m1)

title, intro, shop, camp-dawn, camp-day, camp-golden, camp-dusk, camp-night, camp-rain, fishing-bite, catch-card, cooking-result, day-summary.
