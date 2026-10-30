/**
 * ambience.ts: continuous beds through the engine's ambience bus, crossfaded by time, weather and position.
 *
 *   ambience.start();
 *   ambience.set({ dayT, rain, nearWater, nearFire, inTent, wind });   // any subset; targets crossfade in 2-4 s
 *   ambience.stop();
 *
 * Beds: birdsong by day (2-3 "birds" with sparse chirps), crickets at night (rhythmic filtered pulses), rain
 * (bandpassed pink noise + random drips, muffled through a lower lowpass in the tent), fire (random short noise
 * bursts + a low rumble bed), wind (lowpassed noise with slow gusts), water lapping (slow filtered swells).
 *
 * Node counts stay small: each bed is a couple of looping noise sources through one or two filters into a bed
 * gain; the random events (chirps, drips, crackles) are scheduled a little ahead by a 200 ms timer. The crackle
 * and cricket beds spike a gain on a continuous source rather than allocating nodes per event.
 * Every call is safe before unlock and when the Web Audio API is missing.
 */
import { DEBUG } from '@/config/debug';
import { EPS, chance, clamp01, engine, rand, randInt, smoothstep } from './engine';

export interface AmbienceInput {
  /** 0 = first light of dawn, 1 = full night (see world/lighting.ts). */
  dayT: number;
  /** Rain intensity 0..1. */
  rain: number;
  /** How close the hero is to the water, 0..1. */
  nearWater: number;
  /** How close the hero is to the campfire, 0..1 (0 when it is unlit). */
  nearFire: number;
  /** In the tent doorway: muffles everything, rain most of all. Boolean or 0..1. */
  inTent: number | boolean;
  /** Wind strength 0..1. */
  wind: number;
}

export type BedName = 'birds' | 'crickets' | 'rain' | 'fire' | 'wind' | 'water';
export const BED_NAMES: readonly BedName[] = ['birds', 'crickets', 'rain', 'fire', 'wind', 'water'];

/** Crossfades settle within 2-4 s (setTargetAtTime reaches ~95% after three time constants). */
export const FADE_SECONDS = 3;
const TC = FADE_SECONDS / 3;
const TICK_MS = 200;

/** Designed level of each bed at target 1. Nothing is louder than the music bed. */
const BED_LEVEL: Record<BedName, number> = { birds: 0.5, crickets: 0.35, rain: 0.55, fire: 0.55, wind: 0.45, water: 0.42 };
/** Rain lowpass: open air vs the tent doorway. */
const RAIN_LP_OPEN = 7500;
const RAIN_LP_TENT = 1100;

const state: AmbienceInput = { dayT: 0.3, rain: 0, nearWater: 0, nearFire: 0, inTent: 0, wind: 0.2 };

export type Targets = Record<BedName, number> & { muffle: number };

/** Pure: bed targets (0..1) for an input. Exported for tests and the style board. */
export function computeTargets(s: AmbienceInput): Targets {
  const night = smoothstep(0.78, 0.96, s.dayT);
  const dayness = 1 - smoothstep(0.7, 0.9, s.dayT);
  const dawnChorus = 1 - smoothstep(0.05, 0.35, s.dayT);
  const rain = clamp01(s.rain);
  const inTent = typeof s.inTent === 'boolean' ? (s.inTent ? 1 : 0) : clamp01(s.inTent);
  return {
    birds: dayness * (0.55 + 0.45 * dawnChorus) * (1 - rain * 0.85) * (1 - inTent * 0.5),
    crickets: night * (1 - rain * 0.9) * (1 - inTent * 0.4),
    rain,
    fire: clamp01(s.nearFire) * (1 - inTent * 0.6),
    wind: clamp01(clamp01(s.wind) * (1 - inTent * 0.5) + rain * 0.1),
    water: clamp01(s.nearWater) * (1 - inTent * 0.7),
    muffle: inTent,
  };
}

// ---------- live graph ----------

interface Bed {
  gain: GainNode;
  /** Current target (0..1), used by the schedulers to scale event density. */
  target: number;
  /** Next scheduled event time (context seconds). */
  next: number;
}

interface Bird {
  base: number;
  next: number;
}

interface Live {
  ctx: AudioContext;
  master: GainNode;
  beds: Record<BedName, Bed>;
  sources: AudioScheduledSourceNode[];
  birds: Bird[];
  cricketBursts: GainNode[];
  cricketOn: boolean;
  rainLP: BiquadFilterNode;
  fireBP: BiquadFilterNode;
  crackle: GainNode;
  rumble: GainNode;
  windLP: BiquadFilterNode;
  windGust: GainNode;
  waterBP: BiquadFilterNode;
  swell: GainNode;
  rumbleNext: number;
}

