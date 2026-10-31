/**
 * Modal: a centered Card over an ink backdrop (alpha 0.35) that swallows input behind it.
 * `overlay()` is the shared primitive (backdrop + card + viewport re-centering + close animation);
 * `modal()` fills it with a title, body text and a row of buttons. CatchCard builds on `overlay()` too.
 */
import Phaser from 'phaser';
import { viewport, type Viewport } from '@/config/layout';
import { PALETTE, hexToInt } from '@/config/palette';
import { Card } from './Card';
import { Button, type ButtonKind } from './Button';
import { UI } from './kit';
import { makeText } from './text';
import { emitUi } from './events';
import { popIn, isReduceMotion } from '@/fx/juice';

export const MODAL = {
  dim: 0.35,
  depth: 1000,
  fadeMs: 180,
  popMs: 280,
  closeMs: 160,
  maxW: 440,
  /** side margin to the viewport edge */
  margin: 24,
  bodySize: 18,
  buttonMinW: 120,
  gap: 16,
} as const;

export type OverlayOpts = {
  w: number;
  h: number;
  title?: string;
  hand?: boolean;
  /** backdrop alpha (default 0.35) */
  dim?: number;
  /** card center; default is the viewport center (re-evaluated on resize) */
  at?: (v: Viewport) => { x: number; y: number };
  what?: 'modal' | 'catch';
  /** depth of the backdrop (card sits one above); default MODAL.depth */
  depth?: number;
  /** fill the card: size it with card.resize() and add children to card.content */
  build?: (card: Card) => void;
  onClose?: () => void;
};

export type OverlayHandle = {
  card: Card;
  close: () => void;
  readonly closed: boolean;
};

/** Backdrop + card. Returns a handle whose close() animates out and destroys everything. */
/** Open overlays, oldest first (Esc closes the newest; see systems/keyboard.ts). */
const openHandles: OverlayHandle[] = [];

/** Close the most recently opened overlay or modal. Returns false when none is open. */
export function closeTopOverlay(): boolean {
  while (openHandles.length) {
    const h = openHandles[openHandles.length - 1];
    if (h.closed) { openHandles.pop(); continue; }
    h.close();
    return true;
  }
  return false;
}

export function overlay(scene: Phaser.Scene, opts: OverlayOpts): OverlayHandle {
  const what = opts.what ?? 'modal';
  const place = (v: Viewport) => opts.at?.(v) ?? { x: v.w / 2, y: v.h / 2 };
  const v0 = viewport();
  const p0 = place(v0);

  const backdrop = scene.add.rectangle(v0.w / 2, v0.h / 2, v0.w * 4, v0.h * 4, hexToInt(PALETTE.ink), opts.dim ?? MODAL.dim);
  const depth = opts.depth ?? MODAL.depth;
  backdrop.setDepth(depth).setAlpha(0).setInteractive();

  const card = new Card(scene, p0.x, p0.y, opts.w, opts.h, { title: opts.title, hand: opts.hand });
  card.setDepth(depth + 1).setAlpha(0);
  opts.build?.(card);

  scene.tweens.add({ targets: backdrop, alpha: 1, duration: MODAL.fadeMs, ease: 'Sine.easeOut' });
  popIn(scene, card, MODAL.popMs);
  emitUi('ui:open', { what });

  const onViewport = () => {
    const v = viewport();
    backdrop.setPosition(v.w / 2, v.h / 2);
    const p = place(v);
    card.setPosition(p.x, p.y);
  };
  scene.game.events.on('viewport', onViewport);

  let closed = false;
  const detach = () => {
    scene.game.events.off('viewport', onViewport);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  };
  const forget = () => {
    const k = openHandles.indexOf(handle);
    if (k >= 0) openHandles.splice(k, 1);
  };
  const onShutdown = () => {
    closed = true;
    detach();
    forget();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);

  const close = () => {
    if (closed) return;
    closed = true;
    detach();
    forget();
    backdrop.disableInteractive();
    emitUi('ui:close', { what });
    const done = () => {
      backdrop.destroy();
      card.destroy();
      opts.onClose?.();
    };
    if (isReduceMotion()) {
      done();
      return;
    }
    scene.tweens.killTweensOf([card, backdrop]);
    scene.tweens.add({ targets: backdrop, alpha: 0, duration: MODAL.closeMs, ease: 'Sine.easeIn' });
    scene.tweens.add({ targets: card, scaleX: 0.2, scaleY: 0.2, alpha: 0, duration: MODAL.closeMs, ease: 'Sine.easeIn', onComplete: done });
  };

  const handle: OverlayHandle = {
    card,
    close,
    get closed() {
      return closed;
    },
  };
  openHandles.push(handle);
  return handle;
}

export type ModalButton = { label: string; kind?: ButtonKind; onPick?: () => void };
export type ModalOpts = {
  title: string;
  body?: string;
  buttons: ModalButton[];
  /** title in the hand font */
  hand?: boolean;
  width?: number;
  dim?: number;
};

/** A centered card with title, optional body text and buttons (a row, or stacked when they do not fit). */
export function modal(scene: Phaser.Scene, opts: ModalOpts): OverlayHandle {
  const v = viewport();
  const w = Math.min(v.w - MODAL.margin * 2, opts.width ?? MODAL.maxW);
  const innerW = w - UI.pad * 2;

  let handle: OverlayHandle | undefined;
  const h = overlay(scene, {
    w,
    h: 200,
    title: opts.title,
    hand: opts.hand,
    dim: opts.dim,
    what: 'modal',
    build: (card) => {
      const body = opts.body
        ? makeText(scene, 0, 0, opts.body, { size: MODAL.bodySize, weight: 600, align: 'center', wrap: innerW }).setOrigin(0.5, 0)
        : undefined;
      const buttons = opts.buttons.map(
        (b) =>
          new Button(scene, 0, 0, b.label, () => {
            emitUi('ui:pick', { label: b.label });
            handle?.close();
            b.onPick?.();
          }, { kind: b.kind ?? 'secondary', minWidth: MODAL.buttonMinW }),
      );
      const rowW = buttons.reduce((s, b) => s + b.width, 0) + UI.gap * Math.max(0, buttons.length - 1);
      const stack = rowW > innerW;
      const btnH = buttons[0]?.visibleHeight ?? UI.buttonH;
      const buttonsH = buttons.length ? (stack ? buttons.length * btnH + UI.gap * (buttons.length - 1) : btnH) : 0;

      const inner0 = card.inner();
      const titleBlock = inner0.top - (-card.cardHeight / 2); // pad + title height + gap
      const contentH = (body ? body.height + MODAL.gap : 0) + buttonsH;
      card.resize(w, Math.ceil(titleBlock + contentH + UI.pad));

      const inner = card.inner();
      let y = inner.top;
      if (body) {
        body.setPosition(0, y);
        card.content.add(body);
        y += body.height + MODAL.gap;
      }
      if (stack) {
        for (const b of buttons) {
          b.setPosition(0, y + btnH / 2);
          card.content.add(b);
          y += btnH + UI.gap;
        }
      } else {
        let cx = -rowW / 2;
        for (const b of buttons) {
          b.setPosition(cx + b.width / 2, y + btnH / 2);
          cx += b.width + UI.gap;
          card.content.add(b);
        }
      }
    },
  });
  handle = h;
  return h;
}
