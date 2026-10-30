/**
 * fallbackScore.ts: the generative lo-fi score that plays for any mood whose music file is missing.
 *
 * A slow Imaj7 -> vi7 -> IVmaj7 -> V loop in D (one chord per two bars), soft 2-op FM electric-piano chords
 * with a gentle shared vibrato and a humanized strum, a sine bass, sparse pentatonic plucks on a selectable
 * lead (the venu, a breathy low bamboo flute, is the game's lead instrument), a faint vinyl bed with soft
 * crackles and, by day only, a very soft brushed shaker pulse. Night is slower (62 BPM), sparser, with longer
 * notes; rain is sparser with a lower filter. 'finale' is a brighter, busier day.
 *
 * Scheduling: a 100 ms timer schedules 8th-note steps 200 ms ahead on the AudioContext clock. When the tab is
 * hidden (timers throttle to ~1 s) the lookahead widens, and if the scheduler ever falls behind it realigns to
 * the grid instead of bursting the missed notes. Every call is safe before unlock and without Web Audio.
 */
import { DEBUG } from '@/config/debug';
import { EPS, chance, engine, midiToHz, pick, rand, randInt } from './engine';

export type FallbackMood = 'day' | 'rain' | 'night' | 'finale';
export const LEAD_TIMBRES = ['venu', 'kalimba', 'koto', 'guitar'] as const;
export type LeadTimbre = (typeof LEAD_TIMBRES)[number];

interface MoodParams {
  bpm: number;
  /** Chance per 8th step of starting a lead note (outside a phrase). */
  leadChance: number;
  /** Multiplier on lead note lengths. */
  leadLen: number;
  /** Chance of a softer chord re-strike on bar 2. */
  restrike: number;
  /** Score lowpass (lo-fi warmth). */
  filterHz: number;
  /** Shaker / soft drums level; 0 = no drums. */
  drums: number;
  /** Vinyl crackle rate multiplier. */
  crackle: number;
  /** Vinyl bed level multiplier. */
  vinyl: number;
}

const MOODS: Record<FallbackMood, MoodParams> = {
  day: { bpm: 72, leadChance: 0.2, leadLen: 1, restrike: 0.55, filterHz: 5200, drums: 1, crackle: 1, vinyl: 1 },
  rain: { bpm: 68, leadChance: 0.12, leadLen: 1.3, restrike: 0.35, filterHz: 2600, drums: 0.45, crackle: 0.8, vinyl: 1.1 },
  night: { bpm: 62, leadChance: 0.09, leadLen: 1.7, restrike: 0.25, filterHz: 3400, drums: 0, crackle: 0.5, vinyl: 0.9 },
  finale: { bpm: 76, leadChance: 0.3, leadLen: 0.9, restrike: 0.7, filterHz: 6500, drums: 1.1, crackle: 0.7, vinyl: 0.8 },
};

/** Semitones up from C: the score sits in D, a comfortable key for the venu. */
const KEY = 2;
/** Voicings written in C (bass in octave 2, chord tones around middle C), transposed by KEY at play time. */
const CHORDS = [
  { name: 'Imaj7', bass: 36, tones: [55, 59, 60, 64] },
  { name: 'vi7', bass: 45, tones: [55, 57, 60, 64] },
  { name: 'IVmaj7', bass: 41, tones: [53, 57, 60, 64] },
  { name: 'V', bass: 43, tones: [55, 59, 62, 69] },
] as const;
const MAJOR_PENTATONIC = [0, 2, 4, 7, 9] as const;
/** Lead ranges (before transposition): the venu lives low and breathy. */
const LEAD_RANGE: Record<LeadTimbre, readonly [number, number]> = {
  venu: [62, 81],
  kalimba: [67, 88],
  koto: [64, 86],
  guitar: [57, 79],
};
/** 8th-note steps per chord: two bars of 4/4. */
const STEPS_PER_CHORD = 16;
const TOTAL_STEPS = STEPS_PER_CHORD * CHORDS.length;
const TICK_MS = 100;
const LOOKAHEAD_S = 0.2;
const HIDDEN_LOOKAHEAD_S = 1.2;

interface Live {
  ctx: AudioContext;
  lp: BiquadFilterNode;
  gain: GainNode;
  vibDepth: GainNode;
  vinylGain: GainNode;
  crackleBP: BiquadFilterNode;
  crackleGain: GainNode;
  shakerGain: GainNode;
  swishGain: GainNode;
  sources: AudioScheduledSourceNode[];
}

