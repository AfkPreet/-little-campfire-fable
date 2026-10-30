/**
 * Bangari, the guardian (ancient humpback mahseer): texture painters.
 * The body is 900x420 logical (one large texture, painted once): a plump fish with a gentle hump behind the head,
 * a rounded head, a tapered peduncle, static roof-tile scallop scales and the face's blush. The pulsing lantern
 * light on alternating scallops is a separate overlay, the forked tail fin and the low dorsal fin are separate
 * parts so they sway, the pectoral is a lotus petal, the barbels drift from the mouth corners, and the halo is a
 * soft glow for additive blending. The fish faces +x (the jetty) by default.
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
  tailFin: 'guard-tail-fin',
  dorsalFin: 'guard-dorsal-fin',
  halo: 'guard-halo',
  bubble: 'guard-bubble',
  sheet: 'guard-sheet',
} as const;

/** Body texture size and part anchors in body-texture coordinates (the rig subtracts the center). */
export const GUARD = {
  body: { w: 900, h: 420, cx: 450, cy: 210 },
  eye: { w: 110, h: 88, at: [800, 206] as const },
  mouth: { w: 150, h: 44, at: [814, 296] as const },
  /** barbel A hangs from the front mouth corner (root), barbel B from the back corner (rootB) */
  barbel: { a: { w: 80, h: 230 }, b: { w: 70, h: 190 }, root: [872, 290] as const, rootB: [754, 298] as const },
  fin: { w: 150, h: 210 },
  /** forked tail fin, origin at the peduncle joint on its right edge */
  tailFin: { w: 250, h: 320, origin: [0.944, 0.5] as const },
  /** low rounded dorsal fin, origin at the middle of its (buried) base */
  dorsalFin: { w: 260, h: 120, origin: [0.5, 0.95] as const },
  halo: { w: 400, h: 400 },
  bubble: { w: 18, h: 18 },
  sheet: { w: 70, h: 18 },
  anchors: {
    dorsal: [600, 82] as const,
    pectoral: [690, 356] as const,
    tail: [230, 214] as const,
    bubbles: [600, 56] as const,
  },
} as const;

type Pt = [number, number];

const HUMP = ACCENTS.marigold;
const BODY_LINE = shade(HUMP, -0.28);
const SCALE_LINE = mix(HUMP, PALETTE.ember, 0.45);
const LID = mix(HUMP, PALETTE.butter, 0.35);
const FIN_FILL = alpha(PALETTE.lavender, 0.5);
const FIN_ROOT = alpha(mix(PALETTE.lavender, PALETTE.glow, 0.5), 0.62);

/**
 * Peduncle (narrow, left) along the back up to the hump (peak about 35% back from the nose), down over a rounded
 * head to the nose (right), under the chin and along a deep belly back to the peduncle.
 */
const BODY_PTS: Pt[] = [
  [214, 176], [272, 124], [360, 78], [460, 48], [565, 38], [665, 46], [752, 74], [828, 120], [874, 186], [886, 250],
  [866, 314], [816, 362], [732, 394], [612, 406], [484, 402], [364, 372], [284, 318], [232, 256], [208, 214],
];

function bodyPath(ctx: Ctx): void {
  blobPath(ctx, BODY_PTS);
}

/** Roof-tile scallop grid over the mid body. */
const SCALE = { r: 34, rowGap: 24, x0: 240, y0: 96, cols: 9, rows: 10, fade: { cx: 505, cy: 200, rx: 300, ry: 130 } };

/** Visit every scallop: center, column/row and a 0..1 presence that fades toward the belly and the edges. */
function eachScallop(fn: (cx: number, cy: number, col: number, row: number, a: number) => void): void {
  const { r, rowGap, x0, y0, cols, rows, fade } = SCALE;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = x0 + col * r * 2 + (row % 2 ? r : 0), cy = y0 + row * rowGap;
      const dist = Math.hypot((cx - fade.cx) / fade.rx, (cy - fade.cy) / fade.ry);
      const a = Math.min(1, Math.max(0, (1.25 - dist) / 0.9));
      if (a > 0.02) fn(cx, cy, col, row, a * a * (3 - 2 * a));
    }
  }
}

/** The visible lower arc of one scallop: it starts and ends exactly where the two scallops above overlap it. */
function scallopArc(ctx: Ctx, cx: number, cy: number): void {
  const { r, rowGap } = SCALE;
  const d = Math.hypot(r, rowGap);
  const th0 = Math.atan2(-rowGap, r) + Math.acos(d / (2 * r));
  ctx.beginPath();
  ctx.arc(cx, cy, r, th0, Math.PI - th0);
}

