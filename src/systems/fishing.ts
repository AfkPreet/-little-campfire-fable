/**
 * fishing: tap the water -> walk to the nearest cast point (jetty end or shore edge) -> rod in hand -> CAST (bobber
 * arcs out on a line) -> WAIT (seeded 3-10 s, 0-2 fake nibbles) -> BITE (dip, "!", ring, tap within the window) ->
 * HIT (reel 1.2 s, CatchCard: Keep / Let go) or MISS ("It slipped away..."). Tapping the ground cancels the cast.
 * The clock keeps running. Bait pill near the hero cycles None / Wiggly / Sparkle when bait is owned.
 *
 * Installed by Camp.create(): `installFishing(this)`; the debug API reaches it through `fishingOf(camp)`.
 */
import Phaser from 'phaser';
import type { CampScene } from '@/scenes/Camp';
import { RIG } from '@/art/hero';
import { ROD_TIP, arcPoint, drawLine, makeBobber, makeRing, makeRod } from '@/art/fishing';
import { FISH_KEYS, paintFish } from '@/art/fish';
import {
  FISHING, FISH_BY_ID, RARITY_STARS, STRINGS, biteWaitMs, biteWindowMs, fakeNibbleCount, fill,
  fishNeedingBetterRod, rollBite, rollFishSize,
} from '@/data';
import type { BaitId, FishId, RodId } from '@/data/types';
import {
  addFish, discoverFish, getRng, getState, markDirty, mistUp, phaseOf, releaseFish, setActiveBait, setFlag, useBait,
} from '@/state';
import { LAYOUT } from '@/world/layout';
import { PALETTE } from '@/config/palette';
import { audio } from '@/audio';
import { isReduceMotion, popIn, squash } from '@/fx/juice';
import { heartsFloat, sparkleBurst } from '@/fx/particles';
import { makeText, ninePill, showCatch } from '@/ui';
import { img } from '@/art/pipeline';
import type { Interactable } from '@/world/Interactable';

export const FISHING_FLOW = {
  /** cast points: just short of the shore edge and the jetty end */
  shoreCastX: LAYOUT.shore.x - 36,
  jettyCastX: LAYOUT.jetty.x1 - 30,
  /** the bobber lands at least this far out and at most this far from the hero */
  minReach: 70,
  maxReach: 420,
  /** landing y clamp inside the fishing zone (near water only) */
  landY: { min: LAYOUT.fishingZone.y0 + 100, max: LAYOUT.fishingZone.y1 + 8 },
  castMs: 650,
  castLift: 90,
  lineSag: 10,
  nibbleDip: 4,
  biteDip: 11,
  sinkMs: 500,
  bangSize: 44,
  bangHoldMs: 700,
  ringMs: 520,
  /** bait pill above the hero's head */
  pill: { w: 168, h: 44, dy: -138, textSize: 17 },
  pillId: 'bait-pill',
  rodOrder: ['rod_moonlight', 'rod_willow', 'rod_bamboo'] as readonly RodId[],
  baitOrder: [null, 'bait_wiggly', 'bait_sparkle'] as readonly (BaitId | null)[],
  releaseSwimPx: 220,
  releaseMs: 1100,
  /** scripts: cap the wait so smoke runs stay quick */
  autoWaitMs: 700,
  /** debug ?bite=1: the held "!" lives this many bangHoldMs */
  debugHoldFactor: 50,
} as const;

type Phase = 'idle' | 'walking' | 'casting' | 'waiting' | 'bite' | 'reeling' | 'card';
/** `hold` (debug shots): stay in BITE with the "!" up; no hook timer, no miss. */
export type CastOpts = { force?: FishId; auto?: boolean; hold?: boolean };

const flows = new WeakMap<Phaser.Scene, FishingFlow>();
export function fishingOf(camp: CampScene): FishingFlow | undefined { return flows.get(camp); }

export function installFishing(camp: CampScene): FishingFlow {
  const flow = new FishingFlow(camp);
  flows.set(camp, flow);
  camp.hooks.onWaterTap = (x, y) => void flow.onWaterTap(x, y);
  const prevInterrupt = camp.hooks.onInterrupt;
  camp.hooks.onInterrupt = () => { prevInterrupt?.(); flow.onInterrupt(); };
  camp.events.once('shutdown', () => { flow.destroy(); flows.delete(camp); });
  return flow;
}