let live: Live | null = null;
let running = false;
let mood: FallbackMood = 'day';
let lead: LeadTimbre = 'venu';
let timer: ReturnType<typeof setInterval> | null = null;
let teardownTimer: ReturnType<typeof setTimeout> | null = null;

let step = 0;
let nextStepTime = 0;
let nextCrackle = 0;
let leadMidi = 0;
let leadBusyUntil = 0;
let phraseLeft = 0;

const stepLen = (): number => 60 / MOODS[mood].bpm / 2;

// ---------- graph ----------

function build(): Live | null {
  const tap = engine.tap('music');
  if (!tap) return null;
  const { ctx } = tap;
  const gain = ctx.createGain();
  gain.gain.value = EPS;
  gain.connect(tap.out);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = MOODS[mood].filterHz;
  lp.Q.value = 0.5;
  lp.connect(gain);

  // shared chord vibrato: 4.6 Hz, a few cents, into each chord note's detune
  const vib = ctx.createOscillator();
  vib.type = 'sine';
  vib.frequency.value = 4.6;
  const vibDepth = ctx.createGain();
  vibDepth.gain.value = 5;
  vib.connect(vibDepth);
  vib.start();

  // vinyl bed: pink -> highpass -> lowpass -> gain
  const vinylGain = ctx.createGain();
  vinylGain.gain.value = 0.02 * MOODS[mood].vinyl;
  vinylGain.connect(lp);
  const vinylLP = ctx.createBiquadFilter();
  vinylLP.type = 'lowpass';
  vinylLP.frequency.value = 2800;
  vinylLP.connect(vinylGain);
  const vinylHP = ctx.createBiquadFilter();
  vinylHP.type = 'highpass';
  vinylHP.frequency.value = 300;
  vinylHP.connect(vinylLP);
  const pink = ctx.createBufferSource();
  const pinkBuf = engine.pinkNoise(ctx);
  pink.buffer = pinkBuf;
  pink.loop = true;
  pink.connect(vinylHP);
  pink.start(0, rand(0, pinkBuf.duration * 0.9));

  // one white noise source feeds the crackles, the shaker and the brush swish through spiked gains
  const white = ctx.createBufferSource();
  const whiteBuf = engine.whiteNoise(ctx);
  white.buffer = whiteBuf;
  white.loop = true;
  white.start(0, rand(0, whiteBuf.duration * 0.9));
  const crackleGain = ctx.createGain();
  crackleGain.gain.value = EPS;
  crackleGain.connect(lp);
  const crackleBP = ctx.createBiquadFilter();
  crackleBP.type = 'bandpass';
  crackleBP.frequency.value = 2500;
  crackleBP.Q.value = 1.5;
  crackleBP.connect(crackleGain);
  white.connect(crackleBP);
  const shakerGain = ctx.createGain();
  shakerGain.gain.value = EPS;
  shakerGain.connect(lp);
  const shakerBP = ctx.createBiquadFilter();
  shakerBP.type = 'bandpass';
  shakerBP.frequency.value = 6500;
  shakerBP.Q.value = 1.2;
  shakerBP.connect(shakerGain);
  white.connect(shakerBP);
  const swishGain = ctx.createGain();
  swishGain.gain.value = EPS;
  swishGain.connect(lp);
  const swishLP = ctx.createBiquadFilter();
  swishLP.type = 'lowpass';
  swishLP.frequency.value = 3500;
  swishLP.connect(swishGain);
  white.connect(swishLP);

  return { ctx, lp, gain, vibDepth, vinylGain, crackleBP, crackleGain, shakerGain, swishGain, sources: [vib, pink, white] };
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
    L.gain.disconnect();
  } catch {
    /* ignore */
  }
}

function applyMood(L: Live): void {
  const P = MOODS[mood];
  const now = L.ctx.currentTime;
  L.lp.frequency.cancelScheduledValues(now);
  L.lp.frequency.setTargetAtTime(P.filterHz, now, 0.8);
  L.vinylGain.gain.setTargetAtTime(0.02 * P.vinyl, now, 0.8);
}

// ---------- voices ----------

