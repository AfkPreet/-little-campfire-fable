/**
 * moments: the rare moments (spec section 5 "Rare moments", section 6 table).
 * Checks: 'dawn' (rainbow 50% after a rainy night; misty sunrise on a misty dawn, first time only) and 'night'
 * (shooting star 8% +15% telescope, always when blissful; moonbow always on a rainy blissful night). The firefly
 * swirl (25%) is rolled once a night after 20 s sitting by the fire on a clear night. The Golden Whisker is
 * stamped when the fishing flow adds the fish to the journal (store subscription). Blissful reached at night
 * queues that night's guaranteed moment. A moment never repeats within a day (state.today.moments).
 * Each moment: chime, handwritten banner, recordMoment (+8 Contentment, journal stamp) and its sky visual.
 */
import Phaser from 'phaser';
import type { CampScene } from '@/scenes/Camp';
import { getRng, getState, isBlissful, recordMoment, subscribe, tierOf, mistUp } from '@/state';
import { blissfulNightMoment, isMomentId, momentChance, rollMoments, STRINGS, fill, type MomentContext, type MomentId } from '@/data';
import { audio } from '@/audio';
import { fireflies, sparkleTrail, type FirefliesHandle } from '@/fx/particles';
import { isReduceMotion } from '@/fx/juice';
import { viewport } from '@/config/layout';
import { DEBUG } from '@/config/debug';
import { LAYOUT, BAND_Y } from '@/world/layout';
import { makeArc, makeStreak, makeSunGlow, paintMomentTextures, showMomentBanner } from '@/art/moments';
import { weatherOf } from './weatherFlow';

export const MOMENTS_FLOW = {
  /** the night sky settles this long before a shooting star crosses */
  nightDelayMs: { min: 2500, max: 7000 },
  /** the dawn fade finishes before the rainbow fades in */
  dawnDelayMs: 1200,
  /** the firefly swirl condition is polled this often while sitting */
  sitPollMs: 1000,
  star: { durationMs: 1200, y0: 70, y1: 220, xMargin: 0.1, fadeMs: 300, debugMs: 20000 },
  arc: { fadeInMs: 8000, holdMs: 14000, fadeOutMs: 6000, baseY: BAND_Y.ridgeBottom + 10, scale: 0.65 },
  mistySunrise: { ms: 6000, mistTo: 0.2, glowAlpha: 0.55, glowX: 0.72, glowY: 250, glowHoldMs: 5000 },
  swirl: { extraFlies: 24, orbitRadius: 90, orbitRiseY: 110, spinMs: 9000, fadeMs: 1500, boundsW: 60, boundsH: 40, updateEveryMs: 120 },
  telescopeId: 'telescope',
} as const;

export class MomentsFlow {
  private unsub: (() => void) | null = null;
  private swirlRolledNight = -1;
  private nightCheckedDay = -1;
  private sitT = 0;
  private lastGoldenCount = 0;
  private swirl: FirefliesHandle | null = null;
  /** debug: start visuals settled */
  private instant = false;
  /** ?moment= to play as soon as the HUD runs (screenshots) */
  private debugPending: MomentId | null = null;

  constructor(private readonly camp: CampScene) {}

  create(): void {
    const camp = this.camp;
    paintMomentTextures(camp);
    this.lastGoldenCount = getState().journal.fish.golden?.count ?? 0;
    camp.events.on('dawn', this.onDawn, this);
    camp.events.on('night', this.onNight, this);
    camp.events.on('update', this.onUpdate, this);
    camp.events.once('shutdown', this.destroy, this);
    this.unsub = subscribe(() => this.onStore());
    if (DEBUG.enabled && DEBUG.moment && isMomentId(DEBUG.moment)) this.debugPending = DEBUG.moment;
  }

  // ---------- context ----------
  private context(check: MomentContext['check']): MomentContext {
    const s = getState();
    return {
      check,
      weather: s.weather.kind,
      rainedLastNight: s.flags.lastRainyNight === s.day - 1,
      tier: tierOf(s),
      hasTelescope: s.camp.placedDecor.some((d) => d.id === MOMENTS_FLOW.telescopeId),
      fireSitSeconds: s.contentment.fireSittingSeconds,
      seen: Object.keys(s.journal.moments) as MomentId[],
      mist: mistUp(s),
    };
  }

  private playedToday(id: MomentId): boolean {
    return getState().today.moments.includes(id);
  }

  // ---------- checks ----------
  private onDawn(): void {
    const ctx = { ...this.context('dawn'), fireSitSeconds: 0 };
    const hits = rollMoments(getRng(), ctx).filter((id) => !this.playedToday(id));
    const id = hits[0];
    if (!id) return;
    this.camp.time.delayedCall(MOMENTS_FLOW.dawnDelayMs, () => void this.play(id));
  }

