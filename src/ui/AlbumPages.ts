/**
 * AlbumPages: the Trip Album's page list and the content of one page as a Container (made, not added; page-local
 * coordinates with (0, 0) at the top-left of the writing box). The Album scene owns the book, flips and paging.
 *
 *   albumPages(state)                       -> ordered page descriptors (cover, days, companion, mystery, postcard, end)
 *   buildAlbumPage(scene, page, state, box) -> Container with that page's scrapbook pieces
 *
 * Polaroids carry the day's bloom, best catch and most-cooked dish; moments reuse the journal vignettes.
 */
import Phaser from 'phaser';
import { PALETTE, mix } from '@/config/palette';
import { makeImg } from '@/art/pipeline';
import { FISH_KEYS, paintFish } from '@/art/fish';
import { DISH_KEYS, paintDishes } from '@/art/dishes';
import { Bloom } from '@/art/hud';
import { Companion } from '@/entities/Companion';
import { JOURNAL_TEX, paintJournalTextures, vignetteKey } from '@/art/journal';
import { ALBUM, ALBUM_TEX, WASHI_KEYS, paintAlbumTextures } from '@/art/album';
import { TEX } from './kit';
import { makeText } from './text';
import { STRINGS, fill, FISH_BY_ID, MOMENT_BY_ID, dishInfo, COMPANION } from '@/data';
import type { DayPage, GameState } from '@/state';

export type PageBox = { w: number; h: number };
export type AlbumPage =
  | { kind: 'cover' }
  | { kind: 'day'; page: DayPage }
  | { kind: 'companion' }
  | { kind: 'mystery' }
  | { kind: 'postcard' };

/** Layout tuning for the album pages (logical px). */
export const APAGE = {
  titleSize: 38,
  bodySize: 20,
  captionSize: 17,
  smallSize: 16,
  inkSoft: mix(PALETTE.ink, PALETTE.cream, 0.15),
  inkFaint: mix(PALETTE.ink, PALETTE.cream, 0.4),
  polaroidTilt: [-4, 3, -2, 5] as readonly number[],
  polaroidGap: 18,
  photoIconScale: 1.3,
  bloomScale: 0.72,
  companionScale: 1.6,
  silhouetteAlpha: 0.3,
  heartGap: 40,
  vignetteScale: 0.95,
} as const;

type Scene = Phaser.Scene;

export function albumPages(state: GameState): AlbumPage[] {
  const pages: AlbumPage[] = [{ kind: 'cover' }];
  for (const page of state.journal.trip) pages.push({ kind: 'day', page });
  pages.push({ kind: 'companion' }, { kind: 'mystery' }, { kind: 'postcard' });
  return pages;
}

export function albumPageTitle(page: AlbumPage, state: GameState): string {
  const A = STRINGS.albumExtras;
  switch (page.kind) {
    case 'cover': return fill(STRINGS.album.cover, { n: state.trip });
    case 'day': return fill(A.dayTitle, { n: page.page.day });
    case 'companion': return A.companionTitle;
    case 'mystery': return A.mysteryTitle;
    case 'postcard': return A.postcardTitle;
  }
}

export function buildAlbumPage(scene: Scene, page: AlbumPage, state: GameState, box: PageBox): Phaser.GameObjects.Container {
  paintAlbumTextures(scene);
  paintJournalTextures(scene);
  const root = scene.make.container({ x: 0, y: 0, add: false });
  switch (page.kind) {
    case 'cover': break; // the scene draws the cover itself
    case 'day': buildDay(scene, root, page.page, box); break;
    case 'companion': buildCompanion(scene, root, state, box); break;
    case 'mystery': buildMystery(scene, root, state, box); break;
    case 'postcard': buildPostcard(scene, root, box); break;
  }
  return root;
}

// ---------- shared pieces ----------
/** A polaroid with a caption; `photo(cx, cy)` adds the picture to the given container at the photo window center. */
function polaroid(scene: Scene, root: Phaser.GameObjects.Container, x: number, y: number, tilt: number, caption: string, photo: (c: Phaser.GameObjects.Container, cx: number, cy: number) => void, washi = 0): void {
  const c = scene.make.container({ x, y, add: false });
  c.setAngle(tilt).setData('baseScale', 1);
  const frame = makeImg(scene, 0, 0, ALBUM_TEX.polaroid);
  c.add(frame);
  const P = ALBUM.polaroid;
  const cx = -P.w / 2 + P.photo.x + P.photo.w / 2;
  const cy = -P.h / 2 + P.photo.y + P.photo.h / 2;
  photo(c, cx, cy);
  c.add(makeText(scene, 0, P.h / 2 - 32, caption, { size: APAGE.captionSize, hand: true, align: 'center', wrap: P.w - 20, color: PALETTE.ink }).setOrigin(0.5));
  // washi tape over the top edge
  c.add(makeImg(scene, 0, -P.h / 2 + 2, WASHI_KEYS[washi % WASHI_KEYS.length]).setAngle(-tilt * 2 - 6));
  root.add(c);
}