/** Soft 2-op FM electric piano: the modulation index decays quickly, leaving a warm sine body. */
function epiano(L: Live, at: number, midi: number, vel: number, dur: number): void {
  const { ctx } = L;
  const hz = midiToHz(midi);
  const car = ctx.createOscillator();
  car.type = 'sine';
  car.frequency.value = hz;
  const mod = ctx.createOscillator();
  mod.type = 'sine';
  mod.frequency.value = hz;
  const index = ctx.createGain();
  index.gain.setValueAtTime(hz * (0.35 + 0.8 * vel), at);
  index.gain.exponentialRampToValueAtTime(hz * 0.06, at + 0.7);
  mod.connect(index);
  index.connect(car.frequency);
  const env = ctx.createGain();
  env.gain.setValueAtTime(EPS, at);
  env.gain.linearRampToValueAtTime(vel * 0.15, at + 0.012);
  env.gain.exponentialRampToValueAtTime(vel * 0.05, at + 0.6);
  env.gain.exponentialRampToValueAtTime(EPS, at + dur);
  car.connect(env);
  env.connect(L.lp);
  L.vibDepth.connect(car.detune);
  car.start(at);
  mod.start(at);
  car.stop(at + dur + 0.05);
  mod.stop(at + dur + 0.05);
}

/** Humanized strum: notes 15-40 ms apart, each with its own velocity. */
function strum(L: Live, tones: readonly number[], at: number, vel: number, dur: number): void {
  let t = at;
  for (const tone of tones) {
    epiano(L, t, tone + KEY, vel * rand(0.8, 1), dur * rand(0.9, 1.05));
    t += rand(0.015, 0.04);
  }
}

function bass(L: Live, at: number, midi: number, vel: number, dur: number): void {
  const { ctx } = L;
  const hz = midiToHz(midi);
  const env = ctx.createGain();
  env.gain.setValueAtTime(EPS, at);
  env.gain.linearRampToValueAtTime(vel * 0.2, at + 0.025);
  env.gain.exponentialRampToValueAtTime(vel * 0.12, at + 0.5);
  env.gain.exponentialRampToValueAtTime(EPS, at + dur);
  env.connect(L.lp);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = hz;
  o.connect(env);
  o.start(at);
  o.stop(at + dur + 0.05);
  const warm = ctx.createGain();
  warm.gain.value = 0.25;
  warm.connect(env);
  const o2 = ctx.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = hz;
  o2.connect(warm);
  o2.start(at);
  o2.stop(at + dur + 0.05);
}

function kick(L: Live, at: number, vel: number): void {
  const { ctx } = L;
  const env = ctx.createGain();
  env.gain.setValueAtTime(EPS, at);
  env.gain.linearRampToValueAtTime(vel * 0.12, at + 0.006);
  env.gain.exponentialRampToValueAtTime(EPS, at + 0.14);
  env.connect(L.lp);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(95, at);
  o.frequency.exponentialRampToValueAtTime(48, at + 0.1);
  o.connect(env);
  o.start(at);
  o.stop(at + 0.2);
}

/** Brushed shaker: a spike on the shared bandpassed noise. */
function shaker(L: Live, at: number, vel: number): void {
  const g = L.shakerGain.gain;
  g.setValueAtTime(EPS, at);
  g.linearRampToValueAtTime(Math.max(EPS, vel * 0.03), at + 0.014);
  g.exponentialRampToValueAtTime(EPS, at + rand(0.06, 0.09));
}

/** Brush swish across the snare: a slower swell on the shared lowpassed noise. */
function swish(L: Live, at: number, vel: number): void {
  const g = L.swishGain.gain;
  g.setValueAtTime(EPS, at);
  g.linearRampToValueAtTime(Math.max(EPS, vel * 0.025), at + 0.12);
  g.exponentialRampToValueAtTime(EPS, at + 0.32);
}

function vinylCrackle(L: Live, at: number): void {
  L.crackleBP.frequency.setValueAtTime(rand(1800, 4000), at);
  const g = L.crackleGain.gain;
  g.setValueAtTime(EPS, at);
  g.linearRampToValueAtTime(rand(0.015, 0.05), at + 0.002);
  g.exponentialRampToValueAtTime(EPS, at + rand(0.006, 0.02));
}

