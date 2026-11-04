// npm run trailer:audio [--test] -- lays music and voice-over under the finished trailer renders.
//
// Inputs in marketing/trailer/audio/ (mp3, wav or ogg; any missing file is skipped):
//   music-day.*      0:00-0:38, crossfades into the night cue over 0:36-0:38
//   music-night.*    0:36-1:14, crossfades into the finale over 1:12-1:14
//   music-finale.*   1:12-1:30, fades out over the last two seconds
//   vo-01.* .. vo-16.*   one line per beat (TRAILER.md), trimmed of silence and placed at the beat's start; a line is
//                        pushed later when the previous one overruns, and the last lines are pulled earlier so the read
//                        ends before the picture does. The music ducks 6 dB under each line.
// The mix is rendered by headless Chromium (OfflineAudioContext), encoded to Opus (WebCodecs) and muxed by webm-muxer
// into render/little-monsoon-trailer-audio.webm; ffmpeg then stream-copies it under the silent renders
// (kept as *-silent.webm). --test renders a synthetic bed instead, to prove the chain without any audio files.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const TEST = args.includes('--test');
const PORT = 5196;
const END = 90; // the trailer's length in seconds
const SR = 48000;
const LEVELS = { music: 0.45, duck: 0.5, vo: 0.95 };
const BEAT_STARTS = [0, 5, 11, 17, 22, 29, 36, 41, 46, 51, 56, 61, 66, 72, 84, 88];
const MUSIC_PLAN = [
  { name: 'music-day', at: 0, fadeIn: null, fadeOut: [36, 38] },
  { name: 'music-night', at: 36, fadeIn: [36, 38], fadeOut: [72, 74] },
  { name: 'music-finale', at: 72, fadeIn: [72, 73], fadeOut: [88, 90] },
];
const audioDir = path.join(root, 'marketing', 'trailer', 'audio');
const renderDir = path.join(root, 'marketing', 'trailer', 'render');
await mkdir(audioDir, { recursive: true });
await mkdir(renderDir, { recursive: true });

// ---------- which files exist ----------
const present = existsSync(audioDir) ? await readdir(audioDir) : [];
const find = (base) => present.find((f) => /\.(mp3|wav|ogg|opus|m4a|flac)$/i.test(f) && f.replace(/\.[^.]+$/, '') === base) ?? null;
const music = MUSIC_PLAN.map((m) => ({ ...m, file: find(m.name) })).filter((m) => m.file);
const vo = BEAT_STARTS.map((beat, i) => ({ n: i + 1, beat, file: find(`vo-${String(i + 1).padStart(2, '0')}`) })).filter((v) => v.file);
if (!TEST && !music.length && !vo.length) {
  console.error('[audio] nothing to mix: put music-day/night/finale and vo-01..16 files in marketing/trailer/audio/ (see TRAILER.md), or run with --test');
  process.exit(1);
}
console.log(`[audio] ${TEST ? 'test bed; ' : ''}music: ${music.map((m) => m.file).join(', ') || 'none'}; voice lines: ${vo.length}`);