export class FishingFlow {
  phase: Phase = 'idle';
  private rodImg: Phaser.GameObjects.Image | null = null;
  private bobber: Phaser.GameObjects.Image | null = null;
  private line: Phaser.GameObjects.Graphics | null = null;
  private pill: Phaser.GameObjects.Container | null = null;
  private pillText: Phaser.GameObjects.Text | null = null;
  private timers: Phaser.Time.TimerEvent[] = [];
  private tweens: Phaser.Tweens.Tween[] = [];
  private hookHandler: (() => void) | null = null;
  private ignoreInterruptOnce = false;
  private rodHintDay = 0;
  private castSeq = 0;
  private done: (() => void) | null = null;
  private readonly tip = new Phaser.Math.Vector2();
  private readonly tmp = new Phaser.Math.Vector2();

  constructor(private readonly camp: CampScene) {
    paintFish(camp);
  }

  // ---------- entry points ----------
  /** The Camp routed a water tap here (world point). */
  async onWaterTap(x: number, y: number, opts: CastOpts = {}): Promise<void> {
    if (this.phase === 'casting' || this.phase === 'reeling' || this.phase === 'card' || this.phase === 'walking') return;
    const rod = this.ownedRod();
    if (!rod) {
      audio.sfx.play('nope');
      this.camp.toast(fill(STRINGS.fishing.needRod));
      return;
    }
    if (this.phase === 'waiting' || this.phase === 'bite') this.cancel(false);
    const seq = ++this.castSeq;
    const castX = Math.abs(x - FISHING_FLOW.jettyCastX) < Math.abs(x - FISHING_FLOW.shoreCastX) || x > LAYOUT.jetty.x0 ? FISHING_FLOW.jettyCastX : FISHING_FLOW.shoreCastX;
    this.phase = 'walking';
    await this.camp.walkHeroTo(castX);
    if (seq !== this.castSeq || this.phase !== 'walking') return;
    if (Math.abs(this.camp.hero.x - castX) > 3) { this.phase = 'idle'; return; }
    const hero = this.camp.hero;
    hero.setFacing(x >= hero.x ? 1 : -1);
    this.takeRod();
    this.showPill();
    return new Promise<void>((resolve) => {
      this.done = resolve;
      this.cast(x, y, rod, opts);
    });
  }

  /**
   * Debug (?bite=1 / api.forceBite()): skip the walk and the wait. The hero stands at the jetty with the rod out,
   * the bobber is already on the water and the bite lands now; with `hold` (default) it stays there for a screenshot.
   */
  forceBite(fishId: FishId = 'minnow', hold = true): boolean {
    const rod = this.ownedRod();
    if (!rod) return false;
    if (this.phase !== 'idle') this.cancel(false);
    const camp = this.camp, hero = camp.hero;
    const castX = FISHING_FLOW.jettyCastX;
    hero.setPosition(castX, camp.groundAt(castX));
    hero.setFacing(1);
    camp.worldCam.centerOn(castX, camp.worldCam.midPoint.y);
    this.takeRod();
    this.showPill();
    const land = { x: castX + (FISHING_FLOW.minReach + FISHING_FLOW.maxReach) / 3, y: FISHING_FLOW.landY.min + 30 };
    const bobber = this.bobber ?? makeBobber(camp);
    this.bobber = bobber;
    const line = this.line ?? camp.make.graphics({ x: 0, y: 0 }, false);
    this.line = line;
    camp.landscape.layers.actors.add([line, bobber]);
    bobber.setAlpha(1).setVisible(true).setPosition(land.x, land.y);
    this.redrawLine(land);
    this.phase = 'waiting';
    this.bite(land, rod, null, { force: fishId, hold });
    return true;
  }

  /** Debug (?catch=1 / api.showCatchCard()): open the catch card for a species as if it had just been reeled in. */
  forceCard(fishId: FishId = 'minnow'): boolean {
    const rod = this.ownedRod();
    if (!rod) return false;
    if (this.phase !== 'idle') this.cancel(false);
    const camp = this.camp;
    camp.input.enabled = false;
    this.card(fishId, { x: camp.hero.x + 120, y: FISHING_FLOW.landY.min + 30 }, rod, {});
    return true;
  }

  /** Taps on the ground / interactables: reel in whatever is out and put the rod away. */
  onInterrupt(): void {
    if (this.ignoreInterruptOnce) { this.ignoreInterruptOnce = false; return; }
    if (this.phase === 'reeling' || this.phase === 'card') return;
    this.cancel(true);
  }

