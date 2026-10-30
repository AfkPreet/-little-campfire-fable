/**
 * The clearing's trees: the giant bamboo clump (5-7 culms arching right, leaf tufts, a golden-hour rim texture),
 * the big round jamun tree (dense crown, lowest branch with hang points, berries) and the jackfruit tree with fruit
 * hanging low on its trunk. Each returns a Container anchored at its base so it can sway from the ground.
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { blobPath, contactShadow, ellipsePath, makeImg, paintTexture, type Ctx } from '@/art/pipeline';
import { seeded } from '@/art/landscape/common';

export const TREE_KEYS = {
  bamboo: 'bamboo-clump',
  bambooRim: 'bamboo-rim',
  jamun: 'jamun-tree',
  jamunRim: 'jamun-rim',
  jackfruit: 'jackfruit-tree',
} as const;
export const TREE_SIZES = {
  bamboo: { w: 340, h: 500, baseX: 80 },
  jamun: { w: 400, h: 470, baseX: 200 },
  jackfruit: { w: 240, h: 400, baseX: 120 },
} as const;

export const CULM = mix(PALETTE.butter, PALETTE.sage, 0.45);
const CULM_LINE = outline(CULM, 0.26);
const LEAF = PALETTE.sage;
const LEAF_DEEP = mix(PALETTE.sage, PALETTE.moss, 0.6);
const RIM = alpha(PALETTE.butter, 0.5);

type Curve = { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number };
const q = (c: Curve, t: number): [number, number] => [
  (1 - t) * (1 - t) * c.x0 + 2 * (1 - t) * t * c.cx + t * t * c.x1,
  (1 - t) * (1 - t) * c.y0 + 2 * (1 - t) * t * c.cy + t * t * c.y1,
];

/** The six culm curves, shared by the clump and its rim texture. */
function culms(w: number, h: number): Curve[] {
  const rnd = seeded(808);
  const out: Curve[] = [];
  const baseX = TREE_SIZES.bamboo.baseX, baseY = h - 4;
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const x0 = baseX - 14 + t * 30 + (rnd() - 0.5) * 6;
    const top = 14 + rnd() * 40 + (i === 2 || i === 3 ? 0 : 30);
    const reach = 90 + t * 150 + rnd() * 30;
    out.push({ x0, y0: baseY, cx: x0 + reach * 0.15, cy: top + (baseY - top) * 0.35, x1: Math.min(w - 10, x0 + reach), y1: top });
  }
  return out;
}

function leafTuft(ctx: Ctx, x: number, y: number, dir: number, rnd: () => number, fill = LEAF): void {
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = dir * (0.15 + rnd() * 0.9) + (rnd() - 0.5) * 0.6 + Math.PI / 2 * (rnd() < 0.5 ? 0.3 : -0.1);
    const len = 22 + rnd() * 18;
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len * 0.7 + 8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (ex - x) * 0.5 + 4, y + (ey - y) * 0.5 - 6, ex, ey);
    ctx.quadraticCurveTo(x + (ex - x) * 0.5 - 2, y + (ey - y) * 0.5 + 2, x, y);
    ctx.closePath();
    const c = rnd() < 0.5 ? fill : LEAF_DEEP;
    ctx.fillStyle = c;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = outline(c, 0.2);
    ctx.stroke();
  }
}

function paintBamboo(ctx: Ctx, w: number, h: number): void {
  const rnd = seeded(31);
  contactShadow(ctx, TREE_SIZES.bamboo.baseX, h - 4, 44, 8, PALETTE.ink, 0.16);
  const cs = culms(w, h);
  // back culms first so the front ones overlap
  cs.forEach((c, i) => {
    const width = 9 - Math.abs(i - 2.5) * 0.8;
    ctx.lineCap = 'round';
    ctx.lineWidth = width + 4;
    ctx.strokeStyle = CULM_LINE;
    ctx.beginPath();
    ctx.moveTo(c.x0, c.y0);
    ctx.quadraticCurveTo(c.cx, c.cy, c.x1, c.y1);
    ctx.stroke();
    ctx.lineWidth = width;
    ctx.strokeStyle = i % 2 ? CULM : mix(CULM, PALETTE.cream, 0.15);
    ctx.stroke();
    // nodes every ~46 px of arc: a darker ring and a cream glint
    const segs = 11;
    for (let s = 1; s < segs; s++) {
      const t = s / segs;
      const [x, y] = q(c, t);
      const [x2, y2] = q(c, t + 0.01);
      const ang = Math.atan2(y2 - y, x2 - x) + Math.PI / 2;
      ctx.strokeStyle = CULM_LINE;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * (width / 2 + 1), y + Math.sin(ang) * (width / 2 + 1));
      ctx.lineTo(x - Math.cos(ang) * (width / 2 + 1), y - Math.sin(ang) * (width / 2 + 1));
      ctx.stroke();
      if (t > 0.45 && rnd() < 0.7) leafTuft(ctx, x, y, t > 0.8 ? 0.2 : 0.8, rnd);
    }
    // tip tuft
    leafTuft(ctx, c.x1, c.y1, -0.2, rnd);
    leafTuft(ctx, c.x1, c.y1, 0.6, rnd);
  });
}

