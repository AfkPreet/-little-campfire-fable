/**
 * Cooking overlay (spec section 5 "Cooking", strings in STRINGS.cooking). Launched over Camp with
 * scene.launch(SCENES.cooking, { companionNear }) and returns through the Camp scene's events:
 *   camp.events.emit('cooking:closed', { cooked: { dishId, isNew, action } | null })
 * then stops itself. Works standalone too (?scene=cooking&state=midtrip): the Camp emit is guarded.
 * Camp owns the clock pause (this scene never touches dayT).
 */
import Phaser from 'phaser';
import { SCENES } from '@/scenes/Boot';
import { applyViewport, viewport, type Viewport } from '@/config/layout';
import { DEBUG } from '@/config/debug';
import { PALETTE, hexToInt } from '@/config/palette';
import { COOKWARE, FISH_BY_ID, FORAGE_BY_ID, PANTRY_BY_ID, STRINGS, fill, matchRecipe, dishInfo, COOKING } from '@/data';
import type { CookwareId, DishId, FishId, ForageId, IngredientId, PantryId } from '@/data/types';
import { getState, initStore, removePantry, removeForage, removeFish, addDish, recordCook, discoverRecipe, eatDish, companionVisit, markDirty } from '@/state';
import type { DebugStateKind } from '@/state';
import { Button, Card, UI, TEX, text, makeText, toast, breathingRing, ensureUiTextures } from '@/ui';
import { steam, sparkleBurst, heartsFloat, type SteamHandle } from '@/fx/particles';
import { squash, popIn, isReduceMotion, floatAway } from '@/fx/juice';
import { audio } from '@/audio';
import { makeImg } from '@/art/pipeline';
import { COOKWARE_KEYS, COOKWARE_BOWL, paintCookware, makeCloseFire, type CloseFireRig } from '@/art/cookware';
import { DISH_KEYS, paintDishes } from '@/art/dishes';
import { MYSTERY_ART, makeGlowDisc } from '@/art/mystery';
import { ING_KEYS, paintIngredients } from '@/art/ingredients';
import { StirGesture } from '@/systems/stirGesture';

export type CookingLaunchData = { companionNear?: boolean };
export type CookAction = 'eat' | 'save' | 'share';
export type CookedResult = { dishId: DishId; isNew: boolean; action: CookAction };
export type CookingClosed = { cooked: CookedResult | null };
export const COOKING_EVENTS = { closed: 'cooking:closed' } as const;

/** Overlay geometry (logical px, 720 high). */
const L = {
  dim: 0.35,
  readyMs: 400,
  picker: { y: 64, gap: 84, iconScale: 0.36 },
  hintY: 136,
  fire: { y: 500 },
  pot: { yAbove: 132, dropRadius: 120, slotGap: 44, slotScale: 0.8 },
  tray: { h: 176, margin: 16, chipW: 104, chipH: 112, gap: 10 },
  result: { w: 460, h: 330, iconScale: 2 },
  depth: { backdrop: 0, fire: 10, chips: 20, drag: 30, panel: 40, hud: 50 },
} as const;

type ChipKind = 'pantry' | 'forage' | 'fish';
type ChipDef = { kind: ChipKind; id: PantryId | ForageId | FishId; count: number; label: string; iconKey: string; tint?: number };
type Chip = { def: ChipDef; root: Phaser.GameObjects.Container; countText: Phaser.GameObjects.Text; homeX: number; homeY: number };
type PotItem = { def: ChipDef; img: Phaser.GameObjects.Image };
type Phase = 'noCookware' | 'pick' | 'cooking' | 'result';

/** A soft tint per fish species until species art replaces the generic icon (palette tokens only). */
const FISH_TINT: Record<FishId, string> = {
  minnow: PALETTE.powder, carp: PALETTE.sage, trout: PALETTE.peach, perch: PALETTE.lavender,
  loach: PALETTE.moss, glowfin: PALETTE.glow, koi: PALETTE.rose, golden: PALETTE.butter,
};

export class CookingScene extends Phaser.Scene {
  private launchData: CookingLaunchData = {};
  private phase: Phase = 'pick';
  private cookwareId: CookwareId | null = null;
  private lastCooked: CookedResult | null = null;

