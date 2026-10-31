/**
 * items.ts: small item icons (56 px) for shop cards, backpack and trays.
 * Keys are stable: 'item-<id>'. Gear, pantry and decor are real little drawings; fish, forage and dishes
 * fall back to a soft disc with a symbol until their own painters land (paintTexture keeps an existing key).
 */
import Phaser from 'phaser';
import { PALETTE, ACCENTS, mix, shade, alpha } from '@/config/palette';
import { paintTexture, roundRectPath, ellipsePath, fillOutlined, type Ctx } from '@/art/pipeline';
import { GEAR } from '@/data/items';
import { PANTRY } from '@/data/pantry';
import { DECOR } from '@/data/decor';
import { FISH } from '@/data/fish';
import { FORAGE } from '@/data/forage';
import { RECIPES } from '@/data/recipes';

export const ITEM_ICON = 56;
export const ITEM_KEYS = { fish: 'item-fish', forage: 'item-forage', dish: 'item-dish' } as const;

export function itemIconKey(id: string): string {
  return `item-${id}`;
}
/** The icon key for an id, falling back to a generic icon by kind. */
export function iconFor(scene: Phaser.Scene, id: string, kind: keyof typeof ITEM_KEYS | 'gear' = 'gear'): string {
  const k = itemIconKey(id);
  if (scene.textures.exists(k)) return k;
  return kind === 'gear' ? k : ITEM_KEYS[kind];
}

const P = PALETTE, A = ACCENTS;
const C = ITEM_ICON / 2;

// ---------- tiny helpers ----------
function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, lw = 2.5): void {
  roundRectPath(ctx, x, y, w, h, r);
  fillOutlined(ctx, fill, lw);
}
function oval(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string, lw = 2.5): void {
  ellipsePath(ctx, cx, cy, rx, ry);
  fillOutlined(ctx, fill, lw);
}
function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, w = 3): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}
function shadow(ctx: Ctx): void {
  ctx.beginPath();
  ellipsePath(ctx, C, ITEM_ICON - 6, 18, 4);
  ctx.fillStyle = alpha(P.ink, 0.12);
  ctx.fill();
}
function softDisc(ctx: Ctx, fill: string): void {
  ctx.beginPath();
  ctx.arc(C, C, 24, 0, Math.PI * 2);
  fillOutlined(ctx, fill, 2.5, 0.18);
}
function sparkle(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fillStyle = color;
  ctx.fill();
}

