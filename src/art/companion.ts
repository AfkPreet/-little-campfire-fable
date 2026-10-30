/**
 * Puttu, the companion (Indian spotted chevrotain): texture painters and part geometry.
 * 64 px tall at 1x. Every part is its own texture so the rig in entities/Companion.ts animates each one.
 * Faces +x by default. Spots (not stripes) on the back, ears up, a nub tail: never a small Chikki.
 */
import Phaser from 'phaser';
import { PALETTE, alpha, outline, shade } from '@/config/palette';
import { type Ctx, blushOval, contactShadow, ellipsePath, fillOutlined, kawaiiEye, paintTexture, roundRectPath } from '@/art/pipeline';

export const COMP_KEYS = {
  body: 'comp-body',
  head: 'comp-head',
  eyesOpen: 'comp-eyes-open',
  eyesClosed: 'comp-eyes-closed',
  ear: 'comp-ear',
  leg: 'comp-leg',
  legsTucked: 'comp-legs-tucked',
  shadow: 'comp-shadow',
} as const;

/** Logical sizes and anchor points of the parts (the rig reads these). */
export const COMP = {
  body: { w: 52, h: 36, cx: 26, cy: 19, rx: 20, ry: 11.5 },
  head: { w: 36, h: 32, cx: 17, cy: 16, r: 11.5, eyeL: [11.5, 15] as const, eyeR: [23, 14.5] as const, eyeR_: 4.3, eyeRy: 5.2 },
  ear: { w: 16, h: 20 },
  leg: { w: 10, h: 16 },
  tucked: { w: 44, h: 12 },
  shadow: { w: 56, h: 14 },
} as const;

const FUR = PALETTE.bark;
const HOOF = shade(PALETTE.bark, -0.35);
const NOSE = shade(PALETTE.bark, -0.45);

function paintBody(ctx: Ctx): void {
  const { cx, cy, rx, ry } = COMP.body;
  // nub tail, tucked behind the rump
  ellipsePath(ctx, cx - rx + 2, cy - 6, 3.2, 3);
  fillOutlined(ctx, FUR, 2);
  // the bean
  ellipsePath(ctx, cx, cy, rx, ry);
  ctx.fillStyle = FUR;
  ctx.fill();
  ctx.save();
  ellipsePath(ctx, cx, cy, rx, ry);
  ctx.clip();
  // cream belly
  ellipsePath(ctx, cx + 2, cy + 10.5, 12, 6);
  ctx.fillStyle = PALETTE.cream;
  ctx.fill();
  // two rows of cream spots following the back
  for (let row = 0; row < 2; row++) {
    const n = row === 0 ? 5 : 4, off = row === 0 ? 3.2 : 6.6;
    for (let i = 0; i < n; i++) {
      const x = cx - 13 + (i + (row ? 0.5 : 0)) * 6.5;
      const dy = ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
      ellipsePath(ctx, x, cy - dy + off, 1.9, 1.4);
      ctx.fill();
    }
  }
  // three short flank stripes toward the rump
  ctx.strokeStyle = PALETTE.cream;
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const y = cy - 1 + i * 3;
    ctx.beginPath();
    ctx.moveTo(cx - 15, y);
    ctx.lineTo(cx - 8, y);
    ctx.stroke();
  }
  ctx.restore();
  ellipsePath(ctx, cx, cy, rx, ry);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = outline(FUR);
  ctx.stroke();
}

function paintHead(ctx: Ctx): void {
  const { cx, cy, r } = COMP.head;
  ellipsePath(ctx, cx, cy, r + 1, r);
  ctx.fillStyle = FUR;
  ctx.fill();
  ctx.save();
  ellipsePath(ctx, cx, cy, r + 1, r);
  ctx.clip();
  // cream muzzle patch toward the snout
  ellipsePath(ctx, cx + 9, cy + 7, 6, 4);
  ctx.fillStyle = PALETTE.cream;
  ctx.fill();
  ctx.restore();
  ellipsePath(ctx, cx, cy, r + 1, r);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = outline(FUR);
  ctx.stroke();
  // nose dot and a tiny mouth
  ellipsePath(ctx, cx + 11.5, cy + 4.5, 1.7, 1.4);
  ctx.fillStyle = NOSE;
  ctx.fill();
  ctx.strokeStyle = alpha(PALETTE.ink, 0.7);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx + 9.5, cy + 7.2, 2.2, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  blushOval(ctx, cx - 8, cy + 6, 3, 1.8, PALETTE.blush);
  blushOval(ctx, cx + 3, cy + 6.5, 2.6, 1.5, PALETTE.blush);
}

