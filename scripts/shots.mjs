// npm run shots [milestone] -- starts the game (vite dev) and saves screenshots to shots/<milestone>/ using the debug hooks.
// Cross-platform: pure Node + Playwright. Viewports: iPad landscape 1180x820 @2x and phone landscape 844x390 @2x.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const milestone = process.argv[2] ?? 'm0';
const only = process.argv[3]; // optional substring filter on shot names

const VIEWPORTS = {
  ipad: { width: 1180, height: 820, deviceScaleFactor: 2 },
  phone: { width: 844, height: 390, deviceScaleFactor: 2 },
};

// Shot list grows as milestones land. Each entry: name, url query, settle ms.
const SHOTS = {
  m0: [
    { name: 'board-palette', q: 'scene=styleboard&board=palette' },
    { name: 'board-characters', q: 'scene=styleboard&board=characters' },
    { name: 'board-ui', q: 'scene=styleboard&board=ui' },
    { name: 'board-npcs', q: 'scene=styleboard&board=npcs', settle: 1200 },
    { name: 'board-hero', q: 'scene=styleboard&board=hero', settle: 1400 },
    { name: 'board-fx', q: 'scene=styleboard&board=fx' },
    { name: 'board-landscape', q: 'scene=styleboard&board=landscape', settle: 1500 },
    { name: 'camp-day', q: 'scene=styleboard&board=camp&time=day', settle: 1500 },
    { name: 'camp-golden', q: 'scene=styleboard&board=camp&time=golden', settle: 1500 },
    { name: 'camp-night', q: 'scene=styleboard&board=camp&time=night', settle: 1500 },
    { name: 'camp-rain', q: 'scene=styleboard&board=camp&time=day&weather=rain', settle: 1500 },
    { name: 'camp-dawn-mist', q: 'scene=styleboard&board=camp&time=dawn&weather=mist', settle: 1500 },
  ],
  m1: [
    { name: 'title', q: 'scene=title', settle: 1200 },
    { name: 'intro', q: 'scene=intro', settle: 800 },
    { name: 'shop', q: 'scene=shop&state=fresh', settle: 900 },
    { name: 'camp-day', q: 'scene=camp&state=midtrip&time=day', settle: 1500 },
    { name: 'camp-night', q: 'scene=camp&state=midtrip&time=night', settle: 1500 },
    { name: 'cooking', q: 'scene=cooking&state=midtrip', settle: 900 },
    { name: 'day-summary', q: 'scene=daysummary&state=midtrip', settle: 2600 },
  ],
  m2: [
    { name: 'journal-fish', q: 'scene=journal&state=midtrip&tab=fish', settle: 900 },
    { name: 'journal-recipes', q: 'scene=journal&state=midtrip&tab=recipes', settle: 900 },
    { name: 'journal-mystery', q: 'scene=journal&state=midtrip&tab=mystery', settle: 900 },
    { name: 'companion-peek', q: 'scene=camp&state=midtrip&time=dusk&peek=1', settle: 4500 },
    { name: 'moment-rainbow', q: 'scene=camp&state=midtrip&time=dawn&moment=rainbow', settle: 5000 },
    { name: 'moment-shooting-star', q: 'scene=camp&state=midtrip&time=night&moment=shooting_star', settle: 5000 },
    { name: 'decorated-camp-night', q: 'scene=camp&state=midtrip&time=night', settle: 1500 },
    { name: 'decor-mode', q: 'scene=camp&state=midtrip&time=day&decor=1', settle: 3000 },
  ],
  m3: [
    { name: 'mystery-glow', q: 'scene=camp&state=fresh&time=night&mystery=0&glow=1', settle: 3000 },
    { name: 'scale-sparkle', q: 'scene=camp&state=midtrip&time=dawn&mystery=1&scale=1', settle: 2500 },
    { name: 'legend', q: 'scene=shop&state=midtrip&mystery=2', settle: 2500 },
    { name: 'finale-rise', q: 'scene=camp&state=finale&finale=rise', settle: 9000 },
    { name: 'finale-moonbow', q: 'scene=camp&state=finale&finale=moonbow', settle: 10000 },
    { name: 'album-cover', q: 'scene=album&state=midtrip', settle: 900 },
    { name: 'album-day', q: 'scene=album&state=midtrip&page=2', settle: 900 },
    { name: 'album-postcard', q: 'scene=album&state=midtrip&page=last', settle: 900 },
  ],
  // M4: the final shot list (spec section 11)
  m4: [
    { name: 'title', q: 'scene=title', settle: 1200 },
    { name: 'intro', q: 'scene=intro', settle: 800 },
    { name: 'shop', q: 'scene=shop&state=fresh', settle: 900 },
    { name: 'camp-dawn', q: 'scene=camp&state=midtrip&time=dawn', settle: 1500 },
    { name: 'camp-day', q: 'scene=camp&state=midtrip&time=day', settle: 1500 },
    { name: 'camp-golden', q: 'scene=camp&state=midtrip&time=golden', settle: 1500 },
    { name: 'camp-dusk', q: 'scene=camp&state=midtrip&time=dusk', settle: 1500 },
    { name: 'camp-night', q: 'scene=camp&state=midtrip&time=night', settle: 1500 },
    { name: 'camp-rain', q: 'scene=camp&state=midtrip&time=day&weather=rain', settle: 1500 },
    { name: 'fishing-bite', q: 'scene=camp&state=midtrip&time=day&bite=1', settle: 1400 },
    { name: 'catch-card', q: 'scene=camp&state=midtrip&catch=1', settle: 1400 },
    { name: 'cooking-result', q: 'scene=cooking&state=midtrip&cooked=herb_tea', settle: 1200 },
    { name: 'decorated-camp-night', q: 'scene=camp&state=midtrip&time=night', settle: 1500 },
    { name: 'journal-fish', q: 'scene=journal&state=midtrip&tab=fish', settle: 900 },
    { name: 'mystery-finale', q: 'scene=camp&state=finale&finale=moonbow', settle: 10000 },
    { name: 'album-postcard', q: 'scene=album&state=midtrip&page=last', settle: 900 },
  ],
  // Accessibility check: Reduce motion forced on
  a11y: [
    { name: 'camp-night-reducemotion', q: 'scene=camp&state=midtrip&time=night&reducemotion=1', settle: 1500 },
    { name: 'cooking-reducemotion', q: 'scene=cooking&state=midtrip&reducemotion=1', settle: 1200 },
    { name: 'cooking-result-reducemotion', q: 'scene=cooking&state=midtrip&cooked=herb_tea&reducemotion=1', settle: 1200 },
  ],
};

