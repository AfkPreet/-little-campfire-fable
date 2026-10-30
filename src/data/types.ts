/**
 * types.ts: the shared content types for src/data/*.
 * Content IDs are STABLE (save files, journal stamps and code reference them). Display names are a separate
 * `name` field that gets re-skinned to the world after the world lock; never rename an id.
 */
import type { DayPhase } from '@/world/lighting';

export type { DayPhase };

// ---------- ids ----------
export type TentId = 'tent_leaf' | 'tent_dome' | 'tent_cabin';
export type RodId = 'rod_bamboo' | 'rod_willow' | 'rod_moonlight';
export type BaitId = 'bait_wiggly' | 'bait_sparkle';
export type CookwareId = 'kettle' | 'pot' | 'skillet' | 'steamer';
export type GearId = TentId | RodId | BaitId | CookwareId;

export type PantryId = 'rice' | 'flour' | 'tea' | 'honey' | 'spice';
export type FishId = 'minnow' | 'carp' | 'trout' | 'perch' | 'loach' | 'glowfin' | 'koi' | 'golden';
export type ForageId = 'berries' | 'mushrooms' | 'herbs' | 'nuts' | 'moonblossom';
export type RecipeId =
  | 'herb_tea'
  | 'honey_tea'
  | 'berry_cordial'
  | 'spiced_tea'
  | 'mushroom_soup'
  | 'fish_congee'
  | 'campfire_stew'
  | 'berry_pudding'
  | 'nutty_porridge'
  | 'grilled_fish'
  | 'herb_butter_fish'
  | 'pancakes'
  | 'berry_pancakes'
  | 'mushroom_skewers'
  | 'cloud_buns'
  | 'moonlight_dumplings';
/** Every dish that can sit in the backpack: a recipe result or the non-recipe Mystery Mush. */
export type DishId = RecipeId | 'mystery_mush';
export type DecorId =
  | 'flower'
  | 'lantern'
  | 'cushion'
  | 'bunting'
  | 'chime'
  | 'rug'
  | 'lights'
  | 'bookshelf'
  | 'hammock'
  | 'telescope'
  | 'guardian_lantern';
export type MomentId = 'shooting_star' | 'rainbow' | 'firefly_swirl' | 'misty_sunrise' | 'golden_whisker' | 'moonbow';

/** Anything that can go into cookware. 'any_fish' is a recipe-side wildcard; the basket never holds it. */
export type IngredientId = PantryId | ForageId | FishId | 'any_fish';
/** Anything the backpack can hold. */
export type ItemId = GearId | PantryId | FishId | ForageId | DishId | DecorId;

export type ShopTab = 'camp' | 'fishing' | 'kitchen' | 'pantry' | 'cozy' | 'sell';
export const SHOP_TABS: readonly ShopTab[] = ['camp', 'fishing', 'kitchen', 'pantry', 'cozy', 'sell'];

export type Rarity = 'common' | 'uncommon' | 'rare';
export type WeatherKind = 'clear' | 'rain' | 'mist' | 'golden';
export const WEATHER_KINDS: readonly WeatherKind[] = ['clear', 'rain', 'mist', 'golden'];
/** Rod tiers: 1 bamboo, 2 willow, 3 moonlight. A fish with rodTier 2 needs "Willow Rod+". */
export type RodTier = 1 | 2 | 3;
export type ContentmentTier = 'cozy' | 'content' | 'glowing' | 'blissful';

// ---------- common card shape ----------
/** Every shop-visible thing shares this (the shop card reads name / price / flavor). */
export interface CardInfo {
  name: string;
  /** One cozy line for the shop card or journal. */
  flavor: string;
}

// ---------- gear ----------
interface GearBase extends CardInfo {
  id: GearId;
  tab: ShopTab;
  price: number;
  /** Effect line as printed in the spec table (for the shop card's small print). */
  effect: string;
}
export interface TentGear extends GearBase {
  id: TentId;
  kind: 'tent';
  tab: 'camp';
  /** Added to the Contentment baseline each dawn. */
  tentBonus: number;
  hangPoints: number;
  /** Rain sounds extra cozy inside (muffled rain variant plays stronger). */
  rainCozy: boolean;
  /** A lit window at night. */
  litWindow: boolean;
}
export interface RodGear extends GearBase {
  id: RodId;
  kind: 'rod';
  tab: 'fishing';
  tier: RodTier;
  /** Tap window after a bite, ms. */
  biteWindowMs: number;
  /** Multiplier on rare-fish bite weight. */
  rareMultiplier: number;
  glowsAtNight: boolean;
}
export interface BaitGear extends GearBase {
  id: BaitId;
  kind: 'bait';
  tab: 'fishing';
  /** Uses per purchase. */
  packSize: number;
  /** Multiplier on the wait before a bite (0.6 = bites come 40% sooner). */
  waitMultiplier: number;
  /** Multiplier on rare-fish bite weight. */
  rareMultiplier: number;
}
export interface CookwareGear extends GearBase {
  id: CookwareId;
  kind: 'cookware';
  tab: 'kitchen';
  /** What it cooks, for the card. */
  cooks: string;
  /** Hidden in the shop until this mystery clue (1-based step) is found. */
  unlockAfterClue?: number;
}
export type GearItem = TentGear | RodGear | BaitGear | CookwareGear;

// ---------- pantry ----------
export interface PantryItem extends CardInfo {
  id: PantryId;
  tab: 'pantry';
  price: number;
  /** Portions per purchase. */
  portions: 1;
}

