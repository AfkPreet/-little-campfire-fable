/**
 * finale: the mystery's last clue (spec section 5 "Mystery" step 5, docs/M3_PLAN.md). About 45 s:
 * the hero walks to the jetty end and leaves the kadubu; the rain softens; the far glow grows; Bangari rises in
 * the shallows (the jetty posts draw in front of her belly), nuzzles the jetty and eats with a happy rumble; the
 * clouds part to stars and a moonbow; fireflies swirl; she sinks. Gift: the Guardian Lantern (setMysteryStep(5)
 * adds it to the backpack and earns the Guardian Friend badge). Skippable on replays (badge already held).
 * Reduce motion: the Guardian shortens her own rises; there are no camera nudges.
 */
import Phaser from 'phaser';
import type { CampScene } from '@/scenes/Camp';
import { viewport } from '@/config/layout';
import { BAND_SCROLL, LAYOUT, SCENERY, WORLD_WIDTH } from '@/world/layout';
import { getState, recordMoment, removeDish, setMysteryStep, update } from '@/state';
import { DECOR_BY_ID, GUARDIAN_GIFT, MYSTERY_CLUES, STRINGS, fill, mysteryClue } from '@/data';
import { audio } from '@/audio';
import { fireflies, sparkleBurst, type FirefliesHandle } from '@/fx/particles';
import { isReduceMotion, squash } from '@/fx/juice';
import { Button, UI } from '@/ui';
import { Guardian } from '@/entities/Guardian';
import { makeArc, showMomentBanner } from '@/art/moments';
import { MYSTERY_ART, makeOfferingPlate } from '@/art/mystery';
import { MOMENTS_FLOW } from './moments';
import { bandLocalX } from './mysteryFlow';

export const FINALE = {
  pauseReason: 'finale',
  /** the hero stands here, facing the water; the plate goes at the deck's end */
  heroX: LAYOUT.jetty.x1 - 34,
  plate: { x: LAYOUT.jetty.x1 - 6, y: LAYOUT.jetty.deckY - 2 },
  guardian: {
    /** her centre sits this far beyond the jetty end (world x); she faces the jetty */
    dx: 320,
    waterY: SCENERY.snagBaseY,
    /** her rig sits this much above the water line so the mouth and eye clear the water (the belly is masked at the line) */
    lift: 48,
    scale: 0.64,
    glowMs: 2500,
    riseMs: 8000,
    sinkMs: 6000,
  },
  rain: { softTo: 0.25, softenMs: 6000, clearMs: 3000 },
  beats: { placeMs: 1000, afterRiseMs: 1200, afterNuzzleMs: 400, afterEatMs: 1600, afterMoonbowMs: 2500, afterSinkMs: 600 },
  moonbow: { fadeInMs: 8000, holdMs: 12000, fadeOutMs: 6000 },
  swirl: { extra: 24, w: 320, h: 90, cx: LAYOUT.jetty.x1 + 70, cy: LAYOUT.jetty.deckY - 110, orbitRadius: 80, spinMs: 9000, fadeMs: 1500, updateEveryMs: 120 },
  skip: { margin: 16, depth: 2000 },
  dish: MYSTERY_ART.dish,
} as const;

/** stage (debug screenshots): jump straight to that settled beat, then continue at normal pace. */
export type FinaleStage = 'rise' | 'moonbow';
export type FinaleOptions = { skippable: boolean; stage?: FinaleStage };

const running = new WeakSet<CampScene>();

/** HUD chrome (buttons, money, lantern) hides during the finale; toasts and bubbles stay. */
function setHudChrome(camp: CampScene, visible: boolean): void {
  const hud = camp.hud() as (Phaser.Scene & { root?: Phaser.GameObjects.Container }) | null;
  hud?.root?.setVisible(visible);
}

