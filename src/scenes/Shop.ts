/**
 * Shop: Doddamma's General Store. Spec section 5 (Shop and economy) and 7 (Shop strings).
 * Left third: the shopkeeper bust behind a teak counter with a greeting bubble. Right two thirds: header, money,
 * TabBar and a scrollable grid of ItemCards. Exit "Head to camp" asks once when an essential is missing.
 */
import Phaser from 'phaser';
import { SCENES } from '@/scenes/Boot';
import { applyViewport, viewport, type Viewport } from '@/config/layout';
import { PALETTE, ACCENTS, mix, shade, alpha, outline } from '@/config/palette';
import { paintTexture, img, roundRectPath, paperGrain, type Ctx } from '@/art/pipeline';
import { paintItemTextures, iconFor } from '@/art/items';
import { Shopkeeper } from '@/entities/Shopkeeper';
import { Card, Button, modal, toast, text, makeText, TEX, UI, COLORS, makeIcon, ensureUiTextures } from '@/ui';
import { TabBar } from '@/ui/TabBar';
import { ItemCard, ITEM_CARD } from '@/ui/ItemCard';
import { audio } from '@/audio';
import { isReduceMotion, squash } from '@/fx/juice';
import { sparkleBurst } from '@/fx/particles';
import { debugMysteryStep, runShopLegend } from '@/systems/mysteryFlow';
import {
  STRINGS, fill, SHOP_TABS, TENTS, RODS, BAITS, PANTRY, DECOR_FOR_SALE, FISH_BY_ID, FORAGE_BY_ID, ESSENTIALS_TAGGED,
  gearVisibleInShop, dishInfo, isBaitId, isTentId, isRodId, isCookwareId,
  type ShopTab, type GearItem, type FishId, type ForageId, type DishId, type DecorId, type PantryId, type BaitId, type GearId,
} from '@/data';
import {
  getState, subscribe, canAfford, buyGear, buyBait, buyPantry, buyDecor, sell, setFlag, markDirty, flush,
  type GameState,
} from '@/state';

/** Layout tuning (logical px). */
const SHOP_LAYOUT = {
  leftFrac: 1 / 3,
  pad: 24,
  headerY: 40,
  headerSize: 28,
  moneySize: 22,
  tabsY: 98,
  gridTop: 136,
  gridBottomGap: 92,
  exitY: 60,
  exitW: 220,
  gridGap: 16,
  counterH: 120,
  counterBottom: 52,
  bustScale: 0.82,
  bubbleW: 300,
  bubbleH: 118,
  bubbleY: 92,
  bubbleSize: 22,
  shelfY: 190,
  readyMs: 400,
  scrollEase: 0.18,
  wheelStep: 0.6,
  dragThreshold: 6,
  rainEars: true,
} as const;

const KEYS = { wall: 'shop-wall', counter: 'shop-counter', shelf: 'shop-shelf' } as const;

type SellEntry = { kind: 'fish' | 'forage' | 'dish'; id: string; name: string; count: number; price: number; icon: string };

export class ShopScene extends Phaser.Scene {
  private shopkeeper?: Shopkeeper;
  private bubbleText?: Phaser.GameObjects.Text;
  private moneyText?: Phaser.GameObjects.Text;
  private coinImg: Phaser.GameObjects.Image | null = null;
  private gridRoot?: Phaser.GameObjects.Container;
  private gridMask?: Phaser.GameObjects.Graphics;
  private gridArea = { x: 0, y: 0, w: 0, h: 0 };
  private contentH = 0;
  private scrollY = 0;
  private scrollTarget = 0;
  private dragging = false;
  private dragMoved = false;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private tab: ShopTab = 'camp';
  private unsubscribe?: () => void;
  private cards: ItemCard[] = [];

  constructor() {
    super(SCENES.shop);
  }