// ---------- render the mix in the browser ----------
const server = await createServer({ root, server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.route('**/_mix.html', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>mix</title>' }));
await page.goto(`http://127.0.0.1:${PORT}/_mix.html`);
const result = await page.evaluate(async ({ END, SR, LEVELS, music, vo, test, muxerUrl }) => {
  const { Muxer, ArrayBufferTarget } = await import(muxerUrl);
  const ctx = new OfflineAudioContext(2, Math.ceil(END * SR), SR);
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -12; master.knee.value = 12; master.ratio.value = 4; master.attack.value = 0.01; master.release.value = 0.2;
  master.connect(ctx.destination);
  const musicBus = ctx.createGain(); musicBus.gain.value = 1; musicBus.connect(master);
  const voBus = ctx.createGain(); voBus.gain.value = LEVELS.vo; voBus.connect(master);
  const load = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return ctx.decodeAudioData(await r.arrayBuffer()); };
  const bounds = (buf, thr = 0.012) => {
    const chans = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
    const loud = (i) => chans.some((c) => Math.abs(c[i]) > thr);
    let s = 0, e = buf.length - 1;
    while (s < e && !loud(s)) s++;
    while (e > s && !loud(e)) e--;
    return { start: s / buf.sampleRate, end: (e + 1) / buf.sampleRate };
  };
  const placed = { music: [], vo: [] };
  if (test) {
    const tone = (hz, at, dur, level) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level, at + 0.4);
      g.gain.setValueAtTime(level, at + dur - 0.4); g.gain.linearRampToValueAtTime(0, at + dur);
      o.connect(g).connect(musicBus); o.start(at); o.stop(at + dur);
    };
    tone(146.83, 0, 36, 0.18); tone(110, 36, 36, 0.18); tone(220, 72, 18, 0.12);
    placed.music.push({ name: 'test tones', at: 0, dur: END });
  }
  for (const m of music) {
    const buf = await load(m.url);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(m.fadeIn ? 0 : LEVELS.music, m.at);
    if (m.fadeIn) g.gain.linearRampToValueAtTime(LEVELS.music, m.fadeIn[1]);
    if (m.fadeOut) { g.gain.setValueAtTime(LEVELS.music, m.fadeOut[0]); g.gain.linearRampToValueAtTime(0, m.fadeOut[1]); }
    src.connect(g).connect(musicBus);
    src.start(m.at);
    src.stop(Math.min(END, m.at + buf.duration));
    placed.music.push({ name: m.name, at: m.at, dur: +buf.duration.toFixed(2) });
  }
  const clips = [];
  for (const v of vo) { const buf = await load(v.url); const b = bounds(buf); clips.push({ ...v, buf, off: b.start, dur: b.end - b.start }); }
  const GAP = 0.35;
  const t = [];
  for (let i = 0; i < clips.length; i++) t[i] = Math.max(clips[i].beat, i ? t[i - 1] + clips[i - 1].dur + GAP : 0);
  for (let i = clips.length - 1; i >= 0; i--) {
    const limit = (i < clips.length - 1 ? t[i + 1] : END) - GAP - clips[i].dur;
    if (t[i] > limit) t[i] = Math.max(0, limit);
  }
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const src = ctx.createBufferSource(); src.buffer = c.buf; src.connect(voBus);
    src.start(t[i], c.off, c.dur);
    musicBus.gain.setTargetAtTime(LEVELS.duck, Math.max(0, t[i] - 0.2), 0.08);
    musicBus.gain.setTargetAtTime(1, t[i] + c.dur + 0.15, 0.15);
    placed.vo.push({ n: c.n, beat: c.beat, at: +t[i].toFixed(2), dur: +c.dur.toFixed(2) });
  }
  const rendered = await ctx.startRendering();
  const muxer = new Muxer({ target: new ArrayBufferTarget(), audio: { codec: 'A_OPUS', numberOfChannels: 2, sampleRate: SR }, firstTimestampBehavior: 'offset' });
  let encErr = null;
  const enc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { encErr = e; } });
  enc.configure({ codec: 'opus', sampleRate: SR, numberOfChannels: 2, bitrate: 128000 });
  const FRAME = 960;
  const L = rendered.getChannelData(0), R = rendered.getChannelData(1);
  for (let i = 0; i < rendered.length; i += FRAME) {
    const n = Math.min(FRAME, rendered.length - i);
    const data = new Float32Array(n * 2);
    data.set(L.subarray(i, i + n), 0);
    data.set(R.subarray(i, i + n), n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i * 1e6) / SR), data });
    enc.encode(ad);
    ad.close();
  }
  await enc.flush();
  enc.close();
  if (encErr) throw encErr;
  muxer.finalize();
  const bytes = new Uint8Array(muxer.target.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { base64: btoa(bin), placed, seconds: rendered.duration };
}, {
  END, SR, LEVELS, test: TEST,
  music: music.map((m) => ({ ...m, url: `/marketing/trailer/audio/${m.file}` })),
  vo: vo.map((v) => ({ ...v, url: `/marketing/trailer/audio/${v.file}` })),
  muxerUrl: '/node_modules/webm-muxer/build/webm-muxer.mjs',
});
await browser.close();
await server.close();
if (errors.length) console.warn('[audio] page errors:', errors.join('\n'));

