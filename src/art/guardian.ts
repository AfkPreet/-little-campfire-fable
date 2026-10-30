/**
 * Bangari, the guardian (ancient humpback mahseer): texture painters.
 * The body is 900x420 logical (one large texture, painted once). Scales are a separate overlay so they can pulse,
 * fins and barbels are separate parts so they sway, and the halo is a soft glow for additive blending.
 * The fish faces +x (the jetty) by default.
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { type Ctx, blobPath, blushOval, ellipsePath, linearGradient, paintTexture, radialGradient, softGlow } from '@/art/pipeline';

export const GUARD_KEYS = {
  body: 'guard-body',
  scales: 'guard-scales',
  eyeHalf: 'guard-eye-half',
  eyeClosed: 'guard-eye-closed',
  mouth: 'guard-mouth',
  mouthOpen: 'guard-mouth-open',
  barbelA: 'guard-barbel-a',
  barbelB: 'guard-barbel-b',
  fin: 'guard-fin',
  halo: 'guard-halo',
  bubble: 'guard-bubble',
  sheet: 'guard-sheet',
} as const;

/** Body texture size and part anchors in body-texture coordinates (the rig subtracts the center). */
export const GUARD = {
  body: { w: 900, h: 420, cx: 450, cy: 210 },
  eye: { w: 72, h: 54, at: [792, 172] as const },
  mouth: { w: 120, h: 44, at: [818, 270] as const },
  barbel: { a: { w: 80, h: 230 }, b: { w: 70, h: 190 }, root: [846, 298] as const },
  fin: { w: 150, h: 210 },
  halo: { w: 400, h: 400 },
  bubble: { w: 18, h: 18 },
  sheet: { w: 70, h: 18 },
  anchors: {
    dorsal: [630, 62] as const,
    pectoral: [700, 318] as const,
    tail: [176, 226] as const,
    bubbles: [630, 60] as const,
  },
} as const;

const HUMP = ACCENTS.marigold;
const BODY_LINE = outline(HUMP);
const SCALE_LINE = mix(HUMP, PALETTE.ember, 0.45);
const LID = mix(HUMP, PALETTE.butter, 0.65);

/** Tail (narrow, left) to a deep belly and a high hump, then a round head and snout (right). */
const BODY_PTS: Array<[number, number]> = [
  [182, 186], [164, 226], [184, 268], [250, 330], [360, 382], [500, 402], [640, 396], [760, 372],
  [840, 330], [880, 262], [876, 190], [830, 118], [750, 66], [650, 42], [540, 48], [420, 70], [300, 112], [220, 152],
];

function bodyPath(ctx: Ctx): void {
  blobPath(ctx, BODY_PTS);
}

function paintBody(ctx: Ctx, w: number, h: number): void {
  bodyPath(ctx);
  ctx.fillStyle = linearGradient(ctx, 0, 44, 0, 400, [[0, HUMP], [0.5, PALETTE.butter], [1, PALETTE.glow]]);
  ctx.fill();
  ctx.save();
  bodyPath(ctx);
  ctx.clip();
  // belly sheen and a soft rim light along the hump
  ellipsePath(ctx, 540, 350, 300, 48);
  ctx.fillStyle = alpha(PALETTE.cream, 0.28);
  ctx.fill();
  ctx.strokeStyle = alpha(PALETTE.cream, 0.3);
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(360, 108);
  ctx.quadraticCurveTo(600, 52, 760, 104);
  ctx.stroke();
  // gill curve behind the head
  ctx.strokeStyle = alpha(BODY_LINE, 0.6);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(744, 140);
  ctx.quadraticCurveTo(708, 245, 740, 350);
  ctx.stroke();
  blushOval(ctx, 790, 236, 30, 16, PALETTE.blush);
  ctx.restore();
  bodyPath(ctx);
  ctx.lineWidth = 3;
  ctx.strokeStyle = BODY_LINE;
  ctx.stroke();
  void w; void h;
}