  create(): void {
    applyViewport(this);
    ensureUiTextures(this);
    paintItemTextures(this);
    this.tab = 'camp';
    this.build(viewport());
    // mystery clue 3: the legend plays once the shop has settled (mysteryFlow owns the sequence)
    if (debugMysteryStep() === 2) this.time.delayedCall(SHOP_LAYOUT.readyMs, () => void runShopLegend(this, { say: (l) => { this.say(l); this.bubbleText?.setScale(Math.min(1, (SHOP_LAYOUT.bubbleH - 20) / Math.max(1, this.bubbleText.height))); }, nod: () => this.shopkeeper?.nod() ?? Promise.resolve(), hintAt: { x: (viewport().w * SHOP_LAYOUT.leftFrac) / 2, y: SHOP_LAYOUT.bubbleY + SHOP_LAYOUT.bubbleH / 2 + 100 } }));

    const onViewport = (v: Viewport) => {
      applyViewport(this);
      this.build(v);
    };
    this.game.events.on('viewport', onViewport);
    this.unsubscribe = subscribe((s, tag) => {
      this.moneyText?.setText(fill(STRINGS.shopSell.price, { Price: s.money }));
      if (tag === 'sell' || tag === 'buy') this.refreshCards();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('viewport', onViewport);
      this.unsubscribe?.();
      this.unsubscribe = undefined;
    });

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.input.on('wheel', this.onWheel, this);

    audio.music.setMood('day');
    audio.ambience.set({ dayT: getState().dayT, rain: getState().weather.raining ? 0.5 : 0, inTent: 1 });
    this.time.delayedCall(SHOP_LAYOUT.readyMs, () => { window.__game.ready = true; });
  }

  // ---------- building ----------
  private build(v: Viewport): void {
    const keepScroll = this.scrollY;
    this.children.removeAll(true);
    this.shopkeeper = undefined;
    this.cards = [];
    const L = SHOP_LAYOUT;
    const leftW = Math.round(v.w * L.leftFrac);
    const rightX = leftW + L.pad;
    const rightW = v.w - rightX - L.pad;
    const s = getState();

    // wall
    const wallKey = `${KEYS.wall}-${v.w}x${v.h}`;
    paintTexture(this, wallKey, v.w, v.h, paintWall);
    img(this, v.w / 2, v.h / 2, wallKey);

    // shelf behind the counter
    const shelfW = leftW - L.pad * 2;
    const shelfKey = `${KEYS.shelf}-${shelfW}`;
    paintTexture(this, shelfKey, shelfW, 90, paintShelf);
    img(this, leftW / 2, L.shelfY, shelfKey).setAlpha(0.95);

    // shopkeeper + counter
    const counterKey = `${KEYS.counter}-${leftW}`;
    paintTexture(this, counterKey, leftW - L.pad, L.counterH, paintCounter);
    const counterTop = v.h - L.counterBottom - L.counterH;
    this.shopkeeper = new Shopkeeper(this, leftW / 2, counterTop + 10);
    this.shopkeeper.setScale(L.bustScale);
    if (L.rainEars && s.weather.raining) this.shopkeeper.earsUp(true);
    img(this, leftW / 2, counterTop + L.counterH / 2, counterKey);

    // greeting bubble (card in the hand font with a small tail)
    const bw = Math.min(L.bubbleW, leftW - L.pad * 2);
    const bubble = new Card(this, leftW / 2, L.bubbleY, bw, L.bubbleH);
    const tail = makeIcon(this, 0, L.bubbleH / 2 + 6, TEX.bubbleTail);
    bubble.content.add(tail);
    this.bubbleText = makeText(this, 0, 0, '', { hand: true, size: L.bubbleSize, align: 'center', wrap: bw - UI.pad * 2 }).setOrigin(0.5);
    bubble.content.add(this.bubbleText);
    this.say(this.greeting(s));

    // header + money
    text(this, rightX, L.headerY, fill(STRINGS.shop.header), { size: L.headerSize, weight: 700 }).setOrigin(0, 0.5);
    const coin = img(this, v.w - L.pad, L.headerY, TEX.coin).setOrigin(1, 0.5);
    this.coinImg = coin;
    this.moneyText = text(this, v.w - L.pad - coin.displayWidth - 6, L.headerY, fill(STRINGS.shopSell.price, { Price: s.money }), { size: L.moneySize, weight: 700 }).setOrigin(1, 0.5);

    // tabs
    const tabs = SHOP_TABS.map((id) => ({ id, label: STRINGS.shop.tabs[id] }));
    new TabBar<ShopTab>(this, rightX + rightW / 2, L.tabsY, tabs, this.tab, (id) => this.selectTab(id), { width: rightW });

    // grid (masked, scrollable)
    this.gridArea = { x: rightX, y: L.gridTop, w: rightW, h: v.h - L.gridTop - L.gridBottomGap };
    this.gridRoot = this.add.container(rightX, L.gridTop);
    this.gridMask = this.make.graphics({ x: 0, y: 0 }, false);
    this.gridMask.fillRect(this.gridArea.x, this.gridArea.y, this.gridArea.w, this.gridArea.h);
    this.gridRoot.setMask(this.gridMask.createGeometryMask());
    this.fillGrid();
    this.scrollY = this.scrollTarget = Phaser.Math.Clamp(keepScroll, 0, this.maxScroll());
    this.gridRoot.setY(L.gridTop - this.scrollY);

    // exit
    new Button(this, v.w - L.pad - L.exitW / 2, v.h - L.exitY, STRINGS.shop.exit, () => this.tryExit(), { kind: 'primary', width: L.exitW });
  }