  // ---------- state machine ----------
  private cast(tx: number, ty: number, rod: RodId, opts: CastOpts): void {
    const camp = this.camp, hero = camp.hero;
    const rm = isReduceMotion();
    this.phase = 'casting';
    const bait = getState().activeBait;
    const usedBait: BaitId | null = bait && useBait() ? bait : null;
    this.refreshPill();

    const dir = hero.facing;
    const reachMin = hero.x + dir * FISHING_FLOW.minReach, reachMax = hero.x + dir * FISHING_FLOW.maxReach;
    const Z = LAYOUT.fishingZone;
    const lx = Phaser.Math.Clamp(Phaser.Math.Clamp(tx, Math.min(reachMin, reachMax), Math.max(reachMin, reachMax)), Z.x0 + 20, Z.x1 - 24);
    const ly = Phaser.Math.Clamp(ty, FISHING_FLOW.landY.min, FISHING_FLOW.landY.max);
    const land = { x: lx, y: ly };

    const bobber = this.bobber ?? makeBobber(camp);
    this.bobber = bobber;
    const line = this.line ?? camp.make.graphics({ x: 0, y: 0 }, false);
    this.line = line;
    camp.landscape.layers.actors.add([line, bobber]);
    bobber.setAlpha(1).setVisible(true);
    this.rodTip();
    bobber.setPosition(this.tip.x, this.tip.y);

    const from = { x: this.tip.x, y: this.tip.y };
    const prog = { t: 0 };
    const onLand = () => {
      bobber.setPosition(land.x, land.y);
      this.redrawLine(land);
      audio.sfx.play('plip');
      this.ripple(land.x, land.y + 4, 1);
      squash(camp, bobber, 0.15, 220);
      this.wait(land, rod, usedBait, opts);
    };
    if (rm) {
      onLand();
      return;
    }
    this.tweens.push(camp.tweens.add({
      targets: prog, t: 1, duration: FISHING_FLOW.castMs, ease: 'Sine.easeOut',
      onUpdate: () => {
        arcPoint(from, land, prog.t, FISHING_FLOW.castLift, this.tmp);
        bobber.setPosition(this.tmp.x, this.tmp.y);
        this.redrawLine(this.tmp, -FISHING_FLOW.lineSag * (1 - prog.t));
      },
      onComplete: onLand,
    }));
  }

  private wait(land: { x: number; y: number }, rod: RodId, bait: BaitId | null, opts: CastOpts): void {
    const camp = this.camp;
    this.phase = 'waiting';
    const rng = getRng();
    let waitMs = biteWaitMs(rng, bait);
    const nibbles = fakeNibbleCount(rng);
    if (opts.auto) waitMs = Math.min(waitMs, FISHING_FLOW.autoWaitMs as number);
    for (let i = 0; i < nibbles; i++) {
      const at = waitMs * ((i + 1) / (nibbles + 1)) + rng.range(-200, 200);
      this.timers.push(camp.time.delayedCall(Math.max(150, at), () => this.nibble(land)));
    }
    this.timers.push(camp.time.delayedCall(waitMs, () => this.bite(land, rod, bait, opts)));
  }

  private nibble(land: { x: number; y: number }): void {
    if (this.phase !== 'waiting' || !this.bobber) return;
    const b = this.bobber;
    const rm = isReduceMotion();
    this.ripple(land.x, land.y + 4, 0.5);
    if (rm) return;
    this.tweens.push(this.camp.tweens.add({
      targets: b, y: land.y + FISHING_FLOW.nibbleDip, duration: 110, yoyo: true, ease: 'Sine.easeInOut',
      onUpdate: () => this.redrawLine(b),
    }));
  }

