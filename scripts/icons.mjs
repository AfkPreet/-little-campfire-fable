// npm run icons -- renders the app icons (32, 180, 192, 512) from Chikki's face and the 1200x630 social image using the game's own art code.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5197;
const base = `http://127.0.0.1:${PORT}/`;
const out = (f) => path.join(root, 'public', f);

const server = await createServer({ root, server: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
try {
  // Icon board draws at logical (0,0)-(256,256). With a 1280x720 CSS viewport, 1 logical px = 1 CSS px, so the
  // device scale factor sets the output size: 256 * dsf.
  const ICONS = [
    { file: 'icon-512.png', dsf: 2 },
    { file: 'icon-192.png', dsf: 0.75 },
    { file: 'apple-touch-icon.png', dsf: 180 / 256 },
    { file: 'icon-32.png', dsf: 32 / 256 },
  ];
  for (const ic of ICONS) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: ic.dsf });
    const page = await ctx.newPage();
    await page.goto(`${base}?debug=1&noaudio=1&scene=styleboard&board=icon`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game && window.__game.ready === true, null, { timeout: 30000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: out(ic.file), clip: { x: 0, y: 0, width: 256, height: 256 } });
    console.log(`[icons] public/${ic.file} (${Math.round(256 * ic.dsf)} px)`);
    await ctx.close();
  }
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${base}?debug=1&noaudio=1&scene=styleboard&board=social`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: out('social.png') });
  console.log('[icons] public/social.png (1200x630)');
  await ctx.close();
} finally {
  await browser.close();
  await server.close();
}