// ---------- gear ----------
function tent(ctx: Ctx, cloth: string, roofOnly = false, window = false): void {
  shadow(ctx);
  ctx.beginPath();
  ctx.moveTo(6, 46); ctx.lineTo(C, 10); ctx.lineTo(50, 46); ctx.closePath();
  fillOutlined(ctx, cloth);
  if (!roofOnly) {
    ctx.beginPath();
    ctx.moveTo(C, 46); ctx.lineTo(C - 9, 46); ctx.lineTo(C, 22); ctx.lineTo(C + 9, 46); ctx.closePath();
    ctx.fillStyle = shade(cloth, -0.3);
    ctx.fill();
  }
  if (window) { oval(ctx, C + 11, 32, 4, 4, P.glow, 1.5); }
  line(ctx, C, 10, C, 4, shade(P.bark, -0.1), 2.5);
}
function dome(ctx: Ctx, cloth: string): void {
  shadow(ctx);
  // a round dome with a laterite rim band, a cream door arch and a small glowing window
  ctx.beginPath();
  ctx.moveTo(6, 46);
  ctx.arc(C, 46, 22, Math.PI, 0, false);
  ctx.closePath();
  fillOutlined(ctx, cloth);
  ctx.beginPath();
  ctx.moveTo(6, 46); ctx.lineTo(50, 46);
  ctx.strokeStyle = A.laterite; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(C - 7, 46);
  ctx.arc(C, 46, 7, Math.PI, 0, false);
  ctx.closePath();
  ctx.fillStyle = shade(cloth, -0.28); ctx.fill();
  oval(ctx, C + 13, 34, 3.5, 3.5, P.glow, 1.5);
  ctx.beginPath(); ctx.moveTo(C - 14, 30); ctx.quadraticCurveTo(C, 20, C + 14, 30);
  ctx.strokeStyle = alpha(P.cream, 0.6); ctx.lineWidth = 2; ctx.stroke();
}
function rod(ctx: Ctx, wood: string, glow = false): void {
  if (glow) { ctx.beginPath(); ctx.arc(14, 14, 11, 0, Math.PI * 2); ctx.fillStyle = alpha(P.glow, 0.5); ctx.fill(); }
  line(ctx, 10, 50, 44, 10, wood, 4);
  line(ctx, 44, 10, 46, 30, mix(P.ink, P.cream, 0.5), 1.5);
  ctx.beginPath(); ctx.arc(46, 34, 4, 0, Math.PI * 2); ctx.strokeStyle = mix(P.ink, P.cream, 0.4); ctx.lineWidth = 2; ctx.stroke();
  oval(ctx, 18, 42, 5, 5, A.laterite, 2);
}
function bait(ctx: Ctx, fill: string, sparkly: boolean): void {
  shadow(ctx);
  rr(ctx, 10, 18, 36, 28, 8, A.laterite);
  rr(ctx, 14, 12, 28, 10, 4, shade(A.laterite, -0.15), 2);
  for (const [x, y] of [[20, 32], [30, 36], [38, 30]] as const) oval(ctx, x, y, 5, 3.5, fill, 1.5);
  if (sparkly) { sparkle(ctx, 28, 26, 4, P.cream); sparkle(ctx, 40, 38, 3, P.cream); }
}
function kettle(ctx: Ctx): void {
  shadow(ctx);
  oval(ctx, C, 34, 18, 14, A.reservoir);
  rr(ctx, C - 10, 14, 20, 8, 4, A.reservoir, 2);
  ctx.beginPath(); ctx.arc(C, 14, 8, Math.PI, 0); ctx.strokeStyle = shade(A.reservoir, -0.3); ctx.lineWidth = 3; ctx.stroke();
  line(ctx, 44, 30, 52, 20, A.reservoir, 5);
  oval(ctx, C, 12, 3, 3, P.bark, 1.5);
}
function pot(ctx: Ctx): void {
  shadow(ctx);
  oval(ctx, C, 36, 19, 13, A.laterite);
  rr(ctx, C - 17, 18, 34, 8, 4, shade(A.laterite, 0.1), 2);
  oval(ctx, C, 16, 9, 4, shade(A.laterite, -0.2), 1.5);
}
function skillet(ctx: Ctx): void {
  shadow(ctx);
  const iron = mix(P.ink, P.bark, 0.6);
  oval(ctx, 24, 32, 18, 14, mix(P.bark, P.cream, 0.15)); // bark rim
  oval(ctx, 24, 32, 15, 11, iron, 1.5);
  oval(ctx, 24, 31, 10, 6.5, shade(iron, 0.15), 1.5);
  line(ctx, 40, 26, 52, 16, P.bark, 5);
}
function steamer(ctx: Ctx): void {
  shadow(ctx);
  const bamboo = mix(P.butter, P.bark, 0.35);
  rr(ctx, 8, 30, 40, 14, 5, bamboo);
  rr(ctx, 10, 20, 36, 12, 5, shade(bamboo, 0.08));
  for (const x of [16, 28, 40]) line(ctx, x, 20, x, 44, shade(bamboo, -0.25), 1.5);
  oval(ctx, C, 14, 6, 3, P.cream, 1.5);
}

