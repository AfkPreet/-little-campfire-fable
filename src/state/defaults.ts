/**
 * defaults.ts: fresh and debug game states. createFreshState(seed) is Day 1, clear, 120c and nothing owned.
 * createDebugState('midtrip' | 'finale', seed) builds the ?state= fixtures the screenshot scripts use.
 */
import { BAITS, TENT_BY_ID } from '@/data/items';
import { PANTRY } from '@/data/pantry';
import { FORAGE } from '@/data/forage';
import { FISH_BY_ID } from '@/data/fish';
import { RECIPE_BY_ID, dishInfo } from '@/data/recipes';
import type { BaitId, DecorId, FishId, ForageId, PantryId, RecipeId } from '@/data/types';
import { CONTENTMENT, ECONOMY, WEATHER, contentmentBaseline } from '@/data/world';
import { decorBaselineBonus } from '@/data/decor';
import { Rng } from './rng';
import { STATE_VERSION, type DebugStateKind, type GameState, type TodayCounters, type WeatherState } from './GameState';

function zeroRecord<K extends string>(ids: readonly K[]): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const id of ids) out[id] = 0;
  return out;
}

export function emptyToday(): TodayCounters {
  return { fishCaught: 0, bestCatch: null, dishesCooked: 0, cookCounts: {}, moments: [], newRecipes: [], newFish: [] };
}

export function weatherOf(kind: WeatherState['kind']): WeatherState {
  return { kind, raining: kind === 'rain', mistBurnedOff: false, rainChangedToday: false, middayRolled: false };
}

/** A seed from the clock when none is given (debug ?seed= overrides). */
export function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1;
}

/** Day 1, clear, 120c, nothing owned, journal empty. */
export function createFreshState(seed: number = randomSeed()): GameState {
  const rng = new Rng(seed);
  const now = Date.now();
  const baseline = contentmentBaseline(CONTENTMENT.noTentBonus, []);
  return {
    version: STATE_VERSION,
    seed,
    rngState: rng.state,
    trip: 1,
    day: 1,
    dayT: 0,
    isNight: false,
    weather: weatherOf(WEATHER.day1),
    money: ECONOMY.startMoney,
    contentment: { value: baseline, baseline, fireSittingSeconds: 0, rainRestSeconds: 0, peakToday: baseline },
    inventory: {
      gear: {},
      bait: zeroRecord<BaitId>(BAITS.map((b) => b.id)),
      pantry: zeroRecord<PantryId>(PANTRY.map((p) => p.id)),
      forage: zeroRecord<ForageId>(FORAGE.map((f) => f.id)),
      fish: [],
      dishes: [],
    },
    activeBait: null,
    activeRod: null,
    camp: { tentId: null, tentSpot: null, pitched: false, pegsTapped: 0, placedDecor: [], decorOwned: {} },
    journal: {
      fish: {},
      recipes: {},
      moments: {},
      companion: { visits: 0, visitDays: [], befriended: false },
      mystery: { step: 0, scaleFound: false, legendHeard: false, dumplingsCooked: false, finaleDone: false, guaranteedRainQueued: false },
      trip: [],
      badges: [],
    },
    today: emptyToday(),
    flags: {
      introSeen: false,
      essentialsAskedOnce: false,
      rodHintCasts: 0,
      firstRainyNight: null,
      lastRainyNight: null,
      mistySunriseSeen: false,
      firefliesSitSeconds: 0,
      decorFirstPlaced: {},
    },
    hero: { x: 0, facing: 1 },
    settings: { music: 0.8, sounds: 1, ambience: 0.9, reduceMotion: false, largeText: false },
    meta: { createdAt: now, updatedAt: now, playSeconds: 0 },
  };
}

function knowRecipe(s: GameState, id: RecipeId, day: number, count = 1): void {
  s.journal.recipes[id] = { count, firstDay: day };
}
function knowFish(s: GameState, id: FishId, cm: number, day: number, count = 1): void {
  s.journal.fish[id] = { bestCm: cm, count, firstDay: day };
}
function holdDish(s: GameState, id: RecipeId, fishId?: FishId): void {
  const r = RECIPE_BY_ID[id];
  const info = dishInfo(id);
  const sell = r.sell.kind === 'fish_multiple' && fishId ? Math.ceil(FISH_BY_ID[fishId].sell * r.sell.factor) : info.sell;
  s.inventory.dishes.push({ id, sell, contentment: r.contentment, ...(fishId ? { fishId } : {}) });
}
function placeDecor(s: GameState, id: DecorId, point: string): void {
  s.camp.decorOwned[id] = (s.camp.decorOwned[id] ?? 0) + 1;
  s.camp.placedDecor.push({ id, point });
  s.flags.decorFirstPlaced[id] = true;
}
function rebaseline(s: GameState): void {
  const tentBonus = s.camp.pitched && s.camp.tentId ? TENT_BY_ID[s.camp.tentId].tentBonus : CONTENTMENT.noTentBonus;
  const baseline = contentmentBaseline(tentBonus, s.camp.placedDecor.map((d) => d.id), decorBaselineBonus);
  s.contentment.baseline = baseline;
  s.contentment.value = Math.max(baseline, s.contentment.value);
  s.contentment.peakToday = Math.max(s.contentment.value, s.contentment.peakToday);
}

/**
 * Debug fixtures for ?state=. 'midtrip': Day 3, Monsoon Dome at spot 1 with a lantern and a cushion, Cane Rod,
 * pot + skillet + kettle, a few fish/forage/pantry/dishes, 3 recipes known, 60c. 'finale': Day 5 rainy night, dayT 1,
 * Contentment 80, mystery step 4, steamer owned, Moonlight Dumplings in the backpack, legend heard.
 */
