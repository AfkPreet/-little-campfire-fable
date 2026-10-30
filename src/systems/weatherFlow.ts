/**
 * weatherFlow: applies the rolled weather to the world (spec section 5 "Time and weather").
 * - at create and each 'dawn': push state.weather to the landscape and ambience (via the clock runner)
 * - afternoon: the 10% once-a-day mid-day change (rain starts / lets up) with a toast
 * - misty mornings: the mist cross-fades out over ~20 s once it burns off (clock.tick flags it)
 * - emits camp events 'rain:start' / 'rain:stop' whenever the rain state flips (also at create and dawn)
 * Rainy nights are noted by state/clock.tick (entering night) and endDay(); the dawn roll with its guarantees
 * (Day 1 clear, Night 4, mystery rain) is rollNewDayWeather, called from endDay().
 */
import Phaser from 'phaser';
import type { CampScene } from '@/scenes/Camp';
import { getRng, getState, maybeMiddayChange, mistUp, phaseOf, update } from '@/state';
import { STRINGS } from '@/data/dialogue';
import type { DayPhase } from '@/world/lighting';
import { isReduceMotion } from '@/fx/juice';

export const WEATHER_FLOW = {
  /** the burned-off mist fades out over this long */
  mistFadeMs: 20000,
  /** the mid-day roll happens this long into the afternoon phase (lets the phase settle) */
  middayRollDelayMs: 1500,
} as const;

export class WeatherFlow {
  private lastRaining: boolean | null = null;
  private mistTween: Phaser.Tweens.Tween | null = null;

  constructor(private readonly camp: CampScene) {}

  create(): void {
    const camp = this.camp;
    camp.events.on('dawn', this.onDawn, this);
    camp.events.on('phase', this.onPhase, this);
    camp.events.on('weather', this.onWeather, this);
    camp.events.once('shutdown', this.destroy, this);
    this.apply();
    this.onPhase(phaseOf(getState()));
  }

  /** Push state.weather to the landscape and ambience, and emit rain events when the rain state flipped. */
  apply(): void {
    this.camp.clock.applyWeatherNow();
    this.emitRainChange();
  }

  private emitRainChange(): void {
    const raining = getState().weather.raining;
    if (raining === this.lastRaining) return;
    this.lastRaining = raining;
    this.camp.events.emit(raining ? 'rain:start' : 'rain:stop');
  }

  private onDawn(): void {
    this.stopMistFade();
    this.camp.clock.mistOverride = null;
    this.apply();
  }

  private onPhase(phase: DayPhase): void {
    if (phase !== 'afternoon') return;
    this.camp.time.delayedCall(WEATHER_FLOW.middayRollDelayMs, () => this.rollMidday());
  }

  /** The 10% once-per-day change (maybeMiddayChange guards the "once" and the phase). */
  private rollMidday(): void {
    const s = getState();
    if (s.weather.middayRolled) return;
    const changed = maybeMiddayChange(getRng(), s);
    update(() => { /* weather mutated in place */ }, 'weather');
    if (!changed) return;
    this.camp.toast(s.weather.raining ? STRINGS.weatherFlow.rainStarting : STRINGS.weatherFlow.rainLettingUp);
    // the clock runner notices the state change next frame and relights; rain events follow from 'weather'
  }

  private onWeather(): void {
    this.emitRainChange();
    const s = getState();
    const clock = this.camp.clock;
    if (s.weather.kind === 'mist' && s.weather.mistBurnedOff && clock.mistOverride !== null && !this.mistTween) {
      this.fadeMist(0, isReduceMotion() ? 0 : WEATHER_FLOW.mistFadeMs, () => { clock.mistOverride = null; });
    }
  }

  /** Cross-fade the landscape mist from its current level to `to` (the moments system uses this too). */
  fadeMist(to: number, ms: number, onDone?: () => void): void {
    const clock = this.camp.clock;
    this.stopMistFade();
    const from = clock.mistOverride ?? (mistUp(getState()) ? 1 : 0);
    clock.mistOverride = from;
    if (ms <= 0) {
      clock.mistOverride = to;
      clock.applyWeatherNow();
      onDone?.();
      return;
    }
    const v = { k: from };
    this.mistTween = this.camp.tweens.add({
      targets: v, k: to, duration: ms, ease: 'Sine.easeInOut',
      onUpdate: () => { clock.mistOverride = v.k; clock.applyWeatherNow(); },
      onComplete: () => { this.mistTween = null; clock.mistOverride = to; clock.applyWeatherNow(); onDone?.(); },
    });
  }

  private stopMistFade(): void {
    this.mistTween?.stop();
    this.mistTween = null;
  }

  destroy(): void {
    this.stopMistFade();
    const e = this.camp.events;
    e.off('dawn', this.onDawn, this);
    e.off('phase', this.onPhase, this);
    e.off('weather', this.onWeather, this);
  }
}

const flows = new WeakMap<CampScene, WeatherFlow>();
export function installWeather(camp: CampScene): WeatherFlow {
  const f = new WeatherFlow(camp);
  flows.set(camp, f);
  f.create();
  return f;
}
export function weatherOf(camp: CampScene): WeatherFlow | undefined {
  return flows.get(camp);
}
