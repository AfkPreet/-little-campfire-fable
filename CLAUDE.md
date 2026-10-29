# Little Campfire: conventions for every contributor (human or agent)

Cozy kawaii 2D side-view camping game. Browser, touch-first, landscape. Vite + TypeScript + Phaser 3.90 (pinned). The locked spec is `docs/BUILD_PROMPT.md`; the world and visual spec is `ART_BIBLE.md`; decisions go in `DECISIONS.md`.

## Non-negotiables
- **Colors only from `src/config/palette.ts`** (`PALETTE`, `ACCENTS`, `LIGHT_KEYS`). No hex literals anywhere else in `src/`. Derive shades with `shade()/mix()/alpha()/outline()`.
- **Never pure black or white.** Darkest is `ink`, lightest is `cream`. Outlines are a darker shade of the fill at 2-3 px (`outline(fill)`), never black. No gray drop shadows: shadows are `ink` at low alpha. No hard-edged boxes, no neon, no harsh red, no emoji as art, no placeholder rectangles.
- **All art is drawn in code** through `src/art/pipeline.ts`: `paintTexture(scene, key, w, h, painter)` paints once at 2x into a texture; display it with `img()/makeImg()/tile()` (they apply the 1/ART_SCALE scale and store `baseScale`). Never redraw a `Graphics` every frame. `Graphics` is fine for flat vector shapes (no gradient fills: Phaser's gradient fill shows triangle seams on rounded shapes; paint gradients into textures instead).
- **Logical coordinates**: height is always 720 (`LOGICAL_H`); width is `viewport().w` and changes with aspect ratio. Call `applyViewport(this)` in every scene `create()` and re-apply on the game `'viewport'` event. Never read `scale.width` for layout.
- **Text**: create it via the UI kit helper (`src/ui/text.ts` once it exists) so every text has `setResolution(DPR)`; fonts are `"Baloo 2"` (UI) and `"Patrick Hand"` (journal, banners). Minimum body size 16 px; touch targets 44 px or larger.
- **No magic numbers or UI strings in scene code**: content lives in `src/data/*`, strings in `src/data/dialogue.ts`, tuning in the data files.
- **Motion**: ease everything (`Back.easeOut` for pops, `Sine.easeInOut` for loops). Linear only for rain. Squash and stretch 0.85/1.15 on pickups, presses and spawns. Tween scales relative to `getData('baseScale')`.
- **Cross-platform scripts**: npm scripts and Node (`.mjs`) only; no bash-only commands. Paths via `node:path`.
- **Performance**: at most ~400 live particles, pooled. Reuse textures by key. No per-frame allocations in update loops.
- **Accessibility**: nothing conveyed by color alone (rarity = stars), a visual cue for every audio cue, Reduce motion respected.

## Layout of src/
- `config/` palette (colors), layout (viewport/zoom), debug (URL hooks)
- `art/` one painter module per thing (`hero.ts`, `tent.ts`, ...). Export `paintXxx(scene)` that registers textures with stable keys, plus small factories that return display objects/containers.
- `scenes/` Boot, Title, Intro, Shop, Camp, HUD, Cooking, Journal, Album, StyleBoard
- `world/` landscape bands, lighting/time, weather, particles
- `entities/` Hero, Companion, Guardian (part-based rigs with idle/walk/expressions)
- `ui/` kit: text, Card, Button, Toast, CatchCard, Bubble
- `state/` typed `GameState`, save/load with versioned key + migrations, seeded RNG
- `data/` items, fish, forage, recipes, decor, moments, mystery, dialogue
- `audio/` Web Audio SFX, ambience, music (files optional, generative fallback)

## Workflow
- `npm run dev` (http://127.0.0.1:5173), `npm run typecheck`, `npm run build`, `npm run shots <milestone>` (Playwright screenshots into `shots/<milestone>/`), `npm run smoke`.
- Debug URL params: `?debug=1&scene=styleboard&board=characters&time=night&weather=rain&day=3&seed=7&state=midtrip&freeze=1&noaudio=1`.
- `window.__game.ready` must become true once a scene is settled (scripts wait on it); `window.__game.errors` collects page errors.
- Commit small, descriptive. Log every design decision in `DECISIONS.md` as chosen / rejected / why.
