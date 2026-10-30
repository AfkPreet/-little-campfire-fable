/**
 * Puttu, the companion rig. A Container with its origin at the feet (x center, y ground).
 * States: stand, sit (legs tucked), sleep (curled), peek (ears and eyes above a leaf line; the caller draws the
 * leaves in front), hidden (sunk and faded). Idle: breathing, blinks every 2-5 s, ear flicks.
 */
import Phaser from 'phaser';
import { COMP_KEYS, paintCompanionTextures } from '@/art/companion';
import { makeImg } from '@/art/pipeline';
import { hexToInt } from '@/config/palette';
import { breathe, isReduceMotion, squash } from '@/fx/juice';
import { dustPuff } from '@/fx/particles';

export type CompanionState = 'stand' | 'sit' | 'sleep' | 'peek' | 'hidden';

type Pose = {
  body: [number, number];
  head: [number, number];
  headRot: number;
  /** how far the ears splay outward (0 = upright) */
  earSplay: number;
  legs: boolean;
  tucked: boolean;
  eyesClosed: boolean;
};

const POSES: Record<Exclude<CompanionState, 'hidden'>, Pose> = {
  stand: { body: [0, -21], head: [12, -38], headRot: 0, earSplay: 0.25, legs: true, tucked: false, eyesClosed: false },
  peek: { body: [0, -21], head: [12, -38], headRot: 0, earSplay: 0.15, legs: false, tucked: false, eyesClosed: false },
  sit: { body: [0, -15], head: [12, -32], headRot: 0.06, earSplay: 0.2, legs: false, tucked: true, eyesClosed: false },
  sleep: { body: [0, -13], head: [4, -23], headRot: 0.4, earSplay: 0.8, legs: false, tucked: false, eyesClosed: true },
};

/** Eye line above the feet (for peeking). */
const EYE_Y = POSES.stand.head[1] - 1;
const HOP_PX = 26;
const POSE_MS = 320;
const BLINK_MS = 120;

export class Companion extends Phaser.GameObjects.Container {
  state: CompanionState = 'stand';
  private facing: 1 | -1 = 1;
  /** flips with the facing; holds the rig so squashes never undo the flip */
  private readonly flip: Phaser.GameObjects.Container;
  /** bobs, squashes, sinks and fades as a unit */
  private readonly rig: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly torso: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Container;
  private readonly earBack: Phaser.GameObjects.Image;
  private readonly earFront: Phaser.GameObjects.Image;
  private readonly eyesOpen: Phaser.GameObjects.Image;
  private readonly eyesClosed: Phaser.GameObjects.Image;
  private readonly legs: Phaser.GameObjects.Image[] = [];
  private readonly tucked: Phaser.GameObjects.Image;
  private readonly tintables: Phaser.GameObjects.Image[] = [];
  private blinkTimer?: Phaser.Time.TimerEvent;
  private flickTimer?: Phaser.Time.TimerEvent;
  private walkTween?: Phaser.Tweens.Tween;
  private eyesForcedClosed = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    paintCompanionTextures(scene);
    this.setData('baseScale', 1);

    this.shadow = makeImg(scene, 0, -1, COMP_KEYS.shadow);
    this.shadow.setAlpha(0.9);
    this.add(this.shadow);

    this.flip = scene.make.container({ x: 0, y: 0, add: false });
    this.rig = scene.make.container({ x: 0, y: 0, add: false });
    this.rig.setData('baseScale', 1);
    this.flip.add(this.rig);
    this.add(this.flip);

    // legs: back pair then front pair; the far legs sit slightly behind
    for (const lx of [-11, 9, -7, 13]) {
      const leg = makeImg(scene, lx, 0, COMP_KEYS.leg);
      leg.setOrigin(0.5, 1);
      leg.setData('baseX', lx);
      this.legs.push(leg);
      this.rig.add(leg);
    }
    this.tucked = makeImg(scene, 0, 0, COMP_KEYS.legsTucked);
    this.tucked.setOrigin(0.5, 1);
    this.tucked.setVisible(false);
    this.rig.add(this.tucked);

    this.torso = makeImg(scene, 0, POSES.stand.body[1], COMP_KEYS.body);
    this.torso.setOrigin(0.5, 0.5);
    this.rig.add(this.torso);

