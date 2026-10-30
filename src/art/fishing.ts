/**
 * fishing.ts: the fishing props. A bamboo rod that sits in the hero's heldSlot (grip at the hold point, tip up-right),
 * a cream-and-rose bobber, a ripple ring for landings and bites, and a Graphics line helper used only while the
 * bobber moves (cast arc, reel). Textures 'fishing-*', painted once at 2x.
 */
import Phaser from 'phaser';
import { PALETTE, alpha, hexToInt, mix, outline, shade } from '@/config/palette';
import { type Ctx, ellipsePath, fillOutlined, makeImg, paintTexture, sheen } from '@/art/pipeline';

const P = PALETTE;

export const FISHING_KEYS = { rod: 'fishing-rod', bobber: 'fishing-bobber', ring: 'fishing-ring' } as const;

/** Rod texture box and where the grip / tip sit inside it (logical px). */
export const ROD_ART = {
  w: 72, h: 84,
  grip: { x: 8, y: 78 },
  tip: { x: 66, y: 6 },
} as const;
/** Rod tip offset from the hold point in rig space (hero facing right). */
export const ROD_TIP = { x: ROD_ART.tip.x - ROD_ART.grip.x, y: ROD_ART.tip.y - ROD_ART.grip.y } as const;

export const BOBBER_ART = { w: 18, h: 24 } as const;
export const RING_ART = { w: 64, h: 28 } as const;
export const LINE = { color: hexToInt(P.cream), alpha: 0.85, width: 2 } as const;

const ROD_FILL = mix(P.butter, P.bark, 0.4);

function paintRod(ctx: Ctx): void {
  const g = ROD_ART.grip, t = ROD_ART.tip;
  // shaft: tapered cane with a gentle bow
  ctx.lineCap = 'round';
  ctx.strokeStyle = outline(ROD_FILL);
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.quadraticCurveTo(g.x + 36, g.y - 46, t.x, t.y);
  ctx.stroke();
  ctx.strokeStyle = ROD_FILL;
  ctx.lineWidth = 3.8;
  ctx.stroke();
  // cane nodes
  ctx.strokeStyle = alpha(outline(ROD_FILL), 0.7);
  ctx.lineWidth = 1.5;
  for (const k of [0.3, 0.55, 0.78]) {
    const x = g.x + (t.x - g.x) * k, y = g.y + (t.y - g.y) * k - 10 * Math.sin(Math.PI * k);
    ctx.beginPath(); ctx.moveTo(x - 2.5, y - 2); ctx.lineTo(x + 2.5, y + 2); ctx.stroke();
  }
  // grip wrap
  ctx.strokeStyle = shade(P.bark, -0.1);
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + 9, g.y - 11); ctx.stroke();
  ctx.strokeStyle = mix(P.bark, P.cream, 0.15);
  ctx.lineWidth = 4;
  ctx.stroke();
  // tip eyelet
  ctx.strokeStyle = outline(ROD_FILL);
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(t.x, t.y, 2.2, 0, Math.PI * 2); ctx.stroke();
}

function paintBobber(ctx: Ctx): void {
  const cx = BOBBER_ART.w / 2, cy = BOBBER_ART.h / 2 + 2;
  ellipsePath(ctx, cx, cy, 7.5, 8.5);
  fillOutlined(ctx, P.cream, 2.2);
  // rose cap
  ctx.save();
  ellipsePath(ctx, cx, cy, 7.5, 8.5);
  ctx.clip();
  ctx.fillStyle = P.rose;
  ctx.fillRect(0, 0, BOBBER_ART.w, cy - 1);
  ctx.restore();
  ellipsePath(ctx, cx, cy, 7.5, 8.5);
  ctx.strokeStyle = outline(P.rose); ctx.lineWidth = 2.2; ctx.stroke();
  sheen(ctx, cx - 2, cy - 4, 2.5, 1.5, P.cream, 0.7);
  // stem
  ctx.strokeStyle = outline(P.rose); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy - 8.5); ctx.lineTo(cx, 1.5); ctx.stroke();
}

function paintRing(ctx: Ctx): void {
  ellipsePath(ctx, RING_ART.w / 2, RING_ART.h / 2, RING_ART.w / 2 - 3, RING_ART.h / 2 - 3);
  ctx.strokeStyle = alpha(P.cream, 0.9);
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

export function paintFishingTextures(scene: Phaser.Scene): void {
  paintTexture(scene, FISHING_KEYS.rod, ROD_ART.w, ROD_ART.h, paintRod);
  paintTexture(scene, FISHING_KEYS.bobber, BOBBER_ART.w, BOBBER_ART.h, paintBobber);
  paintTexture(scene, FISHING_KEYS.ring, RING_ART.w, RING_ART.h, paintRing);
}

/** Rod image for the hero's heldSlot: origin at the grip, so (0,0) is the hold point. */
export function makeRod(scene: Phaser.Scene): Phaser.GameObjects.Image {
  paintFishingTextures(scene);
  const im = makeImg(scene, 0, 0, FISHING_KEYS.rod);
  im.setOrigin(ROD_ART.grip.x / ROD_ART.w, ROD_ART.grip.y / ROD_ART.h);
  return im;
}

/** Bobber image (made, not added); origin at the float's center. */
export function makeBobber(scene: Phaser.Scene): Phaser.GameObjects.Image {
  paintFishingTextures(scene);
  return makeImg(scene, 0, 0, FISHING_KEYS.bobber).setOrigin(0.5, 0.6);
}

/** Ripple ring (made, not added). */
export function makeRing(scene: Phaser.Scene): Phaser.GameObjects.Image {
  paintFishingTextures(scene);
  return makeImg(scene, 0, 0, FISHING_KEYS.ring);
}

/** Redraw the line between two world points with a slight sag. */
export function drawLine(g: Phaser.GameObjects.Graphics, from: { x: number; y: number }, to: { x: number; y: number }, sag = 0): void {
  g.clear();
  g.lineStyle(LINE.width, LINE.color, LINE.alpha);
  g.beginPath();
  g.moveTo(from.x, from.y);
  const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2 + sag;
  const c = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(from.x, from.y), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(to.x, to.y));
  const pts = c.getPoints(12);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.strokePath();
}

/** Point on the cast arc from `from` to `to` at t in [0,1] (apex `lift` px above the higher end). */
export function arcPoint(from: { x: number; y: number }, to: { x: number; y: number }, t: number, lift: number, out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
  const cx = (from.x + to.x) / 2, cy = Math.min(from.y, to.y) - lift;
  const u = 1 - t;
  out.x = u * u * from.x + 2 * u * t * cx + t * t * to.x;
  out.y = u * u * from.y + 2 * u * t * cy + t * t * to.y;
  return out;
}