// ---------- pantry ----------
function paperTwist(ctx: Ctx, paper: string, inside: string, dots = 0): void {
  shadow(ctx);
  ctx.beginPath();
  ctx.moveTo(14, 48); ctx.lineTo(10, 24); ctx.quadraticCurveTo(C, 16, 46, 24); ctx.lineTo(42, 48); ctx.closePath();
  fillOutlined(ctx, paper);
  oval(ctx, C, 22, 14, 6, inside, 1.5);
  for (let i = 0; i < dots; i++) oval(ctx, 18 + i * 10, 22 + (i % 2) * 2, 2, 2, shade(inside, -0.25), 1);
}
function honeyJar(ctx: Ctx): void {
  shadow(ctx);
  rr(ctx, 14, 18, 28, 30, 9, P.glow);
  rr(ctx, 12, 12, 32, 10, 4, A.marigold, 2);
  oval(ctx, 22, 30, 3, 6, alpha(P.cream, 0.7), 0.5);
}
function spicePouch(ctx: Ctx): void {
  shadow(ctx);
  ctx.beginPath();
  ctx.moveTo(12, 46); ctx.quadraticCurveTo(8, 26, 22, 20); ctx.lineTo(34, 20); ctx.quadraticCurveTo(48, 26, 44, 46); ctx.closePath();
  fillOutlined(ctx, A.laterite);
  rr(ctx, 20, 12, 16, 10, 4, mix(A.laterite, P.butter, 0.4), 2);
  line(ctx, 18, 22, 38, 22, shade(A.laterite, -0.3), 2);
}