  private bite(land: { x: number; y: number }, rod: RodId, bait: BaitId | null, opts: CastOpts): void {
    if (this.phase !== 'waiting' || !this.bobber) return;
    const camp = this.camp, b = this.bobber;
    const s = getState();
    const weather = { rain: s.weather.raining, mist: mistUp(s) };
    const phase = phaseOf(s);
    const fishId: FishId | null = opts.force ?? rollBite(getRng(), phase, weather, { rod, bait });
    this.noteRodHint(phase, weather, rod);
    this.phase = 'bite';

    // the dip, the "!" and a ring
    audio.sfx.play('bite');
    this.ripple(land.x, land.y + 4, 1.3);
    const rm = isReduceMotion();
    if (!rm) {
      this.tweens.push(camp.tweens.add({
        targets: b, y: land.y + FISHING_FLOW.biteDip, duration: 140, yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
        onUpdate: () => this.redrawLine(b),
      }));
    }
    this.bang(opts.hold === true);

    const windowMs = biteWindowMs(rod);
    const hook = () => {
      if (this.phase !== 'bite') return;
      this.clearHook();
      // the hooking tap must not also walk the hero away: the Camp's pointerup is swallowed until the card closes
      camp.input.enabled = false;
      this.hit(land, fishId, rod, opts);
    };
    if (opts.hold) {
      // debug shot: the bite waits for a tap and never slips away
      this.hookHandler = hook;
      camp.input.once('pointerdown', hook);
      return;
    }
    if (opts.auto || fishId === null) {
      // scripts hook at once; nothing in season still nibbles, then slips away
      this.timers.push(camp.time.delayedCall(fishId === null ? windowMs : 120, () => (fishId === null ? this.miss(land) : hook())));
      return;
    }
    this.hookHandler = hook;
    camp.input.once('pointerdown', hook);
    this.timers.push(camp.time.delayedCall(windowMs, () => { if (this.phase === 'bite') this.miss(land); }));
  }

  private hit(land: { x: number; y: number }, fishId: FishId | null, rod: RodId, opts: CastOpts): void {
    const camp = this.camp, hero = camp.hero, b = this.bobber;
    this.phase = 'reeling';
    this.clearTimers();
    void hero.react('bite');
    audio.sfx.play('reel', { duration: FISHING.reelMs / 1000 });
    const rm = isReduceMotion();
    const finish = () => {
      this.hideTackle();
      if (fishId === null) { this.miss(land); return; }
      this.card(fishId, land, rod, opts);
    };
    if (!b || rm) { finish(); return; }
    this.rodTip();
    this.tweens.push(camp.tweens.add({
      targets: b, x: this.tip.x + 30 * hero.facing, y: this.tip.y + 20, duration: FISHING.reelMs, ease: 'Sine.easeIn',
      onUpdate: () => { this.rodTip(); this.redrawLine(b, FISHING_FLOW.lineSag); },
      onComplete: finish,
    }));
  }

  private card(fishId: FishId, land: { x: number; y: number }, _rod: RodId, opts: CastOpts): void {
    const camp = this.camp, hero = camp.hero;
    this.phase = 'card';
    const def = FISH_BY_ID[fishId];
    const cm = rollFishSize(getRng(), fishId);
    const isNew = discoverFish(fishId, cm);
    const end = () => {
      camp.input.enabled = true;
      this.phase = 'idle';
      markDirty();
      this.finishCast();
    };
    const keep = () => {
      addFish(fishId, cm);
      audio.sfx.play('catchFanfare');
      const crown = hero.worldPoint(RIG.crown, this.tmp);
      sparkleBurst(camp, crown.x, crown.y - 10, isNew ? 20 : 12);
      hero.setExpression(isNew ? 'blissful' : 'happy');
      camp.toast(fill(STRINGS.toasts.caught, { Fish: def.name, size: cm }));
      camp.time.delayedCall(1400, () => { if (this.phase === 'idle') hero.setExpression('neutral'); });
      end();
    };
    const release = () => {
      releaseFish();
      audio.sfx.play('heart');
      const crown = hero.worldPoint(RIG.crown, this.tmp);
      heartsFloat(camp, crown.x, crown.y - 6, 3);
      this.swimOff(fishId, land);
      camp.toast(STRINGS.fishing.letGoToast);
      end();
    };
    if (opts.auto) { keep(); return; }
    showCatch(camp.uiScene(), {
      name: def.name, sizeCm: cm, rarity: RARITY_STARS[def.rarity] as 1 | 2 | 3, isNew, spriteKey: FISH_KEYS[fishId],
      onKeep: keep, onRelease: release,
    });
  }

  private miss(land: { x: number; y: number }): void {
    const camp = this.camp, b = this.bobber;
    this.clearHook();
    this.clearTimers();
    this.phase = 'idle';
    camp.input.enabled = true;
    const after = () => {
      this.hideTackle();
      audio.sfx.play('nope');
      camp.toast(STRINGS.toasts.slippedAway);
      this.finishCast();
    };
    if (!b || isReduceMotion()) { after(); return; }
    this.tweens.push(camp.tweens.add({
      targets: b, y: land.y + 16, alpha: 0, duration: FISHING_FLOW.sinkMs, ease: 'Sine.easeIn',
      onUpdate: () => this.redrawLine(b),
      onComplete: after,
    }));
  }

