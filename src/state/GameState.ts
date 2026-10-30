/**
 * GameState.ts: the single typed save state (spec section 10). Everything the game remembers lives here, and only
 * here; scenes read it through state/store.ts and change it through the store's actions.
 *
 * Content ids come from data/types.ts and are stable. Numbers that tune rules live in data/world.ts, never here.
 */
import type {
  BaitId,
  DecorId,
  DishId,
  FishId,
  ForageId,
  GearId,
  MomentId,
  PantryId,
  RecipeId,
  RodId,
  TentId,
  WeatherKind,
} from '@/data/types';

/** Bump when the shape changes in a way save.ts needs to migrate. */
export const STATE_VERSION = 1;

export type Facing = 1 | -1;

export interface WeatherState {
  /** Rolled at dawn, lasts through the night. */
  kind: WeatherKind;
  /** Raining right now (rain may gently start or stop mid-day). */
  raining: boolean;
  /** A misty morning's mist has burned off (afternoon onwards). */
  mistBurnedOff: boolean;
  /** The 10% mid-day rain change happened today. */
  rainChangedToday: boolean;
  /** The mid-day change was rolled today (so it rolls once, whatever the result). */
  middayRolled: boolean;
}

export interface ContentmentState {
  /** 0..100, hidden from the player (shown as the hero's mood and the lantern). Never drops during a day. */
  value: number;
  /** This dawn's starting value: 10 + tent bonus + decor, capped at 40. */
  baseline: number;
  /** Seconds sat by the fire tonight (+1 per 10 s, max +10 a night). Resets at dawn. */
  fireSittingSeconds: number;
  /** Seconds rested in the tent doorway while it rained today (+1 per 10 s, max +10 a day). Resets at dawn. */
  rainRestSeconds: number;
  /** Highest value reached today (the Trip Album bloom). */
  peakToday: number;
}

export interface CaughtFish {
  id: FishId;
  cm: number;
  caughtDay: number;
}

export interface HeldDish {
  id: DishId;
  /** Sell price fixed when cooked (fish dishes depend on the fish used). null = unsellable (Moonlight Dumplings). */
  sell: number | null;
  /** Contentment gained when eaten. */
  contentment: number;
  /** The fish that went into an "any fish" dish, if one did. */
  fishId?: FishId;
}

export interface Inventory {
  gear: Partial<Record<GearId, true>>;
  bait: Record<BaitId, number>;
  pantry: Record<PantryId, number>;
  forage: Record<ForageId, number>;
  fish: CaughtFish[];
  dishes: HeldDish[];
}

export interface PlacedDecor {
  id: DecorId;
  /** Snap point id (the Camp scene owns the point layout). */
  point: string;
}

export interface CampState {
  tentId: TentId | null;
  /** Which of the 3 flat spots (0-2) the tent is on. */
  tentSpot: number | null;
  pitched: boolean;
  /** Pegs tapped so far while pitching (0-4). */
  pegsTapped: number;
  placedDecor: PlacedDecor[];
  /** Owned count per decor id (placed or in the backpack). */
  decorOwned: Partial<Record<DecorId, number>>;
}

export interface FishJournalEntry {
  bestCm: number;
  count: number;
  firstDay: number;
}
export interface CountJournalEntry {
  count: number;
  firstDay: number;
}

export interface CompanionJournal {
  /** Shares so far. */
  visits: number;
  /** Distinct days a dish was shared (3 befriend it). */
  visitDays: number[];
  befriended: boolean;
}

export interface MysteryJournal {
  /** Clues found, 0-5. */
  step: number;
  scaleFound: boolean;
  legendHeard: boolean;
  dumplingsCooked: boolean;
  finaleDone: boolean;
  /** Once the dumplings are cooked, the next dawn rolls rain. */
  guaranteedRainQueued: boolean;
}

/** One scrapbook page of the Trip Album. */
export interface DayPage {
  day: number;
  peakContentment: number;
  fishCaught: number;
  bestCatch?: { id: FishId; cm: number };
  dishesCooked: number;
  mostCooked?: DishId;
  moments: MomentId[];
  newRecipes: RecipeId[];
  newFish: FishId[];
}

export type BadgeId = 'happy_camper' | 'guardian_friend';

export interface Journal {
  fish: Partial<Record<FishId, FishJournalEntry>>;
  recipes: Partial<Record<RecipeId, CountJournalEntry>>;
  moments: Partial<Record<MomentId, CountJournalEntry>>;
  companion: CompanionJournal;
  mystery: MysteryJournal;
  trip: DayPage[];
  badges: BadgeId[];
}

/** Per-day counters; endDay() folds them into a DayPage and resets them. */
export interface TodayCounters {
  fishCaught: number;
  bestCatch: { id: FishId; cm: number } | null;
  dishesCooked: number;
  cookCounts: Partial<Record<DishId, number>>;
  moments: MomentId[];
  newRecipes: RecipeId[];
  newFish: FishId[];
}

export interface Flags {
  introSeen: boolean;
  /** "Sure you're ready?" was already asked this trip. */
  essentialsAskedOnce: boolean;
  /** Casts made while a better-rod fish was in season (hint at 3). */
  rodHintCasts: number;
  /** Day number of the first / most recent rainy night, or null. */
  firstRainyNight: number | null;
  lastRainyNight: number | null;
  mistySunriseSeen: boolean;
  /** Seconds sat by the fire tonight (firefly swirl needs 20). Mirrors contentment.fireSittingSeconds. */
  firefliesSitSeconds: number;
  /** Decor ids that have been placed at least once (first placement gives +5). */
  decorFirstPlaced: Partial<Record<DecorId, true>>;
}

export interface HeroState {
  /** World x in the Camp scene; 0 = let Camp place the hero at its start mark. */
  x: number;
  facing: Facing;
}

export interface Settings {
  /** Volumes 0..1. */
  music: number;
  sounds: number;
  ambience: number;
  reduceMotion: boolean;
  largeText: boolean;
}

export interface Meta {
  /** Epoch ms. */
  createdAt: number;
  updatedAt: number;
  playSeconds: number;
}

export interface GameState {
  version: number;
  /** RNG seed for weather and bites (saved so a trip replays the same). */
  seed: number;
  /** The seeded RNG's current state. */
  rngState: number;
  /** 1-based trip number (new trips keep the journal). */
  trip: number;
  /** 1-based day; 8+ is free play. */
  day: number;
  /** 0 (first light) .. 1 (full night). Night holds until sleep. */
  dayT: number;
  isNight: boolean;
  weather: WeatherState;
  money: number;
  contentment: ContentmentState;
  inventory: Inventory;
  activeBait: BaitId | null;
  activeRod: RodId | null;
  camp: CampState;
  journal: Journal;
  today: TodayCounters;
  flags: Flags;
  hero: HeroState;
  settings: Settings;
  meta: Meta;
}

export type DebugStateKind = 'fresh' | 'midtrip' | 'finale';
