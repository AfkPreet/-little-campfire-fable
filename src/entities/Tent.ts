/**
 * Tent entity: the pitchable tent rig (floor, pegs, poles, canopy, window glow, door) built from art/props/tent.ts.
 * Pitching: layFlat() -> peg(i) x4 -> springUp(). Owns no game state; tentFlow drives it from the store.
 */
import Phaser from 'phaser';
import { makeTent, TENT_SIZES, type TentKind, type TentRig } from '@/art/props/tent';
import type { TentId } from '@/data/types';
import type { XY } from '@/world/layout';
import { isReduceMotion, nudge, squash } from '@/fx/juice';
import { sparkleBurst } from '@/fx/particles';
import { audio } from '@/audio';

export const TENT_KIND_OF: Record<TentId, TentKind> = {
  tent_leaf: 'teak',
  tent_dome: 'dome',
  tent_cabin: 'homestay',
};

/** Motion tuning for the pitch sequence. */
export const TENT_MOTION = {
  flatScaleY: 0.06,
  flatAlpha: 0.9,
  springMs: 520,
  overshootY: 1.15,
  overshootX: 0.92,
  pegPopScale: 1.3,
  pegPopMs: 160,
  glowFadeMs: 900,
  /** door offset from the tent center (hero sits here to rest) */
  doorOffsetX: 0.28,
} as const;

export class Tent extends Phaser.GameObjects.Container {
  readonly rig: TentRig;
  readonly kind: TentKind;
  readonly tentId: TentId;
  readonly size: { w: number; h: number };
  private flat = false;
  private readonly shell: Phaser.GameObjects.Image[];

  constructor(scene: Phaser.Scene, tentId: TentId, x: number, y: number) {
    super(scene, x, y);
    this.tentId = tentId;
    this.kind = TENT_KIND_OF[tentId];
    this.size = TENT_SIZES[this.kind];
    this.rig = makeTent(scene, this.kind, 0, 0);
    this.add(this.rig.container);
    const P = this.rig.parts;
    this.shell = [P.poles, P.canopy, P.door, ...(P.window ? [P.window] : []), ...(P.windowGlow ? [P.windowGlow] : [])];
    this.setData('baseScale', 1);
    scene.add.existing(this);
  }

  /** The tent lies flat on the ground, pegs showing, waiting to be tapped. */
  layFlat(): this {
    this.flat = true;
    for (const b of this.shell) {
      b.setData('flatBase', b.scaleY);
      b.setScale(b.scaleX, b.scaleY * TENT_MOTION.flatScaleY).setAlpha(TENT_MOTION.flatAlpha);
    }
    this.rig.parts.pegs.forEach((p) => p.setAlpha(1));
    return this;
  }

  get isFlat(): boolean {
    return this.flat;
  }

  /** World position of peg i (0-3). */
  pegPoint(i: number): XY {
    const p = this.rig.parts.pegs[i];
    return { x: this.x + p.x, y: this.y + p.y };
  }

  /** Peg i tapped: tok + star pop + nudge. */
  peg(i: number): void {
    const p = this.rig.parts.pegs[i];
    if (!p) return;
    audio.sfx.play('tok');
    squash(this.scene, p, TENT_MOTION.pegPopScale - 1, TENT_MOTION.pegPopMs);
    nudge(this.scene, p);
    const wp = this.pegPoint(i);
    sparkleBurst(this.scene, wp.x, wp.y - 10, 6);
  }

  /** The tent springs up from flat with a squash and stretch; resolves when settled. */
  springUp(): Promise<void> {
    this.flat = false;
    audio.sfx.play('tentSpring');
    const reduce = isReduceMotion();
    return new Promise((resolve) => {
      let left = this.shell.length;
      const done = () => { if (--left <= 0) resolve(); };
      for (const b of this.shell) {
        const base = (b.getData('flatBase') as number | undefined) ?? b.scaleY;
        const bx = b.scaleX;
        if (reduce) { b.setScale(bx, base).setAlpha(1); done(); continue; }
        this.scene.tweens.chain({
          targets: b,
          tweens: [
            { scaleY: base * TENT_MOTION.overshootY, scaleX: bx * TENT_MOTION.overshootX, alpha: 1, duration: TENT_MOTION.springMs * 0.6, ease: 'Back.easeOut' },
            { scaleY: base, scaleX: bx, duration: TENT_MOTION.springMs * 0.4, ease: 'Sine.easeInOut' },
          ],
          onComplete: done,
        });
      }
    });
  }

  /** Window glow on at night (dome and homestay have windows). */
  setNight(night: boolean): void {
    const glow = this.rig.parts.windowGlow;
    const target = night ? 1 : 0;
    if (!glow) { this.rig.setWindowGlow(target); return; }
    const cur = (this.getData('glowK') as number | undefined) ?? 0;
    if (cur === target) return;
    this.setData('glowK', target);
    if (isReduceMotion()) { this.rig.setWindowGlow(target); return; }
    this.scene.tweens.addCounter({
      from: cur, to: target, duration: TENT_MOTION.glowFadeMs, ease: 'Sine.easeInOut',
      onUpdate: (tw) => this.rig.setWindowGlow(tw.getValue() ?? target),
    });
  }

  /** Decor hang points in world coordinates. */
  hangPoints(): XY[] {
    return this.rig.hangPoints().map((p) => ({ x: this.x + p.x, y: this.y + p.y }));
  }

  /** Where the hero stands/sits in the doorway. */
  doorPoint(): XY {
    return { x: this.x + this.size.w * TENT_MOTION.doorOffsetX, y: this.y };
  }

  /** Hit rectangle for the Rest / Sleep interactable (centered on x, bottom at y). */
  hitZone(): { x: number; y: number; w: number; h: number } {
    return { x: this.x, y: this.y, w: this.size.w, h: this.size.h };
  }
}
