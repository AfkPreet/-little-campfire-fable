/**
 * JournalPages: builds the content of one notebook page as a Container (made, not added; page-local coordinates
 * with (0, 0) at the top-left of the writing box). The Journal scene owns the book, tabs, flips and paging.
 *
 *   pageCount(tab, state)                       -> how many pages the tab has right now
 *   buildJournalPage(scene, tab, i, state, box) -> Container with that page's entries
 *
 * Undiscovered entries are soft ink silhouettes (the real icon tinted ink at 30%) with "???" and the data's hint.
 */
import Phaser from 'phaser';
import { PALETTE, hexToInt, mix } from '@/config/palette';
import { makeImg } from '@/art/pipeline';
import { FISH_KEYS, paintFish } from '@/art/fish';
import { DISH_KEYS, paintDishes } from '@/art/dishes';
import { Bloom } from '@/art/hud';
import { Companion } from '@/entities/Companion';
import { BOOK, JOURNAL_TEX, paintJournalTextures, vignetteKey, type JournalTab } from '@/art/journal';
import { TEX, UI, makeStars } from './kit';
import { Button } from './Button';
import { SCENES } from '@/scenes/Boot';
import { makeText } from './text';
import {
  STRINGS, fill, FISH, RECIPES, MOMENTS, MYSTERY_CLUES, RARITY_STARS, COOKWARE_BY_ID, dishInfo, FISH_BY_ID, MOMENT_BY_ID, COMPANION, WORLD, TIME,
} from '@/data';
import type { GameState } from '@/state';

export type PageBox = { w: number; h: number };

/** Layout tuning for the pages (logical px). */
export const PAGE = {
  perPage: { fish: 4, recipes: 4, moments: 3, friends: 1, mystery: 3, trip: 1 } as Record<JournalTab, number>,
  gap: 14,
  cardRadius: 14,
  nameSize: 24,
  bodySize: 17,
  smallSize: 16,
  hintSize: 17,
  iconScale: 1.1,
  silhouetteAlpha: 0.3,
  lockedColor: mix(PALETTE.ink, PALETTE.cream, 0.35),
  bodyColor: mix(PALETTE.ink, PALETTE.cream, 0.12),
  cardFill: PALETTE.cream,
  cardLine: mix(PALETTE.ink, PALETTE.cream, 0.72),
  starGap: 24,
  starScale: 0.8,
  friendHearts: COMPANION.hearts,
  bloomScale: 0.9,
  albumButtonW: 240,
} as const;

type Scene = Phaser.Scene;

export function pageCount(tab: JournalTab, state: GameState): number {
  switch (tab) {
    case 'fish': return Math.ceil(FISH.length / PAGE.perPage.fish);
    case 'recipes': return Math.ceil(RECIPES.length / PAGE.perPage.recipes);
    case 'moments': return Math.ceil(MOMENTS.length / PAGE.perPage.moments);
    case 'friends': return 1;
    case 'mystery': return Math.ceil(MYSTERY_CLUES.length / PAGE.perPage.mystery);
    case 'trip': return Math.max(1, state.journal.trip.length);
  }
}

export function buildJournalPage(scene: Scene, tab: JournalTab, index: number, state: GameState, box: PageBox): Phaser.GameObjects.Container {
  paintJournalTextures(scene);
  const root = scene.make.container({ x: 0, y: 0, add: false });
  switch (tab) {
    case 'fish': buildFish(scene, root, index, state, box); break;
    case 'recipes': buildRecipes(scene, root, index, state, box); break;
    case 'moments': buildMoments(scene, root, index, state, box); break;
    case 'friends': buildFriends(scene, root, state, box); break;
    case 'mystery': buildMystery(scene, root, index, state, box); break;
    case 'trip': buildTrip(scene, root, index, state, box); break;
  }
  return root;
}

// ---------- shared pieces ----------
/** A soft rounded card outline drawn with Graphics (flat vector, painted once). */
function cardFrame(scene: Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(hexToInt(PAGE.cardFill), 0.75);
  g.fillRoundedRect(x, y, w, h, PAGE.cardRadius);
  g.lineStyle(2, hexToInt(PAGE.cardLine), 0.9);
  g.strokeRoundedRect(x, y, w, h, PAGE.cardRadius);
  return g;
}

/** The painted icon, or its ink silhouette when undiscovered. */
function iconOrSilhouette(scene: Scene, x: number, y: number, key: string, found: boolean, scale: number = PAGE.iconScale): Phaser.GameObjects.Image {
  const im = makeImg(scene, x, y, key);
  const base = (im.getData('baseScale') as number) * scale;
  im.setScale(base).setData('baseScale', base);
  if (!found) {
    im.setTintFill(hexToInt(PALETTE.ink));
    im.setAlpha(PAGE.silhouetteAlpha);
  }
  return im;
}

