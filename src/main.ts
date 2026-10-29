import Phaser from 'phaser';
import '@fontsource/baloo-2/400.css';
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/patrick-hand/400.css';
import { installViewport, measureViewport } from '@/config/layout';
import { PALETTE, hexToInt } from '@/config/palette';
import { DEBUG } from '@/config/debug';
import { BootScene } from '@/scenes/Boot';
import { StyleBoardScene } from '@/scenes/StyleBoard';

declare global {
  interface Window {
    __game: {
      ready: boolean;
      game?: Phaser.Game;
      scene?: string;
      errors: string[];
      [k: string]: unknown;
    };
  }
}

window.__game = { ready: false, errors: [] };
window.addEventListener('error', (e) => window.__game.errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__game.errors.push(String((e as PromiseRejectionEvent).reason)));

const v = measureViewport();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: v.canvasW,
  height: v.canvasH,
  backgroundColor: hexToInt(PALETTE.ink),
  antialias: true,
  antialiasGL: true,
  pixelArt: false,
  roundPixels: false,
  powerPreference: 'high-performance',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: v.canvasW,
    height: v.canvasH,
  },
  input: { activePointers: 2, touch: { capture: true } },
  fps: { target: 60, min: 30 },
  scene: [BootScene, StyleBoardScene],
});

installViewport(game);
window.__game.game = game;
if (DEBUG.enabled) console.info('[little-campfire] debug on', DEBUG);
