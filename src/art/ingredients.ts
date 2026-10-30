/**
 * ingredients.ts: 48 px icons for the 5 pantry staples, the 5 forage items and a generic fish (keys 'ing-<id>').
 * The fish icon is a placeholder until species art lands; tint or label it by species.
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import type { ForageId, PantryId } from '@/data/types';
import { contactShadow, ellipsePath, fillOutlined, kawaiiEye, makeImg, paintTexture, roundRectPath, sheen, softGlow, type Ctx } from '@/art/pipeline';

export type IngredientIconId = PantryId | ForageId | 'fish';
export const ING_SIZE = 48;
export const ING_IDS: readonly IngredientIconId[] = ['rice', 'flour', 'tea', 'honey', 'spice', 'berries', 'mushrooms', 'herbs', 'nuts', 'moonblossom', 'fish'];
export const ING_KEYS: Record<IngredientIconId, string> = Object.fromEntries(ING_IDS.map((id) => [id, `ing-${id}`])) as Record<IngredientIconId, string>;

type P = (ctx: Ctx, w: number, h: number) => void;

/** A paper twist / pouch of `paper` with a peek of `inside` at the top. */
function pouch(paper: string, inside: string, grains = false): P {
  return (ctx, w, h) => {
    const cx = w / 2, by = h - 6;
    contactShadow(ctx, cx, by, 16, 4, PALETTE.ink, 0.14);
    ctx.beginPath();
    ctx.moveTo(cx - 16, by);
    ctx.quadraticCurveTo(cx - 20, by - 22, cx - 10, by - 28);
    ctx.lineTo(cx - 6, by - 36);
    ctx.lineTo(cx + 6, by - 36);
    ctx.lineTo(cx + 10, by - 28);
    ctx.quadraticCurveTo(cx + 20, by - 22, cx + 16, by);
    ctx.closePath();
    fillOutlined(ctx, paper, 2.2, 0.2);
    ctx.beginPath();
    ctx.moveTo(cx - 10, by - 28);
    ctx.quadraticCurveTo(cx, by - 32, cx + 10, by - 28);
    ctx.lineWidth = 2;
    ctx.strokeStyle = outline(paper, 0.2);
    ctx.stroke();
    ellipsePath(ctx, cx, by - 36, 6, 2.5);
    fillOutlined(ctx, inside, 1.6, 0.2);
    if (grains) {
      ctx.fillStyle = alpha(inside, 0.9);
      for (const [dx, dy] of [[-6, -12], [4, -8], [-1, -18], [7, -16]] as Array<[number, number]>) {
        ellipsePath(ctx, cx + dx, by + dy, 2, 1.2);
        ctx.fill();
      }
    }
    sheen(ctx, cx - 7, by - 14, 3, 8, PALETTE.cream, 0.35);
  };
}

const honeyJar: P = (ctx, w, h) => {
  const cx = w / 2, by = h - 6;
  contactShadow(ctx, cx, by, 15, 4, PALETTE.ink, 0.14);
  ctx.beginPath();
  roundRectPath(ctx, cx - 14, by - 28, 28, 28, 7);
  fillOutlined(ctx, ACCENTS.marigold, 2.2, 0.24);
  ctx.beginPath();
  roundRectPath(ctx, cx - 11, by - 36, 22, 9, 3);
  fillOutlined(ctx, PALETTE.bark, 2, 0.24);
  ellipsePath(ctx, cx, by - 36, 11, 3);
  fillOutlined(ctx, mix(PALETTE.cream, PALETTE.butter, 0.5), 1.6, 0.2);
  sheen(ctx, cx - 7, by - 14, 3, 8, PALETTE.cream, 0.4);
};

const berries: P = (ctx, w, h) => {
  const cx = w / 2, by = h - 10;
  contactShadow(ctx, cx, by + 4, 16, 4, PALETTE.ink, 0.14);
  ctx.beginPath();
  ctx.moveTo(cx, by - 20);
  ctx.quadraticCurveTo(cx + 6, by - 34, cx + 14, by - 36);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = PALETTE.moss;
  ctx.stroke();
  ellipsePath(ctx, cx + 12, by - 30, 7, 3.5, -0.5);
  fillOutlined(ctx, PALETTE.sage, 1.8, 0.24);
  for (const [dx, dy] of [[-10, -8], [8, -6], [0, -16], [-2, 0]] as Array<[number, number]>) {
    ctx.beginPath();
    ctx.arc(cx + dx, by + dy, 8, 0, Math.PI * 2);
    fillOutlined(ctx, ACCENTS.jamun, 2.2, 0.26);
    sheen(ctx, cx + dx - 2.5, by + dy - 3, 2.2, 1.6, PALETTE.cream, 0.45);
  }
};