function stamp(scene: Scene, x: number, y: number, scale = 0.7): Phaser.GameObjects.Image {
  const im = makeImg(scene, x, y, JOURNAL_TEX.stamp);
  const base = (im.getData('baseScale') as number) * scale;
  im.setScale(base).setData('baseScale', base);
  return im;
}

function gridCell(box: PageBox, i: number, cols: number, rows: number): { x: number; y: number; w: number; h: number } {
  const w = (box.w - PAGE.gap * (cols - 1)) / cols;
  const h = (box.h - PAGE.gap * (rows - 1)) / rows;
  return { x: (i % cols) * (w + PAGE.gap), y: Math.floor(i / cols) * (h + PAGE.gap), w, h };
}

// ---------- Fish ----------
function buildFish(scene: Scene, root: Phaser.GameObjects.Container, index: number, state: GameState, box: PageBox): void {
  paintFish(scene);
  const per = PAGE.perPage.fish;
  const slice = FISH.slice(index * per, index * per + per);
  slice.forEach((f, i) => {
    const c = gridCell(box, i, 2, 2);
    const entry = state.journal.fish[f.id];
    const found = !!entry;
    root.add(cardFrame(scene, c.x, c.y, c.w, c.h));
    const iconX = c.x + 64, iconY = c.y + c.h / 2;
    root.add(iconOrSilhouette(scene, iconX, iconY, FISH_KEYS[f.id], found));
    const tx = c.x + 124, top = c.y + 14;
    const wrap = c.w - 124 - 14;
    root.add(makeText(scene, tx, top, found ? f.name : STRINGS.journal.locked, { size: PAGE.nameSize, hand: true, color: found ? PALETTE.ink : PAGE.lockedColor }).setOrigin(0, 0));
    const starsY = top + 18;
    const starX = c.x + c.w - 14 - PAGE.starGap;
    for (const s of makeStars(scene, starX, starsY, RARITY_STARS[f.rarity], 3, PAGE.starGap)) {
      const b = (s.getData('baseScale') as number) * PAGE.starScale;
      s.setScale(b).setData('baseScale', b);
      root.add(s);
    }
    const lines: string[] = found
      ? [
          fill(STRINGS.journalExtras.when, { When: f.whenLabel }) + ' · ' + fill(STRINGS.journalExtras.rod, { Rod: f.rodLabel }),
          fill(STRINGS.journalExtras.best, { cm: entry!.bestCm.toFixed(1) }) + ' · ' + fill(STRINGS.journalExtras.caught, { n: entry!.count }),
        ]
      : [fill(STRINGS.journalExtras.when, { When: f.whenLabel }) + ' · ' + fill(STRINGS.journalExtras.rod, { Rod: f.rodLabel })];
    let y = top + 36;
    for (const line of lines) {
      root.add(makeText(scene, tx, y, line, { size: PAGE.bodySize, weight: 400, wrap, color: PAGE.bodyColor }).setOrigin(0, 0));
      y += 24;
    }
    root.add(makeText(scene, tx, y + 2, found ? f.flavor : f.hint, { size: PAGE.hintSize, hand: true, wrap, color: PAGE.lockedColor }).setOrigin(0, 0));
    if (found) root.add(stamp(scene, c.x + c.w - 40, c.y + c.h - 36, 0.6));
  });
}

// ---------- Recipes ----------
function buildRecipes(scene: Scene, root: Phaser.GameObjects.Container, index: number, state: GameState, box: PageBox): void {
  paintDishes(scene);
  const per = PAGE.perPage.recipes;
  const ordered = [...RECIPES].sort((a, b) => a.order - b.order);
  const slice = ordered.slice(index * per, index * per + per);
  slice.forEach((r, i) => {
    const c = gridCell(box, i, 2, 2);
    const entry = state.journal.recipes[r.id];
    const found = !!entry;
    root.add(cardFrame(scene, c.x, c.y, c.w, c.h));
    root.add(iconOrSilhouette(scene, c.x + 56, c.y + c.h / 2, DISH_KEYS[r.id], found, 1.15));
    const tx = c.x + 110, top = c.y + 14;
    const wrap = c.w - 110 - 14;
    root.add(makeText(scene, tx, top, found ? r.name : STRINGS.journal.locked, { size: PAGE.nameSize, hand: true, color: found ? PALETTE.ink : PAGE.lockedColor }).setOrigin(0, 0));
    const cookware = fill(STRINGS.journalExtras.cookware, { Cookware: COOKWARE_BY_ID[r.cookware].name });
    const meta = found ? cookware + ' · ' + fill(STRINGS.journalExtras.cooked, { n: entry!.count }) : cookware;
    root.add(makeText(scene, tx, top + 36, meta, { size: PAGE.bodySize, weight: 400, wrap, color: PAGE.bodyColor }).setOrigin(0, 0));
    root.add(makeText(scene, tx, top + 62, found ? r.flavor : r.hint, { size: PAGE.hintSize, hand: true, wrap, color: PAGE.lockedColor }).setOrigin(0, 0));
    if (found) root.add(stamp(scene, c.x + c.w - 40, c.y + c.h - 36, 0.6));
  });
}