    this.head = scene.make.container({ x: POSES.stand.head[0], y: POSES.stand.head[1], add: false });
    this.earBack = makeImg(scene, -5, -9, COMP_KEYS.ear);
    this.earFront = makeImg(scene, 6, -10, COMP_KEYS.ear);
    for (const ear of [this.earBack, this.earFront]) ear.setOrigin(0.5, 0.95);
    const face = makeImg(scene, 0, 0, COMP_KEYS.head);
    this.eyesOpen = makeImg(scene, 0, 0, COMP_KEYS.eyesOpen);
    this.eyesClosed = makeImg(scene, 0, 0, COMP_KEYS.eyesClosed);
    this.eyesClosed.setVisible(false);
    this.head.add([this.earBack, this.earFront, face, this.eyesOpen, this.eyesClosed]);
    this.rig.add(this.head);

    this.tintables.push(this.torso, face, this.earBack, this.earFront, this.tucked, ...this.legs);

    this.applyPose(POSES.stand, false);
    this.scheduleBlink();
    this.scheduleFlick();
    scene.add.existing(this);
  }

  // ---------- states ----------

  stand(): Promise<void> {
    return this.enter('stand');
  }
  sit(): Promise<void> {
    return this.enter('sit');
  }
  sleep(): Promise<void> {
    return this.enter('sleep');
  }

  /** Rise so only the ears and eyes clear `leafY` (world y of the leaf line), blink twice. No mask: the caller draws leaves in front. */
  async peek(leafY: number): Promise<void> {
    const targetY = leafY - EYE_Y + 6;
    const wasHidden = this.state === 'hidden';
    this.state = 'peek';
    this.applyPose(POSES.peek, !wasHidden);
    this.shadow.setVisible(false);
    if (wasHidden) {
      this.y = targetY + 30;
      this.rig.setAlpha(1);
      await this.tweenP({ targets: this, y: targetY, duration: 420, ease: 'Back.easeOut' });
    } else {
      await this.tweenP({ targets: this, y: targetY, duration: 380, ease: 'Sine.easeInOut' });
    }
    await this.blink(2);
  }

  /** Sink a little and fade out. */
  async hide(): Promise<void> {
    this.state = 'hidden';
    this.scene.tweens.killTweensOf(this.rig);
    await this.tweenP({ targets: this.rig, y: 30, alpha: 0, duration: 380, ease: 'Sine.easeIn' });
    this.shadow.setVisible(false);
  }

  private async enter(state: 'stand' | 'sit' | 'sleep'): Promise<void> {
    const wasHidden = this.state === 'hidden';
    this.state = state;
    this.applyPose(POSES[state], !wasHidden);
    this.shadow.setVisible(true);
    if (wasHidden) {
      this.scene.tweens.killTweensOf(this.rig);
      this.rig.setAlpha(1);
      await this.tweenP({ targets: this.rig, y: 0, duration: 420, ease: 'Back.easeOut' });
      squash(this.scene, this.rig, 0.1, 200);
    } else {
      await new Promise<void>((r) => this.scene.time.delayedCall(POSE_MS, r));
    }
  }

  private applyPose(p: Pose, animate: boolean): void {
    const dur = animate && !isReduceMotion() ? POSE_MS : 0;
    const ease = 'Sine.easeInOut';
    const tw = this.scene.tweens;
    for (const t of [this.torso, this.head, this.earBack, this.earFront]) tw.killTweensOf(t);
    if (dur === 0) {
      this.torso.setPosition(p.body[0], p.body[1]);
      this.head.setPosition(p.head[0], p.head[1]).setRotation(p.headRot);
      this.earBack.setRotation(-p.earSplay);
      this.earFront.setRotation(p.earSplay);
    } else {
      tw.add({ targets: this.torso, x: p.body[0], y: p.body[1], duration: dur, ease });
      tw.add({ targets: this.head, x: p.head[0], y: p.head[1], rotation: p.headRot, duration: dur, ease });
      tw.add({ targets: this.earBack, rotation: -p.earSplay, duration: dur, ease });
      tw.add({ targets: this.earFront, rotation: p.earSplay, duration: dur, ease });
    }
    // breathing re-attaches to the body after the kill
    breathe(this.scene, this.torso, 2400, 0.03);
    for (const leg of this.legs) leg.setVisible(p.legs);
    this.tucked.setVisible(p.tucked);
    this.eyesForcedClosed = p.eyesClosed;
    this.showEyes(!p.eyesClosed);
  }

  // ---------- motion ----------

  /** Hop toward x, one step behind the hero: a smaller bob than Chikki's. Resolves on arrival. */
  followTo(x: number, speed = 120): Promise<void> {
    const dx = x - this.x;
    if (Math.abs(dx) < 2) return Promise.resolve();
    if (this.state !== 'stand') void this.stand();
    this.setFacing(dx > 0 ? 1 : -1);
    this.walkTween?.stop();
    const hops = Math.max(1, Math.round(Math.abs(dx) / HOP_PX));
    const hopMs = Phaser.Math.Clamp((Math.abs(dx) / hops / speed) * 1000, 170, 320);
    const startX = this.x, hopDx = dx / hops;
    const bob = isReduceMotion() ? 0 : 4;
    const prog = { t: 0 };
    let lastHop = 0;
    return new Promise((resolve) => {
      this.walkTween = this.scene.tweens.add({
        targets: prog,
        t: 1,
        duration: hops * hopMs,
        ease: 'Linear',
        onUpdate: () => {
          const raw = prog.t * hops;
          const hop = Math.min(hops - 1, Math.floor(raw)), f = raw - hop;
          const eased = 0.5 - 0.5 * Math.cos(Math.PI * f);
          this.x = startX + hopDx * (hop + eased);
          this.rig.y = -bob * Math.sin(Math.PI * f);
          if (hop !== lastHop) {
            lastHop = hop;
            this.land();
          }
        },
        onComplete: () => {
          this.rig.y = 0;
          this.x = x;
          this.land();
          this.walkTween = undefined;
          resolve();
        },
      });
    });
  }

  private land(): void {
    squash(this.scene, this.rig, 0.07, 150);
    dustPuff(this.scene, this.x, this.y, 2);
  }

  /** Hoof-shuffle wiggle (when Chikki eats). */
  wiggle(): Promise<void> {
    if (isReduceMotion()) return Promise.resolve();
    const dur = 80;
    const feet = this.state === 'sit' ? [this.tucked] : this.legs;
    feet.forEach((f, i) => {
      const bx = (f.getData('baseX') as number | undefined) ?? 0;
      this.scene.tweens.add({ targets: f, x: bx + (i % 2 ? 2 : -2), duration: dur, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
    });
    return this.tweenP({ targets: this.head, angle: 6, duration: dur * 1.5, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
  }

  setFacing(dir: 1 | -1): void {
    this.facing = dir;
    this.flip.setScale(dir, 1);
  }
  getFacing(): 1 | -1 {
    return this.facing;
  }

  /** Multiply tint from the lighting (`charTint`), hex string or 0xRRGGBB. */
  setTint(color: number | string): this {
    const c = typeof color === 'string' ? hexToInt(color) : color;
    for (const im of this.tintables) im.setTint(c);
    return this;
  }
  clearTint(): this {
    for (const im of this.tintables) im.clearTint();
    return this;
  }

  // ---------- idle ----------

  /** Close the eyes for a beat, `times` times. */
  async blink(times = 1): Promise<void> {
    for (let i = 0; i < times; i++) {
      this.showEyes(false);
      await this.wait(BLINK_MS);
      if (!this.eyesForcedClosed) this.showEyes(true);
      if (i < times - 1) await this.wait(220);
    }
  }

  private showEyes(open: boolean): void {
    this.eyesOpen.setVisible(open);
    this.eyesClosed.setVisible(!open);
  }

  private scheduleBlink(): void {
    this.blinkTimer = this.scene.time.delayedCall(Phaser.Math.Between(2000, 5000), () => {
      const p = this.eyesForcedClosed || this.state === 'hidden' ? Promise.resolve() : this.blink();
      void p.then(() => this.scheduleBlink());
    });
  }

  private scheduleFlick(): void {
    this.flickTimer = this.scene.time.delayedCall(Phaser.Math.Between(3000, 7000), () => {
      if (this.state !== 'hidden' && !isReduceMotion()) {
        const ear = Math.random() < 0.5 ? this.earBack : this.earFront;
        const base = ear.rotation;
        this.scene.tweens.add({ targets: ear, rotation: base + (ear === this.earBack ? -0.35 : 0.35), duration: 90, yoyo: true, ease: 'Sine.easeInOut' });
      }
      this.scheduleFlick();
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.scene.time.delayedCall(ms, r));
  }
  private tweenP(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({ ...cfg, onComplete: () => resolve() });
    });
  }

  destroy(fromScene?: boolean): void {
    this.blinkTimer?.remove(false);
    this.flickTimer?.remove(false);
    this.walkTween?.stop();
    super.destroy(fromScene);
  }
}