  private greeting(s: GameState): string {
    if (s.day === 1 && !this.hasAnyEssential(s)) return STRINGS.shop.day1;
    const g = STRINGS.shop.greetings;
    return g[Phaser.Math.Between(0, g.length - 1)];
  }

  private say(line: string): void {
    if (!this.bubbleText) return;
    this.bubbleText.setText(line);
    if (!isReduceMotion()) {
      this.bubbleText.setAlpha(0);
      this.tweens.add({ targets: this.bubbleText, alpha: 1, duration: 220, ease: 'Sine.easeOut' });
    }
  }

  private selectTab(id: ShopTab): void {
    this.tab = id;
    this.scrollY = this.scrollTarget = 0;
    this.fillGrid();
    this.gridRoot?.setY(this.gridArea.y);
    audio.sfx.play('pageFlip');
  }

  private refreshCards(): void {
    const keep = this.scrollTarget;
    this.fillGrid();
    this.scrollTarget = Phaser.Math.Clamp(keep, 0, this.maxScroll());
  }

  private maxScroll(): number {
    return Math.max(0, this.contentH - this.gridArea.h);
  }

  // ---------- grid content ----------
  private fillGrid(): void {
    const root = this.gridRoot;
    if (!root) return;
    root.removeAll(true);
    this.cards = [];
    const gap = SHOP_LAYOUT.gridGap;
    const cols = Math.max(1, Math.floor((this.gridArea.w + gap) / (ITEM_CARD.minW + gap)));
    const cardW = Math.floor((this.gridArea.w - gap * (cols - 1)) / cols);
    const cardH = ITEM_CARD.h;
    const place = (i: number): [number, number] => {
      const c = i % cols, r = Math.floor(i / cols);
      return [c * (cardW + gap) + cardW / 2, r * (cardH + gap) + cardH / 2 + 8];
    };

    let count = 0;
    if (this.tab === 'sell') {
      const entries = this.sellEntries();
      if (entries.length === 0) {
        const t = makeText(this, this.gridArea.w / 2, 60, STRINGS.shopSell.empty, { size: 18, color: COLORS.muted, align: 'center', wrap: this.gridArea.w - UI.pad * 2 }).setOrigin(0.5, 0);
        root.add(t);
      }
      for (const e of entries) {
        const [x, y] = place(count++);
        const card = ItemCard.sell(this, x, y, cardW, {
          id: e.id, name: e.name, iconKey: e.icon, count: e.count,
          haveLabel: fill(STRINGS.shopSell.have, { Count: e.count }),
          eachLabel: fill(STRINGS.shopSell.each, { Price: e.price }),
          sellLabel: STRINGS.shop.sell,
          onSell: (qty) => this.doSell(e, qty, card),
        });
        this.adopt(card, root);
      }
    } else {
      for (const item of this.itemsForTab(this.tab)) {
        const [x, y] = place(count++);
        const card = new ItemCard(this, x, y, cardW, { ...item, onBuy: () => this.doBuy(item.id, item.price, card) });
        this.adopt(card, root);
      }
    }
    const rows = Math.max(1, Math.ceil(count / cols));
    this.contentH = rows * (cardH + gap) + 16;
  }