function playLead(L: Live, at: number, midi: number, vel: number, dur: number): void {
  const { ctx } = L;
  const hz = midiToHz(midi);
  const stop = at + dur + 0.4;
  switch (lead) {
    case 'venu': {
      // breathy low bamboo flute: a sine body with a soft scoop in, a whisper of 2nd harmonic, breath noise
      // around the note and a slow vibrato that blooms after the attack.
      const env = ctx.createGain();
      env.gain.setValueAtTime(EPS, at);
      env.gain.linearRampToValueAtTime(vel * 0.17, at + 0.08);
      env.gain.setTargetAtTime(vel * 0.12, at + 0.08, dur * 0.5);
      env.gain.setTargetAtTime(EPS, at + dur, 0.09);
      env.connect(L.lp);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(hz * 0.985, at);
      o.frequency.exponentialRampToValueAtTime(hz, at + 0.07);
      o.connect(env);
      const h2 = ctx.createGain();
      h2.gain.value = 0.16;
      h2.connect(env);
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = hz * 2;
      o2.connect(h2);
      const vibDepth = ctx.createGain();
      vibDepth.gain.setValueAtTime(0, at);
      vibDepth.gain.linearRampToValueAtTime(rand(10, 18), at + 0.6);
      vibDepth.connect(o.detune);
      vibDepth.connect(o2.detune);
      const vib = ctx.createOscillator();
      vib.type = 'sine';
      vib.frequency.value = rand(4.6, 5.4);
      vib.connect(vibDepth);
      const breathEnv = ctx.createGain();
      breathEnv.gain.setValueAtTime(EPS, at);
      breathEnv.gain.linearRampToValueAtTime(vel * 0.05, at + 0.04);
      breathEnv.gain.exponentialRampToValueAtTime(vel * 0.012, at + 0.3);
      breathEnv.gain.setTargetAtTime(EPS, at + dur, 0.08);
      breathEnv.connect(L.lp);
      const breath = ctx.createBiquadFilter();
      breath.type = 'bandpass';
      breath.frequency.value = hz * 2;
      breath.Q.value = 6;
      breath.connect(breathEnv);
      const noise = ctx.createBufferSource();
      const buf = engine.whiteNoise(ctx);
      noise.buffer = buf;
      noise.loop = true;
      noise.connect(breath);
      noise.start(at, rand(0, buf.duration * 0.9));
      noise.stop(stop);
      o.start(at);
      o2.start(at);
      vib.start(at);
      o.stop(stop);
      o2.stop(stop);
      vib.stop(stop);
      return;
    }
    case 'kalimba': {
      // metallic tine: FM at an inharmonic ratio with a fast-decaying index, plus a tiny thumb thump
      const env = ctx.createGain();
      env.gain.setValueAtTime(EPS, at);
      env.gain.linearRampToValueAtTime(vel * 0.2, at + 0.003);
      env.gain.exponentialRampToValueAtTime(EPS, at + Math.max(0.5, Math.min(dur, 1.1)));
      env.connect(L.lp);
      const car = ctx.createOscillator();
      car.type = 'sine';
      car.frequency.value = hz;
      const mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.value = hz * 3.6;
      const index = ctx.createGain();
      index.gain.setValueAtTime(hz * 0.9 * vel, at);
      index.gain.exponentialRampToValueAtTime(hz * 0.02, at + 0.25);
      mod.connect(index);
      index.connect(car.frequency);
      car.connect(env);
      const thump = ctx.createGain();
      thump.gain.setValueAtTime(EPS, at);
      thump.gain.linearRampToValueAtTime(vel * 0.05, at + 0.002);
      thump.gain.exponentialRampToValueAtTime(EPS, at + 0.03);
      thump.connect(L.lp);
      const lpN = ctx.createBiquadFilter();
      lpN.type = 'lowpass';
      lpN.frequency.value = 1200;
      lpN.connect(thump);
      const noise = ctx.createBufferSource();
      noise.buffer = engine.whiteNoise(ctx);
      noise.connect(lpN);
      noise.start(at);
      noise.stop(at + 0.05);
      car.start(at);
      mod.start(at);
      car.stop(stop);
      mod.stop(stop);
      return;
    }
    case 'koto': {
      // plucked silk: a sawtooth through a lowpass that closes quickly; sometimes a slow bend up into the note
      const env = ctx.createGain();
      env.gain.setValueAtTime(EPS, at);
      env.gain.linearRampToValueAtTime(vel * 0.11, at + 0.004);
      env.gain.exponentialRampToValueAtTime(EPS, at + Math.max(0.8, Math.min(dur, 1.4)));
      env.connect(L.lp);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 1.2;
      f.frequency.setValueAtTime(Math.min(hz * 8, 9000), at);
      f.frequency.exponentialRampToValueAtTime(hz * 1.6, at + 0.45);
      f.connect(env);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      if (chance(0.3)) {
        o.frequency.setValueAtTime(hz * 0.94, at);
        o.frequency.exponentialRampToValueAtTime(hz, at + 0.25);
      } else {
        o.frequency.value = hz;
      }
      o.connect(f);
      o.start(at);
      o.stop(stop);
      return;
    }
    case 'guitar': {
      // nylon-ish: two slightly detuned triangles through a closing lowpass
      const env = ctx.createGain();
      env.gain.setValueAtTime(EPS, at);
      env.gain.linearRampToValueAtTime(vel * 0.12, at + 0.006);
      env.gain.exponentialRampToValueAtTime(EPS, at + Math.max(0.7, Math.min(dur, 1.3)));
      env.connect(L.lp);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 0.9;
      f.frequency.setValueAtTime(Math.min(hz * 6, 8000), at);
      f.frequency.exponentialRampToValueAtTime(hz * 2, at + 0.5);
      f.connect(env);
      for (const cents of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = hz;
        o.detune.value = cents;
        o.connect(f);
        o.start(at);
        o.stop(stop);
      }
      return;
    }
  }
}