  private onNight(): void {
    const s = getState();
    this.nightCheckedDay = s.day;
    const ctx = { ...this.context('night'), fireSitSeconds: 0 }; // the swirl has its own sit check
    const hits = rollMoments(getRng(), ctx).filter((id) => id !== 'firefly_swirl' && !this.playedToday(id));
    const id = hits[0];
    if (!id) return;
    const d = MOMENTS_FLOW.nightDelayMs;
    this.camp.time.delayedCall(Phaser.Math.Between(d.min, d.max), () => void this.play(id));
  }

  /** Blissful reached during the night: that night's guaranteed moment, once. Also stamps the Golden Whisker. */
  private onStore(): void {
    const s = getState();
    const golden = s.journal.fish.golden?.count ?? 0;
    if (golden > this.lastGoldenCount) {
      this.lastGoldenCount = golden;
      if (!this.playedToday('golden_whisker')) void this.play('golden_whisker');
    }
    if (s.isNight && isBlissful(s)) {
      const id = blissfulNightMoment(s.weather.kind);
      if (!this.playedToday(id) && this.nightCheckedDay === s.day) {
        this.nightCheckedDay = -1; // one guaranteed queue per night
        void this.play(id);
      }
    }
  }

  /** Firefly swirl: polled while sitting by the fire at night; rolled once a night after 20 s. */
  private onUpdate(_t: number, dt: number): void {
    const camp = this.camp;
    if (this.debugPending && camp.hud()) {
      const id = this.debugPending;
      this.debugPending = null;
      void this.play(id, true);
    }
    if (camp.clockPaused || camp.activity !== 'fireSit') { this.sitT = 0; return; }
    this.sitT += dt;
    if (this.sitT < MOMENTS_FLOW.sitPollMs) return;
    this.sitT = 0;
    const s = getState();
    if (!s.isNight || this.swirlRolledNight === s.day || this.playedToday('firefly_swirl')) return;
    const ctx = this.context('night');
    const p = momentChance('firefly_swirl', ctx);
    if (p <= 0) return; // not clear, or not sat long enough yet
    this.swirlRolledNight = s.day;
    if (getRng().chance(p)) void this.play('firefly_swirl');
  }

  // ---------- playing ----------
  /** Play a moment now: chime, banner, stamp (+8) and its visual. `force` (debug ?moment=) skips the once-a-day
   *  guard and starts the visuals in their settled pose so a screenshot catches them. */
  async play(id: MomentId, force = false): Promise<void> {
    if (!force && this.playedToday(id)) return;
    this.instant = force;
    recordMoment(id);
    audio.sfx.play('chime');
    const ui = this.camp.uiScene();
    void showMomentBanner(ui, fill(STRINGS.moments[id]), force);
    switch (id) {
      case 'shooting_star': await this.shootingStar(); break;
      case 'rainbow': this.arc('rainbow'); break;
      case 'moonbow': this.arc('moonbow'); break;
      case 'misty_sunrise': this.mistySunrise(); break;
      case 'firefly_swirl': this.fireflySwirl(); break;
      case 'golden_whisker': default: break; // the catch card is the visual
    }
  }

  /** A glow streak with a sparkle tail crossing the sky over 1.2 s. */
  private shootingStar(): Promise<void> {
    const camp = this.camp;
    const S = MOMENTS_FLOW.star;
    const v = viewport();
    const rtl = Math.random() < 0.5;
    const x0 = rtl ? v.w * (1 - S.xMargin) : v.w * S.xMargin;
    const x1 = rtl ? v.w * S.xMargin : v.w * (1 - S.xMargin);
    const sky = camp.landscape.layers.sky;
    const k0 = this.instant ? 0.55 : 0; // debug: already half-way across
    const sx = x0 + (x1 - x0) * k0, sy = S.y0 + (S.y1 - S.y0) * k0;
    const streak = makeStreak(camp, sx, sy);
    streak.setFlipX(!rtl).setAlpha(this.instant ? 1 : 0);
    sky.add(streak);
    const ms = this.instant ? S.debugMs : Math.round(isReduceMotion() ? S.durationMs * 2 : S.durationMs);
    const wx = camp.worldCam.worldView.x;
    const trail = sparkleTrail(camp, { x: sx + wx, y: sy }, { x: x1 + wx, y: S.y1 }, ms);
    return new Promise((resolve) => {
      if (!this.instant) camp.tweens.add({ targets: streak, alpha: 1, duration: S.fadeMs, ease: 'Sine.easeOut' });
      camp.tweens.add({
        targets: streak, x: x1, y: S.y1, duration: ms, ease: 'Sine.easeIn',
        onComplete: () => {
          camp.tweens.add({ targets: streak, alpha: 0, duration: S.fadeMs, onComplete: () => { streak.destroy(); void trail.then(resolve); } });
        },
      });
    });
  }

