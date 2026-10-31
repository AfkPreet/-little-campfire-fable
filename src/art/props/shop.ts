/**
 * Doddamma's shop exterior (an estate angadi): cream-washed laterite-block walls, a red-tiled roof patched with tin,
 * a mango-leaf toran over the door, a bench, and a lantern under the awning (its glow is a separate image).
 * One ~420x300 texture used at the far left of the world and on the title.
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { contactShadow, ellipsePath, makeImg, paintTexture, roundRectPath, softGlow, type Ctx } from '@/art/pipeline';
import type { XY } from '@/world/layout';

export const SHOP_KEYS = { exterior: 'shop-exterior', lanternGlow: 'shop-lantern-glow' } as const;
export const SHOP_SIZE = { w: 420, h: 300 } as const;
/** Lantern position in texture-local px (origin bottom-center is at (w/2, h-6)). */
const LANTERN: XY = { x: 302, y: 142 };
/** glow pool texture size and peak alpha (kept small: the gatepost next door washed out at 160 px / 0.9) */
const GLOW_SIZE = 116;
const GLOW_ALPHA = 0.55;

const WALL = mix(PALETTE.cream, ACCENTS.laterite, 0.1);
const WALL_LINE = mix(WALL, ACCENTS.laterite, 0.45);
const TILE = ACCENTS.laterite;
const TIN = mix(PALETTE.lavender, PALETTE.cream, 0.5);

function walls(ctx: Ctx, x0: number, y0: number, w: number, h: number): void {
  roundRectPath(ctx, x0, y0, w, h, 8);
  ctx.fillStyle = WALL;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = outline(WALL, 0.22);
  ctx.stroke();
  // block lines, faint
  ctx.strokeStyle = alpha(WALL_LINE, 0.45);
  ctx.lineWidth = 1.5;
  const rows = Math.floor(h / 22);
  for (let r = 1; r < rows; r++) {
    const y = y0 + r * 22;
    ctx.beginPath();
    ctx.moveTo(x0 + 6, y);
    ctx.lineTo(x0 + w - 6, y);
    ctx.stroke();
    for (let b = 0; b < 8; b++) {
      const x = x0 + 18 + b * 44 + (r % 2) * 22;
      if (x > x0 + w - 8) continue;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 22);
      ctx.stroke();
    }
  }
  // a soft rain-stain at the base of the wall
  ctx.fillStyle = alpha(shade(ACCENTS.laterite, -0.1), 0.18);
  roundRectPath(ctx, x0 + 4, y0 + h - 26, w - 8, 22, 6);
  ctx.fill();
}

function roof(ctx: Ctx, x0: number, x1: number, eaveY: number, ridgeY: number): void {
  const cx = (x0 + x1) / 2;
  ctx.beginPath();
  ctx.moveTo(x0, eaveY);
  ctx.quadraticCurveTo(x0 + (cx - x0) * 0.5, eaveY - (eaveY - ridgeY) * 0.6, cx, ridgeY);
  ctx.quadraticCurveTo(x1 - (x1 - cx) * 0.5, eaveY - (eaveY - ridgeY) * 0.6, x1, eaveY);
  ctx.lineTo(x1, eaveY + 12);
  ctx.lineTo(x0, eaveY + 12);
  ctx.closePath();
  ctx.fillStyle = TILE;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = outline(TILE, 0.26);
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = alpha(outline(TILE, 0.3), 0.55);
  ctx.lineWidth = 1.6;
  for (let row = 0; row < 8; row++) {
    const y = eaveY + 4 - row * 13;
    ctx.beginPath();
    for (let x = x0 - 8; x < x1 + 8; x += 16) ctx.arc(x + 8 + (row % 2) * 8, y, 8, Math.PI, 0, true);
    ctx.stroke();
  }
  // tin patch on the right slope
  roundRectPath(ctx, cx + 36, ridgeY + 26, 70, 34, 4);
  ctx.fillStyle = TIN;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline(TIN, 0.22);
  ctx.stroke();
  ctx.strokeStyle = alpha(outline(TIN, 0.25), 0.6);
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + 36 + i * 12, ridgeY + 28);
    ctx.lineTo(cx + 36 + i * 12, ridgeY + 58);
    ctx.stroke();
  }
  ctx.restore();
  // ridge cap
  ctx.strokeStyle = outline(TILE, 0.3);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 16, ridgeY + 1);
  ctx.lineTo(cx + 16, ridgeY + 1);
  ctx.stroke();
}

