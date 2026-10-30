/**
 * demo.ts: audioDemo() plays every sfx 0.6 s apart, then starts the fallback score and the day ambience.
 * Not wired anywhere: call it from the console or a debug hook to audition the whole palette.
 *
 *   import { audioDemo } from '@/audio/demo'; void audioDemo();
 *
 * If the engine is not yet unlocked it waits for the first gesture on `target` (default: window).
 */
import { engine } from './engine';
import { SFX_NAMES, play } from './sfx';
import * as ambience from './ambience';
import * as fallback from './fallbackScore';
import { unlockOnFirstGesture } from './index';

export const DEMO_GAP_MS = 600;

function waitForUnlock(): Promise<void> {
  return new Promise((resolve) => {
    let off: (() => void) | null = null;
    let fired = false;
    off = engine.onUnlock(() => {
      fired = true;
      off?.();
      resolve();
    });
    if (fired) off();
  });
}

/** Resolves once the fallback score and ambience have started (after the sfx tour). */
export async function audioDemo(target: EventTarget | null = typeof window !== 'undefined' ? window : null): Promise<void> {
  if (!engine.available) return;
  const ok = await engine.unlock();
  if (!ok) {
    if (target) unlockOnFirstGesture(target);
    await waitForUnlock();
  }
  await new Promise<void>((resolve) => {
    SFX_NAMES.forEach((name, i) => {
      setTimeout(() => play(name), i * DEMO_GAP_MS);
    });
    setTimeout(() => {
      fallback.start('day');
      ambience.start();
      ambience.set({ dayT: 0.3, rain: 0, nearWater: 0.4, nearFire: 0.6, inTent: 0, wind: 0.25 });
      resolve();
    }, SFX_NAMES.length * DEMO_GAP_MS + 400);
  });
}