// ---------- the step sequencer ----------

/** All pentatonic pitches inside the lead's range (already transposed into the key). */
function leadPitches(): number[] {
  const [lo, hi] = LEAD_RANGE[lead];
  const out: number[] = [];
  for (let m = lo + KEY; m <= hi + KEY; m++) if ((MAJOR_PENTATONIC as readonly number[]).includes(((m - KEY) % 12 + 12) % 12)) out.push(m);
  return out;
}

/** Random walk on the pentatonic, leaning on chord tones. */
function nextLeadNote(chordPcs: Set<number>): number {
  const pitches = leadPitches();
  let idx = pitches.indexOf(leadMidi);
  if (idx < 0) idx = randInt(Math.floor(pitches.length * 0.3), Math.floor(pitches.length * 0.6));
  const r = Math.random();
  const dir = chance(0.5) ? 1 : -1;
  if (r < 0.55) idx += dir;
  else if (r < 0.8) idx += dir * 2;
  else if (r < 0.9) idx += dir * randInt(3, 4);
  if (idx < 0) idx = -idx;
  if (idx >= pitches.length) idx = pitches.length - 1 - (idx - pitches.length + 1);
  idx = Math.max(0, Math.min(pitches.length - 1, idx));
  // lean toward chord tones: half the time, nudge a non-chord tone to a chord-tone neighbour
  if (!chordPcs.has(pitches[idx] % 12) && chance(0.5)) {
    const up = idx + 1 < pitches.length && chordPcs.has(pitches[idx + 1] % 12);
    const down = idx - 1 >= 0 && chordPcs.has(pitches[idx - 1] % 12);
    if (up && (!down || chance(0.5))) idx += 1;
    else if (down) idx -= 1;
  }
  leadMidi = pitches[idx];
  return leadMidi;
}

function scheduleStep(L: Live, s: number, at: number): void {
  const P = MOODS[mood];
  const sl = stepLen();
  const chord = CHORDS[Math.floor(s / STEPS_PER_CHORD) % CHORDS.length];
  const inChord = s % STEPS_PER_CHORD;
  const chordDur = sl * STEPS_PER_CHORD;
  const bright = mood === 'day' || mood === 'finale';

  if (inChord === 0) {
    strum(L, chord.tones, at, rand(0.75, 0.95), chordDur * 1.05);
    bass(L, at, chord.bass + KEY, 0.9, chordDur * 0.98);
  } else if (inChord === 8 && chance(P.restrike)) {
    strum(L, chord.tones, at + rand(0, 0.02), rand(0.4, 0.6), chordDur * 0.55);
    if (bright && chance(0.6)) bass(L, at, chord.bass + KEY + (chance(0.5) ? 7 : 12), 0.5, chordDur * 0.45);
  }

  if (P.drums > 0) {
    if (inChord % 4 === 0) kick(L, at, 0.5 * P.drums);
    if (!chance(0.08)) shaker(L, at + rand(-0.006, 0.012), (inChord % 2 === 0 ? 0.6 : 0.9) * rand(0.8, 1.1) * P.drums);
    if ((inChord === 6 || inChord === 14) && chance(0.5)) swish(L, at, 0.6 * P.drums);
  }

  if (at >= leadBusyUntil && (chance(P.leadChance) || (phraseLeft > 0 && chance(0.55)))) {
    const pcs = new Set<number>([...chord.tones, chord.bass].map((m) => (m + KEY) % 12));
    const midi = nextLeadNote(pcs);
    const lenMul = lead === 'venu' ? 1.4 : 1;
    const dur = sl * pick([2, 3, 4, 6]) * P.leadLen * lenMul;
    const vel = rand(0.5, 0.9);
    playLead(L, at + rand(-0.01, 0.025), midi, vel, dur);
    leadBusyUntil = at + dur * 0.85;
    phraseLeft = phraseLeft > 0 ? phraseLeft - 1 : randInt(1, 3);
  }
}

