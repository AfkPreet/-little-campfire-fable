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
import { TitleScene } from '@/scenes/Title';
import { IntroScene } from '@/scenes/Intro';
import { ShopScene } from '@/scenes/Shop';
import { CampScene } from '@/scenes/Camp';
import { HUDScene } from '@/scenes/HUD';
import { CookingScene } from '@/scenes/Cooking';
import { DaySummaryScene } from '@/scenes/DaySummary';
import { JournalScene } from '@/scenes/Journal';
import { AlbumScene } from '@/scenes/Album';
import { drawRotateHero } from '@/art/rotateCard';

declare global {
  interface Window {
    __game: {
      ready: boolean;
      game?: Phaser.Game;
      scene?: string;
      errors: string[];
      /** set by the HUD on pointerdown over one of its elements; cleared after one frame (Camp ignores taps while set) */
      hudPressed?: boolean;
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
  scene: [BootScene, TitleScene, IntroScene, ShopScene, CampScene, HUDScene, CookingScene, DaySummaryScene, JournalScene, AlbumScene, StyleBoardScene],
});

installViewport(game);
drawRotateHero();
window.__game.game = game;
if (DEBUG.enabled) console.info('[little-campfire] debug on', DEBUG);