// ---------- Moments ----------
function buildMoments(scene: Scene, root: Phaser.GameObjects.Container, index: number, state: GameState, box: PageBox): void {
  const per = PAGE.perPage.moments;
  const slice = MOMENTS.slice(index * per, index * per + per);
  const rowH = (box.h - PAGE.gap * (per - 1)) / per;
  slice.forEach((m, i) => {
    const y = i * (rowH + PAGE.gap);
    const entry = state.journal.moments[m.id];
    const found = !!entry;
    root.add(cardFrame(scene, 0, y, box.w, rowH));
    const vx = 14 + BOOK.vignette.w / 2, vy = y + rowH / 2;
    const v = makeImg(scene, vx, vy, vignetteKey(m.id));
    if (!found) v.setAlpha(0.35);
    root.add(v);
    const tx = 14 + BOOK.vignette.w + 18, wrap = box.w - tx - 14;
    root.add(makeText(scene, tx, y + 12, found ? m.name : STRINGS.journal.locked, { size: PAGE.nameSize, hand: true, color: found ? PALETTE.ink : PAGE.lockedColor }).setOrigin(0, 0));
    if (found) {
      root.add(makeText(scene, tx, y + 46, m.flavor, { size: PAGE.bodySize, weight: 400, wrap, color: PAGE.bodyColor }).setOrigin(0, 0));
      root.add(makeText(scene, tx, y + rowH - 30, fill(STRINGS.journalExtras.seen, { n: entry!.count }), { size: PAGE.smallSize, weight: 400, color: PAGE.lockedColor }).setOrigin(0, 0));
      root.add(stamp(scene, box.w - 40, y + rowH - 32, 0.6));
    } else {
      root.add(makeText(scene, tx, y + 46, m.hint, { size: PAGE.hintSize, hand: true, wrap, color: PAGE.lockedColor }).setOrigin(0, 0));
    }
  });
}

// ---------- Friends ----------
function buildFriends(scene: Scene, root: Phaser.GameObjects.Container, state: GameState, box: PageBox): void {
  const c = state.journal.companion;
  const seen = c.visits > 0 || c.befriended;
  root.add(cardFrame(scene, 0, 0, box.w, box.h));
  const figureX = box.w * 0.25, groundY = box.h * 0.62;
  const rig = new Companion(scene, figureX, groundY);
  rig.setFacing(1);
  if (!seen) {
    rig.setTint(PALETTE.ink);
    rig.setAlpha(PAGE.silhouetteAlpha);
  }
  root.add(rig);
  const tx = box.w * 0.48, wrap = box.w - tx - 20;
  const name = seen ? WORLD.companionName : STRINGS.journal.locked;
  root.add(makeText(scene, tx, 28, name, { size: 34, hand: true, color: seen ? PALETTE.ink : PAGE.lockedColor }).setOrigin(0, 0));
  // hearts: filled per distinct visit day
  const filled = Math.min(PAGE.friendHearts, c.befriended ? PAGE.friendHearts : c.visitDays.length);
  for (let i = 0; i < PAGE.friendHearts; i++) {
    const hx = tx + 18 + i * 40;
    root.add(makeImg(scene, hx, 96, i < filled ? TEX.heart : JOURNAL_TEX.heartEmpty));
  }
  root.add(makeText(scene, tx, 122, fill(STRINGS.journalExtras.friendVisits, { n: Math.min(PAGE.friendHearts, c.visitDays.length), total: PAGE.friendHearts }), { size: PAGE.bodySize, weight: 400, color: PAGE.bodyColor }).setOrigin(0, 0));
  const body = c.befriended ? fill(STRINGS.companion.befriended) : seen ? STRINGS.journalExtras.friendFound : STRINGS.journalExtras.friendLocked;
  root.add(makeText(scene, tx, 160, body, { size: 22, hand: true, wrap, color: seen ? PALETTE.ink : PAGE.lockedColor }).setOrigin(0, 0));
  if (c.befriended) root.add(stamp(scene, box.w - 50, box.h - 46, 0.8));
}