/** 5x3 grid of round scales, lit like paper lanterns; the rig pulses this overlay's alpha. */
function paintScales(ctx: Ctx): void {
  ctx.save();
  bodyPath(ctx);
  ctx.clip();
  const r = 44;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const cx = 300 + col * 95 + (row % 2 ? 47 : 0), cy = 150 + row * 90;
      ctx.fillStyle = radialGradient(ctx, cx, cy - r * 0.2, 0, r, [
        [0, alpha(PALETTE.cream, 0.6)],
        [0.55, alpha(PALETTE.glow, 0.42)],
        [1, alpha(PALETTE.glow, 0.12)],
      ]);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = alpha(SCALE_LINE, 0.9);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function paintEye(ctx: Ctx, w: number, h: number, closed: boolean): void {
  const cx = w / 2, cy = h / 2 + 3;
  if (closed) {
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy + 2);
    ctx.quadraticCurveTo(cx, cy - 8, cx + 22, cy);
    ctx.stroke();
    return;
  }
  ellipsePath(ctx, cx, cy, 24, 18);
  ctx.fillStyle = PALETTE.ink;
  ctx.fill();
  // sleepy half lid: a relaxed arch, never a dip, a touch lower at the tail-side corner
  const lid = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy + 1);
    ctx.quadraticCurveTo(cx - 2, cy - 8, cx + 26, cy - 4);
  };
  ctx.save();
  ellipsePath(ctx, cx, cy, 25.5, 19.5);
  ctx.clip();
  lid();
  ctx.lineTo(cx + 30, cy - 26);
  ctx.lineTo(cx - 30, cy - 26);
  ctx.closePath();
  ctx.fillStyle = LID;
  ctx.fill();
  ctx.restore();
  lid();
  ctx.strokeStyle = BODY_LINE;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = PALETTE.cream;
  ellipsePath(ctx, cx - 7, cy + 7, 5.5, 4.2);
  ctx.fill();
  ellipsePath(ctx, cx + 9, cy + 11, 2.6, 2);
  ctx.fill();
}

function paintMouth(ctx: Ctx, w: number, h: number, open: boolean): void {
  const line = shade(HUMP, -0.4);
  if (open) {
    ellipsePath(ctx, w / 2, 27, 16, 8);
    ctx.fillStyle = mix(PALETTE.ink, ACCENTS.jamun, 0.5);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = line;
    ctx.stroke();
  }
  ctx.strokeStyle = line;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(12, 14);
  ctx.quadraticCurveTo(w / 2, open ? 30 : 38, w - 14, 6);
  ctx.stroke();
  void h;
}

/** A soft ribbon hanging from the top center of its texture, tapering to a rounded tip. */
function paintBarbel(ctx: Ctx, w: number, h: number, wave: number): void {
  const n = 24, left: Array<[number, number]> = [], right: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const y = 6 + s * (h - 14);
    const x = w / 2 + Math.sin(s * Math.PI * 1.5) * s * wave;
    const half = (22 * (1 - s) + 6) / 2;
    left.push([x - half, y]);
    right.push([x + half, y]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const [x, y] of left) ctx.lineTo(x, y);
  const tip = right[n];
  ctx.quadraticCurveTo((left[n][0] + tip[0]) / 2, tip[1] + 4, tip[0], tip[1]);
  for (let i = n; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fillStyle = linearGradient(ctx, 0, 0, 0, h, [[0, PALETTE.butter], [1, PALETTE.glow]]);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline(PALETTE.butter, 0.28);
  ctx.stroke();
  // a cream highlight down the ribbon's center
  ctx.strokeStyle = alpha(PALETTE.cream, 0.5);
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const [lx, ly] = left[i], [rx] = right[i];
    if (i === 0) ctx.moveTo((lx + rx) / 2, ly + 6);
    else ctx.lineTo((lx + rx) / 2, ly);
  }
  ctx.stroke();
}

