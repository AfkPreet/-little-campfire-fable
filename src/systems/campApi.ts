/**
 * campApi: debug hooks on window.__game.api (DEBUG.enabled builds) for the smoke test and screenshots. Later systems
 * (fishing, foraging, cooking) extend the same object: `camp.api.fish = ...`.
 */
import type { CampScene } from '@/scenes/Camp';
import { DEBUG } from '@/config/debug';
import { getState, pitchTent as storePitchTent, update, type GameState } from '@/state';
import { dayTFor, phaseAt } from '@/world/lighting';
import type { TentId, WeatherKind } from '@/data/types';
import { LAYOUT } from '@/world/layout';

export interface CampApi {
  walkTo(x: number): Promise<void>;
  /** Pitch the best owned tent on spot 0-2 at once (no peg taps). */
  pitchTent(spot: number): boolean;
  /** Night -> summary -> dawn. Resolves at dawn. */
  sleep(): Promise<void>;
  setTime(name: string): void;
  setWeather(kind: WeatherKind): void;
  state(): GameState;
  scene: CampScene;
  /** Extension point for later agents (fish(), forage(), cook(), eatLastDish(), buyEssentials()...). */
  [k: string]: unknown;
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
    sleep: () => camp.restFlow.sleep(),
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
  };
  if (DEBUG.enabled) window.__game.api = api;
  return api;
}
