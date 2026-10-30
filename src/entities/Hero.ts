/**
 * Chikki, the hero: a part-based rig in a Container. Feet sit at the container origin (0,0), so placing the hero at
 * ground y is natural. 100 px tall standing (RIG.height). Faces right by default; setFacing(-1) flips an inner node.
 *
 * Node tree (each layer animates alone, scales relative to baseScale):
 *   Hero (root) -> shadow
 *               -> flip (scaleX = facing) -> bob (hop y) -> squash (landing) -> pose (sit/sleep) -> breath (scaleY)
 *                  -> tailStraight, tailCurl, armL, footL, body, headNode(ears, head, blush, eyes, mouth), heldSlot, armR, footR
 */
import Phaser from 'phaser';
import { HERO_KEYS, HERO_TEX, RIG, paintHeroTextures } from '@/art/hero';
import { makeImg } from '@/art/pipeline';
import { isReduceMotion } from '@/fx/juice';
import { dustPuff, heartsFloat } from '@/fx/particles';

export type HeroExpression = 'neutral' | 'happy' | 'blissful' | 'surprised' | 'sleepy' | 'munching';
export type HeroHold = 'none' | 'rod' | 'dish' | 'basket' | 'seed';
export type HeroPose = 'stand' | 'sit' | 'sleep';
export type HeroReaction = 'bite' | 'happy';
export type Facing = 1 | -1;

export type HeroTuning = {
  /** px per second */
  walkSpeed: number;
  /** hop bob height in px and one hop's period in ms */
  hopBob: number;
  hopPeriod: number;
  blinkMin: number;
  blinkMax: number;
  blinkDur: number;
  /** the curious tail: wait range, crossfade time, hold time (ms) */
  curlMin: number;
  curlMax: number;
  curlFade: number;
  curlHold: number;
  earMin: number;
  earMax: number;
  breathPeriod: number;
  breathAmount: number;
  /** eye glance nudge in px */
  glanceNudge: number;
  /** how long a react() holds its face (ms) */
  reactHold: number;
};

export const HERO_TUNING: HeroTuning = {
  walkSpeed: 140,
  hopBob: 5,
  hopPeriod: 220,
  blinkMin: 2000,
  blinkMax: 5000,
  blinkDur: 110,
  curlMin: 6000,
  curlMax: 10000,
  curlFade: 900,
  curlHold: 1200,
  earMin: 3000,
  earMax: 7000,
  breathPeriod: 2400,
  breathAmount: 0.03,
  glanceNudge: 2.5,
  reactHold: 1100,
};

type Face = { eye: string; mouth: string; blush: number; eyesClosed: boolean; hearts?: boolean; chew?: boolean; slowBlink?: boolean };
const FACES: Record<HeroExpression, Face> = {
  neutral: { eye: HERO_KEYS.eyeOpen, mouth: HERO_KEYS.mouthSmile, blush: 1, eyesClosed: false },
  happy: { eye: HERO_KEYS.eyeClosed, mouth: HERO_KEYS.mouthOpen, blush: 1.1, eyesClosed: true },
  blissful: { eye: HERO_KEYS.eyeClosed, mouth: HERO_KEYS.mouthSmile, blush: 1.45, eyesClosed: true, hearts: true },
  surprised: { eye: HERO_KEYS.eyeRound, mouth: HERO_KEYS.mouthO, blush: 0.9, eyesClosed: false },
  sleepy: { eye: HERO_KEYS.eyeHalf, mouth: HERO_KEYS.mouthSmile, blush: 1, eyesClosed: false, slowBlink: true },
  munching: { eye: HERO_KEYS.eyeOpen, mouth: HERO_KEYS.mouthMunch, blush: 1.05, eyesClosed: false, chew: true },
};

