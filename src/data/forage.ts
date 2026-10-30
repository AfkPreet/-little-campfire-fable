/** forage.ts: the 5 forage items and the 7 clearing spots (spec section 5 "Foraging", section 6 "Forage"). */
import type { DayPhase, ForageDef, ForageId, ForageSpot, RandomSource } from './types';
import { FORAGING } from './world';

const DAY: readonly DayPhase[] = ['morning', 'afternoon', 'golden'];

export const FORAGE: readonly ForageDef[] = [
  {
    id: 'berries', name: 'Jamun Berries', spot: 'berry_bush', when: 'day', sell: 2, doubleAfterRain: false,
    yieldMin: 1, yieldMax: 3, whereLabel: 'Berry bushes', whenLabel: 'Day',
    flavor: 'Plump, pink and sun-warmed. Try not to eat them all on the way back.',
  },
  {
    id: 'mushrooms', name: 'Monsoon Mushrooms', spot: 'mushroom_log', when: 'any', sell: 3, doubleAfterRain: true,
    yieldMin: 1, yieldMax: 3, whereLabel: 'Mushroom logs', whenLabel: 'Any time; double yield after rain',
    flavor: 'Little round caps that puff a tiny cloud when tapped.',
  },
  {
    id: 'herbs', name: 'Wild Lemongrass', spot: 'herb_patch', when: 'any', sell: 2, doubleAfterRain: false,
    yieldMin: 1, yieldMax: 3, whereLabel: 'Herb patch', whenLabel: 'Any time',
    flavor: 'Fresh green leaves that smell like a rainy garden.',
  },
  {
    id: 'nuts', name: 'Jack Seeds', spot: 'nut_tree', when: 'day', sell: 3, doubleAfterRain: false,
    yieldMin: 1, yieldMax: 3, whereLabel: 'Nut tree', whenLabel: 'Day',
    flavor: 'Crunchy and a little sweet. The squirrels won\'t mind sharing.',
  },
  {
    id: 'moonblossom', name: 'Moon Lily', spot: 'shore', when: 'night', sell: null, doubleAfterRain: false,
    unlockAfterClue: 3, yieldMin: 1, yieldMax: 3, whereLabel: 'Shore spot', whenLabel: 'Night, after clue 3',
    flavor: 'A pale flower that opens only for the moon. It hums, very faintly.',
  },
];

export const FORAGE_BY_ID: Record<ForageId, ForageDef> = FORAGE.reduce(
  (acc, f) => ((acc[f.id] = f), acc),
  {} as Record<ForageId, ForageDef>,
);
export function isForageId(id: string): id is ForageId { return id in FORAGE_BY_ID; }

/** 7 spots around the clearing: 2 berry bushes, 2 mushroom logs, 1 herb patch, 1 nut tree, 1 night-only shore spot. */
export const FORAGE_SPOTS: readonly ForageSpot[] = [
  { id: 'berry_bush_1', kind: 'berry_bush', yields: 'berries' },
  { id: 'berry_bush_2', kind: 'berry_bush', yields: 'berries' },
  { id: 'mushroom_log_1', kind: 'mushroom_log', yields: 'mushrooms' },
  { id: 'mushroom_log_2', kind: 'mushroom_log', yields: 'mushrooms' },
  { id: 'herb_patch', kind: 'herb_patch', yields: 'herbs' },
  { id: 'nut_tree', kind: 'nut_tree', yields: 'nuts' },
  { id: 'shore_blossom', kind: 'shore', yields: 'moonblossom' },
];

export interface ForageContext {
  phase: DayPhase;
  /** Did it rain today (before this pick) or last night: mushrooms double. */
  rainedRecently: boolean;
  /** Mystery clues found so far (Moon Lily needs 3). */
  cluesFound: number;
}

/** Can this item be picked right now? */
export function forageAvailable(id: ForageId, ctx: Pick<ForageContext, 'phase' | 'cluesFound'>): boolean {
  const f = FORAGE_BY_ID[id];
  if (f.unlockAfterClue !== undefined && ctx.cluesFound < f.unlockAfterClue) return false;
  if (f.when === 'any') return true;
  if (f.when === 'day') return DAY.includes(ctx.phase);
  return ctx.phase === 'night';
}

/** Spots that can be picked right now. */
export function forageSpotsAvailable(ctx: Pick<ForageContext, 'phase' | 'cluesFound'>): ForageSpot[] {
  return FORAGE_SPOTS.filter((s) => forageAvailable(s.yields, ctx));
}

/** 1-3 items per pick, doubled for mushrooms after rain. */
export function rollForageYield(rng: RandomSource, id: ForageId, ctx: Pick<ForageContext, 'rainedRecently'>): number {
  const f = FORAGE_BY_ID[id];
  const n = Math.floor(rng.range(FORAGING.yieldMin, FORAGING.yieldMax + 1));
  return f.doubleAfterRain && ctx.rainedRecently ? n * 2 : n;
}
