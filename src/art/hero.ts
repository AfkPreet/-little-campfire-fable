/**
 * Chikki, the hero (Indian palm squirrel): every part painted once into 'hero-*' textures at logical size.
 * ART_BIBLE section 5. Fur = mix(bark, cream, 0.3); belly, muzzle and stripes cream; ear inners and nose peach.
 *
 * Coordinates: RIG offsets are in "rig space": feet on the ground at (0,0), y grows downward (so parts sit at
 * negative y), hero facing right (+x). The entity flips the rig with scaleX for the other direction.
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import {
  type Ctx,
  blobPath,
  blushOval,
  contactShadow,
  ellipsePath,
  fillOutlined,
  kawaiiEye,
  paintTexture,
  sheen,
} from '@/art/pipeline';

const C = PALETTE;
export const HERO_FUR = mix(C.bark, C.cream, 0.3);
const FUR = HERO_FUR;
const FUR_FAR = shade(FUR, -0.08);
const FUR_LINE = outline(FUR);
const MOUTH_IN = shade(mix(C.rose, C.ink, 0.45), -0.1);
const LINE_W = 2.5;

export type RigPoint = { x: number; y: number };
export type HeroRig = {
  /** standing height in logical px (feet to crown) */
  height: number;
  shadow: RigPoint;
  tailBase: RigPoint;
  body: RigPoint;
  head: RigPoint;
  earL: RigPoint;
  earR: RigPoint;
  eyeL: RigPoint;
  eyeR: RigPoint;
  mouth: RigPoint;
  blushL: RigPoint;
  blushR: RigPoint;
  /** shoulder pivots */
  armL: RigPoint;
  armR: RigPoint;
  /** arm length shoulder -> paw center */
  armLength: number;
  footL: RigPoint;
  footR: RigPoint;
  /** where both paws meet in front when holding a rod, dish, basket or seed */
  hold: RigPoint;
  /** the jute sling bag (forage items arc here) */
  bag: RigPoint;
  /** head top center (hearts, sparkles, speech) */
  crown: RigPoint;
};

/** Part offsets, rig space (feet at 0,0; y up is negative; facing right). */
export const RIG: HeroRig = {
  height: 100,
  shadow: { x: 2, y: 1 },
  tailBase: { x: -15, y: -16 },
  body: { x: 0, y: -27 },
  head: { x: 4, y: -73 },
  earL: { x: -13, y: -95 },
  earR: { x: 20, y: -96 },
  eyeL: { x: -2, y: -74 },
  eyeR: { x: 15, y: -75 },
  mouth: { x: 11, y: -61 },
  blushL: { x: -11, y: -65 },
  blushR: { x: 25, y: -66 },
  armL: { x: -8, y: -39 },
  armR: { x: 8, y: -38 },
  armLength: 15,
  footL: { x: -9, y: -4 },
  footR: { x: 9, y: -4 },
  hold: { x: 23, y: -36 },
  bag: { x: 13, y: -17 },
  crown: { x: 4, y: -100 },
};

/** Stable texture keys. */
export const HERO_KEYS = {
  shadow: 'hero-shadow',
  head: 'hero-head',
  ear: 'hero-ear',
  eyeOpen: 'hero-eye-open',
  eyeHalf: 'hero-eye-half',
  eyeClosed: 'hero-eye-closed',
  eyeRound: 'hero-eye-round',
  mouthSmile: 'hero-mouth-smile',
  mouthOpen: 'hero-mouth-open',
  mouthO: 'hero-mouth-o',
  mouthMunch: 'hero-mouth-munch',
  blush: 'hero-blush',
  body: 'hero-body',
  armL: 'hero-arm-l',
  armR: 'hero-arm-r',
  foot: 'hero-foot',
  tailStraight: 'hero-tail-straight',
  tailCurl: 'hero-tail-curl',
  seed: 'hero-seed',
} as const;
export type HeroKey = (typeof HERO_KEYS)[keyof typeof HERO_KEYS];

/** Texture geometry other code needs: tail textures are anchored at the tail base, arms at the shoulder. */
export const HERO_TEX = {
  /** origin (0..1) that puts the tail base at the image position */
  tailStraightOrigin: { x: 0, y: 0 },
  tailCurlOrigin: { x: 0, y: 0 },
  /** arm origin: the shoulder pivot */
  armOrigin: { x: 0.5, y: 0.16 },
};

// ---------- small geometry helpers ----------

type Pt = [number, number];

