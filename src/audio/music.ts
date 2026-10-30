/**
 * music.ts: the music layer. Optional files in public/audio/ (music_day.mp3, music_rain.mp3, music_night.mp3,
 * finale.mp3) are detected at boot; any missing mood falls back to the generative fallbackScore.
 *
 *   await music.init();            // probe the four files (HEAD, then GET + abort); safe to call repeatedly
 *   music.setMood('day');          // 4 s crossfade between decoded loops, or to/from the fallback score
 *   music.setMood('finale');       // finale.mp3 (when present) replaces the loop and plays once
 *   music.setMood('silent');
 *   music.getAvailable();          // { day, rain, night, finale } -> boolean
 *
 * Everything runs through the engine's music bus (which the catch fanfare ducks). Calls before unlock are
 * remembered and applied once the engine is live. No path throws when Web Audio or fetch is unavailable.
 */
import { DEBUG } from '@/config/debug';
import { EPS, engine } from './engine';
import * as fallback from './fallbackScore';
import type { FallbackMood } from './fallbackScore';

export type FileMood = FallbackMood;
export type Mood = FileMood | 'silent';

export const MUSIC_FILES: Record<FileMood, string> = {
  day: 'music_day.mp3',
  rain: 'music_rain.mp3',
  night: 'music_night.mp3',
  finale: 'finale.mp3',
};
export const FILE_MOODS = Object.keys(MUSIC_FILES) as FileMood[];
export const CROSSFADE_SECONDS = 4;

interface Track {
  mood: FileMood;
  src: AudioBufferSourceNode;
  gain: GainNode;
}

const available: Record<FileMood, boolean> = { day: false, rain: false, night: false, finale: false };
const buffers = new Map<FileMood, Promise<AudioBuffer | null>>();
let initPromise: Promise<Record<FileMood, boolean>> | null = null;
let desired: Mood = 'silent';
let current: Track | null = null;
let fallbackMood: FileMood | null = null;
let applySeq = 0;

function urlFor(mood: FileMood): string {
  const base = (import.meta.env.BASE_URL as string | undefined) ?? '/';
  return `${base.endsWith('/') ? base : `${base}/`}audio/${MUSIC_FILES[mood]}`;
}

function looksLikeAudio(r: Response): boolean {
  if (!r.ok) return false;
  const type = (r.headers.get('content-type') ?? '').toLowerCase();
  return !type.includes('text/html');
}

/** Does the file exist? HEAD first; servers that refuse HEAD get a GET that is aborted once headers arrive. */
async function probe(url: string): Promise<boolean> {
  if (typeof fetch !== 'function') return false;
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (r.status !== 405 && r.status !== 501) return looksLikeAudio(r);
  } catch {
    /* fall through to GET */
  }
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  try {
    const r = await fetch(url, { method: 'GET', cache: 'no-store', signal: ac?.signal, headers: { Range: 'bytes=0-1' } });
    const ok = looksLikeAudio(r);
    ac?.abort();
    return ok;
  } catch {
    return false;
  }
}

/** Probe the four files once. Resolves to the availability map (all false without audio or fetch). */
export function init(): Promise<Record<FileMood, boolean>> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!engine.available) return { ...available };
    try {
      const results = await Promise.all(FILE_MOODS.map((m) => probe(urlFor(m))));
      FILE_MOODS.forEach((m, i) => {
        available[m] = results[i];
      });
    } catch (e) {
      if (DEBUG.enabled) console.warn('[music] probe failed', e);
    }
    if (DEBUG.enabled) console.info('[music] files', { ...available });
    // a mood chosen before the probe landed may now have a file
    engine.whenUnlocked(() => void apply());
    return { ...available };
  })();
  return initPromise;
}

function decode(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // callback form works on every browser that has decodeAudioData, promise form included
  return new Promise((resolve, reject) => {
    try {
      const maybe = ctx.decodeAudioData(data, resolve, reject);
      if (maybe && typeof (maybe as Promise<AudioBuffer>).then === 'function') (maybe as Promise<AudioBuffer>).then(resolve, reject);
    } catch (e) {
      reject(e);
    }
  });
}

