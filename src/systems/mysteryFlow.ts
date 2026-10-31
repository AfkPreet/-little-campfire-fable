/**
 * mysteryFlow: the guardian mystery, clues 1-5 (spec section 5 "Mystery", docs/M3_PLAN.md). Clue texts live in
 * data/mystery.ts (MYSTERY_CLUES); the store's setMysteryStep() stamps the journal, queues the guaranteed rain at
 * step 4 and gifts the lantern at step 5.
 *  1. First night, hero outside: a faint glow breathes far out on the water for ~6 s -> step 1.
 *  2. The dawn after the first rainy night: a sparkle ("?") on the shore by the rock pool; tap -> the Glimmering Scale.
 *  3. Entering the shop with the scale: the legend (runShopLegend, called from the Shop scene) and a recipe card.
 *  4. The store says Moonlight Kadubu was discovered -> step 4 (the Cooking scene draws the glowing dish).
 *  5. canOfferDumplings() -> a jetty-end interactable "Leave an offering" -> finale.ts.
 * Debug: ?mystery=N sets the step once Camp settles; ?glow=1 plays clue 1 now; ?scale=1 spawns the sparkle.
 */
import Phaser from 'phaser';
import type { CampScene } from '@/scenes/Camp';
import { DEBUG } from '@/config/debug';
import { viewport } from '@/config/layout';
import { PALETTE } from '@/config/palette';
import { BAND_SCROLL, GROUND_Y, LAYOUT } from '@/world/layout';
import { getState, hasDish, setMysteryStep, subscribe, update } from '@/state';
import { MYSTERY_STEPS, STRINGS, canOfferDumplings, fill } from '@/data';
import { audio } from '@/audio';
import { sparkleBurst } from '@/fx/particles';
import { isReduceMotion, popIn, squash } from '@/fx/juice';
import { Button, UI, makeText, overlay, toast } from '@/ui';
import { MYSTERY_ART, makeGlowDisc, makeRecipeCard, makeScaleIcon, paintMysteryTextures } from '@/art/mystery';
import { runFinale, type FinaleStage } from './finale';

export const MYSTERY_FLOW = {
  /** clue 1: the far glow */
  glow: {
    delayMs: { min: 4000, max: 8000 },
    showMs: 6000,
    fadeMs: 1500,
    driftPx: 60,
    sizePx: 320,
    /** world y on the far water, and where across the view it appears */
    y: 468,
    viewFrac: 0.54,
    alpha: { min: 0.2, max: 0.5 },
    pulseMs: 3000,
  },
  /** clue 2: the shore sparkle and the scale card */
  sparkle: {
    id: 'mystery-scale',
    dx: -70,
    everyMs: 900,
    n: 4,
    glowPx: 110,
    glowAlpha: { min: 0.25, max: 0.55 },
    hit: { w: 64, h: 72 },
    radius: 56,
  },
  scaleCard: { w: 340, h: 330, iconY: -70, iconScale: 1.3, titleY: 22, bodyY: 56, bodySize: 16, titleSize: 30 },
  /** clue 3: the shop legend */
  legend: { delayMs: 900, zoneDepth: 900, hintSize: 16, hintPulseMs: 1200, cardW: 430, cardH: 400, cardY: -32, cardScale: 0.92 },
  /** clue 5: the offering spot at the jetty end */
  offering: { id: 'mystery-offering', x: LAYOUT.jetty.x1 - 30, hit: { w: 90, h: 90 }, radius: 36, pollMs: 500 },
  dish: MYSTERY_ART.dish,
} as const;

/** x inside a parallax band container (scroll factor f) that shows at world x `worldX` for the current camera. */
export function bandLocalX(camp: CampScene, f: number, worldX: number): number {
  return worldX - camp.worldCam.worldView.x * (1 - f);
}

