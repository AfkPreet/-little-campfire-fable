/** TabBar: a row of pill tabs (44 px+), one selected. Squishes on press. */
import Phaser from 'phaser';
import { UI, COLORS, buttonSpec, nine, resizeNine, type NineSpec } from './kit';
import { makeText } from './text';
import { squash } from '@/fx/juice';
import { emitUi, UI_EVENTS } from './events';

export type TabDef<T extends string> = { id: T; label: string };
export type TabBarOpts = { width: number; height?: number; gap?: number; size?: number };

const TAB = { h: 46, gap: 8, size: 18, minW: 44 } as const;

type TabView<T extends string> = {
  id: T;
  root: Phaser.GameObjects.Container;
  on: Phaser.GameObjects.NineSlice;
  off: Phaser.GameObjects.NineSlice;
  label: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Zone;
};

export class TabBar<T extends string> extends Phaser.GameObjects.Container {
  private views: TabView<T>[] = [];
  private selectedId: T;
  private readonly onSelect: (id: T) => void;
  private readonly h: number;
  private readonly gap: number;
  private readonly specOn: NineSpec;
  private readonly specOff: NineSpec;
  private barW: number;

  constructor(scene: Phaser.Scene, x: number, y: number, tabs: readonly TabDef<T>[], selected: T, onSelect: (id: T) => void, opts: TabBarOpts) {
    super(scene, x, y);
    this.onSelect = onSelect;
    this.selectedId = selected;
    this.h = Math.max(UI.minTouch, opts.height ?? TAB.h);
    this.gap = opts.gap ?? TAB.gap;
    this.barW = opts.width;
    this.specOn = buttonSpec(scene, 'primary', this.h);
    this.specOff = buttonSpec(scene, 'secondary', this.h);
    const size = opts.size ?? TAB.size;

    for (const t of tabs) {
      const root = scene.make.container({ x: 0, y: 0, add: false });
      const on = nine(scene, this.specOn, 0, 0, TAB.minW, this.h, false);
      const off = nine(scene, this.specOff, 0, 0, TAB.minW, this.h, false);
      const label = makeText(scene, 0, -1, t.label, { size, weight: 700, align: 'center' }).setOrigin(0.5);
      const hit = scene.make.zone({ x: 0, y: 0, width: TAB.minW, height: this.h, add: false });
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        squash(scene, root, 0.1, 140);
        emitUi(UI_EVENTS.press, { kind: 'secondary', label: t.label });
      });
      hit.on('pointerup', () => this.select(t.id));
      root.add([off, on, label, hit]);
      root.setData('baseScale', 1);
      this.add(root);
      this.views.push({ id: t.id, root, on, off, label, hit });
    }
    this.layout(this.barW);
    this.applySelection();
    scene.add.existing(this);
  }

  get selected(): T {
    return this.selectedId;
  }

  /** Distribute tabs evenly across `width` (centered on the container x). */
  layout(width: number): void {
    this.barW = width;
    const n = this.views.length;
    const w = Math.max(TAB.minW, (width - this.gap * (n - 1)) / n);
    const x0 = -width / 2 + w / 2;
    this.views.forEach((v, i) => {
      v.root.setPosition(x0 + i * (w + this.gap), 0);
      resizeNine(v.on, this.specOn, w, this.h);
      resizeNine(v.off, this.specOff, w, this.h);
      v.hit.setSize(w, this.h);
      const area = v.hit.input?.hitArea as Phaser.Geom.Rectangle | undefined;
      area?.setTo(0, 0, w, this.h);
      v.label.setWordWrapWidth(w - 8);
    });
    this.setSize(width, this.h);
  }

  select(id: T, silent = false): void {
    if (id === this.selectedId) return;
    this.selectedId = id;
    this.applySelection();
    if (!silent) this.onSelect(id);
  }

  private applySelection(): void {
    for (const v of this.views) {
      const sel = v.id === this.selectedId;
      v.on.setVisible(sel);
      v.off.setVisible(!sel);
      v.label.setColor(sel ? COLORS.primaryText : COLORS.secondaryText);
    }
  }
}
