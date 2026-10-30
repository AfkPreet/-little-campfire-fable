/**
 * Time-of-day and lighting model.
 * dayT runs 0 (first light of dawn) -> 1 (full night). Dawn to dusk takes ~8 real minutes; night holds until sleep.
 * Every layer is tinted from the Lighting produced here, so the whole world relights from one place.
 *
 * Two kinds of layers:
 *  - "white-painted" far bands (far ridges, mid hills) are painted in cream/near-white and tinted with the ACTUAL
 *    color for the current light (`far`, `mid`), which is how atmospheric perspective is done.
 *  - "real-colored" layers (near trees, ground, foreground, props, characters) are painted in their palette colors and
 *    multiplied by a tint (`nearTint`, `groundTint`, `fgTint`, `charTint`); cream = unchanged.
 */
import { LIGHT_KEYS, PALETTE, RAIN_TINT, desaturate, mix, shade, type LightKey } from '@/config/palette';

export type DayPhase = 'dawn' | 'morning' | 'afternoon' | 'golden' | 'dusk' | 'night';
export const PHASE_LABELS: Record<DayPhase, string> = {
  dawn: 'Dawn',
  morning: 'Morning',
  afternoon: 'Afternoon',
  golden: 'Golden hour',
  dusk: 'Dusk',
  night: 'Night',
};

/** Where each lighting key sits on dayT. */
const KEY_POS: Array<[number, LightKey]> = [
  [0.0, 'dawn'],
  [0.3, 'day'],
  [0.66, 'golden'],
  [0.82, 'dusk'],
  [1.0, 'night'],
];

/** dayT for a named time (debug ?time=). */
export function dayTFor(name: string | undefined): number {
  switch ((name ?? '').toLowerCase()) {
    case 'dawn': return 0.04;
    case 'day': case 'morning': return 0.42;
    case 'afternoon': return 0.55;
    case 'golden': return 0.68;
    case 'dusk': return 0.85;
    case 'night': return 1.0;
    default: return 0.42;
  }
}

export function phaseAt(dayT: number): DayPhase {
  if (dayT < 0.12) return 'dawn';
  if (dayT < 0.42) return 'morning';
  if (dayT < 0.62) return 'afternoon';
  if (dayT < 0.76) return 'golden';
  if (dayT < 0.94) return 'dusk';
  return 'night';
}

export type Weather = { rain: number; mist: number };

export type Lighting = {
  dayT: number;
  key: LightKey;
  skyTop: string;
  skyHorizon: string;
  /** actual colors for white-painted bands: three ridge chains (far -> ridgeMid -> mid) and the estate slope */
  far: string;
  ridgeMid: string;
  mid: string;
  estate: string;
  /** multiply tints for real-colored layers */
  nearTint: string;
  groundTint: string;
  fgTint: string;
  charTint: string;
  waterTint: string;
  /** mist overlay color and density 0..1 */
  mistColor: string;
  mist: number;
  /** 0..1 */
  stars: number;
  moon: number;
  sun: number;
  /** firelight / lantern prominence 0..1 */
  warmth: number;
  /** overall brightness 0..1 for particles, bloom strength */
  ambient: number;
  rain: number;
  vignette: number;
};

type KeyLight = Omit<Lighting, 'dayT' | 'key' | 'rain'>;

const C = PALETTE;
function keyLight(key: LightKey): KeyLight {
  const k = LIGHT_KEYS[key];
  switch (key) {
    case 'dawn': {
      const ridge = mix(C.lavender, k.horizon, 0.18);
      return {
        skyTop: k.top, skyHorizon: k.horizon,
        far: mix(ridge, k.horizon, 0.58), mid: mix(ridge, k.horizon, 0.26),
        ridgeMid: mix(mix(ridge, k.horizon, 0.58), mix(ridge, k.horizon, 0.22), 0.5), estate: mix(mix(C.sage, k.horizon, 0.55), ridge, 0.25),
        nearTint: mix(C.cream, C.peach, 0.28), groundTint: mix(C.cream, C.lavender, 0.22), fgTint: mix(C.cream, C.lavender, 0.3),
        charTint: mix(C.cream, C.peach, 0.18), waterTint: mix(C.cream, k.horizon, 0.3),
        mistColor: mix(k.horizon, C.cream, 0.4), mist: 0.6, stars: 0.08, moon: 0, sun: 0.35, warmth: 0.25, ambient: 0.8, vignette: 0.12,
      };
    }
    case 'day': {
      const ridge = C.lavender;
      return {
        skyTop: k.top, skyHorizon: k.horizon,
        far: mix(ridge, k.horizon, 0.55), mid: mix(ridge, k.horizon, 0.22),
        ridgeMid: mix(mix(ridge, k.horizon, 0.58), mix(ridge, k.horizon, 0.22), 0.5), estate: mix(C.sage, k.horizon, 0.32),
        nearTint: C.cream, groundTint: C.cream, fgTint: C.cream,
        charTint: C.cream, waterTint: C.cream,
        mistColor: mix(k.horizon, C.cream, 0.5), mist: 0.22, stars: 0, moon: 0, sun: 1, warmth: 0, ambient: 1, vignette: 0.08,
      };
    }
    case 'golden': {
      const ridge = mix(C.lavender, C.butter, 0.35);
      return {
        skyTop: k.top, skyHorizon: k.horizon,
        far: mix(ridge, k.horizon, 0.55), mid: mix(ridge, k.horizon, 0.22),
        ridgeMid: mix(mix(ridge, k.horizon, 0.58), mix(ridge, k.horizon, 0.22), 0.5), estate: mix(mix(C.sage, C.butter, 0.4), k.horizon, 0.3),
        nearTint: mix(C.cream, C.butter, 0.5), groundTint: mix(C.cream, C.butter, 0.4), fgTint: mix(C.cream, C.butter, 0.45),
        charTint: mix(C.cream, C.butter, 0.35), waterTint: mix(C.cream, C.butter, 0.4),
        mistColor: mix(k.horizon, C.cream, 0.3), mist: 0.3, stars: 0, moon: 0, sun: 0.75, warmth: 0.35, ambient: 0.95, vignette: 0.1,
      };
    }
    case 'dusk': {
      const ridge = mix(k.top, k.horizon, 0.2);
      return {
        skyTop: k.top, skyHorizon: k.horizon,
        far: mix(ridge, k.horizon, 0.5), mid: mix(ridge, k.horizon, 0.18),
        ridgeMid: mix(mix(ridge, k.horizon, 0.58), mix(ridge, k.horizon, 0.22), 0.5), estate: mix(mix(C.moss, k.top, 0.5), k.horizon, 0.3),
        nearTint: mix(C.cream, k.top, 0.42), groundTint: mix(C.cream, k.top, 0.46), fgTint: mix(C.cream, k.top, 0.5),
        charTint: mix(C.cream, k.top, 0.3), waterTint: mix(C.cream, k.horizon, 0.45),
        mistColor: mix(k.horizon, C.lavender, 0.4), mist: 0.35, stars: 0.4, moon: 0.35, sun: 0.1, warmth: 0.75, ambient: 0.6, vignette: 0.18,
      };
    }
    case 'night':
    default: {
      const ridge = shade(mix(k.top, k.horizon, 0.3), -0.12);
      const nightMul = mix(k.horizon, C.powder, 0.35);
      return {
        skyTop: k.top, skyHorizon: k.horizon,
        far: mix(ridge, k.horizon, 0.45), mid: mix(ridge, k.horizon, 0.15),
        ridgeMid: mix(mix(ridge, k.horizon, 0.45), mix(ridge, k.horizon, 0.15), 0.5), estate: shade(mix(C.moss, k.top, 0.6), -0.12),
        nearTint: nightMul, groundTint: shade(nightMul, -0.08), fgTint: shade(nightMul, -0.15),
        charTint: mix(nightMul, C.cream, 0.3), waterTint: mix(k.horizon, C.powder, 0.2),
        mistColor: mix(k.horizon, C.lavender, 0.3), mist: 0.3, stars: 1, moon: 1, sun: 0, warmth: 1, ambient: 0.35, vignette: 0.3,
      };
    }
  }
}

