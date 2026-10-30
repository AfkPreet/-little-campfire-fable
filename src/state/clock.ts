/**
 * clock.ts: time of day, weather rolls, stamp counting and badges (spec section 5 "Time and weather", "Journal").
 * tick() is called every frame by the Camp scene; it allocates nothing (the result object is reused).
 */
import { STRINGS } from '@/data/dialogue';
import { MYSTERY_STEPS } from '@/data/mystery';
import type { DayPhase, RandomSource, WeatherKind } from '@/data/types';
import { JOURNAL, WEATHER, rollMidDayWeatherChange, rollWeather } from '@/data/world';
import { DAY_LENGTH_MS, advanceDay, phaseAt } from '@/world/lighting';
import type { BadgeId, GameState } from './GameState';

export { DAY_LENGTH_MS };

export interface TickResult {
  /** Phase at the end of this tick. */
  phase: DayPhase;
  /** The phase changed during this tick. */
  phaseChanged: boolean;
  /** Night began during this tick. */
  enteredNight: boolean;
  /** A misty morning's mist burned off during this tick. */
  mistBurnedOff: boolean;
}
const RESULT: TickResult = { phase: 'dawn', phaseChanged: false, enteredNight: false, mistBurnedOff: false };

/** Phases from the one the mist burns off at, onwards. */
const PHASE_ORDER: readonly DayPhase[] = ['dawn', 'morning', 'afternoon', 'golden', 'dusk', 'night'];
export function phaseIndex(phase: DayPhase): number {
  return PHASE_ORDER.indexOf(phase);
}
export function phaseAtOrAfter(phase: DayPhase, from: DayPhase): boolean {
  return phaseIndex(phase) >= phaseIndex(from);
}

export function phaseOf(state: GameState): DayPhase {
  return phaseAt(state.dayT);
}
export function isNightAt(dayT: number): boolean {
  return phaseAt(dayT) === 'night';
}
/** "Dawn", "Morning", ... for the HUD. */
export function phaseLabel(phase: DayPhase): string {
  return STRINGS.hud.timeLabels[phase];
}
/** "Day 2 · Morning". */
export function dayLabel(state: GameState): string {
  return STRINGS.hud.dayLabel.replace('{n}', String(state.day)).replace('{Phase}', phaseLabel(phaseOf(state)));
}
/** "Day" in the fish and forage tables: morning through golden hour. */
export function isDaytime(phase: DayPhase): boolean {
  return phase === 'morning' || phase === 'afternoon' || phase === 'golden';
}

/**
 * Advance the clock. Time pauses in menus, the shop, the journal and cooking (`paused`) and holds at full night.
 * Also burns off mist from the afternoon, tracks rainy nights and counts play time. Returns a reused result object:
 * read it before the next tick, never keep it.
 */
export function tick(state: GameState, dtMs: number, paused = false): TickResult {
  const before = phaseAt(state.dayT);
  RESULT.phaseChanged = false;
  RESULT.enteredNight = false;
  RESULT.mistBurnedOff = false;
  if (!paused && dtMs > 0) {
    state.meta.playSeconds += dtMs / 1000;
    if (state.dayT < 1) state.dayT = advanceDay(state.dayT, dtMs);
  }
  const phase = phaseAt(state.dayT);
  RESULT.phase = phase;
  if (phase !== before) RESULT.phaseChanged = true;

  if (state.weather.kind === 'mist' && !state.weather.mistBurnedOff && phaseAtOrAfter(phase, WEATHER.mistBurnsOffBy)) {
    state.weather.mistBurnedOff = true;
    RESULT.mistBurnedOff = true;
  }

  const night = phase === 'night';
  if (night && !state.isNight) {
    state.isNight = true;
    RESULT.enteredNight = true;
    if (state.weather.raining) noteRainyNight(state);
  } else if (!night && state.isNight) {
    state.isNight = false;
  }
  return RESULT;
}

/** Record that tonight rained (first and most recent rainy night drive the mystery and the Night 4 guarantee). */
export function noteRainyNight(state: GameState): void {
  if (state.flags.firstRainyNight === null) state.flags.firstRainyNight = state.day;
  state.flags.lastRainyNight = state.day;
}

/** Is the morning mist still up (misty day, not yet burned off)? */
export function mistUp(state: GameState): boolean {
  return state.weather.kind === 'mist' && !state.weather.mistBurnedOff;
}

/**
 * Dawn weather roll: Clear 50 / Rain 30 / Mist 15 / Golden 5. Day 1 is clear; Night 4 rains if no rainy night yet;
 * cooked Moonlight Dumplings force the next night to rain. Writes state.weather and returns the kind.
 */
export function rollNewDayWeather(rng: RandomSource, state: GameState): WeatherKind {
  const kind = rollWeather(rng, {
    day: state.day,
    hadRainyNight: state.flags.firstRainyNight !== null,
    dumplingsAwaitingRain: state.journal.mystery.guaranteedRainQueued,
  });
  state.weather.kind = kind;
  state.weather.raining = kind === 'rain';
  state.weather.mistBurnedOff = false;
  state.weather.rainChangedToday = false;
  state.weather.middayRolled = false;
  if (kind === 'rain') state.journal.mystery.guaranteedRainQueued = false;
  return kind;
}

/**
 * The 10% mid-day change, rolled once per day in the afternoon: rain starts on a clear day or stops on a rainy one.
 * Returns true when the weather changed this call. Misty and golden days never change.
 */
export function maybeMiddayChange(rng: RandomSource, state: GameState): boolean {
  const w = state.weather;
  if (w.middayRolled || phaseOf(state) !== 'afternoon') return false;
  w.middayRolled = true;
  if (w.kind !== 'clear' && w.kind !== 'rain') return false;
  if (!rollMidDayWeatherChange(rng)) return false;
  w.raining = !w.raining;
  w.kind = w.raining ? 'rain' : 'clear';
  w.rainChangedToday = true;
  return true;
}

// ---------- journal stamps and badges ----------
/** Stamps earned: fish 8 + recipes 16 + moments 6 + friend 1 + mystery 5 = 36. */
export function stampCount(state: GameState): number {
  const j = state.journal;
  const fish = Object.keys(j.fish).length;
  const recipes = Object.keys(j.recipes).length;
  const moments = Object.keys(j.moments).length;
  const friend = j.companion.befriended ? 1 : 0;
  const mystery = Math.min(MYSTERY_STEPS, j.mystery.step);
  return fish + recipes + moments + friend + mystery;
}
export const STAMP_TOTAL = JOURNAL.totalStamps;

/** Award any badge now earned. Returns the newly awarded ids (for a banner); never removes badges. */
export function checkBadges(state: GameState): BadgeId[] {
  const earned: BadgeId[] = [];
  const have = state.journal.badges;
  if (stampCount(state) >= JOURNAL.badges.happyCamper.stampsNeeded && !have.includes('happy_camper')) earned.push('happy_camper');
  if (state.journal.mystery.finaleDone && !have.includes('guardian_friend')) earned.push('guardian_friend');
  for (const b of earned) have.push(b);
  return earned;
}