// ---------- decor ----------
function flowerPot(ctx: Ctx): void {
  shadow(ctx);
  ctx.beginPath(); ctx.moveTo(16, 32); ctx.lineTo(40, 32); ctx.lineTo(36, 48); ctx.lineTo(20, 48); ctx.closePath();
  fillOutlined(ctx, A.laterite);
  line(ctx, C, 32, C, 20, P.moss, 3);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; oval(ctx, C + Math.cos(a) * 7, 16 + Math.sin(a) * 7, 4.5, 4.5, P.rose, 1.5); }
  oval(ctx, C, 16, 3.5, 3.5, P.butter, 1);
}
function paperLantern(ctx: Ctx): void {
  line(ctx, C, 4, C, 12, P.bark, 2);
  oval(ctx, C, 30, 16, 18, P.peach);
  for (const y of [22, 30, 38]) line(ctx, C - 14, y, C + 14, y, alpha(shade(P.peach, -0.3), 0.6), 1.5);
  rr(ctx, C - 6, 10, 12, 5, 2, P.bark, 1.5);
  rr(ctx, C - 6, 46, 12, 5, 2, P.bark, 1.5);
  oval(ctx, C, 30, 5, 7, alpha(P.glow, 0.8), 0.5);
}
function cushion(ctx: Ctx): void {
  shadow(ctx);
  rr(ctx, 8, 20, 40, 26, 12, P.rose);
  rr(ctx, 12, 16, 32, 14, 8, shade(P.rose, 0.12), 2);
  oval(ctx, C, 26, 2.5, 2.5, P.cream, 1);
}
function bunting(ctx: Ctx): void {
  ctx.beginPath(); ctx.moveTo(4, 14); ctx.quadraticCurveTo(C, 26, 52, 14); ctx.strokeStyle = P.bark; ctx.lineWidth = 2.5; ctx.stroke();
  const cols = [P.sage, A.marigold, P.moss, A.marigold, P.sage];
  cols.forEach((c, i) => {
    const x = 9 + i * 9.5, y = 15 + Math.sin((i + 0.5) / 5 * Math.PI) * 7;
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 16); ctx.closePath();
    fillOutlined(ctx, c, 1.5);
  });
}
function chime(ctx: Ctx): void {
  rr(ctx, 14, 8, 28, 6, 3, P.bark, 2);
  const bamboo = mix(P.butter, P.bark, 0.3);
  [18, 26, 34, 42].forEach((x, i) => { line(ctx, x, 14, x, 20, mix(P.ink, P.cream, 0.5), 1); rr(ctx, x - 3, 20, 6, 18 + (i % 2) * 6, 3, bamboo, 1.5); });
}
function rug(ctx: Ctx): void {
  shadow(ctx);
  rr(ctx, 6, 18, 44, 28, 6, A.jamun);
  rr(ctx, 12, 24, 32, 16, 4, A.marigold, 1.5);
  rr(ctx, 20, 28, 16, 8, 3, P.rose, 1.5);
}
function lights(ctx: Ctx): void {
  ctx.beginPath(); ctx.moveTo(4, 16); ctx.quadraticCurveTo(C, 34, 52, 16); ctx.strokeStyle = mix(P.ink, P.cream, 0.4); ctx.lineWidth = 2; ctx.stroke();
  [P.glow, P.peach, P.butter, P.glow, P.peach].forEach((c, i) => {
    const x = 9 + i * 9.5, y = 17 + Math.sin((i + 0.5) / 5 * Math.PI) * 11;
    ctx.beginPath(); ctx.arc(x, y + 6, 7, 0, Math.PI * 2); ctx.fillStyle = alpha(c, 0.35); ctx.fill();
    oval(ctx, x, y + 6, 4, 5, c, 1.5);
  });
}
function bookshelf(ctx: Ctx): void {
  shadow(ctx);
  rr(ctx, 10, 10, 36, 38, 5, P.bark);
  rr(ctx, 14, 30, 28, 3, 1.5, shade(P.bark, -0.3), 1);
  [[16, 14, 6, 15, P.rose], [23, 16, 6, 13, P.sage], [30, 13, 7, 16, A.marigold], [16, 35, 7, 11, P.powder], [25, 36, 6, 10, A.jamun]].forEach(([x, y, w, h, c]) =>
    rr(ctx, x as number, y as number, w as number, h as number, 1.5, c as string, 1.5));
}
function hammock(ctx: Ctx): void {
  line(ctx, 4, 16, 14, 30, P.bark, 2);
  line(ctx, 52, 16, 42, 30, P.bark, 2);
  ctx.beginPath(); ctx.moveTo(12, 28); ctx.quadraticCurveTo(C, 50, 44, 28); ctx.quadraticCurveTo(C, 40, 12, 28); ctx.closePath();
  fillOutlined(ctx, A.marigold);
  for (const x of [20, 28, 36]) line(ctx, x, 31, x, 40, alpha(shade(A.marigold, -0.3), 0.6), 1.5);
}
function telescope(ctx: Ctx): void {
  shadow(ctx);
  line(ctx, C, 30, 16, 50, P.bark, 3); line(ctx, C, 30, 40, 50, P.bark, 3);
  ctx.save(); ctx.translate(C, 28); ctx.rotate(-0.6);
  rr(ctx, -16, -6, 32, 12, 6, P.powder);
  rr(ctx, 10, -8, 10, 16, 4, shade(P.powder, -0.15), 2);
  ctx.restore();
  sparkle(ctx, 44, 10, 4, P.glow);
}
function guardianLantern(ctx: Ctx): void {
  ctx.beginPath(); ctx.arc(C, 30, 24, 0, Math.PI * 2); ctx.fillStyle = alpha(P.glow, 0.3); ctx.fill();
  line(ctx, C, 4, C, 12, P.bark, 2);
  oval(ctx, C, 30, 15, 17, mix(P.glow, A.reservoir, 0.35));
  oval(ctx, C, 30, 6, 8, P.glow, 0.5);
  rr(ctx, C - 6, 10, 12, 5, 2, A.reservoir, 1.5);
  rr(ctx, C - 6, 45, 12, 5, 2, A.reservoir, 1.5);
}

