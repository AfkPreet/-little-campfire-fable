/**
 * Bubble: an action bubble above an interactable (fire: Cook / Sit). A cream speech bubble with a tail whose tip sits
 * at the anchor (x, y); pill buttons inside (first action rose, the rest cream). Pops from the tail tip.
 * One bubble is visible at a time per scene: `Bubble.showAt(scene, x, y, actions)` reuses a shared instance and
 * `Bubble.hideActive(scene)` closes it (call on ground taps).
 */
import Phaser from 'phaser';
import { UI, TEX, BUBBLE_SPEC, nine, ensureUiTextures } from './kit';
import { makeImg } from '@/art/pipeline';
import { Button } from './Button';
import { emitUi } from './events';
import { popIn, isReduceMotion } from '@/fx/juice';

export type BubbleAction = { label: string; onPick: () => void };

export const BUBBLE = {
  padX: 14,
  padY: 12,
  gap: 10,
  /** tail height below the body (tip to body bottom) */
  tailH: 16,
  popMs: 220,
  hideMs: 140,
  depth: 900,
} as const;

export class Bubble extends Phaser.GameObjects.Container {
  private static active = new WeakMap<Phaser.Scene, Bubble>();
  private static shared = new WeakMap<Phaser.Scene, Bubble>();

  private shown = false;
  private panel?: Phaser.GameObjects.NineSlice;
  private tail?: Phaser.GameObjects.Image;
  private buttons: Button[] = [];

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    ensureUiTextures(scene);
    this.setDepth(BUBBLE.depth);
    this.setVisible(false);
    this.setData('baseScale', 1);
    scene.add.existing(this);
  }

  get isShown(): boolean {
    return this.shown;
  }

  /** Width of the bubble body (after show). */
  get bodyWidth(): number {
    return this.panel ? this.panel.width / 2 - BUBBLE_SPEC.margin.l - BUBBLE_SPEC.margin.r : 0;
  }

  /** Show above an anchor point: the tail tip lands on (x, y). */
  show(x: number, y: number, actions: BubbleAction[]): this {
    const prev = Bubble.active.get(this.scene);
    if (prev && prev !== (this as Bubble)) prev.hide();
    Bubble.active.set(this.scene, this);
    this.scene.tweens.killTweensOf(this);
    this.clearContent();

    const h = UI.pillH + BUBBLE.padY * 2;
    const bodyCy = -(h / 2 + BUBBLE.tailH);
    this.buttons = actions.map(
      (a, i) => new Button(this.scene, 0, bodyCy, a.label, () => this.pick(a), { kind: i === 0 ? 'primary' : 'secondary', height: UI.pillH }),
    );
    const total = this.buttons.reduce((s, b) => s + b.width, 0) + BUBBLE.gap * Math.max(0, this.buttons.length - 1);
    const w = total + BUBBLE.padX * 2;

    this.panel = nine(this.scene, BUBBLE_SPEC, 0, bodyCy, w, h, false);
    // tail texture: top edge 4 px above the body's bottom outline, tip 20 px below its top (image is 24 tall)
    this.tail = makeImg(this.scene, 0, bodyCy + h / 2 - 4 + 12, TEX.bubbleTail);
    this.add([this.panel, this.tail]);

    let cx = -total / 2;
    for (const b of this.buttons) {
      b.setPosition(cx + b.width / 2, bodyCy);
      cx += b.width + BUBBLE.gap;
      this.add(b);
    }

    this.setPosition(x, y);
    this.setVisible(true);
    this.setAlpha(0);
    this.shown = true;
    popIn(this.scene, this, BUBBLE.popMs);
    emitUi('ui:open', { what: 'bubble' });
    return this;
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    if (Bubble.active.get(this.scene) === this) Bubble.active.delete(this.scene);
    emitUi('ui:close', { what: 'bubble' });
    this.scene.tweens.killTweensOf(this);
    if (isReduceMotion()) {
      this.setVisible(false);
      return;
    }
    this.scene.tweens.add({
      targets: this,
      scaleX: 0.2,
      scaleY: 0.2,
      alpha: 0,
      duration: BUBBLE.hideMs,
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (!this.shown) this.setVisible(false);
      },
    });
  }

  private pick(a: BubbleAction): void {
    emitUi('ui:pick', { label: a.label });
    this.hide();
    a.onPick();
  }

  private clearContent(): void {
    this.removeAll(true);
    this.panel = undefined;
    this.tail = undefined;
    this.buttons = [];
  }

  /** The scene's shared bubble (created on demand). */
  static shared_(scene: Phaser.Scene): Bubble {
    let b = Bubble.shared.get(scene);
    if (!b || !b.scene) {
      b = new Bubble(scene);
      Bubble.shared.set(scene, b);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => Bubble.shared.delete(scene));
    }
    return b;
  }

  /** Show the scene's shared bubble at an anchor (hides any other visible bubble first). */
  static showAt(scene: Phaser.Scene, x: number, y: number, actions: BubbleAction[]): Bubble {
    return Bubble.shared_(scene).show(x, y, actions);
  }

  /** Hide whichever bubble is visible in the scene. */
  static hideActive(scene: Phaser.Scene): void {
    Bubble.active.get(scene)?.hide();
  }
}
