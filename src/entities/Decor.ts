/**
 * Decor: a placed decor item in the world. A Container anchored at its snap point: hanging items hang DOWN from the
 * point (origin at the hook), ground items stand UP from it (origin at the feet), the hammock is centered on its
 * two-tree point. Idle animation per data behavior (nod / sway / flutter / tinkle / warm / twinkle / glow), gusts
 * via gust(), lighting via setLighting(L). Everything placed animates (spec section 5), unless Reduce motion is on.
 */
import Phaser from 'phaser';
import type { DecorDef, DecorId } from '@/data/types';
import { DECOR_BY_ID } from '@/data/decor';
import { DECOR_KEYS, DECOR_SIZES, paintDecorTextures } from '@/art/decor';
import { makeImg } from '@/art/pipeline';
import { PALETTE, hexToInt, mix } from '@/config/palette';
import type { Lighting } from '@/world/lighting';
import type { XY } from '@/world/layout';
import { isReduceMotion } from '@/fx/juice';
import { audio } from '@/audio';

export type DecorPointKind = 'hang' | 'ground' | 'two_tree';
/** A snap point in world coordinates. Fairy lights also get `span`: the second hang point they stretch to. */
export type DecorPoint = { id: string; x: number; y: number; kind: DecorPointKind; span?: XY };

/** Motion tuning for the idle animations. */
export const DECOR_MOTION = {
  nod: { rot: 0.07, ms: 1900 },
  sway: { rot: 0.045, ms: 2300, gustRot: 0.2, gustMs: 700 },
  flutter: { rot: 0.14, ms: 900, gustRot: 0.5 },
  tinkle: { rot: 0.025, ms: 1500, gustRot: 0.22, gustMs: 420 },
  twinkle: { lo: 0.45, ms: 700 },
  hammock: { rot: 0.02, ms: 3200 },
  glow: { dayAlpha: 0, nightAlpha: 0.55, guardianAlpha: 0.6, pulseMs: 2600, fadeMs: 900 },
  /** the rug warms toward butter once warmth passes this */
  warmFrom: 0.5,
  warmAmount: 0.55,
  nightBelowAmbient: 0.55,
  /** hammock rope attach points relative to the two-tree point */
  hammockRopes: { dx: 172, dy: -36 },
} as const;

type Img = Phaser.GameObjects.Image;

export class Decor extends Phaser.GameObjects.Container {
  readonly id: DecorId;
  readonly def: DecorDef;
  readonly point: DecorPoint;
  /** hit rect in world coordinates (for taps in decor mode) */
  private rect = { x: 0, y: 0, w: 40, h: 40 };
  private tintables: Img[] = [];
  private glows: Img[] = [];
  private rugImg: Img | null = null;
  private pendulum: Phaser.GameObjects.Container | null = null;
  private tubes: Img[] = [];
  private leaves: Img[] = [];
  private bulbs: Img[] = [];
  private twinkles: Phaser.Tweens.Tween[] = [];
  private night = false;
  private lastTint = '';
  private seat: XY | null = null;

  constructor(scene: Phaser.Scene, id: DecorId, point: DecorPoint) {
    super(scene, point.x, point.y);
    paintDecorTextures(scene);
    this.id = id;
    this.def = DECOR_BY_ID[id];
    this.point = point;
    this.build();
    this.setLit(false, 0);
  }

  // ---------- public ----------
  /** Where the hero sits/naps for this item (cushion, bookshelf, hammock), or null. */
  sitPoint(): XY | null { return this.seat; }

  /** World-space hit rectangle (x, y = top-left). */
  hitRect(): { x: number; y: number; w: number; h: number } { return this.rect; }

