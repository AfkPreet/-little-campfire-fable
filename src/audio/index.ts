/**
 * index.ts: the audio facade.
 *
 *   import { audio } from '@/audio';
 *   audio.unlockOnFirstGesture(window);          // once, at boot: unlocks on the first tap/key, then probes music files
 *   audio.sfx.play('pop');
 *   audio.music.setMood('day');
 *   audio.ambience.start(); audio.ambience.set({ dayT: 0.2, nearFire: 1 });
 *   audio.engine.setVolumes({ music: 0.5 });
 */
import { engine } from './engine';
import * as sfx from './sfx';
import * as ambience from './ambience';
import * as music from './music';
import * as fallback from './fallbackScore';

const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'keydown'] as const;
const attached = new WeakSet<EventTarget>();

/**
 * Attach once to `target`: the first pointerdown / touchend / keydown unlocks the engine, then music.init()
 * probes the optional files. The listeners stay until an unlock succeeds (a gesture may fail to open the gate).
 */
export function unlockOnFirstGesture(target: EventTarget): void {
  if (!target || typeof target.addEventListener !== 'function' || attached.has(target)) return;
  attached.add(target);
  if (!engine.available) return;
  const detach = () => {
    for (const name of UNLOCK_EVENTS) target.removeEventListener(name, handler);
  };
  const handler = () => {
    void engine
      .unlock()
      .then((ok) => {
        if (ok) detach();
        return music.init();
      })
      .catch(() => undefined);
  };
  for (const name of UNLOCK_EVENTS) target.addEventListener(name, handler, { passive: true });
}

export const audio = { engine, sfx, ambience, music, fallback, unlockOnFirstGesture };

export { engine };
export type { BusName, Volumes } from './engine';
export type { SfxName, SfxOptions } from './sfx';
export { SFX_NAMES } from './sfx';
export type { AmbienceInput, BedName, Targets } from './ambience';
export type { Mood, FileMood } from './music';
export type { FallbackMood, LeadTimbre } from './fallbackScore';
