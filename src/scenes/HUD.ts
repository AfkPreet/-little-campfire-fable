/**
 * HUD: runs in parallel with Camp on a fixed camera. Money (cowrie + amount), "Day n · Phase" with a sun/moon
 * crossfade, the Contentment lantern, Backpack and Journal buttons; hosts toasts, modals and action bubbles for Camp.
 *
 * Tap isolation: on pointerdown over any HUD element `window.__game.hudPressed` is set true for one frame (Camp
 * ignores ground taps while it is set) and the DOM event's propagation is stopped where Phaser hands it over.
 */
import Phaser from 'phaser';
import { SCENES } from '@/scenes/Boot';
import { JOURNAL_EVENTS } from '@/scenes/Journal';
import { applyViewport, viewport, type Viewport } from '@/config/layout';
import { PALETTE, shade } from '@/config/palette';
import { makeImg } from '@/art/pipeline';
import { Lantern, paintHudTextures } from '@/art/hud';
import { ALBUM_TEX, paintAlbumTextures } from '@/art/album';
import { openSettings } from '@/ui/SettingsOverlay';
import { iconFor, paintItemTextures } from '@/art/items';
import { Button, Bubble, TEX, UI, makeText, makeIcon, toast as kitToast, modal as kitModal, overlay, type BubbleAction, type ModalOpts, type OverlayHandle } from '@/ui';
import { squash, isReduceMotion } from '@/fx/juice';
import { audio } from '@/audio';
import { STRINGS, fill, GEAR_BY_ID, BAIT_BY_ID, PANTRY_BY_ID, FORAGE_BY_ID, FISH_BY_ID, dishInfo, type GearId, type BaitId, type PantryId, type ForageId, type DecorId, DECOR } from '@/data';
import { getState, subscribe, tierOf, tierLabel, phaseOf, decorInBackpack, type GameState } from '@/state';
import { enterDecorMode } from '@/systems/decorMode';

const HUD = {
  margin: 16,
  depth: 500,
  moneySize: 24,
  daySize: 20,
  iconGap: 8,
  /** sun -> moon crossfade over this dayT window */
  moonFrom: 0.7,
  moonTo: 0.85,
  bounceMs: 220,
  readyMs: 300,
  backpack: { w: 440, h: 520, rowH: 56, iconSize: 40, nameSize: 18, decorateW: 112 },
  journalPause: 'journal',
  settingsPause: 'settings',
  /** menu button: top-right under the day label */
  menuY: 32 + 8 + UI.minTouch / 2,
} as const;

type Row = { key: string; name: string; count: string; decor?: DecorId };

