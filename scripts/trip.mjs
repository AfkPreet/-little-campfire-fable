// npm run trip -- plays a whole trip (Days 1-7) headlessly through window.__game.api, checks that the Trip Album
// opens, that "Stay a little longer" returns to Camp on Day 8 and that "Start a new trip" resets money and gear while
// keeping the journal. Fails on any console error. Cross-platform: pure Node + Playwright.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5197;
const base = `http://127.0.0.1:${PORT}/`;
const TRIP_DAYS = 7;
/** one species per day so the journal fills (the force skips the season roll) */
const SPECIES = ['minnow', 'carp', 'trout', 'perch', 'loach', 'koi', 'glowfin'];

const server = await createServer({ root, server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

const step = async (name, fn) => {
  process.stdout.write(`[trip] ${name} ... `);
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
const waitScene = (key) => page.waitForFunction((k) => window.__game && window.__game.scene === k, key, { timeout: 30000 });
const waitDay = (day) => page.waitForFunction((d) => window.__game.api.state().day === d, day, { timeout: 30000 });
const summary = () => api(`(() => { const s = window.__game.api.state(); return { day: s.day, money: s.money, fish: Object.keys(s.journal.fish).length, recipes: Object.keys(s.journal.recipes).length, dishes: s.inventory.dishes.length }; })()`);

let failed = false;
try {
  await step('open camp fresh', async () => {
    await page.goto(`${base}?debug=1&noaudio=1&state=fresh&scene=camp&time=day`, { waitUntil: 'load' });
    await waitReady();
    await waitApi();
  });
  // Day 1: shop essentials, pitch, forage, fish, cook, eat, sleep
  await step('day 1: buy essentials', () => api(`window.__game.api.buyEssentials()`));
  await step('day 1: pitch tent', async () => { if (!(await api(`window.__game.api.pitchTent(1)`))) throw new Error('pitchTent failed'); });
  await step('day 1: forage', async () => { const r = await api(`window.__game.api.forage()`); if (!r) throw new Error('forage returned null'); return r; });
  await step('day 1: fish', () => api(`window.__game.api.fish({ force: '${SPECIES[0]}' })`));
  await step('day 1: cook', async () => { const d = await api(`window.__game.api.cook('kettle', ['herbs'])`); if (!d) throw new Error('cook returned null'); return d; });
  await step('day 1: eat', async () => { const c = await api(`window.__game.api.eatLastDish()`); if (c === null) throw new Error('nothing to eat'); return c; });
  await step('day 1: sleep', async () => { await api(`window.__game.api.sleep()`); await waitDay(2); });

  // Days 2-7: forage + fish (varied species) + cook (tea or grilled fish) + sleep
  await step('day 2: buy a tawa', async () => { if (!(await api(`window.__game.api.buy('skillet')`))) throw new Error('buy failed'); });
  for (let day = 2; day <= TRIP_DAYS; day++) {
    const species = SPECIES[(day - 1) % SPECIES.length];
    await step(`day ${day}: forage`, async () => { const r = await api(`window.__game.api.forage()`); if (!r) throw new Error('forage returned null'); return r; });
    await step(`day ${day}: fish ${species}`, () => api(`window.__game.api.fish({ force: '${species}' })`));
    const grill = day % 2 === 0;
    await step(`day ${day}: cook ${grill ? 'grilled fish' : 'tea'}`, async () => {
      const d = await api(grill ? `window.__game.api.cook('skillet', ['any_fish'])` : `window.__game.api.cook('kettle', ['herbs'])`);
      if (!d) throw new Error('cook returned null');
      return d;
    });
    await step(`day ${day}: eat`, async () => { const c = await api(`window.__game.api.eatLastDish()`); if (c === null) throw new Error('nothing to eat'); return c; });
    const before = await summary();
    if (before.fish < Math.min(day, SPECIES.length) || before.recipes < 1) throw new Error(`journal did not fill: ${JSON.stringify(before)}`);
    await step(`day ${day}: sleep`, async () => {
      await api(`window.__game.api.sleep()`);
      if (day < TRIP_DAYS) await waitDay(day + 1);
    });
  }

  // Night 7 -> the Trip Album
  await step('album opens after night 7', async () => { await waitScene('Album'); await waitReady(); return summary(); });
  const albumState = await summary();
  if (albumState.day !== TRIP_DAYS + 1) throw new Error(`expected day ${TRIP_DAYS + 1} in the album, got ${albumState.day}`);
  const journalBefore = { fish: albumState.fish, recipes: albumState.recipes };

  // "Stay a little longer": free play on Day 8
  await step('stay a little longer', async () => {
    const ok = await api(`window.__game.api.stayLonger()`);
    if (!ok) throw new Error('stayLonger did not reach Camp');
    await waitScene('Camp');
    await page.waitForFunction(() => window.__game.api && window.__game.api.scene.scene.isActive(), null, { timeout: 30000 });
    await page.waitForTimeout(800);
    const s = await summary();
    if (s.day !== TRIP_DAYS + 1) throw new Error(`expected day ${TRIP_DAYS + 1} back at camp, got ${s.day}`);
    return s;
  });
  await step('day 8: forage still works', async () => { const r = await api(`window.__game.api.forage()`); if (!r) throw new Error('forage returned null'); return r; });

  // Back to the album (as the Journal's Trip tab does), then "Start a new trip"
  await step('reopen album', async () => {
    await api(`window.__game.game.scene.start('Album')`);
    await waitScene('Album');
    await page.waitForTimeout(600);
  });
  await step('start a new trip', async () => {
    const ok = await api(`window.__game.api.newTrip()`);
    if (!ok) throw new Error('newTrip did not reach Intro');
    await waitScene('Intro');
    const s = await api(`(() => { const s = window.__game.api.state(); return { day: s.day, trip: s.trip, money: s.money, gear: Object.values(s.inventory.gear).filter(Boolean).length, fish: Object.keys(s.journal.fish).length, recipes: Object.keys(s.journal.recipes).length, pitched: s.camp.pitched, tripPages: s.journal.trip.length }; })()`);
    if (s.day !== 1 || s.trip !== 2) throw new Error(`new trip did not reset the day/trip: ${JSON.stringify(s)}`);
    if (s.gear !== 0 || s.pitched) throw new Error(`gear or camp did not reset: ${JSON.stringify(s)}`);
    if (s.fish !== journalBefore.fish || s.recipes !== journalBefore.recipes) throw new Error(`journal was not kept: ${JSON.stringify(s)} vs ${JSON.stringify(journalBefore)}`);
    if (s.tripPages !== 0) throw new Error(`trip pages should start empty: ${s.tripPages}`);
    return s;
  });
} catch (e) {
  failed = true;
  console.error(`[trip] ${e.message ?? e}`);
} finally {
  await browser.close();
  await server.close();
}
if (errors.length) {
  failed = true;
  console.error('[trip] console errors:\n  ' + errors.join('\n  '));
}
console.log(failed ? '[trip] FAILED' : '[trip] passed');
process.exit(failed ? 1 : 0);