export async function runFinale(camp: CampScene, opts: FinaleOptions): Promise<void> {
  if (running.has(camp)) return;
  running.add(camp);
  const F = FINALE;
  const rm = isReduceMotion();
  const stage = opts.stage;
  const instant = stage !== undefined;
  let skipped = false;
  const waiters: Array<() => void> = [];
  let skipResolve: () => void = () => {};
  const skipPromise = new Promise<void>((r) => { skipResolve = r; });
  const wait = (ms: number): Promise<void> => new Promise((resolve) => {
    if (skipped || instant) { resolve(); return; }
    const t = camp.time.delayedCall(ms, resolve);
    waiters.push(() => { t.remove(false); resolve(); });
  });
  const race = <T,>(p: Promise<T>): Promise<T | void> => Promise.race([p, skipPromise]);
  const skip = (): void => {
    if (skipped) return;
    skipped = true;
    for (const w of waiters) w();
    waiters.length = 0;
    skipResolve();
  };

  camp.hideActions();
  camp.standUp();
  camp.hooks.onInterrupt?.();
  camp.pauseClock(F.pauseReason);
  setHudChrome(camp, false);

  // skip button (replays only): fixed to the view, top-right
  let skipBtn: Button | null = null;
  const placeSkip = (): void => {
    const v = viewport();
    skipBtn?.setPosition(v.w - v.safe.right - F.skip.margin - skipBtn.width / 2, v.safe.top + F.skip.margin + UI.buttonH / 2);
  };
  if (opts.skippable) {
    skipBtn = new Button(camp, 0, 0, STRINGS.mystery.skip, skip, { kind: 'secondary', minWidth: 100 });
    skipBtn.setScrollFactor(0).setDepth(F.skip.depth);
    placeSkip();
    camp.game.events.on('viewport', placeSkip);
  }

  // 1. walk to the jetty end, place the dish
  if (instant) camp.hero.setPosition(F.heroX, camp.groundAt(F.heroX));
  else await race(camp.walkHeroTo(F.heroX));
  camp.hero.setFacing(1);
  camp.hero.hold('dish');
  await wait(F.beats.placeMs * 0.6);
  const plate = makeOfferingPlate(camp, F.plate.x, F.plate.y);
  camp.landscape.layers.clearingFront.add(plate);
  camp.hero.hold('none');
  removeDish(F.dish);
  audio.sfx.play('tok');
  squash(camp, plate);
  camp.hero.setExpression('happy');
  await wait(F.beats.placeMs);

  // 2. the rain softens
  const clock = camp.clock;
  const rainK = { k: getState().weather.raining ? 1 : 0 };
  const pushRain = (): void => { clock.rainOverride = rainK.k; clock.applyWeatherNow(); };
  const rainTween = (to: number, ms: number): Promise<void> => new Promise((resolve) => {
    camp.tweens.add({ targets: rainK, k: to, duration: skipped || rm || instant ? 0 : ms, ease: 'Sine.easeInOut', onUpdate: pushRain, onComplete: () => { pushRain(); resolve(); } });
  });
  const soften = rainTween(F.rain.softTo, F.rain.softenMs);

  // 3. the far glow grows and Bangari rises in the shallows (posts in front of her belly)
  const G = F.guardian;
  const gx = bandLocalX(camp, BAND_SCROLL.shallows, LAYOUT.jetty.x1 + G.dx);
  const guardian = new Guardian(camp, gx, G.waterY - G.lift, { onRumble: () => audio.sfx.play('rumble') });
  guardian.setScale(G.scale).setData('baseScale', G.scale);
  guardian.setFacing(-1);
  const maskShape = camp.make.graphics({ x: 0, y: 0 }, false);
  maskShape.fillRect(-WORLD_WIDTH, -LAYOUT.groundY, WORLD_WIDTH * 3, LAYOUT.groundY + G.waterY);
  guardian.setMask(maskShape.createGeometryMask());
  camp.landscape.layers.shallows.add(guardian);
  if (!instant) {
    guardian.glowFarOut(true);
    await wait(G.glowMs);
  }
  await race(Promise.all([guardian.rise(instant ? 1 : skipped ? 400 : G.riseMs), soften]));
  camp.hero.setExpression('surprised');
  await wait(F.beats.afterRiseMs);

  // 4. a slow blink happens on her own idle; she nuzzles the jetty and eats
  const jettyLocalX = bandLocalX(camp, BAND_SCROLL.shallows, LAYOUT.jetty.x1);
  await race(guardian.nuzzle(jettyLocalX));
  await wait(F.beats.afterNuzzleMs);
  if (!skipped && stage !== 'moonbow') {
    camp.tweens.add({ targets: plate, alpha: 0, duration: 500, ease: 'Sine.easeIn' });
    await race(guardian.eat());
  }
  camp.hero.setExpression('blissful');
  await wait(F.beats.afterEatMs);

  // 5. the clouds part: stars, a moonbow, fireflies swirl
  await rainTween(0, F.rain.clearMs);
  update((s) => {
    s.weather.raining = false;
    s.weather.kind = 'clear';
  }, 'weather');
  clock.rainOverride = null;
  clock.applyWeatherNow();
  recordMoment('moonbow');
  audio.sfx.play('chime');
  const snap = skipped || stage === 'moonbow';
  void showMomentBanner(camp.uiScene(), fill(STRINGS.moments.moonbow), snap);
  const arcGone = moonbow(camp, snap);
  const swirl = fireflySwirl(camp, snap);
  await (stage === 'moonbow' ? new Promise<void>((r) => camp.time.delayedCall(F.moonbow.holdMs, r)) : wait(F.beats.afterMoonbowMs + (skipped ? 0 : F.moonbow.fadeInMs)));

  // 6. she sinks; the gift
  await race(guardian.sink(skipped ? 400 : G.sinkMs));
  await wait(F.beats.afterSinkMs);
  const first = getState().journal.mystery.step < 5;
  if (first) {
    setMysteryStep(5);
    audio.sfx.play('sparkle');
    sparkleBurst(camp, camp.hero.x, camp.hero.y - 40, 18);
    camp.toast(fill(STRINGS.mystery.gift, { Gift: DECOR_BY_ID[GUARDIAN_GIFT].name }));
    camp.toast(STRINGS.toasts.journalUpdated);
    const clue = mysteryClue(MYSTERY_CLUES.length);
    if (clue) camp.toast(clue.journal);
  }

  // cleanup
  guardian.destroy();
  maskShape.destroy();
  if (plate.active) camp.tweens.add({ targets: plate, y: plate.y - 20, alpha: 0, duration: rm ? 0 : 600, ease: 'Sine.easeIn', onComplete: () => plate.destroy() });
  if (skipBtn) {
    camp.game.events.off('viewport', placeSkip);
    skipBtn.destroy();
  }
  swirl.then(() => undefined, () => undefined);
  void arcGone;
  setHudChrome(camp, true);
  camp.resumeClock(F.pauseReason);
  camp.events.emit('finale:done', { skipped, first });
  running.delete(camp);
}

