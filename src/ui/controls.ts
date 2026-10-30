/**
 * Settings controls: Slider (0..1, 44 px thumb, label), Toggle (pill switch) and Stepper (- n +).
 * Each is a Container centered on its control; labels sit above (Slider, Stepper) or to the right (Toggle).
 * State changes emit on uiEvents ('ui:slide', 'ui:toggle', 'ui:step') and call onChange.
 */
import Phaser from 'phaser';
import { UI, COLORS, TEX, TRACK_SPEC, PILL_FILL_SPEC, TOGGLE_SIZE, nine, resizeNine, ensureUiTextures } from './kit';
import { makeImg } from '@/art/pipeline';
import { makeText } from './text';
import { emitUi } from './events';
import { Button } from './Button';
import { squash, isReduceMotion } from '@/fx/juice';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// ---------- Slider ----------

export type SliderOpts = {
  label?: string;
  width?: number;
  value?: number;
  onChange?: (v: number) => void;
  /** show the percentage at the right of the label row (default on) */
  showValue?: boolean;
};

export const SLIDER = { width: 220, trackH: 10, thumb: 44, labelSize: 16, labelGap: 6, minFill: 14 } as const;

const tmpMatrix = new Phaser.GameObjects.Components.TransformMatrix();
const tmpParent = new Phaser.GameObjects.Components.TransformMatrix();
const tmpPoint = new Phaser.Math.Vector2();

export class Slider extends Phaser.GameObjects.Container {
  private val: number;
  private readonly trackW: number;
  private readonly label?: string;
  private readonly fill: Phaser.GameObjects.NineSlice;
  private readonly thumb: Phaser.GameObjects.Image;
  private readonly valueText?: Phaser.GameObjects.Text;
  private readonly onChange?: (v: number) => void;
  private dragging = false;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: SliderOpts = {}) {
    super(scene, x, y);
    ensureUiTextures(scene);
    this.trackW = opts.width ?? SLIDER.width;
    this.val = clamp01(opts.value ?? 0.5);
    this.label = opts.label;
    this.onChange = opts.onChange;
    const w = this.trackW;

    const track = nine(scene, TRACK_SPEC, 0, 0, w, SLIDER.trackH, false);
    this.fill = nine(scene, PILL_FILL_SPEC, 0, 0, w, SLIDER.trackH, false);
    this.thumb = makeImg(scene, 0, 2, TEX.knob);
    this.add([track, this.fill, this.thumb]);

    const labelY = -SLIDER.thumb / 2 - SLIDER.labelGap;
    if (opts.label) {
      this.add(makeText(scene, -w / 2, labelY, opts.label, { size: SLIDER.labelSize, weight: 700 }).setOrigin(0, 1));
    }
    if (opts.showValue !== false) {
      this.valueText = makeText(scene, w / 2, labelY, '', { size: SLIDER.labelSize, weight: 600, color: COLORS.muted, align: 'right' }).setOrigin(1, 1);
      this.add(this.valueText);
    }

    this.setSize(w + SLIDER.thumb, SLIDER.thumb);
    this.setData('baseScale', 1);
    this.setInteractive({ useHandCursor: true });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      squash(scene, this.thumb, 0.12, 160);
      this.setFromPointer(p);
    });
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
      scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    });

    this.layout();
    scene.add.existing(this);
  }

  get value(): number {
    return this.val;
  }

  setValue(v: number, silent = false): this {
    const nv = clamp01(v);
    const changed = nv !== this.val;
    this.val = nv;
    this.layout();
    if (changed && !silent) {
      emitUi('ui:slide', { value: nv, label: this.label });
      this.onChange?.(nv);
    }
    return this;
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.dragging && p.isDown) this.setFromPointer(p);
  }
  private onUp(): void {
    this.dragging = false;
  }

  private setFromPointer(p: Phaser.Input.Pointer): void {
    this.getWorldTransformMatrix(tmpMatrix, tmpParent);
    tmpMatrix.applyInverse(p.worldX, p.worldY, tmpPoint);
    this.setValue((tmpPoint.x + this.trackW / 2) / this.trackW);
  }

  private layout(): void {
    const w = this.trackW;
    const fx = -w / 2 + this.val * w;
    const fillW = Math.max(SLIDER.minFill, this.val * w);
    this.fill.setVisible(this.val * w >= SLIDER.minFill * 0.5);
    resizeNine(this.fill, PILL_FILL_SPEC, fillW, SLIDER.trackH);
    this.fill.setPosition(-w / 2 + fillW / 2, 0);
    this.thumb.setPosition(fx, 2);
    this.valueText?.setText(`${Math.round(this.val * 100)}%`);
  }
}

// ---------- Toggle ----------

export type ToggleOpts = { label?: string; value?: boolean; onChange?: (v: boolean) => void };

export const TOGGLE = { labelSize: 18, labelGap: 12, moveMs: 200, hitPad: 6 } as const;