export class HUDScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private moneyText!: Phaser.GameObjects.Text;
  private coin!: Phaser.GameObjects.Image;
  private dayText!: Phaser.GameObjects.Text;
  private sun!: Phaser.GameObjects.Image;
  private moon!: Phaser.GameObjects.Image;
  private lantern!: Lantern;
  private bubble!: Bubble;
  private lastMoney = 0;
  private lastTier = '';
  private unsubscribe: (() => void) | null = null;
  private backpackHandle: OverlayHandle | null = null;
  private settingsHandle: OverlayHandle | null = null;

  constructor() {
    super(SCENES.hud);
  }

  create(): void {
    const v = applyViewport(this);
    paintHudTextures(this);
    paintItemTextures(this);
    this.root = this.add.container(0, 0).setDepth(HUD.depth);
    this.bubble = new Bubble(this);
    this.build(v);
    const s = getState();
    this.lastMoney = s.money;
    this.lastTier = tierOf(s);
    this.refresh(s, 'init');
    this.unsubscribe = subscribe((state, tag) => this.refresh(state, tag));

    // Tap isolation for Camp (see the file comment).
    this.input.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (_p: Phaser.Input.Pointer, _o: Phaser.GameObjects.GameObject, ev?: { stopPropagation?: () => void }) => {
      window.__game.hudPressed = true;
      ev?.stopPropagation?.();
      this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => { window.__game.hudPressed = false; }));
    });

    const onViewport = (nv: Viewport) => {
      applyViewport(this);
      this.root.removeAll(true);
      this.build(nv);
      this.refresh(getState(), 'viewport');
    };
    this.game.events.on('viewport', onViewport);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('viewport', onViewport);
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.backpackHandle?.close();
      window.__game.hudPressed = false;
    });
    this.time.delayedCall(HUD.readyMs, () => { window.__game.ready = true; });
  }

  // ---------- public API for Camp ----------
  showBubble(screenX: number, screenY: number, actions: BubbleAction[]): void {
    this.bubble.show(screenX, screenY, actions);
  }
  hideBubble(): void {
    this.bubble.hide();
  }
  /** Keyboard (systems/keyboard.ts): Esc hides an open action bubble before opening the menu. */
  bubbleOpen(): boolean {
    return this.bubble.visible;
  }
  /** Open the settings menu (Esc). */
  openMenu(): void {
    this.openSettings();
  }
  toast(message: string): void {
    kitToast(this, message);
  }
  modal(opts: ModalOpts): OverlayHandle {
    return kitModal(this, opts);
  }

  // ---------- layout ----------
  private build(v: Viewport): void {
    const left = v.safe.left + HUD.margin, right = v.w - v.safe.right - HUD.margin;
    const top = v.safe.top + HUD.margin, bottom = v.h - v.safe.bottom - HUD.margin;
    const shadowText = { shadow: true, color: PALETTE.cream } as const;

    // top-left: cowrie + money
    this.coin = makeIcon(this, left + 16, top + 16, TEX.coin);
    this.moneyText = makeText(this, left + 36 + HUD.iconGap, top + 16, '', { size: HUD.moneySize, weight: 700, ...shadowText }).setOrigin(0, 0.5);
    // top-right: sun/moon + day label
    this.sun = makeIcon(this, right - 16, top + 16, TEX.sun);
    this.moon = makeIcon(this, right - 16, top + 16, TEX.moon);
    this.dayText = makeText(this, right - 36 - HUD.iconGap, top + 16, '', { size: HUD.daySize, weight: 600, align: 'right', ...shadowText }).setOrigin(1, 0.5);
    paintAlbumTextures(this);
    const menu = new Button(this, right - UI.minTouch / 2, top + HUD.menuY, STRINGS.title.settings, () => this.openSettings(), { kind: 'icon', icon: ALBUM_TEX.menu, width: UI.minTouch });
    // bottom-left: lantern
    this.lantern = new Lantern(this, left + 28, bottom - 36);
    this.lantern.setInteractive(new Phaser.Geom.Rectangle(-UI.minTouch / 2 - 4, -UI.minTouch / 2 - 10, UI.minTouch + 8, UI.minTouch + 20), Phaser.Geom.Rectangle.Contains);
    this.lantern.on(Phaser.Input.Events.POINTER_UP, () => {
      squash(this, this.lantern);
      audio.sfx.play('chime');
      this.toast(tierLabel(tierOf(getState())));
    });
    // bottom-right: backpack + journal
    const journal = new Button(this, right - UI.iconButton / 2, bottom - UI.iconButton / 2, STRINGS.hud.journal, () => this.openJournal(), { kind: 'icon', icon: TEX.journal });
    const backpack = new Button(this, right - UI.iconButton * 1.5 - UI.gap, bottom - UI.iconButton / 2, STRINGS.hud.backpack, () => this.openBackpack(), { kind: 'icon', icon: TEX.backpack });
    this.root.add([this.coin, this.moneyText, this.sun, this.moon, this.dayText, menu, this.lantern, journal, backpack]);
  }

  private refresh(s: GameState, tag: string): void {
    if (!this.moneyText.active) return;
    this.moneyText.setText(String(s.money));
    if (s.money !== this.lastMoney) {
      this.lastMoney = s.money;
      if (!isReduceMotion()) {
        squash(this, this.coin, 0.2, HUD.bounceMs);
        const base = (this.moneyText.getData('baseScale') as number | undefined) ?? 1;
        this.tweens.add({ targets: this.moneyText, scale: base * 1.15, duration: HUD.bounceMs / 2, yoyo: true, ease: 'Back.easeOut' });
      }
    }
    const phase = phaseOf(s);
    this.dayText.setText(fill(STRINGS.hud.dayLabel, { n: s.day, Phase: STRINGS.hud.timeLabels[phase] }));
    const k = Phaser.Math.Clamp((s.dayT - HUD.moonFrom) / (HUD.moonTo - HUD.moonFrom), 0, 1);
    this.sun.setAlpha(1 - k);
    this.moon.setAlpha(k);
    const tier = tierOf(s);
    if (tier !== this.lastTier || tag === 'init' || tag === 'viewport') {
      this.lastTier = tier;
      this.lantern.setTier(tier, tag !== 'init' && tag !== 'viewport' && !isReduceMotion());
    }
  }

  // ---------- journal ----------
  /** Open the Journal overlay over Camp: pause the clock and Camp/HUD taps until 'journal:closed'. */
  openJournal(): void {
    if (this.scene.isActive(SCENES.journal)) return;
    const camp = this.scene.get(SCENES.camp) as (Phaser.Scene & { pauseClock?: (r: string) => void; resumeClock?: (r: string) => void }) | null;
    const active = !!camp && camp.scene.isActive();
    if (active) {
      camp.pauseClock?.(HUD.journalPause);
      camp.input.enabled = false;
      this.input.enabled = false;
      camp.events.once(JOURNAL_EVENTS.closed, () => {
        camp.resumeClock?.(HUD.journalPause);
        camp.input.enabled = true;
        this.input.enabled = true;
      });
    }
    this.scene.launch(SCENES.journal, {});
  }

  // ---------- settings ----------
  /** The shared Settings overlay over Camp; the clock pauses while it is open. A new trip or erase goes to the Intro. */
  openSettings(): void {
    if (this.settingsHandle && !this.settingsHandle.closed) return;
    const camp = this.scene.get(SCENES.camp) as (Phaser.Scene & { pauseClock?: (r: string) => void; resumeClock?: (r: string) => void }) | null;
    const active = !!camp && camp.scene.isActive();
    if (active) camp.pauseClock?.(HUD.settingsPause);
    let leaving = false;
    this.settingsHandle = openSettings(this, {
      onClose: () => {
        this.settingsHandle = null;
        if (leaving) return;
        if (active) camp.resumeClock?.(HUD.settingsPause);
      },
      onNewTrip: () => { leaving = true; this.scene.stop(SCENES.camp); this.scene.start(SCENES.intro); },
      onErase: () => { leaving = true; this.scene.stop(SCENES.camp); this.scene.start(SCENES.title); },
    });
  }

  // ---------- backpack ----------
  openBackpack(): void {
    if (this.backpackHandle && !this.backpackHandle.closed) return;
    const v = viewport();
    const w = Math.min(HUD.backpack.w, v.w - UI.pad * 2);
    const h = Math.min(HUD.backpack.h, v.h - UI.pad * 2);
    const rows = inventoryRows(this);
    this.backpackHandle = overlay(this, {
      w, h, title: STRINGS.hud.backpack,
      onClose: () => { this.backpackHandle = null; },
      build: (card) => {
        const c = card.content;
        const left = -w / 2 + UI.pad;
        const top = -h / 2 + UI.pad + 44;
        const listH = h - UI.pad * 2 - 44 - UI.buttonH - UI.gap;
        const maxRows = Math.max(1, Math.floor(listH / HUD.backpack.rowH));
        if (rows.length === 0) {
          c.add(makeText(this, 0, top + 24, STRINGS.hudExtras.backpackEmpty, { size: HUD.backpack.nameSize, align: 'center', color: shade(PALETTE.ink, 0.2) }).setOrigin(0.5, 0));
        }
        rows.slice(0, maxRows).forEach((r, i) => {
          const y = top + i * HUD.backpack.rowH + HUD.backpack.rowH / 2;
          const ic = makeImg(this, left + HUD.backpack.iconSize / 2, y, r.key);
          const ib = ic.getData('baseScale') as number;
          ic.setScale(ib * (HUD.backpack.iconSize / Math.max(ic.width * ib, 1)));
          c.add([
            ic,
            makeText(this, left + HUD.backpack.iconSize + UI.gap, y, r.name, { size: HUD.backpack.nameSize, weight: 600, color: PALETTE.ink }).setOrigin(0, 0.5),
            makeText(this, w / 2 - UI.pad - (r.decor ? HUD.backpack.decorateW + UI.gap : 0), y, r.count, { size: HUD.backpack.nameSize, weight: 700, color: shade(PALETTE.ink, 0.1), align: 'right' }).setOrigin(1, 0.5),
          ]);
          if (r.decor) {
            const id = r.decor;
            c.add(new Button(this, w / 2 - UI.pad - HUD.backpack.decorateW / 2, y, STRINGS.decorExtras.decorate, () => { this.backpackHandle?.close(); enterDecorMode(id); }, { kind: 'secondary', width: HUD.backpack.decorateW, height: UI.pillH, size: 16 }));
          }
        });
        c.add(new Button(this, 0, h / 2 - UI.pad - UI.buttonH / 2, STRINGS.settings.cancel, () => this.backpackHandle?.close(), { kind: 'secondary', width: w - UI.pad * 2 }));
      },
    });
  }
}

