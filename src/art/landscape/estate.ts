/**
 * Estate slope: the coffee estate sloping to the far shore (world y 290-420), white-painted (cream) with darker
 * values baked in so `lighting.estate` tints the whole band. Rows of round coffee bushes follow the slope; 8-10 silver
 * oaks (thin tall trunk, a small feathery crown, one zigzag pepper vine) stand over them; a clump of areca palms with
 * starburst crowns; a small homestay whose window glows at night (the Landscape puts the glow at ESTATE_WINDOWS); and
 * the far shoreline edge along the bottom. Seamless 1024 px tile.
 */
import Phaser from 'phaser';
import { PALETTE, alpha, mix } from '@/config/palette';
import { ellipsePath, linearGradient, paintTexture, type Ctx } from '@/art/pipeline';
import { BAND_Y } from '@/world/layout';
import { TILE_W, fillUnderCurve, ridgeSampler, seeded, wrapped } from './common';

export const ESTATE_KEY = 'estate-slope';
export const ESTATE_H = BAND_Y.shoreline - BAND_Y.estateTop;
/** Window glow (the homestay) is placed by the Landscape at this tile-local point. */
export const ESTATE_WINDOWS: Array<[number, number]> = [[716, 52]];

const BASE = PALETTE.cream;
const SLOPE_LOW = mix(PALETTE.cream, PALETTE.lavender, 0.16);
const BUSH = mix(PALETTE.cream, PALETTE.lavender, 0.26);
const BUSH_SHADE = mix(PALETTE.cream, PALETTE.lavender, 0.52);
const TRUNK = mix(PALETTE.cream, PALETTE.ink, 0.62);
const VINE = mix(PALETTE.cream, PALETTE.ink, 0.72);
const CROWN = mix(PALETTE.cream, PALETTE.lavender, 0.44);
const CROWN_LIGHT = mix(PALETTE.cream, PALETTE.lavender, 0.2);
const CROWN_EDGE = mix(PALETTE.cream, PALETTE.lavender, 0.6);
const PALM = mix(PALETTE.cream, PALETTE.lavender, 0.55);
const HOUSE = mix(PALETTE.cream, PALETTE.lavender, 0.12);
const ROOF = mix(PALETTE.cream, PALETTE.ink, 0.42);

