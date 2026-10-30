/**
 * world.ts: the world's proper nouns (placeholders until the M0 world lock) and the locked rule numbers from
 * spec sections 3 and 5 (time, weather, Contentment, economy, fishing, cooking, foraging, companion, journal).
 * Scenes read these; no magic numbers in scene code.
 */
import type { ContentmentTier, DecorId, RandomSource, WeatherKind } from './types';

/** Proper nouns, locked at M0 (ART_BIBLE.md section 1). */
export const WORLD = {
  title: 'Little Monsoon',
  subtitle: 'a tiny camping trip',
  heroName: 'Chikki',
  shopkeeperName: 'Doddamma',
  companionName: 'Puttu',
  guardianName: 'Bangari',
  waterName: 'Manjukere',
  placeName: 'Nerale Thota',
  nextCampsite: 'Mallige Falls',
  currencyName: 'cowries',
  currencySymbol: 'c',
  version: 'v0.1',
} as const;
export type World = typeof WORLD;

/** Placeholder variables used by dialogue templates ({Title}, {Hero}, ...). */
export function worldVars(): Record<string, string> {
  return {
    Title: WORLD.title,
    Subtitle: WORLD.subtitle,
    Hero: WORLD.heroName,
    Shopkeeper: WORLD.shopkeeperName,
    Companion: WORLD.companionName,
    Guardian: WORLD.guardianName,
    Water: WORLD.waterName,
    Place: WORLD.placeName,
    NextCampsite: WORLD.nextCampsite,
    Currency: WORLD.currencyName,
    CurrencySymbol: WORLD.currencySymbol,
    Version: WORLD.version,
  };
}

// ---------- time ----------
export const TIME = {
  /** Dawn to dusk in real ms; pauses in menus, the shop, the journal and cooking. */
  dayLengthMs: 8 * 60 * 1000,
  /** Days 1-7 make one trip; after sleeping on Night 7 the Trip Album opens. */
  tripDays: 7,
  /** Night holds until the player sleeps; no forced bedtime. */
  forcedBedtime: false,
} as const;

// ---------- weather ----------
export const WEATHER = {
  /** Rolled at dawn, lasts through the night. Weights sum to 100. */
  weights: { clear: 50, rain: 30, mist: 15, golden: 5 } as Record<WeatherKind, number>,
  /** Rain may gently start or stop mid-day: 10% per day. */
  midDayChangeChance: 0.1,
  /** Mist burns off by midday (afternoon phase onwards). */
  mistBurnsOffBy: 'afternoon' as const,
  /** Day 1 is Clear. */
  day1: 'clear' as WeatherKind,
  /** If no rainy night has happened by Day 4, Night 4 rains. */
  rainGuaranteeDay: 4,
  /** Once Moonlight Dumplings are cooked (clue 4), the next night rains. */
  rainAfterDumplings: true,
} as const;

export interface WeatherRollContext {
  /** 1-based day being rolled. */
  day: number;
  /** Has any rainy night happened before this day. */
  hadRainyNight: boolean;
  /** Were Moonlight Dumplings cooked (mystery clue 4) before this dawn, with no rainy night since. */
  dumplingsAwaitingRain: boolean;
}
/** Dawn weather for a day, with the spec guarantees. Pure given the RNG. */
export function rollWeather(rng: RandomSource, ctx: WeatherRollContext): WeatherKind {
  if (ctx.day === 1) return WEATHER.day1;
  if (ctx.dumplingsAwaitingRain) return 'rain';
  if (ctx.day === WEATHER.rainGuaranteeDay && !ctx.hadRainyNight) return 'rain';
  const kinds = Object.keys(WEATHER.weights) as WeatherKind[];
  const total = kinds.reduce((a, k) => a + WEATHER.weights[k], 0);
  let r = rng.next() * total;
  for (const k of kinds) {
    r -= WEATHER.weights[k];
    if (r <= 0) return k;
  }
  return kinds[kinds.length - 1];
}
/** Mid-day change roll: true means rain starts (if clear) or stops (if raining) at a gentle moment. */
export function rollMidDayWeatherChange(rng: RandomSource): boolean {
  return rng.chance(WEATHER.midDayChangeChance);
}

// ---------- contentment ----------
export const CONTENTMENT = {
  min: 0,
  max: 100,
  /** Dawn baseline: 10 + tent bonus + per-decor bonus, capped. */
  baselineBase: 10,
  baselineCap: 40,
  /** Per placed decor item (the Guardian Lantern gives 5 instead; see DECOR[].baselineBonus). */
  decorBonus: 2,
  guardianLanternBonus: 5,
  /** Under the stars (no tent): tent bonus +0. */
  noTentBonus: 0,
  gains: {
    /** Eating a dish gives its own contentment value (recipes.ts). */
    newFish: 10,
    newRecipe: 8,
    firstDecorPlacement: 5,
    releaseFish: 2,
    /** Sitting by the fire at night: +1 per 10 s, max +10 a night. */
    fireSitPerTick: 1,
    fireSitTickS: 10,
    fireSitMaxPerNight: 10,
    /** Resting in the tent doorway while it rains: +1 per 10 s, max +10 a day. */
    rainRestPerTick: 1,
    rainRestTickS: 10,
    rainRestMaxPerDay: 10,
    shareDish: 6,
    rareMoment: 8,
    mysteryMush: 3,
  },
  /** Tier floors. */
  tiers: { cozy: 0, content: 40, glowing: 70, blissful: 100 } as Record<ContentmentTier, number>,
  /** Unlock thresholds. */
  companionAppearsAt: 40,
  finaleNeeds: 70,
  blissfulAt: 100,
} as const;