/** Debug: set the mystery step outright (prerequisite flags follow), unlike setMysteryStep which never goes back. */
export function applyMysteryStep(step: number): void {
  const n = Phaser.Math.Clamp(Math.floor(step), 0, MYSTERY_STEPS);
  update((s) => {
    const m = s.journal.mystery;
    m.step = n;
    m.scaleFound = n >= 2;
    m.legendHeard = n >= 3;
    m.dumplingsCooked = n >= 4;
    m.finaleDone = n >= 5;
  }, 'journal');
}

let debugStepApplied = false;
/** Debug: apply ?mystery= once per page load (any scene), then return the current step. */
export function debugMysteryStep(): number {
  if (!debugStepApplied && DEBUG.enabled && DEBUG.mystery !== undefined && Number.isFinite(DEBUG.mystery)) applyMysteryStep(DEBUG.mystery);
  debugStepApplied = true;
  return getState().journal.mystery.step;
}

function journalToast(camp: CampScene): void {
  camp.toast(STRINGS.toasts.journalUpdated);
  audio.sfx.play('chime');
}

export class MysteryFlow {
  private unsub: (() => void) | null = null;
  private glowTimer: Phaser.Time.TimerEvent | null = null;
  private glowPlaying = false;
  private sparkle: { glow: Phaser.GameObjects.Image; timer: Phaser.Time.TimerEvent } | null = null;
  private offeringUp = false;
  private pollT = 0;
  /** ?finale= pending until the HUD runs (screenshots) */
  private debugFinale: '1' | FinaleStage | null = null;
  private debugGlow = false;
  private debugScale = false;

  constructor(private readonly camp: CampScene) {}

  create(): void {
    const camp = this.camp;
    paintMysteryTextures(camp);
    debugMysteryStep();
    camp.events.on('phase', this.onPhase, this);
    camp.events.on('dawn', this.onDawn, this);
    camp.events.on('update', this.onUpdate, this);
    camp.events.once('shutdown', this.destroy, this);
    this.unsub = subscribe(() => this.onStore());
    this.onStore();
    this.checkSparkle();
    if (DEBUG.enabled) {
      // debug visuals start on the first frame the HUD runs (the 'ready' delay runs on slow game time in headless shots)
      this.debugGlow = DEBUG.glow;
      this.debugScale = DEBUG.scale;
      if (DEBUG.scale) {
        const x = LAYOUT.rockPool.x + MYSTERY_FLOW.sparkle.dx - 160;
        camp.hero.setPosition(x, camp.groundAt(x));
        camp.worldCam.centerOn(x, camp.worldCam.midPoint.y);
      }
      if (DEBUG.finale) {
        // start beside the jetty so the walk does not eat the screenshot's settle time; ?finale=rise|moonbow jumps to that beat
        const x = MYSTERY_FLOW.offering.x - 70;
        camp.hero.setPosition(x, camp.groundAt(x));
        camp.worldCam.centerOn(x, camp.worldCam.midPoint.y);
        this.debugFinale = DEBUG.finale === 'rise' || DEBUG.finale === 'moonbow' ? DEBUG.finale : '1';
      }
    }
  }

  // ---------- clue 1: the far glow ----------
  private onPhase(phase: string): void {
    if (phase !== 'night') { this.cancelGlow(); return; }
    const s = getState();
    if (s.journal.mystery.step !== 0 || s.day < 1 || this.glowTimer || this.glowPlaying) return;
    const d = MYSTERY_FLOW.glow.delayMs;
    this.glowTimer = this.camp.time.delayedCall(Phaser.Math.Between(d.min, d.max), () => {
      this.glowTimer = null;
      if (this.heroOutside() && getState().journal.mystery.step === 0 && getState().isNight) void this.playGlow(false);
      else this.onPhase(getState().isNight ? 'night' : 'day'); // try again later tonight
    });
  }

  private heroOutside(): boolean {
    return !this.camp.clockPaused && this.camp.activity !== 'rest';
  }

