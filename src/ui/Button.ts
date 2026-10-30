/**
 * Button: primary (rose), secondary (cream) or icon (round cream disc). Squashes on pointerdown; the action fires on
 * pointerup inside the hit area (touch and mouse). Disabled buttons swap to the muted skin, nudge sideways and emit
 * 'ui:nope' instead of acting. Hit area is never smaller than 44x44.
 */
import Phaser from 'phaser';
import { UI, COLORS, TEX, nineButton, buttonSpec, resizeNine, makeIcon, ensureUiTextures, ART_SCALE } from './kit';
import { makeText } from './text';
import { emitUi } from './events';
import { squash, nudge, isReduceMotion } from '@/fx/juice';

export type ButtonKind = 'primary' | 'secondary' | 'icon';
export type ButtonOpts = {
  kind?: ButtonKind;
  /** visible width (text buttons) or disc diameter (icon buttons); default fits the label / UI.iconButton */
  width?: number;
  /** visible height, clamped to >= 44 (text buttons) */
  height?: number;
  /** lower bound for the fitted width (ignored when width is given) */
  minWidth?: number;
  /** kit (or any painted) texture key drawn left of the label, or centered on an icon button */
  icon?: string;
  /** label size (default 20) */
  size?: number;
};

const BTN = { labelSize: 20, padX: 24, iconGap: 8, iconLabelSize: 24, settleMs: 160 } as const;

type Skin = Phaser.GameObjects.NineSlice | Phaser.GameObjects.Image;

export class Button extends Phaser.GameObjects.Container {
  readonly kind: ButtonKind;
  private enabled = true;
  private pressed = false;
  private labelStr: string;
  private onPress: () => void;
  private readonly skinOn: Skin;
  private readonly skinOff: Skin;
  private labelText?: Phaser.GameObjects.Text;
  private iconImg?: Phaser.GameObjects.Image;
  private readonly fixedW?: number;
  private readonly minW: number;
  private readonly visH: number;

  constructor(scene: Phaser.Scene, x: number, y: number, label: string, onPress: () => void, opts: ButtonOpts = {}) {
    super(scene, x, y);
    ensureUiTextures(scene);
    this.kind = opts.kind ?? 'primary';
    this.labelStr = label;
    this.onPress = onPress;
    this.fixedW = opts.width;
    this.minW = opts.minWidth ?? 0;

    if (this.kind === 'icon') {
      const d = Math.max(UI.minTouch, opts.width ?? UI.iconButton);
      const k = d / UI.iconButton;
      this.visH = d;
      const disc = (key: string) => {
        const im = makeIcon(scene, 0, 2 * k, key);
        im.setScale(k / ART_SCALE);
        im.setData('baseScale', k / ART_SCALE);
        return im;
      };
      this.skinOn = disc(TEX.iconBtn);
      this.skinOff = disc(TEX.iconBtnDisabled);
      this.add([this.skinOn, this.skinOff]);
      if (opts.icon) {
        this.iconImg = makeIcon(scene, 0, 0, opts.icon);
        this.add(this.iconImg);
      } else {
        this.labelText = makeText(scene, 0, 0, label, { size: opts.size ?? BTN.iconLabelSize, weight: 700, align: 'center' }).setOrigin(0.5);
        this.add(this.labelText);
      }
      this.setSize(d, d);
    } else {
      const skin = this.kind;
      this.visH = Math.max(UI.minTouch, Math.round(opts.height ?? UI.buttonH));
      this.labelText = makeText(scene, 0, 0, label, {
        size: opts.size ?? BTN.labelSize,
        weight: 700,
        align: 'center',
        color: skin === 'primary' ? COLORS.primaryText : COLORS.secondaryText,
      }).setOrigin(0.5);
      if (opts.icon) this.iconImg = makeIcon(scene, 0, 0, opts.icon);
      const w = this.naturalWidth();
      this.skinOn = nineButton(scene, skin, 0, 0, w, this.visH, false);
      this.skinOff = nineButton(scene, 'disabled', 0, 0, w, this.visH, false);
      this.add([this.skinOn, this.skinOff]);
      if (this.iconImg) this.add(this.iconImg);
      this.add(this.labelText);
      this.layoutLabel(w);
      this.setSize(Math.max(UI.minTouch, w), this.visH);
    }
    this.skinOff.setVisible(false);
    this.setData('baseScale', 1);

    this.setInteractive({ useHandCursor: true });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.handleDown, this);
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.handleUp, this);
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.handleOut, this);
    scene.add.existing(this);
  }

  get label(): string {
    return this.labelStr;
  }
  get isEnabled(): boolean {
    return this.enabled;
  }
  /** Visible height (logical px). */
  get visibleHeight(): number {
    return this.visH;
  }

  private naturalWidth(): number {
    const tw = this.labelText?.width ?? 0;
    const iw = this.iconImg ? this.iconImg.displayWidth + BTN.iconGap : 0;
    const natural = Math.max(this.minW, Math.ceil(tw + iw + BTN.padX * 2));
    return Math.max(UI.minTouch, this.fixedW ?? natural);
  }

  private layoutLabel(w: number): void {
    if (!this.labelText) return;
    const tw = this.labelText.width;
    const iw = this.iconImg ? this.iconImg.displayWidth : 0;
    const total = tw + (this.iconImg ? iw + BTN.iconGap : 0);
    let cx = -total / 2;
    if (this.iconImg) {
      this.iconImg.setPosition(cx + iw / 2, 0);
      cx += iw + BTN.iconGap;
    }
    this.labelText.setPosition(cx + tw / 2, 0);
    void w;
  }

  setLabel(label: string): this {
    this.labelStr = label;
    if (!this.labelText) return this;
    this.labelText.setText(label);
    if (this.kind !== 'icon') {
      const w = this.naturalWidth();
      const on = this.skinOn as Phaser.GameObjects.NineSlice;
      const off = this.skinOff as Phaser.GameObjects.NineSlice;
      resizeNine(on, buttonSpec(this.scene, this.kind, this.visH), w, this.visH);
      resizeNine(off, buttonSpec(this.scene, 'disabled', this.visH), w, this.visH);
      this.layoutLabel(w);
      this.setSize(Math.max(UI.minTouch, w), this.visH);
    }
    return this;
  }

  setEnabled(v: boolean): this {
    if (this.enabled === v) return this;
    this.enabled = v;
    this.skinOn.setVisible(v);
    this.skinOff.setVisible(!v);
    if (this.labelText) {
      const on = this.kind === 'primary' ? COLORS.primaryText : COLORS.secondaryText;
      this.labelText.setColor(v ? on : COLORS.disabledText);
    }
    if (this.iconImg) this.iconImg.setAlpha(v ? 1 : 0.55);
    if (this.input) this.input.cursor = v ? 'pointer' : 'default';
    return this;
  }

  setOnPress(fn: () => void): this {
    this.onPress = fn;
    return this;
  }

  private handleDown(): void {
    if (!this.enabled) {
      nudge(this.scene, this);
      emitUi('ui:nope', { label: this.labelStr });
      return;
    }
    this.pressed = true;
    squash(this.scene, this);
  }

  private handleUp(): void {
    if (!this.pressed) return;
    this.pressed = false;
    emitUi('ui:press', { kind: this.kind, label: this.labelStr });
    this.onPress();
  }

  private handleOut(): void {
    if (!this.pressed) return;
    this.pressed = false;
    const b = 1;
    if (isReduceMotion()) {
      this.setScale(b);
      return;
    }
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, scaleX: b, scaleY: b, duration: BTN.settleMs, ease: 'Sine.easeOut' });
  }
}