// ---------- Mystery ----------
function buildMystery(scene: Scene, root: Phaser.GameObjects.Container, index: number, state: GameState, box: PageBox): void {
  const per = PAGE.perPage.mystery;
  const slice = MYSTERY_CLUES.slice(index * per, index * per + per);
  const step = state.journal.mystery.step;
  const colW = (box.w - PAGE.gap * (per - 1)) / per;
  slice.forEach((clue, i) => {
    const x = i * (colW + PAGE.gap);
    const found = step >= clue.step;
    root.add(cardFrame(scene, x, 0, colW, box.h));
    const wrap = colW - 28;
    root.add(makeText(scene, x + 14, 14, fill(STRINGS.journalExtras.clue, { n: clue.step }), { size: PAGE.smallSize, weight: 700, color: PAGE.lockedColor }).setOrigin(0, 0));
    root.add(makeText(scene, x + 14, 38, found ? clue.title : STRINGS.journal.locked, { size: PAGE.nameSize, hand: true, wrap, color: found ? PALETTE.ink : PAGE.lockedColor }).setOrigin(0, 0));
    const isLast = clue.step === MYSTERY_CLUES.length;
    let textY = 84;
    if (isLast) {
      const lantern = makeImg(scene, x + colW / 2, 84 + BOOK.lantern.h / 2 + 10, JOURNAL_TEX.lantern);
      if (!found) { lantern.setTintFill(hexToInt(PALETTE.ink)); lantern.setAlpha(PAGE.silhouetteAlpha); }
      root.add(lantern);
      textY = 84 + BOOK.lantern.h + 40;
    }
    const body = found ? clue.journal : clue.hint;
    root.add(makeText(scene, x + 14, textY, body, { size: found ? 21 : PAGE.hintSize, hand: true, wrap, color: found ? PALETTE.ink : PAGE.lockedColor }).setOrigin(0, 0));
    if (found) root.add(stamp(scene, x + colW - 40, box.h - 40, 0.65));
  });
}

// ---------- Trip ----------
function buildTrip(scene: Scene, root: Phaser.GameObjects.Container, index: number, state: GameState, box: PageBox): void {
  const page = state.journal.trip[index];
  root.add(cardFrame(scene, 0, 0, box.w, box.h));
  if (!page) {
    root.add(makeText(scene, box.w / 2, box.h / 2, STRINGS.journalExtras.tripEmpty, { size: 30, hand: true, align: 'center', color: PAGE.lockedColor }).setOrigin(0.5));
    return;
  }
  const bloom = new Bloom(scene, box.w * 0.24, box.h * 0.6);
  const bs = PAGE.bloomScale;
  bloom.setScale(bs).setData('baseScale', bs);
  bloom.setOpen(Phaser.Math.Clamp(page.peakContentment / 100, 0, 1), false);
  root.add(bloom);
  const tx = box.w * 0.46, wrap = box.w - tx - 20;
  root.add(makeText(scene, tx, 24, fill(STRINGS.journalExtras.tripDay, { n: page.day }), { size: 36, hand: true, color: PALETTE.ink }).setOrigin(0, 0));
  const lines: string[] = [fill(STRINGS.journalExtras.tripFish, { n: page.fishCaught })];
  if (page.bestCatch) lines.push(fill(STRINGS.journalExtras.tripBest, { Fish: FISH_BY_ID[page.bestCatch.id].name, cm: page.bestCatch.cm.toFixed(1) }));
  if (page.mostCooked) lines.push(fill(STRINGS.journalExtras.tripMostCooked, { Dish: dishInfo(page.mostCooked).name }));
  lines.push(page.moments.length ? fill(STRINGS.journalExtras.tripMoments, { List: page.moments.map((m) => MOMENT_BY_ID[m].name).join(', ') }) : STRINGS.journalExtras.tripNoMoments);
  let y = 84;
  for (const line of lines) {
    const t = makeText(scene, tx, y, line, { size: 21, hand: true, wrap, color: PAGE.bodyColor }).setOrigin(0, 0);
    root.add(t);
    y += t.height + 10;
  }
  // once the trip is complete, the last page opens the Trip Album (Album stops Camp + HUD itself)
  const last = index === state.journal.trip.length - 1;
  if (last && state.journal.trip.length >= TIME.tripDays) {
    root.add(new Button(scene, tx + PAGE.albumButtonW / 2, box.h - UI.buttonH / 2 - 12, STRINGS.albumExtras.openAlbum, () => scene.scene.start(SCENES.album), { kind: 'primary', width: PAGE.albumButtonW }));
  }
}
