/**
 * items.ts: gear (tents, rods, bait, cookware). Numbers from spec section 6 (locked).
 * Display names and flavor get re-skinned after the world lock; ids never change.
 */
import type { BaitGear, BaitId, CookwareGear, CookwareId, GearId, GearItem, RodGear, RodId, TentGear, TentId } from './types';

export const TENTS: readonly TentGear[] = [
  {
    id: 'tent_leaf', kind: 'tent', tab: 'camp', name: 'Teak-Leaf Tent', price: 40,
    flavor: 'A snug little tent stitched from big soft leaves.',
    effect: 'Basic shelter; tent bonus +0; 2 hang points',
    tentBonus: 0, hangPoints: 2, rainCozy: false, litWindow: false,
  },
  {
    id: 'tent_dome', kind: 'tent', tab: 'camp', name: 'Monsoon Dome', price: 90,
    flavor: 'Round and roomy. Rain on the roof sounds like a lullaby.',
    effect: 'Tent bonus +5; 4 hang points; rain sounds extra cozy inside',
    tentBonus: 5, hangPoints: 4, rainCozy: true, litWindow: false,
  },
  {
    id: 'tent_cabin', kind: 'tent', tab: 'camp', name: 'Little Homestay Kit', price: 220,
    flavor: 'A tiny wooden cabin with a window that glows at night.',
    effect: 'Tent bonus +10; 6 hang points; a lit window at night',
    tentBonus: 10, hangPoints: 6, rainCozy: true, litWindow: true,
  },
];

export const RODS: readonly RodGear[] = [
  {
    id: 'rod_bamboo', kind: 'rod', tab: 'fishing', name: 'Bamboo Rod', price: 25,
    flavor: 'Light, springy and just right for a first cast.',
    effect: 'Catches every fish not marked Cane Rod+',
    tier: 1, biteWindowMs: 1400, rareMultiplier: 1, glowsAtNight: false,
  },
  {
    id: 'rod_willow', kind: 'rod', tab: 'fishing', name: 'Cane Rod', price: 80,
    flavor: 'Bends like a willow in the breeze; the big ones can\'t shake it.',
    effect: 'Bite window 1.9 s; catches Cane Rod+ fish',
    tier: 2, biteWindowMs: 1900, rareMultiplier: 1, glowsAtNight: false,
  },
  {
    id: 'rod_moonlight', kind: 'rod', tab: 'fishing', name: 'Moonlight Rod', price: 180,
    flavor: 'Its tip glows softly after dark. Rare fish can\'t resist a peek.',
    effect: 'Cane Rod perks; glows at night; rare fish twice as likely',
    tier: 3, biteWindowMs: 1900, rareMultiplier: 2, glowsAtNight: true,
  },
];

export const BAITS: readonly BaitGear[] = [
  {
    id: 'bait_wiggly', kind: 'bait', tab: 'fishing', name: 'Wiggly Bait (x5)', price: 5,
    flavor: 'Wiggles all by itself. Fish simply have to know what it is.',
    effect: 'Bites come 40% sooner',
    packSize: 5, waitMultiplier: 0.6, rareMultiplier: 1,
  },
  {
    id: 'bait_sparkle', kind: 'bait', tab: 'fishing', name: 'Sparkle Bait (x3)', price: 15,
    flavor: 'Glitters like a dropped star. The shy ones come to look.',
    effect: 'Rare fish 3x as likely',
    packSize: 3, waitMultiplier: 1, rareMultiplier: 3,
  },
];

export const COOKWARE: readonly CookwareGear[] = [
  {
    id: 'kettle', kind: 'cookware', tab: 'kitchen', name: 'Kettle', price: 15,
    flavor: 'Whistles a tiny tune when it\'s ready.',
    effect: 'Drinks', cooks: 'Drinks',
  },
  {
    id: 'pot', kind: 'cookware', tab: 'kitchen', name: 'Clay Pot', price: 20,
    flavor: 'Thick clay walls keep soup warm long after the fire fades.',
    effect: 'Soups, porridge, pudding', cooks: 'Soups, porridge, pudding',
  },
  {
    id: 'skillet', kind: 'cookware', tab: 'kitchen', name: 'Iron Tawa', price: 30,
    flavor: 'Well-seasoned and a little dented. Everything sizzles nicely.',
    effect: 'Grills, pancakes, skewers', cooks: 'Grills, pancakes, skewers',
  },
  {
    id: 'steamer', kind: 'cookware', tab: 'kitchen', name: 'Bamboo Steamer', price: 45,
    flavor: 'Stacked bamboo baskets that breathe out sweet-smelling steam.',
    effect: 'Buns and dumplings; appears after mystery clue 3', cooks: 'Buns and dumplings',
    unlockAfterClue: 3,
  },
];

export const GEAR: readonly GearItem[] = [...TENTS, ...RODS, ...BAITS, ...COOKWARE];

function byId<T extends { id: string }>(list: readonly T[]): Record<T['id'], T> {
  const out = {} as Record<T['id'], T>;
  for (const it of list) out[it.id as T['id']] = it;
  return out;
}
export const GEAR_BY_ID: Record<GearId, GearItem> = byId(GEAR);
export const TENT_BY_ID: Record<TentId, TentGear> = byId(TENTS);
export const ROD_BY_ID: Record<RodId, RodGear> = byId(RODS);
export const BAIT_BY_ID: Record<BaitId, BaitGear> = byId(BAITS);
export const COOKWARE_BY_ID: Record<CookwareId, CookwareGear> = byId(COOKWARE);

/** The Day 1 essentials the shopkeeper tags with a leaf: a tent, a rod, one cookware. */
export const ESSENTIAL_KINDS = ['tent', 'rod', 'cookware'] as const;
/** Cheapest essentials: Teak-Leaf Tent 40 + Bamboo Rod 25 + Kettle 15 = 80c. */
export const ESSENTIALS_TAGGED: readonly GearId[] = ['tent_leaf', 'rod_bamboo', 'kettle'];

export function isTentId(id: string): id is TentId { return id in TENT_BY_ID; }
export function isRodId(id: string): id is RodId { return id in ROD_BY_ID; }
export function isBaitId(id: string): id is BaitId { return id in BAIT_BY_ID; }
export function isCookwareId(id: string): id is CookwareId { return id in COOKWARE_BY_ID; }
export function isGearId(id: string): id is GearId { return id in GEAR_BY_ID; }

/** Gear visible in the shop given mystery progress (the steamer hides until clue 3). */
export function gearVisibleInShop(cluesFound: number): readonly GearItem[] {
  return GEAR.filter((g) => g.kind !== 'cookware' || g.unlockAfterClue === undefined || cluesFound >= g.unlockAfterClue);
}
