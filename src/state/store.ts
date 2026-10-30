/**
 * store.ts: the observable GameState store and every rule-encoding action (spec sections 5 and 10).
 * Scenes call actions; they never poke the state directly. Every action runs through update(), which notifies
 * subscribers and marks the save dirty (autosave 500 ms later). Pure rule math lives in data/* and the sibling
 * state modules; this file wires them to the state.
 */
import { DECOR_BY_ID } from '@/data/decor';
import { FISH_BY_ID } from '@/data/fish';
import { FORAGE_BY_ID } from '@/data/forage';
import { BAIT_BY_ID, GEAR_BY_ID, ROD_BY_ID } from '@/data/items';
import { GUARDIAN_GIFT, MYSTERY_STEPS } from '@/data/mystery';
import { PANTRY_BY_ID } from '@/data/pantry';
import type { BaitId, DecorId, DishId, FishId, ForageId, GearId, MomentId, PantryId, RecipeId, TentId } from '@/data/types';
import { COMPANION, CONTENTMENT } from '@/data/world';
import { checkBadges, noteRainyNight, rollNewDayWeather } from './clock';
import { gain, resetForDawn } from './contentment';
import { createDebugState, createFreshState, emptyToday, randomSeed } from './defaults';
import type { BadgeId, DayPage, DebugStateKind, GameState, HeldDish } from './GameState';
import { Rng } from './rng';
import { bindSaveSource, clearSave, flush, load, markDirty } from './save';

// ---------- the store ----------
export type Listener = (state: GameState, tag: string) => void;

let state: GameState = createFreshState();
let rng = new Rng(state.seed);
const listeners = new Set<Listener>();

function emit(tag: string): void {
  for (const l of listeners) l(state, tag);
}

export function getState(): GameState {
  return state;
}

/** Replace the whole state (load, debug fixtures, new trip). Re-seeds the RNG from it. */
export function setState(next: GameState, tag = 'set'): void {
  state = next;
  rng = new Rng(state.seed);
  rng.state = state.rngState || rng.state;
  emit(tag);
  markDirty();
}

