/** moments.ts: the 6 rare moments, checked at dawn and at night (spec section 5 "Rare moments", section 6 table). */
import type { MomentContext, MomentDef, MomentId } from './types';
import { CONTENTMENT, FISHING } from './world';

export const MOMENTS: readonly MomentDef[] = [
  {
    id: 'shooting_star', name: 'Shooting star', check: 'night', baseChance: 0.08, firstTimeOnly: false,
    trigger: 'Clear night', chanceLabel: '8% a night; +15% with the telescope; always when blissful',
    contentment: CONTENTMENT.gains.rareMoment,
    flavor: 'A streak of light across the stars. Quick, make a wish.',
    hint: 'Watch a clear night sky... and keep wishing.',
  },
  {
    id: 'rainbow', name: 'Rainbow', check: 'dawn', baseChance: 0.5, firstTimeOnly: false,
    trigger: 'Dawn after a rainy night', chanceLabel: '50%',
    contentment: CONTENTMENT.gains.rareMoment,
    flavor: 'Soft bands of color arching over the water after the rain.',
    hint: 'Sometimes the morning after rain brings a surprise.',
  },
  {
    id: 'firefly_swirl', name: 'Firefly swirl', check: 'night', baseChance: 0.25, firstTimeOnly: false,
    trigger: 'Clear night, after 20 s sitting by the fire', chanceLabel: '25%',
    contentment: CONTENTMENT.gains.rareMoment,
    flavor: 'The fireflies gather and dance in a slow golden spiral.',
    hint: 'Sit by the fire a while on a clear night.',
  },
  {
    id: 'misty_sunrise', name: 'Misty sunrise', check: 'dawn', baseChance: 1, firstTimeOnly: true,
    trigger: 'Misty dawn', chanceLabel: 'Always, first time only',
    contentment: CONTENTMENT.gains.rareMoment,
    flavor: 'The whole world wrapped in soft, glowing mist.',
    hint: 'Wake up early on a misty morning.',
  },
  {
    id: 'golden_whisker', name: 'Golden Whisker', check: 'catch', baseChance: FISHING.goldenWhiskerChance, firstTimeOnly: false,
    trigger: 'Catching one', chanceLabel: '1% per bite',
    contentment: CONTENTMENT.gains.rareMoment,
    flavor: 'A flash of gold on the line. It\'s practically glowing.',
    hint: 'Keep casting. Something golden is out there.',
  },
  {
    id: 'moonbow', name: 'Moonbow', check: 'night', baseChance: 1, firstTimeOnly: false,
    trigger: 'Rainy night when blissful', chanceLabel: 'Always; also appears in the mystery finale',
    contentment: CONTENTMENT.gains.rareMoment,
    flavor: 'A pale rainbow by moonlight. Hardly anyone ever sees one.',
    hint: 'Be perfectly happy on a rainy night.',
  },
];

export const MOMENT_BY_ID: Record<MomentId, MomentDef> = MOMENTS.reduce(
  (acc, m) => ((acc[m.id] = m), acc),
  {} as Record<MomentId, MomentDef>,
);
export const MOMENT_IDS: readonly MomentId[] = MOMENTS.map((m) => m.id);
export function isMomentId(id: string): id is MomentId { return id in MOMENT_BY_ID; }

/** Firefly swirl needs this many seconds by the fire first. */
export const FIREFLY_SWIRL_SIT_SECONDS = 20;

function seenHas(ctx: MomentContext, id: MomentId): boolean {
  return ctx.seen instanceof Set ? ctx.seen.has(id) : (ctx.seen as readonly MomentId[]).includes(id);
}

/**
 * Probability (0..1) that a moment fires in this context. 0 when its trigger is not met.
 * The Golden Whisker moment is event-driven (fishing's separate roll), so it returns 0 here; stamp it on the catch.
 */
export function momentChance(id: MomentId, ctx: MomentContext): number {
  const m = MOMENT_BY_ID[id];
  if (m.check !== ctx.check) return 0;
  if (m.firstTimeOnly && seenHas(ctx, id)) return 0;
  const blissful = ctx.tier === 'blissful';
  switch (id) {
    case 'shooting_star': {
      if (ctx.weather === 'rain') return 0;
      if (blissful) return 1;
      return Math.min(1, m.baseChance + (ctx.hasTelescope ? 0.15 : 0));
    }
    case 'rainbow':
      return ctx.rainedLastNight ? m.baseChance : 0;
    case 'firefly_swirl':
      if (ctx.weather === 'rain' || ctx.fireSitSeconds < FIREFLY_SWIRL_SIT_SECONDS) return 0;
      return m.baseChance;
    case 'misty_sunrise':
      return ctx.weather === 'mist' && ctx.mist ? m.baseChance : 0;
    case 'moonbow':
      return ctx.weather === 'rain' && blissful ? m.baseChance : 0;
    case 'golden_whisker':
    default:
      return 0;
  }
}

/** Blissful guarantees that night's rare moment: a shooting star if clear, a moonbow if rainy. */
export function blissfulNightMoment(weather: MomentContext['weather']): MomentId {
  return weather === 'rain' ? 'moonbow' : 'shooting_star';
}

/**
 * Roll every moment for this check in table order and return those that fire.
 * Night: shooting star, firefly swirl, moonbow. Dawn: rainbow, misty sunrise.
 * (The integrator decides whether to play more than one; the first is the headline.)
 */
export function rollMoments(rng: { chance(p: number): boolean }, ctx: MomentContext): MomentId[] {
  const out: MomentId[] = [];
  for (const m of MOMENTS) {
    const p = momentChance(m.id, ctx);
    if (p >= 1 || (p > 0 && rng.chance(p))) out.push(m.id);
  }
  return out;
}