/** Inventory as display rows (gear, bait, pantry, forage, fish, dishes). */
function inventoryRows(scene: Phaser.Scene): Row[] {
  const s = getState();
  const inv = s.inventory;
  const rows: Row[] = [];
  const count = (n: number) => fill(STRINGS.hudExtras.count, { Count: n });
  for (const id of Object.keys(inv.gear) as GearId[]) rows.push({ key: iconFor(scene, id, 'gear'), name: GEAR_BY_ID[id].name, count: '' });
  for (const [id, n] of Object.entries(inv.bait) as [BaitId, number][]) if (n > 0) rows.push({ key: iconFor(scene, id, 'gear'), name: BAIT_BY_ID[id].name, count: count(n) });
  for (const [id, n] of Object.entries(inv.pantry) as [PantryId, number][]) if (n > 0) rows.push({ key: iconFor(scene, id, 'forage'), name: PANTRY_BY_ID[id].name, count: count(n) });
  for (const [id, n] of Object.entries(inv.forage) as [ForageId, number][]) if (n > 0) rows.push({ key: iconFor(scene, id, 'forage'), name: FORAGE_BY_ID[id].name, count: count(n) });
  for (const f of inv.fish) rows.push({ key: iconFor(scene, f.id, 'fish'), name: fill(STRINGS.hudExtras.fishSize, { Fish: FISH_BY_ID[f.id].name, Size: f.cm }), count: '' });
  for (const d of inv.dishes) rows.push({ key: iconFor(scene, d.id, 'dish'), name: dishInfo(d.id).name, count: '' });
  for (const d of DECOR) { const n = decorInBackpack(d.id); if (n > 0) rows.push({ key: iconFor(scene, d.id), name: d.name, count: count(n), decor: d.id }); }
  return rows;
}
