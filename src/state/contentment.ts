/**
 * contentment.ts: the one meter (spec section 5 "Contentment"). Pure helpers that mutate the state they are given;
 * the store wraps them so every change marks the save dirty. Values never go down during a day and cap at 100.
 */
import { decorBaselineBonus } from '@/data/decor';
import { STRINGS } from '@/data/dialogue';
import { TENT_BY_ID } from '@/data/items';
import type { ContentmentTier } from '@/data/types';
import { CONTENTMENT, addContentment, contentmentBaseline, contentmentTier } from '@/data/world';
import type { GameState } from './GameState';

/** Dawn baseline: 10 + tent bonus + 2 per placed decor (Guardian Lantern +5), capped at 40. */
export function baselineFor(state: GameState): number {
  const tentBonus = state.camp.pitched && state.camp.tentId ? TENT_BY_ID[state.camp.tentId].tentBonus : CONTENTMENT.noTentBonus;
  return contentmentBaseline(tentBonus, state.camp.placedDecor.map((d) => d.id), decorBaselineBonus);
}

export function tierOf(state: GameState): ContentmentTier {
  return contentmentTier(state.contentment.value);
}

/** "Feeling cozy" / "Feeling content" / "Glowing" / "Blissful". */
export function tierLabel(tier: ContentmentTier): string {
  return STRINGS.hud.contentment[tier];
}

/** Add a gain (never negative, never above 100). Returns the amount actually added. */
export function gain(state: GameState, amount: number): number {
  const c = state.contentment;
  const before = c.value;
  c.value = addContentment(c.value, amount);
  if (c.value > c.peakToday) c.peakToday = c.value;
  return c.value - before;
}

/** Did the tier change between two values (for the hero's expression and a soft chime)? */
export function tierChanged(before: number, after: number): boolean {
  return contentmentTier(before) !== contentmentTier(after);
}

/** Ticks already paid out for `seconds` of an activity, capped. */
function ticksPaid(seconds: number, tickS: number, maxTicks: number): number {
  return Math.min(maxTicks, Math.floor(seconds / tickS));
}

/** Sitting by the fire at night: +1 per 10 s, max +10 a night. Returns the contentment added this call. */
export function fireSitting(state: GameState, dtSeconds: number): number {
  const g = CONTENTMENT.gains;
  const c = state.contentment;
  const before = ticksPaid(c.fireSittingSeconds, g.fireSitTickS, g.fireSitMaxPerNight);
  c.fireSittingSeconds += Math.max(0, dtSeconds);
  state.flags.firefliesSitSeconds = c.fireSittingSeconds;
  const after = ticksPaid(c.fireSittingSeconds, g.fireSitTickS, g.fireSitMaxPerNight);
  return after > before ? gain(state, (after - before) * g.fireSitPerTick) : 0;
}

/** Resting in the tent doorway while it rains: +1 per 10 s, max +10 a day. Returns the contentment added. */
export function rainRest(state: GameState, dtSeconds: number): number {
  if (!state.weather.raining) return 0;
  const g = CONTENTMENT.gains;
  const c = state.contentment;
  const before = ticksPaid(c.rainRestSeconds, g.rainRestTickS, g.rainRestMaxPerDay);
  c.rainRestSeconds += Math.max(0, dtSeconds);
  const after = ticksPaid(c.rainRestSeconds, g.rainRestTickS, g.rainRestMaxPerDay);
  return after > before ? gain(state, (after - before) * g.rainRestPerTick) : 0;
}

/** Start a new day at the baseline and clear the per-day activity counters. */
export function resetForDawn(state: GameState): void {
  const baseline = baselineFor(state);
  const c = state.contentment;
  c.baseline = baseline;
  c.value = baseline;
  c.peakToday = baseline;
  c.fireSittingSeconds = 0;
  c.rainRestSeconds = 0;
  state.flags.firefliesSitSeconds = 0;
}

/** Companion needs 40+, the finale 70+, blissful is 100. */
export function companionMayAppear(state: GameState): boolean {
  return state.contentment.value >= CONTENTMENT.companionAppearsAt;
}
export function finaleReady(state: GameState): boolean {
  return state.contentment.value >= CONTENTMENT.finaleNeeds;
}
export function isBlissful(state: GameState): boolean {
  return state.contentment.value >= CONTENTMENT.blissfulAt;
}
