/**
 * CatchCard: the fishing result modal. Fish image in a soft disc, name in the hand font, size line, rarity stars,
 * a rose "NEW!" ribbon on first catches, and Keep / Let go buttons.
 * Strings live in CATCH_STRINGS until src/data/dialogue.ts lands (the integrator wires them there).
 */
import Phaser from 'phaser';
import { viewport, type Viewport } from '@/config/layout';
import { COLORS, TEX, UI, makeStars } from './kit';
import { makeImg } from '@/art/pipeline';
import { makeText } from './text';
import { Button } from './Button';
import { overlay, MODAL, type OverlayHandle } from './Modal';
import { popIn } from '@/fx/juice';

export type CatchInfo = {
  name: string;
  sizeCm: number;
  /** 1 = common, 2 = uncommon, 3 = rare */
  rarity: 1 | 2 | 3;
  isNew: boolean;
  /** painted (2x) texture key of the fish; omitted = empty disc */
  spriteKey?: string;
  onKeep: () => void;
  onRelease: () => void;
  /** backdrop alpha override (style board) */
  dim?: number;
  /** backdrop depth override (style board) */
  depth?: number;
  /** card center override; default viewport center */
  at?: (v: Viewport) => { x: number; y: number };
};

export const CATCH_STRINGS = {
  newRibbon: 'NEW!',
  keep: 'Keep',
  release: 'Let go',
  size: (cm: number) => `${cm} cm`,
} as const;

export const CATCH = {
  w: 360,
  /** disc texture is 160, visible disc radius 68 */
  discSize: 160,
  fishMax: 112,
  nameSize: 30,
  sizeSize: 18,
  starGap: 30,
  starH: 32,
  buttonW: 136,
  ribbonSize: 16,
  ribbonAngle: -0.26,
  ribbonDelayMs: 320,
  fishDelayMs: 120,
} as const;

/** Open the catch card. Returns the overlay handle (Keep / Let go close it themselves). */
export function showCatch(scene: Phaser.Scene, info: CatchInfo): OverlayHandle {
  const v = viewport();
  const w = Math.min(CATCH.w, v.w - MODAL.margin * 2);
  let handle: OverlayHandle | undefined;

  const h = overlay(scene, {
    w,
    h: 400,
    what: 'catch',
    dim: info.dim,
    depth: info.depth,
    at: info.at,
    build: (card) => {
      const innerW = w - UI.pad * 2;
      const name = makeText(scene, 0, 0, info.name, { hand: true, size: CATCH.nameSize, align: 'center', wrap: innerW }).setOrigin(0.5, 0);
      const size = makeText(scene, 0, 0, CATCH_STRINGS.size(info.sizeCm), { size: CATCH.sizeSize, weight: 600, color: COLORS.muted, align: 'center' }).setOrigin(0.5, 0);
      const btnH = UI.buttonH;

      const gaps = { afterDisc: 10, afterName: 2, afterSize: 10, afterStars: 18 };
      const contentH = CATCH.discSize + gaps.afterDisc + name.height + gaps.afterName + size.height + gaps.afterSize + CATCH.starH + gaps.afterStars + btnH;
      card.resize(w, Math.ceil(UI.pad * 2 + contentH));

      const inner = card.inner();
      let y = inner.top;

      // disc + fish
      const discCy = y + CATCH.discSize / 2;
      const disc = makeImg(scene, 0, discCy, TEX.disc);
      card.content.add(disc);
      if (info.spriteKey && scene.textures.exists(info.spriteKey)) {
        const fish = makeImg(scene, 0, discCy, info.spriteKey);
        const k = Math.min(1, CATCH.fishMax / Math.max(fish.displayWidth, fish.displayHeight));
        fish.setScale(fish.scaleX * k);
        fish.setData('baseScale', fish.scaleX);
        fish.setAlpha(0);
        card.content.add(fish);
        popIn(scene, fish, 320, CATCH.fishDelayMs);
      }
      y += CATCH.discSize + gaps.afterDisc;

      name.setPosition(0, y);
      card.content.add(name);
      y += name.height + gaps.afterName;

      size.setPosition(0, y);
      card.content.add(size);
      y += size.height + gaps.afterSize;

      for (const s of makeStars(scene, 0, y + CATCH.starH / 2, info.rarity, 3, CATCH.starGap)) card.content.add(s);
      y += CATCH.starH + gaps.afterStars;

      const pick = (fn: () => void) => () => {
        handle?.close();
        fn();
      };
      const keep = new Button(scene, -(CATCH.buttonW + UI.gap) / 2, y + btnH / 2, CATCH_STRINGS.keep, pick(info.onKeep), { kind: 'primary', width: CATCH.buttonW });
      const release = new Button(scene, (CATCH.buttonW + UI.gap) / 2, y + btnH / 2, CATCH_STRINGS.release, pick(info.onRelease), { kind: 'secondary', width: CATCH.buttonW });
      card.content.add([keep, release]);

      // "NEW!" ribbon pinned to the disc's top-right, tilted, popping in a beat later
      if (info.isNew) {
        const ribbon = makeImg(scene, 0, 0, TEX.ribbon);
        const label = makeText(scene, 0, -1, CATCH_STRINGS.newRibbon, { size: CATCH.ribbonSize, weight: 700, color: COLORS.primaryText, align: 'center' }).setOrigin(0.5);
        const tag = new Phaser.GameObjects.Container(scene, 60, discCy - 62, [ribbon, label]);
        tag.setRotation(CATCH.ribbonAngle);
        tag.setData('baseScale', 1);
        tag.setAlpha(0);
        card.content.add(tag);
        popIn(scene, tag, 300, CATCH.ribbonDelayMs);
      }
    },
  });
  handle = h;
  return h;
}
