/**
 * Shallows: pale drowned snags standing in the water (4 variants, 90-150 px tall with 2-3 stubby branches and a faint
 * reflection baked under the waterline), a cormorant drying its wings, reed clumps, and the tiny far coracle with its
 * round fisher. Snags are mix(cream, lavender, 0.4) with a thin darker outline; everything here is tinted with
 * lighting.nearTint.
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { ellipsePath, paintTexture, type Ctx } from '@/art/pipeline';
import { bladePath } from './common';

export const SHALLOWS_KEYS = {
  snags: ['snag-a', 'snag-b', 'snag-c', 'snag-d'],
  cormorant: 'cormorant',
  reeds: 'reeds',
  farCoracle: 'far-coracle',
} as const;
export const SHALLOWS_SIZES = {
  /** the waterline sits at texture y `base`; the reflection fills the rest */
  snag: { w: 120, h: 210, base: 150 },
  cormorant: { w: 44, h: 34 },
  reeds: { w: 90, h: 70 },
  farCoracle: { w: 40, h: 26 },
} as const;
/** Where each snag variant's trunk top is (texture x, y): the cormorant perches there. */
export const SNAG_TOPS: Array<[number, number]> = [[60, 60], [52, 36], [70, 4], [58, 24]];

const SNAG = mix(PALETTE.cream, PALETTE.lavender, 0.4);
const SNAG_LINE = outline(SNAG, 0.25);
const SNAG_LIT = mix(SNAG, PALETTE.cream, 0.5);

type Limb = [number, number, number];

/** A tapering trunk from (x, base) to (x+lean, top) with `limbs` short bare stubs: [t along trunk, direction, length]. */
function snagTrunk(ctx: Ctx, x: number, base: number, top: number, lean: number, wBase: number, limbs: Limb[]): void {
  const wTop = Math.max(3, wBase * 0.3);
  ctx.beginPath();
  ctx.moveTo(x - wBase / 2, base);
  ctx.quadraticCurveTo(x + lean * 0.4 - wBase * 0.2, (base + top) / 2, x + lean - wTop / 2, top + 4);
  ctx.quadraticCurveTo(x + lean, top - 3, x + lean + wTop / 2, top + 2);
  ctx.quadraticCurveTo(x + lean * 0.5 + wBase * 0.2, (base + top) / 2, x + wBase / 2, base);
  ctx.closePath();
  ctx.fillStyle = SNAG;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = SNAG_LINE;
  ctx.stroke();
  ctx.lineCap = 'round';
  for (const [t, dir, len] of limbs) {
    const ly = base + (top - base) * t;
    const lx = x + lean * t;
    ctx.lineWidth = 6;
    ctx.strokeStyle = SNAG_LINE;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.quadraticCurveTo(lx + dir * len * 0.6, ly - len * 0.45, lx + dir * len, ly - len * 0.85);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = SNAG;
    ctx.stroke();
  }
  // a lit edge on the left side, where the sky is
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = alpha(SNAG_LIT, 0.9);
  ctx.beginPath();
  ctx.moveTo(x - wBase / 2 + 2.5, base - 8);
  ctx.quadraticCurveTo(x + lean * 0.4 - wBase * 0.2 + 2.5, (base + top) / 2, x + lean - wTop / 2 + 1.5, top + 9);
  ctx.stroke();
  // a few bark checks
  ctx.strokeStyle = alpha(SNAG_LINE, 0.5);
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 4; i++) {
    const t = i / 4.5;
    const cx = x + lean * t, cy = base + (top - base) * t;
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy - 6);
    ctx.lineTo(cx + 1, cy + 6);
    ctx.stroke();
  }
}

/** Waterline: a soft darker ring where the trunk meets the water. */
function waterline(ctx: Ctx, x: number, y: number, w: number): void {
  ctx.fillStyle = alpha(shade(SNAG, -0.3), 0.3);
  ellipsePath(ctx, x, y, w * 1.1, 2.4);
  ctx.fill();
}

type SnagShape = { x: number; top: number; lean: number; w: number; limbs: Limb[] };
const SNAG_SHAPES: SnagShape[] = [
  { x: 58, top: 60, lean: 2, w: 15, limbs: [[0.5, -1, 22], [0.76, 1, 16]] },
  { x: 60, top: 36, lean: -8, w: 13, limbs: [[0.45, 1, 24], [0.7, -1, 14]] },
  { x: 58, top: 4, lean: 12, w: 17, limbs: [[0.38, 1, 20], [0.6, -1, 26], [0.84, 1, 11]] },
  { x: 62, top: 24, lean: -4, w: 14, limbs: [[0.42, -1, 18], [0.66, 1, 20], [0.86, -1, 10]] },
];

