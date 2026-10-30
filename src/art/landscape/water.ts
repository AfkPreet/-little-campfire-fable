/**
 * Water: the reservoir surface band (a 4x256 gradient repainted with the lighting: reservoir multiplied by the water
 * tint, blended toward the mirrored sky), a seamless horizontal ripple tile, the sun/moon path, and lily pads.
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { ellipsePath, linearGradient, paintTexture, radialGradient, repaintTexture, type Ctx } from '@/art/pipeline';
import type { Lighting } from '@/world/lighting';
import { mul, seeded, wrapped } from './common';

export const WATER_KEYS = {
  base: 'water-base',
  ripple: 'water-ripple',
  path: 'water-path',
  lily: ['water-lily-a', 'water-lily-b', 'water-lily-c'],
  ring: 'water-ring',
} as const;
export const WATER_SIZES = {
  base: { w: 4, h: 256 },
  ripple: { w: 512, h: 256 },
  path: { w: 180, h: 240 },
  lily: { w: 44, h: 18 },
} as const;

function paintBase(L: Lighting) {
  return (ctx: Ctx, w: number, h: number): void => {
    const water = mul(ACCENTS.reservoir, L.waterTint);
    // top of the band mirrors the horizon; the near shore is deeper and cooler
    const far = mix(water, L.skyHorizon, 0.5);
    const midTone = mix(water, mix(L.skyHorizon, L.skyTop, 0.4), 0.3);
    const near = shade(mix(water, L.skyTop, 0.18), -0.08);
    ctx.fillStyle = linearGradient(ctx, 0, 0, 0, h, [
      [0, far],
      [0.35, midTone],
      [1, near],
    ]);
    ctx.fillRect(0, 0, w, h);
  };
}

/** Paints or repaints the water base gradient for a lighting. */
export function paintWaterBase(scene: Phaser.Scene, L: Lighting, key: string = WATER_KEYS.base): string {
  const { w, h } = WATER_SIZES.base;
  if (scene.textures.exists(key)) repaintTexture(scene, key, paintBase(L));
  else paintTexture(scene, key, w, h, paintBase(L));
  return key;
}

/** Ripple: elongated soft glints, tighter near the top (horizon) and wider lower down; cream and deeper reservoir. */
function paintRipple(ctx: Ctx, w: number, h: number): void {
  const rnd = seeded(131);
  wrapped(ctx, w, h, () => {
    for (let i = 0; i < 150; i++) {
      const t = Math.pow(rnd(), 0.8); // more rows near the horizon
      const y = t * h;
      const len = 14 + t * 60 + rnd() * 30;
      const th = 0.8 + t * 1.8;
      const x = rnd() * w;
      const light = rnd() < 0.62;
      const c = light ? PALETTE.cream : shade(ACCENTS.reservoir, -0.25);
      ctx.fillStyle = radialGradient(ctx, 0, 0, 0, 1, [
        [0, alpha(c, light ? 0.32 : 0.22)],
        [1, alpha(c, 0)],
      ]);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(len, th);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}

/** Sun/moon path: a column of soft horizontal glints, brightest near the top, fading down. Cream, tinted later. */
function paintPath(ctx: Ctx, w: number, h: number): void {
  const rnd = seeded(17);
  const cx = w / 2;
  ctx.fillStyle = linearGradient(ctx, 0, 0, 0, h, [
    [0, alpha(PALETTE.cream, 0.35)],
    [0.5, alpha(PALETTE.cream, 0.12)],
    [1, alpha(PALETTE.cream, 0)],
  ]);
  ctx.beginPath();
  ctx.moveTo(cx - 10, 0);
  ctx.lineTo(cx + 10, 0);
  ctx.lineTo(w - 4, h);
  ctx.lineTo(4, h);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 46; i++) {
    const t = Math.pow(rnd(), 0.9);
    const y = t * h;
    const spread = 10 + t * (w / 2 - 14);
    const x = cx + (rnd() * 2 - 1) * spread;
    const len = 8 + t * 34 + rnd() * 16;
    ellipsePath(ctx, x, y, len / 2, 0.9 + t * 1.4);
    ctx.fillStyle = alpha(PALETTE.cream, 0.75 - t * 0.5);
    ctx.fill();
  }
}

/** Lily pad: a reservoir disc with a notch and a lighter rim; variant c carries a small cream flower. */
function paintLily(variant: number) {
  return (ctx: Ctx, w: number, h: number): void => {
    const cx = w / 2, cy = h * 0.62, rx = w / 2 - 3, ry = h * 0.3;
    const fill = mix(ACCENTS.reservoir, PALETTE.sage, 0.55);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.ellipse(cx, cy, rx, ry, 0, -Math.PI * 0.42 + variant * 0.3, Math.PI * 1.5 + variant * 0.3);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = outline(fill, 0.25);
    ctx.stroke();
    ctx.fillStyle = alpha(PALETTE.cream, 0.3);
    ellipsePath(ctx, cx - rx * 0.3, cy - ry * 0.35, rx * 0.35, ry * 0.3);
    ctx.fill();
    if (variant === 2) {
      // a small cream flower with a rose heart
      const fx = cx + rx * 0.25, fy = cy - 7;
      ctx.fillStyle = PALETTE.cream;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ellipsePath(ctx, fx + Math.cos(a) * 3.5, fy + Math.sin(a) * 2.6, 3, 2, a);
        ctx.fill();
      }
      ctx.fillStyle = PALETTE.rose;
      ellipsePath(ctx, fx, fy, 1.8, 1.4);
      ctx.fill();
    }
  };
}

/** Raindrop ring (rain on the water), a thin cream ellipse. */
function paintRing(ctx: Ctx, w: number, h: number): void {
  ellipsePath(ctx, w / 2, h / 2, w / 2 - 1.5, h / 2 - 1.5);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = alpha(PALETTE.cream, 0.7);
  ctx.stroke();
}

export function paintWaterTextures(scene: Phaser.Scene): void {
  paintTexture(scene, WATER_KEYS.ripple, WATER_SIZES.ripple.w, WATER_SIZES.ripple.h, paintRipple);
  paintTexture(scene, WATER_KEYS.path, WATER_SIZES.path.w, WATER_SIZES.path.h, paintPath);
  WATER_KEYS.lily.forEach((k, i) => paintTexture(scene, k, WATER_SIZES.lily.w, WATER_SIZES.lily.h, paintLily(i)));
  paintTexture(scene, WATER_KEYS.ring, 24, 9, paintRing);
}
