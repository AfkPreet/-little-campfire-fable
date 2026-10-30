/** decor.ts: the 11 Cozy-tab items (spec section 6 "Decor"). Placement types drive snap points; behaviors drive animation. */
import type { DecorDef, DecorId, DecorPlacement } from './types';
import { CONTENTMENT } from './world';

const B = CONTENTMENT.decorBonus;
const base = {
  tab: 'cozy' as const,
  baselineBonus: B,
  countsAsFireSitting: false,
  heroSitsHere: false,
  lightAtNight: false,
  shootingStarBonus: 0,
  neverGoesOut: false,
};

export const PLACEMENT_LABELS: Record<DecorPlacement, string> = {
  ground: 'Ground',
  hang: 'Hang',
  hang_span: 'Hang, spans two points',
  two_tree: 'Two-tree point',
};

export const DECOR: readonly DecorDef[] = [
  {
    ...base, id: 'flower', name: 'Potted Hibiscus', price: 10, placement: 'ground', placementLabel: PLACEMENT_LABELS.ground,
    behavior: 'Nods in the wind', flavor: 'A cheerful bloom in a little clay pot. It nods along with the breeze.',
  },
  {
    ...base, id: 'lantern', name: 'Paper Lantern', price: 12, placement: 'hang', placementLabel: PLACEMENT_LABELS.hang,
    behavior: 'Sways; warm light pool at night', lightAtNight: true,
    flavor: 'Soft paper, a tiny flame, and a warm pool of light after dark.',
  },
  {
    ...base, id: 'cushion', name: 'Floor Cushion', price: 12, placement: 'ground', placementLabel: PLACEMENT_LABELS.ground,
    behavior: 'The hero sits on it by the fire', heroSitsHere: true,
    flavor: 'Plump and squishy. The best seat by the fire.',
  },
  {
    ...base, id: 'bunting', name: 'Mango-Leaf Toran', price: 15, placement: 'hang', placementLabel: PLACEMENT_LABELS.hang,
    behavior: 'Flutter in gusts', flavor: 'A string of little triangle flags that flutter whenever the wind visits.',
  },
  {
    ...base, id: 'chime', name: 'Bamboo Chime', price: 18, placement: 'hang', placementLabel: PLACEMENT_LABELS.hang,
    behavior: 'Tinkles in gusts', flavor: 'Tinkles sweetly every time a gust passes through camp.',
  },
  {
    ...base, id: 'rug', name: 'Jamkhana Rug', price: 25, placement: 'ground', placementLabel: PLACEMENT_LABELS.ground,
    behavior: 'Colors warm up at night', flavor: 'Hand-woven stripes that glow warmer in the firelight.',
  },
  {
    ...base, id: 'lights', name: 'Fairy Lights', price: 30, placement: 'hang_span', placementLabel: PLACEMENT_LABELS.hang_span,
    behavior: 'Twinkle at night', lightAtNight: true,
    flavor: 'A string of tiny bulbs that twinkle between two points once it\'s dark.',
  },
  {
    ...base, id: 'bookshelf', name: 'Little Bookshelf', price: 40, placement: 'ground', placementLabel: PLACEMENT_LABELS.ground,
    behavior: 'The hero reads there at night (counts as sitting by the fire)', countsAsFireSitting: true,
    flavor: 'A few well-loved books. Perfect for a quiet night by the fire.',
  },
  {
    ...base, id: 'hammock', name: 'Hammock', price: 60, placement: 'two_tree', placementLabel: PLACEMENT_LABELS.two_tree,
    behavior: 'The hero naps in it (counts as sitting by the fire)', countsAsFireSitting: true,
    flavor: 'Strung between two trees. Made for lazy afternoons and starry naps.',
  },
  {
    ...base, id: 'telescope', name: 'Star Telescope', price: 120, placement: 'ground', placementLabel: PLACEMENT_LABELS.ground,
    behavior: 'Shooting star chance +15%', shootingStarBonus: 0.15,
    flavor: 'Point it at the sky and wish. Shooting stars seem to notice.',
  },
  {
    ...base, id: 'guardian_lantern', name: 'Guardian Lantern', price: null, placement: 'hang', placementLabel: PLACEMENT_LABELS.hang,
    behavior: 'Never goes out; adds +5 to the baseline instead of +2', baselineBonus: CONTENTMENT.guardianLanternBonus,
    lightAtNight: true, neverGoesOut: true,
    flavor: 'A gift from the guardian. Its soft glow never goes out.',
  },
];

export const DECOR_BY_ID: Record<DecorId, DecorDef> = DECOR.reduce(
  (acc, d) => ((acc[d.id] = d), acc),
  {} as Record<DecorId, DecorDef>,
);
export const DECOR_IDS: readonly DecorId[] = DECOR.map((d) => d.id);
export function isDecorId(id: string): id is DecorId { return id in DECOR_BY_ID; }

/** Decor for sale in the shop (the Guardian Lantern is a gift). */
export const DECOR_FOR_SALE: readonly DecorDef[] = DECOR.filter((d) => d.price !== null);

/** Baseline bonus for a placed decor id (2, or 5 for the Guardian Lantern). */
export function decorBaselineBonus(id: DecorId): number {
  return DECOR_BY_ID[id].baselineBonus;
}

/** Additive shooting-star chance from placed decor (telescope +0.15). */
export function shootingStarBonus(placed: readonly DecorId[]): number {
  return placed.reduce((sum, id) => sum + DECOR_BY_ID[id].shootingStarBonus, 0);
}
