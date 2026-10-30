/**
 * Far ridges: three stacked chains of rounded humps (the Ghats), each a seamless 1024 px tile painted in cream
 * (white-painted) so `lighting.far / ridgeMid / mid` tint them. All three share one texture height whose bottom edge
 * sits on the far shoreline, so a flipped copy mirrors straight into the water. Chain 1 is the highest and carries
 * bare grass domes (shola country); every chain bakes a soft lighter crest and cooler valleys for volume.
 */
import Phaser from 'phaser';
import { PALETTE, alpha, mix } from '@/config/palette';
import { linearGradient, paintTexture, type Ctx } from '@/art/pipeline';
import { BAND_Y } from '@/world/layout';
import { TILE_W, fillUnderCurve, seeded } from './common';

export const RIDGE_KEYS = ['ridge-1', 'ridge-2', 'ridge-3'] as const;
/** Texture height: from the ridge band's top (y 170) down to the shoreline (y 420). */
export const RIDGE_H = BAND_Y.shoreline - BAND_Y.ridgeTop;

type RidgeSpec = { top: number; amp: number; seed: number; humps: number; domes: boolean; cool: number };
/** `top` is the world y of the highest crest; `amp` the relief between the tallest hump and the saddles. */
const SPECS: RidgeSpec[] = [
  { top: 190, amp: 68, seed: 11, humps: 4, domes: true, cool: 0.12 },
  { top: 235, amp: 56, seed: 23, humps: 4, domes: false, cool: 0.17 },
  { top: 280, amp: 46, seed: 37, humps: 5, domes: false, cool: 0.27 },
];

type Hump = { cx: number; rx: number; ry: number };

/**
 * A chain of overlapping rounded humps across the tile: the silhouette is the highest of the semi-ellipses at each x
 * (wrapping at the tile edges), sitting on a saddle line `base`. Returns the sampler in texture px.
 */
function humpChain(w: number, base: number, amp: number, seed: number, humps: number): { f: (x: number) => number; humps: Hump[] } {
  const rnd = seeded(seed);
  const list: Hump[] = [];
  const slot = w / humps;
  for (let i = 0; i < humps; i++) {
    const tall = i === 0 ? 1 : 0.55 + rnd() * 0.4;
    list.push({ cx: i * slot + slot * (0.25 + rnd() * 0.5), rx: slot * (0.55 + rnd() * 0.3), ry: amp * tall });
  }
  // a few small shoulder humps between the big ones
  for (let i = 0; i < humps - 1; i++) {
    list.push({ cx: (i + 0.5) * slot + (rnd() - 0.5) * slot * 0.4, rx: slot * (0.25 + rnd() * 0.2), ry: amp * (0.25 + rnd() * 0.2) });
  }
  const f = (x: number): number => {
    let y = base;
    for (const h of list) {
      for (const dx of [-w, 0, w]) {
        const u = (x - h.cx - dx) / h.rx;
        if (u > -1 && u < 1) y = Math.min(y, base - h.ry * Math.sqrt(1 - u * u));
      }
    }
    // a whisper of wobble so the crest is not geometrically clean
    return y + Math.sin((x / w) * Math.PI * 2 * 11) * 1.2 + Math.sin((x / w) * Math.PI * 2 * 23 + 1) * 0.6;
  };
  return { f, humps: list };
}

/** Soft rounded domes along the crest (shola grassland) in a slightly brighter cream. */
function paintDomes(ctx: Ctx, f: (x: number) => number, w: number, seed: number): void {
  const rnd = seeded(seed);
  ctx.fillStyle = alpha(PALETTE.cream, 0.95);
  for (let x = 20; x < w; x += 60 + rnd() * 70) {
    const r = 12 + rnd() * 16;
    const y = f(x) + r * 0.6;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6, r, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }
}

/** Cooler valley shading between humps: soft vertical streaks that start under each saddle. */
function paintValleys(ctx: Ctx, f: (x: number) => number, w: number, h: number, humps: Hump[], cool: number): void {
  const tint = mix(PALETTE.cream, PALETTE.lavender, cool + 0.18);
  for (let i = 0; i < humps.length; i++) {
    const a = humps[i], b = humps[(i + 1) % humps.length];
    let x = (a.cx + b.cx + (i === humps.length - 1 ? w : 0)) / 2;
    x = ((x % w) + w) % w;
    const top = f(x) + 6;
    ctx.fillStyle = linearGradient(ctx, 0, top, 0, h, [
      [0, alpha(tint, 0)],
      [0.25, alpha(tint, 0.5)],
      [1, alpha(tint, 0.1)],
    ]);
    ctx.beginPath();
    ctx.ellipse(x, (top + h) / 2, 24 + a.rx * 0.18, (h - top) / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A sunlit flank on the left shoulder of each hump: a brighter cream wedge, soft-edged. */
function paintFlanks(ctx: Ctx, f: (x: number) => number, w: number, h: number, humps: Hump[]): void {
  ctx.fillStyle = alpha(PALETTE.cream, 0.5);
  for (const hm of humps) {
    if (hm.ry < 20) continue;
    const x0 = hm.cx - hm.rx * 0.85, x1 = hm.cx - hm.rx * 0.1;
    ctx.beginPath();
    ctx.moveTo(x0, h);
    for (let x = x0; x <= x1; x += 6) ctx.lineTo(x, f(x) - 1);
    ctx.lineTo(x1, h);
    ctx.closePath();
    ctx.fill();
  }
}

function paintRidge(spec: RidgeSpec) {
  return (ctx: Ctx, w: number, h: number): void => {
    const texTop = spec.top - BAND_Y.ridgeTop;
    const base = texTop + spec.amp;
    const { f, humps } = humpChain(w, base, spec.amp, spec.seed, spec.humps);
    fillUnderCurve(ctx, f, 0, w, h, 4);
    ctx.fillStyle = linearGradient(ctx, 0, texTop, 0, h, [
      [0, PALETTE.cream],
      [0.45, mix(PALETTE.cream, PALETTE.lavender, spec.cool * 0.5)],
      [1, mix(PALETTE.cream, PALETTE.lavender, spec.cool)],
    ]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    paintFlanks(ctx, f, w, h, humps);
    paintValleys(ctx, f, w, h, humps, spec.cool);
    ctx.restore();
    // a 2 px lighter crest so the ridge edge reads against the one behind
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = alpha(PALETTE.cream, 0.95);
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      if (x === 0) ctx.moveTo(x, f(x));
      else ctx.lineTo(x, f(x));
    }
    ctx.stroke();
    if (spec.domes) paintDomes(ctx, f, w, spec.seed);
  };
}

/** Registers ridge-1..3 (1024 x RIDGE_H, tileable; bottoms on the shoreline). */
export function paintRidges(scene: Phaser.Scene): void {
  SPECS.forEach((s, i) => paintTexture(scene, RIDGE_KEYS[i], TILE_W, RIDGE_H, paintRidge(s)));
}