/** One lotus petal: pointed tip up, rounded base at the bottom center. Displayed at 40% alpha by the rig. */
function petalPath(ctx: Ctx, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(w / 2, 8);
  ctx.bezierCurveTo(w - 6, 64, w - 2, 150, w / 2 + 30, h - 10);
  ctx.quadraticCurveTo(w / 2, h + 2, w / 2 - 30, h - 10);
  ctx.bezierCurveTo(2, 150, 6, 64, w / 2, 8);
  ctx.closePath();
}
function paintFin(ctx: Ctx, w: number, h: number): void {
  petalPath(ctx, w, h);
  ctx.fillStyle = PALETTE.lavender;
  ctx.fill();
  ctx.strokeStyle = alpha(PALETTE.cream, 0.45);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w / 2, 30);
  ctx.lineTo(w / 2, h - 22);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = alpha(PALETTE.cream, 0.3);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 30);
    ctx.quadraticCurveTo(w / 2 + side * 30, 110, w / 2 + side * 16, 48);
    ctx.stroke();
  }
  petalPath(ctx, w, h);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = outline(PALETTE.lavender);
  ctx.stroke();
}

function paintBubble(ctx: Ctx, w: number, h: number): void {
  ctx.strokeStyle = alpha(PALETTE.cream, 0.85);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 6.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = alpha(PALETTE.cream, 0.9);
  ellipsePath(ctx, w / 2 - 2.5, h / 2 - 2.5, 1.6, 1.2);
  ctx.fill();
}

function paintSheet(ctx: Ctx, w: number, h: number): void {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(1, h / w);
  softGlow(ctx, 0, 0, w / 2, PALETTE.cream, 0.95);
  ctx.restore();
}

/** Paint every Bangari texture once (stable 'guard-' keys). */
export function paintGuardianTextures(scene: Phaser.Scene): void {
  paintTexture(scene, GUARD_KEYS.body, GUARD.body.w, GUARD.body.h, paintBody);
  paintTexture(scene, GUARD_KEYS.scales, GUARD.body.w, GUARD.body.h, (ctx) => paintScales(ctx));
  paintTexture(scene, GUARD_KEYS.eyeHalf, GUARD.eye.w, GUARD.eye.h, (ctx, w, h) => paintEye(ctx, w, h, false));
  paintTexture(scene, GUARD_KEYS.eyeClosed, GUARD.eye.w, GUARD.eye.h, (ctx, w, h) => paintEye(ctx, w, h, true));
  paintTexture(scene, GUARD_KEYS.mouth, GUARD.mouth.w, GUARD.mouth.h, (ctx, w, h) => paintMouth(ctx, w, h, false));
  paintTexture(scene, GUARD_KEYS.mouthOpen, GUARD.mouth.w, GUARD.mouth.h, (ctx, w, h) => paintMouth(ctx, w, h, true));
  paintTexture(scene, GUARD_KEYS.barbelA, GUARD.barbel.a.w, GUARD.barbel.a.h, (ctx, w, h) => paintBarbel(ctx, w, h, 20));
  paintTexture(scene, GUARD_KEYS.barbelB, GUARD.barbel.b.w, GUARD.barbel.b.h, (ctx, w, h) => paintBarbel(ctx, w, h, -16));
  paintTexture(scene, GUARD_KEYS.fin, GUARD.fin.w, GUARD.fin.h, paintFin);
  paintTexture(scene, GUARD_KEYS.halo, GUARD.halo.w, GUARD.halo.h, (ctx, w, h) => softGlow(ctx, w / 2, h / 2, w / 2 - 4, PALETTE.glow, 0.8));
  paintTexture(scene, GUARD_KEYS.bubble, GUARD.bubble.w, GUARD.bubble.h, paintBubble);
  paintTexture(scene, GUARD_KEYS.sheet, GUARD.sheet.w, GUARD.sheet.h, paintSheet);
}