/** Rows of round coffee bushes following the slope: three loose rows near the crest, bigger toward the front. */
function coffeeRows(ctx: Ctx, f: (x: number) => number, w: number, rnd: () => number): void {
  const rows = [
    { dy: 10, r: 6 },
    { dy: 27, r: 7.5 },
    { dy: 47, r: 9 },
  ];
  rows.forEach((row, ri) => {
    // irregular spacing, sizes and the odd gap so the rows read as planted bushes, not a dot pattern (REVIEW M0 nit)
    for (let x = rnd() * 16 - row.r; x < w + row.r; x += row.r * (1.9 + rnd() * 1.8)) {
      if (rnd() < 0.14) continue;
      const r = row.r * (0.65 + rnd() * 0.7);
      const y = f(x) + row.dy + Math.sin(x * 0.045 + ri) * 2 + (rnd() - 0.5) * 5;
      const fill = mix(BUSH, BASE, rnd() * 0.35);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = alpha(BUSH_SHADE, 0.22);
      ctx.stroke();
      // a soft shaded underside
      ctx.beginPath();
      ctx.arc(x, y, r - 0.5, 0.45, Math.PI * 0.8);
      ctx.closePath();
      ctx.fillStyle = alpha(BUSH_SHADE, 0.2);
      ctx.fill();
      // a faint glint top-left
      ctx.fillStyle = alpha(BASE, 0.22);
      ellipsePath(ctx, x - r * 0.35, y - r * 0.4, r * 0.3, r * 0.2);
      ctx.fill();
    }
  });
  // faint earth paths between the rows, following the slope
  ctx.strokeStyle = alpha(mix(PALETTE.cream, PALETTE.lavender, 0.3), 0.5);
  ctx.lineWidth = 2;
  for (const dy of [19, 38, 60]) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 12) {
      const y = f(x) + dy + Math.sin(x * 0.03) * 2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/** Silver oak: a tall thin trunk, a small dense feathery crown near the top, one zigzag pepper vine. */
function silverOak(ctx: Ctx, x: number, baseY: number, h: number, rnd: () => number): void {
  const top = baseY - h;
  const lean = (rnd() - 0.5) * 8;
  const tw = 3.4 + rnd() * 0.8;
  ctx.strokeStyle = TRUNK;
  ctx.lineWidth = tw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * 0.4, baseY - h * 0.5, x + lean, top + 4);
  ctx.stroke();
  // feathery crown: an overlapping mass of soft ellipses around the top, lighter on the upper-left
  const cr = 14 + rnd() * 4;
  const crownY = top + cr * 1.1;
  const cx = x + lean * 0.9;
  ctx.lineWidth = 1;
  for (let i = 0; i < 11; i++) {
    const a = rnd() * Math.PI * 2;
    const d = cr * (0.15 + rnd() * 0.55);
    const ex = cx + Math.cos(a) * d, ey = crownY + Math.sin(a) * d * 0.9;
    const upperLeft = ex < cx + 1 && ey < crownY;
    ctx.fillStyle = upperLeft ? CROWN_LIGHT : CROWN;
    ctx.strokeStyle = alpha(CROWN_EDGE, 0.75);
    ellipsePath(ctx, ex, ey, cr * (0.42 + rnd() * 0.2), cr * 0.26, a);
    ctx.fill();
    ctx.stroke();
  }
  // a few drooping sprigs off the crown and two lower on the trunk
  ctx.strokeStyle = CROWN_EDGE;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * (0.1 + rnd() * 0.8);
    ctx.beginPath();
    ctx.moveTo(cx, crownY);
    ctx.quadraticCurveTo(cx + Math.cos(a) * cr * 0.9, crownY + Math.sin(a) * cr * 0.5, cx + Math.cos(a) * cr * 1.15, crownY + Math.sin(a) * cr * 0.9 + 4);
    ctx.stroke();
  }
  for (let s = 0; s < 2; s++) {
    const sy = top + h * (0.34 + s * 0.17);
    const dir = s === 0 ? -1 : 1;
    ctx.fillStyle = CROWN;
    ctx.strokeStyle = alpha(CROWN_EDGE, 0.75);
    ctx.lineWidth = 1;
    ellipsePath(ctx, x + lean * 0.6 + dir * 7, sy, 8, 3, dir * 0.35);
    ctx.fill();
    ctx.stroke();
  }
  // the pepper vine: a thin zigzag climbing two-thirds of the trunk
  ctx.strokeStyle = VINE;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - tw, baseY - 2);
  let side = 1;
  for (let y = baseY - 7; y > top + h * 0.3; y -= 5.5) {
    const t = (baseY - y) / h;
    ctx.lineTo(x + lean * t + side * (tw * 0.5 + 1.5), y);
    side = -side;
  }
  ctx.stroke();
}

/** Areca palms: slender curved trunks with starburst crowns of drooping fronds. */
function arecaClump(ctx: Ctx, x: number, baseY: number, rnd: () => number): void {
  for (let i = 0; i < 5; i++) {
    const tx = x + (i - 2) * 11;
    const h = 52 + rnd() * 20;
    const lean = (i - 2) * 5;
    const topX = tx + lean, topY = baseY - h;
    ctx.strokeStyle = TRUNK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(tx, baseY);
    ctx.quadraticCurveTo(tx + lean * 0.4, baseY - h * 0.6, topX, topY);
    ctx.stroke();
    ctx.strokeStyle = PALM;
    ctx.lineWidth = 2;
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI * 1.05 + (k / 8) * Math.PI * 1.1;
      const len = 13 + rnd() * 6;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.6, topY + Math.sin(a) * len * 0.6 - 4, topX + Math.cos(a) * len, topY + Math.sin(a) * len + 6);
      ctx.stroke();
    }
    ctx.fillStyle = PALM;
    ellipsePath(ctx, topX, topY, 2.6, 2.2);
    ctx.fill();
  }
}