  private cancelGlow(): void {
    this.glowTimer?.remove(false);
    this.glowTimer = null;
  }

  /** A soft glow disc breathes far out beyond the snags, drifts a little, fades, and the journal gains clue 1. */
  async playGlow(instant: boolean): Promise<void> {
    if (this.glowPlaying) return;
    this.glowPlaying = true;
    const camp = this.camp;
    const G = MYSTERY_FLOW.glow;
    const v = viewport();
    const rm = isReduceMotion();
    const x = bandLocalX(camp, BAND_SCROLL.estate, camp.worldCam.worldView.x + v.w * G.viewFrac);
    const glow = makeGlowDisc(camp, x, G.y, G.sizePx);
    glow.setAlpha(instant ? G.alpha.max : 0);
    camp.landscape.layers.farWater.add(glow);
    const showMs = rm ? G.showMs * 0.6 : G.showMs;
    const done = new Promise<void>((resolve) => {
      camp.tweens.add({ targets: glow, alpha: G.alpha.min, duration: instant ? 0 : G.fadeMs, ease: 'Sine.easeOut', onComplete: () => {
        if (!rm) camp.tweens.add({ targets: glow, alpha: G.alpha.max, duration: G.pulseMs / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        camp.time.delayedCall(showMs, () => {
          camp.tweens.killTweensOf(glow);
          camp.tweens.add({ targets: glow, alpha: 0, duration: G.fadeMs, ease: 'Sine.easeIn', onComplete: () => { glow.destroy(); resolve(); } });
        });
      } });
      if (!rm) camp.tweens.add({ targets: glow, x: x + G.driftPx, duration: showMs + G.fadeMs, ease: 'Sine.easeInOut' });
    });
    await done;
    this.glowPlaying = false;
    if (getState().journal.mystery.step === 0 || instant) {
      setMysteryStep(1);
      journalToast(camp);
      audio.sfx.play('sparkle');
      const sx = camp.worldCam.worldView.x + v.w * G.viewFrac + (rm ? 0 : G.driftPx);
      sparkleBurst(camp, sx, G.y, 10);
    }
  }

  // ---------- clue 2: the shore sparkle ----------
  private onDawn(): void {
    this.checkSparkle();
  }

  private sparkleDue(): boolean {
    const s = getState();
    const first = s.flags.firstRainyNight;
    return s.journal.mystery.step === 1 && first !== null && s.day > first && !s.isNight;
  }

  private checkSparkle(): void {
    if (this.sparkle) return;
    if (this.sparkleDue()) this.spawnSparkle();
  }

  /** A breathing glow and a sparkle loop by the rock pool, with a "?" interactable. */
  spawnSparkle(): void {
    if (this.sparkle) return;
    const camp = this.camp;
    const S = MYSTERY_FLOW.sparkle;
    const x = LAYOUT.rockPool.x + S.dx, y = GROUND_Y;
    const glow = makeGlowDisc(camp, x, y - 16, S.glowPx);
    glow.setAlpha(S.glowAlpha.min);
    camp.landscape.layers.clearingFront.add(glow);
    if (!isReduceMotion()) camp.tweens.add({ targets: glow, alpha: S.glowAlpha.max, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const timer = camp.time.addEvent({ delay: S.everyMs, loop: true, callback: () => sparkleBurst(camp, x + Phaser.Math.Between(-14, 14), y - 18 + Phaser.Math.Between(-10, 10), S.n) });
    sparkleBurst(camp, x, y - 18, S.n * 2);
    this.sparkle = { glow, timer };
    camp.registerInteractable({
      id: S.id, x, y, radius: S.radius, hit: S.hit,
      labelFor: () => STRINGS.mystery.sparkleLabel,
      actionsFor: () => [],
      onTap: () => void this.pickScale(),
    });
  }

  private clearSparkle(): void {
    if (!this.sparkle) return;
    this.sparkle.timer.remove(false);
    this.camp.tweens.killTweensOf(this.sparkle.glow);
    this.sparkle.glow.destroy();
    this.sparkle = null;
    this.camp.unregisterInteractable(MYSTERY_FLOW.sparkle.id);
  }

  /** The hero arrived: a pop, the Glimmering Scale card, clue 2. */
  private async pickScale(): Promise<void> {
    const camp = this.camp;
    const S = MYSTERY_FLOW.sparkle;
    const x = LAYOUT.rockPool.x + S.dx;
    camp.hero.setFacing(x >= camp.hero.x ? 1 : -1);
    camp.hero.setExpression('surprised');
    sparkleBurst(camp, x, GROUND_Y - 20, 16);
    audio.sfx.play('pop');
    this.clearSparkle();
    await this.showScaleCard();
    camp.hero.setExpression('happy');
    if (getState().journal.mystery.step < 2) {
      setMysteryStep(2);
      journalToast(camp);
    }
  }

  private showScaleCard(): Promise<void> {
    const camp = this.camp;
    const C = MYSTERY_FLOW.scaleCard;
    const ui = camp.uiScene();
    return new Promise((resolve) => {
      const h = overlay(ui, {
        w: C.w, h: C.h, what: 'catch',
        build: (card) => {
          const icon = makeScaleIcon(ui, 0, C.iconY);
          const b = (icon.getData('baseScale') as number) * C.iconScale;
          icon.setScale(b).setData('baseScale', b);
          card.content.add(icon);
          card.content.add(makeText(ui, 0, C.titleY, STRINGS.mystery.scaleTitle, { hand: true, size: C.titleSize, color: PALETTE.ink, align: 'center' }).setOrigin(0.5));
          card.content.add(makeText(ui, 0, C.bodyY, STRINGS.mystery.scaleBody, { size: C.bodySize, color: PALETTE.bark, align: 'center', wrap: C.w - UI.pad * 2 }).setOrigin(0.5, 0));
          const close = new Button(ui, 0, card.inner().bottom - UI.buttonH / 2 - 4, STRINGS.mystery.close, () => h.close(), { kind: 'primary', minWidth: 140 });
          card.content.add(close);
          ui.time.delayedCall(220, () => squash(ui, icon, 0.15));
        },
        onClose: () => resolve(),
      });
    });
  }

  // ---------- clue 4: the recipe discovered ----------
  private onStore(): void {
    const s = getState();
    if (s.journal.mystery.step === 3 && s.journal.recipes[MYSTERY_FLOW.dish]) {
      setMysteryStep(4);
      journalToast(this.camp);
    }
    if (s.journal.mystery.step !== 1 && this.sparkle && !DEBUG.scale) this.clearSparkle();
  }

  // ---------- clue 5: the offering spot ----------
  private onUpdate(_t: number, dt: number): void {
    if ((this.debugGlow || this.debugScale) && this.camp.hud()) {
      if (this.debugGlow) void this.playGlow(true);
      if (this.debugScale) this.spawnSparkle();
      this.debugGlow = this.debugScale = false;
    }
    if (this.debugFinale && this.camp.hud()) {
      const stage = this.debugFinale;
      this.debugFinale = null;
      void runFinale(this.camp, { skippable: true, stage: stage === '1' ? undefined : stage });
    }
    this.pollT += dt;
    if (this.pollT < MYSTERY_FLOW.offering.pollMs) return;
    this.pollT = 0;
    this.checkSparkle();
    const s = getState();
    const can = canOfferDumplings({
      cluesFound: s.journal.mystery.step,
      raining: s.weather.raining,
      night: s.isNight,
      contentment: s.contentment.value,
      hasDumplings: hasDish(MYSTERY_FLOW.dish),
    }) && !this.camp.clockPaused;
    if (can === this.offeringUp) return;
    this.offeringUp = can;
    const O = MYSTERY_FLOW.offering;
    if (!can) { this.camp.unregisterInteractable(O.id); return; }
    this.camp.registerInteractable({
      id: O.id, x: O.x, y: LAYOUT.jetty.deckY, radius: O.radius, hit: O.hit,
      labelFor: () => null,
      actionsFor: () => [{
        label: STRINGS.bubbles.leaveOffering,
        onPick: () => {
          this.camp.hideActions();
          void runFinale(this.camp, { skippable: getState().journal.badges.includes('guardian_friend') });
        },
      }],
    });
  }

  destroy(): void {
    this.unsub?.();
    this.unsub = null;
    this.cancelGlow();
    this.clearSparkle();
    const e = this.camp.events;
    e.off('phase', this.onPhase, this);
    e.off('dawn', this.onDawn, this);
    e.off('update', this.onUpdate, this);
  }
}

// ---------- clue 3: the legend, played by the Shop scene ----------

export type LegendDeps = {
  /** put a line in the shopkeeper's bubble */
  say(line: string): void;
  /** Doddamma's nod on the last line */
  nod(): Promise<void>;
  /** where the "Tap to continue" hint sits (screen px, below the bubble) */
  hintAt: { x: number; y: number };
};

/**
 * The three STRINGS.legend lines one at a time (tap anywhere to continue), a nod on the last, then the recipe card
 * pops with a Close button. Closing it sets step 3 (the steamer and the moon-lily spot unlock through the data).
 */
export async function runShopLegend(scene: Phaser.Scene, deps: LegendDeps): Promise<void> {
  const L = MYSTERY_FLOW.legend;
  const v = viewport();
  const zone = scene.add.zone(v.w / 2, v.h / 2, v.w * 4, v.h * 4).setInteractive().setDepth(L.zoneDepth);
  const hint = makeText(scene, deps.hintAt.x, deps.hintAt.y, STRINGS.mystery.tapToContinue, { size: L.hintSize, color: PALETTE.bark, align: 'center' }).setOrigin(0.5).setDepth(L.zoneDepth);
  scene.add.existing(hint);
  if (!isReduceMotion()) scene.tweens.add({ targets: hint, alpha: 0.45, duration: L.hintPulseMs / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const tap = (): Promise<void> => new Promise((resolve) => zone.once('pointerup', () => resolve()));
  const lines = STRINGS.legend;
  for (let i = 0; i < lines.length; i++) {
    deps.say(fill(lines[i]));
    audio.sfx.play('pop');
    if (i === lines.length - 1) { hint.setVisible(false); await deps.nod(); }
    else await tap();
  }
  zone.destroy();
  scene.tweens.killTweensOf(hint);
  hint.destroy();
  await new Promise<void>((resolve) => {
    const h = overlay(scene, {
      w: L.cardW, h: L.cardH, what: 'catch',
      build: (card) => {
        const rc = makeRecipeCard(scene, 0, L.cardY);
        rc.setScale(L.cardScale).setData('baseScale', L.cardScale).setAngle(-2);
        card.content.add(rc);
        const close = new Button(scene, 0, card.inner().bottom - UI.buttonH / 2 - 4, STRINGS.mystery.close, () => h.close(), { kind: 'primary', minWidth: 140 });
        card.content.add(close);
        scene.time.delayedCall(200, () => { popIn(scene, rc, 320); audio.sfx.play('pageFlip'); });
      },
      onClose: () => resolve(),
    });
  });
  if (getState().journal.mystery.step < 3) {
    setMysteryStep(3);
    audio.sfx.play('chime');
    toast(scene, STRINGS.toasts.journalUpdated);
  }
}

const flows = new WeakMap<CampScene, MysteryFlow>();
export function installMystery(camp: CampScene): MysteryFlow {
  const f = new MysteryFlow(camp);
  flows.set(camp, f);
  f.create();
  return f;
}
export function mysteryOf(camp: CampScene): MysteryFlow | undefined {
  return flows.get(camp);
}
