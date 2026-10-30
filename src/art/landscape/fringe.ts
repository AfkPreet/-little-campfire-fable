/**
 * Fringe foliage: tall lemongrass blade clusters and fern fronds (3 variants each) in shade(moss, -0.15) with soft
 * brushed edges. They sit in front of the clearing at scroll 1.3 and overlap the hero's feet.
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
  fern: { w: 120, h: 90 },
} as const;

const FG = shade(PALETTE.moss, -0.15);
const FG_LIGHT = mix(FG, PALETTE.sage, 0.35);

function paintGrass(seed: number, blades: number) {
  return (ctx: Ctx, w: number, h: number): void => {
    const rnd = seeded(seed);
    const baseX = w / 2, baseY = h - 4;
    for (let i = 0; i < blades; i++) {
      const spread = (i / (blades - 1) - 0.5) * 2; // -1..1
      const lean = spread * (26 + rnd() * 18);
      const top = 10 + Math.abs(spread) * 34 + rnd() * 14;
      const x0 = baseX + spread * 10;
      const c = rnd() < 0.5 ? FG : FG_LIGHT;
      bladePath(ctx, x0, baseY, x0 + lean * 0.35, (baseY + top) / 2 + 10, x0 + lean, top, 6 + rnd() * 2);
      softFill(ctx, c, 7);
    }
  };
}

/** Fern frond: a curved midrib with paired rounded leaflets shrinking toward the tip. */
function frond(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, fill: string, rnd: () => number): void {
  const n = 9;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx);
    const dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy);
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const size = (1 - t) * 13 + 3 + rnd() * 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(bx + nx * side * size * 0.5, by + ny * side * size * 0.5, size * 0.55, size * 0.26, Math.atan2(ny * side, nx * side), 0, Math.PI * 2);
      softFill(ctx, fill, 5);
    }
  }
  ctx.strokeStyle = alpha(shade(fill, -0.2), 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
}

function paintFern(seed: number) {
  return (ctx: Ctx, w: number, h: number): void => {
    const rnd = seeded(seed);
    const bx = w / 2, by = h - 4;
    const fronds = 3 + Math.floor(rnd() * 2);
    for (let i = 0; i < fronds; i++) {
      const a = -Math.PI * 0.5 + (i / (fronds - 1) - 0.5) * Math.PI * 0.9;
      const len = 50 + rnd() * 30;
      const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len * 0.8;
      const cx = bx + Math.cos(a) * len * 0.45, cy = by + Math.sin(a) * len * 0.9 - 12;
      frond(ctx, bx, by, ex, ey, cx, cy, i % 2 ? FG : FG_LIGHT, rnd);
    }
  };
}

export function paintFringe(scene: Phaser.Scene): void {
  const S = FRINGE_SIZES;
  FRINGE_KEYS.grass.forEach((k, i) => paintTexture(scene, k, S.grass.w, S.grass.h, paintGrass(300 + i * 7, 7 + i * 2)));
  FRINGE_KEYS.fern.forEach((k, i) => paintTexture(scene, k, S.fern.w, S.fern.h, paintFern(400 + i * 13)));
}