// ---------- fallbacks: soft disc + symbol ----------
function fishDisc(ctx: Ctx): void {
  softDisc(ctx, mix(P.powder, P.cream, 0.3));
  ctx.beginPath(); ellipsePath(ctx, C - 2, C, 12, 7); fillOutlined(ctx, P.powder, 2);
  ctx.beginPath(); ctx.moveTo(C + 9, C); ctx.lineTo(C + 17, C - 7); ctx.lineTo(C + 17, C + 7); ctx.closePath(); fillOutlined(ctx, P.powder, 2);
  oval(ctx, C - 8, C - 2, 2, 2, P.ink, 0.5);
}
function forageDisc(ctx: Ctx): void {
  softDisc(ctx, mix(P.sage, P.cream, 0.4));
  ctx.beginPath(); ctx.moveTo(C, C + 12); ctx.quadraticCurveTo(C - 14, C, C, C - 12); ctx.quadraticCurveTo(C + 14, C, C, C + 12); ctx.closePath();
  fillOutlined(ctx, P.sage, 2);
  line(ctx, C, C + 12, C, C - 8, shade(P.sage, -0.3), 1.5);
}
function dishDisc(ctx: Ctx): void {
  softDisc(ctx, mix(P.peach, P.cream, 0.4));
  oval(ctx, C, C + 6, 16, 6, P.cream, 2);
  oval(ctx, C, C + 2, 11, 7, P.peach, 2);
  line(ctx, C - 4, C - 8, C - 5, C - 16, alpha(P.cream, 0.9), 2);
  line(ctx, C + 4, C - 8, C + 5, C - 16, alpha(P.cream, 0.9), 2);
}

const GEAR_PAINTERS: Record<string, (ctx: Ctx) => void> = {
  tent_leaf: (c) => tent(c, P.sage),
  tent_dome: (c) => dome(c, mix(P.powder, P.cream, 0.35)),
  tent_cabin: (c) => tent(c, P.bark, false, true),
  rod_bamboo: (c) => rod(c, mix(P.butter, P.bark, 0.4)),
  rod_willow: (c) => rod(c, P.bark),
  rod_moonlight: (c) => rod(c, P.lavender, true),
  bait_wiggly: (c) => bait(c, P.peach, false),
  bait_sparkle: (c) => bait(c, P.lavender, true),
  kettle, pot, skillet, steamer,
};
const PANTRY_PAINTERS: Record<string, (ctx: Ctx) => void> = {
  rice: (c) => paperTwist(c, P.cream, A.laterite, 3),
  flour: (c) => paperTwist(c, P.butter, P.cream, 0),
  tea: (c) => paperTwist(c, P.sage, shade(P.bark, -0.2), 2),
  honey: honeyJar,
  spice: spicePouch,
};
const DECOR_PAINTERS: Record<string, (ctx: Ctx) => void> = {
  flower: flowerPot, lantern: paperLantern, cushion, bunting, chime, rug, lights, bookshelf, hammock, telescope, guardian_lantern: guardianLantern,
};

/** Paint every item icon once (idempotent). */
export function paintItemTextures(scene: Phaser.Scene): void {
  const S = ITEM_ICON;
  const paint = (id: string, p: (ctx: Ctx) => void) => paintTexture(scene, itemIconKey(id), S, S, (ctx) => p(ctx));
  for (const g of GEAR) paint(g.id, GEAR_PAINTERS[g.id] ?? ((c) => softDisc(c, P.cream)));
  for (const p of PANTRY) paint(p.id, PANTRY_PAINTERS[p.id] ?? ((c) => softDisc(c, P.butter)));
  for (const d of DECOR) paint(d.id, DECOR_PAINTERS[d.id] ?? ((c) => softDisc(c, P.rose)));
  paintTexture(scene, ITEM_KEYS.fish, S, S, fishDisc);
  paintTexture(scene, ITEM_KEYS.forage, S, S, forageDisc);
  paintTexture(scene, ITEM_KEYS.dish, S, S, dishDisc);
  // per-id fallbacks (skipped when another painter already registered the key)
  for (const f of FISH) paint(f.id, fishDisc);
  for (const f of FORAGE) paint(f.id, forageDisc);
  for (const r of RECIPES) paint(r.id, dishDisc);
  paint('mystery_mush', dishDisc);
}