  private backdrop!: Phaser.GameObjects.Rectangle;
  private pickerRoot!: Phaser.GameObjects.Container;
  private pickerRings: Partial<Record<CookwareId, Phaser.GameObjects.Image>> = {};
  private hint!: Phaser.GameObjects.Text;
  private closeBtn!: Button;
  private fire!: CloseFireRig;
  private cookwareImg?: Phaser.GameObjects.Image;
  private potItems: PotItem[] = [];
  private dropRing?: Phaser.GameObjects.Image;
  private tray?: Card;
  private chips: Chip[] = [];
  private stir?: StirGesture;
  private steamFx?: SteamHandle;
  private resultCard?: Card;
  private noCookwareCard?: Card;
  private onViewport = () => this.layout();

  constructor() {
    super(SCENES.cooking);
  }

  init(data?: CookingLaunchData): void {
    this.launchData = data ?? {};
  }

  create(): void {
    ensureStore();
    applyViewport(this);
    ensureUiTextures(this);
    paintCookware(this);
    paintDishes(this);
    paintIngredients(this);

    const v = viewport();
    this.backdrop = this.add.rectangle(0, 0, v.w * 4, v.h * 4, hexToInt(PALETTE.ink), L.dim).setDepth(L.depth.backdrop).setInteractive();

    this.fire = makeCloseFire(this, v.w / 2, L.fire.y);
    this.fire.container.setDepth(L.depth.fire);

    this.pickerRoot = this.add.container(0, 0).setDepth(L.depth.hud);
    this.hint = text(this, 0, 0, STRINGS.cooking.hintDrag, { size: 22, color: PALETTE.cream, weight: 600, align: 'center', shadow: true }).setOrigin(0.5).setDepth(L.depth.hud);
    this.closeBtn = new Button(this, 0, 0, '', () => this.close(), { kind: 'icon', icon: TEX.close }).setDepth(L.depth.hud);

    const owned = this.ownedCookware();
    if (owned.length === 0) {
      this.phase = 'noCookware';
      this.showNoCookware();
    } else {
      this.buildPicker(owned);
      this.selectCookware(owned[0]);
      this.buildTray();
      this.setPhase('pick');
    }

    audio.ambience.set({ dayT: getState().dayT, rain: getState().weather.raining ? 0.5 : 0, nearFire: 1 });
    this.game.events.on('viewport', this.onViewport);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('viewport', this.onViewport);
      this.steamFx?.destroy();
      this.stir?.destroy();
    });
    this.layout();
    this.time.delayedCall(L.readyMs, () => { window.__game.ready = true; });
  }

  update(time: number): void {
    const t = DEBUG.freeze ? 3.2 : time / 1000;
    this.fire.update(t);
  }

  // ---------- layout ----------
  private layout(): void {
    const v = applyViewport(this);
    this.backdrop.setPosition(v.w / 2, v.h / 2);
    this.fire.container.setPosition(v.w / 2, L.fire.y);
    this.pickerRoot.setPosition(v.w / 2, L.picker.y);
    this.hint.setPosition(v.w / 2, L.hintY);
    this.closeBtn.setPosition(v.w - UI.pad - UI.iconButton / 2, UI.pad + UI.iconButton / 2);
    this.cookwareImg?.setPosition(v.w / 2, this.potY());
    this.layoutPotItems();
    this.layoutTray(v);
    this.resultCard?.setPosition(v.w / 2, v.h / 2 - 20);
    this.noCookwareCard?.setPosition(v.w / 2, v.h / 2);
  }
  private potY(): number {
    return L.fire.y - L.pot.yAbove;
  }
  private potCenter(): { x: number; y: number } {
    const bowl = this.cookwareId ? COOKWARE_BOWL[this.cookwareId] : { y: 0, rx: 60 };
    return { x: viewport().w / 2, y: this.potY() + bowl.y };
  }

  // ---------- cookware picker ----------
  private ownedCookware(): CookwareId[] {
    const gear = getState().inventory.gear;
    return COOKWARE.map((c) => c.id).filter((id) => gear[id]);
  }
  private buildPicker(owned: CookwareId[]): void {
    const x0 = -((owned.length - 1) * L.picker.gap) / 2;
    owned.forEach((id, i) => {
      const x = x0 + i * L.picker.gap;
      const btn = new Button(this, x, 0, '', () => this.selectCookware(id), { kind: 'icon' });
      this.pickerRoot.add(btn);
      const ring = makeImg(this, x, 0, TEX.ring).setAlpha(0);
      this.pickerRings[id] = ring;
      const im = makeImg(this, x, 0, COOKWARE_KEYS[id]);
      im.setScale(L.picker.iconScale / 2).setData('baseScale', L.picker.iconScale / 2);
      this.pickerRoot.add([ring, im]);
    });
  }
  private selectCookware(id: CookwareId): void {
    if (this.phase === 'cooking' || this.phase === 'result') return;
    if (this.cookwareId === id && this.cookwareImg) return;
    this.cookwareId = id;
    for (const [k, ring] of Object.entries(this.pickerRings)) ring?.setAlpha(k === id ? 0.9 : 0);
    const v = viewport();
    this.cookwareImg?.destroy();
    this.cookwareImg = this.add.image(v.w / 2, this.potY(), COOKWARE_KEYS[id]).setDepth(L.depth.fire + 1);
    this.cookwareImg.setScale(1 / 2).setData('baseScale', 1 / 2);
    squash(this, this.cookwareImg, 0.12);
    audio.sfx.play('tok');
    // a cookware change empties the pot (chips get their counts back)
    this.clearPot();
    this.armStir();
  }

  // ---------- basket tray ----------
  private chipDefs(): ChipDef[] {
    const inv = getState().inventory;
    const out: ChipDef[] = [];
    for (const p of Object.keys(PANTRY_BY_ID) as PantryId[]) {
      if ((inv.pantry[p] ?? 0) > 0) out.push({ kind: 'pantry', id: p, count: inv.pantry[p], label: PANTRY_BY_ID[p].name, iconKey: ING_KEYS[p] });
    }
    for (const f of Object.keys(FORAGE_BY_ID) as ForageId[]) {
      if ((inv.forage[f] ?? 0) > 0) out.push({ kind: 'forage', id: f, count: inv.forage[f], label: FORAGE_BY_ID[f].name, iconKey: ING_KEYS[f] });
    }
    const bySpecies = new Map<FishId, number>();
    for (const c of inv.fish) bySpecies.set(c.id, (bySpecies.get(c.id) ?? 0) + 1);
    for (const [id, n] of bySpecies) {
      out.push({ kind: 'fish', id, count: n, label: FISH_BY_ID[id].name, iconKey: ING_KEYS.fish, tint: hexToInt(FISH_TINT[id]) });
    }
    return out;
  }
  private buildTray(): void {
    this.tray?.destroy();
    for (const c of this.chips) c.root.destroy();
    this.chips = [];
    const defs = this.chipDefs();
    const v = viewport();
    const cols = Math.max(1, Math.min(defs.length, Math.floor((v.w - L.tray.margin * 2 - UI.pad * 2 + L.tray.gap) / (L.tray.chipW + L.tray.gap))));
    const w = Math.max(260, cols * (L.tray.chipW + L.tray.gap) - L.tray.gap + UI.pad * 2);
    this.tray = new Card(this, 0, 0, w, L.tray.h, { title: STRINGS.cooking.tray, titleSize: 20 });
    this.tray.setDepth(L.depth.chips - 1);
    for (const def of defs) this.chips.push(this.makeChip(def));
    this.layoutTray(v);
  }
  private layoutTray(v: Viewport): void {
    if (!this.tray) return;
    const ty = v.h - L.tray.margin - L.tray.h / 2;
    this.tray.setPosition(v.w / 2, ty);
    const inner = this.tray.inner();
    const cols = Math.max(1, Math.floor((inner.w + L.tray.gap) / (L.tray.chipW + L.tray.gap)));
    const rowW = Math.min(cols, this.chips.length) * (L.tray.chipW + L.tray.gap) - L.tray.gap;
    const x0 = v.w / 2 - rowW / 2 + L.tray.chipW / 2;
    const y = ty + inner.top + inner.h / 2 - 4;
    this.chips.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      c.homeX = x0 + col * (L.tray.chipW + L.tray.gap);
      c.homeY = y + row * L.tray.chipH;
      if (!c.root.getData('dragging')) c.root.setPosition(c.homeX, c.homeY);
    });
  }
  private makeChip(def: ChipDef): Chip {
    const root = this.add.container(0, 0).setDepth(L.depth.chips);
    const icon = makeImg(this, 0, -24, def.iconKey);
    if (def.tint !== undefined) icon.setTint(def.tint);
    const countText = makeText(this, 32, -40, `x${def.count}`, { size: 16, weight: 700, color: PALETTE.ink }).setOrigin(0.5);
    const label = makeText(this, 0, 4, def.label, { size: 16, weight: 600, color: PALETTE.ink, align: 'center', wrap: L.tray.chipW - 4, lineSpacing: -4 }).setOrigin(0.5, 0);
    root.add([icon, countText, label]);
    root.setSize(L.tray.chipW, L.tray.chipH);
    root.setInteractive(new Phaser.Geom.Rectangle(-L.tray.chipW / 2, -L.tray.chipH / 2, L.tray.chipW, L.tray.chipH), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(root);
    const chip: Chip = { def, root, countText, homeX: 0, homeY: 0 };
    root.on(Phaser.Input.Events.GAMEOBJECT_DRAG_START, () => {
      if (!this.canDrag(chip)) return;
      root.setData('dragging', true);
      root.setDepth(L.depth.drag);
      squash(this, root, 0.12);
      audio.sfx.play('pop', { volume: 0.5 });
      const c = this.potCenter();
      this.dropRing?.destroy();
      this.dropRing = breathingRing(this, c.x, c.y, L.pot.dropRadius * 0.7).setDepth(L.depth.fire + 2);
    });
    root.on(Phaser.Input.Events.GAMEOBJECT_DRAG, (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
      if (!root.getData('dragging')) return;
      root.setPosition(dx, dy);
    });
    root.on(Phaser.Input.Events.GAMEOBJECT_DRAG_END, () => {
      if (!root.getData('dragging')) return;
      root.setData('dragging', false);
      this.dropRing?.destroy();
      this.dropRing = undefined;
      const c = this.potCenter();
      const near = Phaser.Math.Distance.Between(root.x, root.y, c.x, c.y) <= L.pot.dropRadius;
      if (near && this.canDrag(chip)) this.addToPot(chip);
      else audio.sfx.play('nope', { volume: 0.4 });
      this.tweens.add({ targets: root, x: chip.homeX, y: chip.homeY, duration: isReduceMotion() ? 80 : 260, ease: 'Back.easeOut', onComplete: () => root.setDepth(L.depth.chips) });
    });
    return chip;
  }
  private remaining(chip: Chip): number {
    return chip.def.count - this.potItems.filter((p) => p.def.id === chip.def.id).length;
  }
  private canDrag(chip: Chip): boolean {
    return this.phase === 'pick' && this.remaining(chip) > 0 && this.potItems.length < COOKING.maxIngredients;
  }
  private refreshChips(): void {
    for (const c of this.chips) {
      const n = this.remaining(c);
      c.countText.setText(`x${n}`);
      c.root.setAlpha(n > 0 && this.potItems.length < COOKING.maxIngredients ? 1 : 0.45);
    }
  }

  // ---------- the pot ----------
  private addToPot(chip: Chip): void {
    const c = this.potCenter();
    const img = this.add.image(c.x, c.y, chip.def.iconKey).setDepth(L.depth.fire + 3);
    const b = (L.pot.slotScale) / 2;
    img.setScale(b).setData('baseScale', b).setAlpha(0);
    if (chip.def.tint !== undefined) img.setTint(chip.def.tint);
    img.setInteractive({ useHandCursor: true });
    const item: PotItem = { def: chip.def, img };
    img.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.removeFromPot(item));
    this.potItems.push(item);
    this.layoutPotItems();
    popIn(this, img);
    sparkleBurst(this, img.x, img.y, 6);
    audio.sfx.play('basketBounce');
    this.refreshChips();
    this.updateHint();
    this.armStir();
  }
  private removeFromPot(item: PotItem): void {
    if (this.phase !== 'pick') return;
    const i = this.potItems.indexOf(item);
    if (i < 0) return;
    this.potItems.splice(i, 1);
    audio.sfx.play('pop', { volume: 0.5 });
    this.tweens.add({ targets: item.img, alpha: 0, y: item.img.y + 30, duration: 200, ease: 'Sine.easeIn', onComplete: () => item.img.destroy() });
    this.layoutPotItems();
    this.refreshChips();
    this.updateHint();
    this.armStir();
  }
  private clearPot(): void {
    for (const p of this.potItems) p.img.destroy();
    this.potItems = [];
    this.refreshChips();
    this.updateHint();
  }
  private layoutPotItems(): void {
    const c = this.potCenter();
    const n = this.potItems.length;
    this.potItems.forEach((p, i) => {
      const x = c.x + (i - (n - 1) / 2) * L.pot.slotGap;
      const y = c.y - Math.abs(i - (n - 1) / 2) * 4;
      if (p.img.alpha > 0) this.tweens.add({ targets: p.img, x, y, duration: 160, ease: 'Sine.easeInOut' });
      else p.img.setPosition(x, y);
    });
  }

  // ---------- phases ----------
  private setPhase(p: Phase): void {
    this.phase = p;
    this.updateHint();
    this.refreshChips();
  }
  private updateHint(): void {
    if (this.phase === 'pick') {
      this.hint.setText(this.potItems.length >= COOKING.minIngredients ? STRINGS.cooking.hintStir : STRINGS.cooking.hintDrag);
      this.hint.setAlpha(1);
    } else {
      this.hint.setAlpha(0);
    }
  }
  private reduceMotion(): boolean {
    return isReduceMotion() || getState().settings.reduceMotion;
  }

  // ---------- stirring ----------
  private armStir(): void {
    const want = this.phase === 'pick' && this.potItems.length >= COOKING.minIngredients;
    if (!want) {
      this.stir?.stop();
      return;
    }
    if (!this.stir) {
      let lastQuarter = 0;
      this.stir = new StirGesture(this, {
        center: () => this.potCenter(),
        radius: L.pot.dropRadius,
        hold: this.reduceMotion(),
        onProgress: (t) => {
          if (!this.cookwareImg) return;
          // the pot wobbles with the finger; each quarter turn gives a little "stir" clink
          this.cookwareImg.setAngle(Math.sin(t * Math.PI * 8) * 5 * (this.reduceMotion() ? 0.3 : 1));
          const q = Math.floor(t * 8);
          if (q !== lastQuarter) {
            lastQuarter = q;
            audio.sfx.play('stir', { volume: 0.6 });
          }
          if (t >= 1 || t === 0) this.cookwareImg.setAngle(0);
        },
        onDone: () => this.startCooking(),
      });
    }
    this.stir.start();
  }

  private startCooking(): void {
    if (this.phase !== 'pick' || !this.cookwareId || !this.cookwareImg) return;
    this.setPhase('cooking');
    this.stir?.stop();
    const c = this.potCenter();
    const bowl = COOKWARE_BOWL[this.cookwareId];
    this.steamFx?.destroy();
    this.steamFx = steam(this, c.x, c.y - bowl.rx * 0.3, 1.2);
    this.steamFx.emitter.setDepth(L.depth.fire + 4);
    this.fire.setFlare(1.4);
    audio.sfx.play('sizzle', { duration: COOKING.cookMs / 1000 });
    audio.sfx.play('bubbling', { duration: COOKING.cookMs / 1000, volume: 0.7 });
    if (!this.reduceMotion()) {
      this.tweens.add({ targets: this.cookwareImg, angle: { from: -3, to: 3 }, duration: 160, yoyo: true, repeat: Math.floor(COOKING.cookMs / 320), ease: 'Sine.easeInOut' });
    }
    this.time.delayedCall(COOKING.cookMs, () => this.finishCooking());
  }

  private finishCooking(): void {
    if (!this.cookwareId) return;
    this.fire.setFlare(1);
    this.steamFx?.setIntensity(0.3);
    this.cookwareImg?.setAngle(0);
    const ids = this.potItems.map((p) => p.def.id) as IngredientId[];
    const match = matchRecipe(this.cookwareId, ids);
    // consume the actual ingredients
    for (const p of this.potItems) {
      if (p.def.kind === 'pantry') removePantry(p.def.id as PantryId);
      else if (p.def.kind === 'forage') removeForage(p.def.id as ForageId);
      else removeFish(p.def.id as FishId);
    }
    const fishId = this.potItems.find((p) => p.def.kind === 'fish')?.def.id as FishId | undefined;
    addDish({ id: match.recipeId, sell: match.sellValue, contentment: match.contentment, ...(fishId ? { fishId } : {}) });
    recordCook(match.recipeId);
    const isNew = match.isRecipe && match.recipeId !== 'mystery_mush' ? discoverRecipe(match.recipeId) : false;
    markDirty();
    for (const p of this.potItems) p.img.destroy();
    this.potItems = [];
    this.setPhase('result');
    this.showResult(match.recipeId, isNew);
  }

  // ---------- result ----------
  private showResult(dishId: DishId, isNew: boolean): void {
    const v = viewport();
    const info = dishInfo(dishId);
    const card = new Card(this, v.w / 2, v.h / 2 - 20, L.result.w, L.result.h, { grain: true });
    card.setDepth(L.depth.panel);
    this.resultCard = card;
    const inner = card.inner();
    const iconY = inner.top + 70;
    const plate = makeImg(this, 0, iconY, DISH_KEYS[dishId]);
    const b = L.result.iconScale / 2;
    plate.setScale(b).setData('baseScale', b).setAlpha(0);
    if (dishId === MYSTERY_ART.dish) card.content.add(makeGlowDisc(this, 0, iconY, L.result.iconScale * 90).setAlpha(0.5)); // the kadubu glow (mystery clue 4)
    card.content.add(plate);
    const name = makeText(this, 0, iconY + 78, info.name, { hand: true, size: 34, color: PALETTE.ink, align: 'center' }).setOrigin(0.5);
    const sub = makeText(this, 0, iconY + 112, dishId === 'mystery_mush' ? STRINGS.cooking.noMatch : info.flavor, { size: 16, color: PALETTE.bark, align: 'center', wrap: L.result.w - UI.pad * 2 }).setOrigin(0.5, 0);
    card.content.add([name, sub]);
    popIn(this, card, 300);
    this.time.delayedCall(160, () => {
      popIn(this, plate);
      sparkleBurst(this, card.x, card.y + iconY, 14);
      audio.sfx.play(dishId === 'mystery_mush' ? 'squish' : 'pop');
    });
    if (isNew) {
      const ribbon = makeImg(this, 0, inner.top - 6, TEX.ribbon);
      ribbon.setScale(1.1).setData('baseScale', 1.1);
      const rt = makeText(this, 0, inner.top - 6, STRINGS.cooking.newRecipeRibbon, { size: 18, weight: 700, color: PALETTE.cream, align: 'center' }).setOrigin(0.5);
      card.content.add([ribbon, rt]);
      ribbon.setAlpha(0);
      rt.setAlpha(0);
      this.time.delayedCall(420, () => {
        popIn(this, ribbon);
        this.tweens.add({ targets: rt, alpha: 1, duration: 200 });
        audio.sfx.play('chime');
        toast(this, fill(STRINGS.toasts.newRecipe, { Dish: info.name }));
      });
    }
    // action row
    const by = inner.bottom - UI.buttonH / 2 - 4;
    const labels: Array<{ label: string; action: CookAction; kind: 'primary' | 'secondary' }> = [
      { label: STRINGS.cooking.eat, action: 'eat', kind: 'primary' },
      { label: STRINGS.cooking.save, action: 'save', kind: 'secondary' },
    ];
    if (this.launchData.companionNear) labels.push({ label: fill(STRINGS.cooking.share), action: 'share', kind: 'secondary' });
    const btns = labels.map((l) => new Button(this, 0, by, l.label, () => this.pickAction(dishId, isNew, l.action), { kind: l.kind, minWidth: 120 }));
    const total = btns.reduce((s, b2) => s + b2.width, 0) + UI.gap * (btns.length - 1);
    let x = -total / 2;
    for (const b2 of btns) {
      b2.setPosition(x + b2.width / 2, by);
      x += b2.width + UI.gap;
      card.content.add(b2);
    }
  }

  private pickAction(dishId: DishId, isNew: boolean, action: CookAction): void {
    if (!this.resultCard) return;
    const card = this.resultCard;
    this.lastCooked = { dishId, isNew, action };
    const v = viewport();
    let note: string = STRINGS.cookingShell.saved;
    if (action === 'eat') {
      const added = eatDish(dishId) ?? 0;
      note = fill(STRINGS.cookingShell.eaten, { N: added });
      heartsFloat(this, card.x, card.y - 40, 4);
      audio.sfx.play('heart');
    } else if (action === 'share') {
      companionVisit();
      heartsFloat(this, card.x, card.y - 40, 3);
      audio.sfx.play('heart');
    } else {
      audio.sfx.play('basketBounce');
    }
    const n = text(this, card.x, card.y - L.result.h / 2 - 10, note, { hand: true, size: 26, color: PALETTE.cream, shadow: true }).setOrigin(0.5).setDepth(L.depth.panel + 1);
    floatAway(this, n, 50, 1100);
    // swap the action row for Cook more / Close
    const inner = card.inner();
    const by = inner.bottom - UI.buttonH / 2 - 4;
    card.content.each((child: Phaser.GameObjects.GameObject) => { if (child instanceof Button) child.destroy(); });
    const more = new Button(this, 0, by, STRINGS.cookingShell.cookMore, () => this.cookMore(), { kind: 'primary', minWidth: 140 });
    const close = new Button(this, 0, by, STRINGS.cookingShell.close, () => this.close(), { kind: 'secondary', minWidth: 120 });
    const total = more.width + close.width + UI.gap;
    more.setPosition(-total / 2 + more.width / 2, by);
    close.setPosition(total / 2 - close.width / 2, by);
    card.content.add([more, close]);
    card.setPosition(v.w / 2, v.h / 2 - 20);
  }

  private cookMore(): void {
    this.resultCard?.destroy();
    this.resultCard = undefined;
    this.steamFx?.destroy();
    this.steamFx = undefined;
    const owned = this.ownedCookware();
    if (owned.length === 0 || !this.cookwareId) {
      this.close();
      return;
    }
    this.buildTray();
    this.setPhase('pick');
    this.armStir();
  }

  // ---------- no cookware ----------
  private showNoCookware(): void {
    const v = viewport();
    this.hint.setAlpha(0);
    const card = new Card(this, v.w / 2, v.h / 2, 460, 200, {});
    card.setDepth(L.depth.panel);
    this.noCookwareCard = card;
    const inner = card.inner();
    const msg = makeText(this, 0, inner.top + 10, STRINGS.cooking.noCookware, { size: 20, color: PALETTE.ink, align: 'center', wrap: 460 - UI.pad * 2 }).setOrigin(0.5, 0);
    const btn = new Button(this, 0, inner.bottom - UI.buttonH / 2 - 4, STRINGS.cookingShell.close, () => this.close(), { kind: 'primary', minWidth: 140 });
    card.content.add([msg, btn]);
    popIn(this, card, 300);
  }

  // ---------- leaving ----------
  private close(): void {
    const result: CookingClosed = { cooked: this.lastCooked };
    audio.sfx.play('tok');
    const camp = this.scene.get(SCENES.camp);
    if (camp) camp.events.emit(COOKING_EVENTS.closed, result);
    this.scene.stop();
  }
}

/**
 * Boot owns initStore(); this guard only covers a direct ?scene=cooking start before Boot does it
 * (the store is a module singleton, so a second init is never needed once Boot has run).
 */
function ensureStore(): void {
  let ok = false;
  try {
    ok = !!getState()?.inventory;
  } catch {
    ok = false;
  }
  if (!ok) {
    const kind = (DEBUG.state ?? 'midtrip') as DebugStateKind;
    initStore({ debug: kind, seed: DEBUG.seed, day: DEBUG.day });
  }
}
