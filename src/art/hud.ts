/**
 * hud.ts: HUD-only art. The Contentment paper lantern (body + a glow that grows with the tier), the Contentment
 * bloom (a flower whose petals open with the day's peak), and the title logo glow. All painted once at 2x.
 */
import Phaser from 'phaser';
import { PALETTE, ACCENTS, shade, mix, alpha } from '@/config/palette';
import {
  paintTexture, makeImg, ellipsePath, roundRectPath, fillOutlined, softGlow, sheen, radialGradient, type Ctx,
} from '@/art/pipeline';
import type { ContentmentTier } from '@/data/types';

export const HUD_TEX = {
  lanternBody: 'hud-lantern-body',
  lanternGlow: 'hud-lantern-glow',
  bloomPetal: 'hud-bloom-petal',
  bloomCenter: 'hud-bloom-center',
  bloomLeaf: 'hud-bloom-leaf',
  bloomStem: 'hud-bloom-stem',
  titleGlow: 'title-glow',
} as const;

export const LANTERN = {
  w: 44,
  h: 60,
  glowSize: 160,
  /** glow scale per tier (relative to the painted glow texture) */
  glowScale: { cozy: 0.45, content: 0.7, glowing: 0.95, blissful: 1.2 } as Record<ContentmentTier, number>,
  glowAlpha: { cozy: 0.35, content: 0.55, glowing: 0.75, blissful: 0.95 } as Record<ContentmentTier, number>,
  pulseMs: 2600,
} as const;

export const BLOOM = {
  petals: 8,
  petalW: 34,
  petalH: 78,
  center: 34,
  leaf: { w: 44, h: 22 },
  stem: { w: 8, h: 90 },
  /** petal angle (deg from the stem axis) when closed / fully open */
  closedDeg: 6,
  openDeg: 82,
  openMs: 1400,
} as const;

export function paintHudTextures(scene: Phaser.Scene): void {
  const P = PALETTE;
  // Paper lantern: a rounded red-earth paper body with ribs, bark caps and a little hanging loop.
  paintTexture(scene, HUD_TEX.lanternBody, LANTERN.w, LANTERN.h, (ctx: Ctx, w, h) => {
    const cx = w / 2;
    const paper = mix(ACCENTS.laterite, P.peach, 0.35);
    // loop
    ctx.strokeStyle = shade(P.bark, -0.1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, 6, 4, 0, Math.PI * 2);
    ctx.stroke();
    // top cap
    roundRectPath(ctx, cx - 10, 8, 20, 6, 2);
    fillOutlined(ctx, P.bark, 2);
    // body
    ellipsePath(ctx, cx, h / 2 + 2, w / 2 - 3, h / 2 - 14);
    fillOutlined(ctx, paper, 2.5);
    // ribs
    ctx.strokeStyle = alpha(shade(paper, -0.25), 0.6);
    ctx.lineWidth = 1.5;
    for (const k of [-0.55, -0.2, 0.2, 0.55]) {
      ctx.beginPath();
      ellipsePath(ctx, cx + k * (w / 2 - 3), h / 2 + 2, 3, h / 2 - 14);
      ctx.stroke();
    }
    // inner warmth
    softGlow(ctx, cx, h / 2 + 4, 14, P.glow, 0.7);
    sheen(ctx, cx - 7, h / 2 - 10, 5, 9, P.cream, 0.4);
    // bottom cap + tassel
    roundRectPath(ctx, cx - 8, h - 14, 16, 5, 2);
    fillOutlined(ctx, P.bark, 2);
    ctx.strokeStyle = ACCENTS.marigold;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, h - 9);
    ctx.lineTo(cx, h - 2);
    ctx.stroke();
  });
  paintTexture(scene, HUD_TEX.lanternGlow, LANTERN.glowSize, LANTERN.glowSize, (ctx: Ctx, w, h) => {
    ctx.fillStyle = radialGradient(ctx, w / 2, h / 2, 0, w / 2, [
      [0, alpha(P.glow, 0.9)],
      [0.35, alpha(P.glow, 0.45)],
      [1, alpha(P.glow, 0)],
    ]);
    ctx.fillRect(0, 0, w, h);
  });
  // Bloom parts: a rose petal (origin at the bottom), a marigold center, a sage leaf, a moss stem.
  paintTexture(scene, HUD_TEX.bloomPetal, BLOOM.petalW, BLOOM.petalH, (ctx: Ctx, w, h) => {
    const cx = w / 2;
    ctx.beginPath();
    ctx.moveTo(cx, h - 3);
    ctx.bezierCurveTo(cx - w * 0.75, h * 0.62, cx - w * 0.55, h * 0.05, cx, 3);
    ctx.bezierCurveTo(cx + w * 0.55, h * 0.05, cx + w * 0.75, h * 0.62, cx, h - 3);
    ctx.closePath();
    fillOutlined(ctx, P.rose, 2.5);
    ctx.beginPath();
    ctx.moveTo(cx, h - 10);
    ctx.bezierCurveTo(cx - w * 0.3, h * 0.6, cx - w * 0.22, h * 0.25, cx, h * 0.14);
    ctx.bezierCurveTo(cx + w * 0.22, h * 0.25, cx + w * 0.3, h * 0.6, cx, h - 10);
    ctx.fillStyle = alpha(mix(P.rose, P.cream, 0.5), 0.75);
    ctx.fill();
  });
  paintTexture(scene, HUD_TEX.bloomCenter, BLOOM.center, BLOOM.center, (ctx: Ctx, w, h) => {
    ellipsePath(ctx, w / 2, h / 2, w / 2 - 2, h / 2 - 2);
    fillOutlined(ctx, ACCENTS.marigold, 2.5);
    ctx.fillStyle = alpha(shade(ACCENTS.marigold, -0.3), 0.6);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(w / 2 + Math.cos(a) * 7, h / 2 + Math.sin(a) * 7, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    sheen(ctx, w / 2 - 5, h / 2 - 6, 4, 3, P.cream, 0.5);
  });
  paintTexture(scene, HUD_TEX.bloomLeaf, BLOOM.leaf.w, BLOOM.leaf.h, (ctx: Ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(2, h / 2);
    ctx.quadraticCurveTo(w * 0.5, -h * 0.3, w - 2, h / 2);
    ctx.quadraticCurveTo(w * 0.5, h * 1.3, 2, h / 2);
    ctx.closePath();
    fillOutlined(ctx, P.sage, 2.5);
    ctx.strokeStyle = alpha(P.moss, 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(4, h / 2);
    ctx.lineTo(w - 6, h / 2);
    ctx.stroke();
  });
  paintTexture(scene, HUD_TEX.bloomStem, BLOOM.stem.w, BLOOM.stem.h, (ctx: Ctx, w, h) => {
    roundRectPath(ctx, 1, 1, w - 2, h - 2, w / 2);
    fillOutlined(ctx, P.moss, 2);
  });
  paintTexture(scene, HUD_TEX.titleGlow, 320, 140, (ctx: Ctx, w, h) => {
    ctx.save();
    ctx.scale(1, h / w);
    ctx.fillStyle = radialGradient(ctx, w / 2, (h / 2) * (w / h), 0, w / 2, [
      [0, alpha(P.glow, 0.85)],
      [0.5, alpha(P.glow, 0.35)],
      [1, alpha(P.glow, 0)],
    ]);
    ctx.fillRect(0, 0, w, w);
    ctx.restore();
  });
}

/** The Contentment lantern: body + additive glow. Call setTier() to grow the glow. */
export class Lantern extends Phaser.GameObjects.Container {
  readonly glow: Phaser.GameObjects.Image;
  readonly paper: Phaser.GameObjects.Image;
  private pulse?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    paintHudTextures(scene);
    this.glow = makeImg(scene, 0, 4, HUD_TEX.lanternGlow).setBlendMode(Phaser.BlendModes.ADD);
    this.paper = makeImg(scene, 0, 0, HUD_TEX.lanternBody);
    this.add([this.glow, this.paper]);
    this.setSize(LANTERN.w + 12, LANTERN.h + 8);
    this.setData('baseScale', 1);
    scene.add.existing(this);
  }

  setTier(tier: ContentmentTier, animate = true): this {
    const base = this.glow.getData('baseScale') as number;
    const target = base * LANTERN.glowScale[tier];
    const a = LANTERN.glowAlpha[tier];
    this.pulse?.stop();
    if (!animate) {
      this.glow.setScale(target).setAlpha(a);
    } else {
      this.scene.tweens.add({ targets: this.glow, scale: target, alpha: a, duration: 600, ease: 'Sine.easeInOut' });
    }
    this.pulse = this.scene.tweens.add({
      targets: this.glow, scale: target * 1.08, alpha: a * 0.85, duration: LANTERN.pulseMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 600,
    });
    return this;
  }
}

