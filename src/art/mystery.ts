/**
 * art/mystery.ts: visuals for the guardian mystery (spec section 5 "Mystery", docs/M3_PLAN.md).
 * Textures are painted once (2x) through the pipeline; the factories return display objects for the flows:
 *  - the Glimmering Scale (clue 2): a palm-sized iridescent scale in cream / butter / lavender with a soft glow
 *  - Doddamma's recipe card (clue 3): a hand-written paper card with the Moonlight Kadubu dish and its ingredients
 *  - the offering plate (finale): the kadubu dish on a cream plate with a faint glow
 *  - a far glow disc (clue 1) and a shore sparkle glow (clue 2), both additive
 */
import Phaser from 'phaser';
import { PALETTE, ACCENTS, hexToInt, mix } from '@/config/palette';
import { alpha, ellipsePath, linearGradient, makeImg, outline, paintTexture, paperGrain, roundRectPath, shade, sheen, softGlow, type Ctx } from './pipeline';
import { FX_KEYS } from '@/fx/textures';
import { DISH_KEYS, paintDishes } from './dishes';
import { ING_KEYS, paintIngredients, type IngredientIconId } from './ingredients';
import { makeText } from '@/ui/text';
import { COOKWARE_BY_ID, FISH_BY_ID, FORAGE_BY_ID, PANTRY_BY_ID, RECIPE_BY_ID, STRINGS, fill, isFishId, isForageId, isPantryId } from '@/data';
import type { IngredientId, RecipeId } from '@/data/types';

export const MYSTERY_KEYS = {
  scale: 'mystery-scale',
  recipeCard: 'mystery-recipe-card',
  plate: 'mystery-plate',
} as const;

/** Sizes in logical px and the compositions the factories lay out. */
export const MYSTERY_ART = {
  scale: { w: 112, h: 112 },
  card: { w: 380, h: 260, radius: 12, tapeW: 90, tapeH: 22, ruleGap: 30, ruleTop: 96 },
  cardLayout: { titleY: -92, fromY: -58, dishX: -118, dishY: 22, dishScale: 1.5, ingY: 8, ingX0: -22, ingGap: 78, ingScale: 1.05, labelDy: 36, labelSize: 15, cookY: 92, cookSize: 16, plusSize: 22 },
  plate: { w: 60, h: 24 },
  offering: { dishScale: 0.8, glowScale: 1.6, glowAlpha: 0.35 },
  farGlow: { alpha: 0.4 },
  dish: 'moonlight_dumplings' as RecipeId,
} as const;

function mixHex(a: string, b: string, t: number): string {
  return mix(a, b, t);
}

// ---------- painters ----------

/** A rounded shield-shaped scale, cream at the top grading to butter and lavender, with iridescent bands and a sheen. */
function paintScale(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h / 2 + 4;
  softGlow(ctx, cx, cy, w / 2, PALETTE.glow, 0.5);
  const top = cy - 34, bottom = cy + 40, half = 32;
  const scalePath = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - half, top + 4);
    ctx.quadraticCurveTo(cx, top - 14, cx + half, top + 4);
    ctx.bezierCurveTo(cx + half + 6, top + 36, cx + 18, bottom - 4, cx, bottom);
    ctx.bezierCurveTo(cx - 18, bottom - 4, cx - half - 6, top + 36, cx - half, top + 4);
    ctx.closePath();
  };
  scalePath();
  ctx.fillStyle = linearGradient(ctx, cx, top, cx, bottom, [
    [0, PALETTE.cream], [0.45, PALETTE.butter], [1, PALETTE.lavender],
  ]);
  ctx.fill();
  // iridescent diagonal bands
  ctx.save();
  scalePath();
  ctx.clip();
  const bands: Array<[string, number]> = [[PALETTE.rose, 0.18], [PALETTE.powder, 0.2], [PALETTE.cream, 0.3], [PALETTE.lavender, 0.18]];
  bands.forEach(([c, a], i) => {
    ctx.fillStyle = alpha(c, a);
    ctx.beginPath();
    const x0 = cx - 50 + i * 20;
    ctx.moveTo(x0, bottom + 10);
    ctx.lineTo(x0 + 12, bottom + 10);
    ctx.lineTo(x0 + 42, top - 10);
    ctx.lineTo(x0 + 30, top - 10);
    ctx.closePath();
    ctx.fill();
  });
  // growth arcs
  ctx.strokeStyle = alpha(shade(PALETTE.lavender, -0.15), 0.35);
  ctx.lineWidth = 1.5;
  for (let r = 14; r < 40; r += 11) {
    ctx.beginPath();
    ctx.arc(cx, top - 4, r, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  }
  ctx.restore();
  scalePath();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = outline(PALETTE.lavender, 0.3);
  ctx.stroke();
  sheen(ctx, cx - 10, top + 18, 12, 6, PALETTE.cream, 0.6);
}