  private adopt(card: ItemCard, root: Phaser.GameObjects.Container): void {
    this.children.remove(card);
    root.add(card);
    this.cards.push(card);
  }

  private itemsForTab(tab: ShopTab): Array<{ id: string; name: string; flavor: string; iconKey: string; priceLabel: string; buyLabel: string; ownedLabel: string; state: 'buy' | 'owned' | 'count'; countLabel?: string; leafTag?: boolean; price: number }> {
    const s = getState();
    const S = STRINGS.shop;
    const base = (id: string, name: string, flavor: string, price: number) => ({
      id, name, flavor, price, iconKey: iconFor(this, id), priceLabel: fill(STRINGS.shopSell.price, { Price: price }), buyLabel: S.buy, ownedLabel: S.owned,
    });
    const gear = (list: readonly GearItem[]) => list.map((g) => {
      const owned = !!s.inventory.gear[g.id];
      const isBait = g.kind === 'bait';
      const n = isBait ? s.inventory.bait[g.id as BaitId] ?? 0 : 0;
      const leaf = s.day === 1 && ESSENTIALS_TAGGED.includes(g.id) && !this.ownsKind(s, g.kind);
      return { ...base(g.id, g.name, g.flavor, g.price), state: isBait ? ('count' as const) : owned ? ('owned' as const) : ('buy' as const), countLabel: isBait ? fill(STRINGS.shopSell.ownedCount, { Count: n }) : undefined, leafTag: leaf };
    });
    switch (tab) {
      case 'camp': return gear(TENTS);
      case 'fishing': return gear([...RODS, ...BAITS]);
      case 'kitchen': return gear(gearVisibleInShop(s.journal.mystery.step).filter((g) => g.kind === 'cookware'));
      case 'pantry': return PANTRY.map((p) => ({ ...base(p.id, p.name, p.flavor, p.price), state: 'count' as const, countLabel: fill(STRINGS.shopSell.ownedCount, { Count: s.inventory.pantry[p.id] ?? 0 }) }));
      case 'cozy': return DECOR_FOR_SALE.map((d) => {
        const owned = (s.camp.decorOwned[d.id] ?? 0) > 0 || s.camp.placedDecor.some((p) => p.id === d.id);
        return { ...base(d.id, d.name, d.flavor, d.price ?? 0), state: owned ? ('owned' as const) : ('buy' as const) };
      });
      default: return [];
    }
  }

  private sellEntries(): SellEntry[] {
    const s = getState();
    const out: SellEntry[] = [];
    const fishCounts = new Map<FishId, number>();
    for (const f of s.inventory.fish) fishCounts.set(f.id, (fishCounts.get(f.id) ?? 0) + 1);
    for (const [id, count] of fishCounts) {
      const def = FISH_BY_ID[id];
      if (def.sell > 0) out.push({ kind: 'fish', id, name: def.name, count, price: def.sell, icon: iconFor(this, id, 'fish') });
    }
    for (const id of Object.keys(s.inventory.forage) as ForageId[]) {
      const count = s.inventory.forage[id] ?? 0;
      const def = FORAGE_BY_ID[id];
      if (count > 0 && def.sell !== null) out.push({ kind: 'forage', id, name: def.name, count, price: def.sell, icon: iconFor(this, id, 'forage') });
    }
    const dishCounts = new Map<DishId, { count: number; price: number }>();
    for (const d of s.inventory.dishes) {
      if (d.sell === null || d.sell <= 0) continue;
      const e = dishCounts.get(d.id) ?? { count: 0, price: d.sell };
      e.count++;
      dishCounts.set(d.id, e);
    }
    for (const [id, e] of dishCounts) out.push({ kind: 'dish', id, name: dishInfo(id).name, count: e.count, price: e.price, icon: iconFor(this, id, 'dish') });
    return out;
  }