type TailState = 'straight' | 'curling' | 'held' | 'ready';
const HOLD_ARM_R = -72;
const HOLD_ARM_L = -58;
const SIT_DROP = 12;
const SLEEP_ANGLE = -28;
const SLEEP_DROP = SIT_DROP + 6;

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const TMP_M = new Phaser.GameObjects.Components.TransformMatrix();

export class Hero extends Phaser.GameObjects.Container {
  readonly tuning: HeroTuning;
  /** Anchor at the paws: add a rod, dish or basket here. Emptied (children destroyed) by hold(). */
  readonly heldSlot: Phaser.GameObjects.Container;

  private readonly flip: Phaser.GameObjects.Container;
  private readonly bobNode: Phaser.GameObjects.Container;
  private readonly squashNode: Phaser.GameObjects.Container;
  private readonly poseNode: Phaser.GameObjects.Container;
  private readonly breathNode: Phaser.GameObjects.Container;
  private readonly headNode: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly tailS: Phaser.GameObjects.Image;
  private readonly tailC: Phaser.GameObjects.Image;
  private readonly bodyImg: Phaser.GameObjects.Image;
  private readonly armL: Phaser.GameObjects.Image;
  private readonly armR: Phaser.GameObjects.Image;
  private readonly footL: Phaser.GameObjects.Image;
  private readonly footR: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private readonly earL: Phaser.GameObjects.Image;
  private readonly earR: Phaser.GameObjects.Image;
  private readonly eyeL: Phaser.GameObjects.Image;
  private readonly eyeR: Phaser.GameObjects.Image;
  private readonly mouth: Phaser.GameObjects.Image;
  private readonly blushL: Phaser.GameObjects.Image;
  private readonly blushR: Phaser.GameObjects.Image;
  private readonly tintable: Phaser.GameObjects.Image[];

  private _facing: Facing = 1;
  private _expression: HeroExpression = 'neutral';
  private _hold: HeroHold = 'none';
  private _pose: HeroPose = 'stand';
  private tint: number | null = null;

  // idle
  private idling = false;
  private breathTween?: Phaser.Tweens.Tween;
  private chewTween?: Phaser.Tweens.Tween;
  private blinkT = 0;
  private blinkHandle?: Phaser.Time.TimerEvent;
  private earT = 0;
  private heartsT = 0;
  private tailState: TailState = 'straight';
  private tailT = 0;
  private tailTween?: Phaser.Tweens.Tween;
  private curlLeanTarget = 0;

  // glance
  private glanceX = 0;
  private glanceY = 0;
  private glanceCurX = 0;
  private glanceCurY = 0;

