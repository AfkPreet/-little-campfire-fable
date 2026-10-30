/**
 * dishes.ts: 64 px icons for the 16 recipes and Mystery Mush (keys 'dish-<id>'). Cups with steam for the kettle
 * drinks, bowls for the pot, a plate with fish, a pancake stack, skewers, buns and glowing dumplings. Palette only.
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { RECIPE_IDS } from '@/data/recipes';
import type { DishId } from '@/data/types';
import { contactShadow, ellipsePath, fillOutlined, kawaiiEye, makeImg, paintTexture, roundRectPath, sheen, softGlow, type Ctx } from '@/art/pipeline';

export const DISH_SIZE = 64;
export const DISH_KEYS: Record<DishId, string> = Object.fromEntries(
  [...RECIPE_IDS, 'mystery_mush'].map((id) => [id, `dish-${id}`]),
) as Record<DishId, string>;

const CLAY = ACCENTS.laterite;
const PLATE = PALETTE.cream;
const FISH = mix(PALETTE.powder, PALETTE.lavender, 0.3);

function steamCurls(ctx: Ctx, cx: number, top: number, n = 2): void {
  ctx.strokeStyle = alpha(PALETTE.cream, 0.85);
  ctx.lineWidth = 2.5;
  for (let i = 0; i < n; i++) {
    const x = cx - 6 + i * 12;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.bezierCurveTo(x - 5, top - 6, x + 5, top - 10, x, top - 16);
    ctx.stroke();
  }
}

/** A cup (handle right) filled with `liquid`, steam above. */
function cup(liquid: string): (ctx: Ctx, w: number, h: number) => void {
  return (ctx, w, h) => {
    const cx = w / 2, by = h - 10;
    contactShadow(ctx, cx, by, 20, 5, PALETTE.ink, 0.16);
    ctx.beginPath();
    ctx.moveTo(cx - 20, by - 28);
    ctx.lineTo(cx - 16, by);
    ctx.quadraticCurveTo(cx, by + 6, cx + 16, by);
    ctx.lineTo(cx + 20, by - 28);
    ctx.closePath();
    fillOutlined(ctx, PLATE, 2.5, 0.2);
    ctx.beginPath();
    ctx.arc(cx + 24, by - 16, 7, -Math.PI / 2, Math.PI / 2);
    ctx.lineWidth = 6;
    ctx.strokeStyle = outline(PLATE, 0.2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = PLATE;
    ctx.stroke();
    ellipsePath(ctx, cx, by - 28, 20, 6);
    fillOutlined(ctx, liquid, 2.5, 0.22);
    sheen(ctx, cx - 6, by - 29, 6, 2, PALETTE.cream, 0.5);
    steamCurls(ctx, cx, by - 36);
  };
}

/** A clay bowl with `food` on top and an optional garnish painter. */
function bowl(food: string, garnish?: (ctx: Ctx, cx: number, cy: number) => void): (ctx: Ctx, w: number, h: number) => void {
  return (ctx, w, h) => {
    const cx = w / 2, by = h - 8;
    contactShadow(ctx, cx, by, 24, 5, PALETTE.ink, 0.16);
    ctx.beginPath();
    ctx.moveTo(cx - 26, by - 22);
    ctx.quadraticCurveTo(cx - 22, by + 4, cx, by + 2);
    ctx.quadraticCurveTo(cx + 22, by + 4, cx + 26, by - 22);
    ctx.closePath();
    fillOutlined(ctx, CLAY, 2.5, 0.24);
    ellipsePath(ctx, cx, by - 22, 26, 8);
    fillOutlined(ctx, shade(CLAY, 0.08), 2.5, 0.24);
    ellipsePath(ctx, cx, by - 22, 21, 5.5);
    fillOutlined(ctx, food, 2, 0.18);
    garnish?.(ctx, cx, by - 22);
    steamCurls(ctx, cx, by - 30);
  };
}

function dots(color: string, pts: Array<[number, number]>, r = 2.6): (ctx: Ctx, cx: number, cy: number) => void {
  return (ctx, cx, cy) => {
    for (const [dx, dy] of pts) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  };
}

function plate(ctx: Ctx, cx: number, cy: number, rx = 28): void {
  contactShadow(ctx, cx, cy + 6, rx, 5, PALETTE.ink, 0.16);
  ellipsePath(ctx, cx, cy, rx, rx * 0.36);
  fillOutlined(ctx, PLATE, 2.5, 0.18);
  ellipsePath(ctx, cx, cy, rx * 0.72, rx * 0.24);
  ctx.strokeStyle = alpha(PALETTE.sage, 0.5);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function fishBody(ctx: Ctx, cx: number, cy: number, len: number, fill: string): void {
  ctx.beginPath();
  ctx.moveTo(cx - len / 2, cy);
  ctx.quadraticCurveTo(cx - len * 0.1, cy - len * 0.3, cx + len * 0.3, cy);
  ctx.quadraticCurveTo(cx - len * 0.1, cy + len * 0.3, cx - len / 2, cy);
  ctx.closePath();
  fillOutlined(ctx, fill, 2.2, 0.26);
  ctx.beginPath();
  ctx.moveTo(cx + len * 0.28, cy);
  ctx.lineTo(cx + len / 2, cy - len * 0.18);
  ctx.lineTo(cx + len / 2, cy + len * 0.18);
  ctx.closePath();
  fillOutlined(ctx, fill, 2.2, 0.26);
  kawaiiEye(ctx, cx - len * 0.3, cy - 1, 2.2, 2.2, PALETTE.ink, PALETTE.cream);
}

function grilledFish(pepper: boolean): (ctx: Ctx, w: number, h: number) => void {
  return (ctx, w, h) => {
    const cx = w / 2, cy = h - 16;
    plate(ctx, cx, cy);
    fishBody(ctx, cx, cy - 6, 44, mix(PALETTE.peach, PALETTE.bark, 0.25));
    ctx.strokeStyle = alpha(PALETTE.bark, 0.6);
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 8 + i * 8, cy - 14);
      ctx.lineTo(cx - 4 + i * 8, cy);
      ctx.stroke();
    }
    if (pepper) dots(PALETTE.ink, [[-14, -2], [4, 2], [12, -6]], 1.6)(ctx, cx, cy - 6);
    dots(PALETTE.sage, [[-18, 2], [16, 4]], 3)(ctx, cx, cy);
    steamCurls(ctx, cx, cy - 20, 1);
  };
}