/** Outline a union of shapes cleanly: paint all outlines first (fill+thick stroke), then all fills. */
function unionOutlined(ctx: Ctx, shapes: Array<() => void>, fill: string, width = LINE_W): void {
  const line = outline(fill);
  for (const s of shapes) {
    s();
    ctx.fillStyle = line;
    ctx.fill();
    ctx.lineWidth = width * 2;
    ctx.strokeStyle = line;
    ctx.stroke();
  }
  for (const s of shapes) {
    s();
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

/**
 * Inner/outer edges of a thick curve (centerline + half widths) as polygons for blobPath.
 * For a curve travelling upward, `inner` is the +x side (toward the body/head), `outer` the -x side.
 */
function ribbon(center: Pt[], halfW: number[]): { inner: Pt[]; outer: Pt[]; outlinePts: Pt[] } {
  const inner: Pt[] = [], outer: Pt[] = [];
  for (let i = 0; i < center.length; i++) {
    const p = center[i];
    const a = center[Math.max(0, i - 1)], b = center[Math.min(center.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    inner.push([p[0] + nx * halfW[i], p[1] + ny * halfW[i]]);
    outer.push([p[0] - nx * halfW[i], p[1] - ny * halfW[i]]);
  }
  return { inner, outer, outlinePts: [...inner, ...outer.slice().reverse()] };
}

/** Catmull-Rom spline through control points, `perSeg` samples per segment (first and last point included). */
function smoothCurve(pts: Pt[], perSeg = 6): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      const cr = (a: number, b: number, c: number, d: number): number =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
}

/** Linear interpolation of per-control-point values so they line up with smoothCurve's samples. */
function smoothValues(v: number[], perSeg = 6): number[] {
  const out: number[] = [];
  for (let i = 0; i < v.length - 1; i++) for (let k = 0; k < perSeg; k++) out.push(v[i] + (v[i + 1] - v[i]) * (k / perSeg));
  out.push(v[v.length - 1]);
  return out;
}

/** Segment index and fraction at arc-length fraction t (0..1) along a polyline. */
function alongEdge(edge: Pt[], t: number): { i: number; k: number } {
  const cum: number[] = [0];
  for (let i = 1; i < edge.length; i++) cum.push(cum[i - 1] + Math.hypot(edge[i][0] - edge[i - 1][0], edge[i][1] - edge[i - 1][1]));
  const target = t * cum[cum.length - 1];
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  return { i: i - 1, k: Math.max(0, Math.min(1, (target - cum[i - 1]) / seg)) };
}
function lerpPt(arr: Pt[], i: number, k: number): Pt {
  const a = arr[i], b = arr[Math.min(arr.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

function sampleCubic(p0: Pt, c1: Pt, c2: Pt, p1: Pt, n = 14): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push([a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]]);
  }
  return out;
}
function sampleQuad(p0: Pt, c: Pt, p1: Pt, n = 10): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
  }
  return out;
}

/** A fur stripe with tapered ends: a filled polygon around a polyline whose width eases to 0 at both ends. */
function taperedStripe(ctx: Ctx, pts: Pt[], w: number, color: string, taper = 0.24): void {
  const n = pts.length;
  const left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const hw = (w / 2) * Math.pow(Math.min(1, Math.min(t, 1 - t) / taper), 0.6);
    left.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]);
    right.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// ---------- part painters ----------

function paintShadow(scene: Phaser.Scene): void {
  paintTexture(scene, HERO_KEYS.shadow, 76, 20, (ctx, w, h) => {
    contactShadow(ctx, w / 2, h / 2, 37, 8.5, C.ink, 0.24);
  });
}

/** Head: wide flattened oval, three short cream dashes on the crown between the ears, cream muzzle, peach nose. 66x60. */
function paintHead(scene: Phaser.Scene): void {
  paintTexture(scene, HERO_KEYS.head, 66, 60, (ctx) => {
    const cx = 33, cy = 31, rx = 29, ry = 26;
    ellipsePath(ctx, cx, cy, rx, ry);
    fillOutlined(ctx, FUR, LINE_W);
    // soft sheen on the front of the crown (clear of the dashes)
    sheen(ctx, cx + 6, cy - 11, 9, 5, C.cream, 0.16);
    // three short cream dashes on the crown, front-to-back, bowing with the top edge; the face stays clean
    const dashes: Array<[number, number]> = [[9, 16], [14.5, 21], [20, 18]]; // [y at the apex, length]
    dashes.forEach(([y, len], k) => {
      const sag = 1.4 + k * 0.3;
      taperedStripe(ctx, sampleQuad([cx - len / 2, y + sag], [cx, y - sag], [cx + len / 2, y + sag]), 2.6, alpha(C.cream, 0.92), 0.3);
    });
    // cream muzzle (soft, no hard outline) and the peach nose dot
    ctx.fillStyle = C.cream;
    ellipsePath(ctx, cx + 9, cy + 9, 13, 9);
    ctx.fill();
    ctx.fillStyle = C.peach;
    ellipsePath(ctx, cx + 8, cy + 5.5, 3, 2.3);
    ctx.fill();
  });
}

