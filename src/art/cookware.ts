/**
 * cookware.ts: close-up cookware for the Cooking overlay (kettle, clay pot, iron tawa, bamboo steamer, ~220 px each)
 * and a close-up fire (~360 px wide: logs + stones, three flame layers, a soft glow). Painted once via paintTexture.
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import type { CookwareId } from '@/data/types';
import { contactShadow, ellipsePath, fillOutlined, makeImg, paintTexture, radialGradient, roundRectPath, sheen, softGlow, type Ctx } from '@/art/pipeline';

export const COOKWARE_KEYS: Record<CookwareId, string> = {
  kettle: 'cookware-kettle',
  pot: 'cookware-pot',
  skillet: 'cookware-skillet',
  steamer: 'cookware-steamer',
};
export const COOKWARE_SIZE = { w: 220, h: 200 } as const;
/** Where ingredients sit inside each cookware (texture-local, from the center). */
export const COOKWARE_BOWL: Record<CookwareId, { y: number; rx: number }> = {
  kettle: { y: -20, rx: 50 },
  pot: { y: -18, rx: 62 },
  skillet: { y: 10, rx: 70 },
  steamer: { y: -30, rx: 56 },
};

export const FIRE_CLOSE_KEYS = {
  base: 'fire-close-base',
  flames: ['fire-close-flame-a', 'fire-close-flame-b', 'fire-close-flame-c'],
  glow: 'fire-close-glow',
} as const;
export const FIRE_CLOSE_SIZES = {
  base: { w: 360, h: 120 },
  flames: [{ w: 150, h: 190 }, { w: 110, h: 140 }, { w: 80, h: 100 }],
  glow: 480,
} as const;

const CLAY = ACCENTS.laterite;
const TEAL = ACCENTS.reservoir;
const IRON = mix(PALETTE.ink, PALETTE.bark, 0.3);
const BAMBOO = mix(PALETTE.butter, PALETTE.bark, 0.35);

function rim(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string): void {
  ellipsePath(ctx, cx, cy, rx, ry);
  fillOutlined(ctx, fill, 3, 0.26);
  ellipsePath(ctx, cx, cy, rx * 0.84, ry * 0.7);
  ctx.fillStyle = shade(fill, -0.32);
  ctx.fill();
}

