/**
 * Shallows: pale drowned snags standing in the water (3 variants), a cormorant drying its wings, and reed clumps.
 * Snags are mix(cream, lavender, 0.4) with a darker-shade outline; everything here is tinted with lighting.nearTint.
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { ellipsePath, paintTexture, type Ctx } from '@/art/pipeline';
import { bladePath } from './common';

export const SHALLOWS_KEYS = {
  snags: ['snag-a', 'snag-b', 'snag-c'],
  cormorant: 'cormorant',
  reeds: 'reeds',
} as const;
export const SHALLOWS_SIZES = {
  snag: { w: 70, h: 130 },
  cormorant: { w: 44, h: 34 },
  reeds: { w: 90, h: 70 },
} as const;

const SNAG = mix(PALETTE.cream, PALETTE.lavender, 0.4);
const SNAG_LINE = outline(SNAG, 0.25);
const SNAG_LIT = mix(SNAG, PALETTE.cream, 0.45);

/** A tapering trunk from (x, base) to (x+lean, top) with `limbs` short bare stubs. */
function snagTrunk(ctx: Ctx, x: number, base: number, top: number, lean: number, wBase: number, limbs: Array<[number, number, number]>): void {
  ctx.beginPath();
  ctx.moveTo(x - wBase / 2, base);
  ctx.quadraticCurveTo(x + lean * 0.4 - wBase * 0.25, (base + top) / 2, x + lean - 2, top + 3);
  ctx.quadraticCurveTo(x + lean, top - 2, x + lean + 2, top + 2);
  ctx.quadraticCurveTo(x + lean * 0.5 + wBase * 0.25, (base + top) / 2, x + wBase / 2, base);
  ctx.closePath();
  ctx.fillStyle = SNAG;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = SNAG_LINE;
  ctx.stroke();
  // limbs: [t along trunk, direction, length]
  ctx.lineCap = 'round';
  for (const [t, dir, len] of limbs) {
    const ly = base + (top - base) * t;
    const lx = x + lean * t;
    ctx.lineWidth = 4.2;
    ctx.strokeStyle = SNAG_LINE;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.quadraticCurveTo(lx + dir * len * 0.6, ly - len * 0.5, lx + dir * len, ly - len * 0.9);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = SNAG;
    ctx.stroke();
  }
  // a lit edge on the left side, where the sky is
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = alpha(SNAG_LIT, 0.8);
  ctx.beginPath();
  ctx.moveTo(x - wBase / 2 + 2, base - 6);
  ctx.quadraticCurveTo(x + lean * 0.4 - wBase * 0.25 + 2, (base + top) / 2, x + lean - 1, top + 8);
  ctx.stroke();
}

/** Waterline: a soft darker ring where the trunk meets the water. */
function waterline(ctx: Ctx, x: number, y: number, w: number): void {
  ctx.fillStyle = alpha(shade(SNAG, -0.3), 0.3);
  ellipsePath(ctx, x, y, w * 0.9, 2.2);
  ctx.fill();
}

const SNAG_VARIANTS: Array<(ctx: Ctx, w: number, h: number) => void> = [
  (ctx, w, h) => {
    snagTrunk(ctx, w * 0.45, h - 6, 10, 6, 13, [[0.55, -1, 18], [0.78, 1, 14]]);
    waterline(ctx, w * 0.45, h - 6, 8);
  },
  (ctx, w, h) => {
    snagTrunk(ctx, w * 0.5, h - 6, 34, -8, 11, [[0.5, 1, 20]]);
    waterline(ctx, w * 0.5, h - 6, 7);
  },
  (ctx, w, h) => {
    snagTrunk(ctx, w * 0.42, h - 6, 56, 10, 15, [[0.4, 1, 16], [0.62, -1, 22], [0.85, 1, 9]]);
    waterline(ctx, w * 0.42, h - 6, 9);
  },
];

/** Cormorant drying its wings: a dark soft silhouette, wings out, neck up. Ink-lavender, never black. */
function paintCormorant(ctx: Ctx, w: number, h: number): void {
  const c = mix(PALETTE.ink, PALETTE.lavender, 0.3);
  const cx = w / 2, baseY = h - 3;
  ctx.fillStyle = c;
  ctx.strokeStyle = c;
  // body
  ellipsePath(ctx, cx, baseY - 9, 7, 6);
  ctx.fill();
  // neck + head
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(cx + 2, baseY - 13);
  ctx.quadraticCurveTo(cx + 7, baseY - 22, cx + 5, baseY - 27);
  ctx.stroke();
  ellipsePath(ctx, cx + 5, baseY - 28, 3, 2.6);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + 7, baseY - 28);
  ctx.lineTo(cx + 13, baseY - 27);
  ctx.stroke();
  // wings spread
  ctx.lineWidth = 2.6;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + dir * 4, baseY - 11);
    ctx.quadraticCurveTo(cx + dir * 12, baseY - 20, cx + dir * 20, baseY - 16);
    ctx.quadraticCurveTo(cx + dir * 14, baseY - 11, cx + dir * 6, baseY - 7);
    ctx.closePath();
    ctx.fill();
  }
  // a cream eye dot
  ctx.fillStyle = PALETTE.cream;
  ellipsePath(ctx, cx + 5.5, baseY - 28.5, 0.9, 0.9);
  ctx.fill();
}

/** Reed clump: 7 slender moss blades with two seed heads. */
function paintReeds(ctx: Ctx, w: number, h: number): void {
  const base = mix(PALETTE.moss, PALETTE.sage, 0.4);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x0 = w * 0.25 + (i / (n - 1)) * w * 0.5;
    const lean = (i - 3) * 5;
    const top = 8 + Math.abs(i - 3) * 7;
    const c = i % 2 ? base : shade(base, -0.12);
    bladePath(ctx, x0, h - 2, x0 + lean * 0.6, (h + top) / 2, x0 + lean, top, 4);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = outline(c, 0.18);
    ctx.stroke();
    if (i === 2 || i === 4) {
      ctx.fillStyle = mix(PALETTE.bark, ACCENTS.marigold, 0.3);
      ellipsePath(ctx, x0 + lean, top + 4, 2.4, 7);
      ctx.fill();
    }
  }
}

export function paintShallows(scene: Phaser.Scene): void {
  SHALLOWS_KEYS.snags.forEach((k, i) => paintTexture(scene, k, SHALLOWS_SIZES.snag.w, SHALLOWS_SIZES.snag.h, SNAG_VARIANTS[i]));
  paintTexture(scene, SHALLOWS_KEYS.cormorant, SHALLOWS_SIZES.cormorant.w, SHALLOWS_SIZES.cormorant.h, paintCormorant);
  paintTexture(scene, SHALLOWS_KEYS.reeds, SHALLOWS_SIZES.reeds.w, SHALLOWS_SIZES.reeds.h, paintReeds);
}