  // ---------- actions ----------
  private doBuy(id: string, price: number, card: ItemCard): void {
    if (this.dragMoved) return;
    if (!canAfford(price)) {
      card.wobble();
      audio.sfx.play('nope');
      this.say(STRINGS.shop.tooPricey);
      return;
    }
    let ok = false;
    if (isBaitId(id)) ok = buyBait(id);
    else if (isTentId(id) || isRodId(id) || isCookwareId(id)) ok = buyGear(id as GearId);
    else if (PANTRY.some((p) => p.id === id)) ok = buyPantry(id as PantryId);
    else if (DECOR_FOR_SALE.some((d) => d.id === id)) ok = buyDecor(id as DecorId);
    if (!ok) {
      card.wobble();
      audio.sfx.play('nope');
      return;
    }
    card.bounce();
    audio.sfx.play('pop');
    this.coinSparkle();
    this.shopkeeper?.nod();
    markDirty();
    this.time.delayedCall(220, () => this.refreshCards());
  }

  /** A tiny sparkle and squash on the header cowrie when money changes hands. */
  private coinSparkle(): void {
    const c = this.coinImg;
    if (!c || !c.active) return;
    squash(this, c, 0.18, 220);
    sparkleBurst(this, c.x - c.displayWidth / 2, c.y, 5);
  }

  private doSell(e: SellEntry, qty: number, card: ItemCard): void {
    if (this.dragMoved) return;
    const earned = sell(e.kind, e.id, qty);
    if (earned <= 0) {
      card.wobble();
      audio.sfx.play('nope');
      return;
    }
    card.bounce();
    audio.sfx.play('pop');
    this.coinSparkle();
    this.shopkeeper?.nod();
    toast(this, fill(STRINGS.shopSell.sold, { Count: qty, Item: e.name, Amount: earned }));
    markDirty();
  }

  private ownsKind(s: GameState, kind: GearItem['kind']): boolean {
    return Object.keys(s.inventory.gear).some((id) => (kind === 'tent' && isTentId(id)) || (kind === 'rod' && isRodId(id)) || (kind === 'cookware' && isCookwareId(id)));
  }
  private hasAnyEssential(s: GameState): boolean {
    return this.ownsKind(s, 'tent') || this.ownsKind(s, 'rod') || this.ownsKind(s, 'cookware');
  }
  private hasAllEssentials(s: GameState): boolean {
    return this.ownsKind(s, 'tent') && this.ownsKind(s, 'rod') && this.ownsKind(s, 'cookware');
  }

  private tryExit(): void {
    const s = getState();
    if (!this.hasAllEssentials(s) && !s.flags.essentialsAskedOnce) {
      modal(this, {
        title: STRINGS.shop.leavingWithoutEssentials,
        body: STRINGS.shop.day1,
        buttons: [
          { label: STRINGS.shop.backToShopping, kind: 'secondary' },
          { label: STRINGS.shop.headOutAnyway, kind: 'primary', onPick: () => { setFlag('essentialsAskedOnce', true); this.leave(); } },
        ],
      });
      return;
    }
    this.leave();
  }

  private leave(): void {
    markDirty();
    flush();
    this.scene.start(SCENES.camp);
  }

