// npm run ad:render -- records marketing/ad/index.html as a 1920x1080 WebM (15 s loop) with Playwright.
// Convert to MP4 on a machine with a full ffmpeg:  ffmpeg -i little-monsoon-ad-16x9.webm -c:v libx264 -pix_fmt yuv420p little-monsoon-ad-16x9.mp4
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'marketing', 'ad');
const out = path.join(root, 'render');
await mkdir(out, { recursive: true });
const types = { '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  const p = req.url.split('?')[0].split('#')[0];
  const file = path.join(root, p === '/' ? 'index.html' : p);
  try { const data = await readFile(file); res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(5194, '127.0.0.1', r));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, recordVideo: { dir: out, size: { width: 1920, height: 1080 } } });
const page = await context.newPage();
await page.goto('http://127.0.0.1:5194/#video', { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);
await page.evaluate(() => document.getElementById('replay').click());
await page.waitForTimeout(15800);
const video = page.video();
await context.close();
const file = await video.path();
const dest = path.join(out, 'little-monsoon-ad-16x9.webm');
await rename(file, dest);
console.log('[ad] rendered', path.relative(process.cwd(), dest));
await browser.close();
server.close();