function tick(): void {
  const L = live;
  if (!L || !running) return;
  try {
    const now = L.ctx.currentTime;
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const ahead = hidden ? HIDDEN_LOOKAHEAD_S : LOOKAHEAD_S;
    const sl = stepLen();
    if (nextStepTime < now - 0.3) {
      // fell behind (tab switch, suspended context): realign to the grid without a burst of missed notes
      const missed = Math.ceil((now - nextStepTime) / sl);
      step = (step + missed) % TOTAL_STEPS;
      nextStepTime += missed * sl;
    }
    while (nextStepTime < now + ahead) {
      scheduleStep(L, step, nextStepTime);
      step = (step + 1) % TOTAL_STEPS;
      nextStepTime += sl;
    }
    const P = MOODS[mood];
    if (nextCrackle < now - 2) nextCrackle = now + rand(0.1, 0.5);
    while (nextCrackle < now + ahead) {
      vinylCrackle(L, nextCrackle);
      nextCrackle += rand(0.25, 2.2) / Math.max(0.1, P.crackle);
    }
  } catch (e) {
    if (DEBUG.enabled) console.warn('[fallbackScore] tick failed', e);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && timer) tick();
  });
}

// ---------- public API ----------

/** Start (or resume) the score in `initialMood`, fading in over `fadeSec`. Idempotent. */
export function start(initialMood: FallbackMood = mood, fadeSec = 1): void {
  if (!engine.available) return;
  mood = initialMood;
  running = true;
  if (teardownTimer) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  engine.whenUnlocked(() => {
    if (!running) return;
    try {
      if (!live) live = build();
      const L = live;
      if (!L) return;
      const now = L.ctx.currentTime;
      const g = L.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(Math.max(EPS, g.value), now);
      g.linearRampToValueAtTime(1, now + Math.max(0.05, fadeSec));
      applyMood(L);
      if (!timer) {
        step = 0;
        nextStepTime = now + 0.08;
        nextCrackle = now + 0.5;
        leadBusyUntil = 0;
        phraseLeft = 0;
        timer = setInterval(tick, TICK_MS);
        tick();
      }
    } catch (e) {
      if (DEBUG.enabled) console.warn('[fallbackScore] start failed', e);
    }
  });
}

/** Fade out over `fadeSec`, stop scheduling, and release the nodes once silent. */
export function stop(fadeSec = 1.5): void {
  running = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const L = live;
  if (!L) return;
  const now = L.ctx.currentTime;
  const g = L.gain.gain;
  try {
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(EPS, g.value), now);
    g.exponentialRampToValueAtTime(EPS, now + Math.max(0.05, fadeSec));
  } catch {
    g.value = EPS;
  }
  if (teardownTimer) clearTimeout(teardownTimer);
  teardownTimer = setTimeout(() => {
    teardownTimer = null;
    if (!running) teardown();
  }, (fadeSec + 0.4) * 1000);
}

/** Change mood in place: tempo takes effect at the next step, the filter glides over about a second. */
export function setMood(next: FallbackMood): void {
  mood = next;
  if (live && running) applyMood(live);
}

export function getMood(): FallbackMood {
  return mood;
}

export function setLead(timbre: LeadTimbre): void {
  if ((LEAD_TIMBRES as readonly string[]).includes(timbre)) lead = timbre;
}

export function getLead(): LeadTimbre {
  return lead;
}

export function isPlaying(): boolean {
  return running;
}