/** The Contentment bloom: petals open from closed to a fraction of fully open. */
export class Bloom extends Phaser.GameObjects.Container {
  private readonly petals: Phaser.GameObjects.Image[] = [];
  private readonly centerImg: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    paintHudTextures(scene);
    const stem = makeImg(scene, 0, BLOOM.stem.h / 2 - 8, HUD_TEX.bloomStem);
    const leafL = makeImg(scene, -BLOOM.leaf.w / 2 + 2, BLOOM.stem.h * 0.55, HUD_TEX.bloomLeaf).setAngle(-20);
    const leafR = makeImg(scene, BLOOM.leaf.w / 2 - 2, BLOOM.stem.h * 0.7, HUD_TEX.bloomLeaf).setAngle(20).setFlipX(true);
    this.add([stem, leafL, leafR]);
    for (let i = 0; i < BLOOM.petals; i++) {
      const p = makeImg(scene, 0, 0, HUD_TEX.bloomPetal).setOrigin(0.5, 1);
      p.setData('dir', (i / (BLOOM.petals - 1)) * 2 - 1);
      this.petals.push(p);
      this.add(p);
    }
    this.centerImg = makeImg(scene, 0, 0, HUD_TEX.bloomCenter);
    this.add(this.centerImg);
    this.setOpen(0, false);
    this.setData('baseScale', 1);
    scene.add.existing(this);
  }

  /** k in 0..1: how far the petals open. */
  setOpen(k: number, animate = true): this {
    const open = Phaser.Math.Clamp(k, 0, 1);
    const spread = BLOOM.closedDeg + (BLOOM.openDeg - BLOOM.closedDeg) * open;
    const scaleY = 0.7 + 0.3 * open;
    const base = this.centerImg.getData('baseScale') as number;
    const centerScale = base * (0.5 + 0.5 * open);
    const dur = animate ? BLOOM.openMs : 0;
    this.petals.forEach((p, i) => {
      // petals fan out symmetrically around the vertical axis; closed petals hug the center
      const angle = (p.getData('dir') as number) * spread;
      const pb = p.getData('baseScale') as number;
      if (dur === 0) p.setAngle(angle).setScale(pb, pb * scaleY);
      else this.scene.tweens.add({ targets: p, angle, scaleY: pb * scaleY, duration: dur, delay: i * 40, ease: 'Back.easeOut' });
    });
    if (dur === 0) this.centerImg.setScale(centerScale);
    else this.scene.tweens.add({ targets: this.centerImg, scale: centerScale, duration: dur, ease: 'Back.easeOut' });
    return this;
  }
}
