/**
 * campApi: debug hooks on window.__game.api (DEBUG.enabled builds) for the smoke test and screenshots
 * (scripts/smoke.mjs drives exactly this surface). Fishing and foraging are reached through their flows.
 */
import Phaser from 'phaser';
import type { CampScene } from '@/scenes/Camp';
import { SCENES } from '@/scenes/Boot';
import { DEBUG } from '@/config/debug';
import {
  addDish, buyGear, canAfford, discoverRecipe, earn, eatDish, getState, markDirty, pitchTent as storePitchTent, recordCook,
  removeFish, removeForage, removePantry, saveNow as storeSaveNow, update, type GameState,
} from '@/state';
import { dayTFor, phaseAt } from '@/world/lighting';
import { ESSENTIALS_TAGGED, GEAR_BY_ID, STRINGS, isFishId, isForageId, isPantryId, matchRecipe } from '@/data';
import type { CookwareId, DishId, FishId, ForageId, GearId, IngredientId, TentId, WeatherKind } from '@/data/types';
import { particleBudget } from '@/fx/particles';
import { Button } from '@/ui/Button';
import { LAYOUT } from '@/world/layout';
import { fishingOf } from '@/systems/fishing';
import { foragingOf } from '@/systems/foraging';
import { companionOf } from '@/systems/companionFlow';
import { applyMysteryStep } from '@/systems/mysteryFlow';
import { runFinale } from '@/systems/finale';

export const CAMP_API = {
  /** auto-continue the DaySummary this long after it opens */
  summaryContinueMs: 300,
  summaryPollMs: 100,
  summaryWaitMaxMs: 8000,
  /** scripts cast from the jetty end toward this water point */
  castTarget: { x: LAYOUT.jetty.x1 + 160, y: 560 },
  /** Album page flips the api waits between "next" presses, and how many pages it will turn to find the postcard */
  albumFlipMs: 350,
  albumMaxFlips: 16,
} as const;

export interface CampApi {
  walkTo(x: number): Promise<void>;
  /** Pitch the best owned tent on spot 0-2 at once (no peg taps). */
  pitchTent(spot: number): boolean;
  /** Night -> summary -> dawn. Resolves at dawn (the summary auto-continues in debug builds). */
  sleep(): Promise<void>;
  setTime(name: string): void;
  setWeather(kind: WeatherKind): void;
  state(): GameState;
  /** Give money if needed, then buy the Day 1 essentials (leaf tent, bamboo rod, kettle). */
  buyEssentials(): Record<string, boolean>;
  /** Forage a spot (data or layout id; default: the herb patch, else the first available). Resolves when the items landed. */
  forage(spotId?: string): Promise<{ id: ForageId; n: number } | null>;
  /** Cast; `force` makes the next bite that species and auto-hooks / keeps. Resolves after Keep. */
  fish(opts?: { force?: FishId }): Promise<void>;
  /** Cook without the overlay: same steps as the Cooking scene. Returns the dish id, or null when ingredients are missing. */
  cook(cookwareId: CookwareId, ingredientIds: IngredientId[]): DishId | null;
  /** Eat the most recently cooked dish; returns the Contentment added, or null. */
  eatLastDish(): number | null;
  /** Flush the save to storage now. */
  saveNow(): boolean;
  /** Force the companion to peek from the nearest thicket (screenshots). */
  companionPeek(): Promise<void>;
  /** Give money if needed, then buy one piece of gear (pots, rods, tents...). */
  buy(id: GearId): boolean;
  /** Fishing (M4): jump to BITE with the "!" up and hold there (screenshots). */
  forceBite(fishId?: FishId): boolean;
  /** Fishing (M4): open the catch card for a species (screenshots). */
  showCatchCard(fishId?: FishId): boolean;
  /** Primary scene on screen ('Camp', 'Album', 'Intro'...), kept by trackScenes(). */
  sceneKey(): string | undefined;
  /** The game loop's measured FPS. */
  fps(): number;
  /** Particle slots reserved by live effects, and the budget cap. */
  particles(): { live: number; max: number };
  /** Number of textures in the texture manager. */
  textures(): number;
  /** Album: press "Stay a little longer" (turns to the postcard page first). Resolves once Camp has started. */
  stayLonger(): Promise<boolean>;
  /** Album: press "Start a new trip" and confirm "Start over". Resolves once Intro has started. */
  newTrip(): Promise<boolean>;
  scene: CampScene;
  /** Extension point for later agents. */
  [k: string]: unknown;
}