const mushrooms: P = (ctx, w, h) => {
  const cx = w / 2, by = h - 6;
  contactShadow(ctx, cx, by, 18, 4, PALETTE.ink, 0.14);
  const one = (x: number, y: number, s: number) => {
    ctx.beginPath();
    roundRectPath(ctx, x - 5 * s, y - 14 * s, 10 * s, 14 * s, 4 * s);
    fillOutlined(ctx, mix(PALETTE.cream, PALETTE.butter, 0.3), 2, 0.2);
    ctx.beginPath();
    ctx.moveTo(x - 14 * s, y - 12 * s);
    ctx.quadraticCurveTo(x, y - 30 * s, x + 14 * s, y - 12 * s);
    ctx.closePath();
    fillOutlined(ctx, mix(PALETTE.peach, PALETTE.bark, 0.3), 2.2, 0.24);
    ctx.fillStyle = alpha(PALETTE.cream, 0.75);
    for (const [dx, dy] of [[-6, -17], [4, -20], [8, -14]] as Array<[number, number]>) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, 2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  one(cx + 9, by, 0.8);
  one(cx - 7, by, 1.1);
};

const herbs: P = (ctx, w, h) => {
  const cx = w / 2, by = h - 6;
  contactShadow(ctx, cx, by, 14, 4, PALETTE.ink, 0.12);
  const blades: Array<[number, number]> = [[-12, 0.5], [-4, 0.2], [4, -0.15], [12, -0.45]];
  for (const [dx, lean] of blades) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * 0.3, by);
    ctx.quadraticCurveTo(cx + dx * 0.6 + lean * 10, by - 20, cx + dx + lean * 14, by - 40);
    ctx.quadraticCurveTo(cx + dx * 0.7 + lean * 6, by - 20, cx + dx * 0.3 + 4, by);
    ctx.closePath();
    fillOutlined(ctx, dx < 0 ? PALETTE.sage : PALETTE.moss, 2, 0.24);
  }
  ctx.beginPath();
  ctx.moveTo(cx - 8, by - 4);
  ctx.lineTo(cx + 10, by - 4);
  ctx.lineWidth = 4;
  ctx.strokeStyle = PALETTE.bark;
  ctx.stroke();
};

const nuts: P = (ctx, w, h) => {
  const cx = w / 2, by = h - 10;
  contactShadow(ctx, cx, by + 4, 16, 4, PALETTE.ink, 0.14);
  for (const [dx, dy, rot] of [[-10, -4, -0.3], [10, -4, 0.3], [0, -16, 0]] as Array<[number, number, number]>) {
    ellipsePath(ctx, cx + dx, by + dy, 8, 11, rot);
    fillOutlined(ctx, mix(PALETTE.butter, PALETTE.bark, 0.4), 2.2, 0.26);
    ellipsePath(ctx, cx + dx, by + dy - 7, 4, 3, rot);
    fillOutlined(ctx, PALETTE.bark, 1.6, 0.2);
    sheen(ctx, cx + dx - 2.5, by + dy - 1, 2, 4, PALETTE.cream, 0.35);
  }
};

const moonblossom: P = (ctx, w, h) => {
  const cx = w / 2, cy = h / 2;
  softGlow(ctx, cx, cy, 22, PALETTE.glow, 0.5);
  const petal = mix(PALETTE.cream, PALETTE.lavender, 0.35);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ellipsePath(ctx, cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 9, 5.5, a);
    fillOutlined(ctx, petal, 2, 0.18);
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  fillOutlined(ctx, PALETTE.glow, 1.8, 0.2);
};

const fish: P = (ctx, w, h) => {
  const cx = w / 2 - 2, cy = h / 2;
  contactShadow(ctx, cx, h - 8, 18, 4, PALETTE.ink, 0.14);
  const body = mix(PALETTE.powder, PALETTE.lavender, 0.3);
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy);
  ctx.quadraticCurveTo(cx - 4, cy - 14, cx + 10, cy);
  ctx.quadraticCurveTo(cx - 4, cy + 14, cx - 18, cy);
  ctx.closePath();
  fillOutlined(ctx, body, 2.2, 0.26);
  ctx.beginPath();
  ctx.moveTo(cx + 8, cy);
  ctx.lineTo(cx + 20, cy - 9);
  ctx.lineTo(cx + 20, cy + 9);
  ctx.closePath();
  fillOutlined(ctx, body, 2.2, 0.26);
  ellipsePath(ctx, cx - 2, cy + 3, 7, 3);
  ctx.fillStyle = alpha(PALETTE.cream, 0.5);
  ctx.fill();
  kawaiiEye(ctx, cx - 11, cy - 2, 2.6, 2.8, PALETTE.ink, PALETTE.cream);
  ctx.fillStyle = alpha(PALETTE.blush, 0.6);
  ellipsePath(ctx, cx - 8, cy + 3, 2.4, 1.4);
  ctx.fill();
};

const PAINTERS: Record<IngredientIconId, P> = {
  rice: pouch(mix(PALETTE.cream, PALETTE.butter, 0.25), mix(PALETTE.rose, PALETTE.bark, 0.4), true),
  flour: pouch(mix(PALETTE.cream, PALETTE.powder, 0.15), PALETTE.cream, false),
  tea: pouch(mix(PALETTE.sage, PALETTE.cream, 0.35), shade(PALETTE.bark, -0.2), true),
  honey: honeyJar,
  spice: pouch(mix(PALETTE.peach, PALETTE.bark, 0.2), mix(PALETTE.ember, PALETTE.bark, 0.3), true),
  berries, mushrooms, herbs, nuts, moonblossom, fish,
};

export function paintIngredients(scene: Phaser.Scene): void {
  for (const id of ING_IDS) paintTexture(scene, ING_KEYS[id], ING_SIZE, ING_SIZE, PAINTERS[id]);
}

export function makeIngredientIcon(scene: Phaser.Scene, id: IngredientIconId, x = 0, y = 0): Phaser.GameObjects.Image {
  paintIngredients(scene);
  return makeImg(scene, x, y, ING_KEYS[id]);
}