function paintKettle(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h / 2 + 10;
  contactShadow(ctx, cx, h - 14, 90, 14, PALETTE.ink, 0.16);
  // body
  ctx.beginPath();
  ctx.moveTo(cx - 70, cy + 50);
  ctx.quadraticCurveTo(cx - 100, cy - 20, cx - 55, cy - 50);
  ctx.quadraticCurveTo(cx, cy - 72, cx + 55, cy - 50);
  ctx.quadraticCurveTo(cx + 100, cy - 20, cx + 70, cy + 50);
  ctx.quadraticCurveTo(cx, cy + 68, cx - 70, cy + 50);
  ctx.closePath();
  fillOutlined(ctx, TEAL, 3, 0.26);
  // spout
  ctx.beginPath();
  ctx.moveTo(cx + 60, cy - 10);
  ctx.quadraticCurveTo(cx + 100, cy - 40, cx + 104, cy - 72);
  ctx.lineTo(cx + 86, cy - 76);
  ctx.quadraticCurveTo(cx + 78, cy - 36, cx + 56, cy + 10);
  ctx.closePath();
  fillOutlined(ctx, TEAL, 3, 0.26);
  // lid + knob
  ellipsePath(ctx, cx, cy - 56, 46, 12);
  fillOutlined(ctx, shade(TEAL, 0.1), 3, 0.26);
  ellipsePath(ctx, cx, cy - 68, 10, 8);
  fillOutlined(ctx, PALETTE.bark, 2.5, 0.26);
  // handle (bark grip)
  ctx.beginPath();
  ctx.lineWidth = 10;
  ctx.strokeStyle = outline(PALETTE.bark, 0.26);
  ctx.arc(cx, cy - 56, 52, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.strokeStyle = PALETTE.bark;
  ctx.stroke();
  sheen(ctx, cx - 36, cy - 10, 10, 26, PALETTE.cream, 0.3);
}

function paintPot(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h / 2 + 16;
  contactShadow(ctx, cx, h - 14, 92, 14, PALETTE.ink, 0.16);
  ctx.beginPath();
  ctx.moveTo(cx - 62, cy + 48);
  ctx.quadraticCurveTo(cx - 108, cy - 10, cx - 76, cy - 52);
  ctx.lineTo(cx + 76, cy - 52);
  ctx.quadraticCurveTo(cx + 108, cy - 10, cx + 62, cy + 48);
  ctx.quadraticCurveTo(cx, cy + 66, cx - 62, cy + 48);
  ctx.closePath();
  fillOutlined(ctx, CLAY, 3, 0.26);
  // painted band
  ctx.beginPath();
  ctx.moveTo(cx - 92, cy - 14);
  ctx.quadraticCurveTo(cx, cy + 4, cx + 92, cy - 14);
  ctx.lineWidth = 6;
  ctx.strokeStyle = alpha(PALETTE.cream, 0.45);
  ctx.stroke();
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(cx + i * 24, cy + 2 + Math.abs(i) * 0.6, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = alpha(PALETTE.cream, 0.5);
    ctx.fill();
  }
  rim(ctx, cx, cy - 52, 84, 20, shade(CLAY, 0.08));
  // handles
  for (const s of [-1, 1]) {
    ellipsePath(ctx, cx + s * 96, cy - 30, 12, 8);
    fillOutlined(ctx, shade(CLAY, -0.08), 2.5, 0.26);
  }
  sheen(ctx, cx - 50, cy, 9, 30, PALETTE.cream, 0.22);
}

function paintSkillet(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2 - 14, cy = h / 2 + 24;
  contactShadow(ctx, cx, h - 14, 96, 12, PALETTE.ink, 0.16);
  // handle
  ctx.beginPath();
  roundRectPath(ctx, cx + 62, cy - 22, 98, 22, 10);
  fillOutlined(ctx, IRON, 3, 0.3);
  ctx.beginPath();
  ctx.arc(cx + 148, cy - 11, 5, 0, Math.PI * 2);
  ctx.fillStyle = shade(IRON, -0.3);
  ctx.fill();
  // pan body (shallow)
  ctx.beginPath();
  ctx.moveTo(cx - 92, cy - 14);
  ctx.quadraticCurveTo(cx - 84, cy + 36, cx, cy + 40);
  ctx.quadraticCurveTo(cx + 84, cy + 36, cx + 92, cy - 14);
  ctx.closePath();
  fillOutlined(ctx, IRON, 3, 0.3);
  // bark rim (a wooden lip) lifts the heavy ink of the iron
  rim(ctx, cx, cy - 14, 92, 24, mix(PALETTE.bark, PALETTE.cream, 0.12));
  ellipsePath(ctx, cx, cy - 14, 80, 18);
  ctx.fillStyle = mix(IRON, PALETTE.cream, 0.08);
  ctx.fill();
  ellipsePath(ctx, cx, cy - 14, 80 * 0.84, 18 * 0.7);
  ctx.fillStyle = shade(IRON, -0.2);
  ctx.fill();
  // seasoning sheen
  ellipsePath(ctx, cx, cy - 12, 60, 12);
  ctx.fillStyle = alpha(PALETTE.ember, 0.12);
  ctx.fill();
  sheen(ctx, cx - 40, cy - 16, 18, 5, PALETTE.cream, 0.25);
}

function paintSteamer(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h / 2 + 10;
  contactShadow(ctx, cx, h - 14, 90, 14, PALETTE.ink, 0.16);
  const tier = (y: number, hgt: number) => {
    ctx.beginPath();
    roundRectPath(ctx, cx - 78, y, 156, hgt, 10);
    fillOutlined(ctx, BAMBOO, 3, 0.26);
    // weave lines
    ctx.strokeStyle = alpha(PALETTE.bark, 0.35);
    ctx.lineWidth = 2;
    for (let x = cx - 66; x <= cx + 66; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.lineTo(x, y + hgt - 6);
      ctx.stroke();
    }
    ctx.beginPath();
    roundRectPath(ctx, cx - 82, y - 4, 164, 10, 5);
    fillOutlined(ctx, shade(BAMBOO, -0.12), 2.5, 0.26);
  };
  tier(cy + 10, 44);
  tier(cy - 36, 44);
  // lid dome
  ctx.beginPath();
  ctx.moveTo(cx - 80, cy - 36);
  ctx.quadraticCurveTo(cx, cy - 104, cx + 80, cy - 36);
  ctx.closePath();
  fillOutlined(ctx, shade(BAMBOO, 0.08), 3, 0.26);
  ctx.strokeStyle = alpha(PALETTE.bark, 0.3);
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 80 + i * 10, cy - 36);
    ctx.quadraticCurveTo(cx, cy - 104 + i * 14, cx + 80 - i * 10, cy - 36);
    ctx.stroke();
  }
  ellipsePath(ctx, cx, cy - 86, 12, 8);
  fillOutlined(ctx, PALETTE.bark, 2.5, 0.26);
  // base rim (sits on the pot)
  ellipsePath(ctx, cx, cy + 56, 70, 10);
  fillOutlined(ctx, CLAY, 2.5, 0.26);
}

