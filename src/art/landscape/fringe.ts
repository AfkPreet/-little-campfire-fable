/**
 * Fringe foliage: slender lemongrass blade clusters and delicate fern fronds (3 variants each). Ferns are paired
 * leaflets on a thin stem in shade(moss, -0.1) at 85% alpha; grass blades are thin tapered strokes with soft brushed
 * edges. They sit in front of the clearing at scroll 1.3 and overlap the hero's feet.
 */
import Phaser from 'phaser';
import { PALETTE, alpha, mix, shade } from '@/config/palette';
import { paintTexture, type Ctx } from '@/art/pipeline';
import { bladePath, seeded, softFill } from './common';

export const FRINGE_KEYS = {
  grass: ['fringe-grass-a', 'fringe-grass-b', 'fringe-grass-c'],
  fern: ['fringe-fern-a', 'fringe-fern-b', 'fringe-fern-c'],
} as const;
export const FRINGE_SIZES = {
  grass: { w: 110, h: 130 },
  fern: { w: 130, h: 96 },
} as const;

const FG = shade(PALETTE.moss, -0.15);
const FG_LIGHT = mix(FG, PALETTE.sage, 0.4);
const FERN = alpha(shade(PALETTE.moss, -0.1), 0.85);
const FERN_LIGHT = alpha(mix(shade(PALETTE.moss, -0.1), PALETTE.sage, 0.35), 0.85);
const FERN_STEM = alpha(shade(PALETTE.moss, -0.3), 0.9);

function paintGrass(seed: number, blades: number) {
  return (ctx: Ctx, w: number, h: number): void => {
    const rnd = seeded(seed);
    const baseX = w / 2, baseY = h - 4;
    for (let i = 0; i < blades; i++) {
      const spread = (i / (blades - 1) - 0.5) * 2; // -1..1
      const lean = spread * (28 + rnd() * 20);
      const top = 8 + Math.abs(spread) * 36 + rnd() * 14;
      const x0 = baseX + spread * 9;
      const c = rnd() < 0.5 ? FG : FG_LIGHT;
      bladePath(ctx, x0, baseY, x0 + lean * 0.3, (baseY + top) / 2 + 12, x0 + lean, top, 3.4 + rnd() * 1.2);
      softFill(ctx, c, 5);
    }
    // a few folded-over tips: thin strokes that curl at the top
    ctx.strokeStyle = alpha(FG_LIGHT, 0.9);
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const s = (rnd() - 0.5) * 2;
      const x0 = baseX + s * 6, x1 = baseX + s * 40;
      ctx.beginPath();
      ctx.moveTo(x0, baseY);
      ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.2, h * 0.45, x1, 18 + rnd() * 20);
      ctx.quadraticCurveTo(x1 + s * 6, 10 + rnd() * 10, x1 + s * 12, 16 + rnd() * 12);
      ctx.stroke();
    }
  };
}

/** Fern frond: a thin curved stem with paired slender leaflets shrinking toward the tip. */
function frond(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, fill: string, rnd: () => number): void {
  const n = 11;
  ctx.strokeStyle = FERN_STEM;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx);
    const dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy);
    const len = Math.hypot(dx, dy) || 1;
    const tx = dx / len, ty = dy / len;
    const nx = -ty, ny = tx;
    const size = (1 - t) * 12 + 3 + rnd() * 1.5;
    for (const side of [-1, 1]) {
      // each leaflet is a slender tapered blade leaning toward the tip
      const ex = bx + nx * side * size + tx * size * 0.55;
      const ey = by + ny * side * size + ty * size * 0.55;
      const mx = bx + nx * side * size * 0.5 + tx * size * 0.1;
      const my = by + ny * side * size * 0.5 + ty * size * 0.1;
      bladePath(ctx, bx, by, mx, my, ex, ey, 2.6 + (1 - t) * 1.2);
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }
  // tip curl
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x1, y1, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function paintFern(seed: number) {
  return (ctx: Ctx, w: number, h: number): void => {
    const rnd = seeded(seed);
    const bx = w / 2, by = h - 4;
    const fronds = 4 + Math.floor(rnd() * 2);
    for (let i = 0; i < fronds; i++) {
      const a = -Math.PI * 0.5 + (i / (fronds - 1) - 0.5) * Math.PI * 1.05;
      const len = 46 + rnd() * 34;
      const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len * 0.75;
      const cx = bx + Math.cos(a) * len * 0.4, cy = by + Math.sin(a) * len * 0.85 - 14;
      frond(ctx, bx, by, ex, ey, cx, cy, i % 2 ? FERN : FERN_LIGHT, rnd);
    }
  };
}

export function paintFringe(scene: Phaser.Scene): void {
  const S = FRINGE_SIZES;
  FRINGE_KEYS.grass.forEach((k, i) => paintTexture(scene, k, S.grass.w, S.grass.h, paintGrass(300 + i * 7, 8 + i * 2)));
  FRINGE_KEYS.fern.forEach((k, i) => paintTexture(scene, k, S.fern.w, S.fern.h, paintFern(400 + i * 13)));
}
