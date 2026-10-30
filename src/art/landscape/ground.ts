/**
 * The clearing's ground: a seamless bank strip (sage grass edge over a laterite earth face), the laterite path
 * climbing off-left on a low rise, the bank's rounded end where it slopes into the water, a laterite-block gatepost
 * with a mango-leaf toran, and the dotted tent-spot outline.
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { ellipsePath, linearGradient, paintTexture, roundRectPath, type Ctx } from '@/art/pipeline';
import { BAND_Y, GROUND_Y } from '@/world/layout';
import { TILE_W, seeded, wrapped } from './common';

export const GROUND_KEYS = {
  strip: 'ground-strip',
  rise: 'ground-rise',
  bankEnd: 'ground-bank-end',
  path: 'ground-path',
  gatepost: 'gatepost',
  tentSpot: 'tent-spot',
  jamunScatter: 'jamun-scatter',
} as const;
export const GROUND_SIZES = {
  /** tile top sits 14 px above ground y so tufts rise over the edge */
  strip: { w: TILE_W, h: 150, tuft: 14 },
  rise: { w: 320, h: 90 },
  bankEnd: { w: 120, h: 130 },
  path: { w: 280, h: 70 },
  gatepost: { w: 150, h: 96 },
  tentSpot: { w: 170, h: 46 },
  jamunScatter: { w: 200, h: 26 },
} as const;

const GRASS = PALETTE.sage;
const GRASS_DEEP = mix(PALETTE.sage, PALETTE.moss, 0.5);
/** The laterite earth face: lightened toward cream so it reads as a warm lip, not a heavy dark band. */
const EARTH = mix(ACCENTS.laterite, PALETTE.cream, 0.28);
const EARTH_DEEP = shade(EARTH, -0.16);
/** Below the earth face the fringe grass covers everything: its base colour fills the rest of the strip. */
const UNDER = shade(PALETTE.moss, -0.15);
/** Strip-texture y of the grass crest, the earth face top and bottom (world 600 / 640 / 676 with the tile top at 582). */
const CREST = GROUND_SIZES.strip.tuft + 4;
const EARTH_TOP = BAND_Y.earthTop - (GROUND_Y - GROUND_SIZES.strip.tuft - 4);
const EARTH_BOTTOM = BAND_Y.earthBottom - (GROUND_Y - GROUND_SIZES.strip.tuft - 4);

const crestY = (x: number): number => CREST + Math.sin(x * 0.11) * 2.5 + Math.sin(x * 0.037 + 1) * 2;

/** The grass body gradient shared by the strip and the bank end (same absolute y stops so the join is seamless). */
function grassGradient(ctx: Ctx): CanvasGradient {
  return linearGradient(ctx, 0, CREST, 0, EARTH_TOP, [
    [0, GRASS],
    [0.55, mix(GRASS, GRASS_DEEP, 0.6)],
    [1, GRASS_DEEP],
  ]);
}
function earthGradient(ctx: Ctx): CanvasGradient {
  return linearGradient(ctx, 0, EARTH_TOP, 0, EARTH_BOTTOM, [
    [0, EARTH],
    [0.5, EARTH],
    [1, EARTH_DEEP],
  ]);
}

