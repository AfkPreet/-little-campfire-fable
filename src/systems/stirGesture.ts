/**
 * stirGesture.ts: the stir input for the Cooking overlay (spec section 5 "Cooking").
 * Circle mode: the pointer is dragged around the pot center; the angle swept (either direction) accumulates until
 * `circles` full turns (2 * PI each). Hold mode (Reduce motion): press within the pot and hold `holdMs`.
 * Pure input tracking; the scene draws the feedback from onProgress.
 */
import Phaser from 'phaser';
import { COOKING } from '@/data/world';

export type StirOpts = {
  /** pot center in scene coordinates (re-read each event, so a function works for moving pots) */
  center: () => { x: number; y: number };
  /** pointer must start within this radius of the center (px) */
  radius: number;
  /** full circles needed (default COOKING.stirCircles) */
  circles?: number;
  /** hold instead of circling (Reduce motion); duration default COOKING.stirHoldMs */
  hold?: boolean;
  holdMs?: number;
  /** 0..1 as the stir progresses (called on every change) */
  onProgress?: (t: number) => void;
  onDone: () => void;
};

export class StirGesture {
  private readonly scene: Phaser.Scene;
  private readonly opts: StirOpts;
  private enabled = false;
  private active = false;
  private done = false;
  private lastAngle = 0;
  private swept = 0;
  private holdStart = 0;
  private holdTimer?: Phaser.Time.TimerEvent;
  private readonly onDown: (p: Phaser.Input.Pointer) => void;
  private readonly onMove: (p: Phaser.Input.Pointer) => void;
  private readonly onUp: () => void;

  constructor(scene: Phaser.Scene, opts: StirOpts) {
    this.scene = scene;
    this.opts = opts;
    this.onDown = (p) => this.pointerDown(p);
    this.onMove = (p) => this.pointerMove(p);
    this.onUp = () => this.pointerUp();
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get progress(): number {
    if (this.opts.hold) {
      if (!this.active) return 0;
      return Phaser.Math.Clamp((this.scene.time.now - this.holdStart) / (this.opts.holdMs ?? COOKING.stirHoldMs), 0, 1);
    }
    return Phaser.Math.Clamp(Math.abs(this.swept) / this.target(), 0, 1);
  }

  /** Arm the gesture (idempotent). Progress restarts from zero. */
  start(): void {
    this.enabled = true;
    this.done = false;
    this.swept = 0;
    this.active = false;
  }
  stop(): void {
    this.enabled = false;
    this.active = false;
    this.holdTimer?.remove();
    this.holdTimer = undefined;
  }
  destroy(): void {
    this.stop();
    const i = this.scene.input;
    i.off(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    i.off(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    i.off(Phaser.Input.Events.POINTER_UP, this.onUp);
    i.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp);
  }

  private target(): number {
    return (this.opts.circles ?? COOKING.stirCircles) * Math.PI * 2;
  }
  private within(p: Phaser.Input.Pointer): boolean {
    const c = this.opts.center();
    return Phaser.Math.Distance.Between(p.x, p.y, c.x, c.y) <= this.opts.radius;
  }
  private pointerDown(p: Phaser.Input.Pointer): void {
    if (!this.enabled || this.done || !this.within(p)) return;
    this.active = true;
    const c = this.opts.center();
    this.lastAngle = Math.atan2(p.y - c.y, p.x - c.x);
    if (this.opts.hold) {
      this.holdStart = this.scene.time.now;
      this.holdTimer?.remove();
      this.holdTimer = this.scene.time.addEvent({
        delay: 50, loop: true,
        callback: () => {
          if (!this.active) return;
          this.opts.onProgress?.(this.progress);
          if (this.progress >= 1) this.finish();
        },
      });
    }
  }
  private pointerMove(p: Phaser.Input.Pointer): void {
    if (!this.active || this.done || this.opts.hold) return;
    const c = this.opts.center();
    const a = Math.atan2(p.y - c.y, p.x - c.x);
    const d = Phaser.Math.Angle.Wrap(a - this.lastAngle);
    this.lastAngle = a;
    // Direction changes cancel out, so a back-and-forth wiggle never counts as a circle.
    this.swept += d;
    this.opts.onProgress?.(this.progress);
    if (Math.abs(this.swept) >= this.target()) this.finish();
  }
  private pointerUp(): void {
    if (!this.active) return;
    this.active = false;
    this.holdTimer?.remove();
    this.holdTimer = undefined;
    if (this.opts.hold && !this.done) this.opts.onProgress?.(0);
  }
  private finish(): void {
    this.done = true;
    this.active = false;
    this.holdTimer?.remove();
    this.holdTimer = undefined;
    this.opts.onProgress?.(1);
    this.opts.onDone();
  }
}