function paintFireBase(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  contactShadow(ctx, cx, h - 12, 170, 16, PALETTE.ink, 0.2);
  // ash bed
  ellipsePath(ctx, cx, h - 30, 120, 18);
  ctx.fillStyle = alpha(PALETTE.lavender, 0.35);
  ctx.fill();
  // logs
  const logs: Array<[number, number, number]> = [[-40, 0.18, 150], [36, -0.14, 140], [0, 0.04, 120]];
  for (const [dx, rot, len] of logs) {
    ctx.save();
    ctx.translate(cx + dx, h - 48);
    ctx.rotate(rot);
    ctx.beginPath();
    roundRectPath(ctx, -len / 2, -14, len, 28, 14);
    fillOutlined(ctx, PALETTE.bark, 3, 0.28);
    ellipsePath(ctx, -len / 2 + 4, 0, 10, 13);
    ctx.fillStyle = mix(PALETTE.bark, PALETTE.cream, 0.35);
    ctx.fill();
    ctx.strokeStyle = outline(PALETTE.bark, 0.28);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }
  // embers glowing in the logs
  for (let i = 0; i < 7; i++) {
    const x = cx - 60 + i * 20, y = h - 50 + Math.sin(i * 1.7) * 6;
    softGlow(ctx, x, y, 14, PALETTE.ember, 0.55);
  }
  // stones
  const stones: Array<[number, number, number, number]> = [[-150, 0, 34, 20], [-100, 8, 30, 18], [100, 8, 30, 18], [150, 0, 34, 20], [-50, 12, 28, 16], [50, 12, 28, 16]];
  for (const [dx, dy, rx, ry] of stones) {
    ellipsePath(ctx, cx + dx, h - 26 + dy, rx, ry);
    fillOutlined(ctx, ACCENTS.laterite, 3, 0.26);
    sheen(ctx, cx + dx - rx * 0.3, h - 32 + dy, rx * 0.35, ry * 0.3, PALETTE.cream, 0.28);
  }
}

