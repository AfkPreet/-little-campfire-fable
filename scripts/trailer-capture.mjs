// npm run trailer:capture [--test | --beats=2,3 | --verify] -- renders the 90 s trailer offline from the live game
// (marketing/trailer/TRAILER.md). The game runs in director mode (?director=1): Phaser's loop is stopped and the game
// is stepped one frame at a time; each frame is encoded in-page to VP9/WebM at a true 30 fps. Output:
// marketing/trailer/render/*.webm and marketing/trailer/checks/beat-NN.png (one per beat, at its midpoint).
//   --test        4 s proof (dusk camp + caption, then the title card) -> render/test-*.webm
//   --beats=2,3   render only those beats, each from its own freshly built state -> render/beats-*.webm
//   --verify      open the finished web WebM in a Playwright <video>, seek to 0:08 / 0:32 / 1:18 / 1:29 (or --at=47,49.5)
//                 and save
//                 checks/verify-*.png (ffmpeg here cannot decode VP9; the browser can)
// Cross-platform: pure Node + Playwright.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const TEST = args.includes('--test');
const VERIFY = args.includes('--verify');
const beatsArg = args.find((a) => a.startsWith('--beats='));
const ONLY = beatsArg ? new Set(beatsArg.slice('--beats='.length).split(',').map((s) => Number(s)).filter((n) => n > 0)) : null;
const atArg = args.find((a) => a.startsWith('--at='));
const AT = atArg ? atArg.slice('--at='.length).split(',').map((s) => Number(s)).filter((n) => Number.isFinite(n) && n >= 0) : null;
const PORT = 5191;
const FPS = 30;
const W = 1280, H = 720;
const renderDir = path.join(root, 'marketing', 'trailer', 'render');
const checkDir = path.join(root, 'marketing', 'trailer', 'checks');
await mkdir(renderDir, { recursive: true });
await mkdir(checkDir, { recursive: true });

const baseName = TEST ? 'test' : ONLY ? `beats-${[...ONLY].join('-')}` : 'little-monsoon-trailer-16x9';
const masterPath = path.join(renderDir, TEST || ONLY ? `${baseName}-master.webm` : `${baseName}.webm`);
const webPath = path.join(renderDir, `${baseName}-web.webm`);

if (VERIFY) {
  await verify(ONLY ? webPath : path.join(renderDir, 'little-monsoon-trailer-16x9-web.webm'));
  process.exit(0);
}

