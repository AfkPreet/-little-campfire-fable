/**
 * fish.ts: the 8 species and the pure bite math (spec section 5 "Fishing" and section 6 "Fish").
 * All helpers are pure; randomness comes in through a RandomSource (state/rng.ts Rng fits).
 */
import { BAIT_BY_ID, ROD_BY_ID } from './items';
import type { BaitId, DayPhase, FishDef, FishId, RandomSource, Rarity, RodId, RodTier } from './types';
import { FISHING } from './world';

/** "Day" in the fish table means morning through golden hour. */
export const DAY_PHASES: readonly DayPhase[] = ['morning', 'afternoon', 'golden'];

export const FISH: readonly FishDef[] = [
  {
    id: 'minnow', name: 'Pebble Danio', rarity: 'common', sell: 6, baseCm: 7, rodTier: 1,
    season: { phases: 'any' }, whenLabel: 'Any time', rodLabel: 'Any',
    flavor: 'Tiny, speckled and always the first to say hello.',
    hint: 'Small and speckled; bites at any hour.',
  },
  {
    id: 'carp', name: 'Bubble Catla', rarity: 'common', sell: 8, baseCm: 24, rodTier: 1,
    season: { phases: 'any' }, whenLabel: 'Any time', rodLabel: 'Any',
    flavor: 'Round as a bubble and about as serious.',
    hint: 'Blows little bubbles whenever the water is calm.',
  },
  {
    id: 'trout', name: 'Blushing Barb', rarity: 'common', sell: 9, baseCm: 30, rodTier: 1,
    season: { phases: DAY_PHASES }, whenLabel: 'Day', rodLabel: 'Any',
    flavor: 'Pink-cheeked and shy, but it loves a sunny morning.',
    hint: 'Likes the daylight; blushes when caught.',
  },
  {
    id: 'perch', name: 'Dusk Murrel', rarity: 'uncommon', sell: 18, baseCm: 22, rodTier: 1,
    season: { phases: ['dusk'] }, whenLabel: 'Dusk', rodLabel: 'Any',
    flavor: 'Striped like the evening sky. Only out as the sun slips away.',
    hint: 'Only shows itself as the sky turns pink.',
  },
  {
    id: 'loach', name: 'Monsoon Loach', rarity: 'uncommon', sell: 20, baseCm: 18, rodTier: 1,
    season: { phases: 'any', weather: 'rain' }, whenLabel: 'Rain, any time', rodLabel: 'Any',
    flavor: 'Wriggly and happy whenever raindrops ring the water.',
    hint: 'Comes up to feel the raindrops.',
  },
  {
    id: 'glowfin', name: 'Firefly Catfish', rarity: 'uncommon', sell: 24, baseCm: 20, rodTier: 2,
    season: { phases: ['night'] }, whenLabel: 'Night', rodLabel: 'Cane Rod+',
    flavor: 'Its fins glow like a lantern under the water at night.',
    hint: 'A soft light under the water after dark. Needs a sturdy rod.',
  },
  {
    id: 'koi', name: 'Petal Pearlspot', rarity: 'rare', sell: 45, baseCm: 38, rodTier: 2,
    season: { phases: ['dawn'], weather: 'mist' }, whenLabel: 'Misty dawn', rodLabel: 'Cane Rod+',
    flavor: 'Patterned like fallen petals; it drifts up through the morning mist.',
    hint: 'Glimpsed only through dawn mist. Needs a sturdy rod.',
  },
  {
    id: 'golden', name: 'Honey Whisker', rarity: 'rare', sell: 60, baseCm: 55, rodTier: 1,
    season: { phases: 'any' }, whenLabel: 'Any time, 1% per bite', rodLabel: 'Any',
    separateRollChance: FISHING.goldenWhiskerChance,
    flavor: 'Long golden whiskers and a knowing look. Practically glowing.',
    hint: 'A golden flash. Anyone might hook it, any time... if they are lucky.',
  },
];

export const FISH_BY_ID: Record<FishId, FishDef> = FISH.reduce(
  (acc, f) => ((acc[f.id] = f), acc),
  {} as Record<FishId, FishDef>,
);
export const FISH_IDS: readonly FishId[] = FISH.map((f) => f.id);
export function isFishId(id: string): id is FishId { return id in FISH_BY_ID; }

export const RARITY_WEIGHTS: Record<Rarity, number> = FISHING.rarityWeights;
export const RARITY_STARS: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 3 };

export interface FishWeather {
  /** Raining right now. */
  rain: boolean;
  /** Morning mist still up (misty day before it burns off). */
  mist: boolean;
}

function rodTierOf(rod: RodId | RodTier | undefined): RodTier {
  if (rod === undefined) return 1;
  return typeof rod === 'number' ? rod : ROD_BY_ID[rod].tier;
}