/** Cream paper with faint rules, a marigold tape strip and a dashed inner border. Text and icons are composed on top. */
function paintRecipeCard(ctx: Ctx, w: number, h: number): void {
  const C = MYSTERY_ART.card;
  const paper = mixHex(PALETTE.cream, PALETTE.butter, 0.18);
  ctx.save();
  ctx.shadowColor = alpha(PALETTE.ink, 0.18);
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  roundRectPath(ctx, 6, 6, w - 12, h - 12, C.radius);
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.restore();
  roundRectPath(ctx, 6, 6, w - 12, h - 12, C.radius);
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline(paper, 0.16);
  ctx.stroke();
  // ruled lines
  ctx.strokeStyle = alpha(PALETTE.bark, 0.12);
  ctx.lineWidth = 1;
  for (let y = C.ruleTop; y < h - 24; y += C.ruleGap) {
    ctx.beginPath();
    ctx.moveTo(26, y + 0.5);
    ctx.lineTo(w - 26, y + 0.5);
    ctx.stroke();
  }
  // dashed inner border
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = alpha(PALETTE.lavender, 0.55);
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, 16, 16, w - 32, h - 32, C.radius - 4);
  ctx.stroke();
  ctx.restore();
  paperGrain(ctx, 10, 10, w - 20, h - 20, PALETTE.ink, 0.03, 11);
  // tape strip
  ctx.save();
  ctx.translate(w / 2, 10);
  ctx.rotate(-0.06);
  ctx.fillStyle = alpha(ACCENTS.marigold, 0.8);
  ctx.fillRect(-C.tapeW / 2, -C.tapeH / 2, C.tapeW, C.tapeH);
  ctx.fillStyle = alpha(PALETTE.cream, 0.25);
  ctx.fillRect(-C.tapeW / 2, -C.tapeH / 2, C.tapeW, 4);
  ctx.restore();
}

/** A small cream plate seen from the side-top, powder rim shading. */
function paintPlate(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h / 2;
  ellipsePath(ctx, cx, cy + 2, w / 2 - 2, h / 2 - 3);
  ctx.fillStyle = mixHex(PALETTE.cream, PALETTE.powder, 0.25);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline(PALETTE.cream, 0.2);
  ctx.stroke();
  ellipsePath(ctx, cx, cy, w / 2 - 8, h / 2 - 7);
  ctx.fillStyle = PALETTE.cream;
  ctx.fill();
}

export function paintMysteryTextures(scene: Phaser.Scene): void {
  const A = MYSTERY_ART;
  paintTexture(scene, MYSTERY_KEYS.scale, A.scale.w, A.scale.h, paintScale);
  paintTexture(scene, MYSTERY_KEYS.recipeCard, A.card.w, A.card.h, paintRecipeCard);
  paintTexture(scene, MYSTERY_KEYS.plate, A.plate.w, A.plate.h, paintPlate);
  paintDishes(scene);
  paintIngredients(scene);
}

// ---------- factories ----------

/** The Glimmering Scale icon (not yet added to a container). */
export function makeScaleIcon(scene: Phaser.Scene, x = 0, y = 0): Phaser.GameObjects.Image {
  paintMysteryTextures(scene);
  return makeImg(scene, x, y, MYSTERY_KEYS.scale);
}

