// npm run smoke -- plays Day 1 headlessly through the debug API (window.__game.api), reloads, and checks the save.
// Fails on any console error. Cross-platform: pure Node + Playwright.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5198;
const base = `http://127.0.0.1:${PORT}/`;

const server = await createServer({ root, server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

const step = async (name, fn) => {
  process.stdout.write(`[smoke] ${name} ... `);
  try {
    const r = await fn();
    console.log('ok' + (r !== undefined ? ` (${JSON.stringify(r)})` : ''));
    return r;
  } catch (e) {
    console.log('FAIL');
    throw e;
  }
};
const api = (expr) => page.evaluate(expr);
const waitReady = () => page.waitForFunction(() => window.__game && window.__game.ready === true, null, { timeout: 30000 });
const waitApi = () => page.waitForFunction(() => window.__game && window.__game.api, null, { timeout: 30000 });

let failed = false;
try {
  await step('open camp fresh', async () => {
    await page.goto(`${base}?debug=1&noaudio=1&state=fresh&scene=camp&time=day`, { waitUntil: 'load' });
    await waitReady();
    await waitApi();
  });
  await step('buy essentials', () => api(`window.__game.api.buyEssentials()`));
  await step('pitch tent', () => api(`window.__game.api.pitchTent(1)`));
  await step('forage', () => api(`window.__game.api.forage()`));
  await step('fish', () => api(`window.__game.api.fish({ force: 'minnow' })`));
  await step('cook', () => api(`window.__game.api.cook('kettle', ['herbs'])`));
  await step('eat', () => api(`window.__game.api.eatLastDish()`));
  const before = await step('state before sleep', () => api(`(() => { const s = window.__game.api.state(); return { day: s.day, money: s.money, recipes: Object.keys(s.journal.recipes).length, fish: Object.keys(s.journal.fish).length }; })()`));
  if (before.recipes < 1 || before.fish < 1) throw new Error('cooking or fishing did not register in the journal');
  await step('sleep', () => api(`window.__game.api.sleep()`));
  await step('day 2 dawn', () => page.waitForFunction(() => window.__game.api.state().day === 2, null, { timeout: 30000 }));
  await step('flush save', () => api(`window.__game.api.saveNow()`));
  await step('reload and continue', async () => {
    await page.goto(`${base}?debug=1&noaudio=1&scene=camp`, { waitUntil: 'load' });
    await waitReady();
    await waitApi();
    const s = await api(`(() => { const s = window.__game.api.state(); return { day: s.day, pitched: s.camp.pitched, recipes: Object.keys(s.journal.recipes).length }; })()`);
    if (s.day !== 2 || !s.pitched || s.recipes < 1) throw new Error(`save did not resume: ${JSON.stringify(s)}`);
    return s;
  });
} catch (e) {
  failed = true;
  console.error(`[smoke] ${e.message ?? e}`);
} finally {
  await browser.close();
  await server.close();
}
if (errors.length) {
  failed = true;
  console.error('[smoke] console errors:\n  ' + errors.join('\n  '));
}
console.log(failed ? '[smoke] FAILED' : '[smoke] passed');
process.exit(failed ? 1 : 0);