const list = (SHOTS[milestone] ?? SHOTS.m0).filter((s) => !only || s.name.includes(only));
const outDir = path.join(root, 'shots', milestone);
await mkdir(outDir, { recursive: true });

const server = await createServer({ root, server: { port: 5199, strictPort: true, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:5199/`;

const browser = await chromium.launch();
let failures = 0;
try {
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, hasTouch: true, isMobile: false });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    for (const shot of list) {
      const url = `${base}?debug=1&noaudio=1&freeze=1&${shot.q}`;
      await page.goto(url, { waitUntil: 'load' });
      try {
        await page.waitForFunction(() => window.__game && window.__game.ready === true, null, { timeout: 20000 });
      } catch {
        console.warn(`[shots] ${shot.name}@${vpName}: ready flag never set (timeout)`);
        failures++;
      }
      await page.waitForTimeout(shot.settle ?? 600);
      const file = path.join(outDir, `${shot.name}-${vpName}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(`[shots] ${path.relative(root, file)}`);
    }
    if (errors.length) {
      failures++;
      console.warn(`[shots] console errors @${vpName}:\n  ` + errors.join('\n  '));
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(failures ? `[shots] done with ${failures} warning(s)` : '[shots] done, no console errors');
process.exit(failures ? 1 : 0);