function paintEyes(ctx: Ctx, open: number): void {
  const { eyeL, eyeR, eyeR_, eyeRy } = COMP.head;
  kawaiiEye(ctx, eyeL[0], eyeL[1], eyeR_, eyeRy, PALETTE.ink, PALETTE.cream, open);
  kawaiiEye(ctx, eyeR[0], eyeR[1], eyeR_, eyeRy, PALETTE.ink, PALETTE.cream, open);
}

function paintEar(ctx: Ctx, w: number, h: number): void {
  ellipsePath(ctx, w / 2, h / 2 + 1, 6, 8.5);
  fillOutlined(ctx, FUR, 2);
  ellipsePath(ctx, w / 2, h / 2 + 2, 3.4, 5.5);
  ctx.fillStyle = PALETTE.peach;
  ctx.fill();
}

function paintLeg(ctx: Ctx, w: number, h: number): void {
  roundRectPath(ctx, w / 2 - 2.5, 1, 5, h - 4, 2.5);
  fillOutlined(ctx, FUR, 1.8);
  roundRectPath(ctx, w / 2 - 3, h - 5, 6, 4.5, 2);
  fillOutlined(ctx, HOOF, 1.5, 0.2);
}

function paintTucked(ctx: Ctx): void {
  // folded legs seen from the side: two flat capsules with hoof nubs toward the front
  roundRectPath(ctx, 4, 2, 24, 8, 4);
  fillOutlined(ctx, FUR, 1.8);
  roundRectPath(ctx, 20, 3, 20, 7.5, 3.75);
  fillOutlined(ctx, FUR, 1.8);
  ellipsePath(ctx, 26, 8.2, 3.2, 2.3);
  fillOutlined(ctx, HOOF, 1.4, 0.2);
  ellipsePath(ctx, 38, 7.8, 3.5, 2.5);
  fillOutlined(ctx, HOOF, 1.4, 0.2);
}

/** Paint every Puttu texture once (stable 'comp-' keys). Safe to call from any scene. */
export function paintCompanionTextures(scene: Phaser.Scene): void {
  paintTexture(scene, COMP_KEYS.body, COMP.body.w, COMP.body.h, (ctx) => paintBody(ctx));
  paintTexture(scene, COMP_KEYS.head, COMP.head.w, COMP.head.h, (ctx) => paintHead(ctx));
  paintTexture(scene, COMP_KEYS.eyesOpen, COMP.head.w, COMP.head.h, (ctx) => paintEyes(ctx, 1));
  paintTexture(scene, COMP_KEYS.eyesClosed, COMP.head.w, COMP.head.h, (ctx) => paintEyes(ctx, 0));
  paintTexture(scene, COMP_KEYS.ear, COMP.ear.w, COMP.ear.h, (ctx, w, h) => paintEar(ctx, w, h));
  paintTexture(scene, COMP_KEYS.leg, COMP.leg.w, COMP.leg.h, (ctx, w, h) => paintLeg(ctx, w, h));
  paintTexture(scene, COMP_KEYS.legsTucked, COMP.tucked.w, COMP.tucked.h, (ctx) => paintTucked(ctx));
  paintTexture(scene, COMP_KEYS.shadow, COMP.shadow.w, COMP.shadow.h, (ctx, w, h) => contactShadow(ctx, w / 2, h / 2, w / 2 - 2, h / 2 - 1, PALETTE.ink, 0.16));
}
