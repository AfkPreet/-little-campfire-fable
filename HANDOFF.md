# Handoff: Little Monsoon

A cozy kawaii 2D side-view camping game for the browser (touch-first, landscape). A tiny palm squirrel, Chikki, takes a seven-day trip to Nerale Thota on Manjukere, a coffee-estate reservoir backwater in Kodagu. Everything on screen is drawn in code from `src/config/palette.ts`.

## What was built

| Milestone | Status |
| --- | --- |
| M0 world and style board | Done. `ART_BIBLE.md` locks the world; `?scene=styleboard&board=hero|npcs|landscape|camp|ui|fx|icon|social` shows the boards. |
| M1 vertical slice | Done. Title → intro → shop → camp → tent → fish → forage → cook → eat → sleep → summary → Day 2. `npm run smoke` plays Day 1 headlessly and checks the save. |
| M2 full systems | Done. All content, selling, weather with guarantees, Contentment tiers, journal (6 tabs, 36 stamps, 2 badges), companion, rare moments, decor mode. |
| M3 mystery and trip end | Done. Five clues, the guardian finale, Trip Album, next-campsite teaser, free play, new trip, settings menu. |
| M4 polish and ship | Polish pass, keyboard controls, full-trip test (`npm run trip`), FPS probe, icons, social image, manifest, meta tags, `MUSIC_BRIEF.md`. **Deploy is blocked on Vercel credentials** (see below). |

## Where each system lives

