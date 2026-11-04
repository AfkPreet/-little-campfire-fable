// npm run trailer:capture [--test] -- renders the 90 s trailer offline from the live game (marketing/trailer/TRAILER.md).
// The game runs in director mode (?director=1): Phaser's loop is stopped and the game is stepped one frame at a time;
// each frame is encoded in-page to VP9/WebM at a true 30 fps. Output: marketing/trailer/render/*.webm and
// marketing/trailer/checks/beat-NN.png. Cross-platform: pure Node + Playwright.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST = process.argv.includes('--test');
const PORT = 5191;
const FPS = 30;
const W = 1280, H = 720;
const renderDir = path.join(root, 'marketing', 'trailer', 'render');
const checkDir = path.join(root, 'marketing', 'trailer', 'checks');
await mkdir(renderDir, { recursive: true });
await mkdir(checkDir, { recursive: true });

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
const step = (frames) => ev((n) => window.__game.director.step(n), frames);
const frame = () => ev(() => window.__game.director.frame());
const caption = (text, holdMs = 0) => ev(([t, h]) => window.__game.director.caption(t, { holdMs: h }), [text, holdMs]);
const hud = (on) => ev((v) => window.__game.director.hud(v), on);
const titleCard = (on) => ev((v) => window.__game.director.titleCard(v), on);
const api = (expr) => ev(expr);
/** start an api action and step until it resolves or maxFrames pass; returns frames used */
async function runUntilDone(expr, maxFrames) {
  const token = await ev((e) => window.__game.director.run(() => eval(e)), expr);
  let used = 0;
  while (used < maxFrames) {
    await step(5); used += 5;
    if (await ev((t) => window.__game.director.isDone(t), token)) break;
  }
  return used;
}
/** hold until the global frame counter reaches a target (seconds * FPS) */
async function holdUntil(seconds) {
  const target = Math.round(seconds * FPS);
  let f = await frame();
  while (f < target) { await step(Math.min(10, target - f)); f = await frame(); }
}
async function check(name) {
  const dataUrl = await ev(() => window.__game.director.snapshot());
  await writeFile(path.join(checkDir, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
}

// ---------- boot ----------
const url = `http://127.0.0.1:${PORT}/?debug=1&noaudio=1&director=1&state=midtrip&scene=camp&time=dusk`;
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.director && window.__game.api, null, { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
const info = await ev((o) => window.__game.director.begin(o), { fps: FPS, width: W, height: H, masterKbps: 4000, webKbps: 1100 });
console.log('[trailer] director began', JSON.stringify(info));

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
    // The sixteen beats of marketing/trailer/TRAILER.md are choreographed here.
    throw new Error('full choreography not written yet: run with --test');
  }
} catch (e) {
  failed = true;
  console.error(`[trailer] ${e.message ?? e}`);
}

const out = await ev(() => window.__game.director.finish());
const masterPath = path.join(renderDir, TEST ? 'test-master.webm' : 'little-monsoon-trailer-16x9.webm');
const webPath = path.join(renderDir, TEST ? 'test-web.webm' : 'little-monsoon-trailer-16x9-web.webm');
await writeFile(masterPath, Buffer.from(out.master, 'base64'));
await writeFile(webPath, Buffer.from(out.web, 'base64'));
console.log(`[trailer] ${out.frames} frames, ${out.seconds.toFixed(2)} s -> ${path.relative(root, masterPath)} (${(out.master.length * 0.75 / 1e6).toFixed(1)} MB), ${path.relative(root, webPath)} (${(out.web.length * 0.75 / 1e6).toFixed(1)} MB)`);
if (errors.length) console.error('[trailer] console errors:\n  ' + errors.slice(0, 10).join('\n  '));
await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
