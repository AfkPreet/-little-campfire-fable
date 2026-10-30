/**
 * Shared helpers for the landscape painters: a seeded RNG so every texture paints the same way each boot,
 * a wrap-around drawer for seamless 1024 px tiles, and a per-channel multiply for baked lighting.
 */
import { hexToRgb, rgbToHex } from '@/config/palette';
import { ART_SCALE, type Ctx } from '@/art/pipeline';

/** Tileable band width (logical px). TileSprites repeat it across the world. */
export const TILE_W = 1024;

/** Deterministic pseudo-random (LCG). Call with a fresh seed per painter. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * Paint once onto a scratch canvas (so a painter's RNG runs once), then stamp it at -w, 0, +w under a clip: shapes
 * that cross an edge reappear on the other side and the tile wraps seamlessly. `paint` draws on the scratch context.
 */
export function wrapped(ctx: Ctx, w: number, h: number, paint: (ctx: Ctx) => void): void {
  const tmp = document.createElement('canvas');
  tmp.width = Math.max(1, Math.ceil(w * ART_SCALE));
  tmp.height = Math.max(1, Math.ceil(h * ART_SCALE));
  const tc = tmp.getContext('2d')!;
  tc.scale(ART_SCALE, ART_SCALE);
  tc.lineJoin = 'round';
  tc.lineCap = 'round';
  paint(tc);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  for (const dx of [-w, 0, w]) ctx.drawImage(tmp, dx, 0, w, h);
  ctx.restore();
}

/** Per-channel multiply of two hex colors (what a Phaser tint does to a painted color). */
export function mul(a: string, b: string): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex({ r: (A.r * B.r) / 255, g: (A.g * B.g) / 255, b: (A.b * B.b) / 255 });
}

/** Rough RGB distance (0..441) used to skip repaints when a lighting color barely moved. */
export function colorDistance(a: string, b: string): number {
  const A = hexToRgb(a), B = hexToRgb(b);
  return Math.hypot(A.r - B.r, A.g - B.g, A.b - B.b);
}

/**
 * A smooth, seamless (period w) hump chain: y(x) = base - sum of sines whose periods divide w.
 * Returns a sampler in logical px. `amp` is the total relief.
 */
export function ridgeSampler(w: number, base: number, amp: number, seed: number, humps = 3): (x: number) => number {
  const rnd = seeded(seed);
  const waves: Array<[number, number, number]> = [];
  for (let i = 0; i < 4; i++) {
    const k = humps + i * 2; // integer cycles per tile keep it seamless
    waves.push([k, rnd() * Math.PI * 2, amp * (0.55 / (i + 1))]);
  }
  return (x: number) => {
    let y = base;
    for (const [k, ph, a] of waves) y -= a * (0.5 + 0.5 * Math.sin((x / w) * Math.PI * 2 * k + ph));
    return y;
  };
}

/** Fill the area under a sampled curve from x0..x1 down to `bottom` (a band silhouette). */
export function fillUnderCurve(ctx: Ctx, f: (x: number) => number, x0: number, x1: number, bottom: number, step = 8): void {
  ctx.beginPath();
  ctx.moveTo(x0, bottom);
  for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(x, f(Math.min(x, x1)));
  ctx.lineTo(x1, bottom);
  ctx.closePath();
}

/** Soft-edged fill: paints the current path with a same-color shadow blur so edges feel brushed, not cut. */
export function softFill(ctx: Ctx, fill: string, blur = 6): void {
  ctx.save();
  ctx.shadowColor = fill;
  ctx.shadowBlur = blur;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fill();
  ctx.restore();
}

/** A leaf/blade: a tapered curve from (x0,y0) bowing through a control point to (x1,y1), width w at the base. */
export function bladePath(ctx: Ctx, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number): void {
  const nx = -(y1 - y0), ny = x1 - x0;
  const len = Math.hypot(nx, ny) || 1;
  const ox = (nx / len) * (w / 2), oy = (ny / len) * (w / 2);
  ctx.beginPath();
  ctx.moveTo(x0 - ox, y0 - oy);
  ctx.quadraticCurveTo(cx - ox * 0.5, cy - oy * 0.5, x1, y1);
  ctx.quadraticCurveTo(cx + ox * 0.5, cy + oy * 0.5, x0 + ox, y0 + oy);
  ctx.closePath();
}