| System | Files |
| --- | --- |
| Colors and lighting | `src/config/palette.ts` (the only hex file), `src/world/lighting.ts` (dayT → tints for every band) |
| Viewport and Retina | `src/config/layout.ts` (logical height 720, camera zoom = canvasH / 720; use `camera.worldView`, never `scrollX`, for view edges) |
| Art pipeline | `src/art/pipeline.ts` (paint once at 2x, display via `img()`); painters in `src/art/**` (hero, companion, shopkeeper, guardian, landscape/*, props/*, items, dishes, ingredients, fish, cookware, decor, journal, album, moments, mystery, hud, intro, fishing) |
| World | `src/world/Landscape.ts` (bands, water, mist, fire, fireflies), `src/world/layout.ts` (every world position), `src/world/Interactable.ts` |
| Entities | `src/entities/Hero.ts` (rig, expressions, idle quirk, walk, poses), `Companion.ts`, `Shopkeeper.ts`, `Guardian.ts`, `Tent.ts`, `Decor.ts` |
| Scenes | `src/scenes/` Boot (paints everything, inits the store), Title, Intro, Shop, Camp (the world), HUD (parallel), Cooking, Journal, DaySummary, Album, StyleBoard |
| Camp systems | `src/systems/` clockRunner (time, lighting, ambience, timed gains), tentFlow, restFlow (rest, sleep, Day 7 → album), fireFlow (cook, sit), fishing, foraging, weatherFlow, moments, tiers, companionFlow, decorMode, mysteryFlow, finale, keyboard, campApi (debug API) |
| State | `src/state/` GameState (typed), store (actions encode the rules), save (localStorage `little-campfire:save`, versioned, migrations), contentment, clock (weather roll + guarantees), rng (seeded) |
| Data | `src/data/` items, pantry, fish, forage, recipes (`matchRecipe`), decor, moments, mystery, world (names + tuning blocks), dialogue (every UI string), validate (`npm run check:data`) |
| UI kit | `src/ui/` text, kit (textures, nine-slice, icons), Card, Button, Toast, Bubble, Modal, CatchCard, controls, ItemCard, TabBar, JournalPages, AlbumPages, SettingsOverlay |
| FX | `src/fx/` particles (fireflies, rain, embers, steam, sparkles, hearts, stars), juice (squash, pop, nudge, reduce motion), textures |
| Audio | `src/audio/` engine (Web Audio buses, unlock, duck), sfx (25 synthesized sounds), ambience (birds, crickets, rain, fire, wind, water), music (optional files, 4 s crossfades), fallbackScore (generative venu lo-fi), glue |
| Tooling | `scripts/shots.mjs` (screenshots per milestone), `smoke.mjs` (Day 1), `trip.mjs` (Days 1-7 to the album), `perf.mjs` (FPS probe), `icons.mjs` (icons + social image), `check-data.mjs` |

## Commands

```
npm run dev            # http://127.0.0.1:5173
npm run typecheck      # tsc --noEmit
npm run build          # tsc + vite build → dist/
npm run shots m4       # screenshots → shots/m4/ (ipad + phone)
npm run smoke          # Day 1 headless play + reload
npm run trip           # Days 1-7 to the album, free play, new trip
npm run icons          # public/icon-*.png, apple-touch-icon.png, social.png
npm run check:data     # validates the content tables
```

Debug URL params: `?debug=1&scene=camp&state=fresh|midtrip|finale&time=dawn|day|golden|dusk|night&weather=clear|rain|mist&day=3&seed=7&freeze=1&noaudio=1&board=...&tab=fish&page=last&decor=1&peek=1&mystery=2&finale=rise|moonbow&bite=1&catch=1&cooked=herb_tea&moment=rainbow`. `window.__game.api` has `buyEssentials, pitchTent, forage, fish, cook, eatLastDish, sleep, saveNow, state, mystery, finale, companionPeek, fps` and more (see `src/systems/campApi.ts`).

## Deploy

`npm run build` passes. Vercel needs credentials this environment did not have: the CLI is logged out, temporary claimable deploys were unavailable, and the Vercel connector had no user. Two ways to ship:

1. Locally: `npx vercel login`, then `npx vercel --prod` from the repo root (framework Vite, output `dist`). Afterwards set the `og:image` and `twitter:image` meta tags in `index.html` to the absolute live URL of `/social.png`.
2. From a cloud session: add a Vercel API token as the environment secret `VERCEL_TOKEN`, then run `npx vercel --prod --token "$VERCEL_TOKEN" --yes`.

Music files are optional: drop the four MP3s described in `MUSIC_BRIEF.md` into `public/audio/` and redeploy; no code change.

## Known issues

- Headless Chromium runs the game loop 3-10x slow, so screenshot scripts use stage jumps (`finale=rise|moonbow`) and wall-clock timers for debug triggers.
- Night moments are not re-rolled on a reload mid-night.
- The guardian's halo is masked at the waterline (no glow on the water during the finale).
- The far-estate coffee rows still read as a soft dot pattern in flat daylight on wide phones.
- Phone-width Journal and Album pages are scaled to fit rather than re-flowed.
- Large text (1.2x) applies on the next scene create, not live.
- Vercel deployment not done (credentials, above).

## Top 5 next ideas

1. Mallige Falls: a second campsite with its own layer plan (the teaser postcard already points there).
2. Photo mode: a camera button that saves a polaroid of the current view into the album.
3. Weather sounds inside the tent: a muffled rain mix with a page-flip of the journal while resting.
4. Daily Doddamma errands: she asks for a dish and pays extra, giving the economy a small arc.
5. Seasonal passes: a dry-season palette (golden grass, fewer fireflies) as a second trip variant.

## Resume prompt (paste into a fresh session)

> You are resuming Little Monsoon, a cozy kawaii side-view camping game (Vite + TypeScript + Phaser 3.90, 100% code-drawn art). Read `CLAUDE.md`, `HANDOFF.md`, `ART_BIBLE.md`, `DECISIONS.md`, `REVIEW.md` and `docs/BUILD_PROMPT.md` (the locked spec) first. Run `npm install`, `npx playwright install chromium`, `npm run typecheck`, `npm run smoke` and `npm run shots m4`, then look at the PNGs in `shots/m4/` and score them with the rubric in `REVIEW.md`. Work on the designated branch, commit small, and log every design decision in `DECISIONS.md` as chosen / rejected / why. Colors only from `src/config/palette.ts`; art only through `src/art/pipeline.ts`; strings only in `src/data/dialogue.ts`; no gameplay numbers outside `src/data/`. The next task is: [describe it].
