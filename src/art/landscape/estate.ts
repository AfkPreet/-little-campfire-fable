/**
 * Estate slope: the coffee estate sloping to the far shore, white-painted (cream) with a darker second tone baked in
 * for trunks. Rows of round coffee bushes, 8-10 silver oaks (thin trunk, feathery crown, one zigzag pepper vine),
 * an areca clump with starburst crowns, and the far shoreline along the bottom edge. Seamless 1024 px tile.
 * At scroll 0.25 everything must simplify to trunk-plus-zigzag and starbursts (ART_BIBLE section 10).
 */
import Phaser from 'phaser';
import { PALETTE, alpha, mix } from '@/config/palette';
import { linearGradient, paintTexture, type Ctx } from '@/art/pipeline';
import { TILE_W, fillUnderCurve, ridgeSampler, seeded, wrapped } from './common';

export const ESTATE_KEY = 'estate-slope';
export const ESTATE_H = 150;
/** Window glow pinpricks (homestays) are placed by the Landscape at these tile-local points. */
export const ESTATE_WINDOWS: Array<[number, number]> = [[318, 104], [842, 112]];

const BASE = PALETTE.cream;
const TRUNK = mix(PALETTE.cream, PALETTE.lavender, 0.5);
const CROWN = mix(PALETTE.cream, PALETTE.lavender, 0.14);
const CROWN_EDGE = mix(PALETTE.cream, PALETTE.lavender, 0.3);
const VINE = mix(PALETTE.cream, PALETTE.lavender, 0.62);

function coffeeRows(ctx: Ctx, f: (x: number) => number, w: number, rnd: () => number): void {
  // three rows following the slope, each a chain of overlapping round bushes; the furthest row is smaller
  for (let row = 0; row < 3; row++) {
    const dy = 10 + row * 13;
    const r = 5 + row * 1.6;
    ctx.fillStyle = row === 2 ? CROWN : mix(BASE, CROWN, 0.55);
    ctx.strokeStyle = alpha(CROWN_EDGE, 0.55);
    ctx.lineWidth = 1.2;
    for (let x = rnd() * 8; x < w + r; x += r * 1.55) {
      const y = f(x) + dy + Math.sin(x * 0.05 + row) * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function silverOak(ctx: Ctx, x: number, baseY: number, h: number, rnd: () => number): void {
  const top = baseY - h;
  // thin trunk
  ctx.strokeStyle = TRUNK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + (rnd() - 0.5) * 6, baseY - h * 0.5, x + (rnd() - 0.5) * 4, top + 6);
  ctx.stroke();
  // feathery crown: a small loose cluster of soft ellipses leaning off the top third
  ctx.fillStyle = CROWN;
  ctx.strokeStyle = alpha(CROWN_EDGE, 0.6);
  ctx.lineWidth = 1.2;
  const crownY = top + h * 0.18;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55 + (rnd() - 0.5) * 0.3;
    const d = 7 + rnd() * 6;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * d, crownY + Math.sin(a) * d * 0.9, 9 + rnd() * 4, 5 + rnd() * 2, a + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // one zigzag pepper vine climbing the trunk
  ctx.strokeStyle = VINE;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  let side = 1;
  ctx.moveTo(x - 3, baseY - 4);
  for (let y = baseY - 10; y > crownY + 8; y -= 7) {
    ctx.lineTo(x + side * 4, y);
    side = -side;
  }
  ctx.stroke();
}

function arecaClump(ctx: Ctx, x: number, baseY: number, rnd: () => number): void {
  for (let i = 0; i < 4; i++) {
    const tx = x + (i - 1.5) * 9;
    const h = 46 + rnd() * 14;
    const lean = (i - 1.5) * 4;
    const topX = tx + lean, topY = baseY - h;
    ctx.strokeStyle = TRUNK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, baseY);
    ctx.quadraticCurveTo(tx + lean * 0.5, baseY - h * 0.6, topX, topY);
    ctx.stroke();
    // starburst crown: 7 drooping fronds
    ctx.strokeStyle = CROWN_EDGE;
    ctx.lineWidth = 1.8;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI * 0.95 + (k / 6) * Math.PI * 0.9;
      const len = 11 + rnd() * 5;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.6, topY + Math.sin(a) * len * 0.6 - 3, topX + Math.cos(a) * len, topY + Math.sin(a) * len + 5);
      ctx.stroke();
    }
  }
}

/** The homestay: a tiny gabled block with a window square; the Landscape puts a glow at ESTATE_WINDOWS. */
function homestay(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = mix(BASE, CROWN_EDGE, 0.35);
  ctx.beginPath();
  ctx.moveTo(x - 11, y + 8);
  ctx.lineTo(x - 11, y - 2);
  ctx.lineTo(x, y - 9);
  ctx.lineTo(x + 11, y - 2);
  ctx.lineTo(x + 11, y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = TRUNK;
  ctx.fillRect(x - 3, y, 6, 5);
}

function paintEstateTile(ctx: Ctx, w: number, h: number): void {
  const rnd = seeded(91);
  const f = ridgeSampler(w, 30, 22, 53, 2);
  // slope body
  fillUnderCurve(ctx, f, 0, w, h, 6);
  ctx.fillStyle = linearGradient(ctx, 0, 0, 0, h, [
    [0, BASE],
    [0.75, mix(BASE, CROWN, 0.5)],
    [1, mix(BASE, PALETTE.lavender, 0.22)],
  ]);
  ctx.fill();
  wrapped(ctx, w, h, () => {
    coffeeRows(ctx, f, w, rnd);
    // silver oaks: 9 across the tile, planted on the slope line
    const oaks = [40, 150, 265, 380, 470, 600, 720, 830, 950];
    for (const ox of oaks) silverOak(ctx, ox + (rnd() - 0.5) * 14, f(ox) + 34 + rnd() * 10, 58 + rnd() * 26, rnd);
    arecaClump(ctx, 540, f(540) + 44, rnd);
    for (const [wx, wy] of ESTATE_WINDOWS) homestay(ctx, wx, wy);
  });
  // far shoreline: a pale cool line with a tiny soft shadow above it
  ctx.fillStyle = linearGradient(ctx, 0, h - 10, 0, h, [
    [0, alpha(PALETTE.lavender, 0)],
    [1, alpha(PALETTE.lavender, 0.35)],
  ]);
  ctx.fillRect(0, h - 10, w, 10);
}

export function paintEstate(scene: Phaser.Scene): void {
  paintTexture(scene, ESTATE_KEY, TILE_W, ESTATE_H, paintEstateTile);
}

export const ESTATE_REFLECT_KEY = 'estate-reflect';
/**
 * The slope mirrored for the water: only the top `visibleH` px of the tile (what stands above the shoreline),
 * flipped so its crest hangs down from y 0. Tile it at the shoreline with a squashed scaleY at low alpha.
 */
export function paintEstateReflection(scene: Phaser.Scene, visibleH: number): string {
  return paintTexture(scene, ESTATE_REFLECT_KEY, TILE_W, visibleH, (ctx, w) => {
    ctx.save();
    ctx.translate(0, visibleH);
    ctx.scale(1, -1);
    paintEstateTile(ctx, w, ESTATE_H);
    ctx.restore();
  });
}
