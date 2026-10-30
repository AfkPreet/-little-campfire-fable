/**
 * Far ridges: three stacked, rounded ridgelines of the Ghats, each a seamless 1024 px hump chain painted in cream
 * (white-painted) so `lighting.far / mid` tint them. Ridge 1 is the highest and carries bare grass domes (shola).
 */
import Phaser from 'phaser';
import { PALETTE, alpha, mix } from '@/config/palette';
import { linearGradient, paintTexture, type Ctx } from '@/art/pipeline';
import { TILE_W, fillUnderCurve, ridgeSampler, seeded } from './common';

export const RIDGE_KEYS = ['ridge-1', 'ridge-2', 'ridge-3'] as const;
/** Texture height; the bottom edge sits at the shoreline (y 345) plus a skirt under the estate slope. */
export const RIDGE_H = 200;

type RidgeSpec = { base: number; amp: number; seed: number; humps: number; domes: boolean };
const SPECS: RidgeSpec[] = [
  { base: 118, amp: 62, seed: 11, humps: 2, domes: true }, // highest, softest
  { base: 140, amp: 48, seed: 23, humps: 3, domes: false },
  { base: 162, amp: 36, seed: 37, humps: 4, domes: false },
];

/** Soft rounded domes along the crest (shola grassland) in a slightly brighter cream. */
function paintDomes(ctx: Ctx, f: (x: number) => number, w: number, seed: number): void {
  const rnd = seeded(seed);
  ctx.fillStyle = alpha(PALETTE.cream, 0.9);
  for (let x = 30; x < w; x += 70 + rnd() * 60) {
    const r = 14 + rnd() * 16;
    const y = f(x) + r * 0.55;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.5, r, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }
}

/** Faint valley shading: vertical soft streaks where the crest dips, baked in a cooler cream. */
function paintValleys(ctx: Ctx, f: (x: number) => number, w: number, h: number, seed: number): void {
  const rnd = seeded(seed + 5);
  const cool = mix(PALETTE.cream, PALETTE.lavender, 0.2);
  for (let i = 0; i < 7; i++) {
    const x = rnd() * w;
    const top = f(x) + 10;
    ctx.fillStyle = linearGradient(ctx, 0, top, 0, h, [
      [0, alpha(cool, 0)],
      [0.3, alpha(cool, 0.35)],
      [1, alpha(cool, 0)],
    ]);
    ctx.beginPath();
    ctx.ellipse(x, (top + h) / 2, 26 + rnd() * 30, (h - top) / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintRidge(spec: RidgeSpec) {
  return (ctx: Ctx, w: number, h: number): void => {
    const f = ridgeSampler(w, spec.base, spec.amp, spec.seed, spec.humps);
    fillUnderCurve(ctx, f, 0, w, h, 6);
    ctx.fillStyle = linearGradient(ctx, 0, spec.base - spec.amp, 0, h, [
      [0, PALETTE.cream],
      [1, mix(PALETTE.cream, PALETTE.lavender, 0.1)],
    ]);
    ctx.fill();
    // a 2 px lighter crest so the ridge edge reads against the one behind
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = alpha(PALETTE.cream, 0.9);
    ctx.stroke();
    if (spec.domes) paintDomes(ctx, f, w, spec.seed);
    paintValleys(ctx, f, w, h, spec.seed);
  };
}

/** Registers ridge-1..3 (1024 x 200, tileable). */
export function paintRidges(scene: Phaser.Scene): void {
  SPECS.forEach((s, i) => paintTexture(scene, RIDGE_KEYS[i], TILE_W, RIDGE_H, paintRidge(s)));
}