function door(ctx: Ctx, x: number, g: number): void {
  roundRectPath(ctx, x - 24, g - 76, 48, 76, 8);
  ctx.fillStyle = PALETTE.bark;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = outline(PALETTE.bark, 0.28);
  ctx.stroke();
  // open leaf: a warm dark inside with a sliver of shelf
  roundRectPath(ctx, x - 20, g - 72, 24, 70, 5);
  ctx.fillStyle = mix(PALETTE.bark, PALETTE.ink, 0.55);
  ctx.fill();
  ctx.fillStyle = alpha(ACCENTS.marigold, 0.6);
  roundRectPath(ctx, x - 17, g - 50, 16, 4, 2);
  ctx.fill();
  roundRectPath(ctx, x - 17, g - 34, 16, 4, 2);
  ctx.fill();
  ctx.strokeStyle = alpha(outline(PALETTE.bark, 0.3), 0.6);
  ctx.lineWidth = 1.4;
  for (const yy of [g - 56, g - 30]) {
    ctx.beginPath();
    ctx.moveTo(x + 6, yy);
    ctx.lineTo(x + 22, yy);
    ctx.stroke();
  }
}

function shopWindow(ctx: Ctx, x: number, y: number): void {
  roundRectPath(ctx, x - 22, y - 20, 44, 40, 5);
  ctx.fillStyle = mix(PALETTE.powder, PALETTE.ink, 0.35);
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = PALETTE.bark;
  ctx.stroke();
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x, y + 18);
  ctx.moveTo(x - 20, y);
  ctx.lineTo(x + 20, y);
  ctx.stroke();
  // shutters, sage
  for (const sx of [-1, 1]) {
    roundRectPath(ctx, x + sx * 34 - 10, y - 22, 20, 44, 4);
    ctx.fillStyle = PALETTE.sage;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = outline(PALETTE.sage, 0.26);
    ctx.stroke();
  }
  // jars on the sill
  for (let i = 0; i < 3; i++) {
    const jx = x - 12 + i * 12;
    roundRectPath(ctx, jx - 4, y + 10, 8, 9, 2);
    ctx.fillStyle = i === 1 ? ACCENTS.marigold : mix(PALETTE.cream, PALETTE.butter, 0.5);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = outline(PALETTE.butter, 0.25);
    ctx.stroke();
  }
}

function mangoLeaf(ctx: Ctx, x: number, y: number, len: number, angle: number, fill: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.25, len * 0.5, 0, len);
  ctx.quadraticCurveTo(-len * 0.25, len * 0.5, 0, 0);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = outline(fill, 0.22);
  ctx.stroke();
  ctx.restore();
}

function toran(ctx: Ctx, x0: number, x1: number, y: number): void {
  ctx.strokeStyle = PALETTE.bark;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + 12, x1, y);
  ctx.stroke();
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const lx = x0 + (x1 - x0) * t;
    const ly = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * (y + 12) + t * t * y;
    mangoLeaf(ctx, lx, ly, 12, (t - 0.5) * 0.4, i % 3 === 1 ? mix(PALETTE.sage, PALETTE.moss, 0.5) : PALETTE.sage);
    if (i % 4 === 2) {
      ctx.fillStyle = ACCENTS.marigold;
      ellipsePath(ctx, lx, ly + 3, 3, 3);
      ctx.fill();
    }
  }
}

function awning(ctx: Ctx, x0: number, x1: number, y: number): void {
  // a striped cloth slung from the wall over the door, hanging down at the front edge
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.quadraticCurveTo(x1 + 4, y + 10, x1 - 2, y + 20);
  for (let x = x1 - 2; x > x0; x -= 14) ctx.quadraticCurveTo(x - 7, y + 26, x - 14, y + 20);
  ctx.closePath();
  ctx.fillStyle = PALETTE.cream;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = outline(PALETTE.cream, 0.2);
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = alpha(PALETTE.rose, 0.75);
  for (let x = x0 + 7; x < x1; x += 28) ctx.fillRect(x, y, 14, 30);
  ctx.restore();
}

function lantern(ctx: Ctx, x: number, y: number): void {
  ctx.strokeStyle = PALETTE.bark;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x, y - 9);
  ctx.stroke();
  roundRectPath(ctx, x - 7, y - 9, 14, 18, 5);
  ctx.fillStyle = mix(PALETTE.glow, PALETTE.butter, 0.4);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline(ACCENTS.marigold, 0.3);
  ctx.stroke();
  ctx.fillStyle = PALETTE.bark;
  roundRectPath(ctx, x - 5, y - 11, 10, 3, 1.5);
  ctx.fill();
  roundRectPath(ctx, x - 5, y + 8, 10, 3, 1.5);
  ctx.fill();
}