let live: Live | null = null;
let running = false;
let timer: ReturnType<typeof setInterval> | null = null;
let teardownTimer: ReturnType<typeof setTimeout> | null = null;

function loopNoise(L: Live, kind: 'white' | 'pink', dest: AudioNode): AudioBufferSourceNode {
  const s = L.ctx.createBufferSource();
  const buf = kind === 'white' ? engine.whiteNoise(L.ctx) : engine.pinkNoise(L.ctx);
  s.buffer = buf;
  s.loop = true;
  s.connect(dest);
  s.start(0, rand(0, buf.duration * 0.9));
  L.sources.push(s);
  return s;
}

function biquad(ctx: AudioContext, type: BiquadFilterType, hz: number, q: number, dest: AudioNode): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  f.Q.value = q;
  f.connect(dest);
  return f;
}

function gainNode(ctx: AudioContext, value: number, dest: AudioNode): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  g.connect(dest);
  return g;
}

/** A short sine with a glide and a quick envelope (chirps, drips, laps). */
function blip(ctx: AudioContext, dest: AudioNode, at: number, f0: number, f1: number, dur: number, level: number, attack = 0.004): void {
  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, at);
  g.gain.linearRampToValueAtTime(Math.max(EPS, level), at + attack);
  g.gain.exponentialRampToValueAtTime(EPS, at + dur);
  g.connect(dest);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(f1, at + dur * 0.6);
  o.connect(g);
  o.start(at);
  o.stop(at + dur + 0.03);
}

function build(): Live | null {
  const tap = engine.tap('ambience');
  if (!tap) return null;
  const { ctx } = tap;
  const master = gainNode(ctx, 1, tap.out);
  const mkBed = (): Bed => ({ gain: gainNode(ctx, 0, master), target: 0, next: 0 });
  const beds: Record<BedName, Bed> = { birds: mkBed(), crickets: mkBed(), rain: mkBed(), fire: mkBed(), wind: mkBed(), water: mkBed() };

  // Rain: pink -> bandpass -> lowpass (muffle) -> bed. Drips are routed through the same lowpass.
  const rainLP = biquad(ctx, 'lowpass', RAIN_LP_OPEN, 0.5, beds.rain.gain);
  const rainBP = biquad(ctx, 'bandpass', 1000, 0.4, rainLP);

  // Fire: white -> bandpass -> crackle gain (spiked per crackle); pink -> lowpass -> rumble; pink -> mid hiss.
  const crackle = gainNode(ctx, EPS, beds.fire.gain);
  const fireBP = biquad(ctx, 'bandpass', 2500, 1.5, crackle);
  const rumble = gainNode(ctx, 0.3, beds.fire.gain);
  const fireLP = biquad(ctx, 'lowpass', 180, 0.7, rumble);
  const hiss = gainNode(ctx, 0.07, beds.fire.gain);
  const fireMid = biquad(ctx, 'bandpass', 700, 0.8, hiss);

  // Wind: pink -> lowpass (gusts open the filter) -> gust gain -> bed.
  const windGust = gainNode(ctx, 0.5, beds.wind.gain);
  const windLP = biquad(ctx, 'lowpass', 350, 0.6, windGust);

  // Water: pink -> bandpass -> swell gain -> bed.
  const swell = gainNode(ctx, 0.2, beds.water.gain);
  const waterBP = biquad(ctx, 'bandpass', 450, 0.9, swell);

  const L: Live = {
    ctx,
    master,
    beds,
    sources: [],
    birds: [2300, 2900, 3600].map((base) => ({ base, next: 0 })),
    cricketBursts: [],
    cricketOn: false,
    rainLP,
    fireBP,
    crackle,
    rumble,
    windLP,
    windGust,
    waterBP,
    swell,
    rumbleNext: 0,
  };

  loopNoise(L, 'pink', rainBP);
  loopNoise(L, 'white', fireBP);
  loopNoise(L, 'pink', fireLP);
  loopNoise(L, 'pink', fireMid);
  loopNoise(L, 'pink', windLP);
  loopNoise(L, 'pink', waterBP);

  // Crickets: two voices, each a sine through a bandpass, amplitude-pulsed by a sine LFO, gated by a burst gain.
  for (const [hz, rate] of [
    [4100, 19],
    [4700, 24],
  ] as const) {
    // voice -> level -> bandpass -> pulse (AM by the LFO) -> burst (gated by the scheduler) -> bed
    const burst = gainNode(ctx, EPS, beds.crickets.gain);
    const pulse = gainNode(ctx, 0.5, burst);
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    depth.connect(pulse.gain);
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = rate;
    lfo.connect(depth);
    lfo.start();
    const bp = biquad(ctx, 'bandpass', hz, 5, pulse);
    const level = gainNode(ctx, 0.09, bp);
    const voice = ctx.createOscillator();
    voice.type = 'sine';
    voice.frequency.value = hz;
    voice.connect(level);
    voice.start();
    L.sources.push(lfo, voice);
    L.cricketBursts.push(burst);
  }
  return L;
}