  /** Stop everything mid-flow (taps elsewhere). `putAway` also drops the rod. */
  private cancel(putAway: boolean): void {
    this.castSeq++;
    this.clearHook();
    this.clearTimers();
    this.killTweens();
    this.camp.input.enabled = true;
    this.hideTackle();
    this.phase = 'idle';
    if (putAway) {
      this.hidePill();
      this.dropRod();
    }
    this.finishCast();
  }

  private finishCast(): void {
    const d = this.done;
    this.done = null;
    d?.();
  }

  // ---------- helpers: rod, line, bobber ----------
  private ownedRod(): RodId | null {
    const s = getState();
    if (s.activeRod && s.inventory.gear[s.activeRod]) return s.activeRod;
    return FISHING_FLOW.rodOrder.find((id) => s.inventory.gear[id]) ?? null;
  }

  private takeRod(): void {
    const hero = this.camp.hero;
    if (hero.holding === 'rod' && this.rodImg) return;
    hero.hold('rod');
    this.rodImg = makeRod(this.camp);
    hero.heldSlot.add(this.rodImg);
  }
  private dropRod(): void {
    const hero = this.camp.hero;
    if (hero.holding === 'rod') hero.hold('none');
    this.rodImg = null;
  }

  /** World position of the rod tip into this.tip. */
  private rodTip(): Phaser.Math.Vector2 {
    return this.camp.hero.worldPoint({ x: RIG.hold.x + ROD_TIP.x, y: RIG.hold.y + ROD_TIP.y }, this.tip);
  }
  private redrawLine(to: { x: number; y: number }, sag: number = FISHING_FLOW.lineSag): void {
    if (!this.line) return;
    this.rodTip();
    drawLine(this.line, this.tip, to, sag);
  }
  private hideTackle(): void {
    this.bobber?.setVisible(false);
    this.line?.clear();
  }

  private ripple(x: number, y: number, k: number): void {
    const r = makeRing(this.camp);
    this.camp.landscape.layers.actors.add(r);
    r.setPosition(x, y);
    const b = r.scaleX;
    if (isReduceMotion()) {
      r.setScale(b * k).setAlpha(0.8);
      this.camp.time.delayedCall(FISHING_FLOW.ringMs, () => r.destroy());
      return;
    }
    r.setScale(b * 0.4 * k).setAlpha(0.9);
    this.camp.tweens.add({ targets: r, scaleX: b * 1.4 * k, scaleY: b * 1.4 * k, alpha: 0, duration: FISHING_FLOW.ringMs, ease: 'Sine.easeOut', onComplete: () => r.destroy() });
  }

  /** "!" in the hand font over the hero's head (`hold` keeps it up: debug shots). */
  private bang(hold = false): void {
    const camp = this.camp;
    const p = camp.hero.worldPoint(RIG.crown, this.tmp);
    const t = makeText(camp, p.x, p.y - 26, '!', { hand: true, size: FISHING_FLOW.bangSize, color: PALETTE.ember, weight: 700, shadow: true }).setOrigin(0.5, 1).setAlpha(0);
    camp.landscape.layers.clearingFront.add(t);
    popIn(camp, t, 240);
    if (hold) { camp.time.delayedCall(FISHING_FLOW.bangHoldMs * FISHING_FLOW.debugHoldFactor, () => t.destroy()); return; }
    camp.time.delayedCall(FISHING_FLOW.bangHoldMs, () => {
      camp.tweens.add({ targets: t, alpha: 0, y: t.y - 10, duration: 200, onComplete: () => t.destroy() });
    });
  }

  /** The released fish swims away from the shore and fades. */
  private swimOff(fishId: FishId, land: { x: number; y: number }): void {
    const camp = this.camp;
    const f = img(camp, land.x, land.y + 6, FISH_KEYS[fishId]);
    camp.landscape.layers.actors.add(f);
    const b = f.scaleX * 0.5;
    f.setScale(b).setData('baseScale', b).setAlpha(0.95);
    if (isReduceMotion()) {
      camp.tweens.add({ targets: f, alpha: 0, duration: 400, onComplete: () => f.destroy() });
      return;
    }
    camp.tweens.add({ targets: f, angle: { from: -6, to: 6 }, duration: 180, yoyo: true, repeat: 5, ease: 'Sine.easeInOut' });
    camp.tweens.add({
      targets: f, x: land.x + FISHING_FLOW.releaseSwimPx, y: land.y + 14, alpha: 0, duration: FISHING_FLOW.releaseMs, ease: 'Sine.easeIn',
      onComplete: () => f.destroy(),
    });
  }