/** The homestay: a small box with a hipped roof, one window and a chimney wisp. (x, y) is the window center. */
function homestay(ctx: Ctx, x: number, y: number): void {
  const bw = 34, bh = 18;
  const left = x - 10, top = y - 6;
  ctx.fillStyle = HOUSE;
  ctx.fillRect(left, top, bw, bh);
  ctx.strokeStyle = alpha(CROWN_EDGE, 0.8);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(left, top, bw, bh);
  // roof
  ctx.fillStyle = ROOF;
  ctx.beginPath();
  ctx.moveTo(left - 5, top + 1);
  ctx.lineTo(left + 7, top - 10);
  ctx.lineTo(left + bw - 7, top - 10);
  ctx.lineTo(left + bw + 5, top + 1);
  ctx.closePath();
  ctx.fill();
  // window
  ctx.fillStyle = VINE;
  ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
  ctx.fillStyle = HOUSE;
  ctx.fillRect(x - 0.6, y - 3.5, 1.2, 7);
  ctx.fillRect(x - 3.5, y - 0.6, 7, 1.2);
  // door
  ctx.fillStyle = VINE;
  ctx.fillRect(left + bw - 11, top + 7, 6, bh - 7);
}

function paintEstateTile(ctx: Ctx, w: number, h: number): void {
  const rnd = seeded(91);
  const f = ridgeSampler(w, 34, 18, 53, 2);
  // slope body
  fillUnderCurve(ctx, f, 0, w, h, 6);
  ctx.fillStyle = linearGradient(ctx, 0, 0, 0, h, [
    [0, BASE],
    [0.6, mix(BASE, SLOPE_LOW, 0.5)],
    [1, SLOPE_LOW],
  ]);
  ctx.fill();
  // a soft cooler wash over the lower slope, where the shade of the oaks gathers
  ctx.fillStyle = linearGradient(ctx, 0, 40, 0, h, [
    [0, alpha(SLOPE_LOW, 0)],
    [0.5, alpha(mix(PALETTE.cream, PALETTE.lavender, 0.28), 0.35)],
    [1, alpha(mix(PALETTE.cream, PALETTE.lavender, 0.28), 0.5)],
  ]);
  ctx.fillRect(0, 40, w, h - 40);
  wrapped(ctx, w, h, (ctx) => {
    coffeeRows(ctx, f, w, rnd);
    // silver oaks: 9 across the tile, planted between the bush rows; the tallest stand at the back
    const oaks = [30, 150, 250, 365, 470, 580, 650, 790, 900, 985];
    oaks.forEach((ox, i) => {
      const x = ox + (rnd() - 0.5) * 16;
      const row = i % 3;
      silverOak(ctx, x, f(ox) + 24 + row * 16 + rnd() * 6, 70 + rnd() * 22, rnd);
    });
    arecaClump(ctx, 548, f(548) + 50, rnd);
    for (const [wx, wy] of ESTATE_WINDOWS) homestay(ctx, wx, wy);
  });
  // far shoreline: a pale cool band with a soft shadow above it and a cream glint line at the water
  ctx.fillStyle = linearGradient(ctx, 0, h - 14, 0, h, [
    [0, alpha(PALETTE.lavender, 0)],
    [0.7, alpha(PALETTE.lavender, 0.3)],
    [1, alpha(PALETTE.lavender, 0.45)],
  ]);
  ctx.fillRect(0, h - 14, w, 14);
  ctx.fillStyle = alpha(PALETTE.cream, 0.7);
  ctx.fillRect(0, h - 2, w, 2);
}

export function paintEstate(scene: Phaser.Scene): void {
  paintTexture(scene, ESTATE_KEY, TILE_W, ESTATE_H, paintEstateTile);
}

export const ESTATE_REFLECT_KEY = 'estate-reflect';
/**
 * The slope mirrored for the water: the whole tile flipped so its crest and trees hang down from y 0.
 * Tile it at the shoreline with a squashed scaleY at low alpha.
 */
export function paintEstateReflection(scene: Phaser.Scene): string {
  return paintTexture(scene, ESTATE_REFLECT_KEY, TILE_W, ESTATE_H, (ctx, w, h) => {
    ctx.save();
    ctx.translate(0, h);
    ctx.scale(1, -1);
    paintEstateTile(ctx, w, h);
    ctx.restore();
  });
}