/** Grass surface: a lumpy top edge with tufts, a deep grass body, a thin lighter laterite face with a grass lip over it. */
function paintStrip(ctx: Ctx, w: number, h: number): void {
  const rnd = seeded(203);
  const T = GROUND_SIZES.strip.tuft;
  // under-fringe fill, then the earth face, then the grass body
  ctx.fillStyle = UNDER;
  ctx.fillRect(0, EARTH_BOTTOM - 2, w, h - EARTH_BOTTOM + 2);
  ctx.fillStyle = earthGradient(ctx);
  ctx.fillRect(0, EARTH_TOP - 4, w, EARTH_BOTTOM - EARTH_TOP + 4);
  wrapped(ctx, w, h, (ctx) => {
    // pebbles and a few root hairs in the earth
    ctx.strokeStyle = alpha(EARTH_DEEP, 0.5);
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w, y = EARTH_TOP + 10 + rnd() * (EARTH_BOTTOM - EARTH_TOP - 16);
      const len = 10 + rnd() * 26;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len / 2, y + (rnd() - 0.5) * 5, x + len, y + (rnd() - 0.5) * 3);
      ctx.stroke();
    }
    for (let i = 0; i < 30; i++) {
      const x = rnd() * w, y = EARTH_TOP + 6 + rnd() * (EARTH_BOTTOM - EARTH_TOP - 10), r = 1.2 + rnd() * 2;
      ctx.fillStyle = rnd() < 0.5 ? alpha(mix(EARTH, PALETTE.cream, 0.5), 0.7) : alpha(EARTH_DEEP, 0.55);
      ellipsePath(ctx, x, y, r * 1.3, r);
      ctx.fill();
    }
    // the earth's soft bottom edge: a few dark-moss tufts rising from the fringe fill
    for (let x = rnd() * 10; x < w; x += 9 + rnd() * 10) {
      const hgt = 4 + rnd() * 9;
      ctx.fillStyle = rnd() < 0.5 ? UNDER : mix(UNDER, PALETTE.moss, 0.4);
      ctx.beginPath();
      ctx.moveTo(x - 3, EARTH_BOTTOM + 1);
      ctx.quadraticCurveTo(x + (rnd() - 0.5) * 3, EARTH_BOTTOM - hgt * 0.6, x + (rnd() - 0.5) * 5, EARTH_BOTTOM - hgt);
      ctx.quadraticCurveTo(x + 1, EARTH_BOTTOM - hgt * 0.4, x + 3, EARTH_BOTTOM + 1);
      ctx.closePath();
      ctx.fill();
    }
    // grass body: a soft scalloped crest, and a lip that overhangs the earth face in rounded tongues
    ctx.beginPath();
    ctx.moveTo(0, crestY(0));
    for (let x = 0; x <= w; x += 16) ctx.lineTo(x, crestY(x));
    ctx.lineTo(w, EARTH_TOP);
    for (let x = w - 18; x >= -18; x -= 18) {
      const hang = 3 + Math.abs(Math.sin(x * 0.07 + 0.4)) * 7;
      ctx.quadraticCurveTo(x + 9, EARTH_TOP + hang + 3, x, EARTH_TOP + hang * 0.3);
    }
    ctx.lineTo(-18, crestY(0));
    ctx.closePath();
    ctx.fillStyle = grassGradient(ctx);
    ctx.fill();
    // the lip's soft shadow on the earth
    ctx.strokeStyle = alpha(shade(EARTH, -0.3), 0.35);
    ctx.lineWidth = 3;
    ctx.stroke();
    // tufts over the crest
    for (let x = rnd() * 12; x < w; x += 10 + rnd() * 18) {
      const hgt = 5 + rnd() * (T - 4);
      const lean = (rnd() - 0.5) * 8;
      const c = rnd() < 0.6 ? GRASS : GRASS_DEEP;
      ctx.beginPath();
      ctx.moveTo(x - 3.5, T + 6);
      ctx.quadraticCurveTo(x + lean * 0.4, T + 6 - hgt * 0.6, x + lean, T + 6 - hgt);
      ctx.quadraticCurveTo(x + lean * 0.6 + 1, T + 6 - hgt * 0.5, x + 3.5, T + 6);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
    }
    // blade strokes and small cream daisies in the grass body
    ctx.strokeStyle = alpha(GRASS_DEEP, 0.5);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w, y = CREST + 8 + rnd() * (EARTH_TOP - CREST - 12);
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.quadraticCurveTo(x + 1, y, x + (rnd() - 0.5) * 4, y - 5 - rnd() * 4);
      ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const x = rnd() * w, y = T + 10 + rnd() * 14;
      ctx.fillStyle = rnd() < 0.5 ? alpha(PALETTE.cream, 0.85) : alpha(PALETTE.butter, 0.8);
      ellipsePath(ctx, x, y, 2, 1.6);
      ctx.fill();
    }
  });
  // outline along the grass crest
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = outline(GRASS, 0.2);
  ctx.beginPath();
  for (let x = 0; x <= w; x += 16) {
    const y = crestY(x);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** Low rise at the world's left: grass-topped mound whose top climbs from ground level (right) up 44 px (left). */
function paintRise(ctx: Ctx, w: number, h: number): void {
  const top = (x: number) => h - 14 - (1 - x / w) * (1 - x / w) * 50;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) ctx.lineTo(x, top(x) + Math.sin(x * 0.2) * 1.2);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = linearGradient(ctx, 0, 0, 0, h, [
    [0, GRASS],
    [0.5, mix(GRASS, GRASS_DEEP, 0.6)],
    [1, GRASS_DEEP],
  ]);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = outline(GRASS, 0.2);
  ctx.beginPath();
  for (let x = 0; x <= w; x += 8) {
    const y = top(x) + Math.sin(x * 0.2) * 1.2;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // tufts
  const rnd = seeded(5);
  for (let x = 6; x < w; x += 12 + rnd() * 16) {
    const y = top(x);
    const hgt = 6 + rnd() * 8;
    ctx.fillStyle = rnd() < 0.5 ? GRASS : GRASS_DEEP;
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 2);
    ctx.quadraticCurveTo(x - 1, y - hgt * 0.5, x + (rnd() - 0.5) * 6, y - hgt);
    ctx.quadraticCurveTo(x + 2, y - hgt * 0.4, x + 3, y + 2);
    ctx.closePath();
    ctx.fill();
  }
}

