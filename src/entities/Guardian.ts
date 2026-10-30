/**
 * Bangari, the guardian rig. Container at (x, waterY): the fish starts hidden below the water line and rises
 * with water sheeting off her hump. Idle while risen: scale-lantern pulse (4 s), barbels drifting, a blink every 6 s,
 * a few bubbles, a breathing halo. glowFarOut() shows only the faint far glow for mystery clue 1.
 */
import Phaser from 'phaser';
import { GUARD, GUARD_KEYS, paintGuardianTextures } from '@/art/guardian';
import { makeImg } from '@/art/pipeline';
import { hexToInt } from '@/config/palette';
import { isReduceMotion } from '@/fx/juice';
import { heartsFloat } from '@/fx/particles';

export type GuardianOptions = {
  /** called when she eats (hook for the happy rumble SFX) */
  onRumble?: () => void;
};

const HIDDEN_Y = 440;
const RISEN_Y = -50;
const FIN_ALPHA = 0.4;
const HALO_LOGICAL = 1150;
const FAR_GLOW_LOGICAL = 260;
const BLINK_EVERY_MS = 6000;
const BLINK_MS = 180;
const PULSE_MS = 4000;

/** body-texture coordinates -> rig-local coordinates */
const local = (p: readonly [number, number]): [number, number] => [p[0] - GUARD.body.cx, p[1] - GUARD.body.cy];

export class Guardian extends Phaser.GameObjects.Container {
  readonly waterY: number;
  risen = false;
  private facing: 1 | -1 = 1;
  private readonly flip: Phaser.GameObjects.Container;
  private readonly rig: Phaser.GameObjects.Container;
  private readonly halo: Phaser.GameObjects.Image;
  private readonly scales: Phaser.GameObjects.Image;
  private readonly eyeHalf: Phaser.GameObjects.Image;
  private readonly eyeClosed: Phaser.GameObjects.Image;
  private readonly mouth: Phaser.GameObjects.Image;
  private readonly mouthOpen: Phaser.GameObjects.Image;
  private readonly barbels: Phaser.GameObjects.Image[] = [];
  private readonly fins: Phaser.GameObjects.Image[] = [];
  private readonly tintables: Phaser.GameObjects.Image[] = [];
  private readonly onRumble?: () => void;
  private idleTweens: Phaser.Tweens.Tween[] = [];
  private blinkTimer?: Phaser.Time.TimerEvent;
  private bubbleTimer?: Phaser.Time.TimerEvent;
  private sheetTimer?: Phaser.Time.TimerEvent;
  private haloTween?: Phaser.Tweens.Tween;
  private farGlow = false;

  constructor(scene: Phaser.Scene, x: number, waterY: number, opts: GuardianOptions = {}) {
    super(scene, x, waterY);
    this.waterY = waterY;
    this.onRumble = opts.onRumble;
    paintGuardianTextures(scene);
    this.setData('baseScale', 1);

    // the halo sits behind everything and is never tinted
    this.halo = makeImg(scene, 0, RISEN_Y, GUARD_KEYS.halo);
    this.halo.setBlendMode(Phaser.BlendModes.ADD);
    this.setHaloSize(HALO_LOGICAL);
    this.halo.setAlpha(0);
    this.add(this.halo);

    this.flip = scene.make.container({ x: 0, y: 0, add: false });
    this.rig = scene.make.container({ x: 0, y: HIDDEN_Y, add: false });
    this.rig.setData('baseScale', 1);
    this.rig.setAlpha(0);
    this.flip.add(this.rig);
    this.add(this.flip);

    // forked tail fin and dorsal fin (behind; their textures carry their own translucency), body, scales, face,
    // pectoral petal and barbels (in front)
    const [tx, ty] = local(GUARD.anchors.tail);
    this.rig.add(this.makeFin(tx, ty, 0, 1, GUARD_KEYS.tailFin, GUARD.tailFin.origin, 1));
    const [dx, dy] = local(GUARD.anchors.dorsal);
    this.rig.add(this.makeFin(dx, dy, 0, 1, GUARD_KEYS.dorsalFin, GUARD.dorsalFin.origin, 1));

    const body = makeImg(scene, 0, 0, GUARD_KEYS.body);
    this.scales = makeImg(scene, 0, 0, GUARD_KEYS.scales);
    this.scales.setAlpha(0.65);
    const [ex, ey] = local(GUARD.eye.at);
    this.eyeHalf = makeImg(scene, ex, ey, GUARD_KEYS.eyeHalf);
    this.eyeClosed = makeImg(scene, ex, ey, GUARD_KEYS.eyeClosed);
    this.eyeClosed.setVisible(false);
    const [mx, my] = local(GUARD.mouth.at);
    this.mouth = makeImg(scene, mx, my, GUARD_KEYS.mouth);
    this.mouthOpen = makeImg(scene, mx, my, GUARD_KEYS.mouthOpen);
    this.mouthOpen.setVisible(false);
    this.rig.add([body, this.scales, this.eyeHalf, this.eyeClosed, this.mouth, this.mouthOpen]);

    const [px, py] = local(GUARD.anchors.pectoral);
    this.rig.add(this.makeFin(px, py, 3.6, 0.7));

    // one barbel drifts from each mouth corner, splayed a little apart (positive rotation swings a hanging ribbon back)
    for (const [key, root, rot] of [[GUARD_KEYS.barbelA, GUARD.barbel.root, -0.3], [GUARD_KEYS.barbelB, GUARD.barbel.rootB, 0.24]] as const) {
      const [bx, by] = local(root);
      const b = makeImg(scene, bx, by, key);
      b.setOrigin(0.5, 0.03);
      b.setRotation(rot);
      b.setData('baseRot', rot);
      this.barbels.push(b);
      this.rig.add(b);
    }
    this.tintables.push(body, this.scales, this.eyeHalf, this.eyeClosed, this.mouth, this.mouthOpen, ...this.barbels, ...this.fins);
    scene.add.existing(this);
  }