/** Rim light for golden hour: butter strokes just right of each culm and on the upper leaves. */
function paintBambooRim(ctx: Ctx, w: number, h: number): void {
  const cs = culms(w, h);
  ctx.lineCap = 'round';
  cs.forEach((c, i) => {
    const width = 9 - Math.abs(i - 2.5) * 0.8;
    ctx.lineWidth = Math.max(2, width * 0.35);
    ctx.strokeStyle = RIM;
    ctx.beginPath();
    ctx.moveTo(c.x0 + width * 0.35, c.y0);
    ctx.quadraticCurveTo(c.cx + width * 0.35, c.cy - 2, c.x1, c.y1 - 2);
    ctx.stroke();
  });
}

/** Crown: a dense cluster of overlapping leafy blobs, darker underneath, lighter lobes top-left. */
function crown(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rnd: () => number, lobes: number, base: string = PALETTE.moss): void {
  const light = mix(base, PALETTE.sage, 0.65);
  const deep = shade(base, -0.18);
  // silhouette
  const pts: Array<[number, number]> = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.86 + rnd() * 0.16;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  blobPath(ctx, pts);
  ctx.fillStyle = deep;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = outline(base, 0.3);
  ctx.stroke();
  // lobes: mid tone across the body, light on the upper-left
  for (let i = 0; i < lobes; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 0.7;
    const lx = cx + Math.cos(a) * rx * d, ly = cy + Math.sin(a) * ry * d;
    const r = rx * (0.22 + rnd() * 0.2);
    const upperLeft = lx < cx + rx * 0.1 && ly < cy + ry * 0.05;
    ctx.fillStyle = upperLeft ? (rnd() < 0.6 ? light : base) : rnd() < 0.3 ? base : deep;
    ellipsePath(ctx, lx, ly, r, r * 0.8, rnd() * 0.6);
    ctx.fill();
  }
  // soft top highlight
  ctx.fillStyle = alpha(mix(light, PALETTE.cream, 0.2), 0.45);
  ellipsePath(ctx, cx - rx * 0.3, cy - ry * 0.55, rx * 0.4, ry * 0.2, -0.3);
  ctx.fill();
}

function trunk(ctx: Ctx, x: number, baseY: number, topY: number, wBase: number, wTop: number, fill: string, rough = false): void {
  ctx.beginPath();
  ctx.moveTo(x - wBase * 0.9, baseY);
  ctx.quadraticCurveTo(x - wBase * 0.45, baseY - 24, x - wTop / 2, topY);
  ctx.lineTo(x + wTop / 2, topY);
  ctx.quadraticCurveTo(x + wBase * 0.45, baseY - 24, x + wBase * 0.9, baseY);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = outline(fill, 0.28);
  ctx.stroke();
  // bark lines
  ctx.strokeStyle = alpha(outline(fill, 0.3), 0.6);
  ctx.lineWidth = rough ? 2.4 : 1.6;
  const lines = rough ? 7 : 4;
  for (let i = 0; i < lines; i++) {
    const t = (i + 1) / (lines + 1);
    const lx = x - wTop / 2 + wTop * t;
    ctx.beginPath();
    ctx.moveTo(lx + (rough ? (i % 2) * 4 - 2 : 0), topY + 10);
    ctx.quadraticCurveTo(lx + (t - 0.5) * 10, (topY + baseY) / 2, lx + (t - 0.5) * wBase * 0.9, baseY - 8);
    ctx.stroke();
  }
  ctx.fillStyle = alpha(PALETTE.cream, 0.18);
  ellipsePath(ctx, x - wTop * 0.25, (topY + baseY) / 2, wTop * 0.12, (baseY - topY) * 0.3);
  ctx.fill();
}

function paintJamun(ctx: Ctx, w: number, h: number): void {
  const rnd = seeded(1250);
  const S = TREE_SIZES.jamun;
  const bx = S.baseX, by = h - 4;
  contactShadow(ctx, bx, by, 80, 10, PALETTE.ink, 0.18);
  const bark = mix(PALETTE.bark, ACCENTS.jamun, 0.2);
  trunk(ctx, bx, by, 190, 30, 24, bark);
  // lowest branch: hang points at (-70, 180 above ground) and (+80, 160 above ground)
  ctx.lineCap = 'round';
  for (const [dx, dy, len] of [[-70, 180, 1], [80, 160, 1]] as const) {
    ctx.lineWidth = 11;
    ctx.strokeStyle = outline(bark, 0.28);
    ctx.beginPath();
    ctx.moveTo(bx, by - 150);
    ctx.quadraticCurveTo(bx + dx * 0.5, by - dy - 8, bx + dx * 1.35 * len, by - dy + 12);
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.strokeStyle = bark;
    ctx.stroke();
  }
  crown(ctx, bx, 180, 180, 150, rnd, 26);
  // berries dangling at the crown's underside
  for (let i = 0; i < 18; i++) {
    const x = bx - 120 + rnd() * 240, y = 290 + rnd() * 40 - Math.abs(x - bx) * 0.12;
    ctx.fillStyle = ACCENTS.jamun;
    ellipsePath(ctx, x, y, 3, 3.6);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = outline(ACCENTS.jamun, 0.25);
    ctx.stroke();
    ctx.fillStyle = alpha(PALETTE.cream, 0.55);
    ellipsePath(ctx, x - 1, y - 1.2, 0.9, 0.8);
    ctx.fill();
  }
}