  // walk
  private walking = false;
  private walkTarget = 0;
  private walkSpeed = HERO_TUNING.walkSpeed;
  private hopT = 0;
  private walkResolve?: () => void;
  private reactHandle?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, x: number, y: number, tuning: Partial<HeroTuning> = {}) {
    super(scene, x, y);
    this.tuning = { ...HERO_TUNING, ...tuning };
    paintHeroTextures(scene);

    const mk = (key: string, p: { x: number; y: number }, dx = 0, dy = 0): Phaser.GameObjects.Image => makeImg(scene, p.x - dx, p.y - dy, key);

    this.shadow = mk(HERO_KEYS.shadow, RIG.shadow);
    this.flip = scene.make.container({ add: false });
    this.bobNode = scene.make.container({ add: false });
    this.squashNode = scene.make.container({ add: false });
    this.poseNode = scene.make.container({ add: false });
    this.breathNode = scene.make.container({ add: false });
    this.headNode = scene.make.container({ x: RIG.head.x, y: RIG.head.y, add: false });
    this.heldSlot = scene.make.container({ x: RIG.hold.x, y: RIG.hold.y, add: false });
    for (const n of [this.flip, this.bobNode, this.squashNode, this.poseNode, this.breathNode, this.headNode, this.heldSlot]) n.setData('baseScale', 1);

    this.tailS = mk(HERO_KEYS.tailStraight, RIG.tailBase).setOrigin(HERO_TEX.tailStraightOrigin.x, HERO_TEX.tailStraightOrigin.y);
    this.tailC = mk(HERO_KEYS.tailCurl, RIG.tailBase).setOrigin(HERO_TEX.tailCurlOrigin.x, HERO_TEX.tailCurlOrigin.y).setAlpha(0);
    this.armL = mk(HERO_KEYS.armL, RIG.armL).setOrigin(HERO_TEX.armOrigin.x, HERO_TEX.armOrigin.y);
    this.armR = mk(HERO_KEYS.armR, RIG.armR).setOrigin(HERO_TEX.armOrigin.x, HERO_TEX.armOrigin.y);
    this.footL = mk(HERO_KEYS.foot, RIG.footL);
    this.footR = mk(HERO_KEYS.foot, RIG.footR);
    this.bodyImg = mk(HERO_KEYS.body, RIG.body);
    const hx = RIG.head.x, hy = RIG.head.y;
    this.earL = mk(HERO_KEYS.ear, RIG.earL, hx, hy).setOrigin(0.5, 0.85);
    this.earR = mk(HERO_KEYS.ear, RIG.earR, hx, hy).setOrigin(0.5, 0.85);
    this.head = mk(HERO_KEYS.head, RIG.head, hx, hy);
    this.blushL = mk(HERO_KEYS.blush, RIG.blushL, hx, hy);
    this.blushR = mk(HERO_KEYS.blush, RIG.blushR, hx, hy);
    this.eyeL = mk(HERO_KEYS.eyeOpen, RIG.eyeL, hx, hy);
    this.eyeR = mk(HERO_KEYS.eyeOpen, RIG.eyeR, hx, hy);
    this.mouth = mk(HERO_KEYS.mouthSmile, RIG.mouth, hx, hy);

    this.headNode.add([this.earL, this.earR, this.head, this.blushL, this.blushR, this.eyeL, this.eyeR, this.mouth]);
    this.breathNode.add([this.tailS, this.tailC, this.armL, this.footL, this.bodyImg, this.headNode, this.heldSlot, this.armR, this.footR]);
    this.poseNode.add(this.breathNode);
    this.squashNode.add(this.poseNode);
    this.bobNode.add(this.squashNode);
    this.flip.add(this.bobNode);
    this.add([this.shadow, this.flip]);

    this.tintable = [this.tailS, this.tailC, this.armL, this.armR, this.footL, this.footR, this.bodyImg, this.head, this.earL, this.earR, this.eyeL, this.eyeR, this.mouth, this.blushL, this.blushR];

    this.resetTimers();
    scene.sys.updateList.add(this);
  }

  // ---------- public API ----------

  get facing(): Facing { return this._facing; }
  get expression(): HeroExpression { return this._expression; }
  get holding(): HeroHold { return this._hold; }
  get pose(): HeroPose { return this._pose; }
  get isWalking(): boolean { return this.walking; }

  setFacing(dir: Facing): this {
    this._facing = dir;
    this.flip.scaleX = dir;
    return this;
  }

  setExpression(kind: HeroExpression): this {
    const prev = this._expression;
    this._expression = kind;
    const f = FACES[kind];
    this.eyeL.setTexture(f.eye);
    this.eyeR.setTexture(f.eye);
    this.mouth.setTexture(f.mouth);
    this.scene.tweens.killTweensOf([this.blushL, this.blushR]);
    const bs = (this.blushL.getData('baseScale') as number) * f.blush;
    this.scene.tweens.add({ targets: [this.blushL, this.blushR], scaleX: bs, scaleY: bs, duration: 220, ease: 'Sine.easeOut' });
    this.chewTween?.stop();
    this.chewTween = undefined;
    const mb = this.mouth.getData('baseScale') as number;
    this.mouth.setScale(mb);
    if (f.chew) {
      if (this._hold === 'none') this.hold('seed');
      this.chewTween = this.scene.tweens.add({ targets: this.mouth, scaleX: mb * 1.12, scaleY: mb * 0.9, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (prev === 'munching' && this._hold === 'seed') {
      this.hold('none');
    }
    if (prev !== kind && !isReduceMotion()) {
      // a tiny head pop so the face change reads
      this.scene.tweens.killTweensOf(this.headNode);
      this.headNode.setScale(1.05, 0.96);
      this.scene.tweens.add({ targets: this.headNode, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.easeOut' });
    }
    this.heartsT = 600;
    return this;
  }

  /** Lighting tint (0xRRGGBB) for every part. Pass null to clear. */
  setTint(color: number | null): this {
    this.tint = color;
    const apply = (o: Phaser.GameObjects.GameObject): void => {
      const t = o as Phaser.GameObjects.GameObject & { setTint?: (c: number) => unknown; clearTint?: () => unknown };
      if (color === null) t.clearTint?.();
      else t.setTint?.(color);
    };
    this.tintable.forEach(apply);
    this.heldSlot.each(apply);
    return this;
  }

  startIdle(): this {
    if (this.idling) return this;
    this.idling = true;
    const b = this.breathNode.getData('baseScale') as number;
    this.breathTween = this.scene.tweens.add({
      targets: this.breathNode, scaleY: b * (1 + this.tuning.breathAmount), duration: this.tuning.breathPeriod / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.resetTimers();
    return this;
  }

  stopIdle(): this {
    this.idling = false;
    this.breathTween?.stop();
    this.breathTween = undefined;
    this.breathNode.setScale(1);
    this.setTailStraight(true);
    return this;
  }

  /** Nudge the eyes 2-3 px toward a world point (and lean the curled tail toward it). Pass null to look ahead. */
  lookAt(x: number | null, y?: number): this {
    if (x === null || isReduceMotion()) {
      this.glanceX = 0;
      this.glanceY = 0;
      this.curlLeanTarget = 0;
      return this;
    }
    this.getWorldTransformMatrix(TMP_M);
    const dx = (x - TMP_M.tx) * this._facing;
    const dy = (y ?? TMP_M.ty) - (TMP_M.ty + RIG.eyeL.y * this.scaleY);
    const len = Math.hypot(dx, dy) || 1;
    const n = this.tuning.glanceNudge;
    this.glanceX = (dx / len) * n;
    this.glanceY = (dy / len) * n * 0.7;
    this.curlLeanTarget = Math.hypot(dx, dy) < 160 ? Math.sign(dx) * 7 : 0;
    return this;
  }

  /** Hop-walk to world x. Resolves on arrival or when stopped. */
  walkTo(x: number, opts: { speed?: number } = {}): Promise<void> {
    this.finishWalk();
    if (Math.abs(x - this.x) < 0.5) return Promise.resolve();
    this.setPose('stand');
    this.setFacing(x > this.x ? 1 : -1);
    this.setTailStraight(false);
    this.walking = true;
    this.walkTarget = x;
    this.walkSpeed = opts.speed ?? this.tuning.walkSpeed;
    this.hopT = 0;
    return new Promise<void>((resolve) => { this.walkResolve = resolve; });
  }

  stop(): this {
    this.finishWalk();
    return this;
  }

  /** Show a held-item slot at the paws. 'seed' paints a tiny jack seed; the other kinds leave the slot empty for the caller. */
  hold(kind: HeroHold): this {
    this._hold = kind;
    this.heldSlot.removeAll(true);
    const holding = kind !== 'none';
    if (kind === 'seed') {
      const seed = makeImg(this.scene, 0, -2, HERO_KEYS.seed).setAngle(-12);
      if (this.tint !== null) seed.setTint(this.tint);
      this.heldSlot.add(seed);
    }
    // both paws forward when holding; the far arm comes in front of the body so both paws read
    this.breathNode.moveTo(this.armL, holding ? this.breathNode.getIndex(this.heldSlot) - 1 : 2);
    const d = isReduceMotion() ? 0 : 220;
    this.scene.tweens.killTweensOf([this.armL, this.armR]);
    this.scene.tweens.add({ targets: this.armR, angle: holding ? HOLD_ARM_R : 0, duration: d, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: this.armL, angle: holding ? HOLD_ARM_L : 0, duration: d, ease: 'Back.easeOut' });
    return this;
  }

  /** A short reaction that restores the previous face afterwards. */
  react(kind: HeroReaction): Promise<void> {
    const prev = this._expression;
    this.reactHandle?.remove(false);
    const rm = isReduceMotion();
    if (kind === 'bite') {
      this.setExpression('surprised');
      this.hop(rm ? 6 : 16);
    } else {
      this.setExpression('happy');
      this.hop(rm ? 4 : 10);
      this.getWorldTransformMatrix(TMP_M);
      heartsFloat(this.scene, TMP_M.tx + 8 * this._facing, TMP_M.ty + RIG.crown.y * this.scaleY, 1);
    }
    return new Promise<void>((resolve) => {
      this.reactHandle = this.scene.time.delayedCall(this.tuning.reactHold, () => {
        if (this._expression === (kind === 'bite' ? 'surprised' : 'happy')) this.setExpression(prev);
        resolve();
      });
    });
  }

  /** stand | sit (on the ground, by the fire) | sleep (lying down, sleepy face). */
  setPose(pose: HeroPose): this {
    if (pose === this._pose) return this;
    this._pose = pose;
    if (pose !== 'stand') this.finishWalk();
    const d = isReduceMotion() ? 0 : 420;
    const tw = (targets: object | object[], props: Record<string, number>) =>
      this.scene.tweens.add({ targets, ...props, duration: d, ease: 'Sine.easeInOut' });
    this.scene.tweens.killTweensOf([this.poseNode, this.footL, this.footR]);
    if (pose === 'stand') {
      tw(this.poseNode, { angle: 0, y: 0 });
      tw(this.footL, { x: RIG.footL.x, y: RIG.footL.y, angle: 0 });
      tw(this.footR, { x: RIG.footR.x, y: RIG.footR.y, angle: 0 });
    } else if (pose === 'sit') {
      tw(this.poseNode, { angle: 0, y: SIT_DROP });
      tw(this.footL, { x: 8, y: RIG.footL.y - SIT_DROP, angle: -10 });
      tw(this.footR, { x: 19, y: RIG.footR.y - SIT_DROP - 1, angle: -14 });
      this.setTailStraight(true);
    } else {
      // curled nap: lean back a little, sink like sitting, tuck the feet, tail curled over like a blanket
      tw(this.poseNode, { angle: SLEEP_ANGLE, y: SLEEP_DROP });
      tw(this.footL, { x: 6, y: RIG.footL.y - SLEEP_DROP + 2, angle: -22 });
      tw(this.footR, { x: 16, y: RIG.footR.y - SLEEP_DROP + 1, angle: -30 });
      this.setExpression('sleepy');
      this.setTailStraight(false);
    }
    return this;
  }

  /** World position of a rig point (e.g. RIG.hold, RIG.bag), accounting for facing and scale. */
  worldPoint(p: { x: number; y: number }, out: Phaser.Math.Vector2 = new Phaser.Math.Vector2()): Phaser.Math.Vector2 {
    this.getWorldTransformMatrix(TMP_M);
    return out.set(TMP_M.tx + p.x * this._facing * this.scaleX, TMP_M.ty + p.y * this.scaleY);
  }

  destroy(fromScene?: boolean): void {
    this.scene?.sys.updateList.remove(this);
    this.blinkHandle?.remove(false);
    this.reactHandle?.remove(false);
    this.finishWalk();
    super.destroy(fromScene);
  }

  // ---------- per frame ----------

  preUpdate(_time: number, delta: number): void {
    if (this.walking) this.stepWalk(delta);
    if (this.idling) this.stepIdle(delta);
    this.stepGlance();
  }

  private stepWalk(delta: number): void {
    const dt = delta / 1000;
    const dir = Math.sign(this.walkTarget - this.x);
    const step = this.walkSpeed * dt;
    const bob = isReduceMotion() ? this.tuning.hopBob * 0.5 : this.tuning.hopBob;
    if (Math.abs(this.walkTarget - this.x) <= step) {
      this.x = this.walkTarget;
      this.land();
      this.finishWalk();
      return;
    }
    this.x += dir * step;
    this.hopT += delta / this.tuning.hopPeriod;
    if (this.hopT >= 1) {
      this.hopT -= 1;
      this.land();
    }
    const s = Math.sin(Math.PI * this.hopT);
    this.bobNode.y = -bob * s;
    const sb = this.shadow.getData('baseScale') as number;
    this.shadow.setScale(sb * (1 - 0.18 * s), sb * (1 - 0.1 * s));
    // little alternating steps and an arm swing
    const k = Math.sin(Math.PI * 2 * this.hopT);
    this.footL.y = RIG.footL.y - Math.max(0, k) * 3;
    this.footR.y = RIG.footR.y - Math.max(0, -k) * 3;
    if (this._hold === 'none') {
      this.armL.angle = k * 14;
      this.armR.angle = -k * 14;
    }
  }

  private land(): void {
    if (isReduceMotion()) return;
    this.scene.tweens.killTweensOf(this.squashNode);
    this.squashNode.setScale(1.06, 0.92);
    this.scene.tweens.add({ targets: this.squashNode, scaleX: 1, scaleY: 1, duration: 170, ease: 'Back.easeOut' });
    this.getWorldTransformMatrix(TMP_M);
    dustPuff(this.scene, TMP_M.tx - 6 * this._facing, TMP_M.ty, 3);
  }

  private finishWalk(): void {
    const r = this.walkResolve;
    this.walking = false;
    this.walkResolve = undefined;
    this.bobNode.y = 0;
    const sb = this.shadow.getData('baseScale') as number;
    this.shadow.setScale(sb);
    this.footL.y = this._pose === 'stand' ? RIG.footL.y : this.footL.y;
    this.footR.y = this._pose === 'stand' ? RIG.footR.y : this.footR.y;
    if (this._hold === 'none') {
      this.armL.angle = 0;
      this.armR.angle = 0;
    }
    r?.();
  }

  private stepIdle(delta: number): void {
    const t = this.tuning;
    // blinks
    this.blinkT -= delta;
    if (this.blinkT <= 0) {
      this.blink();
      const slow = FACES[this._expression].slowBlink ? 1.4 : 1;
      this.blinkT = rnd(t.blinkMin, t.blinkMax) * slow;
    }
    // ear flick
    this.earT -= delta;
    if (this.earT <= 0) {
      this.earT = rnd(t.earMin, t.earMax);
      this.flickEar();
    }
    // the curious tail
    if (!this.walking && this._pose === 'stand') this.stepTail(delta);
    // hearts when blissful
    if (FACES[this._expression].hearts) {
      this.heartsT -= delta;
      if (this.heartsT <= 0) {
        this.heartsT = rnd(2400, 4000);
        this.getWorldTransformMatrix(TMP_M);
        heartsFloat(this.scene, TMP_M.tx + 10 * this._facing, TMP_M.ty + RIG.crown.y * this.scaleY, 2);
      }
    }
  }

  private stepTail(delta: number): void {
    const t = this.tuning;
    if (this.tailState === 'straight') {
      this.tailT -= delta;
      if (this.tailT <= 0) {
        this.tailState = 'curling';
        this.tailTween?.stop();
        this.tailC.setAlpha(0);
        this.tailTween = this.scene.tweens.add({
          targets: [this.tailS, this.tailC], alpha: { getEnd: (target: object) => (target === this.tailC ? 1 : 0) },
          duration: isReduceMotion() ? 200 : t.curlFade, ease: 'Sine.easeInOut',
          onComplete: () => {
            this.tailState = 'held';
            this.tailT = t.curlHold;
          },
        });
      }
    } else if (this.tailState === 'held') {
      this.tailT -= delta;
      if (this.tailT <= 0) this.tailState = 'ready';
    }
    // lean the curl toward a nearby point of interest
    const lean = this.tailState === 'straight' ? 0 : this.curlLeanTarget;
    this.tailC.angle += (lean - this.tailC.angle) * 0.08;
  }

  /** Snap the tail straight (the flick) and restart the curl timer. */
  private setTailStraight(instant: boolean): void {
    this.tailTween?.stop();
    this.tailTween = undefined;
    const wasCurled = this.tailC.alpha > 0.01;
    this.tailC.setAlpha(0);
    this.tailS.setAlpha(1);
    this.tailState = 'straight';
    this.tailT = rnd(this.tuning.curlMin, this.tuning.curlMax);
    if (wasCurled && !instant && !isReduceMotion()) {
      this.scene.tweens.killTweensOf(this.tailS);
      this.tailS.setAngle(-14);
      this.scene.tweens.add({ targets: this.tailS, angle: 0, duration: 260, ease: 'Back.easeOut' });
    } else {
      this.tailS.setAngle(0);
    }
  }

  private blink(): void {
    if (this.tailState === 'ready') this.setTailStraight(false);
    const f = FACES[this._expression];
    if (f.eyesClosed) return;
    this.blinkHandle?.remove(false);
    this.eyeL.setTexture(HERO_KEYS.eyeClosed);
    this.eyeR.setTexture(HERO_KEYS.eyeClosed);
    const dur = f.slowBlink ? this.tuning.blinkDur * 2.6 : this.tuning.blinkDur;
    this.blinkHandle = this.scene.time.delayedCall(dur, () => {
      const cur = FACES[this._expression];
      this.eyeL.setTexture(cur.eye);
      this.eyeR.setTexture(cur.eye);
    });
  }

  private flickEar(): void {
    if (isReduceMotion()) return;
    const ear = Math.random() < 0.5 ? this.earL : this.earR;
    this.scene.tweens.killTweensOf(ear);
    this.scene.tweens.add({ targets: ear, angle: ear === this.earL ? -16 : 16, duration: 90, yoyo: true, repeat: 1, ease: 'Sine.easeInOut', onComplete: () => ear.setAngle(0) });
  }

  private stepGlance(): void {
    this.glanceCurX += (this.glanceX - this.glanceCurX) * 0.15;
    this.glanceCurY += (this.glanceY - this.glanceCurY) * 0.15;
    const hx = RIG.head.x, hy = RIG.head.y;
    this.eyeL.setPosition(RIG.eyeL.x - hx + this.glanceCurX, RIG.eyeL.y - hy + this.glanceCurY);
    this.eyeR.setPosition(RIG.eyeR.x - hx + this.glanceCurX, RIG.eyeR.y - hy + this.glanceCurY);
  }

  private hop(height: number): void {
    this.scene.tweens.killTweensOf(this.bobNode);
    this.scene.tweens.add({
      targets: this.bobNode, y: -height, duration: 150, ease: 'Quad.easeOut', yoyo: true,
      onComplete: () => {
        this.bobNode.y = 0;
        this.land();
      },
    });
  }

  private resetTimers(): void {
    const t = this.tuning;
    this.blinkT = rnd(t.blinkMin, t.blinkMax);
    this.earT = rnd(t.earMin, t.earMax);
    this.tailT = rnd(t.curlMin, t.curlMax);
    this.heartsT = rnd(600, 1400);
  }
}