export const CONTENTMENT_TIER_ORDER: readonly ContentmentTier[] = ['cozy', 'content', 'glowing', 'blissful'];

export function contentmentTier(value: number): ContentmentTier {
  if (value >= CONTENTMENT.tiers.blissful) return 'blissful';
  if (value >= CONTENTMENT.tiers.glowing) return 'glowing';
  if (value >= CONTENTMENT.tiers.content) return 'content';
  return 'cozy';
}

/**
 * Dawn baseline: 10 + tent bonus + 2 per placed decor (Guardian Lantern +5 instead), capped at 40.
 * `decorBonusOf` resolves a decor id to its bonus (pass DECOR_BY_ID lookups from decor.ts; defaults to 2 / 5).
 */
export function contentmentBaseline(tentBonus: number, placedDecor: readonly DecorId[], decorBonusOf?: (id: DecorId) => number): number {
  const bonusOf = decorBonusOf ?? ((id: DecorId) => (id === 'guardian_lantern' ? CONTENTMENT.guardianLanternBonus : CONTENTMENT.decorBonus));
  const decor = placedDecor.reduce((sum, id) => sum + bonusOf(id), 0);
  return Math.min(CONTENTMENT.baselineCap, CONTENTMENT.baselineBase + tentBonus + decor);
}

/** Add a gain, never above the cap and never negative. */
export function addContentment(current: number, gain: number): number {
  return Math.max(CONTENTMENT.min, Math.min(CONTENTMENT.max, current + Math.max(0, gain)));
}

// ---------- economy ----------
export const ECONOMY = {
  startMoney: 120,
  /** Day 1 the shopkeeper tags 3 essentials: a tent, a rod, one cookware (about 80-95c, leaving 25-40c). */
  essentialsMin: 80,
  essentialsMax: 95,
  leftoverMin: 25,
  leftoverMax: 40,
  /** A dish never sells for less than this times its ingredient value. */
  dishFloorMultiplier: 1.25,
  /** Grilled Fish sells for the fish's price times this. */
  grilledFishMultiplier: 1.5,
  mysteryMushSell: 2,
  /** Leaving the shop without an essential asks once. */
  askOnceWithoutEssentials: true,
} as const;

// ---------- fishing ----------
export const FISHING = {
  /** Wait before a bite, ms (Wiggly Bait multiplies by 0.6). */
  biteWaitMinMs: 3000,
  biteWaitMaxMs: 10000,
  /** 0-2 fake nibbles, no penalty. */
  fakeNibblesMin: 0,
  fakeNibblesMax: 2,
  /** Tap window after a bite. */
  biteWindowBaseMs: 1400,
  biteWindowWillowMs: 1900,
  reelMs: 1200,
  /** Rarity weights among fish in season. */
  rarityWeights: { common: 60, uncommon: 30, rare: 10 },
  /** Golden Whisker: separate roll on every bite. */
  goldenWhiskerChance: 0.01,
  /** Show the rod hint after this many casts when a better-rod fish is in season. */
  rodHintAfterCasts: 3,
  /** Size variance around a species' base length. */
  sizeVariance: 0.3,
} as const;

// ---------- cooking ----------
export const COOKING = {
  minIngredients: 1,
  maxIngredients: 3,
  /** Circle a finger this many times to stir. */
  stirCircles: 2,
  /** Hold instead, with Reduce motion on. */
  stirHoldMs: 1500,
  cookMs: 2500,
} as const;

// ---------- foraging ----------
export const FORAGING = {
  spotCount: 7,
  yieldMin: 1,
  yieldMax: 3,
  /** Spots regrow overnight. */
  regrowOvernight: true,
} as const;

// ---------- companion ----------
export const COMPANION = {
  /** Peeks when Contentment is content (40+) at dusk or night and the player holds a dish. */
  appearsAtTier: 'content' as ContentmentTier,
  appearsPhases: ['dusk', 'night'] as const,
  /** Shares on this many different days befriend it. */
  sharesToBefriend: 3,
  /** Friends tab shows this many hearts. */
  hearts: 3,
} as const;

// ---------- journal ----------
export const JOURNAL = {
  counts: { fish: 8, recipes: 16, moments: 6, friends: 1, mystery: 5 },
  totalStamps: 36,
  badges: {
    happyCamper: { name: 'Happy Camper', stampsNeeded: 20 },
    guardianFriend: { name: 'Guardian Friend', requires: 'mystery_complete' as const },
  },
} as const;

// ---------- mystery timing ----------
export const MYSTERY_RULES = {
  /** First-night glow drifts far out on the water for about this long. */
  glowDurationS: 6,
  /** Clue 3 unlocks the steamer and the Moon Blossom spot. */
  unlockClue: 3,
  /** Finale needs this Contentment tier on a rainy night. */
  finaleTier: 'glowing' as ContentmentTier,
  finaleDurationS: 45,
  finaleSkippableOnReplay: true,
  /** Once clue 4 is done, the next night rains. */
  rainAfterClue: 4,
} as const;