  /** A gust of wind: lanterns swing harder, leaves flutter, chimes tinkle (with sfx). */
  gust(strength = 1): void {
    if (isReduceMotion()) return;
    const M = DECOR_MOTION;
    if (this.pendulum) {
      const p = this.pendulum;
      this.scene.tweens.killTweensOf(p);
      this.scene.tweens.chain({
        targets: p,
        tweens: [
          { rotation: M.sway.gustRot * strength, duration: M.sway.gustMs * 0.5, ease: 'Sine.easeOut' },
          { rotation: -M.sway.gustRot * 0.6 * strength, duration: M.sway.gustMs * 0.6, ease: 'Sine.easeInOut' },
          { rotation: 0, duration: M.sway.gustMs, ease: 'Sine.easeInOut' },
        ],
        onComplete: () => this.idleSway(),
      });
    }
    if (this.leaves.length) {
      this.leaves.forEach((l, i) => {
        this.scene.tweens.killTweensOf(l);
        this.scene.tweens.add({
          targets: l, rotation: M.flutter.gustRot * strength * (i % 2 ? 1 : 0.8), duration: 260 + i * 40, yoyo: true, repeat: 1,
          ease: 'Sine.easeInOut', onComplete: () => this.idleFlutter(l, i),
        });
      });
    }
    if (this.tubes.length) {
      audio.sfx.play('windChime');
      this.tubes.forEach((t, i) => {
        this.scene.tweens.killTweensOf(t);
        this.scene.tweens.add({
          targets: t, rotation: (i % 2 ? 1 : -1) * M.tinkle.gustRot * strength, duration: M.tinkle.gustMs, yoyo: true, repeat: 2,
          delay: i * 60, ease: 'Sine.easeInOut', onComplete: () => this.idleTube(t, i),
        });
      });
    }
  }

  /** Lighting from the clock: night state, warmth (rug), multiply tint for the painted parts. */
  setLighting(L: Lighting): void {
    const night = L.ambient < DECOR_MOTION.nightBelowAmbient || L.moon > L.sun;
    if (night !== this.night) this.setNight(night);
    if (L.charTint !== this.lastTint) {
      this.lastTint = L.charTint;
      const t = hexToInt(L.charTint);
      for (const im of this.tintables) im.setTint(t);
    }
    if (this.rugImg) {
      const k = Math.max(0, (L.warmth - DECOR_MOTION.warmFrom) / (1 - DECOR_MOTION.warmFrom)) * DECOR_MOTION.warmAmount;
      this.rugImg.setTint(hexToInt(mix(L.charTint, PALETTE.butter, k)));
    }
  }

  setNight(night: boolean): void {
    this.night = night;
    this.setLit(night, isReduceMotion() ? 0 : DECOR_MOTION.glow.fadeMs);
  }