/** The bank's rounded end dipping into the water: grass cap curling under, a sliver of laterite at the waterline. */
function paintBankEnd(ctx: Ctx, w: number, h: number): void {
  const T = GROUND_SIZES.strip.tuft;
  ctx.beginPath();
  ctx.moveTo(0, T + 4);
  ctx.quadraticCurveTo(w * 0.45, T + 4, w * 0.7, T + 20);
  ctx.quadraticCurveTo(w * 0.98, T + 40, w * 0.78, T + 70);
  ctx.quadraticCurveTo(w * 0.6, T + 100, w * 0.3, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = UNDER;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = earthGradient(ctx);
  ctx.fillRect(0, EARTH_TOP - 4, w, EARTH_BOTTOM - EARTH_TOP + 4);
  ctx.fillStyle = grassGradient(ctx);
  ctx.fillRect(0, 0, w, EARTH_TOP);
  // the grass lip over the earth, continuing the strip's tongues
  ctx.beginPath();
  ctx.moveTo(0, EARTH_TOP - 2);
  for (let x = 0; x <= w; x += 18) {
    const hang = 3 + Math.abs(Math.sin(x * 0.07 + 0.4)) * 7;
    ctx.quadraticCurveTo(x + 9, EARTH_TOP + hang + 3, x + 18, EARTH_TOP + hang * 0.3);
  }
  ctx.lineTo(w, EARTH_TOP - 2);
  ctx.closePath();
  ctx.fillStyle = GRASS_DEEP;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = outline(GRASS_DEEP, 0.22);
  ctx.beginPath();
  ctx.moveTo(w * 0.7, T + 20);
  ctx.quadraticCurveTo(w * 0.98, T + 40, w * 0.78, T + 70);
  ctx.quadraticCurveTo(w * 0.6, T + 100, w * 0.3, h);
  ctx.stroke();
  ctx.strokeStyle = outline(GRASS, 0.2);
  ctx.beginPath();
  ctx.moveTo(0, T + 4);
  ctx.quadraticCurveTo(w * 0.45, T + 4, w * 0.7, T + 20);
  ctx.stroke();
  // wet laterite near the waterline
  ctx.fillStyle = alpha(shade(ACCENTS.laterite, -0.2), 0.4);
  ellipsePath(ctx, w * 0.6, EARTH_BOTTOM - 4, 26, 7);
  ctx.fill();
}

/** Laterite path ribbon: climbs from the right (ground level) up to the left, with rounded edges and stones. */
function paintPath(ctx: Ctx, w: number, h: number): void {
  const rnd = seeded(41);
  const mid = (x: number) => h - 16 - (1 - x / w) * (1 - x / w) * 44;
  ctx.beginPath();
  ctx.moveTo(0, mid(0) - 9);
  for (let x = 0; x <= w; x += 10) ctx.lineTo(x, mid(x) - 7 - Math.sin(x * 0.08) * 1.5);
  ctx.quadraticCurveTo(w + 6, mid(w), w, mid(w) + 9);
  for (let x = w; x >= 0; x -= 10) ctx.lineTo(x, mid(x) + 8 + Math.sin(x * 0.09) * 1.5);
  ctx.closePath();
  ctx.fillStyle = ACCENTS.laterite;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = outline(ACCENTS.laterite, 0.24);
  ctx.stroke();
  // worn lighter center and stones
  ctx.strokeStyle = alpha(mix(ACCENTS.laterite, PALETTE.cream, 0.3), 0.7);
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = 8; x <= w - 8; x += 10) {
    const y = mid(x) + Math.sin(x * 0.07) * 1.2;
    if (x === 8) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const x = 10 + rnd() * (w - 20), y = mid(x) + (rnd() - 0.5) * 10;
    ctx.fillStyle = rnd() < 0.5 ? alpha(shade(ACCENTS.laterite, -0.3), 0.7) : alpha(mix(ACCENTS.laterite, PALETTE.cream, 0.45), 0.8);
    ellipsePath(ctx, x, y, 2.2 + rnd() * 1.6, 1.4 + rnd());
    ctx.fill();
  }
  // purple jamun stains near the right end (the tree is that way)
  ctx.fillStyle = alpha(ACCENTS.jamun, 0.4);
  for (let i = 0; i < 5; i++) {
    const x = w * 0.6 + rnd() * w * 0.35, y = mid(x) + (rnd() - 0.5) * 8;
    ellipsePath(ctx, x, y, 2.5, 1.5);
    ctx.fill();
  }
}