  /** A soft 6-band arc over the far ridges fading in for 8 s, holding, then fading out. */
  private arc(kind: 'rainbow' | 'moonbow'): void {
    const camp = this.camp;
    const A = MOMENTS_FLOW.arc;
    const v = viewport();
    const im = makeArc(camp, kind, v.w / 2, A.baseY);
    im.setScale((im.getData('baseScale') as number) * A.scale);
    camp.landscape.layers.sky.add(im);
    const onViewport = (): void => { im.setX(viewport().w / 2); };
    camp.game.events.on('viewport', onViewport);
    const rm = isReduceMotion();
    const gone = (): void => { camp.game.events.off('viewport', onViewport); im.destroy(); };
    if (this.instant) im.setAlpha(1);
    camp.tweens.add({
      targets: im, alpha: 1, duration: this.instant ? 0 : rm ? 600 : A.fadeInMs, ease: 'Sine.easeInOut',
      onComplete: () => camp.time.delayedCall(A.holdMs, () => camp.tweens.add({ targets: im, alpha: 0, duration: A.fadeOutMs, ease: 'Sine.easeInOut', onComplete: gone })),
    });
  }

  /** The mist lifts (1 -> 0.2 over 6 s) while a butter glow swells where the sun rises. */
  private mistySunrise(): void {
    const camp = this.camp;
    const M = MOMENTS_FLOW.mistySunrise;
    const rm = isReduceMotion();
    weatherOf(camp)?.fadeMist(M.mistTo, rm || this.instant ? 0 : M.ms);
    const v = viewport();
    const glow = makeSunGlow(camp, v.w * M.glowX, M.glowY);
    camp.landscape.layers.sky.add(glow);
    if (this.instant) glow.setAlpha(M.glowAlpha);
    camp.tweens.add({
      targets: glow, alpha: M.glowAlpha, duration: this.instant ? 0 : rm ? 600 : M.ms, ease: 'Sine.easeInOut', hold: M.glowHoldMs, yoyo: true,
      onComplete: () => glow.destroy(),
    });
  }

  /** Extra fireflies orbit the fire in a slow golden spiral, then drift back and fade. */
  private fireflySwirl(): void {
    const camp = this.camp;
    const W = MOMENTS_FLOW.swirl;
    if (this.swirl) return;
    const cx = LAYOUT.fire.x, cy = LAYOUT.fire.y - W.orbitRiseY;
    const bounds = { x: cx - W.boundsW / 2, y: cy - W.boundsH / 2, w: W.boundsW, h: W.boundsH };
    const h = fireflies(camp, bounds, isReduceMotion() ? Math.round(W.extraFlies / 2) : W.extraFlies);
    this.swirl = h;
    camp.landscape.layers.light.add(h.container);
    h.setIntensity(0);
    const o = { a: 0, k: 0 };
    let acc = 0;
    const b = { ...bounds };
    const fadeIn = camp.tweens.add({ targets: o, k: 1, duration: W.fadeMs, onUpdate: () => h.setIntensity(o.k) });
    camp.tweens.add({
      targets: o, a: Math.PI * 4, duration: W.spinMs, ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        acc += camp.game.loop.delta;
        if (acc < W.updateEveryMs) return;
        acc = 0;
        const r = W.orbitRadius * Math.sin((tw.progress) * Math.PI); // out and back in
        b.x = cx + Math.cos(o.a) * r - W.boundsW / 2;
        b.y = cy + Math.sin(o.a) * r * 0.5 - W.boundsH / 2;
        h.setBounds(b);
      },
      onComplete: () => {
        fadeIn.stop();
        camp.tweens.add({ targets: o, k: 0, duration: W.fadeMs, onUpdate: () => h.setIntensity(o.k), onComplete: () => { h.destroy(); this.swirl = null; } });
      },
    });
  }

  destroy(): void {
    this.unsub?.();
    this.unsub = null;
    this.swirl?.destroy();
    this.swirl = null;
    const e = this.camp.events;
    e.off('dawn', this.onDawn, this);
    e.off('night', this.onNight, this);
    e.off('update', this.onUpdate, this);
  }
}

const flows = new WeakMap<CampScene, MomentsFlow>();
export function installMoments(camp: CampScene): MomentsFlow {
  const f = new MomentsFlow(camp);
  flows.set(camp, f);
  f.create();
  return f;
}
export function momentsOf(camp: CampScene): MomentsFlow | undefined {
  return flows.get(camp);
}