function paintBody(ctx: Ctx, w: number, h: number): void {
  bodyPath(ctx);
  ctx.fillStyle = linearGradient(ctx, 0, 38, 0, 406, [[0, HUMP], [0.5, PALETTE.butter], [1, PALETTE.glow]]);
  ctx.fill();
  ctx.save();
  bodyPath(ctx);
  ctx.clip();
  // belly sheen and a soft rim light along the hump
  ellipsePath(ctx, 560, 352, 290, 44);
  ctx.fillStyle = alpha(PALETTE.cream, 0.28);
  ctx.fill();
  ctx.strokeStyle = alpha(PALETTE.cream, 0.3);
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(380, 96);
  ctx.quadraticCurveTo(580, 30, 760, 86);
  ctx.stroke();
  // scallop scales like roof tiles: each outlined in a warmer shade at ~40%, with a faint cream lip on the tile edge
  eachScallop((cx, cy, _col, _row, a) => {
    scallopArc(ctx, cx, cy);
    ctx.lineWidth = 3;
    ctx.strokeStyle = alpha(SCALE_LINE, 0.5 * a);
    ctx.stroke();
    ctx.save();
    ctx.translate(0, -3.5);
    scallopArc(ctx, cx, cy);
    ctx.restore();
    ctx.lineWidth = 2;
    ctx.strokeStyle = alpha(PALETTE.cream, 0.3 * a);
    ctx.stroke();
  });
  // gill curve behind the head
  ctx.strokeStyle = alpha(BODY_LINE, 0.55);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(754, 142);
  ctx.quadraticCurveTo(716, 250, 748, 356);
  ctx.stroke();
  blushOval(ctx, 788, 262, 34, 17, PALETTE.blush);
  ctx.restore();
  bodyPath(ctx);
  ctx.lineWidth = 3;
  ctx.strokeStyle = BODY_LINE;
  ctx.stroke();
  void w; void h;
}

/** Paper-lantern light on alternating scallops; the rig pulses this overlay's alpha. */
function paintScales(ctx: Ctx): void {
  ctx.save();
  bodyPath(ctx);
  ctx.clip();
  const { r } = SCALE;
  eachScallop((cx, cy, col, row, a) => {
    if ((col + row) % 2) return;
    ctx.fillStyle = radialGradient(ctx, cx, cy + 6, 0, r * 1.1, [
      [0, alpha(PALETTE.cream, 0.65 * a)],
      [0.5, alpha(PALETTE.glow, 0.4 * a)],
      [1, alpha(PALETTE.glow, 0)],
    ]);
    scallopArc(ctx, cx, cy);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

/** Big sleepy half-closed eye: ink oval under a heavy soft lid, cream highlights; or a relaxed closed line. */
function paintEye(ctx: Ctx, w: number, h: number, closed: boolean): void {
  const cx = w / 2, cy = h / 2 + 3, rx = 40, ry = 32;
  if (closed) {
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.94, cy + 4);
    ctx.quadraticCurveTo(cx, cy - 10, cx + rx * 0.94, cy + 1);
    ctx.stroke();
    return;
  }
  ellipsePath(ctx, cx, cy, rx, ry);
  ctx.fillStyle = PALETTE.ink;
  ctx.fill();
  // the lid: a relaxed arch, never a dip, a touch lower at the tail-side corner; covers the top ~45%
  const lid = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.12, cy + 3);
    ctx.quadraticCurveTo(cx - 2, cy - ry * 0.4, cx + rx * 1.12, cy - 2);
  };
  ctx.save();
  ellipsePath(ctx, cx, cy, rx + 1.5, ry + 1.5);
  ctx.clip();
  lid();
  ctx.lineTo(cx + rx * 1.3, cy - ry * 1.5);
  ctx.lineTo(cx - rx * 1.3, cy - ry * 1.5);
  ctx.closePath();
  ctx.fillStyle = LID;
  ctx.fill();
  ctx.restore();
  lid();
  ctx.lineCap = 'round';
  ctx.strokeStyle = BODY_LINE;
  ctx.lineWidth = 4.5;
  ctx.stroke();
  // a soft crease above the lid edge makes it heavy
  ctx.strokeStyle = alpha(BODY_LINE, 0.35);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.88, cy - 6);
  ctx.quadraticCurveTo(cx - 2, cy - ry * 0.66, cx + rx * 0.88, cy - 10);
  ctx.stroke();
  // one lash tick at the front corner
  ctx.strokeStyle = BODY_LINE;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx + rx * 1.06, cy - 2);
  ctx.lineTo(cx + rx * 1.3, cy - 9);
  ctx.stroke();
  ctx.fillStyle = PALETTE.cream;
  ellipsePath(ctx, cx - rx * 0.3, cy + ry * 0.3, rx * 0.22, ry * 0.22);
  ctx.fill();
  ellipsePath(ctx, cx + rx * 0.38, cy + ry * 0.48, rx * 0.1, ry * 0.1);
  ctx.fill();
}