function pancakes(berries: boolean): (ctx: Ctx, w: number, h: number) => void {
  return (ctx, w, h) => {
    const cx = w / 2, cy = h - 14;
    plate(ctx, cx, cy, 28);
    const cake = mix(PALETTE.butter, PALETTE.bark, 0.25);
    for (let i = 0; i < 3; i++) {
      const y = cy - 4 - i * 8;
      ellipsePath(ctx, cx, y, 20, 6);
      fillOutlined(ctx, i === 2 ? shade(cake, 0.05) : cake, 2.2, 0.24);
    }
    // honey drizzle
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 22);
    ctx.quadraticCurveTo(cx, cy - 14, cx + 12, cy - 20);
    ctx.lineWidth = 3;
    ctx.strokeStyle = ACCENTS.marigold;
    ctx.stroke();
    if (berries) dots(ACCENTS.jamun, [[-6, -24], [6, -26], [0, -20]], 3.2)(ctx, cx, cy);
    else {
      ctx.beginPath();
      roundRectPath(ctx, cx - 5, cy - 32, 10, 8, 2);
      fillOutlined(ctx, PALETTE.butter, 1.8, 0.2);
    }
  };
}

function skewers(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h - 14;
  plate(ctx, cx, cy, 28);
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + s * 7, cy - 10);
    ctx.rotate(s * 0.18);
    ctx.beginPath();
    roundRectPath(ctx, -1.5, -26, 3, 50, 1.5);
    fillOutlined(ctx, PALETTE.bark, 1.5, 0.2);
    for (let i = 0; i < 3; i++) {
      const y = -18 + i * 13;
      ellipsePath(ctx, 0, y, 6.5, 5.5);
      fillOutlined(ctx, mix(PALETTE.peach, PALETTE.bark, 0.35), 2, 0.24);
      ctx.beginPath();
      ctx.arc(2, y - 1, 1.3, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.ink;
      ctx.fill();
    }
    ctx.restore();
  }
}

function buns(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h - 14;
  // bamboo basket
  ctx.beginPath();
  roundRectPath(ctx, cx - 28, cy - 12, 56, 20, 6);
  fillOutlined(ctx, mix(PALETTE.butter, PALETTE.bark, 0.35), 2.5, 0.24);
  const bun = mix(PALETTE.cream, PALETTE.butter, 0.3);
  for (const [dx, dy, r] of [[-14, -14, 11], [14, -14, 11], [0, -24, 12]] as Array<[number, number, number]>) {
    ellipsePath(ctx, cx + dx, cy + dy, r, r * 0.85);
    fillOutlined(ctx, bun, 2.2, 0.16);
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy - r * 0.45, 2, 0, Math.PI * 2);
    ctx.fillStyle = alpha(PALETTE.rose, 0.6);
    ctx.fill();
  }
  steamCurls(ctx, cx, cy - 38);
}