/** One round ear: fur back, peach inner. 22x22, used for both ears. */
function paintEar(scene: Phaser.Scene): void {
  paintTexture(scene, HERO_KEYS.ear, 22, 22, (ctx) => {
    ellipsePath(ctx, 11, 11, 8.5, 8.5);
    fillOutlined(ctx, FUR, LINE_W);
    ctx.fillStyle = C.peach;
    ellipsePath(ctx, 11.5, 11.8, 4.8, 4.6);
    ctx.fill();
    ctx.fillStyle = alpha(C.cream, 0.4);
    ellipsePath(ctx, 10, 9.5, 1.6, 1.3);
    ctx.fill();
  });
}

/** Eye variants, 16x18 each, 9x11 ink ovals with two cream highlights. */
function paintEyes(scene: Phaser.Scene): void {
  const W = 16, H = 18, cx = 8, cy = 9, rx = 4.5, ry = 5.5;
  paintTexture(scene, HERO_KEYS.eyeOpen, W, H, (ctx) => kawaiiEye(ctx, cx, cy, rx, ry, C.ink, C.cream, 1));
  paintTexture(scene, HERO_KEYS.eyeHalf, W, H, (ctx) => {
    kawaiiEye(ctx, cx, cy, rx, ry, C.ink, C.cream, 1);
    // fur lid over the top 45% with a darker lash line
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.moveTo(cx - rx - 1.5, cy - ry - 1.5);
    ctx.lineTo(cx + rx + 1.5, cy - ry - 1.5);
    ctx.lineTo(cx + rx + 1.5, cy - 1);
    ctx.quadraticCurveTo(cx, cy - 3.2, cx - rx - 1.5, cy - 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = FUR_LINE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - rx - 0.5, cy - 1);
    ctx.quadraticCurveTo(cx, cy - 3.2, cx + rx + 0.5, cy - 1);
    ctx.stroke();
  });
  paintTexture(scene, HERO_KEYS.eyeClosed, W, H, (ctx) => kawaiiEye(ctx, cx, cy, rx, ry, C.ink, C.cream, 0));
  paintTexture(scene, HERO_KEYS.eyeRound, W, H, (ctx) => {
    ellipsePath(ctx, cx, cy, 6.2, 6.4);
    ctx.fillStyle = C.ink;
    ctx.fill();
    ctx.fillStyle = C.cream;
    ellipsePath(ctx, cx - 1.9, cy - 2.2, 2.1, 2.1);
    ctx.fill();
    ellipsePath(ctx, cx + 2.2, cy + 1.8, 1, 1);
    ctx.fill();
  });
}