function hasIngredient(s: GameState, id: IngredientId): boolean {
  if (isPantryId(id)) return s.inventory.pantry[id] > 0;
  if (isForageId(id)) return s.inventory.forage[id] > 0;
  if (isFishId(id)) return s.inventory.fish.some((f) => f.id === id);
  return id === 'any_fish' && s.inventory.fish.length > 0;
}

/** The Cooking scene's finishCooking() steps, without the overlay. */
export function cookDirect(cookwareId: CookwareId, ingredientIds: IngredientId[]): DishId | null {
  const s = getState();
  if (!s.inventory.gear[cookwareId]) return null;
  // resolve 'any_fish' to a held species, then check availability (counting duplicates)
  const ids: IngredientId[] = ingredientIds.map((id) => (id === 'any_fish' ? (s.inventory.fish[0]?.id ?? id) : id));
  const need = new Map<string, number>();
  for (const id of ids) need.set(id, (need.get(id) ?? 0) + 1);
  for (const [id, n] of need) {
    if (!hasIngredient(s, id as IngredientId)) return null;
    const have = isPantryId(id) ? s.inventory.pantry[id] : isForageId(id) ? s.inventory.forage[id] : s.inventory.fish.filter((f) => f.id === id).length;
    if (have < n) return null;
  }
  const match = matchRecipe(cookwareId, ids);
  for (const id of ids) {
    if (isPantryId(id)) removePantry(id);
    else if (isForageId(id)) removeForage(id);
    else if (isFishId(id)) removeFish(id);
  }
  const fishId = ids.find((id): id is FishId => isFishId(id));
  addDish({ id: match.recipeId, sell: match.sellValue, contentment: match.contentment, ...(fishId ? { fishId } : {}) });
  recordCook(match.recipeId);
  if (match.isRecipe && match.recipeId !== 'mystery_mush') discoverRecipe(match.recipeId);
  markDirty();
  return match.recipeId;
}

export function installCampApi(camp: CampScene): CampApi {
  const api: CampApi = {
    scene: camp,
    walkTo: (x) => camp.walkHeroTo(x),
    pitchTent: (spot) => {
      const id: TentId | null = camp.tentFlow.ownedTent();
      if (!id || spot < 0 || spot >= LAYOUT.tentSpots.length) return false;
      const ok = storePitchTent(id, spot);
      if (ok) {
        // rebuild the tent entity from the store
        camp.tent?.destroy();
        camp.tent = null;
        camp.unregisterInteractable('tent');
        camp.tentFlow.create();
      }
      return ok;
    },
    sleep: async () => {
      const night = camp.restFlow.sleep();
      if (DEBUG.enabled) autoContinueSummary(camp);
      await night;
    },
    setTime: (name) => {
      update((s) => {
        s.dayT = dayTFor(name);
        s.isNight = phaseAt(s.dayT) === 'night';
      }, 'debug');
      camp.clock.applyNow();
    },
    setWeather: (kind) => {
      update((s) => {
        s.weather.kind = kind;
        s.weather.raining = kind === 'rain';
        s.weather.mistBurnedOff = false;
      }, 'debug');
      camp.clock.applyNow();
    },
    state: () => getState(),
    buyEssentials: () => {
      const out: Record<string, boolean> = {};
      for (const id of ESSENTIALS_TAGGED) {
        const price = GEAR_BY_ID[id].price;
        if (!getState().inventory.gear[id] && !canAfford(price)) earn(price - getState().money);
        out[id] = getState().inventory.gear[id] === true || buyGear(id);
      }
      markDirty();
      return out;
    },
    forage: (spotId) => foragingOf(camp)?.forage(spotId) ?? Promise.resolve(null),
    fish: (opts = {}) => {
      const flow = fishingOf(camp);
      if (!flow) return Promise.resolve();
      const t = CAMP_API.castTarget;
      return flow.onWaterTap(t.x, t.y, { force: opts.force, auto: true });
    },
    cook: (cookwareId, ingredientIds) => cookDirect(cookwareId, ingredientIds),
    eatLastDish: () => {
      const dishes = getState().inventory.dishes;
      if (dishes.length === 0) return null;
      const added = eatDish(dishes[dishes.length - 1].id);
      camp.hero.setExpression('munching');
      camp.time.delayedCall(1200, () => camp.hero.setExpression('happy'));
      markDirty();
      return added;
    },
    saveNow: () => storeSaveNow(),
    companionPeek: () => companionOf(camp)?.forcePeek() ?? Promise.resolve(),
    /** Mystery (M3): set the clue step (0-5) with its prerequisite flags. */
    mystery: (step: number) => applyMysteryStep(step),
    /** Mystery (M3): run the finale now (skippable). */
    finale: () => runFinale(camp, { skippable: true }),
    buy: (id) => {
      if (getState().inventory.gear[id]) return true;
      const price = GEAR_BY_ID[id].price;
      if (!canAfford(price)) earn(price - getState().money);
      const ok = buyGear(id);
      markDirty();
      return ok;
    },
    forceBite: (fishId = 'minnow') => fishingOf(camp)?.forceBite(fishId) ?? false,
    showCatchCard: (fishId = 'minnow') => fishingOf(camp)?.forceCard(fishId) ?? false,
    sceneKey: () => window.__game.scene,
    fps: () => camp.game.loop.actualFps,
    particles: () => ({ live: particleBudget.used, max: particleBudget.max }),
    textures: () => Object.keys(camp.textures.list).length,
    stayLonger: () => albumPress(camp, STRINGS.album.stayLonger, SCENES.camp),
    newTrip: async () => {
      const opened = await albumPress(camp, STRINGS.album.newTrip, null);
      if (!opened) return false;
      await wait(camp, CAMP_API.albumFlipMs);
      return albumPress(camp, STRINGS.settings.startOver, SCENES.intro);
    },
  };
  if (DEBUG.enabled) {
    window.__game.api = api;
    // ?bite=1 / ?catch=1 once the camp has settled (screenshots)
    if (DEBUG.bite || DEBUG.catch) camp.events.once('ready', () => { if (DEBUG.bite) api.forceBite(); else api.showCatchCard(); });
  }
  return api;
}