/** The snag, then its reflection: the same shape flipped, squashed, faint, cut by thin cream ripple lines. */
function paintSnag(shape: SnagShape) {
  return (ctx: Ctx, w: number, h: number): void => {
    const base = SHALLOWS_SIZES.snag.base;
    const draw = (c: Ctx) => snagTrunk(c, shape.x, base, shape.top, shape.lean, shape.w, shape.limbs);
    // reflection
    ctx.save();
    ctx.translate(0, base);
    ctx.scale(1, -(h - base) / (base - shape.top) * 1.0);
    ctx.translate(0, -base);
    ctx.globalAlpha = 0.28;
    draw(ctx);
    ctx.restore();
    // ripple lines across the reflection
    ctx.strokeStyle = alpha(PALETTE.cream, 0.5);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const y = base + 6 + i * 11;
      ctx.beginPath();
      ctx.moveTo(shape.x - 22 - i * 4, y);
      ctx.lineTo(shape.x + 22 + i * 4, y);
      ctx.stroke();
    }
    draw(ctx);
    waterline(ctx, shape.x, base, shape.w * 0.7);
  };
}

/** Cormorant drying its wings: a dark soft silhouette, wings out, neck up. Ink-lavender, never black. */
function paintCormorant(ctx: Ctx, w: number, h: number): void {
  const c = mix(PALETTE.ink, PALETTE.lavender, 0.3);
  const cx = w / 2, baseY = h - 3;
  ctx.fillStyle = c;
  ctx.strokeStyle = c;
  ellipsePath(ctx, cx, baseY - 9, 7, 6);
  ctx.fill();
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
  ctx.lineWidth = 2.6;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + dir * 4, baseY - 11);
    ctx.quadraticCurveTo(cx + dir * 12, baseY - 20, cx + dir * 20, baseY - 16);
    ctx.quadraticCurveTo(cx + dir * 14, baseY - 11, cx + dir * 6, baseY - 7);
    ctx.closePath();
    ctx.fill();
  }
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
    bladePath(ctx, x0, h - 2, x0 + lean * 0.6, (h + top) / 2, x0 + lean, top, 3.2);
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

/** The far coracle: a laterite-rimmed bowl with a round fisher silhouette and a thin pole, plus a faint reflection. */
function paintFarCoracle(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, wy = h - 8;
  const hull = mix(ACCENTS.laterite, PALETTE.bark, 0.3);
  const body = mix(PALETTE.ink, PALETTE.lavender, 0.35);
  // reflection
  ctx.fillStyle = alpha(hull, 0.3);
  ellipsePath(ctx, cx, wy + 4, 12, 3);
  ctx.fill();
  // hull
  ctx.beginPath();
  ctx.moveTo(cx - 13, wy - 5);
  ctx.quadraticCurveTo(cx, wy + 6, cx + 13, wy - 5);
  ctx.closePath();
  ctx.fillStyle = hull;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = outline(hull, 0.25);
  ctx.stroke();
  ctx.strokeStyle = mix(hull, PALETTE.cream, 0.4);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 12, wy - 5);
  ctx.lineTo(cx + 12, wy - 5);
  ctx.stroke();
  // fisher: a round body and head, and a pole
  ctx.fillStyle = body;
  ellipsePath(ctx, cx + 2, wy - 9, 5, 4.5);
  ctx.fill();
  ellipsePath(ctx, cx + 2, wy - 15, 3, 3);
  ctx.fill();
  ctx.strokeStyle = body;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx + 5, wy - 10);
  ctx.lineTo(cx + 17, wy - 20);
  ctx.stroke();
}

export function paintShallows(scene: Phaser.Scene): void {
  const S = SHALLOWS_SIZES;
  SHALLOWS_KEYS.snags.forEach((k, i) => paintTexture(scene, k, S.snag.w, S.snag.h, paintSnag(SNAG_SHAPES[i])));
  paintTexture(scene, SHALLOWS_KEYS.cormorant, S.cormorant.w, S.cormorant.h, paintCormorant);
  paintTexture(scene, SHALLOWS_KEYS.reeds, S.reeds.w, S.reeds.h, paintReeds);
  paintTexture(scene, SHALLOWS_KEYS.farCoracle, S.farCoracle.w, S.farCoracle.h, paintFarCoracle);
}