/** Mouth variants. Smile/o/open are 18x12; munch (puffed cheeks) is 34x16. */
function paintMouths(scene: Phaser.Scene): void {
  paintTexture(scene, HERO_KEYS.mouthSmile, 18, 12, (ctx) => {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(9, 4.5, 4, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  });
  paintTexture(scene, HERO_KEYS.mouthOpen, 18, 12, (ctx) => {
    // a soft "D": flat top, round bottom
    ctx.beginPath();
    ctx.moveTo(3.5, 3.5);
    ctx.lineTo(14.5, 3.5);
    ctx.quadraticCurveTo(14.5, 11, 9, 11);
    ctx.quadraticCurveTo(3.5, 11, 3.5, 3.5);
    ctx.closePath();
    ctx.fillStyle = MOUTH_IN;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    // one tiny cream tooth
    ctx.fillStyle = C.cream;
    ctx.fillRect(7.6, 3.8, 2.8, 2.4);
    // tongue
    ctx.fillStyle = alpha(C.rose, 0.9);
    ellipsePath(ctx, 9, 9.2, 3, 1.6);
    ctx.fill();
  });
  paintTexture(scene, HERO_KEYS.mouthO, 18, 12, (ctx) => {
    ellipsePath(ctx, 9, 6, 2.8, 3.4);
    ctx.fillStyle = MOUTH_IN;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  });
  paintTexture(scene, HERO_KEYS.mouthMunch, 34, 16, (ctx) => {
    // two puffed cheeks (fur, lighter sheen) either side of a tiny closed mouth
    for (const x of [8, 26]) {
      ellipsePath(ctx, x, 8, 7, 6);
      fillOutlined(ctx, FUR, 2);
      sheen(ctx, x - 2, 5.5, 3, 1.6, C.cream, 0.45);
    }
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.quadraticCurveTo(17, 10.5, 20, 8);
    ctx.stroke();
  });
}

function paintBlush(scene: Phaser.Scene): void {
  paintTexture(scene, HERO_KEYS.blush, 14, 10, (ctx) => blushOval(ctx, 7, 5, 5, 3, C.blush));
}

/** Body: soft bean, plain cream belly, three stripes along the back (the left contour), jute sling bag. 56x54. */
function paintBody(scene: Phaser.Scene): void {
  paintTexture(scene, HERO_KEYS.body, 56, 54, (ctx) => {
    const cx = 28, cy = 27;
    // bean: narrower at the shoulders, rounder at the hips
    blobPath(ctx, [
      [cx - 17, cy - 20], [cx + 14, cy - 21], [cx + 21, cy - 6], [cx + 22, cy + 12],
      [cx + 12, cy + 23], [cx - 10, cy + 23], [cx - 21, cy + 13], [cx - 22, cy - 6],
    ]);
    fillOutlined(ctx, FUR, LINE_W);
    // plain cream belly patch on the front (right) side
    ctx.fillStyle = C.cream;
    ellipsePath(ctx, cx + 10, cy + 5, 10, 15);
    ctx.fill();
    // three cream stripes following the back contour from the shoulder down to the tail base: 3 px, 4 px of fur between
    const back: Pt[][] = [
      sampleCubic([24, 11], [12, 11], [10, 25], [14, 41]),
      sampleCubic([27.5, 18], [19, 18], [17, 29], [21, 41]),
      sampleCubic([28, 24.5], [25, 25], [23.5, 32], [27, 40.5]),
    ];
    back.forEach((pts, k) => taperedStripe(ctx, pts, 3, alpha(C.cream, k === 2 ? 0.8 : 0.95), 0.18));
    // jute sling: strap from the back shoulder across the chest to the front hip, pouch at the hip
    ctx.lineCap = 'round';
    ctx.strokeStyle = outline(C.bark, 0.25);
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 19);
    ctx.quadraticCurveTo(cx + 2, cy - 2, cx + 13, cy + 10);
    ctx.stroke();
    ctx.strokeStyle = C.bark;
    ctx.lineWidth = 4;
    ctx.stroke();
    // woven stitch line on the strap
    ctx.strokeStyle = alpha(C.cream, 0.35);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
    // the pouch
    const bx = cx + 13, by = cy + 12;
    blobPath(ctx, [[bx - 8, by - 4], [bx + 8, by - 4], [bx + 9, by + 5], [bx + 4, by + 9], [bx - 4, by + 9], [bx - 9, by + 5]]);
    fillOutlined(ctx, C.bark, 2);
    // flap
    ctx.fillStyle = shade(C.bark, 0.14);
    blobPath(ctx, [[bx - 8, by - 4], [bx + 8, by - 4], [bx + 7, by + 1], [bx, by + 3], [bx - 7, by + 1]]);
    ctx.fill();
    ctx.fillStyle = C.butter;
    ellipsePath(ctx, bx, by + 2.5, 1.5, 1.5);
    ctx.fill();
  });
}

/**
 * Arms: a short rounded stub hanging from the shoulder pivot (9, 4.5) and resting against the body's side, tilting a
 * touch forward, with a tiny paw at the end (RIG.armLength from the pivot). 18x28. Far arm is a shade darker.
 */