function paintJamunRim(ctx: Ctx, w: number, h: number): void {
  const bx = TREE_SIZES.jamun.baseX;
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(bx, 180, 150, -Math.PI * 0.42, Math.PI * 0.1);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(bx, 180, 128, -Math.PI * 0.3, Math.PI * 0.05);
  ctx.stroke();
}

function jackfruit(ctx: Ctx, x: number, y: number, rx: number, ry: number, rnd: () => number): void {
  const fill = mix(PALETTE.sage, ACCENTS.marigold, 0.5);
  // stalk
  ctx.strokeStyle = outline(PALETTE.bark, 0.1);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y - ry);
  ctx.lineTo(x + 2, y - ry - 10);
  ctx.stroke();
  ellipsePath(ctx, x, y, rx, ry, 0.08);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = outline(fill, 0.28);
  ctx.stroke();
  // bumpy skin
  ctx.fillStyle = alpha(outline(fill, 0.3), 0.55);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.8;
    ellipsePath(ctx, x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, 1.3, 1.3);
    ctx.fill();
  }
  ctx.fillStyle = alpha(PALETTE.cream, 0.3);
  ellipsePath(ctx, x - rx * 0.35, y - ry * 0.3, rx * 0.25, ry * 0.3, -0.4);
  ctx.fill();
}

function paintJackfruit(ctx: Ctx, w: number, h: number): void {
  const rnd = seeded(1600);
  const S = TREE_SIZES.jackfruit;
  const bx = S.baseX, by = h - 4;
  contactShadow(ctx, bx, by, 50, 8, PALETTE.ink, 0.16);
  trunk(ctx, bx, by, 110, 26, 20, PALETTE.bark, true);
  crown(ctx, bx, 96, 105, 78, rnd, 16, mix(PALETTE.moss, PALETTE.sage, 0.25));
  crown(ctx, bx + 40, 60, 60, 44, rnd, 8, mix(PALETTE.moss, PALETTE.sage, 0.35));
  jackfruit(ctx, bx - 20, by - 115, 15, 24, rnd);
  jackfruit(ctx, bx + 18, by - 90, 17, 27, rnd);
  jackfruit(ctx, bx - 4, by - 55, 13, 20, rnd);
}

export function paintTrees(scene: Phaser.Scene): void {
  const S = TREE_SIZES;
  paintTexture(scene, TREE_KEYS.bamboo, S.bamboo.w, S.bamboo.h, paintBamboo);
  paintTexture(scene, TREE_KEYS.bambooRim, S.bamboo.w, S.bamboo.h, paintBambooRim);
  paintTexture(scene, TREE_KEYS.jamun, S.jamun.w, S.jamun.h, paintJamun);
  paintTexture(scene, TREE_KEYS.jamunRim, S.jamun.w, S.jamun.h, paintJamunRim);
  paintTexture(scene, TREE_KEYS.jackfruit, S.jackfruit.w, S.jackfruit.h, paintJackfruit);
}

export type TreeRig = { container: Phaser.GameObjects.Container; body: Phaser.GameObjects.Image; rim?: Phaser.GameObjects.Image };

/** A tree anchored at its base (x, groundY). `rim` (if any) starts invisible; fade it with lighting.warmth * sun. */
function treeRig(scene: Phaser.Scene, x: number, y: number, key: string, size: { w: number; h: number; baseX: number }, rimKey?: string): TreeRig {
  const container = scene.add.container(x, y);
  const ox = size.baseX / size.w;
  const body = makeImg(scene, 0, 0, key).setOrigin(ox, 1);
  container.add(body);
  let rim: Phaser.GameObjects.Image | undefined;
  if (rimKey) {
    rim = makeImg(scene, 0, 0, rimKey).setOrigin(ox, 1).setAlpha(0);
    container.add(rim);
  }
  return { container, body, rim };
}

export function makeBamboo(scene: Phaser.Scene, x: number, y: number): TreeRig {
  paintTrees(scene);
  return treeRig(scene, x, y, TREE_KEYS.bamboo, TREE_SIZES.bamboo, TREE_KEYS.bambooRim);
}
export function makeJamunTree(scene: Phaser.Scene, x: number, y: number): TreeRig {
  paintTrees(scene);
  return treeRig(scene, x, y, TREE_KEYS.jamun, TREE_SIZES.jamun, TREE_KEYS.jamunRim);
}
export function makeJackfruitTree(scene: Phaser.Scene, x: number, y: number): TreeRig {
  paintTrees(scene);
  return treeRig(scene, x, y, TREE_KEYS.jackfruit, TREE_SIZES.jackfruit);
}