const KEY_CACHE = new Map<LightKey, KeyLight>();
function getKey(k: LightKey): KeyLight {
  let v = KEY_CACHE.get(k);
  if (!v) {
    v = keyLight(k);
    KEY_CACHE.set(k, v);
  }
  return v;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

function lerpKey(a: KeyLight, b: KeyLight, t: number): KeyLight {
  const out = {} as KeyLight;
  for (const k of Object.keys(a) as Array<keyof KeyLight>) {
    const va = a[k], vb = b[k];
    (out as Record<string, unknown>)[k] = typeof va === 'number' ? lerp(va, vb as number, t) : mix(va as string, vb as string, t);
  }
  return out;
}

function rainify(hex: string, amount: number): string {
  if (amount <= 0) return hex;
  return desaturate(mix(hex, RAIN_TINT, 0.4 * amount), 0.3 * amount);
}

/** The lighting for a moment of the day and the current weather. Pure; cheap enough to call every frame. */
export function lightingAt(dayT: number, weather: Weather = { rain: 0, mist: 0 }): Lighting {
  const t = Math.max(0, Math.min(1, dayT));
  let i = 0;
  while (i < KEY_POS.length - 2 && t > KEY_POS[i + 1][0]) i++;
  const [t0, k0] = KEY_POS[i], [t1, k1] = KEY_POS[i + 1];
  const f = smooth((t - t0) / (t1 - t0));
  const base = lerpKey(getKey(k0), getKey(k1), f);
  const key: LightKey = f < 0.5 ? k0 : k1;

  const rain = Math.max(0, Math.min(1, weather.rain));
  const mistW = Math.max(0, Math.min(1, weather.mist));
  const L: Lighting = { ...base, dayT: t, key, rain };
  if (rain > 0) {
    for (const k of ['skyTop', 'skyHorizon', 'far', 'ridgeMid', 'mid', 'estate', 'nearTint', 'groundTint', 'fgTint', 'charTint', 'waterTint', 'mistColor'] as const) {
      L[k] = rainify(L[k], rain);
    }
    L.mist = Math.min(1, L.mist + 0.3 * rain);
    L.stars *= 1 - 0.9 * rain;
    L.moon *= 1 - 0.7 * rain;
    L.sun *= 1 - 0.8 * rain;
    L.ambient *= 1 - 0.2 * rain;
    L.vignette = Math.min(0.4, L.vignette + 0.06 * rain);
  }
  if (mistW > 0) {
    L.mist = Math.min(1, L.mist + 0.45 * mistW);
    L.far = mix(L.far, L.skyHorizon, 0.5 * mistW);
    L.ridgeMid = mix(L.ridgeMid, L.skyHorizon, 0.4 * mistW);
    L.mid = mix(L.mid, L.skyHorizon, 0.3 * mistW);
    L.estate = mix(L.estate, L.skyHorizon, 0.25 * mistW);
    L.skyHorizon = mix(L.skyHorizon, C.cream, 0.25 * mistW);
    L.sun *= 1 - 0.5 * mistW;
  }
  return L;
}

/** Clock helpers: 8 real minutes dawn->dusk. */
export const DAY_LENGTH_MS = 8 * 60 * 1000;
export function advanceDay(dayT: number, dtMs: number): number {
  return Math.min(1, dayT + dtMs / DAY_LENGTH_MS);
}
