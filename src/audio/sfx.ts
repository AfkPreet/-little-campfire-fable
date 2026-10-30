/**
 * sfx.ts: synthesized one-shots through the engine's sfx bus (spec section 9). No audio files.
 *
 *   play('pop');                          // nominal level, tiny random detune so repeats differ
 *   play('chime', { volume: 0.6, pitch: 1.5 });
 *   play('bubbling', { duration: 3 });    // sustained sounds take a duration in seconds
 *
 * Every sound is soft: nothing here is louder than the music bed except catchFanfare, which also ducks
 * the music bus by 30% for about 1.2 s. Sounds played before the engine unlocks are dropped, not queued
 * (a stale click landing after the unlock would feel wrong). Every path is a no-op when audio is unavailable.
 */
import { DEBUG } from '@/config/debug';
import { EPS, centsToRatio, chance, clamp, engine, midiToHz, pick, rand } from './engine';

export const SFX_NAMES = [
  'footstep',
  'plip',
  'splash',
  'bite',
  'reel',
  'catchFanfare',
  'pop',
  'basketBounce',
  'tok',
  'tentSpring',
  'pageFlip',
  'squish',
  'sizzle',
  'bubbling',
  'kettleWhistle',
  'chime',
  'windChime',
  'squeak',
  'nope',
  'stir',
  'heart',
  'sleep',
  'rumble',
  'sparkle',
  'thrushWhistle',
] as const;
export type SfxName = (typeof SFX_NAMES)[number];

export interface SfxOptions {
  /** 0..2 multiplier on the sound's designed level (1 = as designed). */
  volume?: number;
  /** Frequency multiplier (1 = as designed, 2 = an octave up). Clamped to 0.25..4. */
  pitch?: number;
  /** Seconds, for the sustained sounds (sizzle, bubbling, windChime, kettleWhistle, rumble, reel, stir). */
  duration?: number;
}

/** Random detune applied to every play so repeats never sound identical. */
const DETUNE_CENTS = 14;

type Pt = readonly [time: number, value: number];

/** Everything a one-shot painter needs. Levels are nominal; `v` (volume) and `p` (pitch) are applied by the helpers. */
interface Kit {
  ctx: AudioContext;
  out: AudioNode;
  /** Start time. */
  t: number;
  /** Pitch multiplier (includes the random detune). */
  p: number;
  /** Volume multiplier. */
  v: number;
  /** Requested duration, when the caller gave one. */
  dur: number | undefined;
  /** Envelope gain into `dest` (default: the bus): linear attack to `peak`, exponential decay to silence. */
  env(peak: number, at: number, attack: number, decay: number, dest?: AudioNode): GainNode;
  /** Envelope with a hold: attack, hold, release. */
  envHold(peak: number, at: number, attack: number, hold: number, release: number, dest?: AudioNode): GainNode;
  /** Oscillator at `hz * p`, started at `at` and stopped after `dur`. */
  osc(type: OscillatorType, hz: number, at: number, dur: number, dest: AudioNode): OscillatorNode;
  /** Unpitched sine LFO (control signal), started at `at` and stopped after `dur`. */
  lfo(hz: number, at: number, dur: number, dest: AudioNode): OscillatorNode;
  /** Looping noise from the engine's shared buffers (random offset), playing from `at` for `dur`. */
  noise(kind: 'white' | 'pink', at: number, dur: number, dest: AudioNode): AudioBufferSourceNode;
  filter(type: BiquadFilterType, hz: number, q: number, dest: AudioNode): BiquadFilterNode;
  /** Glide a frequency param through [time, hz] points (exponential). Values are scaled by `p` unless `pitched` is false. */
  glide(param: AudioParam, points: readonly Pt[], pitched?: boolean): void;
}