/** Mango leaf: a slender pointed almond. */
function mangoLeaf(ctx: Ctx, x: number, y: number, len: number, angle: number, fill: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.25, len * 0.5, 0, len);
  ctx.quadraticCurveTo(-len * 0.25, len * 0.5, 0, 0);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = outline(fill, 0.22);
  ctx.stroke();
  ctx.restore();
}

/** Laterite-block gatepost with a mango-leaf toran strung from its cap to a short bamboo pole on the right. */
function paintGatepost(ctx: Ctx, w: number, h: number): void {
  const px = 24, pw = 30, top = 14, base = h - 4;
  const block = mix(ACCENTS.laterite, PALETTE.cream, 0.15);
  // post blocks
  const rows = 5;
  const bh = (base - top) / rows;
  for (let r = 0; r < rows; r++) {
    const y = top + r * bh;
    const offset = r % 2 ? 0 : 0;
    roundRectPath(ctx, px - pw / 2 + offset, y, pw, bh - 1.5, 3);
    ctx.fillStyle = r % 2 ? block : mix(block, PALETTE.cream, 0.12);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = outline(block, 0.24);
    ctx.stroke();
  }
  // cap stone
  roundRectPath(ctx, px - pw / 2 - 4, top - 7, pw + 8, 9, 4);
  ctx.fillStyle = shade(block, -0.08);
  ctx.fill();
  ctx.strokeStyle = outline(block, 0.26);
  ctx.stroke();
  // bamboo pole on the right
  const qx = w - 12;
  ctx.strokeStyle = outline(mix(PALETTE.butter, PALETTE.sage, 0.45), 0.2);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(qx, top + 6);
  ctx.lineTo(qx, base);
  ctx.stroke();
  ctx.strokeStyle = mix(PALETTE.butter, PALETTE.sage, 0.45);
  ctx.lineWidth = 3;
  ctx.stroke();
  // toran string, sagging between the cap and the pole, with leaves hanging from it
  const sx = px + pw / 2 + 2, sy = top - 2, ex = qx, ey = top + 8;
  const ctrlY = top + 22;
  ctx.strokeStyle = PALETTE.bark;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo((sx + ex) / 2, ctrlY, ex, ey);
  ctx.stroke();
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const lx = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * ((sx + ex) / 2) + t * t * ex;
    const ly = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * ctrlY + t * t * ey;
    const fill = i % 3 === 1 ? mix(PALETTE.sage, PALETTE.moss, 0.5) : PALETTE.sage;
    mangoLeaf(ctx, lx, ly + 1, 13, (t - 0.5) * 0.5, fill);
    if (i % 3 === 2) {
      ctx.fillStyle = ACCENTS.marigold;
      ellipsePath(ctx, lx, ly + 3, 3, 3);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = outline(ACCENTS.marigold, 0.22);
      ctx.stroke();
    }
  }
}