function loadBuffer(ctx: AudioContext, mood: FileMood): Promise<AudioBuffer | null> {
  let p = buffers.get(mood);
  if (!p) {
    p = (async () => {
      try {
        const r = await fetch(urlFor(mood));
        if (!looksLikeAudio(r)) return null;
        return await decode(ctx, await r.arrayBuffer());
      } catch (e) {
        if (DEBUG.enabled) console.warn('[music] load failed', mood, e);
        return null;
      }
    })();
    buffers.set(mood, p);
  }
  return p;
}

function fadeOutCurrent(fadeSec: number): void {
  const t = current;
  current = null;
  if (!t) return;
  const ctx = engine.context;
  if (!ctx) return;
  const now = ctx.currentTime;
  try {
    t.gain.gain.cancelScheduledValues(now);
    t.gain.gain.setValueAtTime(Math.max(EPS, t.gain.gain.value), now);
    t.gain.gain.linearRampToValueAtTime(EPS, now + fadeSec);
    t.src.stop(now + fadeSec + 0.05);
    t.src.onended = () => {
      try {
        t.src.disconnect();
        t.gain.disconnect();
      } catch {
        /* ignore */
      }
    };
  } catch {
    try {
      t.src.stop();
    } catch {
      /* ignore */
    }
  }
}

function crossfadeTo(ctx: AudioContext, out: AudioNode, mood: FileMood, buf: AudioBuffer): void {
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(EPS, now);
  gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS);
  gain.connect(out);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = mood !== 'finale';
  src.connect(gain);
  src.start(now);
  fadeOutCurrent(CROSSFADE_SECONDS);
  const track: Track = { mood, src, gain };
  current = track;
  if (!src.loop) {
    src.onended = () => {
      if (current === track) current = null;
      try {
        src.disconnect();
        gain.disconnect();
      } catch {
        /* ignore */
      }
    };
  }
}

function startFallback(mood: FileMood): void {
  if (fallbackMood === mood && fallback.isPlaying()) return;
  if (fallbackMood !== null && fallback.isPlaying()) fallback.setMood(mood);
  else fallback.start(mood, CROSSFADE_SECONDS * 0.5);
  fallbackMood = mood;
}

function stopFallback(): void {
  if (fallbackMood === null) return;
  fallbackMood = null;
  fallback.stop(CROSSFADE_SECONDS);
}

async function apply(): Promise<void> {
  const seq = ++applySeq;
  try {
    const avail = await (initPromise ?? init());
    if (seq !== applySeq) return;
    const tap = engine.tap('music');
    if (!tap) return;
    const mood = desired;
    if (mood === 'silent') {
      fadeOutCurrent(CROSSFADE_SECONDS);
      stopFallback();
      return;
    }
    if (!avail[mood]) {
      fadeOutCurrent(CROSSFADE_SECONDS);
      startFallback(mood);
      return;
    }
    if (current?.mood === mood) {
      stopFallback();
      return;
    }
    const buf = await loadBuffer(tap.ctx, mood);
    if (seq !== applySeq) return;
    if (!buf) {
      available[mood] = false;
      fadeOutCurrent(CROSSFADE_SECONDS);
      startFallback(mood);
      return;
    }
    stopFallback();
    crossfadeTo(tap.ctx, tap.out, mood, buf);
  } catch (e) {
    if (DEBUG.enabled) console.warn('[music] apply failed', e);
  }
}

/** Choose the mood. Crossfades 4 s between files, or to/from the fallback score for moods without a file. */
export function setMood(mood: Mood): void {
  desired = mood;
  if (!engine.available) return;
  engine.whenUnlocked(() => void apply());
}

export function getMood(): Mood {
  return desired;
}

/** Which files were found by init() (all false before it resolves). */
export function getAvailable(): Record<FileMood, boolean> {
  return { ...available };
}

/** True when a decoded file (not the fallback) is playing. */
export function isFilePlaying(): boolean {
  return current !== null;
}

export function stop(): void {
  setMood('silent');
}