/** A soft additive glow disc of `logicalPx` diameter, tinted lantern-glow (far glow, shore sparkle). Not yet added. */
export function makeGlowDisc(scene: Phaser.Scene, x: number, y: number, logicalPx: number, color: string = PALETTE.glow): Phaser.GameObjects.Image {
  const im = makeImg(scene, x, y, FX_KEYS.glow);
  im.setTint(hexToInt(color)).setBlendMode(Phaser.BlendModes.ADD);
  const base = (im.getData('baseScale') as number) ?? 1;
  const s = base * (logicalPx / im.displayWidth);
  im.setScale(s).setData('baseScale', s);
  return im;
}

function ingredientIcon(id: IngredientId): IngredientIconId {
  if (isPantryId(id) || isForageId(id)) return id;
  return 'fish';
}
function ingredientName(id: IngredientId): string {
  if (isPantryId(id)) return PANTRY_BY_ID[id].name;
  if (isForageId(id)) return FORAGE_BY_ID[id].name;
  if (isFishId(id)) return FISH_BY_ID[id].name;
  return STRINGS.mystery.sparkleLabel;
}

/**
 * Doddamma's hand-written recipe card: paper, title, the kadubu dish icon, "+"-joined ingredient icons with names
 * and the cookware line. A container centered on (x, y), not yet added to a parent.
 */
export function makeRecipeCard(scene: Phaser.Scene, x = 0, y = 0): Phaser.GameObjects.Container {
  paintMysteryTextures(scene);
  const L = MYSTERY_ART.cardLayout;
  const recipe = RECIPE_BY_ID[MYSTERY_ART.dish];
  const root = scene.make.container({ x, y, add: false });
  root.setData('baseScale', 1);
  root.add(makeImg(scene, 0, 0, MYSTERY_KEYS.recipeCard));
  root.add(makeText(scene, 0, L.titleY, STRINGS.mystery.recipeTitle, { hand: true, size: 32, color: PALETTE.ink, align: 'center' }).setOrigin(0.5));
  root.add(makeText(scene, 0, L.fromY, fill(STRINGS.mystery.recipeFrom), { size: 15, color: PALETTE.bark, align: 'center' }).setOrigin(0.5));
  const dish = makeImg(scene, L.dishX, L.dishY, DISH_KEYS[MYSTERY_ART.dish]);
  const db = (dish.getData('baseScale') as number) * L.dishScale;
  dish.setScale(db).setData('baseScale', db);
  root.add(dish);
  recipe.ingredients.forEach((id, i) => {
    const ix = L.ingX0 + i * L.ingGap;
    if (i > 0) root.add(makeText(scene, ix - L.ingGap / 2, L.ingY, '+', { hand: true, size: L.plusSize, color: PALETTE.bark }).setOrigin(0.5));
    const im = makeImg(scene, ix, L.ingY, ING_KEYS[ingredientIcon(id)]);
    const b = (im.getData('baseScale') as number) * L.ingScale;
    im.setScale(b).setData('baseScale', b);
    root.add(im);
    root.add(makeText(scene, ix, L.ingY + L.labelDy, ingredientName(id), { hand: true, size: L.labelSize, color: PALETTE.ink, align: 'center', wrap: L.ingGap - 6 }).setOrigin(0.5, 0));
  });
  root.add(makeText(scene, 0, L.cookY, fill(STRINGS.mystery.recipeCookWith, { Cookware: COOKWARE_BY_ID[recipe.cookware].name }), { hand: true, size: L.cookSize, color: PALETTE.bark, align: 'center' }).setOrigin(0.5));
  return root;
}

/** The offering: the kadubu dish on a cream plate with a faint glow behind. Container at (x, y) with origin at the plate base. */
export function makeOfferingPlate(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  paintMysteryTextures(scene);
  const O = MYSTERY_ART.offering;
  const root = scene.make.container({ x, y, add: false });
  root.setData('baseScale', 1);
  const glow = makeGlowDisc(scene, 0, -14, MYSTERY_ART.plate.w * O.glowScale);
  glow.setAlpha(O.glowAlpha);
  root.add(glow);
  root.add(makeImg(scene, 0, -MYSTERY_ART.plate.h / 2, MYSTERY_KEYS.plate));
  const dish = makeImg(scene, 0, -MYSTERY_ART.plate.h / 2 - 10, DISH_KEYS[MYSTERY_ART.dish]);
  const b = (dish.getData('baseScale') as number) * O.dishScale;
  dish.setScale(b).setData('baseScale', b);
  root.add(dish);
  return root;
}
