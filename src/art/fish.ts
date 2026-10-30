/**
 * fish.ts: the 8 species as kawaii catch-card icons (~96 px wide), painted once into 'fish-<id>' textures.
 * Every fish faces right, has one big eye, a blush and a soft contact shadow. Colors from the palette only.
 */
import type Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { type Ctx, blobPath, blushOval, contactShadow, ellipsePath, fillOutlined, kawaiiEye, paintTexture, sheen, softGlow } from '@/art/pipeline';
import type { FishId } from '@/data/types';

const P = PALETTE, A = ACCENTS;
export const FISH_ICON = { w: 96, h: 64 } as const;
export const FISH_KEYS: Record<FishId, string> = {
  minnow: 'fish-minnow', carp: 'fish-carp', trout: 'fish-trout', perch: 'fish-perch',
  loach: 'fish-loach', glowfin: 'fish-glowfin', koi: 'fish-koi', golden: 'fish-golden',
};
export function fishKey(id: FishId): string { return FISH_KEYS[id]; }

type Body = { cx: number; cy: number; rx: number; ry: number; fill: string; lw?: number };

/** Tail: a soft fan behind the body (to the left). */
function tail(ctx: Ctx, x: number, cy: number, len: number, spread: number, fill: string): void {
  blobPath(ctx, [[x + 4, cy], [x - len * 0.6, cy - spread], [x - len, cy - spread * 0.5], [x - len * 0.7, cy], [x - len, cy + spread * 0.5], [x - len * 0.6, cy + spread]]);
  fillOutlined(ctx, fill, 2.5);
}
/** Small fin: a rounded petal rotated by `rot`. */
function fin(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rot: number, fill: string): void {
  ellipsePath(ctx, cx, cy, rx, ry, rot);
  fillOutlined(ctx, fill, 2.2);
}
function body(ctx: Ctx, b: Body): void {
  ellipsePath(ctx, b.cx, b.cy, b.rx, b.ry);
  fillOutlined(ctx, b.fill, b.lw ?? 2.5);
}
function face(ctx: Ctx, ex: number, ey: number, r: number, blush: string, open = 1): void {
  kawaiiEye(ctx, ex, ey, r, r * 1.1, P.ink, P.cream, open);
  blushOval(ctx, ex + r * 0.3, ey + r * 1.9, r * 1.1, r * 0.6, blush);
  // tiny smile
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(ex + r * 1.6, ey + r * 1.4, r * 0.6, Math.PI * 0.15, Math.PI * 0.75);
  ctx.stroke();
}
function stripe(ctx: Ctx, b: Body, color: string, w: number, yOff = 0): void {
  ctx.save();
  ellipsePath(ctx, b.cx, b.cy, b.rx - 1, b.ry - 1);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(b.cx - b.rx, b.cy + yOff + 2);
  ctx.quadraticCurveTo(b.cx, b.cy + yOff - 3, b.cx + b.rx, b.cy + yOff + 1);
  ctx.stroke();
  ctx.restore();
}
function spots(ctx: Ctx, b: Body, color: string, pts: Array<[number, number, number]>): void {
  ctx.save();
  ellipsePath(ctx, b.cx, b.cy, b.rx - 1.5, b.ry - 1.5);
  ctx.clip();
  ctx.fillStyle = color;
  for (const [x, y, r] of pts) { ellipsePath(ctx, b.cx + x, b.cy + y, r, r * 0.8); ctx.fill(); }
  ctx.restore();
}
function whisker(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, glow?: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2, y1 + 6, x1, y1);
  ctx.stroke();
  if (glow) { softGlow(ctx, x1, y1, 7, glow, 0.9); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x1, y1, 2.2, 0, Math.PI * 2); ctx.fill(); }
}
function sparkle(ctx: Ctx, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx, cy, cx + r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy + r);
  ctx.quadraticCurveTo(cx, cy, cx - r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy - r);
  ctx.fill();
}

