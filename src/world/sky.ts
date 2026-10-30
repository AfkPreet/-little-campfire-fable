/**
 * Sky helpers (pure, no Phaser): where the sun and moon sit for a dayT, and where a drifting cloud is at time t.
 * Positions are in sky-band local units (x across the view width, y down from the top; the horizon is y 345).
 */
import { BAND_Y } from '@/world/layout';

export type SkyPos = {
  x: number;
  y: number;
  /** 0 when fully below the horizon, 1 when clear of it (fades the disc as it sets/rises). */
  up: number;
};

export const HORIZON_Y = BAND_Y.skyBottom;
const SUN_LOW_Y = 380;
const SUN_HIGH_Y = 72;
const MOON_HIGH_Y = 96;
/** the sun's disc fades as it dips behind the ridge chains, which top out above the shoreline */
const SUN_SET_Y = 350;
const DISC_FADE = 44;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
function aboveHorizon(y: number, horizon: number = HORIZON_Y): number {
  return clamp01((horizon + 12 - y) / DISC_FADE);
}

/**
 * The sun arcs from low-left at dayT 0 through its zenith at 0.4 to low-right at 0.85, then sinks below the horizon.
 */
export function sunPosition(dayT: number, viewW: number): SkyPos {
  const t = Math.max(0, dayT);
  // u runs 0..1 across the visible arc (0.5 at the zenith), and keeps going past 1 as the sun sets
  const u = t < 0.4 ? (t / 0.4) * 0.5 : 0.5 + ((t - 0.4) / 0.45) * 0.5;
  const uu = Math.min(1.25, u);
  const x = viewW * (0.1 + 0.8 * uu);
  const y = SUN_LOW_Y - (SUN_LOW_Y - SUN_HIGH_Y) * Math.sin(Math.PI * Math.min(1, uu)) + (uu > 1 ? (uu - 1) * 260 : 0);
  return { x, y, up: aboveHorizon(y, SUN_SET_Y) };
}

/** The moon rises on the right from dayT 0.8 and hangs high by full night. */
export function moonPosition(dayT: number, viewW: number): SkyPos {
  const m = clamp01((dayT - 0.8) / 0.2);
  const e = Math.sin((m * Math.PI) / 2); // Sine.easeOut
  const x = viewW * (0.76 - 0.12 * e);
  const y = HORIZON_Y + 30 - (HORIZON_Y + 30 - MOON_HIGH_Y) * e;
  return { x, y, up: aboveHorizon(y) };
}

/**
 * A cloud's x at time t (seconds): drifts right at `speed` px/s and wraps around the view with a margin of its width.
 * `offset` spreads the clouds out; pass each cloud's own phase.
 */
export function cloudDrift(t: number, offset: number, viewW: number, cloudW: number, speed = 6): number {
  const span = viewW + cloudW * 2;
  const x = (offset + t * speed) % span;
  return (x < 0 ? x + span : x) - cloudW;
}