function heading(scene: Scene, root: Phaser.GameObjects.Container, x: number, y: number, title: string, sub?: string): number {
  const t = makeText(scene, x, y, title, { size: APAGE.titleSize, hand: true, color: PALETTE.ink }).setOrigin(0, 0);
  root.add(t);
  let bottom = y + t.height;
  if (sub) {
    const s = makeText(scene, x, bottom + 2, sub, { size: APAGE.bodySize, hand: true, color: APAGE.inkSoft }).setOrigin(0, 0);
    root.add(s);
    bottom += s.height + 2;
  }
  return bottom;
}

// ---------- day page ----------
function buildDay(scene: Scene, root: Phaser.GameObjects.Container, page: DayPage, box: PageBox): void {
  paintFish(scene);
  paintDishes(scene);
  const A = STRINGS.albumExtras;
  const E = STRINGS.journalExtras;
  heading(scene, root, 0, 0, fill(A.dayTitle, { n: page.day }), `${fill(A.fishCaught, { n: page.fishCaught })} · ${fill(A.dishesCooked, { n: page.dishesCooked })}`);

  // a row of up to four polaroids: bloom, best catch, most cooked, a moment
  const P = ALBUM.polaroid;
  const items: Array<{ caption: string; photo: (c: Phaser.GameObjects.Container, cx: number, cy: number) => void }> = [];
  items.push({
    caption: fill(A.peak, { n: Math.round(page.peakContentment) }),
    photo: (c, cx, cy) => {
      const bloom = new Bloom(scene, cx, cy + 30);
      bloom.setScale(APAGE.bloomScale).setData('baseScale', APAGE.bloomScale);
      bloom.setOpen(Phaser.Math.Clamp(page.peakContentment / 100, 0, 1), false);
      c.add(bloom);
    },
  });
  if (page.bestCatch) {
    const bc = page.bestCatch;
    items.push({
      caption: fill(E.tripBest, { Fish: FISH_BY_ID[bc.id].name, cm: bc.cm.toFixed(1) }),
      photo: (c, cx, cy) => {
        const im = makeImg(scene, cx, cy, FISH_KEYS[bc.id]);
        const k = (im.getData('baseScale') as number) * APAGE.photoIconScale;
        im.setScale(k).setData('baseScale', k);
        c.add(im);
      },
    });
  }
  if (page.mostCooked) {
    const id = page.mostCooked;
    items.push({
      caption: fill(E.tripMostCooked, { Dish: dishInfo(id).name }),
      photo: (c, cx, cy) => {
        const im = makeImg(scene, cx, cy, DISH_KEYS[id]);
        const k = (im.getData('baseScale') as number) * APAGE.photoIconScale;
        im.setScale(k).setData('baseScale', k);
        c.add(im);
      },
    });
  }
  for (const m of page.moments.slice(0, 2)) {
    items.push({
      caption: MOMENT_BY_ID[m].name,
      photo: (c, cx, cy) => {
        const im = makeImg(scene, cx, cy, vignetteKey(m));
        const k = (im.getData('baseScale') as number) * APAGE.vignetteScale;
        im.setScale(k).setData('baseScale', k);
        c.add(im);
      },
    });
  }
  const n = Math.min(items.length, 4);
  const totalW = n * P.w + (n - 1) * APAGE.polaroidGap;
  const x0 = box.w / 2 - totalW / 2 + P.w / 2;
  const y = box.h * 0.58;
  for (let i = 0; i < n; i++) {
    polaroid(scene, root, x0 + i * (P.w + APAGE.polaroidGap), y + (i % 2 ? 10 : -6), APAGE.polaroidTilt[i], items[i].caption, items[i].photo, i);
  }
  if (!page.moments.length) {
    root.add(makeText(scene, box.w - 8, box.h - 10, A.quietDay, { size: APAGE.captionSize, hand: true, align: 'right', color: APAGE.inkFaint }).setOrigin(1, 1).setAngle(-2));
  }
}