function dumplings(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h - 16;
  softGlow(ctx, cx, cy - 12, 30, PALETTE.glow, 0.6);
  plate(ctx, cx, cy, 28);
  const skin = mix(PALETTE.cream, PALETTE.lavender, 0.3);
  for (const [dx, dy] of [[-13, -4], [13, -4], [0, -16]] as Array<[number, number]>) {
    ctx.beginPath();
    ctx.moveTo(cx + dx - 11, cy + dy + 4);
    ctx.quadraticCurveTo(cx + dx, cy + dy - 14, cx + dx + 11, cy + dy + 4);
    ctx.closePath();
    fillOutlined(ctx, skin, 2.2, 0.2);
    softGlow(ctx, cx + dx, cy + dy - 2, 8, PALETTE.glow, 0.7);
  }
}

function mysteryMush(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h - 8;
  bowl(mix(PALETTE.moss, PALETTE.lavender, 0.45))(ctx, w, h);
  // a lumpy blob rising above the rim with a funny face
  const blob = mix(PALETTE.moss, PALETTE.lavender, 0.45);
  ctx.beginPath();
  ctx.moveTo(cx - 18, by - 22);
  ctx.quadraticCurveTo(cx - 20, by - 40, cx - 6, by - 40);
  ctx.quadraticCurveTo(cx, by - 48, cx + 8, by - 40);
  ctx.quadraticCurveTo(cx + 22, by - 40, cx + 18, by - 22);
  ctx.closePath();
  fillOutlined(ctx, blob, 2.2, 0.24);
  kawaiiEye(ctx, cx - 7, by - 32, 3, 3.4, PALETTE.ink, PALETTE.cream);
  kawaiiEye(ctx, cx + 7, by - 33, 3, 2.2, PALETTE.ink, PALETTE.cream);
  ctx.beginPath();
  ctx.moveTo(cx - 5, by - 25);
  ctx.quadraticCurveTo(cx, by - 22, cx + 5, by - 27);
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
  dots(PALETTE.blush, [[-11, -27], [11, -27]], 2.2)(ctx, cx, by);
}

const PAINTERS: Record<DishId, (ctx: Ctx, w: number, h: number) => void> = {
  herb_tea: cup(mix(PALETTE.sage, PALETTE.butter, 0.4)),
  honey_tea: cup(ACCENTS.marigold),
  berry_cordial: cup(mix(ACCENTS.jamun, PALETTE.rose, 0.5)),
  spiced_tea: cup(mix(PALETTE.peach, PALETTE.bark, 0.3)),
  mushroom_soup: bowl(mix(PALETTE.butter, PALETTE.bark, 0.3), dots(mix(PALETTE.cream, PALETTE.bark, 0.3), [[-8, 0], [6, -1], [0, 2]], 3.5)),
  fish_congee: bowl(mix(PALETTE.cream, PALETTE.butter, 0.2), (ctx, cx, cy) => fishBody(ctx, cx, cy, 20, FISH)),
  campfire_stew: bowl(mix(PALETTE.ember, PALETTE.bark, 0.3), (ctx, cx, cy) => { fishBody(ctx, cx - 3, cy, 18, FISH); dots(PALETTE.sage, [[10, -1], [-12, 1]], 2.4)(ctx, cx, cy); }),
  berry_pudding: bowl(mix(PALETTE.rose, PALETTE.cream, 0.3), dots(ACCENTS.jamun, [[-8, -1], [5, 1], [0, -3]], 3)),
  nutty_porridge: bowl(mix(PALETTE.butter, PALETTE.cream, 0.4), dots(PALETTE.bark, [[-7, 0], [6, -1], [0, 2]], 2.8)),
  grilled_fish: grilledFish(false),
  herb_butter_fish: grilledFish(true),
  pancakes: pancakes(false),
  berry_pancakes: pancakes(true),
  mushroom_skewers: skewers,
  cloud_buns: buns,
  moonlight_dumplings: dumplings,
  mystery_mush: mysteryMush,
};

export function paintDishes(scene: Phaser.Scene): void {
  for (const id of Object.keys(PAINTERS) as DishId[]) {
    paintTexture(scene, DISH_KEYS[id], DISH_SIZE, DISH_SIZE, PAINTERS[id]);
  }
}

export function makeDishIcon(scene: Phaser.Scene, id: DishId, x = 0, y = 0): Phaser.GameObjects.Image {
  paintDishes(scene);
  return makeImg(scene, x, y, DISH_KEYS[id]);
}