function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((r) => scene.time.delayedCall(ms, r));
}

/** Every Button under a scene's display list (containers included). */
function buttonsOf(scene: Phaser.Scene): Button[] {
  const out: Button[] = [];
  const walk = (list: Phaser.GameObjects.GameObject[]): void => {
    for (const o of list) {
      if (o instanceof Button) out.push(o);
      if (o instanceof Phaser.GameObjects.Container) walk(o.list);
    }
  };
  walk(scene.children.list);
  return out;
}

/**
 * Press the Album button with this label through its own pointer events (the real UI path). The album opens on the
 * cover, so "next" is pressed until the button appears. With `until`, resolves once that scene has started.
 */
async function albumPress(camp: CampScene, label: string, until: string | null): Promise<boolean> {
  const album = camp.scene.get(SCENES.album);
  if (!album || !album.scene.isActive()) return false;
  const press = (b: Button): void => { b.emit(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN); b.emit(Phaser.Input.Events.GAMEOBJECT_POINTER_UP); };
  for (let i = 0; i <= CAMP_API.albumMaxFlips; i++) {
    const btns = buttonsOf(album);
    const target = btns.find((b) => b.label === label);
    if (target) {
      press(target);
      if (!until) return true;
      for (let k = 0; k < 40 && window.__game.scene !== until; k++) await wait(album, 100);
      return window.__game.scene === until;
    }
    const next = btns.find((b) => b.label === STRINGS.albumExtras.next);
    if (!next) return false;
    press(next);
    await wait(album, CAMP_API.albumFlipMs);
  }
  return false;
}

/** Debug: once the DaySummary overlay is up, tap it closed after a beat so scripted sleeps resolve. */
function autoContinueSummary(camp: CampScene): void {
  const started = camp.time.now;
  const poll = (): void => {
    const summary = camp.scene.get(SCENES.daysummary);
    if (summary && summary.scene.isActive()) {
      camp.time.delayedCall(CAMP_API.summaryContinueMs, () => {
        if (summary.scene.isActive()) summary.input.emit(Phaser.Input.Events.POINTER_UP);
        else camp.events.emit('summary:closed');
      });
      return;
    }
    if (camp.time.now - started < CAMP_API.summaryWaitMaxMs) camp.time.delayedCall(CAMP_API.summaryPollMs, poll);
  };
  camp.time.delayedCall(CAMP_API.summaryPollMs, poll);
}