function makeKit(ctx: AudioContext, out: AudioNode, t: number, p: number, v: number, dur: number | undefined): Kit {
  const nyquist = ctx.sampleRate / 2 - 100;
  const hzClamp = (hz: number) => clamp(hz, 20, nyquist);
  const env: Kit['env'] = (peak, at, attack, decay, dest = out) => {
    const g = ctx.createGain();
    const a = Math.max(0.002, attack);
    const d = Math.max(0.01, decay);
    g.gain.setValueAtTime(EPS, at);
    g.gain.linearRampToValueAtTime(Math.max(EPS, peak * v), at + a);
    g.gain.exponentialRampToValueAtTime(EPS, at + a + d);
    g.connect(dest);
    return g;
  };
  const envHold: Kit['envHold'] = (peak, at, attack, hold, release, dest = out) => {
    const g = ctx.createGain();
    const a = Math.max(0.002, attack);
    const h = Math.max(0, hold);
    const r = Math.max(0.01, release);
    const lvl = Math.max(EPS, peak * v);
    g.gain.setValueAtTime(EPS, at);
    g.gain.linearRampToValueAtTime(lvl, at + a);
    g.gain.setValueAtTime(lvl, at + a + h);
    g.gain.exponentialRampToValueAtTime(EPS, at + a + h + r);
    g.connect(dest);
    return g;
  };
  const osc: Kit['osc'] = (type, hz, at, dur, dest) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hzClamp(hz * p), at);
    o.connect(dest);
    o.start(at);
    o.stop(at + dur + 0.05);
    return o;
  };
  const lfo: Kit['lfo'] = (hz, at, dur, dest) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(Math.max(0.01, hz), at);
    o.connect(dest);
    o.start(at);
    o.stop(at + dur + 0.05);
    return o;
  };
  const noise: Kit['noise'] = (kind, at, dur, dest) => {
    const s = ctx.createBufferSource();
    const buf = kind === 'white' ? engine.whiteNoise(ctx) : engine.pinkNoise(ctx);
    s.buffer = buf;
    s.loop = true;
    s.connect(dest);
    s.start(at, rand(0, buf.duration * 0.9));
    s.stop(at + dur + 0.05);
    return s;
  };
  const filter: Kit['filter'] = (type, hz, q, dest) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hzClamp(hz);
    f.Q.value = q;
    f.connect(dest);
    return f;
  };
  const glide: Kit['glide'] = (param, points, pitched = true) => {
    const m = pitched ? p : 1;
    points.forEach(([time, value], i) => {
      const val = hzClamp(value * m);
      if (i === 0) param.setValueAtTime(val, time);
      else param.exponentialRampToValueAtTime(val, time);
    });
  };
  return { ctx, out, t, p, v, dur, env, envHold, osc, lfo, noise, filter, glide };
}

// ---------- shared instruments ----------

/** Marimba-ish: fundamental + the 4th partial with a short decay, plus a soft mallet thwack. */
function marimba(k: Kit, hz: number, at: number, decay: number, level: number): void {
  k.osc('sine', hz, at, decay, k.env(level, at, 0.004, decay));
  k.osc('sine', hz * 4, at, decay * 0.3, k.env(level * 0.35, at, 0.002, decay * 0.3));
  k.noise('white', at, 0.05, k.filter('bandpass', hz * 2 * k.p, 2, k.env(level * 0.22, at, 0.002, 0.03)));
}

/** Glassy bell: fundamental + two inharmonic partials that fade faster. */
function glassy(k: Kit, hz: number, at: number, decay: number, level: number): void {
  k.osc('sine', hz, at, decay, k.env(level, at, 0.003, decay));
  k.osc('sine', hz * 2.76, at, decay * 0.6, k.env(level * 0.22, at, 0.003, decay * 0.6));
  k.osc('sine', hz * 5.4, at, decay * 0.35, k.env(level * 0.09, at, 0.002, decay * 0.35));
}

/** A rising water droplet. */
function droplet(k: Kit, at: number, hz: number, level: number, dest?: AudioNode): void {
  const o = k.osc('sine', hz, at, 0.16, k.env(level, at, 0.004, rand(0.08, 0.14), dest));
  k.glide(o.frequency, [
    [at, hz],
    [at + rand(0.035, 0.07), hz * rand(1.5, 2.1)],
  ]);
}

/** A high pentatonic set for sparkles and wind chimes (C major pentatonic, C6 upward). */
const HIGH_PENTATONIC = [84, 86, 88, 91, 93, 96, 98, 100] as const;

// ---------- the one-shots ----------