/** Is this species biting at this phase and weather (ignores rod and the Honey Whisker's separate roll)? */
export function fishSeasonal(f: FishDef, phase: DayPhase, weather: FishWeather): boolean {
  const inPhase = f.season.phases === 'any' || f.season.phases.includes(phase);
  if (!inPhase) return false;
  if (f.season.weather === 'rain') return weather.rain;
  if (f.season.weather === 'mist') return weather.mist;
  return true;
}

/**
 * Fish in season right now. The Honey Whisker is excluded (it has its own 1% roll per bite).
 * With `ownedRod`, only fish that rod can hook are returned; without it, every seasonal fish.
 */
export function fishInSeason(phase: DayPhase, weather: FishWeather, ownedRod?: RodId | RodTier): FishId[] {
  const tier = ownedRod === undefined ? undefined : rodTierOf(ownedRod);
  return FISH.filter(
    (f) => f.separateRollChance === undefined && fishSeasonal(f, phase, weather) && (tier === undefined || f.rodTier <= tier),
  ).map((f) => f.id);
}

/** Fish in season now that the owned rod cannot hook (drives the "sturdier rod" hint after 3 casts). */
export function fishNeedingBetterRod(phase: DayPhase, weather: FishWeather, ownedRod: RodId | RodTier): FishId[] {
  const tier = rodTierOf(ownedRod);
  return FISH.filter((f) => f.separateRollChance === undefined && fishSeasonal(f, phase, weather) && f.rodTier > tier).map((f) => f.id);
}

export interface BiteModifiers {
  rod?: RodId | RodTier;
  bait?: BaitId | null;
}
export interface BiteWeight {
  id: FishId;
  weight: number;
}

/** Rare-fish multiplier for a rod and bait (Moonlight x2, Sparkle x3; they stack). */
export function rareMultiplier(mods: BiteModifiers): number {
  let m = 1;
  if (mods.rod !== undefined) {
    const tier = rodTierOf(mods.rod);
    const rod = RODS_BY_TIER[tier];
    if (rod) m *= rod.rareMultiplier;
  }
  if (mods.bait) m *= BAIT_BY_ID[mods.bait].rareMultiplier;
  return m;
}
const RODS_BY_TIER: Record<RodTier, (typeof ROD_BY_ID)[RodId] | undefined> = {
  1: ROD_BY_ID.rod_bamboo,
  2: ROD_BY_ID.rod_willow,
  3: ROD_BY_ID.rod_moonlight,
};

/**
 * Bite weights among the candidate fish: common 60, uncommon 30, rare 10, with rod and bait multipliers on rare.
 * Weights renormalize over the candidates (a weighted pick over this list is all that is needed).
 */
export function biteWeights(candidates: readonly FishId[], mods: BiteModifiers = {}): BiteWeight[] {
  const rare = rareMultiplier(mods);
  return candidates.map((id) => {
    const f = FISH_BY_ID[id];
    const w = RARITY_WEIGHTS[f.rarity] * (f.rarity === 'rare' ? rare : 1);
    return { id, weight: w };
  });
}

/** The Honey Whisker's separate 1% roll on every bite. */
export function rollGoldenWhisker(rng: RandomSource): boolean {
  return rng.chance(FISHING.goldenWhiskerChance);
}

/**
 * One bite: the Honey Whisker roll first (1%), then a weighted pick among catchable fish in season.
 * Returns null when nothing is in season for this rod (the integrator should still play a nibble, no catch).
 */
export function rollBite(rng: RandomSource, phase: DayPhase, weather: FishWeather, mods: BiteModifiers = {}): FishId | null {
  if (rollGoldenWhisker(rng)) return 'golden';
  const pool = biteWeights(fishInSeason(phase, weather, mods.rod ?? 1), mods);
  if (pool.length === 0) return null;
  const total = pool.reduce((a, p) => a + p.weight, 0);
  let r = rng.next() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p.id;
  }
  return pool[pool.length - 1].id;
}

/** Wait before a bite: 3-10 s, x0.6 with Wiggly Bait. */
export function biteWaitMs(rng: RandomSource, bait?: BaitId | null): number {
  const mult = bait ? BAIT_BY_ID[bait].waitMultiplier : 1;
  return Math.round(rng.range(FISHING.biteWaitMinMs, FISHING.biteWaitMaxMs) * mult);
}

/** Tap window after a bite: 1.4 s base, 1.9 s with the Willow or Moonlight Rod. */
export function biteWindowMs(rod?: RodId | RodTier): number {
  const tier = rodTierOf(rod);
  return tier >= 2 ? FISHING.biteWindowWillowMs : FISHING.biteWindowBaseMs;
}

/** 0-2 fake nibbles before the real bite. */
export function fakeNibbleCount(rng: RandomSource): number {
  return Math.floor(rng.range(FISHING.fakeNibblesMin, FISHING.fakeNibblesMax + 1));
}

/** Size in cm: +-30% around the species' base, one decimal. */
export function rollFishSize(rng: RandomSource, id: FishId): number {
  const base = FISH_BY_ID[id].baseCm;
  const v = FISHING.sizeVariance;
  return Math.round(base * rng.range(1 - v, 1 + v) * 10) / 10;
}
