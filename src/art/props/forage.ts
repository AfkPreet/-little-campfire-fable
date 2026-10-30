/**
 * Forage spots: the jamun thicket (round bush with purple dots), the fallen silver-oak mushroom log, the lemongrass
 * patch and the moon-lily rock pool (a few stones round a tiny pool; the lily glows at night).
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { blobPath, contactShadow, ellipsePath, makeImg, paintTexture, softGlow, type Ctx } from '@/art/pipeline';
import { bladePath, seeded } from '@/art/landscape/common';

export const FORAGE_KEYS = {
  thicket: 'jamun-thicket',
  log: 'mushroom-log',
  lemongrass: 'lemongrass-patch',
  rockPool: 'rock-pool',
  lily: 'moon-lily',
  lilyGlow: 'moon-lily-glow',
} as const;
export const FORAGE_SIZES = {
  thicket: { w: 140, h: 96 },
  log: { w: 160, h: 60 },
  lemongrass: { w: 110, h: 104 },
  rockPool: { w: 140, h: 48 },
  lily: { w: 30, h: 22 },
  lilyGlow: 96,
} as const;

function paintThicket(ctx: Ctx, w: number, h: number): void {
  const rnd = seeded(420);
  const cx = w / 2, by = h - 6;
  contactShadow(ctx, cx, by, 54, 8, PALETTE.ink, 0.16);
  const base = mix(PALETTE.moss, PALETTE.sage, 0.3);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 11; i++) {
    const a = Math.PI + (i / 10) * Math.PI;
    const k = 0.86 + rnd() * 0.16;
    pts.push([cx + Math.cos(a) * 60 * k, by + Math.sin(a) * 68 * k]);
  }
  pts.push([cx + 56, by], [cx, by + 2], [cx - 56, by]);
  blobPath(ctx, pts);
  ctx.fillStyle = base;
  ctx.fill();
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = outline(base, 0.28);
  ctx.stroke();
  // leafy lobes, lighter toward the top-left
  for (let i = 0; i < 12; i++) {
    const x = cx - 44 + rnd() * 88, y = by - 14 - rnd() * 44;
    const r = 10 + rnd() * 9;
    ctx.fillStyle = x < cx && y < by - 30 ? mix(base, PALETTE.sage, 0.7) : rnd() < 0.5 ? mix(base, PALETTE.sage, 0.3) : shade(base, -0.12);
    ellipsePath(ctx, x, y, r, r * 0.75, rnd() * 0.5);
    ctx.fill();
  }
  // berries
  for (let i = 0; i < 12; i++) {
    const x = cx - 46 + rnd() * 92, y = by - 12 - rnd() * 46;
    ctx.fillStyle = ACCENTS.jamun;
    ellipsePath(ctx, x, y, 3.2, 3.8);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = outline(ACCENTS.jamun, 0.25);
    ctx.stroke();
    ctx.fillStyle = alpha(PALETTE.cream, 0.55);
    ellipsePath(ctx, x - 1, y - 1.3, 1, 0.8);
    ctx.fill();
  }
}

function mushroom(ctx: Ctx, x: number, y: number, r: number, cap: string): void {
  // stem
  ctx.fillStyle = mix(PALETTE.cream, PALETTE.bark, 0.2);
  ellipsePath(ctx, x, y - r * 0.5, r * 0.32, r * 0.7);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = outline(mix(PALETTE.cream, PALETTE.bark, 0.3), 0.2);
  ctx.stroke();
  // cap
  ctx.beginPath();
  ctx.ellipse(x, y - r * 1.05, r, r * 0.7, 0, Math.PI, Math.PI * 2);
  ctx.quadraticCurveTo(x, y - r * 0.8, x - r, y - r * 1.05);
  ctx.closePath();
  ctx.fillStyle = cap;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = outline(cap, 0.24);
  ctx.stroke();
  ctx.fillStyle = alpha(PALETTE.cream, 0.6);
  ellipsePath(ctx, x - r * 0.3, y - r * 1.35, r * 0.25, r * 0.15);
  ctx.fill();
}

function paintLog(ctx: Ctx, w: number, h: number): void {
  const rnd = seeded(640);
  const by = h - 6;
  contactShadow(ctx, w / 2, by, 70, 7, PALETTE.ink, 0.16);
  const wood = mix(PALETTE.bark, PALETTE.cream, 0.2);
  const lx0 = 24, lx1 = w - 14, ly = by - 16, r = 13;
  // body
  ctx.beginPath();
  ctx.moveTo(lx0, ly - r);
  ctx.lineTo(lx1 - 6, ly - r + 2);
  ctx.quadraticCurveTo(lx1 + 6, ly, lx1 - 4, ly + r);
  ctx.lineTo(lx0, ly + r);
  ctx.closePath();
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = outline(wood, 0.28);
  ctx.stroke();
  // bark lines
  ctx.strokeStyle = alpha(outline(wood, 0.3), 0.6);
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 5; i++) {
    const y = ly - r + 5 + i * 5;
    ctx.beginPath();
    ctx.moveTo(lx0 + 12 + rnd() * 10, y);
    ctx.quadraticCurveTo((lx0 + lx1) / 2, y + (rnd() - 0.5) * 3, lx1 - 16 - rnd() * 20, y);
    ctx.stroke();
  }
  // cut end with rings
  ellipsePath(ctx, lx0, ly, 9, r);
  ctx.fillStyle = mix(wood, PALETTE.cream, 0.4);
  ctx.fill();
  ctx.strokeStyle = outline(wood, 0.28);
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.strokeStyle = alpha(outline(wood, 0.25), 0.6);
  ctx.lineWidth = 1.2;
  for (const k of [0.3, 0.6]) {
    ellipsePath(ctx, lx0, ly, 9 * k, r * k);
    ctx.stroke();
  }
  // moss patch and mushrooms
  ctx.fillStyle = alpha(PALETTE.moss, 0.7);
  ellipsePath(ctx, lx1 - 34, ly - r + 3, 16, 4);
  ctx.fill();
  mushroom(ctx, lx0 + 44, ly - r + 2, 7, mix(PALETTE.peach, PALETTE.cream, 0.3));
  mushroom(ctx, lx0 + 58, ly - r + 3, 5, mix(PALETTE.rose, PALETTE.cream, 0.4));
  mushroom(ctx, lx1 - 22, by, 6, mix(ACCENTS.marigold, PALETTE.cream, 0.4));
  mushroom(ctx, lx0 - 8, by, 5, mix(PALETTE.peach, PALETTE.cream, 0.4));
}

function paintLemongrass(ctx: Ctx, w: number, h: number): void {
  const rnd = seeded(1320);
  const bx = w / 2, by = h - 6;
  contactShadow(ctx, bx, by, 40, 7, PALETTE.ink, 0.14);
  const n = 15;
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1) - 0.5) * 2;
    const lean = s * (34 + rnd() * 10);
    const top = 8 + Math.abs(s) * 26 + rnd() * 10;
    const x0 = bx + s * 9;
    const c = Math.abs(s) < 0.4 ? mix(PALETTE.sage, PALETTE.butter, 0.35) : mix(PALETTE.sage, PALETTE.moss, 0.35);
    bladePath(ctx, x0, by, x0 + lean * 0.4, (by + top) / 2 + 6, x0 + lean, top, 5);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = outline(c, 0.2);
    ctx.stroke();
  }
  // a pale sheath band at the base
  ctx.fillStyle = alpha(mix(PALETTE.cream, PALETTE.butter, 0.5), 0.8);
  ellipsePath(ctx, bx, by - 8, 14, 5);
  ctx.fill();
}

function stone(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number): void {
  const fill = mix(PALETTE.lavender, PALETTE.bark, 0.42);
  ellipsePath(ctx, x, y, rx, ry, rot);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = outline(fill, 0.26);
  ctx.stroke();
  ctx.fillStyle = alpha(PALETTE.cream, 0.3);
  ellipsePath(ctx, x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.3, rot);
  ctx.fill();
}

function paintRockPool(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h - 16;
  // pool
  ellipsePath(ctx, cx, cy + 2, 40, 9);
  ctx.fillStyle = mix(ACCENTS.reservoir, PALETTE.powder, 0.3);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline(ACCENTS.reservoir, 0.25);
  ctx.stroke();
  ctx.fillStyle = alpha(PALETTE.cream, 0.35);
  ellipsePath(ctx, cx - 12, cy, 12, 2);
  ctx.fill();
  // stones around
  stone(ctx, cx - 44, cy + 2, 14, 9, -0.2);
  stone(ctx, cx + 46, cy + 3, 12, 8, 0.25);
  stone(ctx, cx - 18, cy + 9, 10, 6, 0.1);
  stone(ctx, cx + 22, cy + 10, 11, 6, -0.1);
  stone(ctx, cx + 4, cy - 6, 7, 4, 0.3);
}

/** The moon lily: a cream flower with rose-tinged petal bases, drawn without its glow (the glow is a separate image). */
function paintLily(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h * 0.6;
  ctx.fillStyle = mix(ACCENTS.reservoir, PALETTE.sage, 0.5);
  ellipsePath(ctx, cx, cy + 4, 13, 4);
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    const px = cx + Math.cos(a) * 9, py = cy + Math.sin(a) * 7;
    ellipsePath(ctx, px, py, 4.5, 2.6, a);
    ctx.fillStyle = PALETTE.cream;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = alpha(PALETTE.rose, 0.6);
    ctx.stroke();
  }
  ctx.fillStyle = mix(PALETTE.butter, PALETTE.glow, 0.5);
  ellipsePath(ctx, cx, cy - 1, 3, 2.4);
  ctx.fill();
}

