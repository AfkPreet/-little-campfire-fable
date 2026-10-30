/**
 * Toast: a cream pill at top-center (below the safe area). Pops in (Back.easeOut), holds 2.5 s, fades.
 * Toasts queue per scene so they never overlap, and re-center on the game 'viewport' event.
 * Toasts live in the calling scene's camera space; fire them from the HUD scene in the game.
 */
import Phaser from 'phaser';
import { viewport } from '@/config/layout';
import { ninePill, UI, ensureUiTextures } from './kit';
import { makeText } from './text';
import { emitUi } from './events';
import { popIn, isReduceMotion } from '@/fx/juice';

export const TOAST = {
  holdMs: 2500,
  popMs: 260,
  fadeMs: 240,
  /** pause between queued toasts */
  gapMs: 120,
  /** gap below the safe-area top */
  topGap: 14,
  padX: 22,
  textSize: 18,
  depth: 1200,
} as const;

type Queue = {
  items: string[];
  showing: boolean;
  current?: Phaser.GameObjects.Container;
  onViewport: () => void;
};

const queues = new WeakMap<Phaser.Scene, Queue>();

function toastX(): number {
  return viewport().w / 2;
}
function toastY(): number {
  return viewport().safe.top + TOAST.topGap + UI.pillH / 2;
}

function queueFor(scene: Phaser.Scene): Queue {
  let q = queues.get(scene);
  if (q) return q;
  const made: Queue = {
    items: [],
    showing: false,
    onViewport: () => {
      made.current?.setPosition(toastX(), toastY());
    },
  };
  q = made;
  scene.game.events.on('viewport', q.onViewport);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.game.events.off('viewport', made.onViewport);
    queues.delete(scene);
  });
  queues.set(scene, q);
  return q;
}

function build(scene: Phaser.Scene, message: string): Phaser.GameObjects.Container {
  const label = makeText(scene, 0, 0, message, { size: TOAST.textSize, weight: 600, align: 'center' }).setOrigin(0.5);
  const w = Math.ceil(label.width + TOAST.padX * 2);
  const pill = ninePill(scene, 0, 0, w, false);
  const c = new Phaser.GameObjects.Container(scene, toastX(), toastY(), [pill, label]);
  c.setDepth(TOAST.depth);
  c.setData('baseScale', 1);
  c.setAlpha(0);
  scene.add.existing(c);
  return c;
}

function next(scene: Phaser.Scene, q: Queue): void {
  const msg = q.items.shift();
  if (msg === undefined) {
    q.showing = false;
    return;
  }
  q.showing = true;
  const c = build(scene, msg);
  q.current = c;
  emitUi('ui:toast', { message: msg });
  popIn(scene, c, TOAST.popMs);
  scene.time.delayedCall(TOAST.popMs + TOAST.holdMs, () => {
    const lift = isReduceMotion() ? 0 : 10;
    scene.tweens.add({
      targets: c,
      alpha: 0,
      y: c.y - lift,
      duration: TOAST.fadeMs,
      ease: 'Sine.easeIn',
      onComplete: () => {
        c.destroy();
        if (q.current === c) q.current = undefined;
        scene.time.delayedCall(TOAST.gapMs, () => next(scene, q));
      },
    });
  });
}

/** Show a toast (queued; never overlaps another toast in the same scene). */
export function toast(scene: Phaser.Scene, message: string): void {
  ensureUiTextures(scene);
  const q = queueFor(scene);
  q.items.push(message);
  if (!q.showing) next(scene, q);
}

/** Drop queued toasts (the one on screen finishes). */
export function clearToasts(scene: Phaser.Scene): void {
  const q = queues.get(scene);
  if (q) q.items.length = 0;
}