function paintArms(scene: Phaser.Scene): void {
  const paint = (key: string, fill: string) =>
    paintTexture(scene, key, 18, 28, (ctx) => {
      unionOutlined(ctx, [
        () => blobPath(ctx, [[4.5, 4], [13.5, 4], [15.5, 10], [15.5, 16], [12.5, 19], [7.5, 18.5], [4, 13]]),
        () => ellipsePath(ctx, 12, 19.5, 4.6, 4),
      ], fill, 2.2);
      // tiny paw: a soft cream pad and two toe nicks
      ctx.fillStyle = alpha(C.cream, 0.4);
      ellipsePath(ctx, 12.2, 20.2, 2.6, 1.8);
      ctx.fill();
      ctx.strokeStyle = alpha(outline(fill), 0.7);
      ctx.lineWidth = 1.1;
      for (const x of [10.8, 13.8]) {
        ctx.beginPath();
        ctx.moveTo(x, 21.6);
        ctx.lineTo(x + 0.3, 23.3);
        ctx.stroke();
      }
    });
  paint(HERO_KEYS.armL, FUR_FAR);
  paint(HERO_KEYS.armR, FUR);
}

/** One little foot: rounded oval with two toe notches. 22x12. */
function paintFoot(scene: Phaser.Scene): void {
  paintTexture(scene, HERO_KEYS.foot, 22, 12, (ctx) => {
    blobPath(ctx, [[3, 4], [11, 2.5], [19, 4], [20, 8], [12, 10], [3, 9]]);
    fillOutlined(ctx, FUR, 2.2);
    ctx.strokeStyle = FUR_LINE;
    ctx.lineWidth = 1.2;
    for (const x of [13.5, 17]) {
      ctx.beginPath();
      ctx.moveTo(x, 3.6);
      ctx.lineTo(x - 0.4, 6);
      ctx.stroke();
    }
  });
}

/** A fur bump on the tail's outer edge: [arc-length fraction along the edge, radius]. */
type Bump = [number, number];

/**
 * Tail painters. Both are defined in rig space around the tail base and translated into their texture.
 * A fluffy squirrel tail: a soft comma/S from the lower back, up and over behind the head. The outer edge carries
 * irregular fur bumps (radius and spacing vary so it reads as fur, not teeth); the inner edge is smooth and carries
 * a soft cream underside that fades toward the rounded tip. The curl variant hooks its top third into a "?".
 */
