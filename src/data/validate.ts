/**
 * validate.ts: sanity checks over the content tables (counts, cross-references, the economy rules). Pure and
 * side-effect free: returns a report. `npm run check:data` prints it; a test or Boot (dev) can call it too.
 */
import { DECOR, DECOR_FOR_SALE } from './decor';
import { STRINGS } from './dialogue';
import { FISH, FISH_IDS } from './fish';
import { FORAGE, FORAGE_SPOTS } from './forage';
import { COOKWARE, ESSENTIALS_TAGGED, GEAR, GEAR_BY_ID, RODS, TENTS } from './items';
import { MOMENTS } from './moments';
import { MYSTERY_CLUES } from './mystery';
import { PANTRY, isPantryId } from './pantry';
import { RECIPES, dishSellValue, ingredientsValue } from './recipes';
import type { FishId, IngredientId } from './types';
import { CONTENTMENT, ECONOMY, FORAGING, JOURNAL, WEATHER } from './world';
import { isFishId } from './fish';
import { isForageId } from './forage';

export interface ValidationRow {
  check: string;
  expected: string;
  actual: string;
  ok: boolean;
}
export interface ValidationReport {
  ok: boolean;
  rows: ValidationRow[];
  /** One line per failing row, ready to print. */
  errors: string[];
}

export const EXPECTED_COUNTS = {
  gear: 12,
  tents: 3,
  rods: 3,
  cookware: 4,
  pantry: 5,
  fish: 8,
  forage: 5,
  forageSpots: FORAGING.spotCount,
  recipes: 16,
  decor: 11,
  moments: 6,
  clues: 5,
} as const;

function uniqueIds(list: readonly { id: string }[]): boolean {
  return new Set(list.map((x) => x.id)).size === list.length;
}