  // ---------- build ----------
  private build(): void {
    const S = DECOR_SIZES, K = DECOR_KEYS, sc = this.scene;
    const im = (x: number, y: number, key: string, tint = true): Img => {
      const i = makeImg(sc, x, y, key);
      if (tint) this.tintables.push(i);
      return i;
    };
    const ground = (w: number, h: number) => { this.rect = { x: this.x - w / 2, y: this.y - h, w, h }; };
    const hang = (w: number, h: number) => { this.rect = { x: this.x - w / 2, y: this.y, w, h }; };

    switch (this.id) {
      case 'flower': {
        const pot = im(0, -S.flowerPot.h / 2, K.flowerPot);
        const bloom = im(0, -S.flowerPot.h + 6, K.flowerBloom).setOrigin(0.5, 1);
        this.add([bloom, pot]);
        ground(S.flowerPot.w, S.flowerPot.h + S.flowerBloom.h - 6);
        if (!isReduceMotion()) sc.tweens.add({ targets: bloom, rotation: { from: -DECOR_MOTION.nod.rot, to: DECOR_MOTION.nod.rot }, duration: DECOR_MOTION.nod.ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        break;
      }
      case 'lantern':
      case 'guardian_lantern': {
        const guardian = this.id === 'guardian_lantern';
        const p = sc.add.container(0, 0);
        const cord = im(0, S.lanternCord.h / 2, K.lanternCord);
        const bodyKey = guardian ? K.guardianBody : K.lanternBody;
        const bodyH = guardian ? S.guardianBody.h : S.lanternBody.h;
        const body = im(0, S.lanternCord.h + bodyH / 2 - 2, bodyKey);
        const glow = makeImg(sc, 0, S.lanternCord.h + bodyH / 2, guardian ? K.guardianHalo : K.glowPool).setBlendMode(Phaser.BlendModes.ADD);
        const pool = makeImg(sc, 0, S.lanternCord.h + bodyH + 10, K.glowPool).setBlendMode(Phaser.BlendModes.ADD);
        pool.setScale((pool.getData('baseScale') as number) * (guardian ? 0.8 : 1.1), (pool.getData('baseScale') as number) * 0.5);
        this.glows.push(glow, pool);
        p.add([glow, pool, cord, body]);
        this.pendulum = p;
        this.add(p);
        hang(S.lanternBody.w, S.lanternCord.h + bodyH);
        this.idleSway();
        break;
      }
      case 'cushion': {
        this.add(im(0, -S.cushion.h / 2 + 2, K.cushion));
        ground(S.cushion.w, S.cushion.h);
        this.seat = { x: this.x, y: this.y };
        break;
      }
      case 'bunting': {
        const n = S.buntingLeaves, span = S.buntingSpan;
        const g = sc.add.graphics();
        g.lineStyle(2.5, hexToInt(PALETTE.bark), 1);
        g.beginPath();
        g.moveTo(-span / 2, 0);
        for (let i = 1; i <= 12; i++) { const t = i / 12; g.lineTo(-span / 2 + span * t, Math.sin(t * Math.PI) * 10); }
        g.strokePath();
        this.add(g);
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          const leaf = im(-span / 2 + span * t, Math.sin(t * Math.PI) * 10, K.buntingLeaf(i % 3)).setOrigin(0.5, 0);
          this.leaves.push(leaf);
          this.add(leaf);
          this.idleFlutter(leaf, i);
        }
        hang(span, 10 + S.buntingLeaf.h);
        break;
      }
      case 'chime': {
        const top = im(0, S.chimeTop.h / 2 + 2, K.chimeTop);
        this.add(top);
        for (let i = 0; i < S.chimeTubes; i++) {
          const x = -14 + i * 9.5;
          const tube = im(x, S.chimeTop.h + 2, K.chimeTube(i)).setOrigin(0.5, 0);
          this.tubes.push(tube);
          this.add(tube);
          this.idleTube(tube, i);
        }
        hang(S.chimeTop.w, S.chimeTop.h + S.chimeTube.h + 4);
        break;
      }
      case 'rug': {
        const r = im(0, -S.rug.h / 2 + 4, K.rug);
        this.tintables.pop();
        this.rugImg = r;
        this.add(r);
        ground(S.rug.w, S.rug.h);
        break;
      }
      case 'lights': {
        const span = this.point.span ?? { x: this.x + 90, y: this.y };
        const dx = span.x - this.x, dy = span.y - this.y;
        const sag = Math.min(34, Math.hypot(dx, dy) * 0.22);
        const g = sc.add.graphics();
        g.lineStyle(2, hexToInt(PALETTE.bark), 1);
        g.beginPath();
        g.moveTo(0, 0);
        const at = (t: number) => ({ x: dx * t, y: dy * t + Math.sin(t * Math.PI) * sag });
        for (let i = 1; i <= 16; i++) { const p = at(i / 16); g.lineTo(p.x, p.y); }
        g.strokePath();
        this.add(g);
        for (let i = 0; i < S.lightsBulbs; i++) {
          const p = at((i + 0.5) / S.lightsBulbs);
          const b = makeImg(sc, p.x, p.y, K.lightsBulb).setOrigin(0.5, 0.1);
          const halo = makeImg(sc, p.x, p.y + 8, K.glowPool).setBlendMode(Phaser.BlendModes.ADD);
          halo.setScale((halo.getData('baseScale') as number) * 0.28);
          this.glows.push(halo);
          this.bulbs.push(b);
          this.add([halo, b]);
        }
        this.rect = { x: Math.min(0, dx) + this.x, y: Math.min(0, dy) + this.y - 4, w: Math.abs(dx) + 12, h: Math.abs(dy) + sag + S.lightsBulb.h };
        break;
      }
      case 'bookshelf': {
        this.add(im(0, -S.bookshelf.h / 2 + 2, K.bookshelf));
        ground(S.bookshelf.w, S.bookshelf.h);
        this.seat = { x: this.x + S.bookshelf.w / 2 + 14, y: this.y };
        break;
      }
      case 'hammock': {
        const R = DECOR_MOTION.hammockRopes, half = S.hammockSling.w / 2 - 4;
        const g = sc.add.graphics();
        g.lineStyle(3, hexToInt(PALETTE.bark), 1);
        g.lineBetween(-half, 0, -R.dx, R.dy);
        g.lineBetween(half, 0, R.dx, R.dy);
        this.add(g);
        const sling = im(0, S.hammockSling.h / 2 - 4, K.hammockSling);
        this.add(sling);
        this.rect = { x: this.x - S.hammockSling.w / 2, y: this.y - 10, w: S.hammockSling.w, h: S.hammockSling.h + 20 };
        this.seat = { x: this.x, y: this.y };
        if (!isReduceMotion()) sc.tweens.add({ targets: sling, rotation: { from: -DECOR_MOTION.hammock.rot, to: DECOR_MOTION.hammock.rot }, duration: DECOR_MOTION.hammock.ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        break;
      }
      case 'telescope': {
        const tripod = im(0, -S.telescopeTripod.h / 2 + 2, K.telescopeTripod);
        const tube = im(4, -S.telescopeTripod.h + 8, K.telescopeTube).setRotation(-0.55);
        this.add([tripod, tube]);
        ground(S.telescopeTripod.w + 10, S.telescopeTripod.h + 20);
        break;
      }
    }
  }

  // ---------- idle loops ----------
  private idleSway(): void {
    if (!this.pendulum || isReduceMotion()) return;
    const M = DECOR_MOTION.sway;
    this.pendulum.setRotation(-M.rot);
    this.scene.tweens.add({ targets: this.pendulum, rotation: M.rot, duration: M.ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  private idleFlutter(leaf: Img, i: number): void {
    if (isReduceMotion()) return;
    const M = DECOR_MOTION.flutter;
    leaf.setRotation(-M.rot * 0.5);
    this.scene.tweens.add({ targets: leaf, rotation: M.rot * 0.5, duration: M.ms + i * 70, delay: i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  private idleTube(tube: Img, i: number): void {
    if (isReduceMotion()) return;
    const M = DECOR_MOTION.tinkle;
    tube.setRotation(-M.rot);
    this.scene.tweens.add({ targets: tube, rotation: M.rot, duration: M.ms + i * 110, delay: i * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Night look: glow pools fade in, bulbs twinkle, lantern bodies brighten. The Guardian Lantern never goes out. */
  private setLit(night: boolean, fadeMs: number): void {
    const G = DECOR_MOTION.glow;
    const target = this.def.neverGoesOut ? G.guardianAlpha : night ? G.nightAlpha : G.dayAlpha;
    for (const g of this.glows) {
      this.scene.tweens.killTweensOf(g);
      if (fadeMs <= 0) g.setAlpha(target);
      else this.scene.tweens.add({ targets: g, alpha: target, duration: fadeMs, ease: 'Sine.easeInOut' });
    }
    if (this.def.neverGoesOut && !isReduceMotion() && this.glows[0]) {
      const halo = this.glows[0];
      const b = halo.getData('baseScale') as number;
      this.scene.tweens.add({ targets: halo, scale: { from: b, to: b * 1.12 }, duration: G.pulseMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // bulbs
    for (const t of this.twinkles) t.stop();
    this.twinkles = [];
    this.bulbs.forEach((b, i) => {
      this.scene.tweens.killTweensOf(b);
      if (!night) { b.setAlpha(0.75); return; }
      b.setAlpha(1);
      if (isReduceMotion()) return;
      this.twinkles.push(this.scene.tweens.add({
        targets: b, alpha: DECOR_MOTION.twinkle.lo, duration: DECOR_MOTION.twinkle.ms + (i % 3) * 160, delay: (i * 137) % 600,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      }));
    });
  }
}