  private makeFin(
    x: number, y: number, rotation: number, scale: number,
    key: string = GUARD_KEYS.fin, origin: readonly [number, number] = [0.5, 0.97], alpha = FIN_ALPHA,
  ): Phaser.GameObjects.Image {
    const f = makeImg(this.scene, x, y, key);
    f.setOrigin(origin[0], origin[1]);
    f.setRotation(rotation);
    f.setScale(f.scaleX * scale);
    f.setData('baseScale', f.scaleX);
    f.setData('baseRot', rotation);
    f.setAlpha(alpha);
    this.fins.push(f);
    return f;
  }

  private setHaloSize(logicalPx: number): void {
    const s = (logicalPx / GUARD.halo.w) * (1 / 2);
    this.halo.setScale(s);
    this.halo.setData('baseScale', s);
  }

  // ---------- the far glow (mystery clue 1) ----------

  /** Only a faint breathing glow disc on the water, alpha 0.2-0.5 on a 3 s sine. */
  glowFarOut(on = true): void {
    this.haloTween?.stop();
    this.haloTween = undefined;
    this.farGlow = on;
    if (!on) {
      this.halo.setAlpha(this.risen ? 0.55 : 0);
      return;
    }
    this.setHaloSize(FAR_GLOW_LOGICAL);
    this.halo.y = 0;
    this.halo.setAlpha(0.2);
    if (isReduceMotion()) {
      this.halo.setAlpha(0.35);
      return;
    }
    this.haloTween = this.scene.tweens.add({ targets: this.halo, alpha: 0.5, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ---------- rise and sink ----------

  /** Rise slowly out of the water with sheeting; resolves when settled. */
  rise(duration = 2600): Promise<void> {
    if (this.farGlow) this.glowFarOut(false);
    this.stopIdle();
    this.scene.tweens.killTweensOf([this.rig, this.halo]);
    this.haloTween?.stop();
    const dur = isReduceMotion() ? Math.min(duration, 400) : duration;
    this.halo.y = RISEN_Y;
    this.setHaloSize(HALO_LOGICAL);
    this.startIdle();
    this.startSheeting(dur * 0.8);
    this.scene.tweens.add({ targets: this.rig, alpha: 1, duration: dur * 0.35, ease: 'Sine.easeOut' });
    this.scene.tweens.add({ targets: this.halo, alpha: 0.55, duration: dur, ease: 'Sine.easeInOut' });
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.rig,
        y: RISEN_Y,
        duration: dur,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.risen = true;
          this.startHaloBreath();
          resolve();
        },
      });
    });
  }

  /** Sink back below the water line. */
  sink(duration = 2600): Promise<void> {
    this.risen = false;
    this.scene.tweens.killTweensOf([this.rig, this.halo]);
    this.haloTween?.stop();
    this.stopBubbles();
    const dur = isReduceMotion() ? Math.min(duration, 400) : duration;
    this.scene.tweens.add({ targets: this.halo, alpha: 0, duration: dur * 0.8, ease: 'Sine.easeInOut' });
    this.scene.tweens.add({ targets: this.rig, alpha: 0, duration: dur, delay: dur * 0.4, ease: 'Sine.easeIn' });
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.rig,
        y: HIDDEN_Y,
        duration: dur,
        ease: 'Sine.easeIn',
        onComplete: () => {
          this.stopIdle();
          resolve();
        },
      });
    });
  }

  /** Lean toward a point (the dock) and settle back. */
  nuzzle(targetX: number): Promise<void> {
    const dir = targetX >= this.x ? 1 : -1;
    this.setFacing(dir);
    if (isReduceMotion()) return Promise.resolve();
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.flip,
        x: 28 * dir,
        rotation: 0.05 * dir,
        duration: 1000,
        yoyo: true,
        hold: 500,
        ease: 'Sine.easeInOut',
        onComplete: () => resolve(),
      });
    });
  }

  /** Mouth opens a little, a happy rumble, hearts. */
  eat(): Promise<void> {
    this.mouth.setVisible(false);
    this.mouthOpen.setVisible(true);
    this.onRumble?.();
    const s = Math.abs(this.scaleX);
    const [ex, ey] = local(GUARD.eye.at);
    heartsFloat(this.scene, this.x + this.facing * ex * s, this.y + (RISEN_Y + ey - 70) * s, 3);
    return new Promise((resolve) => this.scene.time.delayedCall(700, () => {
      this.mouth.setVisible(true);
      this.mouthOpen.setVisible(false);
      resolve();
    }));
  }

  setFacing(dir: 1 | -1): void {
    this.facing = dir;
    this.flip.setScale(dir, 1);
  }

  /** Multiply tint from the lighting (`charTint`), hex string or 0xRRGGBB. The halo is never tinted. */
  setTint(color: number | string): this {
    const c = typeof color === 'string' ? hexToInt(color) : color;
    for (const im of this.tintables) im.setTint(c);
    return this;
  }
  clearTint(): this {
    for (const im of this.tintables) im.clearTint();
    return this;
  }

  // ---------- idle loops ----------

  private startIdle(): void {
    this.stopIdle();
    const tw = this.scene.tweens;
    this.blinkTimer = this.scene.time.addEvent({ delay: BLINK_EVERY_MS, loop: true, callback: () => this.blink() });
    if (isReduceMotion()) {
      this.scales.setAlpha(0.65);
      return;
    }
    this.scales.setAlpha(0.4);
    this.idleTweens.push(tw.add({ targets: this.scales, alpha: 0.9, duration: PULSE_MS / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    this.barbels.forEach((b, i) => {
      const base = b.getData('baseRot') as number;
      this.idleTweens.push(tw.add({ targets: b, rotation: base + (i ? -0.16 : 0.18), duration: i ? 2050 : 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    });
    this.fins.forEach((f, i) => {
      const base = f.getData('baseRot') as number;
      this.idleTweens.push(tw.add({ targets: f, rotation: base + (i % 2 ? -0.06 : 0.06), duration: 1900 + i * 230, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    });
    this.idleTweens.push(tw.add({ targets: this.rig, scaleY: 1.012, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    this.bubbleTimer = this.scene.time.addEvent({ delay: 1500, loop: true, callback: () => this.bubble() });
  }

  private stopIdle(): void {
    for (const t of this.idleTweens) t.stop();
    this.idleTweens = [];
    this.blinkTimer?.remove(false);
    this.blinkTimer = undefined;
    this.stopBubbles();
    this.rig.setScale(1);
  }

  private stopBubbles(): void {
    this.bubbleTimer?.remove(false);
    this.bubbleTimer = undefined;
  }

  private startHaloBreath(): void {
    this.haloTween?.stop();
    if (isReduceMotion()) return;
    this.haloTween = this.scene.tweens.add({ targets: this.halo, alpha: 0.42, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private blink(): void {
    this.eyeHalf.setVisible(false);
    this.eyeClosed.setVisible(true);
    this.scene.time.delayedCall(BLINK_MS, () => {
      this.eyeHalf.setVisible(true);
      this.eyeClosed.setVisible(false);
    });
  }

  /** One bubble drifting up from the hump. */
  private bubble(): void {
    const [bx, by] = local(GUARD.anchors.bubbles);
    const b = makeImg(this.scene, bx + Phaser.Math.Between(-30, 30), by, GUARD_KEYS.bubble);
    b.setAlpha(0);
    this.rig.add(b);
    this.scene.tweens.add({ targets: b, alpha: 0.9, duration: 300, ease: 'Sine.easeOut' });
    this.scene.tweens.add({
      targets: b,
      y: by - 70,
      x: b.x + Phaser.Math.Between(-10, 10),
      duration: 1700,
      ease: 'Sine.easeInOut',
      onComplete: () => b.destroy(),
    });
    this.scene.tweens.add({ targets: b, alpha: 0, delay: 1200, duration: 500, ease: 'Sine.easeIn' });
  }

  /** Cream ellipses sheeting off the body at the water line while she rises. */
  private startSheeting(forMs: number): void {
    this.sheetTimer?.remove(false);
    if (isReduceMotion()) return;
    const halfW = 380;
    let elapsed = 0;
    this.sheetTimer = this.scene.time.addEvent({
      delay: 140,
      loop: true,
      callback: () => {
        elapsed += 140;
        if (elapsed > forMs) {
          this.sheetTimer?.remove(false);
          this.sheetTimer = undefined;
          return;
        }
        for (let i = 0; i < 2; i++) {
          const s = makeImg(this.scene, Phaser.Math.Between(-halfW, halfW), 0, GUARD_KEYS.sheet);
          s.setAlpha(0.7);
          this.flip.add(s);
          this.scene.tweens.add({
            targets: s,
            y: Phaser.Math.Between(14, 28),
            alpha: 0,
            scaleX: s.scaleX * 1.4,
            duration: 650,
            ease: 'Sine.easeOut',
            onComplete: () => s.destroy(),
          });
        }
      },
    });
  }

  destroy(fromScene?: boolean): void {
    this.stopIdle();
    this.sheetTimer?.remove(false);
    this.haloTween?.stop();
    super.destroy(fromScene);
  }
}