export class Toggle extends Phaser.GameObjects.Container {
  private val: boolean;
  private readonly label?: string;
  private readonly onChange?: (v: boolean) => void;
  private readonly trackOn: Phaser.GameObjects.Image;
  private readonly knob: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ToggleOpts = {}) {
    super(scene, x, y);
    ensureUiTextures(scene);
    this.val = opts.value ?? false;
    this.label = opts.label;
    this.onChange = opts.onChange;
    const T = TOGGLE_SIZE;

    const trackOff = makeImg(scene, 0, 2, TEX.toggleOff);
    this.trackOn = makeImg(scene, 0, 2, TEX.toggleOn);
    this.knob = makeImg(scene, this.val ? T.travel : -T.travel, 2, TEX.knobSmall);
    this.trackOn.setAlpha(this.val ? 1 : 0);
    this.add([trackOff, this.trackOn, this.knob]);

    let hitW = T.w + TOGGLE.hitPad * 2;
    if (opts.label) {
      const t = makeText(scene, T.w / 2 + TOGGLE.labelGap, 0, opts.label, { size: TOGGLE.labelSize, weight: 700 }).setOrigin(0, 0.5);
      this.add(t);
      hitW += TOGGLE.labelGap + t.width;
    }
    // hit area: the pill plus the label, so the label is tappable too (rect is in top-left space, see Container origin)
    const hitH = Math.max(UI.minTouch, T.h + TOGGLE.hitPad * 2);
    this.setSize(T.w + TOGGLE.hitPad * 2, hitH);
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, hitW, hitH), Phaser.Geom.Rectangle.Contains);
    this.setData('baseScale', 1);
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.setValue(!this.val));
    scene.add.existing(this);
  }

  get value(): boolean {
    return this.val;
  }

  setValue(v: boolean, silent = false): this {
    const changed = v !== this.val;
    this.val = v;
    const T = TOGGLE_SIZE;
    const kx = v ? T.travel : -T.travel;
    this.scene.tweens.killTweensOf([this.knob, this.trackOn]);
    if (isReduceMotion() || !changed) {
      this.knob.setPosition(kx, 2);
      this.trackOn.setAlpha(v ? 1 : 0);
    } else {
      this.scene.tweens.add({ targets: this.knob, x: kx, duration: TOGGLE.moveMs, ease: 'Back.easeOut' });
      this.scene.tweens.add({ targets: this.trackOn, alpha: v ? 1 : 0, duration: TOGGLE.moveMs, ease: 'Sine.easeInOut' });
      squash(this.scene, this.knob, 0.12, 160);
    }
    if (changed && !silent) {
      emitUi('ui:toggle', { value: v, label: this.label });
      this.onChange?.(v);
    }
    return this;
  }
}

// ---------- Stepper ----------

export type StepperOpts = {
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  label?: string;
  onChange?: (v: number) => void;
  format?: (v: number) => string;
};

export const STEPPER = { valueW: 64, gap: 10, valueSize: 24, labelSize: 16, labelGap: 6 } as const;

export class Stepper extends Phaser.GameObjects.Container {
  private val: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  private readonly onChange?: (v: number) => void;
  private readonly format: (v: number) => string;
  private readonly valueText: Phaser.GameObjects.Text;
  readonly minus: Button;
  readonly plus: Button;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: StepperOpts = {}) {
    super(scene, x, y);
    ensureUiTextures(scene);
    this.min = opts.min ?? 0;
    this.max = opts.max ?? 99;
    this.step = opts.step ?? 1;
    this.val = Math.min(this.max, Math.max(this.min, opts.value ?? this.min));
    this.onChange = opts.onChange;
    this.format = opts.format ?? ((v) => String(v));

    const bx = STEPPER.valueW / 2 + STEPPER.gap + UI.iconButton / 2;
    this.minus = new Button(scene, -bx, 0, '-', () => this.change(-1), { kind: 'icon', icon: TEX.minus });
    this.plus = new Button(scene, bx, 0, '+', () => this.change(1), { kind: 'icon', icon: TEX.plus });
    this.valueText = makeText(scene, 0, 0, this.format(this.val), { size: STEPPER.valueSize, weight: 700, align: 'center' }).setOrigin(0.5);
    this.add([this.minus, this.plus, this.valueText]);

    if (opts.label) {
      this.add(makeText(scene, 0, -UI.iconButton / 2 - STEPPER.labelGap, opts.label, { size: STEPPER.labelSize, weight: 700, align: 'center' }).setOrigin(0.5, 1));
    }

    this.setSize(bx * 2 + UI.iconButton, UI.iconButton);
    this.setData('baseScale', 1);
    this.refresh();
    scene.add.existing(this);
  }

  get value(): number {
    return this.val;
  }

  setValue(v: number, silent = false): this {
    const nv = Math.min(this.max, Math.max(this.min, v));
    const changed = nv !== this.val;
    this.val = nv;
    this.refresh();
    if (changed) {
      squash(this.scene, this.valueText, 0.12, 160);
      if (!silent) {
        emitUi('ui:step', { value: nv });
        this.onChange?.(nv);
      }
    }
    return this;
  }

  private change(dir: number): void {
    this.setValue(this.val + dir * this.step);
  }

  private refresh(): void {
    this.valueText.setText(this.format(this.val));
    this.minus.setEnabled(this.val > this.min);
    this.plus.setEnabled(this.val < this.max);
  }
}