// ---------- fish ----------
export interface FishSeason {
  /** Phases the fish bites in. 'any' = every phase. */
  phases: readonly DayPhase[] | 'any';
  /** Needs this weather right now (rain: raining; mist: morning mist still up). */
  weather?: 'rain' | 'mist';
}
export interface FishDef extends CardInfo {
  id: FishId;
  rarity: Rarity;
  season: FishSeason;
  /** Minimum rod tier that can hook it. */
  rodTier: RodTier;
  sell: number;
  /** Mean length in cm; catches vary +-30% around it. */
  baseCm: number;
  /** Journal hint for the undiscovered silhouette. */
  hint: string;
  /** Spec labels for the journal entry ("When" / "Rod" columns). */
  whenLabel: string;
  rodLabel: string;
  /** Golden Whisker: not in the weighted pool, a separate roll on every bite. */
  separateRollChance?: number;
}

// ---------- forage ----------
export type ForageSpotKind = 'berry_bush' | 'mushroom_log' | 'herb_patch' | 'nut_tree' | 'shore';
export interface ForageDef extends CardInfo {
  id: ForageId;
  spot: ForageSpotKind;
  /** 'day' = morning through golden hour; 'night' = night only; 'any' = always. */
  when: 'day' | 'night' | 'any';
  /** null = not sellable. */
  sell: number | null;
  /** Double yield after rain. */
  doubleAfterRain: boolean;
  /** Only appears once this mystery clue is found. */
  unlockAfterClue?: number;
  /** Items per pick (inclusive range). */
  yieldMin: number;
  yieldMax: number;
  whereLabel: string;
  whenLabel: string;
}
export interface ForageSpot {
  /** Stable spot id (saves remember what was picked today). */
  id: string;
  kind: ForageSpotKind;
  yields: ForageId;
}

// ---------- recipes ----------
export type DishSellRule =
  | { kind: 'fixed'; value: number }
  | { kind: 'fish_multiple'; factor: number }
  | { kind: 'unsellable' };
export interface RecipeDef extends CardInfo {
  id: RecipeId;
  /** Spec order 1-16; the journal lists recipes in this order. */
  order: number;
  cookware: CookwareId;
  /** Sorted ingredient ids; 'any_fish' is a wildcard for exactly one fish of any species. */
  ingredients: readonly IngredientId[];
  sell: DishSellRule;
  contentment: number;
  /** Journal hint for the undiscovered entry. */
  hint: string;
}
export interface DishDef extends CardInfo {
  id: DishId;
  sell: number | null;
  contentment: number;
  isRecipe: boolean;
}
export interface MatchContext {
  /** Sell price per fish species (defaults to FISH prices); used for 'any fish' dishes and the floor rule. */
  fishPrices?: Partial<Record<FishId, number>>;
}
export interface MatchResult {
  recipeId: RecipeId | 'mystery_mush';
  /** null = not sellable. */
  sellValue: number | null;
  contentment: number;
  /** false for Mystery Mush. */
  isRecipe: boolean;
}

// ---------- decor ----------
export type DecorPlacement = 'ground' | 'hang' | 'hang_span' | 'two_tree';
export interface DecorDef extends CardInfo {
  id: DecorId;
  tab: 'cozy';
  /** null = a gift (never for sale). */
  price: number | null;
  placement: DecorPlacement;
  /** Spec behavior line (drives the animation choice). */
  behavior: string;
  /** Contentment baseline per placed item: 2 normally, 5 for the Guardian Lantern. */
  baselineBonus: number;
  /** The hero can sit/read/nap here and it counts as sitting by the fire. */
  countsAsFireSitting: boolean;
  /** The hero sits on it by the fire (cushion). */
  heroSitsHere: boolean;
  /** Emits a warm light pool at night. */
  lightAtNight: boolean;
  /** Additive shooting-star chance (telescope +0.15). */
  shootingStarBonus: number;
  /** Never goes out (guardian lantern). */
  neverGoesOut: boolean;
  placementLabel: string;
}

// ---------- rare moments ----------
export type MomentCheck = 'dawn' | 'night' | 'catch';
export interface MomentDef extends CardInfo {
  id: MomentId;
  /** When it is checked. */
  check: MomentCheck;
  /** Spec trigger line. */
  trigger: string;
  /** Spec chance line. */
  chanceLabel: string;
  /** Base probability 0..1 ('always' moments use 1). */
  baseChance: number;
  firstTimeOnly: boolean;
  /** Journal hint for the undiscovered entry. */
  hint: string;
  contentment: number;
}
export interface MomentContext {
  check: MomentCheck;
  weather: WeatherKind;
  /** Was last night rainy (dawn checks). */
  rainedLastNight: boolean;
  /** Contentment tier right now. */
  tier: ContentmentTier;
  hasTelescope: boolean;
  /** Seconds spent sitting by the fire tonight (firefly swirl needs 20). */
  fireSitSeconds: number;
  /** Moments already stamped in the journal. */
  seen: ReadonlySet<MomentId> | readonly MomentId[];
  /** Mist still up (misty dawn). */
  mist: boolean;
}

// ---------- mystery ----------
export type MysteryTrigger =
  | 'first_night_outside'
  | 'dawn_after_first_rainy_night'
  | 'enter_shop_with_scale'
  | 'cook_moonlight_dumplings'
  | 'offering_on_rainy_glowing_night';
export interface MysteryClue {
  /** 1-based step. */
  step: number;
  id: string;
  title: string;
  trigger: MysteryTrigger;
  /** Plain description of the condition (for the integrator and the locked hint). */
  condition: string;
  /** Journal text once found. */
  journal: string;
  /** Locked-entry hint. */
  hint: string;
}

// ---------- random source ----------
/** The slice of state/rng.ts Rng these pure helpers need. */
export interface RandomSource {
  next(): number;
  range(min: number, max: number): number;
  chance(p: number): boolean;
}