function teardown(): void {
  const L = live;
  live = null;
  if (!L) return;
  for (const s of L.sources) {
    try {
      s.stop();
      s.disconnect();
    } catch {
      /* already stopped */
    }
  }
  try {
    L.master.disconnect();
  } catch {
    /* ignore */
  }
}

// ---------- targets ----------

function applyTargets(L: Live): void {
  const T = computeTargets(state);
  const now = L.ctx.currentTime;
  for (const name of BED_NAMES) {
    const bed = L.beds[name];
    const was = bed.target;
    bed.target = T[name];
    const g = bed.gain.gain;
    try {
      g.cancelScheduledValues(now);
      g.setTargetAtTime(T[name] * BED_LEVEL[name], now, TC);
    } catch {
      g.value = T[name] * BED_LEVEL[name];
    }
    // a bed waking up starts its events soon rather than catching up on a stale schedule
    if (was <= 0.01 && bed.target > 0.01) bed.next = now + rand(0.1, 0.6);
  }
  const lp = L.rainLP.frequency;
  lp.cancelScheduledValues(now);
  lp.setTargetAtTime(RAIN_LP_OPEN + (RAIN_LP_TENT - RAIN_LP_OPEN) * T.muffle, now, TC * 0.6);
  for (const bird of L.birds) if (bird.next < now) bird.next = now + rand(0.2, 2);
}

// ---------- schedulers (run a little ahead of the clock) ----------

function scheduleBirds(L: Live, now: number, horizon: number): void {
  const bed = L.beds.birds;
  if (bed.target <= 0.02) return;
  for (const bird of L.birds) {
    if (bird.next < now - 1) bird.next = now + rand(0, 0.5);
    while (bird.next < horizon) {
      const at = bird.next;
      const syllables = randInt(2, 4);
      let t = at;
      for (let i = 0; i < syllables; i++) {
        const dur = rand(0.05, 0.11);
        const f0 = bird.base * rand(0.92, 1.08);
        const f1 = f0 * (chance(0.6) ? rand(1.15, 1.4) : rand(0.75, 0.9));
        blip(L.ctx, bed.gain, t, f0, f1, dur, rand(0.09, 0.16), dur * 0.35);
        t += dur + rand(0.02, 0.08);
      }
      bird.next = t + rand(1.2, 5.5) / (0.4 + bed.target);
    }
  }
}

function scheduleCrickets(L: Live, now: number, horizon: number): void {
  const bed = L.beds.crickets;
  if (bed.target <= 0.02) return;
  if (bed.next < now - 1) bed.next = now + rand(0, 0.3);
  while (bed.next < horizon) {
    const at = bed.next;
    L.cricketOn = !L.cricketOn;
    L.cricketBursts.forEach((b, i) => {
      // the second voice answers a touch later
      const t = at + i * rand(0.03, 0.12);
      b.gain.setTargetAtTime(L.cricketOn ? rand(0.7, 1) : EPS, t, 0.03);
    });
    bed.next = at + (L.cricketOn ? rand(0.45, 1.2) : rand(0.25, 0.9));
  }
}

function scheduleRain(L: Live, now: number, horizon: number): void {
  const bed = L.beds.rain;
  if (bed.target <= 0.02) return;
  if (bed.next < now - 1) bed.next = now + rand(0, 0.2);
  while (bed.next < horizon) {
    const at = bed.next;
    const f0 = rand(1100, 2600);
    blip(L.ctx, L.rainLP, at, f0, f0 * rand(1.3, 1.8), rand(0.06, 0.12), rand(0.02, 0.06));
    bed.next = at + rand(0.08, 0.5) / (0.3 + bed.target);
  }
}

