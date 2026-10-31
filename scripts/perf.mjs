// npm run perf -- opens camp at night in the rain (the heaviest frame), waits 5 s and prints the loop FPS, the live
// particle reservation and the texture count. Headless software GL is slow, so this prints and never fails;
// read the numbers relative to each other. Cross-platform: pure Node + Playwright.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5196;
const base = `http://127.0.0.1:${PORT}/`;
const SETTLE_MS = 5000;
const SAMPLES = 5;
const SAMPLE_MS = 500;

const server = await createServer({ root, server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

try {
  await page.goto(`${base}?debug=1&noaudio=1&scene=camp&state=midtrip&time=night&weather=rain`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.ready === true && window.__game.api, null, { timeout: 30000 });
  await page.waitForTimeout(SETTLE_MS);
  const samples = [];
  for (let i = 0; i < SAMPLES; i++) {
    samples.push(await page.evaluate(() => {
      const a = window.__game.api;
      const p = a.particles();
      return { fps: a.fps(), live: p.live, max: p.max, textures: a.textures() };
    }));
    await page.waitForTimeout(SAMPLE_MS);
  }
  const fps = samples.map((s) => s.fps);
  const last = samples[samples.length - 1];
  console.log(`[perf] camp night + rain, after ${SETTLE_MS} ms (headless Chromium, software GL)`);
  console.log(`[perf] fps: min ${Math.min(...fps).toFixed(1)}  max ${Math.max(...fps).toFixed(1)}  mean ${(fps.reduce((a, b) => a + b, 0) / fps.length).toFixed(1)}`);
  console.log(`[perf] particles reserved: ${last.live} / ${last.max}`);
  console.log(`[perf] textures: ${last.textures}`);
  const before = await page.evaluate(() => window.__game.api.textures());
  await page.waitForTimeout(2000);
  const after = await page.evaluate(() => window.__game.api.textures());
  console.log(`[perf] texture count drift over 2 s: ${after - before} (non-zero means textures are created at runtime)`);
} catch (e) {
  console.error(`[perf] ${e.message ?? e}`);
} finally {
  await browser.close();
  await server.close();
}
if (errors.length) console.warn('[perf] console errors:\n  ' + errors.join('\n  '));
console.log('[perf] done');