function paintCloseFlame(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const tongue = (sx: number, top: number, fill: string) => {
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.bezierCurveTo(cx + w * 0.42 * sx, h * 0.3, cx + w * 0.46 * sx, h * 0.72, cx, h - 4);
    ctx.bezierCurveTo(cx - w * 0.46 * sx, h * 0.72, cx - w * 0.42 * sx, h * 0.3, cx, top);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  ctx.lineWidth = 3;
  tongue(1, 4, PALETTE.ember);
  ctx.strokeStyle = outline(PALETTE.ember, 0.18);
  tongue(1, 4, alpha(PALETTE.ember, 0));
  ctx.stroke();
  tongue(0.68, h * 0.3, mix(PALETTE.ember, PALETTE.glow, 0.6));
  tongue(0.4, h * 0.55, mix(PALETTE.glow, PALETTE.cream, 0.4));
}

function paintCloseGlow(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = radialGradient(ctx, w / 2, h / 2, 0, w / 2, [
    [0, alpha(PALETTE.glow, 0.55)],
    [0.4, alpha(PALETTE.ember, 0.22)],
    [1, alpha(PALETTE.ember, 0)],
  ]);
  ctx.fillRect(0, 0, w, h);
}

export function paintCookware(scene: Phaser.Scene): void {
  const { w, h } = COOKWARE_SIZE;
  paintTexture(scene, COOKWARE_KEYS.kettle, w, h, paintKettle);
  paintTexture(scene, COOKWARE_KEYS.pot, w, h, paintPot);
  paintTexture(scene, COOKWARE_KEYS.skillet, w, h, paintSkillet);
  paintTexture(scene, COOKWARE_KEYS.steamer, w, h, paintSteamer);
  paintTexture(scene, FIRE_CLOSE_KEYS.base, FIRE_CLOSE_SIZES.base.w, FIRE_CLOSE_SIZES.base.h, paintFireBase);
  FIRE_CLOSE_KEYS.flames.forEach((k, i) => paintTexture(scene, k, FIRE_CLOSE_SIZES.flames[i].w, FIRE_CLOSE_SIZES.flames[i].h, paintCloseFlame));
  paintTexture(scene, FIRE_CLOSE_KEYS.glow, FIRE_CLOSE_SIZES.glow, FIRE_CLOSE_SIZES.glow, paintCloseGlow);
}

/** A cookware image (made, not added) for containers. */
export function makeCookware(scene: Phaser.Scene, id: CookwareId, x = 0, y = 0): Phaser.GameObjects.Image {
  paintCookware(scene);
  return makeImg(scene, x, y, COOKWARE_KEYS[id]);
}

export type CloseFireRig = {
  container: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Image;
  flames: Phaser.GameObjects.Image[];
  /** 1 = normal, ~1.4 = flaring while cooking */
  setFlare(k: number): void;
  update(tSeconds: number): void;
  destroy(): void;
};

const FLAME_OFFSET: Array<[number, number]> = [[0, -18], [-40, -16], [38, -14]];
const FLAME_PHASE = [0, 2.1, 4.3];

/** The close-up fire; (x, y) is the center of the stone ring, flames rise above it. */
export function makeCloseFire(scene: Phaser.Scene, x: number, y: number): CloseFireRig {
  paintCookware(scene);
  const container = scene.add.container(x, y);
  const glow = makeImg(scene, 0, -70, FIRE_CLOSE_KEYS.glow).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8);
  const base = makeImg(scene, 0, 0, FIRE_CLOSE_KEYS.base).setOrigin(0.5, 0.75);
  const flames = FIRE_CLOSE_KEYS.flames.map((k, i) => makeImg(scene, FLAME_OFFSET[i][0], FLAME_OFFSET[i][1], k).setOrigin(0.5, 1));
  container.add([glow, base, ...flames]);
  let flare = 1;
  const B = 1 / 2;
  return {
    container, glow, flames,
    setFlare(k) { flare = k; },
    update(t) {
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i];
        const ph = t * 5 + FLAME_PHASE[i];
        const sy = 1 + Math.sin(ph) * 0.07 + Math.sin(ph * 2.3) * 0.04;
        const sx = 1 - Math.sin(ph * 1.3) * 0.05;
        f.setScale(B * sx * (0.9 + flare * 0.1), B * sy * flare);
        f.x = FLAME_OFFSET[i][0] + Math.sin(ph * 0.8) * 3;
      }
      glow.setAlpha(0.6 + Math.sin(t * 3.1) * 0.08 + (flare - 1) * 0.5);
      glow.setScale(B * (1 + (flare - 1) * 0.6));
    },
    destroy() { container.destroy(); },
  };
}