/** The moonbow arc over the far ridges: fades in, holds, fades out. Resolves when gone. */
function moonbow(camp: CampScene, instant: boolean): Promise<void> {
  const M = FINALE.moonbow;
  const A = MOMENTS_FLOW.arc;
  const v = viewport();
  const im = makeArc(camp, 'moonbow', v.w / 2, A.baseY);
  im.setScale((im.getData('baseScale') as number) * A.scale);
  camp.landscape.layers.sky.add(im);
  const onViewport = (): void => { im.setX(viewport().w / 2); };
  camp.game.events.on('viewport', onViewport);
  const rm = isReduceMotion();
  return new Promise((resolve) => {
    const gone = (): void => { camp.game.events.off('viewport', onViewport); im.destroy(); resolve(); };
    camp.tweens.add({
      targets: im, alpha: 1, duration: instant ? 0 : rm ? 600 : M.fadeInMs, ease: 'Sine.easeInOut',
      onComplete: () => camp.time.delayedCall(M.holdMs, () => camp.tweens.add({ targets: im, alpha: 0, duration: M.fadeOutMs, ease: 'Sine.easeInOut', onComplete: gone })),
    });
  });
}

/** Extra fireflies circle the jetty end in a slow spiral, then fade. Resolves when gone. */
function fireflySwirl(camp: CampScene, instant: boolean): Promise<void> {
  const W = FINALE.swirl;
  const bounds = { x: W.cx - W.w / 2, y: W.cy - W.h / 2, w: W.w, h: W.h };
  const h: FirefliesHandle = fireflies(camp, bounds, isReduceMotion() ? Math.round(W.extra / 2) : W.extra);
  camp.landscape.layers.light.add(h.container);
  h.setIntensity(instant ? 1 : 0);
  const o = { a: 0, k: instant ? 1 : 0 };
  let acc = 0;
  const b = { ...bounds };
  return new Promise((resolve) => {
    const fadeIn = camp.tweens.add({ targets: o, k: 1, duration: instant ? 0 : W.fadeMs, onUpdate: () => h.setIntensity(o.k) });
    camp.tweens.add({
      targets: o, a: Math.PI * 4, duration: W.spinMs, ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        acc += camp.game.loop.delta;
        if (acc < W.updateEveryMs) return;
        acc = 0;
        const r = W.orbitRadius * Math.sin(tw.progress * Math.PI);
        b.x = W.cx + Math.cos(o.a) * r - W.w / 2;
        b.y = W.cy + Math.sin(o.a) * r * 0.5 - W.h / 2;
        h.setBounds(b);
      },
      onComplete: () => {
        fadeIn.stop();
        camp.tweens.add({ targets: o, k: 0, duration: W.fadeMs, onUpdate: () => h.setIntensity(o.k), onComplete: () => { h.destroy(); resolve(); } });
      },
    });
  });
}