function paintLilyGlow(ctx: Ctx, w: number, h: number): void {
  softGlow(ctx, w / 2, h / 2, w / 2, mix(PALETTE.cream, PALETTE.glow, 0.3), 0.7);
}

export function paintForage(scene: Phaser.Scene): void {
  const S = FORAGE_SIZES;
  paintTexture(scene, FORAGE_KEYS.thicket, S.thicket.w, S.thicket.h, paintThicket);
  paintTexture(scene, FORAGE_KEYS.log, S.log.w, S.log.h, paintLog);
  paintTexture(scene, FORAGE_KEYS.lemongrass, S.lemongrass.w, S.lemongrass.h, paintLemongrass);
  paintTexture(scene, FORAGE_KEYS.rockPool, S.rockPool.w, S.rockPool.h, paintRockPool);
  paintTexture(scene, FORAGE_KEYS.lily, S.lily.w, S.lily.h, paintLily);
  paintTexture(scene, FORAGE_KEYS.lilyGlow, S.lilyGlow, S.lilyGlow, paintLilyGlow);
}

/** Bottom-anchored forage prop image (origin 0.5, 1) at (x, groundY). */
export function makeForageProp(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  paintForage(scene);
  return makeImg(scene, x, y, key).setOrigin(0.5, 1);
}

export type RockPoolRig = { container: Phaser.GameObjects.Container; lily: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; setNight(k: number): void };

/** The rock pool with its night lily: setNight(0..1) fades the lily and its glow in. */
export function makeRockPool(scene: Phaser.Scene, x: number, y: number): RockPoolRig {
  paintForage(scene);
  const container = scene.add.container(x, y);
  const pool = makeImg(scene, 0, 0, FORAGE_KEYS.rockPool).setOrigin(0.5, 1);
  const glow = makeImg(scene, 0, -14, FORAGE_KEYS.lilyGlow).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  const lily = makeImg(scene, 0, -10, FORAGE_KEYS.lily).setAlpha(0);
  container.add([pool, glow, lily]);
  return {
    container, lily, glow,
    setNight(k: number) {
      const a = Phaser.Math.Clamp(k, 0, 1);
      lily.setAlpha(a);
      glow.setAlpha(a * 0.8);
    },
  };
}