  /** Count casts made while a better-rod fish is in season; hint once a day at the threshold. */
  private noteRodHint(phase: ReturnType<typeof phaseOf>, weather: { rain: boolean; mist: boolean }, rod: RodId): void {
    if (fishNeedingBetterRod(phase, weather, rod).length === 0) return;
    const s = getState();
    const n = s.flags.rodHintCasts + 1;
    if (n >= FISHING.rodHintAfterCasts && this.rodHintDay !== s.day) {
      this.rodHintDay = s.day;
      setFlag('rodHintCasts', 0);
      this.camp.toast(STRINGS.fishing.rodHint);
    } else setFlag('rodHintCasts', n);
  }

  // ---------- bait pill ----------
  private ownsAnyBait(): boolean {
    const b = getState().inventory.bait;
    return Object.values(b).some((n) => n > 0);
  }
  private showPill(): void {
    if (!this.ownsAnyBait()) return;
    const camp = this.camp, hero = camp.hero;
    const L = FISHING_FLOW.pill;
    if (!this.pill) {
      const bg = ninePill(camp, 0, 0, L.w, false);
      this.pillText = makeText(camp, 0, -2, '', { size: L.textSize, weight: 600, color: PALETTE.ink, align: 'center' }).setOrigin(0.5);
      this.pill = camp.make.container({ x: 0, y: 0, add: false });
      this.pill.add([bg, this.pillText]);
      camp.landscape.layers.clearingFront.add(this.pill);
    }
    this.pill.setPosition(hero.x, hero.y + L.dy).setVisible(true).setAlpha(0);
    camp.tweens.add({ targets: this.pill, alpha: 1, duration: 200 });
    this.refreshPill();
    const pillZone: Interactable = {
      id: FISHING_FLOW.pillId, x: hero.x, y: hero.y + L.dy + L.h / 2, radius: 1e6, hit: { w: L.w, h: L.h }, glow: false,
      labelFor: () => null,
      actionsFor: () => [],
      onTap: () => this.cycleBait(),
    };
    camp.registerInteractable(pillZone);
    // the pill's zone sees pointerdown before the Camp's pointerup interrupt: mark that interrupt as ours
    camp.input.on('gameobjectdown', this.onZoneDown, this);
  }
  private onZoneDown(_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject): void {
    const z = obj as Phaser.GameObjects.Zone;
    if (!this.pill || !this.pill.visible) return;
    if (Math.abs(z.x - this.pill.x) < 1 && Math.abs(z.y - this.pill.y) < 1) {
      this.ignoreInterruptOnce = true;
      this.camp.time.delayedCall(400, () => { this.ignoreInterruptOnce = false; });
    }
  }
  private hidePill(): void {
    this.camp.input.off('gameobjectdown', this.onZoneDown, this);
    this.camp.unregisterInteractable(FISHING_FLOW.pillId);
    this.pill?.setVisible(false);
  }
  private cycleBait(): void {
    const s = getState();
    const order = FISHING_FLOW.baitOrder.filter((id) => id === null || s.inventory.bait[id] > 0);
    const i = order.indexOf(s.activeBait);
    setActiveBait(order[(i + 1) % order.length]);
    audio.sfx.play('pop');
    if (this.pill) squash(this.camp, this.pill, 0.1, 200);
    this.refreshPill();
  }
  private refreshPill(): void {
    if (!this.pillText) return;
    const s = getState();
    const id = s.activeBait;
    if (!id || s.inventory.bait[id] <= 0) { this.pillText.setText(STRINGS.fishing.baitNone); return; }
    const short = id === 'bait_wiggly' ? STRINGS.fishing.baitWiggly : STRINGS.fishing.baitSparkle;
    this.pillText.setText(fill(STRINGS.fishing.baitLabel, { Bait: short, n: s.inventory.bait[id] }));
  }

  // ---------- bookkeeping ----------
  private clearHook(): void {
    if (this.hookHandler) this.camp.input.off('pointerdown', this.hookHandler);
    this.hookHandler = null;
  }
  private clearTimers(): void {
    for (const t of this.timers) t.remove(false);
    this.timers.length = 0;
  }
  private killTweens(): void {
    for (const t of this.tweens) t.stop();
    this.tweens.length = 0;
  }

  destroy(): void {
    this.clearHook();
    this.clearTimers();
    this.killTweens();
    this.camp.input.off('gameobjectdown', this.onZoneDown, this);
    this.done = null;
  }
}
