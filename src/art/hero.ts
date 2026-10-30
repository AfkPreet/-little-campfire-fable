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
  armR: { x: 11, y: -39 },
  armLength: 19,
  footL: { x: -9, y: -4 },
  footR: { x: 9, y: -4 },
  hold: { x: 27, y: -31 },
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

function stripe(ctx: Ctx, from: Pt, ctrl: Pt, to: Pt, color = C.cream, w = 3): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.quadraticCurveTo(ctrl[0], ctrl[1], to[0], to[1]);
  ctx.stroke();
}

// ---------- part painters ----------

function paintShadow(scene: Phaser.Scene): void {
  paintTexture(scene, HERO_KEYS.shadow, 76, 20, (ctx, w, h) => {
    contactShadow(ctx, w / 2, h / 2, 37, 8.5, C.ink, 0.24);
  });
}

/** Head: wide flattened oval, three cream dorsal stripes from the crown back, cream muzzle, peach nose. 66x60. */
function paintHead(scene: Phaser.Scene): void {
  paintTexture(scene, HERO_KEYS.head, 66, 60, (ctx) => {
    const cx = 33, cy = 31, rx = 29, ry = 26;
    ellipsePath(ctx, cx, cy, rx, ry);
    fillOutlined(ctx, FUR, LINE_W);
    // soft sheen on the upper-left of the crown
    sheen(ctx, cx - 9, cy - 13, 11, 6, C.cream, 0.18);
    // three cream stripes hugging the crown and back of the head (concentric arcs, 3 px, 4 px of fur between)
    ctx.lineCap = 'round';
    const arcs: Array<[number, number]> = [[1.04, 1.6], [1.12, 1.58], [1.26, 1.55]];
    arcs.forEach(([a0, a1], k) => {
      ctx.strokeStyle = C.cream;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx - 4 - 5.5 * k, ry - 4 - 5.5 * k, 0, Math.PI * a0, Math.PI * a1);
      ctx.stroke();
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

/** Body: soft bean, cream belly, three stripes down the back, jute sling bag across the chest. 56x54. */
function paintBody(scene: Phaser.Scene): void {
  paintTexture(scene, HERO_KEYS.body, 56, 54, (ctx) => {
    const cx = 28, cy = 27;
    // bean: narrower at the shoulders, rounder at the hips
    blobPath(ctx, [
      [cx - 17, cy - 20], [cx + 14, cy - 21], [cx + 21, cy - 6], [cx + 22, cy + 12],
      [cx + 12, cy + 23], [cx - 10, cy + 23], [cx - 21, cy + 13], [cx - 22, cy - 6],
    ]);
    fillOutlined(ctx, FUR, LINE_W);
    // cream belly patch on the front (right) side
    ctx.fillStyle = C.cream;
    ellipsePath(ctx, cx + 8, cy + 5, 11, 15);
    ctx.fill();
    // three dorsal stripes running down the back toward the tail base (lower-left)
    stripe(ctx, [cx - 8, cy - 19], [cx - 20, cy - 10], [cx - 19, cy + 10]);
    stripe(ctx, [cx - 1, cy - 19], [cx - 14, cy - 8], [cx - 13, cy + 12]);
    stripe(ctx, [cx + 6, cy - 19], [cx - 8, cy - 6], [cx - 7, cy + 12]);
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

/** Arms: stubby capsule with a rounded paw, pivot at the shoulder (top). 18x28. Far arm is a shade darker. */
function paintArms(scene: Phaser.Scene): void {
  const paint = (key: string, fill: string) =>
    paintTexture(scene, key, 18, 28, (ctx) => {
      unionOutlined(ctx, [
        () => blobPath(ctx, [[5, 4], [13, 4], [14, 14], [13, 21], [5, 21], [4, 14]]),
        () => ellipsePath(ctx, 9, 21, 6, 5),
      ], fill, 2.2);
      // paw pad hint
      ctx.fillStyle = alpha(C.cream, 0.35);
      ellipsePath(ctx, 9, 21.5, 3, 2);
      ctx.fill();
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

/**
 * Tail painters. Both are defined in rig space around the tail base and translated into their texture.
 * Fat crescent (straight) and a "?" over the head (curl); cream underside along the inner edge, five tufts outside.
 */
function paintTailTexture(scene: Phaser.Scene, key: string, center: Pt[], halfW: number[], tuftR: number, originOut: RigPoint): void {
  const rib = ribbon(center, halfW);
  const allPts = [...rib.inner, ...rib.outer, ...center];
  const pad = tuftR + 6;
  const minX = Math.min(...allPts.map((p) => p[0])) - pad, maxX = Math.max(...allPts.map((p) => p[0])) + pad;
  const minY = Math.min(...allPts.map((p) => p[1])) - pad, maxY = Math.max(...allPts.map((p) => p[1])) + pad;
  const W = Math.ceil(maxX - minX), H = Math.ceil(maxY - minY);
  const base = center[0];
  originOut.x = (base[0] - minX) / W;
  originOut.y = (base[1] - minY) / H;
  paintTexture(scene, key, W, H, (ctx) => {
    ctx.translate(-minX, -minY);
    const T: Pt[] = (() => {
      // five tufts spread along the outer edge, skipping the base
      const out: Pt[] = [];
      const edge = rib.outer;
      for (let i = 0; i < 5; i++) {
        const t = 0.22 + (0.78 * i) / 4;
        const f = t * (edge.length - 1);
        const i0 = Math.floor(f), i1 = Math.min(edge.length - 1, i0 + 1), k = f - i0;
        out.push([edge[i0][0] + (edge[i1][0] - edge[i0][0]) * k, edge[i0][1] + (edge[i1][1] - edge[i0][1]) * k]);
      }
      return out;
    })();
    const tuftScale = [0.86, 1, 1.12, 1, 0.9];
    unionOutlined(ctx, [
      () => blobPath(ctx, rib.outlinePts),
      ...T.map((p, i) => () => ellipsePath(ctx, p[0], p[1], tuftR * tuftScale[i], tuftR * tuftScale[i] * 0.9)),
    ], FUR, LINE_W);
    // cream underside: a band along the inner edge (facing the body and head), inset from the outline
    const inner = ribbon(center, halfW.map((h) => h - 3)).inner;
    const mid = ribbon(center, halfW.map((h) => Math.max(1, h * 0.06))).inner;
    const band: Pt[] = [...inner.slice(1), ...mid.slice(1).reverse()];
    ctx.fillStyle = mix(C.cream, FUR, 0.06);
    blobPath(ctx, band);
    ctx.fill();
    // a few soft fur strokes on the outer side for volume
    ctx.strokeStyle = alpha(FUR_LINE, 0.35);
    ctx.lineWidth = 1.4;
    for (let i = 1; i < center.length - 1; i++) {
      const p = center[i], l = rib.outer[i];
      ctx.beginPath();
      ctx.moveTo(p[0] + (l[0] - p[0]) * 0.55, p[1] + (l[1] - p[1]) * 0.55);
      ctx.lineTo(p[0] + (l[0] - p[0]) * 0.85, p[1] + (l[1] - p[1]) * 0.85);
      ctx.stroke();
    }
  });
}

function paintTails(scene: Phaser.Scene): void {
  const b = RIG.tailBase;
  const rel = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [b.x + x, b.y + y]);
  // straight: a fat crescent rising behind the body and curling forward above the head
  paintTailTexture(
    scene,
    HERO_KEYS.tailStraight,
    rel([[2, 2], [-12, -14], [-21, -40], [-22, -70], [-14, -96], [2, -114], [18, -122]]),
    [8, 13, 16, 17, 15, 12, 8],
    9,
    HERO_TEX.tailStraightOrigin,
  );
  // curl: the "?" over the head; rises up the back then hooks forward and down over the crown
  paintTailTexture(
    scene,
    HERO_KEYS.tailCurl,
    rel([[2, 2], [-10, -16], [-18, -44], [-16, -74], [-4, -100], [16, -120], [40, -124], [56, -110], [54, -94]]),
    [8, 12, 14, 14, 13, 12, 10, 8, 6],
    8,
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