// ---------- companion page ----------
function buildCompanion(scene: Scene, root: Phaser.GameObjects.Container, state: GameState, box: PageBox): void {
  const A = STRINGS.albumExtras;
  const comp = state.journal.companion;
  heading(scene, root, 0, 0, A.companionTitle);
  const rig = new Companion(scene, box.w * 0.3, box.h * 0.66);
  rig.setFacing(1);
  rig.setScale(APAGE.companionScale).setData('baseScale', APAGE.companionScale);
  if (!comp.befriended) {
    rig.setTint(PALETTE.ink);
    rig.setAlpha(APAGE.silhouetteAlpha);
  }
  root.add(rig);
  const tx = box.w * 0.52, wrap = box.w - tx - 10;
  const line = comp.befriended ? fill(STRINGS.companion.befriended) : A.companionShy;
  root.add(makeText(scene, tx, box.h * 0.36, line, { size: 26, hand: true, wrap, color: PALETTE.ink }).setOrigin(0, 0));
  root.add(makeText(scene, tx, box.h * 0.62, fill(A.companionShares, { n: comp.visits }), { size: APAGE.bodySize, hand: true, color: APAGE.inkSoft }).setOrigin(0, 0));
  const filled = Math.min(COMPANION.hearts, comp.visitDays.length);
  for (let i = 0; i < COMPANION.hearts; i++) {
    const im = makeImg(scene, tx + 16 + i * APAGE.heartGap, box.h * 0.78, i < filled ? TEX.heart : JOURNAL_TEX.heartEmpty);
    root.add(im);
  }
  root.add(makeImg(scene, box.w * 0.3, box.h * 0.2, WASHI_KEYS[0]).setAngle(-8));
}

// ---------- mystery page ----------
function buildMystery(scene: Scene, root: Phaser.GameObjects.Container, state: GameState, box: PageBox): void {
  const A = STRINGS.albumExtras;
  const met = state.journal.mystery.finaleDone;
  heading(scene, root, 0, 0, A.mysteryTitle);
  const map = makeImg(scene, box.w * 0.3, box.h * 0.6, met ? ALBUM_TEX.mapFinale : ALBUM_TEX.map).setAngle(-2);
  root.add(map);
  root.add(makeImg(scene, box.w * 0.3, box.h * 0.6 - ALBUM.map.h / 2 - 2, WASHI_KEYS[1]).setAngle(4));
  const tx = box.w * 0.6, wrap = box.w - tx - 10;
  root.add(makeText(scene, tx, box.h * 0.4, fill(met ? STRINGS.album.guardianMet : STRINGS.album.guardianUnmet), { size: 28, hand: true, wrap, color: PALETTE.ink }).setOrigin(0, 0));
  if (met) {
    const badge = makeImg(scene, tx + 44, box.h * 0.78, JOURNAL_TEX.badgeGuardian);
    root.add(badge);
  }
}

// ---------- postcard page (the last page; the scene adds "Stay a little longer" / "Start a new trip" at POSTCARD.buttons) ----------
export const POSTCARD_PAGE = {
  cardX: 0.27,
  cardY: 0.5,
  textX: 0.56,
  textY: 0.1,
  /** button column center and the top of the first button, as fractions of the box */
  buttons: { x: 0.76, y: 0.5, w: 280 },
} as const;

function buildPostcard(scene: Scene, root: Phaser.GameObjects.Container, box: PageBox): void {
  const A = STRINGS.albumExtras;
  const cx = box.w * POSTCARD_PAGE.cardX, cy = box.h * POSTCARD_PAGE.cardY;
  const card = makeImg(scene, cx, cy, ALBUM_TEX.postcard).setAngle(-2);
  root.add(card);
  root.add(makeImg(scene, cx - ALBUM.postcard.w * 0.34, cy - ALBUM.postcard.h / 2 + 2, WASHI_KEYS[2]).setAngle(-12));
  root.add(makeImg(scene, cx + ALBUM.postcard.w * 0.34, cy - ALBUM.postcard.h / 2 + 10, WASHI_KEYS[0]).setAngle(10));
  const tx = box.w * POSTCARD_PAGE.textX, wrap = box.w - tx - 8;
  root.add(makeText(scene, tx, box.h * POSTCARD_PAGE.textY, fill(STRINGS.album.postcard), { size: 28, hand: true, wrap, color: PALETTE.ink }).setOrigin(0, 0).setAngle(-1));
  root.add(makeText(scene, tx, box.h * POSTCARD_PAGE.textY + 92, A.endBody, { size: APAGE.bodySize, hand: true, wrap, color: APAGE.inkSoft }).setOrigin(0, 0));
  root.add(makeText(scene, cx, cy + ALBUM.postcard.h / 2 + 18, A.endTitle, { size: APAGE.captionSize, hand: true, align: 'center', color: APAGE.inkFaint }).setOrigin(0.5, 0));
}
