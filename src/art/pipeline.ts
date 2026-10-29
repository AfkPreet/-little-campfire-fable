/**
 * Procedural art pipeline.
 * Every sprite is painted ONCE at boot (or lazily on first use) into a Canvas 2D texture at ART_SCALE (2x),
 * then displayed as a Phaser Image scaled by 1/ART_SCALE. Never redraw Graphics every frame.
 *
 * Usage:
 *   paintTexture(scene, 'hero-head', 64, 56, (ctx, w, h) => { ...draw in logical px... });
 *   const head = img(scene, x, y, 'hero-head');            // Image at logical size, origin 0.5
 *
 * All colors come from palette.ts. Outlines are a darker shade of the fill at 2-3 px, never black.
 */
import Phaser from 'phaser';
import { alpha, outline, shade } from '@/config/palette';

export const ART_SCALE = 2;
export type Ctx = CanvasRenderingContext2D;
export type Painter = (ctx: Ctx, w: number, h: number) => void;

/** Paint a texture if it does not exist yet. Returns the key. Size is in logical px. */
export function paintTexture(scene: Phaser.Scene, key: string, w: number, h: number, painter: Painter): string {
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * ART_SCALE));
  canvas.height = Math.max(1, Math.ceil(h * ART_SCALE));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(ART_SCALE, ART_SCALE);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  painter(ctx, w, h);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** Re-paint an existing texture in place (e.g. a sky gradient when lighting changes). Cheap for small textures. */
export function repaintTexture(scene: Phaser.Scene, key: string, painter: Painter): void {
  const tex = scene.textures.get(key) as Phaser.Textures.CanvasTexture;
  if (!tex || !(tex instanceof Phaser.Textures.CanvasTexture)) return;
  const ctx = tex.getContext();
  const w = tex.width / ART_SCALE, h = tex.height / ART_SCALE;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, tex.width, tex.height);
  ctx.scale(ART_SCALE, ART_SCALE);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  painter(ctx, w, h);
  ctx.restore();
  tex.refresh();
}

/** Add an Image of a painted texture at logical size. */
export function img(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  const im = scene.add.image(x, y, key);
  im.setScale(1 / ART_SCALE);
  im.setData('baseScale', 1 / ART_SCALE);
  return im;
}
/** Make (not add) an Image for use inside containers. */
export function makeImg(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  const im = scene.make.image({ x, y, key, add: false });
  im.setScale(1 / ART_SCALE);
  im.setData('baseScale', 1 / ART_SCALE);
  return im;
}
/** TileSprite of a painted texture; width/height are logical. */
export function tile(scene: Phaser.Scene, x: number, y: number, w: number, h: number, key: string): Phaser.GameObjects.TileSprite {
  const t = scene.add.tileSprite(x, y, w * ART_SCALE, h * ART_SCALE, key);
  t.setScale(1 / ART_SCALE);
  t.setData('baseScale', 1 / ART_SCALE);
  return t;
}

// ---------- canvas drawing helpers (logical px) ----------

/** A closed, rounded blob through control points: smooth quadratic curve through midpoints. */
export function blobPath(ctx: Ctx, pts: Array<[number, number]>): void {
  const n = pts.length;
  if (n < 3) return;
  ctx.beginPath();
  const mid = (i: number): [number, number] => {
    const a = pts[i % n], b = pts[(i + 1) % n];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  const [sx, sy] = mid(0);
  ctx.moveTo(sx, sy);
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n];
    const [mx, my] = mid(i);
    ctx.quadraticCurveTo(p[0], p[1], mx, my);
  }
  ctx.closePath();
}

export function ellipsePath(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
  ctx.closePath();
}

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Fill the current path with a color and stroke it with a darker shade (the house outline). */
export function fillOutlined(ctx: Ctx, fill: string, width = 2.5, outlineAmt = 0.22): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.strokeStyle = outline(fill, outlineAmt);
  ctx.stroke();
}

/** Fill the current path with a vertical gradient top->bottom and outline it. */
export function fillGradientOutlined(ctx: Ctx, top: string, bottom: string, y0: number, y1: number, width = 2.5): void {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fill();
  if (width > 0) {
    ctx.lineWidth = width;
    ctx.strokeStyle = outline(bottom, 0.22);
    ctx.stroke();
  }
}

export function linearGradient(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: Array<[number, string]>): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
}
export function radialGradient(ctx: Ctx, cx: number, cy: number, r0: number, r1: number, stops: Array<[number, string]>): CanvasGradient {
  const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
}

/** Soft radial glow blob (for lantern pools, fireflies, bloom sprites). */
export function softGlow(ctx: Ctx, cx: number, cy: number, r: number, color: string, peak = 1): void {
  ctx.fillStyle = radialGradient(ctx, cx, cy, 0, r, [
    [0, alpha(color, peak)],
    [0.35, alpha(color, peak * 0.55)],
    [0.7, alpha(color, peak * 0.18)],
    [1, alpha(color, 0)],
  ]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A soft, ink-tinted contact shadow ellipse under a thing. */
export function contactShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, ink: string, a = 0.14): void {
  ctx.fillStyle = radialGradient(ctx, cx, cy, 0, rx, [
    [0, alpha(ink, a)],
    [1, alpha(ink, 0)],
  ]);
  ctx.save();
  ctx.scale(1, ry / rx);
  ctx.beginPath();
  ctx.arc(cx, (cy * rx) / ry, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A subtle highlight sheen on the upper-left of a rounded shape. */
export function sheen(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string, a = 0.35): void {
  ctx.fillStyle = alpha(color, a);
  ellipsePath(ctx, cx, cy, rx, ry, -0.5);
  ctx.fill();
}

/** Kawaii eye: ink oval with 1-2 cream highlight dots. */
export function kawaiiEye(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, ink: string, cream: string, open = 1): void {
  if (open <= 0.08) {
    // closed: a happy arc
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(2, rx * 0.5);
    ctx.beginPath();
    ctx.arc(cx, cy + ry * 0.2, rx, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    return;
  }
  ellipsePath(ctx, cx, cy, rx, ry * open);
  ctx.fillStyle = ink;
  ctx.fill();
  ctx.fillStyle = cream;
  ellipsePath(ctx, cx - rx * 0.3, cy - ry * 0.35 * open, rx * 0.32, ry * 0.3 * open);
  ctx.fill();
  ellipsePath(ctx, cx + rx * 0.35, cy + ry * 0.25 * open, rx * 0.14, ry * 0.13 * open);
  ctx.fill();
}

/** Blush oval at 60% alpha. */
export function blushOval(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, blush: string): void {
  ctx.fillStyle = alpha(blush, 0.6);
  ellipsePath(ctx, cx, cy, rx, ry);
  ctx.fill();
}

/** Faint paper grain over a region (UI cards). Deterministic noise so re-paints are stable. */
export function paperGrain(ctx: Ctx, x: number, y: number, w: number, h: number, ink: string, amount = 0.035, seed = 7): void {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.fillStyle = ink;
  const n = Math.floor((w * h) / 18);
  for (let i = 0; i < n; i++) {
    const px = x + rnd() * w, py = y + rnd() * h;
    ctx.fillRect(px, py, 1, 1);
  }
  ctx.restore();
}

/** Darker/lighter helpers re-exported for painters. */
export { shade, outline, alpha };