/** Dotted tent-spot outline: a soft cream-sage rounded ellipse of dashes. */
function paintTentSpot(ctx: Ctx, w: number, h: number): void {
  ctx.setLineDash([8, 7]);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = alpha(mix(PALETTE.cream, PALETTE.sage, 0.35), 0.9);
  ellipsePath(ctx, w / 2, h / 2, w / 2 - 3, h / 2 - 3);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = alpha(PALETTE.cream, 0.12);
  ctx.fill();
}

/** A scatter of fallen jamun (purple dots and stains) for under the tree. */
function paintJamunScatter(ctx: Ctx, w: number, h: number): void {
  const rnd = seeded(99);
  for (let i = 0; i < 22; i++) {
    const x = 8 + rnd() * (w - 16), y = 6 + rnd() * (h - 12);
    const stain = rnd() < 0.45;
    ctx.fillStyle = stain ? alpha(ACCENTS.jamun, 0.35) : ACCENTS.jamun;
    ellipsePath(ctx, x, y, stain ? 4 : 2.6, stain ? 1.6 : 2.2);
    ctx.fill();
    if (!stain) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = outline(ACCENTS.jamun, 0.25);
      ctx.stroke();
      ctx.fillStyle = alpha(PALETTE.cream, 0.5);
      ellipsePath(ctx, x - 0.8, y - 0.7, 0.8, 0.6);
      ctx.fill();
    }
  }
}

export function paintGround(scene: Phaser.Scene): void {
  const S = GROUND_SIZES;
  paintTexture(scene, GROUND_KEYS.strip, S.strip.w, S.strip.h, paintStrip);
  paintTexture(scene, GROUND_KEYS.rise, S.rise.w, S.rise.h, paintRise);
  paintTexture(scene, GROUND_KEYS.bankEnd, S.bankEnd.w, S.bankEnd.h, paintBankEnd);
  paintTexture(scene, GROUND_KEYS.path, S.path.w, S.path.h, paintPath);
  paintTexture(scene, GROUND_KEYS.gatepost, S.gatepost.w, S.gatepost.h, paintGatepost);
  paintTexture(scene, GROUND_KEYS.tentSpot, S.tentSpot.w, S.tentSpot.h, paintTentSpot);
  paintTexture(scene, GROUND_KEYS.jamunScatter, S.jamunScatter.w, S.jamunScatter.h, paintJamunScatter);
}
