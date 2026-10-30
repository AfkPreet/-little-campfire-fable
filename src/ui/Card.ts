/**
 * Card: a cream nine-slice panel (radius 20, baked ink shadow) with faint paper grain, an optional title and a
 * `content` container for children. The card is centered on (x, y); children of `content` use card-local
 * coordinates where (0, 0) is the card center. Use `inner()` for the padded content box (under the title).
 */
import Phaser from 'phaser';
import { UI, nineCard, resizeNine, makeGrain, CARD_SPEC, ensureUiTextures } from './kit';
import { makeText } from './text';

export type CardOpts = {
  title?: string;
  /** title in the hand font (journal, banners) */
  hand?: boolean;
  /** paper grain overlay (default on) */
  grain?: boolean;
  titleSize?: number;
};

export type InnerBox = { left: number; right: number; top: number; bottom: number; w: number; h: number };

/** Grain stays this far inside the edges so it never leaks past the rounded corners (needs >= r(1 - 1/sqrt2) ~ 6). */
const GRAIN_INSET = 8;
const TITLE_GAP = 10;

export class Card extends Phaser.GameObjects.Container {
  readonly bg: Phaser.GameObjects.NineSlice;
  readonly grain?: Phaser.GameObjects.TileSprite;
  readonly titleText?: Phaser.GameObjects.Text;
  /** Put card contents here (card-local coordinates, origin at the card center). */
  readonly content: Phaser.GameObjects.Container;
  private cardW: number;
  private cardH: number;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, opts: CardOpts = {}) {
    super(scene, x, y);
    ensureUiTextures(scene);
    this.cardW = w;
    this.cardH = h;

    this.bg = nineCard(scene, 0, 0, w, h, false);
    this.add(this.bg);

    if (opts.grain !== false) {
      this.grain = makeGrain(scene, 0, 0, w - GRAIN_INSET * 2, h - GRAIN_INSET * 2);
      this.add(this.grain);
    }

    if (opts.title) {
      this.titleText = makeText(scene, 0, -h / 2 + UI.pad, opts.title, {
        size: opts.titleSize ?? (opts.hand ? 28 : 22),
        hand: opts.hand,
        weight: 700,
        align: 'center',
        wrap: Math.max(40, w - UI.pad * 2),
      }).setOrigin(0.5, 0);
      this.add(this.titleText);
    }

    this.content = new Phaser.GameObjects.Container(scene, 0, 0);
    this.add(this.content);

    this.setSize(w, h);
    this.setData('baseScale', 1);
    scene.add.existing(this);
  }

  get cardWidth(): number {
    return this.cardW;
  }
  get cardHeight(): number {
    return this.cardH;
  }

  /** Padded content box in card-local coordinates (below the title when there is one). */
  inner(): InnerBox {
    const left = -this.cardW / 2 + UI.pad;
    const right = this.cardW / 2 - UI.pad;
    const titleH = this.titleText ? this.titleText.height + TITLE_GAP : 0;
    const top = -this.cardH / 2 + UI.pad + titleH;
    const bottom = this.cardH / 2 - UI.pad;
    return { left, right, top, bottom, w: right - left, h: bottom - top };
  }

  /** Resize the visible card (logical px); the title and grain follow. Children of `content` are not moved. */
  resize(w: number, h: number): this {
    this.cardW = w;
    this.cardH = h;
    resizeNine(this.bg, CARD_SPEC, w, h);
    if (this.grain) this.grain.setSize(Math.max(1, (w - GRAIN_INSET * 2) * 2), Math.max(1, (h - GRAIN_INSET * 2) * 2));
    if (this.titleText) {
      this.titleText.setPosition(0, -h / 2 + UI.pad);
      this.titleText.setWordWrapWidth(Math.max(40, w - UI.pad * 2), true);
    }
    this.setSize(w, h);
    return this;
  }
}
