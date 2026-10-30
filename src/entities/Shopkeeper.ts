/**
 * Doddamma, the shopkeeper rig: a bust behind the counter. Origin at the counter line (x center, y counter top).
 * Idle: slow chew (jaw 2 px on a 1.6 s sine), blink every 4 s, breathing. nod() on a buy, earsUp() in rain.
 */
import Phaser from 'phaser';
import { SHOP, SHOP_KEYS, paintShopkeeperTextures } from '@/art/shopkeeper';
import { makeImg } from '@/art/pipeline';
import { hexToInt } from '@/config/palette';
import { breathe, isReduceMotion } from '@/fx/juice';

const CHEW_PX = 2;
const CHEW_MS = 1600;
const BLINK_EVERY_MS = 4000;
const BLINK_MS = 140;
const EAR_UP_RAD = 0.55;

export class Shopkeeper extends Phaser.GameObjects.Container {
  private readonly head: Phaser.GameObjects.Container;
  private readonly jaw: Phaser.GameObjects.Image;
  private readonly eyesOpen: Phaser.GameObjects.Image;
  private readonly eyesClosed: Phaser.GameObjects.Image;
  private readonly earL: Phaser.GameObjects.Image;
  private readonly earR: Phaser.GameObjects.Image;
  private readonly tintables: Phaser.GameObjects.Image[] = [];
  private blinkTimer?: Phaser.Time.TimerEvent;
  private chewTween?: Phaser.Tweens.Tween;
  private earsAreUp = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    paintShopkeeperTextures(scene);
    this.setData('baseScale', 1);
    const L = SHOP.layout;

    // head group: everything that nods together (horns, ears, face)
    this.head = scene.make.container({ x: 0, y: 0, add: false });
    const hornL = makeImg(scene, L.hornL[0], L.hornL[1], SHOP_KEYS.horn);
    const hornR = makeImg(scene, L.hornR[0], L.hornR[1], SHOP_KEYS.horn);
    const hornOrigin = [SHOP.horn.base[0] / SHOP.horn.w, SHOP.horn.base[1] / SHOP.horn.h] as const;
    hornL.setOrigin(hornOrigin[0], hornOrigin[1]);
    hornR.setOrigin(hornOrigin[0], hornOrigin[1]);
    hornR.setScale(-hornR.scaleX, hornR.scaleY);
    const jasmine = makeImg(scene, L.jasmine[0], L.jasmine[1], SHOP_KEYS.jasmine);
    jasmine.setRotation(-0.55);
    this.earL = makeImg(scene, L.earL[0], L.earL[1], SHOP_KEYS.ear);
    this.earR = makeImg(scene, L.earR[0], L.earR[1], SHOP_KEYS.ear);
    this.earL.setOrigin(0.92, 0.5);
    this.earR.setOrigin(0.92, 0.5);
    this.earR.setScale(-this.earR.scaleX, this.earR.scaleY);
    const face = makeImg(scene, L.head[0], L.head[1], SHOP_KEYS.head);
    this.eyesOpen = makeImg(scene, L.head[0], L.head[1], SHOP_KEYS.eyesOpen);
    this.eyesClosed = makeImg(scene, L.head[0], L.head[1], SHOP_KEYS.eyesClosed);
    this.eyesClosed.setVisible(false);
    const muzzle = makeImg(scene, L.muzzle[0], L.muzzle[1], SHOP_KEYS.muzzle);
    this.jaw = makeImg(scene, L.jaw[0], L.jaw[1], SHOP_KEYS.jaw);
    const specs = makeImg(scene, L.specs[0], L.specs[1], SHOP_KEYS.specs);
    this.head.add([hornL, hornR, jasmine, this.earL, this.earR, face, this.eyesOpen, this.eyesClosed, this.jaw, muzzle, specs]);

    const shoulders = makeImg(scene, L.shoulders[0], L.shoulders[1], SHOP_KEYS.shoulders);
    shoulders.setOrigin(0.5, 0.5);
    this.add([shoulders, this.head]);
    this.tintables.push(hornL, hornR, jasmine, this.earL, this.earR, face, muzzle, this.jaw, specs, shoulders);

    // idle
    this.startChew();
    breathe(scene, shoulders, 3200, 0.015);
    this.blinkTimer = scene.time.addEvent({ delay: BLINK_EVERY_MS, loop: true, callback: () => void this.blink() });
    scene.add.existing(this);
  }

  private startChew(): void {
    this.chewTween?.stop();
    const baseY = SHOP.layout.jaw[1];
    this.jaw.y = baseY;
    if (isReduceMotion()) return;
    this.chewTween = this.scene.tweens.add({ targets: this.jaw, y: baseY + CHEW_PX, duration: CHEW_MS / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** One slow blink. */
  blink(): Promise<void> {
    this.eyesOpen.setVisible(false);
    this.eyesClosed.setVisible(true);
    return new Promise((r) => this.scene.time.delayedCall(BLINK_MS, () => {
      this.eyesOpen.setVisible(true);
      this.eyesClosed.setVisible(false);
      r();
    }));
  }

  /** A grandmotherly nod (on a buy). */
  nod(): Promise<void> {
    this.scene.tweens.killTweensOf(this.head);
    this.head.y = 0;
    if (isReduceMotion()) return Promise.resolve();
    return new Promise((resolve) => {
      this.scene.tweens.chain({
        targets: this.head,
        tweens: [
          { y: 10, rotation: 0.02, duration: 220, ease: 'Sine.easeInOut' },
          { y: 0, rotation: 0, duration: 320, ease: 'Back.easeOut' },
        ],
        onComplete: () => resolve(),
      });
    });
  }

  /** Ears prick up when it rains. */
  earsUp(up: boolean): void {
    if (up === this.earsAreUp) return;
    this.earsAreUp = up;
    const rot = up ? EAR_UP_RAD : 0;
    this.scene.tweens.killTweensOf([this.earL, this.earR]);
    const ease = up ? 'Back.easeOut' : 'Sine.easeInOut';
    this.scene.tweens.add({ targets: this.earL, rotation: rot, duration: 320, ease });
    this.scene.tweens.add({ targets: this.earR, rotation: -rot, duration: 320, ease });
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

  destroy(fromScene?: boolean): void {
    this.blinkTimer?.remove(false);
    this.chewTween?.stop();
    super.destroy(fromScene);
  }
}