const SFX: Record<SfxName, (k: Kit) => void> = {
  footstep(k) {
    const t = k.t;
    k.noise('white', t, 0.12, k.filter('lowpass', rand(480, 720), 0.8, k.env(0.2, t, 0.004, 0.09)));
    const o = k.osc('sine', 100, t, 0.1, k.env(0.1, t, 0.003, 0.07));
    k.glide(o.frequency, [
      [t, 115],
      [t + 0.08, 60],
    ]);
  },

  plip(k) {
    droplet(k, k.t, rand(500, 620), 0.32);
  },

  splash(k) {
    const t = k.t;
    const f = k.filter('bandpass', 1600, 0.7, k.env(0.36, t, 0.01, 0.38));
    k.glide(
      f.frequency,
      [
        [t, 2300],
        [t + 0.35, 480],
      ],
      false,
    );
    k.noise('white', t, 0.45, f);
    const o = k.osc('sine', 300, t, 0.15, k.env(0.16, t, 0.004, 0.12));
    k.glide(o.frequency, [
      [t, 420],
      [t + 0.12, 120],
    ]);
    for (let i = 0; i < 3; i++) droplet(k, t + rand(0.12, 0.42), rand(700, 1000), rand(0.05, 0.1));
  },

  bite(k) {
    const t = k.t;
    const o = k.osc('sine', 400, t, 0.3, k.env(0.34, t, 0.006, 0.26));
    k.glide(o.frequency, [
      [t, 560],
      [t + 0.16, 230],
    ]);
    k.noise('white', t + 0.02, 0.14, k.filter('lowpass', 900, 1, k.env(0.1, t + 0.02, 0.005, 0.1)));
  },

  reel(k) {
    const t = k.t;
    const dur = k.dur ?? 0.42;
    const g = k.envHold(0.22, t, 0.03, Math.max(0.05, dur - 0.13), 0.1);
    const am = k.ctx.createGain();
    am.gain.value = 0.5;
    am.connect(g);
    const depth = k.ctx.createGain();
    depth.gain.value = 0.5;
    depth.connect(am.gain);
    const ratchet = k.ctx.createOscillator();
    ratchet.type = 'square';
    ratchet.frequency.setValueAtTime(22, t);
    ratchet.frequency.linearRampToValueAtTime(30, t + dur);
    ratchet.connect(depth);
    ratchet.start(t);
    ratchet.stop(t + dur + 0.05);
    const f = k.filter('bandpass', 1800, 2.5, am);
    k.glide(
      f.frequency,
      [
        [t, 1300],
        [t + dur, 2400],
      ],
      false,
    );
    k.noise('white', t, dur, f);
    k.osc('triangle', 180, t, dur, k.env(0.05, t, 0.02, dur));
  },

  catchFanfare(k) {
    engine.duck(0.3, 60, 800, 1200);
    [72, 76, 79].forEach((m, i) => marimba(k, midiToHz(m), k.t + i * 0.09, 0.55, 0.4 + i * 0.04));
    glassy(k, midiToHz(84), k.t + 0.27, 0.9, 0.12);
  },

  pop(k) {
    const t = k.t;
    const o = k.osc('triangle', 400, t, 0.18, k.env(0.3, t, 0.004, 0.14));
    k.glide(o.frequency, [
      [t, 320],
      [t + 0.07, 760],
    ]);
    k.noise('white', t, 0.05, k.filter('highpass', 2000, 0.7, k.env(0.08, t, 0.002, 0.03)));
  },

  basketBounce(k) {
    const bounce = (at: number, level: number, hz: number) => {
      const o = k.osc('triangle', hz, at, 0.2, k.env(level, at, 0.004, 0.16));
      k.glide(o.frequency, [
        [at, hz],
        [at + 0.1, hz * 0.7],
      ]);
      k.noise('white', at, 0.06, k.filter('bandpass', 900 * k.p, 3, k.env(level * 0.5, at, 0.002, 0.04)));
    };
    bounce(k.t, 0.28, 260);
    bounce(k.t + 0.16, 0.17, 300);
    bounce(k.t + 0.27, 0.09, 330);
  },

  tok(k) {
    const t = k.t;
    k.noise('white', t, 0.08, k.filter('bandpass', 1300 * k.p, 7, k.env(0.28, t, 0.002, 0.06)));
    const o = k.osc('sine', 640, t, 0.09, k.env(0.18, t, 0.002, 0.07));
    k.glide(o.frequency, [
      [t, 700],
      [t + 0.06, 520],
    ]);
  },

  tentSpring(k) {
    const boing = (at: number, level: number, lo: number, hi: number, dur: number) => {
      const o = k.osc('triangle', lo, at, dur + 0.05, k.env(level, at, 0.01, dur));
      k.glide(o.frequency, [
        [at, lo],
        [at + dur * 0.18, hi],
        [at + dur, lo * 1.15],
      ]);
      const o2 = k.osc('sine', lo * 2, at, dur + 0.05, k.env(level * 0.35, at, 0.01, dur));
      k.glide(o2.frequency, [
        [at, lo * 2.01],
        [at + dur * 0.18, hi * 2.01],
        [at + dur, lo * 2.3],
      ]);
    };
    boing(k.t, 0.28, 160, 420, 0.38);
    boing(k.t + 0.34, 0.15, 150, 330, 0.26);
  },

  pageFlip(k) {
    const t = k.t;
    const dur = 0.28;
    const f = k.filter('bandpass', 1200, 0.9, k.envHold(0.26, t, 0.08, 0.06, 0.14));
    k.glide(
      f.frequency,
      [
        [t, 700],
        [t + 0.12, 3200],
        [t + dur, 1400],
      ],
      false,
    );
    k.noise('white', t, dur, f);
  },

  squish(k) {
    const t = k.t;
    const o = k.osc('sine', 200, t, 0.14, k.env(0.24, t, 0.006, 0.11));
    k.glide(o.frequency, [
      [t, 170],
      [t + 0.05, 260],
      [t + 0.12, 200],
    ]);
  },

  sizzle(k) {
    const t = k.t;
    const dur = k.dur ?? 2.5;
    const g = k.envHold(0.14, t, 0.15, Math.max(0.1, dur * 0.3), Math.max(0.2, dur * 0.7 - 0.15));
    const flutter = k.ctx.createGain();
    flutter.gain.value = 0.7;
    flutter.connect(g);
    const depth = k.ctx.createGain();
    depth.gain.value = 0.3;
    depth.connect(flutter.gain);
    k.lfo(rand(9, 13), t, dur, depth);
    k.noise('white', t, dur, k.filter('bandpass', 5200, 0.6, flutter));
    const spits = Math.max(2, Math.floor(dur * 5));
    for (let i = 0; i < spits; i++) {
      const at = t + rand(0.05, Math.max(0.1, dur - 0.1));
      k.noise('white', at, 0.03, k.filter('bandpass', rand(3000, 7000), 2, k.env(rand(0.04, 0.1), at, 0.002, 0.02)));
    }
  },

  bubbling(k) {
    const t = k.t;
    const dur = k.dur ?? 2;
    const n = Math.max(3, Math.round(dur * rand(5, 7)));
    for (let i = 0; i < n; i++) droplet(k, t + rand(0, Math.max(0.05, dur - 0.15)), rand(260, 520), rand(0.07, 0.18));
    k.noise('pink', t, dur, k.filter('lowpass', 700, 0.7, k.envHold(0.05, t, 0.3, Math.max(0.1, dur - 0.9), 0.6)));
  },

  kettleWhistle(k) {
    const t = k.t;
    const dur = k.dur ?? 1.8;
    const o = k.osc('sine', 1500, t, dur, k.envHold(0.16, t, 0.45, Math.max(0.1, dur - 0.95), 0.5));
    k.glide(o.frequency, [
      [t, 1350],
      [t + dur * 0.7, 1900],
      [t + dur, 1850],
    ]);
    const depth = k.ctx.createGain();
    depth.gain.value = 12 * k.p;
    depth.connect(o.frequency);
    k.lfo(5.5, t, dur, depth);
    const breath = k.filter('bandpass', 1700 * k.p, 6, k.envHold(0.06, t, 0.5, Math.max(0.1, dur - 1), 0.5));
    k.glide(breath.frequency, [
      [t, 1350],
      [t + dur * 0.7, 1900],
    ]);
    k.noise('white', t, dur, breath);
  },

  chime(k) {
    glassy(k, midiToHz(76), k.t, 1.3, 0.26);
    glassy(k, midiToHz(83), k.t + 0.17, 1.5, 0.22);
  },

  windChime(k) {
    const dur = k.dur ?? 2.4;
    const n = Math.max(2, Math.round(rand(5, 9) * (dur / 2.4)));
    for (let i = 0; i < n; i++) glassy(k, midiToHz(pick(HIGH_PENTATONIC)), k.t + rand(0, Math.max(0.05, dur - 0.3)), rand(1, 1.8), rand(0.07, 0.16));
  },

  squeak(k) {
    const t = k.t;
    const o = k.osc('triangle', 1000, t, 0.22, k.env(0.2, t, 0.02, 0.17));
    k.glide(o.frequency, [
      [t, 880],
      [t + 0.08, 1500],
      [t + 0.2, 1150],
    ]);
    if (chance(0.5)) {
      const at = t + 0.2;
      const o2 = k.osc('triangle', 1200, at, 0.16, k.env(0.14, at, 0.015, 0.12));
      k.glide(o2.frequency, [
        [at, 1300],
        [at + 0.06, 1750],
        [at + 0.14, 1400],
      ]);
    }
  },

  nope(k) {
    const note = (m: number, at: number, level: number) => {
      k.osc('sine', midiToHz(m), at, 0.26, k.env(level, at, 0.012, 0.22));
      k.osc('triangle', midiToHz(m), at, 0.18, k.env(level * 0.25, at, 0.012, 0.15));
    };
    note(67, k.t, 0.2);
    note(64, k.t + 0.15, 0.18);
  },

  stir(k) {
    const t = k.t;
    const dur = k.dur ?? 0.8;
    const f = k.filter('bandpass', 600, 1.2, k.envHold(0.16, t, dur * 0.3, dur * 0.2, dur * 0.5));
    k.glide(
      f.frequency,
      [
        [t, 380],
        [t + dur * 0.45, 1100],
        [t + dur, 450],
      ],
      false,
    );
    k.noise('pink', t, dur, f);
  },

  heart(k) {
    glassy(k, midiToHz(93), k.t, 0.35, 0.14);
  },

  sleep(k) {
    [76, 72, 67].forEach((m, i) => {
      const at = k.t + i * 0.24;
      k.osc('sine', midiToHz(m), at, 0.9 + i * 0.2, k.env(0.18 - i * 0.03, at, 0.03, 0.6 + i * 0.2));
    });
  },

  rumble(k) {
    const t = k.t;
    const dur = k.dur ?? 1.6;
    const g = k.envHold(0.32, t, 0.2, Math.max(0.1, dur - 0.9), 0.7);
    const wob = k.ctx.createGain();
    wob.gain.value = 0.7;
    wob.connect(g);
    const depth = k.ctx.createGain();
    depth.gain.value = 0.3;
    depth.connect(wob.gain);
    k.lfo(rand(4, 6.5), t, dur, depth);
    k.noise('pink', t, dur, k.filter('lowpass', 130, 0.8, wob));
    const o = k.osc('sine', 48, t, dur, k.env(0.16, t, 0.1, dur * 0.8));
    k.glide(o.frequency, [
      [t, 52],
      [t + dur, 38],
    ]);
  },

  sparkle(k) {
    for (let i = 0; i < 6; i++) {
      const idx = Math.min(HIGH_PENTATONIC.length - 1, i + (chance(0.5) ? 1 : 0));
      glassy(k, midiToHz(HIGH_PENTATONIC[idx]), k.t + i * 0.045, 0.5 + i * 0.05, 0.11 + i * 0.012);
    }
  },

  thrushWhistle(k) {
    const n = chance(0.5) ? 3 : 4;
    let at = k.t;
    for (let i = 0; i < n; i++) {
      const dur = rand(0.14, 0.24);
      const f0 = rand(1900, 2600);
      const f1 = f0 * rand(1.2, 1.5);
      const o = k.osc('sine', f0, at, dur + 0.1, k.env(rand(0.11, 0.17), at, dur * 0.3, dur * 0.8));
      const up = chance(0.65);
      k.glide(
        o.frequency,
        up
          ? [
              [at, f0],
              [at + dur * 0.6, f1],
              [at + dur, f1 * 0.95],
            ]
          : [
              [at, f1],
              [at + dur * 0.6, f0],
              [at + dur, f0 * 1.05],
            ],
      );
      at += dur + rand(0.06, 0.14);
    }
  },
};

/**
 * Play a one-shot now. No-op before unlock or when audio is unavailable; never throws.
 * A random detune of a few cents makes repeats differ.
 */
export function play(name: SfxName, opts: SfxOptions = {}): void {
  const painter = SFX[name];
  if (!painter || !engine.available) return;
  const tap = engine.tap('sfx');
  if (!tap) return;
  try {
    const p = clamp(opts.pitch ?? 1, 0.25, 4) * centsToRatio(rand(-DETUNE_CENTS, DETUNE_CENTS));
    const v = clamp(opts.volume ?? 1, 0, 2);
    const dur = typeof opts.duration === 'number' && opts.duration > 0 ? opts.duration : undefined;
    painter(makeKit(tap.ctx, tap.out, tap.ctx.currentTime + 0.005, p, v, dur));
  } catch (e) {
    if (DEBUG.enabled) console.warn('[sfx]', name, e);
  }
}

export function isSfxName(name: string): name is SfxName {
  return (SFX_NAMES as readonly string[]).includes(name);
}