  // ---------- scrolling ----------
  private inGrid(p: Phaser.Input.Pointer): boolean {
    const a = this.gridArea;
    return p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.h;
  }
  private onDown(p: Phaser.Input.Pointer): void {
    this.dragMoved = false;
    if (!this.inGrid(p)) return;
    this.dragging = true;
    this.dragStartY = p.y;
    this.dragStartScroll = this.scrollTarget;
  }
  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.dragging || !p.isDown) return;
    const dy = p.y - this.dragStartY;
    if (Math.abs(dy) > SHOP_LAYOUT.dragThreshold) this.dragMoved = true;
    this.scrollTarget = Phaser.Math.Clamp(this.dragStartScroll - dy, 0, this.maxScroll());
  }
  private onUp(): void {
    this.dragging = false;
    this.time.delayedCall(0, () => { this.dragMoved = false; });
  }
  private onWheel(p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void {
    if (!this.inGrid(p)) return;
    this.scrollTarget = Phaser.Math.Clamp(this.scrollTarget + dy * SHOP_LAYOUT.wheelStep, 0, this.maxScroll());
  }

  update(): void {
    if (!this.gridRoot) return;
    const ease = isReduceMotion() ? 1 : SHOP_LAYOUT.scrollEase;
    this.scrollY += (this.scrollTarget - this.scrollY) * ease;
    if (Math.abs(this.scrollTarget - this.scrollY) < 0.3) this.scrollY = this.scrollTarget;
    this.gridRoot.setY(this.gridArea.y - this.scrollY);
  }
}

// ---------- painted set dressing ----------
function paintWall(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mix(PALETTE.cream, PALETTE.butter, 0.25));
  g.addColorStop(1, mix(PALETTE.cream, PALETTE.peach, 0.18));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // soft plank lines
  ctx.strokeStyle = alpha(PALETTE.bark, 0.08);
  ctx.lineWidth = 2;
  for (let y = 40; y < h; y += 72) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  // floor band
  const floorY = h - 40;
  ctx.fillStyle = mix(PALETTE.bark, PALETTE.cream, 0.55);
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = alpha(PALETTE.ink, 0.08);
  ctx.fillRect(0, floorY, w, 3);
  paperGrain(ctx, 0, 0, w, h, PALETTE.ink, 0.03, 11);
}

function paintShelf(ctx: Ctx, w: number, h: number): void {
  const plankY = h - 22;
  // jars
  const jars: Array<[number, string]> = [[0.2, ACCENTS.marigold], [0.4, PALETTE.sage], [0.6, ACCENTS.laterite], [0.8, PALETTE.glow]];
  for (const [fx, col] of jars) {
    const x = w * fx, jw = 36, jh = 48;
    roundRectPath(ctx, x - jw / 2, plankY - jh, jw, jh, 10);
    ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = outline(col); ctx.stroke();
    roundRectPath(ctx, x - jw / 2 + 4, plankY - jh - 8, jw - 8, 12, 4);
    ctx.fillStyle = PALETTE.bark; ctx.fill(); ctx.strokeStyle = outline(PALETTE.bark); ctx.stroke();
    ctx.fillStyle = alpha(PALETTE.cream, 0.5);
    ctx.beginPath(); ctx.ellipse(x - 8, plankY - jh / 2, 3, 10, 0, 0, Math.PI * 2); ctx.fill();
  }
  // plank with shadow under it
  ctx.fillStyle = alpha(PALETTE.ink, 0.1);
  roundRectPath(ctx, 6, plankY + 4, w - 12, 14, 6); ctx.fill();
  roundRectPath(ctx, 0, plankY, w, 14, 6);
  ctx.fillStyle = PALETTE.bark; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = outline(PALETTE.bark); ctx.stroke();
}

function paintCounter(ctx: Ctx, w: number, h: number): void {
  const teak = shade(PALETTE.bark, -0.05);
  // front
  roundRectPath(ctx, 2, 18, w - 4, h - 20, 14);
  const g = ctx.createLinearGradient(0, 18, 0, h);
  g.addColorStop(0, shade(teak, 0.05));
  g.addColorStop(1, shade(teak, -0.18));
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = outline(teak); ctx.stroke();
  // wood grain
  ctx.strokeStyle = alpha(PALETTE.ink, 0.12);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const y = 36 + i * 16;
    ctx.beginPath();
    ctx.moveTo(14, y);
    ctx.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 5, w - 14, y + 2);
    ctx.stroke();
  }
  // top slab
  roundRectPath(ctx, 0, 6, w, 22, 10);
  ctx.fillStyle = shade(teak, 0.18); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = outline(teak); ctx.stroke();
  ctx.fillStyle = alpha(PALETTE.cream, 0.25);
  roundRectPath(ctx, 10, 9, w - 20, 5, 3); ctx.fill();
}