export function validateData(): ValidationReport {
  const rows: ValidationRow[] = [];
  const row = (check: string, expected: unknown, actual: unknown, ok = String(expected) === String(actual)): void => {
    rows.push({ check, expected: String(expected), actual: String(actual), ok });
  };

  // ---- counts ----
  row('gear count', EXPECTED_COUNTS.gear, GEAR.length);
  row('tent count', EXPECTED_COUNTS.tents, TENTS.length);
  row('rod count', EXPECTED_COUNTS.rods, RODS.length);
  row('cookware count', EXPECTED_COUNTS.cookware, COOKWARE.length);
  row('pantry count', EXPECTED_COUNTS.pantry, PANTRY.length);
  row('fish count', EXPECTED_COUNTS.fish, FISH.length);
  row('forage count', EXPECTED_COUNTS.forage, FORAGE.length);
  row('forage spot count', EXPECTED_COUNTS.forageSpots, FORAGE_SPOTS.length);
  row('recipe count', EXPECTED_COUNTS.recipes, RECIPES.length);
  row('decor count', EXPECTED_COUNTS.decor, DECOR.length);
  row('moment count', EXPECTED_COUNTS.moments, MOMENTS.length);
  row('mystery clue count', EXPECTED_COUNTS.clues, MYSTERY_CLUES.length);

  // ---- ids unique ----
  for (const [name, list] of [
    ['gear', GEAR],
    ['pantry', PANTRY],
    ['fish', FISH],
    ['forage', FORAGE],
    ['recipes', RECIPES],
    ['decor', DECOR],
    ['moments', MOMENTS],
    ['clues', MYSTERY_CLUES],
  ] as const) {
    row(`${name} ids unique`, true, uniqueIds(list as readonly { id: string }[]));
  }

  // ---- recipes: ingredients exist, cookware exists, orders 1..16 unique ----
  const badIngredients: string[] = [];
  for (const r of RECIPES) {
    for (const ing of r.ingredients) {
      if (ing !== 'any_fish' && !isPantryId(ing) && !isForageId(ing) && !isFishId(ing)) badIngredients.push(`${r.id}:${ing}`);
    }
    if (r.ingredients.length < 1 || r.ingredients.length > 3) badIngredients.push(`${r.id}:count ${r.ingredients.length}`);
    if (!(r.cookware in GEAR_BY_ID)) badIngredients.push(`${r.id}:cookware ${r.cookware}`);
  }
  row('recipe ingredients exist (1-3 each, known cookware)', 'none bad', badIngredients.length ? badIngredients.join(', ') : 'none bad');
  const orders = RECIPES.map((r) => r.order).sort((a, b) => a - b);
  row('recipe orders 1..16', 'sequential', orders.every((o, i) => o === i + 1) ? 'sequential' : orders.join(','));
  const unsellable = RECIPES.filter((r) => r.sell.kind === 'unsellable').map((r) => r.id);
  row('unsellable recipes', 'moonlight_dumplings', unsellable.join(','));

  // ---- dish floor rule: every sellable dish sells for >= 1.25x its ingredient value, for every fish it can take ----
  const floorBreaks: string[] = [];
  const belowListed: string[] = [];
  for (const r of RECIPES) {
    if (r.sell.kind === 'unsellable') continue;
    const variants: IngredientId[][] = r.ingredients.includes('any_fish')
      ? FISH_IDS.map((fid: FishId) => r.ingredients.map((i) => (i === 'any_fish' ? fid : i)))
      : [[...r.ingredients]];
    for (const ings of variants) {
      const value = ingredientsValue(ings);
      const floor = Math.ceil(value * ECONOMY.dishFloorMultiplier);
      const sellV = dishSellValue(r, ings);
      if (sellV === null || sellV < floor) floorBreaks.push(`${r.id}[${ings.join('+')}] ${sellV} < ${floor}`);
      if (r.sell.kind === 'fixed' && r.sell.value < floor) belowListed.push(`${r.id}[${ings.join('+')}] listed ${r.sell.value} < floor ${floor}`);
    }
  }
  row('dish floor rule (sell >= 1.25x ingredients)', 'holds', floorBreaks.length ? floorBreaks.join('; ') : 'holds');
  // Informational: listed prices that the floor lifts (not a failure; the matcher applies the floor).
  row('fixed prices lifted by the floor', 'n/a', belowListed.length ? `${belowListed.length} (${belowListed.join('; ')})` : 'none', true);

  // ---- economy: essentials ----
  const essentials = ESSENTIALS_TAGGED.map((id) => GEAR_BY_ID[id].price).reduce((a, b) => a + b, 0);
  const leftover = ECONOMY.startMoney - essentials;
  row('tagged essentials: one tent, one rod, one cookware', true, ESSENTIALS_TAGGED.length === 3 && ESSENTIALS_TAGGED.some((id) => GEAR_BY_ID[id].kind === 'tent') && ESSENTIALS_TAGGED.some((id) => GEAR_BY_ID[id].kind === 'rod') && ESSENTIALS_TAGGED.some((id) => GEAR_BY_ID[id].kind === 'cookware'));
  row(`essentials cost in ${ECONOMY.essentialsMin}-${ECONOMY.essentialsMax}`, 'in range', essentials, essentials >= ECONOMY.essentialsMin && essentials <= ECONOMY.essentialsMax);
  row(`leftover from ${ECONOMY.startMoney} in ${ECONOMY.leftoverMin}-${ECONOMY.leftoverMax}`, 'in range', leftover, leftover >= ECONOMY.leftoverMin && leftover <= ECONOMY.leftoverMax);

  // ---- weather, contentment, journal totals ----
  const weightSum = Object.values(WEATHER.weights).reduce((a, b) => a + b, 0);
  row('weather weights sum', 100, weightSum);
  const maxBaseline = CONTENTMENT.baselineBase + Math.max(...TENTS.map((t) => t.tentBonus));
  row('baseline cap above best tent', true, CONTENTMENT.baselineCap >= maxBaseline);
  const stampSum = Object.values(JOURNAL.counts).reduce((a, b) => a + b, 0);
  row('journal stamps total', JOURNAL.totalStamps, stampSum);
  row('journal counts match tables', true, JOURNAL.counts.fish === FISH.length && JOURNAL.counts.recipes === RECIPES.length && JOURNAL.counts.moments === MOMENTS.length && JOURNAL.counts.mystery === MYSTERY_CLUES.length);

  // ---- decor: exactly one gift, bonuses ----
  const gifts = DECOR.filter((d) => d.price === null).map((d) => d.id);
  row('decor gifts', 'guardian_lantern', gifts.join(','));
  row('decor for sale', EXPECTED_COUNTS.decor - 1, DECOR_FOR_SALE.length);
  row('guardian lantern bonus', CONTENTMENT.guardianLanternBonus, DECOR.find((d) => d.id === 'guardian_lantern')?.baselineBonus);
  row('other decor bonus', true, DECOR.filter((d) => d.id !== 'guardian_lantern').every((d) => d.baselineBonus === CONTENTMENT.decorBonus));

  // ---- mystery: steps 1..5, strings present ----
  row('mystery steps 1..5', 'sequential', MYSTERY_CLUES.map((c) => c.step).every((s, i) => s === i + 1) ? 'sequential' : MYSTERY_CLUES.map((c) => c.step).join(','));
  row('legend has 3 lines', 3, STRINGS.legend.length);
  row('every moment has a banner', true, MOMENTS.every((m) => typeof STRINGS.moments[m.id] === 'string' && STRINGS.moments[m.id].length > 0));
  row('intro has 3 pages', 3, STRINGS.intro.pages.length);

  // ---- fish: one separate-roll species, rod tiers sane ----
  row('separate-roll fish', 'golden', FISH.filter((f) => f.separateRollChance !== undefined).map((f) => f.id).join(','));
  row('fish sell prices positive', true, FISH.every((f) => f.sell > 0 && f.baseCm > 0));

  const errors = rows.filter((r) => !r.ok).map((r) => `${r.check}: expected ${r.expected}, got ${r.actual}`);
  return { ok: errors.length === 0, rows, errors };
}