function scheduleFire(L: Live, now: number, horizon: number): void {
  const bed = L.beds.fire;
  if (bed.target <= 0.02) return;
  if (bed.next < now - 1) bed.next = now + rand(0, 0.2);
  while (bed.next < horizon) {
    const at = bed.next;
    L.fireBP.frequency.setValueAtTime(rand(1500, 4200), at);
    const g = L.crackle.gain;
    g.setValueAtTime(EPS, at);
    g.linearRampToValueAtTime(rand(0.15, 0.45), at + 0.003);
    g.exponentialRampToValueAtTime(EPS, at + rand(0.012, 0.05));
    bed.next = at + (chance(0.3) ? rand(0.03, 0.09) : rand(0.12, 0.45));
  }
  if (L.rumbleNext < now - 2) L.rumbleNext = now;
  while (L.rumbleNext < horizon) {
    L.rumble.gain.setTargetAtTime(rand(0.2, 0.4), L.rumbleNext, 0.4);
    L.rumbleNext += rand(0.6, 1.5);
  }
}

function scheduleWind(L: Live, now: number, horizon: number): void {
  const bed = L.beds.wind;
  if (bed.target <= 0.02) return;
  if (bed.next < now - 3) bed.next = now;
  while (bed.next < horizon) {
    const at = bed.next;
    const gust = rand(0.15, 1) * (0.5 + 0.5 * bed.target);
    const tc = rand(0.9, 1.8);
    L.windLP.frequency.setTargetAtTime(220 + 900 * gust, at, tc);
    L.windGust.gain.setTargetAtTime(0.3 + 0.7 * gust, at, tc);
    bed.next = at + rand(2.5, 7);
  }
}

function scheduleWater(L: Live, now: number, horizon: number): void {
  const bed = L.beds.water;
  if (bed.target <= 0.02) return;
  if (bed.next < now - 2) bed.next = now;
  while (bed.next < horizon) {
    const at = bed.next;
    const dur = rand(1.4, 2.6);
    L.swell.gain.setTargetAtTime(rand(0.5, 1), at, dur * 0.25);
    L.swell.gain.setTargetAtTime(0.15, at + dur * 0.45, dur * 0.3);
    L.waterBP.frequency.setTargetAtTime(rand(420, 900), at, dur * 0.3);
    L.waterBP.frequency.setTargetAtTime(400, at + dur * 0.5, dur * 0.3);
    if (chance(0.35)) blip(L.ctx, bed.gain, at + rand(0.1, 0.5), rand(500, 800), rand(220, 320), 0.14, rand(0.04, 0.08), 0.02);
    bed.next = at + dur + rand(0.2, 1.4);
  }
}

function tick(): void {
  const L = live;
  if (!L) return;
  try {
    const now = L.ctx.currentTime;
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const horizon = now + (hidden ? 1.6 : 0.6);
    scheduleBirds(L, now, horizon);
    scheduleCrickets(L, now, horizon);
    scheduleRain(L, now, horizon);
    scheduleFire(L, now, horizon);
    scheduleWind(L, now, horizon);
    scheduleWater(L, now, horizon);
  } catch (e) {
    if (DEBUG.enabled) console.warn('[ambience] tick failed', e);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && timer) tick();
  });
}

// ---------- public API ----------

/** Update any subset of the inputs; bed gains crossfade to the new targets over 2-4 s. */
export function set(input: Partial<AmbienceInput>): void {
  for (const k of Object.keys(input) as Array<keyof AmbienceInput>) {
    const v = input[k];
    if (k === 'inTent') {
      if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) state.inTent = v;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      state[k] = clamp01(v);
    }
  }
  if (live && running) applyTargets(live);
}

/** Start the beds (builds the graph once the engine is unlocked). Idempotent. */
export function start(): void {
  if (!engine.available) return;
  running = true;
  if (teardownTimer) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  engine.whenUnlocked(() => {
    if (!running) return;
    try {
      if (!live) live = build();
      if (!live) return;
      applyTargets(live);
      if (!timer) timer = setInterval(tick, TICK_MS);
      tick();
    } catch (e) {
      if (DEBUG.enabled) console.warn('[ambience] start failed', e);
    }
  });
}

/** Fade every bed out and release the nodes once silent. */
export function stop(): void {
  running = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const L = live;
  if (!L) return;
  const now = L.ctx.currentTime;
  for (const name of BED_NAMES) {
    const g = L.beds[name].gain.gain;
    try {
      g.cancelScheduledValues(now);
      g.setTargetAtTime(0, now, TC * 0.7);
    } catch {
      g.value = 0;
    }
    L.beds[name].target = 0;
  }
  if (teardownTimer) clearTimeout(teardownTimer);
  teardownTimer = setTimeout(() => {
    teardownTimer = null;
    if (!running) teardown();
  }, (FADE_SECONDS + 0.5) * 1000);
}

export function isRunning(): boolean {
  return running;
}

export function getState(): AmbienceInput {
  return { ...state };
}

/** The targets the beds are currently fading toward. */
export function getTargets(): Targets {
  return computeTargets(state);
}