function paintTailTexture(scene: Phaser.Scene, key: string, ctrl: Pt[], halfWCtrl: number[], bumps: Bump[], originOut: RigPoint): void {
  const center = smoothCurve(ctrl);
  const halfW = smoothValues(halfWCtrl);
  const n = center.length;
  const rib = ribbon(center, halfW);
  const allPts = [...rib.inner, ...rib.outer];
  const pad = Math.max(...bumps.map((b) => b[1])) + 6;
  const minX = Math.min(...allPts.map((p) => p[0])) - pad, maxX = Math.max(...allPts.map((p) => p[0])) + pad;
  const minY = Math.min(...allPts.map((p) => p[1])) - pad, maxY = Math.max(...allPts.map((p) => p[1])) + pad;
  const W = Math.ceil(maxX - minX), H = Math.ceil(maxY - minY);
  const base = center[0];
  originOut.x = (base[0] - minX) / W;
  originOut.y = (base[1] - minY) / H;
  paintTexture(scene, key, W, H, (ctx) => {
    ctx.translate(-minX, -minY);
    // fur bumps: centers tucked a third of the radius inside the edge so they swell softly instead of spiking
    const tufts = bumps.map(([t, r]) => {
      const { i, k } = alongEdge(rib.outer, t);
      const e = lerpPt(rib.outer, i, k), c = lerpPt(center, i, k);
      const dx = c[0] - e[0], dy = c[1] - e[1], d = Math.hypot(dx, dy) || 1;
      const a = rib.outer[Math.max(0, i - 1)], b = rib.outer[Math.min(n - 1, i + 2)];
      return { x: e[0] + (dx / d) * r * 0.35, y: e[1] + (dy / d) * r * 0.35, r, rot: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    });
    const tip = center[n - 1], tipR = halfW[n - 1];
    unionOutlined(ctx, [
      () => blobPath(ctx, rib.outlinePts),
      // tufts stretched a little along the fur flow
      ...tufts.map((b) => () => ellipsePath(ctx, b.x, b.y, b.r * 1.12, b.r * 0.9, b.rot)),
      () => ellipsePath(ctx, tip[0], tip[1], tipR, tipR),
    ], FUR, LINE_W);
    // cream underside: a soft band hugging the inner curve, about 35% of the width, fading out toward the tip
    const fade = (i: number): number => {
      const f = Math.min(1, Math.max(0, (0.92 - i / (n - 1)) / 0.5));
      return f * f * (3 - 2 * f);
    };
    let end = n - 1;
    while (end > 1 && fade(end) <= 0.02) end--;
    const edgeIn = ribbon(center, halfW.map((h) => h - 3)).inner;
    const bandOf = (frac: number): Pt[] => ribbon(center, halfW.map((h, i) => Math.max(0.5, h - 3 - frac * h * fade(i)))).inner;
    const bandPoly = (inner: Pt[]): Pt[] => [...edgeIn.slice(0, end + 1), ...inner.slice(0, end + 1).reverse()];
    ctx.fillStyle = mix(C.cream, FUR, 0.35);
    blobPath(ctx, bandPoly(bandOf(0.7)));
    ctx.fill();
    ctx.fillStyle = alpha(mix(C.cream, FUR, 0.12), 0.7);
    blobPath(ctx, bandPoly(bandOf(0.3)));
    ctx.fill();
    // a few soft fur strokes following the curve on the outer half, for volume
    ctx.strokeStyle = alpha(FUR_LINE, 0.26);
    ctx.lineWidth = 1.5;
    for (const t of [0.3, 0.47, 0.64, 0.8]) {
      const { i } = alongEdge(center, t);
      const i0 = Math.max(0, Math.min(n - 5, i - 2));
      ctx.beginPath();
      for (let j = i0; j < i0 + 5; j++) {
        const p = center[j], o = rib.outer[j];
        const x = p[0] + (o[0] - p[0]) * 0.5, y = p[1] + (o[1] - p[1]) * 0.5;
        if (j === i0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

function paintTails(scene: Phaser.Scene): void {
  const b = RIG.tailBase;
  const rel = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [b.x + x, b.y + y]);
  // straight: from the lower back, out and up in a soft S, curving over behind the head; the tip pokes up just
  // above the crown between the ears. Fattest (~50 px with the fur) mid-way, narrower at the base, rounded tip.
  paintTailTexture(
    scene,
    HERO_KEYS.tailStraight,
    rel([[3, 0], [-13, 3], [-25, -10], [-32, -32], [-32, -54], [-26, -74], [-15, -88], [-1, -97], [12, -99]]),
    [7, 10, 14, 18, 19, 18, 15, 11, 7.5],
    [[0.1, 7], [0.19, 10.5], [0.3, 7.5], [0.4, 12.5], [0.52, 9], [0.63, 12], [0.75, 8], [0.85, 10], [0.93, 6]],
    HERO_TEX.tailStraightOrigin,
  );
  // curl: the same tail, its top third coiling into a tighter hook over the head so it reads as a "?"
  paintTailTexture(
    scene,
    HERO_KEYS.tailCurl,
    rel([[3, 0], [-13, 3], [-25, -10], [-32, -32], [-32, -54], [-26, -76], [-14, -94], [4, -108], [24, -112], [40, -102], [44, -88]]),
    [7, 10, 14, 18, 19, 18, 15, 12, 10, 7.5, 6],
    [[0.1, 7], [0.19, 10.5], [0.3, 7.5], [0.4, 12.5], [0.52, 9], [0.62, 11.5], [0.72, 8], [0.81, 9], [0.9, 6.5], [0.96, 5]],
    HERO_TEX.tailCurlOrigin,
  );
}

/** A jack seed: a pale oval kernel with a bark tip. 14x18. */
function paintSeed(scene: Phaser.Scene): void {
  paintTexture(scene, HERO_KEYS.seed, 14, 18, (ctx) => {
    const kernel = mix(ACCENTS.marigold, C.cream, 0.45);
    blobPath(ctx, [[7, 2], [12, 6], [12, 12], [7, 16.5], [2, 12], [2, 6]]);
    fillOutlined(ctx, kernel, 2);
    sheen(ctx, 5, 6, 2.2, 1.3, C.cream, 0.6);
    ctx.fillStyle = C.bark;
    ellipsePath(ctx, 7, 2.8, 2.2, 1.6);
    ctx.fill();
  });
}

/** Paint every hero texture (idempotent; call from Boot or lazily from the entity). */
export function paintHeroTextures(scene: Phaser.Scene): void {
  paintShadow(scene);
  paintHead(scene);
  paintEar(scene);
  paintEyes(scene);
  paintMouths(scene);
  paintBlush(scene);
  paintBody(scene);
  paintArms(scene);
  paintFoot(scene);
  paintTails(scene);
  paintSeed(scene);
}