const audioPath = path.join(renderDir, TEST ? 'little-monsoon-trailer-audiotest.webm' : 'little-monsoon-trailer-audio.webm');
await writeFile(audioPath, Buffer.from(result.base64, 'base64'));
console.log(`[audio] ${result.seconds.toFixed(2)} s mixed -> ${path.relative(root, audioPath)} (${((await stat(audioPath)).size / 1e6).toFixed(1)} MB)`);
for (const m of result.placed.music) console.log(`[audio]   music ${m.name} at ${m.at}s (${m.dur}s)`);
for (const v of result.placed.vo) console.log(`[audio]   vo ${String(v.n).padStart(2, '0')} beat ${v.beat}s -> ${v.at}s for ${v.dur}s${v.at !== v.beat ? ' (moved)' : ''}`);

// ---------- remux with ffmpeg: video stream copied, the new audio beside it ----------
function findFfmpeg() {
  const candidates = [];
  if (process.env.FFMPEG) candidates.push(process.env.FFMPEG);
  candidates.push('ffmpeg');
  const dirs = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', path.join(os.homedir(), '.cache', 'ms-playwright'), path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'), path.join(process.env.LOCALAPPDATA ?? '', 'ms-playwright')].filter(Boolean);
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const sub of (() => { try { return require('node:fs').readdirSync(d); } catch { return []; } })()) {
      if (!sub.startsWith('ffmpeg')) continue;
      for (const bin of ['ffmpeg-linux', 'ffmpeg-mac', 'ffmpeg-mac-arm64', 'ffmpeg-win64.exe', 'ffmpeg']) candidates.push(path.join(d, sub, bin));
    }
  }
  for (const c of candidates) {
    const r = spawnSync(c, ['-version'], { encoding: 'utf8' });
    if (r.status === 0) return c;
  }
  return null;
}
const require = (await import('node:module')).createRequire(import.meta.url);
const ffmpeg = findFfmpeg();
if (!ffmpeg) {
  console.log('[audio] no ffmpeg found (set FFMPEG=/path/to/ffmpeg); remux by hand:');
  console.log(`  ffmpeg -i little-monsoon-trailer-16x9.webm -i ${path.basename(audioPath)} -map 0:v:0 -map 1:a:0 -c copy -shortest out.webm`);
  process.exit(0);
}
for (const base of ['little-monsoon-trailer-16x9', 'little-monsoon-trailer-16x9-web']) {
  const live = path.join(renderDir, `${base}.webm`);
  const silent = path.join(renderDir, `${base}-silent.webm`);
  if (!existsSync(live) && !existsSync(silent)) continue;
  if (!existsSync(silent)) await copyFile(live, silent); // the first run keeps the silent render
  const out = TEST ? path.join(renderDir, `${base}-audiotest.webm`) : live;
  const r = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', silent, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-shortest', out], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`[audio] ffmpeg failed for ${base}: ${r.stderr}`); process.exit(1); }
  const probe = spawnSync(ffmpeg, ['-hide_banner', '-i', out], { encoding: 'utf8' }).stderr;
  const streams = [...probe.matchAll(/Stream #\d+:\d+[^:]*: (\w+): (\w+)/g)].map((m) => `${m[1].toLowerCase()} ${m[2]}`).join(' + ');
  const dur = probe.match(/Duration: (\d+:\d+:\d+\.\d+)/)?.[1] ?? '?';
  console.log(`[audio] ${path.relative(root, out)}: ${streams}, ${dur} (${((await stat(out)).size / 1e6).toFixed(1)} MB)`);
}