const PAINTERS: Record<FishId, (ctx: Ctx) => void> = {
  // Pebble Danio: slim powder oval with a lavender stripe
  minnow: (ctx) => {
    const b: Body = { cx: 50, cy: 32, rx: 28, ry: 13, fill: P.powder };
    contactShadow(ctx, 50, 52, 26, 4, P.ink);
    tail(ctx, 24, 32, 16, 9, shade(P.powder, -0.06));
    body(ctx, b);
    stripe(ctx, b, P.lavender, 4);
    fin(ctx, 46, 20, 7, 4, -0.5, shade(P.powder, -0.06));
    sheen(ctx, 48, 24, 14, 3, P.cream, 0.3);
    face(ctx, 64, 29, 4.5, P.blush);
  },
  // Bubble Catla: fat sage-grey with a bulging cream forehead
  carp: (ctx) => {
    const fill = mix(P.sage, P.lavender, 0.45);
    const b: Body = { cx: 50, cy: 34, rx: 30, ry: 20, fill };
    contactShadow(ctx, 50, 56, 30, 4, P.ink);
    tail(ctx, 22, 34, 16, 12, shade(fill, -0.06));
    body(ctx, b);
    // forehead bulge
    ellipsePath(ctx, 64, 22, 13, 10);
    fillOutlined(ctx, P.cream, 2.2);
    fin(ctx, 44, 18, 8, 4, -0.4, shade(fill, -0.06));
    fin(ctx, 52, 50, 7, 3.5, 0.5, shade(fill, -0.06));
    // bubbles
    ctx.strokeStyle = alpha(P.cream, 0.9); ctx.lineWidth = 1.5;
    for (const [x, y, r] of [[84, 14, 3], [89, 7, 2], [80, 6, 1.5]] as Array<[number, number, number]>) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
    face(ctx, 66, 34, 5.5, P.blush);
  },
  // Blushing Barb: cream torpedo with a rose stripe and blush
  trout: (ctx) => {
    const b: Body = { cx: 50, cy: 33, rx: 32, ry: 14, fill: P.cream };
    contactShadow(ctx, 50, 54, 30, 4, P.ink);
    tail(ctx, 20, 33, 15, 10, mix(P.cream, P.rose, 0.3));
    body(ctx, b);
    stripe(ctx, b, P.rose, 5, 1);
    fin(ctx, 48, 20, 8, 4, -0.5, mix(P.cream, P.rose, 0.3));
    face(ctx, 66, 30, 4.8, P.blush);
    blushOval(ctx, 56, 36, 4, 2.5, P.blush);
  },
  // Dusk Murrel: long moss body with bark blotches and half-closed eyes
  perch: (ctx) => {
    const b: Body = { cx: 50, cy: 34, rx: 36, ry: 12, fill: P.moss };
    contactShadow(ctx, 50, 54, 34, 4, P.ink);
    tail(ctx, 16, 34, 12, 9, shade(P.moss, -0.06));
    body(ctx, b);
    spots(ctx, b, alpha(P.bark, 0.75), [[-18, -2, 5], [-4, 3, 4.5], [10, -3, 4], [-26, 3, 3]]);
    fin(ctx, 40, 22, 14, 3.5, -0.1, shade(P.moss, -0.08));
    face(ctx, 70, 31, 4.5, P.blush, 0.5);
  },
  // Monsoon Loach: bark noodle with reservoir-green bands and barbels
  loach: (ctx) => {
    const fill = mix(P.bark, P.cream, 0.15);
    contactShadow(ctx, 50, 52, 34, 4, P.ink);
    blobPath(ctx, [[12, 36], [20, 26], [40, 24], [62, 25], [80, 28], [88, 34], [80, 42], [60, 44], [40, 44], [20, 42]]);
    fillOutlined(ctx, fill, 2.5);
    ctx.save();
    blobPath(ctx, [[12, 36], [20, 26], [40, 24], [62, 25], [80, 28], [88, 34], [80, 42], [60, 44], [40, 44], [20, 42]]);
    ctx.clip();
    ctx.fillStyle = alpha(A.reservoir, 0.8);
    for (const x of [24, 38, 52, 66]) { ctx.fillRect(x, 20, 6, 30); }
    ctx.restore();
    tail(ctx, 14, 35, 10, 7, shade(fill, -0.06));
    whisker(ctx, 84, 36, 93, 30, outline(fill));
    whisker(ctx, 84, 38, 92, 44, outline(fill));
    face(ctx, 76, 31, 4, P.blush);
  },
  // Firefly Catfish: jamun-ink round catfish with glow-tipped whiskers
  glowfin: (ctx) => {
    const fill = mix(A.jamun, P.ink, 0.35);
    const b: Body = { cx: 50, cy: 34, rx: 26, ry: 19, fill };
    contactShadow(ctx, 50, 56, 26, 4, P.ink);
    tail(ctx, 26, 34, 14, 11, shade(fill, -0.05));
    body(ctx, b);
    fin(ctx, 46, 17, 9, 4, -0.3, mix(fill, P.glow, 0.25));
    sheen(ctx, 48, 24, 12, 3, P.lavender, 0.35);
    whisker(ctx, 72, 36, 90, 26, outline(fill), P.glow);
    whisker(ctx, 72, 40, 88, 48, outline(fill), P.glow);
    face(ctx, 64, 32, 5.5, P.blush);
  },
  // Petal Pearlspot: cream disc with rose petal spots and lavender fins
  koi: (ctx) => {
    const b: Body = { cx: 50, cy: 33, rx: 24, ry: 21, fill: P.cream };
    contactShadow(ctx, 50, 56, 24, 4, P.ink);
    tail(ctx, 28, 33, 14, 12, P.lavender);
    fin(ctx, 44, 13, 9, 4, -0.25, P.lavender);
    fin(ctx, 44, 53, 8, 3.5, 0.25, P.lavender);
    body(ctx, b);
    spots(ctx, b, alpha(P.rose, 0.8), [[-10, -8, 5], [2, 6, 6], [-14, 6, 4], [8, -9, 3.5]]);
    face(ctx, 64, 30, 5, P.blush);
  },
  // Honey Whisker: plump butter-marigold fish with long glow whiskers and a sparkle
  golden: (ctx) => {
    const fill = mix(A.marigold, P.butter, 0.5);
    const b: Body = { cx: 48, cy: 35, rx: 30, ry: 18, fill };
    contactShadow(ctx, 48, 56, 30, 4, P.ink);
    tail(ctx, 20, 35, 16, 12, P.butter);
    body(ctx, b);
    fin(ctx, 44, 19, 9, 4, -0.4, P.butter);
    sheen(ctx, 46, 25, 14, 3.5, P.cream, 0.45);
    whisker(ctx, 72, 36, 93, 22, outline(fill), P.glow);
    whisker(ctx, 72, 40, 92, 52, outline(fill), P.glow);
    sparkle(ctx, 86, 8, 5, P.glow);
    sparkle(ctx, 14, 12, 3, P.glow);
    face(ctx, 64, 32, 5.2, P.blush);
  },
};

/** Paint all 8 species textures (idempotent). */
export function paintFish(scene: Phaser.Scene): void {
  (Object.keys(PAINTERS) as FishId[]).forEach((id) => {
    paintTexture(scene, FISH_KEYS[id], FISH_ICON.w, FISH_ICON.h, (ctx) => PAINTERS[id](ctx));
  });
}