/** Mutate in place, notify, mark the save dirty. The tag names the change for listeners ("money", "inventory"...). */
export function update(mutate: (s: GameState) => void, tag = 'update'): void {
  mutate(state);
  state.rngState = rng.state;
  emit(tag);
  markDirty();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The seeded RNG for weather and bites; its state is saved after every update(). */
export function getRng(): Rng {
  return rng;
}

export interface InitOptions {
  /** ?state= fixture; skips the save. */
  debug?: DebugStateKind;
  /** ?seed= override for a fresh or debug state. */
  seed?: number;
  /** ?day= override. */
  day?: number;
}
/** Load the save (or build a fresh/debug state) and bind autosave. Call once from Boot. */
export function initStore(opts: InitOptions = {}): GameState {
  bindSaveSource(getState);
  let next: GameState | null = null;
  if (opts.debug) next = createDebugState(opts.debug, opts.seed ?? 7);
  else next = load() ?? createFreshState(opts.seed ?? randomSeed());
  if (opts.day !== undefined && opts.day > 0) next.day = Math.floor(opts.day);
  state = next;
  rng = new Rng(state.seed);
  if (state.rngState) rng.state = state.rngState;
  emit('init');
  return state;
}

/** Write the save now (scene transitions, sleep). */
export function saveNow(): boolean {
  return flush();
}

// ---------- money ----------
/** Spend if affordable; false (and nothing happens) otherwise. Money never goes negative. */
export function spend(amount: number): boolean {
  if (amount < 0 || state.money < amount) return false;
  update((s) => {
    s.money -= amount;
  }, 'money');
  return true;
}
export function earn(amount: number): boolean {
  if (amount < 0) return false;
  update((s) => {
    s.money += amount;
  }, 'money');
  return true;
}
export function canAfford(amount: number): boolean {
  return state.money >= amount;
}

// ---------- shop: buying ----------
/** Buy gear at its listed price. Bait buys a pack; other gear is one-off ("Owned"). A new rod becomes active if better. */
export function buyGear(id: GearId): boolean {
  const g = GEAR_BY_ID[id];
  if (g.kind === 'bait') return buyBait(g.id);
  if (state.inventory.gear[id] || !canAfford(g.price)) return false;
  update((s) => {
    s.money -= g.price;
    s.inventory.gear[id] = true;
    if (g.kind === 'rod' && (s.activeRod === null || ROD_BY_ID[s.activeRod].tier < g.tier)) s.activeRod = g.id;
    // A bigger tent swaps in place.
    if (g.kind === 'tent' && s.camp.pitched) s.camp.tentId = g.id;
  }, 'inventory');
  return true;
}
export function buyBait(id: BaitId, packs = 1): boolean {
  const b = BAIT_BY_ID[id];
  const cost = b.price * packs;
  if (packs < 1 || !canAfford(cost)) return false;
  update((s) => {
    s.money -= cost;
    s.inventory.bait[id] += b.packSize * packs;
    if (s.activeBait === null) s.activeBait = id;
  }, 'inventory');
  return true;
}
export function buyPantry(id: PantryId, qty = 1): boolean {
  const p = PANTRY_BY_ID[id];
  const cost = p.price * qty;
  if (qty < 1 || !canAfford(cost)) return false;
  update((s) => {
    s.money -= cost;
    s.inventory.pantry[id] += p.portions * qty;
  }, 'inventory');
  return true;
}
/** Buy a Cozy item (gifts have no price and cannot be bought). */
export function buyDecor(id: DecorId): boolean {
  const d = DECOR_BY_ID[id];
  if (d.price === null || !canAfford(d.price)) return false;
  update((s) => {
    s.money -= d.price ?? 0;
    s.camp.decorOwned[id] = (s.camp.decorOwned[id] ?? 0) + 1;
  }, 'inventory');
  return true;
}
/** Give a decor item (the guardian's lantern). */
export function giftDecor(id: DecorId): void {
  update((s) => {
    s.camp.decorOwned[id] = (s.camp.decorOwned[id] ?? 0) + 1;
  }, 'inventory');
}

export function ownsGear(id: GearId): boolean {
  return state.inventory.gear[id] === true;
}
export function setActiveBait(id: BaitId | null): void {
  update((s) => {
    s.activeBait = id;
  }, 'inventory');
}
export function setActiveRod(id: GearId | null): void {
  update((s) => {
    s.activeRod = id !== null && id in ROD_BY_ID ? (id as keyof typeof ROD_BY_ID) : null;
  }, 'inventory');
}
/** Use one unit of the active bait (a cast). Returns false when none is left (active bait clears). */
export function useBait(): boolean {
  const id = state.activeBait;
  if (!id || state.inventory.bait[id] <= 0) {
    if (id) setActiveBait(null);
    return false;
  }
  update((s) => {
    s.inventory.bait[id] -= 1;
    if (s.inventory.bait[id] <= 0) s.activeBait = null;
  }, 'inventory');
  return true;
}

// ---------- inventory: forage, fish, dishes ----------
export function addForage(id: ForageId, qty = 1): void {
  if (qty <= 0) return;
  update((s) => {
    s.inventory.forage[id] += qty;
  }, 'inventory');
}
export function removeForage(id: ForageId, qty = 1): boolean {
  if (qty <= 0 || state.inventory.forage[id] < qty) return false;
  update((s) => {
    s.inventory.forage[id] -= qty;
  }, 'inventory');
  return true;
}
export function removePantry(id: PantryId, qty = 1): boolean {
  if (qty <= 0 || state.inventory.pantry[id] < qty) return false;
  update((s) => {
    s.inventory.pantry[id] -= qty;
  }, 'inventory');
  return true;
}

/** Keep a caught fish: into the backpack and today's counters (the journal stamp is discoverFish). */
export function addFish(id: FishId, cm: number): void {
  update((s) => {
    s.inventory.fish.push({ id, cm, caughtDay: s.day });
    s.today.fishCaught += 1;
    if (!s.today.bestCatch || cm > s.today.bestCatch.cm) s.today.bestCatch = { id, cm };
  }, 'inventory');
}
/** Remove `qty` fish of a species (smallest first, so the biggest stay for the journal's pride). */
export function removeFish(id: FishId, qty = 1): boolean {
  const have = state.inventory.fish.filter((f) => f.id === id).length;
  if (qty <= 0 || have < qty) return false;
  update((s) => {
    for (let n = 0; n < qty; n++) {
      let best = -1;
      for (let i = 0; i < s.inventory.fish.length; i++) {
        const f = s.inventory.fish[i];
        if (f.id === id && (best < 0 || f.cm < s.inventory.fish[best].cm)) best = i;
      }
      if (best >= 0) s.inventory.fish.splice(best, 1);
    }
  }, 'inventory');
  return true;
}
/** Let a fish go: +2 Contentment, nothing kept. */
export function releaseFish(): number {
  let added = 0;
  update((s) => {
    added = gain(s, CONTENTMENT.gains.releaseFish);
  }, 'contentment');
  return added;
}

export function addDish(dish: HeldDish): void {
  update((s) => {
    s.inventory.dishes.push({ ...dish });
  }, 'inventory');
}
export function removeDish(id: DishId, qty = 1): boolean {
  const have = state.inventory.dishes.filter((d) => d.id === id).length;
  if (qty <= 0 || have < qty) return false;
  update((s) => {
    for (let n = 0; n < qty; n++) {
      const i = s.inventory.dishes.findIndex((d) => d.id === id);
      if (i >= 0) s.inventory.dishes.splice(i, 1);
    }
  }, 'inventory');
  return true;
}
export function hasDish(id: DishId): boolean {
  return state.inventory.dishes.some((d) => d.id === id);
}
/** A dish was cooked (any result, Mystery Mush included): today's counters for the Trip page. */
export function recordCook(id: DishId): void {
  update((s) => {
    s.today.dishesCooked += 1;
    s.today.cookCounts[id] = (s.today.cookCounts[id] ?? 0) + 1;
  }, 'today');
}
/** Eat a dish from the backpack: removes it and adds its Contentment. Returns the amount added, or null if absent. */
export function eatDish(id: DishId): number | null {
  const i = state.inventory.dishes.findIndex((d) => d.id === id);
  if (i < 0) return null;
  let added = 0;
  update((s) => {
    const [dish] = s.inventory.dishes.splice(i, 1);
    added = gain(s, dish.contentment);
  }, 'contentment');
  return added;
}

// ---------- shop: selling ----------
export type SellKind = 'fish' | 'forage' | 'dish';
/** Price of one unit as the Sell tab lists it (dishes use the price fixed when cooked; null = unsellable). */
export function sellPrice(kind: SellKind, id: string): number | null {
  if (kind === 'fish') return FISH_BY_ID[id as FishId]?.sell ?? null;
  if (kind === 'forage') return FORAGE_BY_ID[id as ForageId]?.sell ?? null;
  const dish = state.inventory.dishes.find((d) => d.id === id);
  return dish ? dish.sell : null;
}
/** Sell `qty` of a thing at listed prices. Returns the money earned (0 when nothing could be sold). */
export function sell(kind: SellKind, id: string, qty = 1): number {
  if (qty <= 0) return 0;
  let earned = 0;
  if (kind === 'fish') {
    const fid = id as FishId;
    const price = FISH_BY_ID[fid]?.sell;
    const have = state.inventory.fish.filter((f) => f.id === fid).length;
    const n = Math.min(qty, have);
    if (!price || n <= 0) return 0;
    update((s) => {
      for (let k = 0; k < n; k++) {
        let best = -1;
        for (let i = 0; i < s.inventory.fish.length; i++) {
          const f = s.inventory.fish[i];
          if (f.id === fid && (best < 0 || f.cm < s.inventory.fish[best].cm)) best = i;
        }
        if (best >= 0) s.inventory.fish.splice(best, 1);
      }
      earned = price * n;
      s.money += earned;
    }, 'sell');
    return earned;
  }
  if (kind === 'forage') {
    const fid = id as ForageId;
    const price = FORAGE_BY_ID[fid]?.sell;
    const n = Math.min(qty, state.inventory.forage[fid] ?? 0);
    if (price === null || price === undefined || n <= 0) return 0;
    update((s) => {
      s.inventory.forage[fid] -= n;
      earned = price * n;
      s.money += earned;
    }, 'sell');
    return earned;
  }
  // dishes: each carries its own price; unsellable ones (null) stay.
  const did = id as DishId;
  const sellable = state.inventory.dishes.filter((d) => d.id === did && d.sell !== null && d.sell > 0);
  const n = Math.min(qty, sellable.length);
  if (n <= 0) return 0;
  update((s) => {
    for (let k = 0; k < n; k++) {
      const i = s.inventory.dishes.findIndex((d) => d.id === did && d.sell !== null && d.sell > 0);
      if (i < 0) break;
      const [dish] = s.inventory.dishes.splice(i, 1);
      earned += dish.sell ?? 0;
    }
    s.money += earned;
  }, 'sell');
  return earned;
}

// ---------- camp: tent and decor ----------
/** Start pitching: the tent lies flat on a spot, pegs 0/4. */
export function choosePitchSpot(tentId: TentId, spot: number): boolean {
  if (!state.inventory.gear[tentId]) return false;
  update((s) => {
    s.camp.tentId = tentId;
    s.camp.tentSpot = spot;
    s.camp.pitched = false;
    s.camp.pegsTapped = 0;
  }, 'camp');
  return true;
}
/** Tap a peg; after the 4th the tent springs up. Returns pegs tapped so far. */
export function tapPeg(): number {
  if (state.camp.tentId === null || state.camp.pitched) return state.camp.pegsTapped;
  update((s) => {
    s.camp.pegsTapped = Math.min(TENT_PEGS, s.camp.pegsTapped + 1);
    if (s.camp.pegsTapped >= TENT_PEGS) s.camp.pitched = true;
  }, 'camp');
  return state.camp.pegsTapped;
}
export const TENT_PEGS = 4;
/** Pitch at once (debug fixtures, swap-in-place, or after the 4th peg). */
export function pitchTent(tentId: TentId, spot: number): boolean {
  if (!state.inventory.gear[tentId]) return false;
  update((s) => {
    s.camp.tentId = tentId;
    s.camp.tentSpot = spot;
    s.camp.pitched = true;
    s.camp.pegsTapped = TENT_PEGS;
  }, 'camp');
  return true;
}

export function decorInBackpack(id: DecorId): number {
  const owned = state.camp.decorOwned[id] ?? 0;
  const placed = state.camp.placedDecor.filter((d) => d.id === id).length;
  return Math.max(0, owned - placed);
}
export function pointOccupied(point: string): boolean {
  return state.camp.placedDecor.some((d) => d.point === point);
}
/** Place an owned item on a free snap point. First-ever placement of that item: +5 Contentment. */
export function placeDecor(id: DecorId, point: string): { placed: boolean; firstTime: boolean } {
  if (decorInBackpack(id) <= 0 || pointOccupied(point)) return { placed: false, firstTime: false };
  let firstTime = false;
  update((s) => {
    s.camp.placedDecor.push({ id, point });
    if (!s.flags.decorFirstPlaced[id]) {
      s.flags.decorFirstPlaced[id] = true;
      firstTime = true;
      gain(s, CONTENTMENT.gains.firstDecorPlacement);
    }
  }, 'camp');
  return { placed: true, firstTime };
}
/** Move a placed item to another free point. */
export function moveDecor(fromPoint: string, toPoint: string): boolean {
  const i = state.camp.placedDecor.findIndex((d) => d.point === fromPoint);
  if (i < 0 || pointOccupied(toPoint)) return false;
  update((s) => {
    s.camp.placedDecor[i].point = toPoint;
  }, 'camp');
  return true;
}
/** Put a placed item back in the backpack. */
export function storeDecor(point: string): boolean {
  const i = state.camp.placedDecor.findIndex((d) => d.point === point);
  if (i < 0) return false;
  update((s) => {
    s.camp.placedDecor.splice(i, 1);
  }, 'camp');
  return true;
}

// ---------- journal ----------
/** Journal stamp for a species. Returns true (and +10 Contentment) the first time. */
export function discoverFish(id: FishId, cm: number): boolean {
  let isNew = false;
  update((s) => {
    const e = s.journal.fish[id];
    if (e) {
      e.count += 1;
      if (cm > e.bestCm) e.bestCm = cm;
    } else {
      s.journal.fish[id] = { bestCm: cm, count: 1, firstDay: s.day };
      s.today.newFish.push(id);
      gain(s, CONTENTMENT.gains.newFish);
      isNew = true;
    }
    checkBadges(s);
  }, 'journal');
  return isNew;
}
/** Journal stamp for a recipe. Returns true (and +8 Contentment) the first time. */
export function discoverRecipe(id: RecipeId): boolean {
  let isNew = false;
  update((s) => {
    const e = s.journal.recipes[id];
    if (e) e.count += 1;
    else {
      s.journal.recipes[id] = { count: 1, firstDay: s.day };
      s.today.newRecipes.push(id);
      gain(s, CONTENTMENT.gains.newRecipe);
      isNew = true;
    }
    checkBadges(s);
  }, 'journal');
  return isNew;
}
/** A rare moment happened: stamp it, +8 Contentment, onto today's page. Returns true the first time. */
export function recordMoment(id: MomentId): boolean {
  let isNew = false;
  update((s) => {
    const e = s.journal.moments[id];
    if (e) e.count += 1;
    else {
      s.journal.moments[id] = { count: 1, firstDay: s.day };
      isNew = true;
    }
    if (!s.today.moments.includes(id)) s.today.moments.push(id);
    if (id === 'misty_sunrise') s.flags.mistySunriseSeen = true;
    gain(s, CONTENTMENT.gains.rareMoment);
    checkBadges(s);
  }, 'journal');
  return isNew;
}
/** Share a dish with the companion: +6 Contentment; a share on a 3rd distinct day befriends it. */
export function companionVisit(day: number = state.day): { befriended: boolean; newlyBefriended: boolean; visits: number } {
  let newly = false;
  update((s) => {
    const c = s.journal.companion;
    c.visits += 1;
    if (!c.visitDays.includes(day)) c.visitDays.push(day);
    if (!c.befriended && c.visitDays.length >= COMPANION.sharesToBefriend) {
      c.befriended = true;
      newly = true;
    }
    gain(s, CONTENTMENT.gains.shareDish);
    checkBadges(s);
  }, 'journal');
  return { befriended: state.journal.companion.befriended, newlyBefriended: newly, visits: state.journal.companion.visits };
}
/** Advance the mystery to step n (never backwards). Step 4 queues the guaranteed rain; step 5 gifts the lantern. */
export function setMysteryStep(n: number): BadgeId[] {
  let badges: BadgeId[] = [];
  update((s) => {
    const m = s.journal.mystery;
    const step = Math.max(m.step, Math.min(MYSTERY_STEPS, Math.floor(n)));
    if (step === m.step) return;
    m.step = step;
    if (step >= 2) m.scaleFound = true;
    if (step >= 3) m.legendHeard = true;
    if (step >= 4 && !m.dumplingsCooked) {
      m.dumplingsCooked = true;
      m.guaranteedRainQueued = true;
    }
    if (step >= 5 && !m.finaleDone) {
      m.finaleDone = true;
      m.guaranteedRainQueued = false;
      s.camp.decorOwned[GUARDIAN_GIFT] = (s.camp.decorOwned[GUARDIAN_GIFT] ?? 0) + 1;
    }
    badges = checkBadges(s);
  }, 'journal');
  return badges;
}
export function setFlag<K extends keyof GameState['flags']>(key: K, value: GameState['flags'][K]): void {
  update((s) => {
    s.flags[key] = value;
  }, 'flags');
}
export function updateSettings(patch: Partial<GameState['settings']>): void {
  update((s) => {
    Object.assign(s.settings, patch);
  }, 'settings');
}
export function setHero(x: number, facing: GameState['hero']['facing']): void {
  // Hero position changes constantly; it is saved with the next action rather than on every step.
  state.hero.x = x;
  state.hero.facing = facing;
}

// ---------- days and trips ----------
function mostCookedOf(counts: Partial<Record<DishId, number>>): DishId | undefined {
  let best: DishId | undefined;
  let bestN = 0;
  for (const [id, n] of Object.entries(counts) as [DishId, number][]) {
    if (n > bestN) {
      best = id;
      bestN = n;
    }
  }
  return best;
}
/** Today's page as it stands (the day summary reads this before endDay). */
export function todayPage(s: GameState = state): DayPage {
  const t = s.today;
  const page: DayPage = {
    day: s.day,
    peakContentment: s.contentment.peakToday,
    fishCaught: t.fishCaught,
    dishesCooked: t.dishesCooked,
    moments: [...t.moments],
    newRecipes: [...t.newRecipes],
    newFish: [...t.newFish],
  };
  if (t.bestCatch) page.bestCatch = { ...t.bestCatch };
  const most = mostCookedOf(t.cookCounts);
  if (most) page.mostCooked = most;
  return page;
}
/**
 * Sleep: write today's Trip page, reset the per-day counters, start the next day at dawn with its weather rolled
 * and Contentment back at the baseline. Returns the page written and the new day's weather.
 */
export function endDay(): { page: DayPage; day: number; weather: GameState['weather']['kind'] } {
  let page: DayPage = todayPage();
  update((s) => {
    if (s.weather.raining) noteRainyNight(s);
    if (s.weather.raining && s.journal.mystery.guaranteedRainQueued) s.journal.mystery.guaranteedRainQueued = false;
    page = todayPage(s);
    const i = s.journal.trip.findIndex((p) => p.day === page.day);
    if (i >= 0) s.journal.trip[i] = page;
    else s.journal.trip.push(page);
    s.today = emptyToday();
    s.day += 1;
    s.dayT = 0;
    s.isNight = false;
    rollNewDayWeather(rng, s);
    resetForDawn(s);
    checkBadges(s);
  }, 'day');
  flush();
  return { page, day: state.day, weather: state.weather.kind };
}
/** Start a new trip: the journal and badges stay; money, gear, camp and inventory reset; trip + 1. */
export function startNewTrip(): GameState {
  const prev = state;
  const fresh = createFreshState(randomSeed());
  fresh.trip = prev.trip + 1;
  fresh.journal = { ...prev.journal, trip: [] };
  fresh.settings = { ...prev.settings };
  fresh.meta = { ...prev.meta, updatedAt: Date.now() };
  fresh.flags.introSeen = prev.flags.introSeen;
  fresh.flags.mistySunriseSeen = prev.flags.mistySunriseSeen;
  // The guardian's gift is kept across trips.
  if (prev.journal.mystery.finaleDone) fresh.camp.decorOwned[GUARDIAN_GIFT] = 1;
  setState(fresh, 'newTrip');
  flush();
  return state;
}
/** Erase the save and everything in it. Nothing is written until the next action (so the title shows no "Continue"). */
export function eraseEverything(): GameState {
  setState(createFreshState(randomSeed()), 'erase');
  clearSave();
  return state;
}
