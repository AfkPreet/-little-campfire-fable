/**
 * Viewport: logical height is always 720; logical width flexes with the aspect ratio.
 * The canvas backing store is CSS size x DPR (capped at 2) and every camera zooms by `zoom`
 * so world/UI code works in logical units and still renders crisp on Retina.
 */
import Phaser from 'phaser';

export const LOGICAL_H = 720;
export const DPR = Math.min(window.devicePixelRatio || 1, 2);

export type Viewport = {
  /** logical width/height for scene code */
  w: number;
  h: number;
  /** canvas backing size in device pixels */
  canvasW: number;
  canvasH: number;
  /** camera zoom that maps logical units to device pixels */
  zoom: number;
  /** safe-area insets in logical units */
  safe: { top: number; right: number; bottom: number; left: number };
};

function readSafeInset(side: 'top' | 'right' | 'bottom' | 'left'): number {
  const probe = document.getElementById('safe-probe') ?? (() => {
    const el = document.createElement('div');
    el.id = 'safe-probe';
    el.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;';
    (['top', 'right', 'bottom', 'left'] as const).forEach((s) => {
      el.style.setProperty(`padding-${s}`, `env(safe-area-inset-${s}, 0px)`);
    });
    document.body.appendChild(el);
    return el;
  })();
  const v = parseFloat(getComputedStyle(probe).getPropertyValue(`padding-${side}`)) || 0;
  return v;
}

export function measureViewport(): Viewport {
  const cssW = Math.max(320, window.innerWidth);
  const cssH = Math.max(200, window.innerHeight);
  const canvasW = Math.round(cssW * DPR);
  const canvasH = Math.round(cssH * DPR);
  const zoom = canvasH / LOGICAL_H;
  const w = canvasW / zoom;
  const toLogical = (px: number) => (px * DPR) / zoom;
  return {
    w,
    h: LOGICAL_H,
    canvasW,
    canvasH,
    zoom,
    safe: {
      top: toLogical(readSafeInset('top')),
      right: toLogical(readSafeInset('right')),
      bottom: toLogical(readSafeInset('bottom')),
      left: toLogical(readSafeInset('left')),
    },
  };
}

let current: Viewport = measureViewport();
export function viewport(): Viewport {
  return current;
}

/**
 * Apply the viewport to a scene's main camera (and any extra cameras): zoom so that logical height = 720
 * and center on the logical frame. Scrolling scenes call this then set bounds/follow themselves.
 */
export function applyViewport(scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera = scene.cameras.main): Viewport {
  const v = current;
  cam.setZoom(v.zoom);
  cam.centerOn(v.w / 2, v.h / 2);
  return v;
}

/** Call once from main.ts: keeps the game canvas sized to the window and emits 'viewport' on the game events. */
export function installViewport(game: Phaser.Game): void {
  const apply = () => {
    current = measureViewport();
    game.scale.resize(current.canvasW, current.canvasH);
    game.events.emit('viewport', current);
  };
  let raf = 0;
  const onResize = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  apply();
}