function bench(ctx: Ctx, x: number, g: number): void {
  const wood = mix(PALETTE.bark, PALETTE.cream, 0.15);
  for (const lx of [x - 26, x + 26]) {
    roundRectPath(ctx, lx - 3, g - 18, 6, 18, 2);
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = outline(wood, 0.28);
    ctx.stroke();
  }
  roundRectPath(ctx, x - 36, g - 22, 72, 7, 3);
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = outline(wood, 0.28);
  ctx.stroke();
  // a folded marigold shawl left on the bench
  roundRectPath(ctx, x - 12, g - 28, 22, 7, 3);
  ctx.fillStyle = ACCENTS.marigold;
  ctx.fill();
  ctx.strokeStyle = outline(ACCENTS.marigold, 0.25);
  ctx.stroke();
}

function sack(ctx: Ctx, x: number, g: number, fill: string): void {
  ctx.beginPath();
  ctx.moveTo(x - 14, g);
  ctx.quadraticCurveTo(x - 16, g - 22, x - 6, g - 26);
  ctx.quadraticCurveTo(x, g - 30, x + 6, g - 26);
  ctx.quadraticCurveTo(x + 16, g - 22, x + 14, g);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline(fill, 0.26);
  ctx.stroke();
  ctx.strokeStyle = alpha(outline(fill, 0.3), 0.6);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 7, g - 24);
  ctx.lineTo(x + 7, g - 24);
  ctx.stroke();
}

function paintShopExterior(ctx: Ctx, w: number, h: number): void {
  const g = h - 6;
  contactShadow(ctx, w / 2, g, w * 0.46, 10, PALETTE.ink, 0.16);
  const x0 = 46, x1 = w - 40;
  const wallTop = 118;
  // stilt-free plinth: a laterite step
  roundRectPath(ctx, x0 - 8, g - 12, x1 - x0 + 16, 14, 4);
  ctx.fillStyle = mix(ACCENTS.laterite, PALETTE.bark, 0.2);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = outline(ACCENTS.laterite, 0.28);
  ctx.stroke();
  walls(ctx, x0, wallTop, x1 - x0, g - 10 - wallTop);
  shopWindow(ctx, 132, 186);
  door(ctx, 302, g - 10);
  toran(ctx, 268, 336, g - 92);
  awning(ctx, 256, 352, wallTop + 22);
  lantern(ctx, LANTERN.x, LANTERN.y);
  roof(ctx, x0 - 26, x1 + 26, wallTop + 6, 30);
  bench(ctx, 150, g);
  sack(ctx, 60, g, mix(PALETTE.bark, PALETTE.cream, 0.4));
  sack(ctx, 88, g, mix(PALETTE.bark, PALETTE.cream, 0.55));
  // a chikki jar sign: small cream board with a marigold dot
  roundRectPath(ctx, 196, wallTop + 34, 44, 20, 5);
  ctx.fillStyle = PALETTE.cream;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline(PALETTE.cream, 0.2);
  ctx.stroke();
  ctx.fillStyle = ACCENTS.marigold;
  ellipsePath(ctx, 210, wallTop + 44, 4, 4);
  ctx.fill();
  ctx.fillStyle = PALETTE.rose;
  ellipsePath(ctx, 224, wallTop + 44, 4, 4);
  ctx.fill();
}

function paintLanternGlow(ctx: Ctx, w: number, h: number): void {
  softGlow(ctx, w / 2, h / 2, w / 2, PALETTE.glow, 0.6);
}

export function paintShop(scene: Phaser.Scene): void {
  paintTexture(scene, SHOP_KEYS.exterior, SHOP_SIZE.w, SHOP_SIZE.h, paintShopExterior);
  paintTexture(scene, SHOP_KEYS.lanternGlow, GLOW_SIZE, GLOW_SIZE, paintLanternGlow);
}

export type ShopRig = { container: Phaser.GameObjects.Container; body: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; setNight(k: number): void };

/** The shop standing at (x, groundY), bottom-center anchored; setNight(0..1) lights the awning lantern. */
export function makeShop(scene: Phaser.Scene, x: number, y: number): ShopRig {
  paintShop(scene);
  const container = scene.add.container(x, y);
  const body = makeImg(scene, 0, 0, SHOP_KEYS.exterior).setOrigin(0.5, 1);
  const glow = makeImg(scene, LANTERN.x - SHOP_SIZE.w / 2, LANTERN.y - (SHOP_SIZE.h - 6) - 6, SHOP_KEYS.lanternGlow)
    .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  container.add([body, glow]);
  return {
    container, body, glow,
    setNight(k: number) { glow.setAlpha(Phaser.Math.Clamp(k, 0, 1) * GLOW_ALPHA); },
  };
}
