/**
 * ItemCard: a shop card. Buy mode: icon, name, price (cowrie icon), flavor, Buy / Owned (or an owned count with Buy).
 * Sell mode: icon, name, owned count, unit price, a Stepper and a Sell button.
 */
import Phaser from 'phaser';
import { Card } from './Card';
import { Button } from './Button';
import { Stepper } from './controls';
import { makeText } from './text';
import { TEX, UI, COLORS, makeIcon } from './kit';
import { makeImg } from '@/art/pipeline';
import { squash, nudge } from '@/fx/juice';

export const ITEM_CARD = {
  h: 244,
  sellH: 208,
  minW: 250,
  iconY: 48,
  nameSize: 20,
  priceSize: 18,
  flavorSize: 16,
  countSize: 16,
  buttonH: 44,
  buttonW: 120,
  coinGap: 6,
  tagOffset: 26,
} as const;

export type ItemCardState = 'buy' | 'owned' | 'count';
export type ItemCardOpts = {
  id: string;
  name: string;
  flavor: string;
  iconKey: string;
  /** price label, already formatted (e.g. "40c") */
  priceLabel: string;
  buyLabel: string;
  ownedLabel: string;
  state: ItemCardState;
  /** owned count shown in 'count' state, formatted (e.g. "x3") */
  countLabel?: string;
  leafTag?: boolean;
  onBuy: () => void;
};

export type SellCardOpts = {
  id: string;
  name: string;
  iconKey: string;
  count: number;
  /** "You have 3" */
  haveLabel: string;
  /** "2c each" */
  eachLabel: string;
  sellLabel: string;
  onSell: (qty: number) => void;
};

export class ItemCard extends Card {
  readonly itemId: string;
  private button?: Button;
  private stateText?: Phaser.GameObjects.Text;
  private countText?: Phaser.GameObjects.Text;
  private stepper?: Stepper;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, opts: ItemCardOpts) {
    super(scene, x, y, w, ITEM_CARD.h);
    this.itemId = opts.id;
    const h = ITEM_CARD.h;
    const top = -h / 2;
    const icon = makeImg(scene, 0, top + ITEM_CARD.iconY, opts.iconKey);
    const name = makeText(scene, 0, top + 86, opts.name, { size: ITEM_CARD.nameSize, weight: 700, align: 'center', wrap: w - UI.pad * 2 }).setOrigin(0.5, 0);
    const priceY = top + 118;
    const coin = makeIcon(scene, 0, priceY, TEX.coin);
    const price = makeText(scene, 0, priceY, opts.priceLabel, { size: ITEM_CARD.priceSize, weight: 700 }).setOrigin(0, 0.5);
    const coinW = coin.displayWidth;
    const rowW = coinW + ITEM_CARD.coinGap + price.width;
    coin.setX(-rowW / 2 + coinW / 2);
    price.setX(-rowW / 2 + coinW + ITEM_CARD.coinGap);
    const flavor = makeText(scene, 0, top + 136, opts.flavor, { size: ITEM_CARD.flavorSize, weight: 400, align: 'center', wrap: w - UI.pad * 2, color: COLORS.muted }).setOrigin(0.5, 0);
    this.content.add([icon, name, coin, price, flavor]);

    const by = h / 2 - UI.pad / 2 - ITEM_CARD.buttonH / 2 - 4;
    if (opts.state === 'owned') {
      this.stateText = makeText(scene, 0, by, opts.ownedLabel, { size: ITEM_CARD.priceSize, weight: 700, color: COLORS.muted, align: 'center' }).setOrigin(0.5);
      this.content.add(this.stateText);
    } else {
      this.button = new Button(scene, 0, by, opts.buyLabel, opts.onBuy, { kind: 'primary', width: ITEM_CARD.buttonW, height: ITEM_CARD.buttonH, size: 18 });
      scene.children.remove(this.button);
      this.content.add(this.button);
      if (opts.state === 'count' && opts.countLabel) {
        this.countText = makeText(scene, ITEM_CARD.buttonW / 2 + 12, by, opts.countLabel, { size: ITEM_CARD.countSize, weight: 700, color: COLORS.muted }).setOrigin(0, 0.5);
        this.content.add(this.countText);
      }
    }
    if (opts.leafTag) {
      const tag = makeIcon(scene, w / 2 - ITEM_CARD.tagOffset, top + ITEM_CARD.tagOffset - 4, TEX.leafTag);
      tag.setRotation(0.35);
      this.content.add(tag);
    }
  }

  /** Sell-tab variant. */
  static sell(scene: Phaser.Scene, x: number, y: number, w: number, opts: SellCardOpts): ItemCard {
    const card = new ItemCard(scene, x, y, w, {
      id: opts.id, name: opts.name, flavor: opts.haveLabel, iconKey: opts.iconKey, priceLabel: opts.eachLabel,
      buyLabel: opts.sellLabel, ownedLabel: '', state: 'buy', onBuy: () => {},
    });
    card.toSellLayout(scene, opts);
    return card;
  }

  private toSellLayout(scene: Phaser.Scene, opts: SellCardOpts): void {
    const by = ITEM_CARD.h / 2 - UI.pad / 2 - ITEM_CARD.buttonH / 2 - 4;
    const stepW = 44 * 2 + 64 + 10 * 2;
    const gap = UI.gap;
    const total = stepW + gap + ITEM_CARD.buttonW;
    this.stepper = new Stepper(scene, -total / 2 + stepW / 2, by, { min: 1, max: Math.max(1, opts.count), value: 1, step: 1 });
    scene.children.remove(this.stepper);
    this.content.add(this.stepper);
    this.button?.setPosition(total / 2 - ITEM_CARD.buttonW / 2, by);
    this.button?.setOnPress(() => opts.onSell(this.stepper?.value ?? 1));
  }

  /** The current stepper quantity (sell cards). */
  get quantity(): number {
    return this.stepper?.value ?? 1;
  }

  /** Too pricey: the Buy button wobbles. */
  wobble(): void {
    if (this.button) nudge(this.scene, this.button, 4, 60);
  }

  /** Bought: the whole card squishes. */
  bounce(): void {
    squash(this.scene, this, 0.12, 200);
  }
}