/** A wide, calm closed mouth curving into a faint smile (corners a touch higher than the middle). */
function paintMouth(ctx: Ctx, w: number, h: number, open: boolean): void {
  const line = shade(HUMP, -0.4);
  const yBack = 16, yFront = 10, dip = 34;
  if (open) {
    ellipsePath(ctx, w * 0.56, 26, 15, 8);
    ctx.fillStyle = mix(PALETTE.ink, ACCENTS.jamun, 0.5);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = line;
    ctx.stroke();
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = line;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(10, yBack);
  ctx.quadraticCurveTo(w / 2, open ? 28 : dip, w - 14, yFront);
  ctx.stroke();
  // soft lower-lip highlight
  ctx.strokeStyle = alpha(PALETTE.cream, 0.35);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(22, yBack + 5);
  ctx.quadraticCurveTo(w / 2, (open ? 28 : dip) + 5, w - 26, yFront + 5);
  ctx.stroke();
  void h;
}

/** A soft, slim ribbon hanging from the top center of its texture, waving gently and tapering to a rounded tip. */
function paintBarbel(ctx: Ctx, w: number, h: number, wave: number): void {
  const n = 24, left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const y = 6 + s * (h - 14);
    const x = w / 2 + Math.sin(s * Math.PI * 1.7) * s * wave;
    const half = (15 * (1 - s) + 5) / 2;
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
  ctx.fillStyle = linearGradient(ctx, 0, 0, 0, h, [[0, alpha(PALETTE.butter, 0.95)], [1, alpha(PALETTE.glow, 0.8)]]);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = alpha(outline(PALETTE.butter, 0.28), 0.7);
  ctx.stroke();
  // a cream highlight down the ribbon's center
  ctx.strokeStyle = alpha(PALETTE.cream, 0.45);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const [lx, ly] = left[i], [rx] = right[i];
    if (i === 0) ctx.moveTo((lx + rx) / 2, ly + 6);
    else ctx.lineTo((lx + rx) / 2, ly);
  }
  ctx.stroke();
}

/** One lotus petal (the pectoral fin): pointed tip up, rounded base at the bottom center. Shown at 40% alpha by the rig. */
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

/** Translucent lavender membrane with soft cream rays and a glow-colored rim (the texture carries its own alpha). */
function finMembrane(ctx: Ctx, shape: () => void, fill: CanvasGradient, rays: Array<[Pt, Pt, Pt]>): void {
  shape();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  shape();
  ctx.clip();
  ctx.strokeStyle = alpha(PALETTE.cream, 0.3);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (const [a, c, b] of rays) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]);
    ctx.stroke();
  }
  ctx.restore();
  shape();
  ctx.lineWidth = 7;
  ctx.strokeStyle = alpha(PALETTE.glow, 0.18);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = alpha(PALETTE.glow, 0.85);
  ctx.stroke();
}

/** Large soft forked tail fin: two rounded lobes opening to the left, the joint buried in the peduncle on the right. */
function paintTailFin(ctx: Ctx, w: number, h: number): void {
  const jx = w * GUARD.tailFin.origin[0], jy = h / 2;
  const lobes: Pt[] = [
    [jx, jy - 42], [182, 96], [112, 40], [54, 22], [22, 58], [34, 112], [90, 148], [130, jy],
    [90, 172], [34, 208], [22, 262], [54, 298], [112, 280], [182, 224], [jx, jy + 42],
  ];
  const shape = (): void => blobPath(ctx, lobes);
  const fill = linearGradient(ctx, 0, 0, jx, 0, [[0, FIN_FILL], [0.78, FIN_FILL], [1, FIN_ROOT]]);
  finMembrane(ctx, shape, fill, [
    [[jx - 12, jy - 6], [150, 110], [52, 56]],
    [[jx - 12, jy - 2], [140, 130], [48, 104]],
    [[jx - 12, jy + 2], [140, 190], [48, 216]],
    [[jx - 12, jy + 6], [150, 210], [52, 264]],
  ]);
}

/** Low rounded dorsal fin on the hump, a touch taller toward the front; its straight base is buried under the back. */
function paintDorsalFin(ctx: Ctx, w: number, h: number): void {
  const pts: Pt[] = [[14, h - 2], [26, 82], [66, 40], [128, 16], [192, 8], [236, 28], [w - 10, h - 2]];
  const shape = (): void => blobPath(ctx, pts);
  const fill = linearGradient(ctx, 0, 0, 0, h, [[0, FIN_FILL], [0.7, FIN_FILL], [1, FIN_ROOT]]);
  const base: Pt = [w / 2 + 10, h];
  finMembrane(ctx, shape, fill, [
    [base, [80, 86], [44, 70]],
    [base, [100, 60], [86, 36]],
    [base, [140, 50], [146, 22]],
    [base, [180, 52], [206, 22]],
  ]);
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
  paintTexture(scene, GUARD_KEYS.tailFin, GUARD.tailFin.w, GUARD.tailFin.h, paintTailFin);
  paintTexture(scene, GUARD_KEYS.dorsalFin, GUARD.dorsalFin.w, GUARD.dorsalFin.h, paintDorsalFin);
  paintTexture(scene, GUARD_KEYS.halo, GUARD.halo.w, GUARD.halo.h, (ctx, w, h) => softGlow(ctx, w / 2, h / 2, w / 2 - 4, PALETTE.glow, 0.8));
  paintTexture(scene, GUARD_KEYS.bubble, GUARD.bubble.w, GUARD.bubble.h, paintBubble);
  paintTexture(scene, GUARD_KEYS.sheet, GUARD.sheet.w, GUARD.sheet.h, paintSheet);
}