const server = await createServer({ root, server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

// ---------- helpers that talk to window.__game.director / api ----------
const ev = (fn, arg) => page.evaluate(fn, arg);
/** evaluate a JS expression string in the page; `d` is the director, `api` the camp api, `game` the Phaser game */
// Only plain data crosses the bridge: a Phaser object (a ScenePlugin from scene.launch, a scene from a getter) would be
// serialized whole and blow Node's string limit (ERR_STRING_TOO_LONG).
const api = (expr) => ev((e) => {
  const d = window.__game.director, api = window.__game.api, game = window.__game.game; void d; void api; void game;
  const r = eval(e);
  const plain = (v) => v === null || v === undefined || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype;
  return plain(r) ? r : undefined;
}, expr);
const frame = () => ev(() => window.__game.director.frame());
const caption = (text, holdMs = 0) => ev(([t, h]) => window.__game.director.caption(t, { holdMs: h }), [text, holdMs]);
const hud = (on) => ev((v) => window.__game.director.hud(v), on);
const titleCard = (on) => ev((v) => window.__game.director.titleCard(v), on);
const mute = (on) => ev((v) => window.__game.director.mute(v), on);
const press = (label, sceneKey) => ev(([l, s]) => window.__game.director.press(l, s), [label, sceneKey ?? undefined]);
const labels = (sceneKey) => ev((s) => window.__game.director.buttonLabels(s), sceneKey ?? undefined);
const sceneActive = (key) => ev((k) => { const s = window.__game.game.scene.getScene(k); return !!s && s.scene.isActive(); }, key);

/** the beat being rendered: its midpoint check PNG is taken by step() the first time the frame counter passes it */
let pending = null;
async function check(name) {
  const dataUrl = await ev(() => window.__game.director.snapshot());
  await writeFile(path.join(checkDir, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
}
async function step(frames) {
  const f = await ev((n) => window.__game.director.step(n), frames);
  if (pending && f >= pending.frame) { const p = pending; pending = null; await check(p.name); }
  return f;
}
/** start an action and poll isDone(token) while stepping */
const act = (expr) => ev((e) => window.__game.director.run(() => { const api = window.__game.api, game = window.__game.game; void api; void game; return eval(e); }), expr);
const isDone = (token) => ev((t) => window.__game.director.isDone(t), token);

// timeline: beat timecodes are absolute; with --beats the first rendered beat starts at the current frame
let offset = 0;
const abs = (sec) => sec + offset;
const targetFrame = (sec) => Math.round(abs(sec) * FPS);
/** encode until the timeline reaches `sec` (beat-relative to the whole trailer) */
async function stepTo(sec) {
  const target = targetFrame(sec);
  let f = await frame();
  while (f < target) f = await step(Math.min(10, target - f));
}
/** step until the token resolves or the timeline reaches `untilSec`; returns true when the action finished */
async function stepUntilDone(token, untilSec, chunk = 3) {
  const target = targetFrame(untilSec);
  while (!(await isDone(token))) {
    const f = await frame();
    if (f >= target) return false;
    await step(Math.min(chunk, target - f));
  }
  return true;
}
/** step until a page predicate holds or the timeline reaches `untilSec` */
async function stepUntil(pred, untilSec, chunk = 2) {
  const target = targetFrame(untilSec);
  while (!(await pred())) {
    const f = await frame();
    if (f >= target) return false;
    await step(Math.min(chunk, target - f));
  }
  return true;
}
/** step n frames without encoding (scene changes, state setup) */
async function stepMuted(frames) {
  await mute(true);
  for (let i = 0; i < frames; i += 10) await ev((n) => window.__game.director.step(n), Math.min(10, frames - i));
  await mute(false);
}
async function muted(fn) {
  await mute(true);
  try { await fn(); } finally { await mute(false); }
}
/** inside muted(): step until window.__game.ready (scenes raise it once settled) */
async function waitReady(maxFrames = 150) {
  for (let i = 0; i < maxFrames; i += 5) {
    await ev((n) => window.__game.director.step(n), 5);
    if (await ev(() => window.__game.ready === true)) break;
  }
  await ev((n) => window.__game.director.step(n), 6); // camera lerp, first tweens
}
async function startScene(key, data) {
  await ev(([k, d]) => window.__game.director.startScene(k, d), [key, data ?? null]);
  await waitReady();
}

// ---------- worlds: the game state a beat starts from (built muted; consecutive beats share one when they can) ----------
let world = null;
const WORLDS = {
  'midtrip-camp': async () => { await api(`d.resetState('midtrip')`); await startScene('Camp'); },
  'shop-fresh': async () => { await api(`d.resetState('fresh')`); await startScene('Shop'); },
  'fresh-camp': async () => { await api(`d.resetState('fresh')`); await startScene('Camp'); await api(`api.buyEssentials()`); },
  'fresh-camp-pitched': async () => { await api(`d.resetState('fresh')`); await startScene('Camp'); await api(`api.buyEssentials()`); await api(`api.pitchTent(1)`); await ev((n) => window.__game.director.step(n), 2); },
  'finale-camp': async () => { await api(`d.resetState('finale')`); await startScene('Camp'); },
  'album': async () => { if (!world) await api(`d.resetState('midtrip')`); await startScene('Album'); },
};
async function ensureWorld(kind) {
  if (world === kind) return;
  await muted(async () => { await WORLDS[kind](); });
  world = kind;
}
/** camp prep shared by cinematic beats */
async function cinematic({ time, weather, heroX, facing = 1, chrome = false, rings = false, quiet = true }) {
  if (time) await api(`api.setTime('${time}')`);
  if (weather) await api(`api.setWeather('${weather}')`);
  await hud(chrome);
  await api(`api.glowRings(${rings})`);
  await api(`api.companionQuiet(${quiet})`);
  if (heroX !== undefined) await api(`api.placeHero(${heroX}, ${facing})`);
  await ev((n) => window.__game.director.step(n), 2);
}
/** close an overlay scene left open by the previous beat */
async function closeOverlays() {
  if (await sceneActive('Cooking')) {
    if (await press('Save', 'Cooking')) await ev((n) => window.__game.director.step(n), 6);
    if (!(await press('Close', 'Cooking'))) await api(`game.scene.getScene('Cooking').scene.stop()`);
    await ev((n) => window.__game.director.step(n), 12);
  }
  if (await sceneActive('Journal')) {
    await api(`game.scene.getScene('Journal').close()`);
    await ev((n) => window.__game.director.step(n), 10);
  }
}

// ---------- the sixteen beats of marketing/trailer/TRAILER.md ----------
const LAYOUT = { bamboo: 300, tentSpot1: 760, fire: 1180, thicket1: 420, thicket2: 1400, jettyEnd: 2080, rockPool: 1760, shopCenter: 640 };
const BEATS = [
  {
    n: 1, start: 0, end: 5, caption: 'Seven days. A quiet lake.', world: 'midtrip-camp',
    prep: () => cinematic({ time: 'dusk', weather: 'clear', heroX: LAYOUT.fire - 110, facing: 1 }),
    run: async (b) => { await stepTo(b.end); },
  },
  {
    n: 2, start: 5, end: 11, caption: '', world: 'shop-fresh',
    prep: async () => {},
    run: async (b) => {
      await stepTo(b.start + 1.0); // the greeting
      await api(`d.pressBuy('tent_leaf')`); await step(25);
      await api(`d.shopTab('fishing')`); await step(10);
      await api(`d.pressBuy('rod_bamboo')`); await step(25);
      await api(`d.shopTab('kitchen')`); await step(10);
      await api(`d.pressBuy('kettle')`); await step(25);
      await press('Head to camp', 'Shop');
      await muted(waitReady); // Camp boots (fresh trip, gear bought, no tent)
      world = 'fresh-camp';
      await hud(true);
      await stepTo(b.end);
    },
  },
  {
    n: 3, start: 11, end: 17, caption: 'Home sweet home', world: 'fresh-camp',
    prep: () => cinematic({ time: 'day', weather: 'clear', heroX: LAYOUT.tentSpot1 - 150, chrome: true, rings: true }),
    run: async (b) => {
      // the real pitch flow: tap the spot (walks there, the tent lies flat), tap the four pegs, it springs up
      const t = await act(`api.tap('tent-spot-1')`);
      await stepUntilDone(t, b.end - 2.5);
      await step(8);
      for (let i = 0; i < 4; i++) {
        const p = await act(`api.tap('tent-peg-${i}')`);
        await stepUntilDone(p, b.end - 1.2);
        await step(12);
      }
      world = 'fresh-camp-pitched';
      await stepTo(b.end);
    },
  },
  {
    n: 4, start: 17, end: 22, caption: 'Jamun, mushrooms, lemongrass', world: 'fresh-camp-pitched',
    prep: () => cinematic({ weather: 'clear', heroX: LAYOUT.thicket1 + 150, facing: -1, chrome: true, rings: true }),
    run: async (b) => {
      const t = await act(`api.forage('berry_bush_1')`);
      await stepUntilDone(t, b.end - 0.3);
      await stepTo(b.end);
    },
  },
  {
    n: 5, start: 22, end: 29, caption: 'Tap when it bites', world: 'fresh-camp-pitched',
    prep: () => cinematic({ weather: 'clear', heroX: LAYOUT.jettyEnd - 34 - 130, chrome: true, rings: true }),
    run: async (b) => {
      const w = await act(`api.walkTo(${LAYOUT.jettyEnd - 34})`);
      await stepUntilDone(w, b.start + 1.6);
      const t = await act(`api.fish({ force: 'carp', showCard: true })`);
      // the cast, the bobber, the "!", the reel, then the catch card stays up until Keep is pressed
      await stepUntil(async () => (await labels('HUD')).includes('Keep'), b.end - 1.0);
      await stepTo(Math.min(b.end - 0.6, (await frame()) / FPS - offset + 2.0));
      await press('Keep', 'HUD');
      await stepUntilDone(t, b.end);
      await stepTo(b.end);
    },
  },
  {
    n: 6, start: 29, end: 36, caption: 'Stir twice', world: 'fresh-camp-pitched',
    prep: async () => {
      await cinematic({ weather: 'clear', heroX: LAYOUT.fire - 70, chrome: true, rings: true });
      if ((await api(`api.state().inventory.forage.herbs`)) < 1) await api(`api.addForage('herbs', 2)`);
    },
    run: async (b) => {
      await act(`api.tap('fire')`); // the Cook / Sit bubble
      await stepUntil(async () => (await labels('HUD')).includes('Cook'), b.start + 1.5);
      await step(8);
      await press('Cook', 'HUD');
      await ev(() => { window.__game.ready = false; });
      await stepUntil(() => ev(() => window.__game.ready === true && !!window.__game.game.scene.getScene('Cooking')?.scene.isActive()), b.start + 2.5);
      await step(6);
      await api(`game.scene.getScene('Cooking').debugAddIngredient('herbs')`);
      await step(14);
      await api(`game.scene.getScene('Cooking').debugStir(1000)`); // the pot wobbles through two turns, then sizzle + steam
      await stepUntil(async () => (await labels('Cooking')).includes('Eat'), b.end - 1.2); // the dish pops, NEW RECIPE! ribbon
      await stepTo(b.end);
    },
  },
  {
    n: 7, start: 36, end: 41, caption: 'Night keeps its own time', world: 'fresh-camp-pitched',
    prep: async () => {
      await muted(closeOverlays);
      await cinematic({ weather: 'clear', chrome: false, rings: false });
      await api(`api.setDayT(0.68)`);
      await api(`api.scene.clock.fireLitByPlayer = true; api.scene.clock.applyNow()`);
    },
    run: async (b) => {
      // golden hour to night, a little each frame; the fire stays lit and the moon path appears
      const frames = Math.round((b.end - b.start) * FPS);
      const from = 0.68, to = 1.0;
      for (let i = 1; i <= frames; i++) {
        await api(`api.setDayT(${(from + (to - from) * (i / frames)).toFixed(5)})`);
        await step(1);
      }
      await stepTo(b.end);
    },
  },
  {
    n: 8, start: 41, end: 46, caption: 'Make it yours', world: 'midtrip-camp',
    prep: async () => {
      await cinematic({ time: 'night', weather: 'clear', heroX: LAYOUT.fire - 110, facing: 1 });
      await api(`api.lookAt(${LAYOUT.shopCenter})`);
      await ev((n) => window.__game.director.step(n), 1);
      await api(`api.panTo(${LAYOUT.fire - 160}, 4200)`); // from the gate past the tent (lantern, toran) to the jamun lights
    },
    run: async (b) => { await stepTo(b.end); },
  },
  {
    n: 9, start: 46, end: 51, caption: 'Someone shy', world: 'midtrip-camp',
    prep: () => cinematic({ time: 'dusk', weather: 'clear', heroX: LAYOUT.thicket2 - 130, facing: 1, chrome: true }),
    run: async (b) => {
      await act(`api.companionPeek()`);
      await stepTo(b.start + 1.6);
      // the share path: the Cooking overlay's result, as the companion flow receives it
      await api(`api.scene.events.emit('cooking:closed', { cooked: { dishId: 'herb_tea', isNew: false, action: 'share' } })`);
      await stepTo(b.end);
    },
  },
  {
    n: 10, start: 51, end: 56, caption: '36 stamps to find', world: 'midtrip-camp',
    prep: () => cinematic({ time: 'day', weather: 'clear', chrome: true }),
    run: async (b) => {
      await ev(() => { window.__game.ready = false; });
      await api(`api.scene.scene.launch('Journal', { tab: 'fish' })`);
      await stepUntil(() => ev(() => window.__game.ready === true), b.start + 1.5);
      await stepTo(b.start + 1.4);
      await api(`game.scene.getScene('Journal').turn(1)`);
      await stepTo(b.start + 3.0);
      await api(`game.scene.getScene('Journal').selectTab('recipes')`);
      await stepTo(b.end);
    },
  },
  {
    n: 11, start: 56, end: 61, caption: 'Rain on the tent is a reward', world: 'midtrip-camp',
    prep: async () => {
      await muted(closeOverlays);
      await cinematic({ time: 'afternoon', weather: 'rain', heroX: LAYOUT.tentSpot1 + 150, facing: -1, chrome: true });
    },
    run: async (b) => {
      await act(`api.tap('tent')`); // the Rest / Decorate bubble
      await stepUntil(async () => (await labels('HUD')).includes('Rest'), b.start + 1.8);
      await step(8);
      await press('Rest', 'HUD'); // walks to the doorway and sits, blissful in the rain
      await stepTo(b.end);
    },
  },
  {
    n: 12, start: 61, end: 66, caption: 'The morning says thank you', world: 'midtrip-camp',
    prep: async () => {
      await cinematic({ time: 'dawn', weather: 'clear', heroX: LAYOUT.fire - 150, facing: 1 });
      await api(`api.scene.hero.setExpression('happy')`);
    },
    run: async (b) => {
      await act(`api.playMoment('rainbow')`);
      await stepTo(b.end);
    },
  },
  {
    n: 13, start: 66, end: 72, caption: 'Too big for any fish I know', world: 'midtrip-camp',
    prep: async () => {
      await api(`api.mystery(0)`);
      await cinematic({ time: 'night', weather: 'clear', heroX: LAYOUT.tentSpot1 + 200, facing: 1 });
    },
    run: async (b) => {
      const glow = await act(`api.mysteryGlow()`); // night one: a faint glow far out on the water
      await stepTo(b.start + 3.0);
      await muted(async () => {
        // let the glow finish (and the journal gain clue 1) off camera
        for (let i = 0; i < 60 && !(await isDone(glow)); i++) await ev((n) => window.__game.director.step(n), 5);
        await api(`api.setTime('dawn')`);
        await api(`api.mysterySparkle()`);
        await api(`api.placeHero(${LAYOUT.rockPool - 70 - 170}, 1)`);
        await ev((n) => window.__game.director.step(n), 3);
      });
      await act(`api.tap('mystery-scale')`); // walk over, a pop, the Glimmering Scale card
      await stepTo(b.end);
    },
  },
  {
    n: 14, start: 72, end: 84, caption: '', world: 'finale-camp',
    prep: () => cinematic({ time: 'night', weather: 'rain', heroX: LAYOUT.jettyEnd - 34 - 70, facing: 1 }),
    run: async (b) => {
      // the finale is ~40 s; it is trimmed by muting around its stage markers (finale.ts emits 'finale:stage')
      const t = await act(`api.finale({ skippable: false })`);
      // per stage: frames to skip (muted) once the stage begins, then frames to show; the rest of the stage is muted
      const PLAN = { walk: [0, 60], place: [0, 45], glow: [0, 0], rise: [120, 105], risen: [0, 36], nuzzle: [0, 45], eat: [0, 40], eaten: [0, 0], moonbow: [45, 999], sink: [0, 0], done: [0, 0] };
      const seen = {};
      let stage = null;
      let isMuted = false;
      const setMute = async (m) => { if (m !== isMuted) { isMuted = m; await mute(m); } };
      while (!(await isDone(t))) {
        const f = await frame();
        if (f >= targetFrame(b.end)) break;
        const s = (await api(`api.finaleStage()`)) ?? 'walk';
        if (s !== stage) { stage = s; seen[s] = 0; }
        const [skip, show] = PLAN[stage] ?? [0, 0];
        const k = seen[stage];
        const visible = k >= skip && k < skip + show;
        await setMute(!visible);
        await ev((n) => window.__game.director.step(n), 1);
        if (visible && pending && (await frame()) >= pending.frame) { const p = pending; pending = null; await check(p.name); }
        seen[stage] = k + 1;
      }
      await setMute(false);
      await stepTo(b.end);
    },
  },
  {
    n: 15, start: 84, end: 88, caption: 'Seven days go by fast', world: 'album',
    prep: async () => {},
    run: async (b) => {
      await stepTo(b.start + 0.9); // the cover settles
      await api(`game.scene.getScene('Album').jumpTo(-2)`); // the mystery page
      await step(10);
      await api(`game.scene.getScene('Album').turn(1)`); // one flip onto the postcard
      await stepTo(b.end);
    },
  },
  {
    n: 16, start: 88, end: 90, caption: '', world: 'midtrip-camp',
    prep: () => cinematic({ time: 'dusk', weather: 'clear', heroX: LAYOUT.fire - 110, facing: 1 }),
    run: async (b) => {
      await titleCard(true);
      await stepTo(b.end);
    },
  },
];

async function playBeat(b) {
  await ensureWorld(b.world);
  await muted(async () => { await b.prep(); });
  if (ONLY) offset = (await frame()) / FPS - b.start; // filtered runs: the beat starts now
  else await holdUntil(b.start);
  const beatMs = (b.end - b.start) * 1000;
  pending = { frame: targetFrame((b.start + b.end) / 2), name: `beat-${String(b.n).padStart(2, '0')}` };
  if (b.caption) await caption(b.caption, beatMs - 300); // in over 300 ms, out 300 ms before the end
  const f0 = await frame();
  await b.run(b);
  if (pending) { const p = pending; pending = null; await check(p.name); }
  const f1 = await frame();
  console.log(`[trailer] beat ${b.n} ${fmt(b.start)}-${fmt(b.end)} ${((f1 - f0) / FPS).toFixed(2)} s rendered (timeline at ${fmt(f1 / FPS - offset)})`);
}
/** hold the current picture until the global timeline reaches the beat's timecode (no-op when already past) */
async function holdUntil(seconds) {
  const target = Math.round(seconds * FPS);
  let f = await frame();
  while (f < target) f = await step(Math.min(10, target - f));
}
function fmt(s) {
  const tenths = Math.round((s % 1) * 10);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}${tenths ? `.${tenths}` : ''}`;
}

// ---------- boot ----------
const url = `http://127.0.0.1:${PORT}/?debug=1&noaudio=1&director=1&state=midtrip&scene=camp&time=dusk`;
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.director && window.__game.api, null, { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
const info = await ev((o) => window.__game.director.begin(o), { fps: FPS, width: W, height: H, masterKbps: 4000, webKbps: 1100 });
console.log('[trailer] director began', JSON.stringify(info));
const t0 = Date.now();

let failed = false;
try {
  if (TEST) {
    // 4 s proof: dusk camp with a caption, then the title card
    await hud(false);
    await caption('Seven days. A quiet lake.');
    await step(60);
    await check('test-01');
    await caption('');
    await titleCard(true);
    await step(60);
    await check('test-02');
  } else {
    for (const b of BEATS) {
      if (ONLY && !ONLY.has(b.n)) continue;
      await playBeat(b);
    }
    if (!ONLY) await holdUntil(90);
  }
} catch (e) {
  failed = true;
  console.error(`[trailer] ${e.stack ?? e.message ?? e}`);
}

const out = await ev(() => window.__game.director.finish());
await writeFile(masterPath, Buffer.from(out.master, 'base64'));
await writeFile(webPath, Buffer.from(out.web, 'base64'));
const mb = (b64) => (b64.length * 0.75 / 1e6).toFixed(1);
console.log(`[trailer] ${out.frames} frames, ${out.seconds.toFixed(2)} s in ${((Date.now() - t0) / 60000).toFixed(1)} min -> ${path.relative(root, masterPath)} (${mb(out.master)} MB), ${path.relative(root, webPath)} (${mb(out.web)} MB)`);
if (errors.length) console.error('[trailer] console errors:\n  ' + errors.slice(0, 10).join('\n  '));
await browser.close();
await server.close();
process.exit(failed ? 1 : 0);

// ---------- --verify: decode the finished WebM in a browser and save stills ----------
async function verify(videoPath) {
  const stamps = AT && AT.length ? AT : [8, 32, 78, 89];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const html = `<!doctype html><html><body style="margin:0;background:#000"><video id="v" src="${pathToFileURL(videoPath).href}" width="${W}" height="${H}" muted preload="auto"></video></body></html>`;
  const htmlPath = path.join(os.tmpdir(), 'little-monsoon-trailer-verify.html');
  await writeFile(htmlPath, html);
  await p.goto(pathToFileURL(htmlPath).href);
  const duration = await p.evaluate(() => new Promise((res, rej) => {
    const v = document.getElementById('v');
    if (v.readyState >= 1) { res(v.duration); return; }
    v.addEventListener('loadedmetadata', () => res(v.duration), { once: true });
    v.addEventListener('error', () => rej(new Error(`video error ${v.error?.code}`)), { once: true });
  }));
  console.log(`[verify] ${path.relative(root, videoPath)} duration ${Number.isFinite(duration) ? duration.toFixed(2) + ' s' : String(duration)}`);
  for (const t of stamps) {
    await p.evaluate((sec) => new Promise((res, rej) => {
      const v = document.getElementById('v');
      v.addEventListener('seeked', () => res(), { once: true });
      v.addEventListener('error', () => rej(new Error('video error')), { once: true });
      v.currentTime = sec;
    }), t);
    await p.waitForTimeout(150);
    const name = `verify-${String(Math.floor(t / 60))}m${String((t % 60).toFixed(1).replace(/\.0$/, '')).padStart(2, '0')}s.png`;
    await p.locator('#v').screenshot({ path: path.join(checkDir, name) });
    console.log(`[verify] ${fmt(t)} -> marketing/trailer/checks/${name}`);
  }
  await b.close();
}