export function createDebugState(kind: DebugStateKind, seed: number = 7): GameState {
  const s = createFreshState(seed);
  s.flags.introSeen = true;
  if (kind === 'fresh') return s;

  // Shared mid-trip camp.
  s.inventory.gear = { tent_dome: true, rod_willow: true, pot: true, skillet: true, kettle: true };
  s.activeRod = 'rod_willow';
  s.camp.tentId = 'tent_dome';
  s.camp.tentSpot = 1;
  s.camp.pitched = true;
  s.camp.pegsTapped = 4;
  placeDecor(s, 'lantern', 'tent_hang_0');
  placeDecor(s, 'cushion', 'ground_3');
  placeDecor(s, 'bunting', 'tent_hang_2');
  placeDecor(s, 'lights', 'jamun-left');
  s.inventory.bait.bait_wiggly = 3;
  s.inventory.pantry.rice = 2;
  s.inventory.pantry.honey = 1;
  s.inventory.pantry.tea = 1;
  s.inventory.forage.berries = 3;
  s.inventory.forage.herbs = 2;
  s.inventory.forage.mushrooms = 2;
  s.flags.firstRainyNight = 2;
  s.flags.lastRainyNight = 2;
  s.journal.mystery.step = 1;

  if (kind === 'midtrip') {
    s.day = 3;
    s.dayT = 0.42;
    s.weather = weatherOf('clear');
    s.money = 60;
    s.inventory.fish.push({ id: 'minnow', cm: 7.4, caughtDay: 3 }, { id: 'carp', cm: 25.1, caughtDay: 2 });
    knowFish(s, 'minnow', 8.1, 1, 3);
    knowFish(s, 'carp', 25.1, 2, 1);
    knowFish(s, 'trout', 29, 2, 1);
    knowRecipe(s, 'herb_tea', 1, 2);
    knowRecipe(s, 'honey_tea', 2);
    knowRecipe(s, 'grilled_fish', 2);
    holdDish(s, 'honey_tea');
    holdDish(s, 'grilled_fish', 'trout');
    s.journal.companion.visits = 1;
    s.journal.companion.visitDays = [2];
    s.journal.trip = [
      { day: 1, peakContentment: 32, fishCaught: 3, bestCatch: { id: 'minnow', cm: 8.1 }, dishesCooked: 2, mostCooked: 'herb_tea', moments: [], newRecipes: ['herb_tea'], newFish: ['minnow'] },
      { day: 2, peakContentment: 48, fishCaught: 2, bestCatch: { id: 'trout', cm: 29 }, dishesCooked: 2, mostCooked: 'grilled_fish', moments: ['shooting_star'], newRecipes: ['honey_tea', 'grilled_fish'], newFish: ['carp', 'trout'] },
    ];
    s.journal.moments.shooting_star = { count: 1, firstDay: 2 };
    rebaseline(s);
    s.contentment.value = 45;
    s.contentment.peakToday = 45;
    return s;
  }

  // finale
  s.day = 5;
  s.dayT = 1;
  s.isNight = true;
  s.weather = weatherOf('rain');
  s.money = 38;
  s.inventory.gear.steamer = true;
  s.inventory.pantry.flour = 1;
  s.inventory.forage.moonblossom = 1;
  knowFish(s, 'minnow', 8.1, 1, 4);
  knowFish(s, 'carp', 25.1, 2, 2);
  knowFish(s, 'trout', 29, 2, 1);
  knowFish(s, 'loach', 17.5, 2, 1);
  knowFish(s, 'glowfin', 21.2, 4, 2);
  knowRecipe(s, 'herb_tea', 1, 3);
  knowRecipe(s, 'honey_tea', 2, 2);
  knowRecipe(s, 'grilled_fish', 2, 2);
  knowRecipe(s, 'mushroom_soup', 3);
  knowRecipe(s, 'moonlight_dumplings', 5);
  holdDish(s, 'moonlight_dumplings', 'glowfin');
  s.journal.moments.shooting_star = { count: 1, firstDay: 2 };
  s.journal.moments.rainbow = { count: 1, firstDay: 3 };
  s.journal.mystery = { step: 4, scaleFound: true, legendHeard: true, dumplingsCooked: true, finaleDone: false, guaranteedRainQueued: false };
  s.flags.lastRainyNight = 5;
  s.journal.companion.visits = 2;
  s.journal.companion.visitDays = [2, 4];
  s.journal.trip = [
    { day: 1, peakContentment: 32, fishCaught: 3, bestCatch: { id: 'minnow', cm: 8.1 }, dishesCooked: 2, mostCooked: 'herb_tea', moments: [], newRecipes: ['herb_tea'], newFish: ['minnow'] },
    { day: 2, peakContentment: 48, fishCaught: 3, bestCatch: { id: 'trout', cm: 29 }, dishesCooked: 3, mostCooked: 'grilled_fish', moments: ['shooting_star'], newRecipes: ['honey_tea', 'grilled_fish'], newFish: ['carp', 'trout', 'loach'] },
    { day: 3, peakContentment: 61, fishCaught: 1, bestCatch: { id: 'carp', cm: 25.1 }, dishesCooked: 2, mostCooked: 'mushroom_soup', moments: ['rainbow'], newRecipes: ['mushroom_soup'], newFish: [] },
    { day: 4, peakContentment: 66, fishCaught: 2, bestCatch: { id: 'glowfin', cm: 21.2 }, dishesCooked: 1, mostCooked: 'herb_tea', moments: [], newRecipes: [], newFish: ['glowfin'] },
  ];
  rebaseline(s);
  s.contentment.value = 80;
  s.contentment.peakToday = 80;
  s.contentment.fireSittingSeconds = 30;
  s.flags.firefliesSitSeconds = 30;
  return s;
}
