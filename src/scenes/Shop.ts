import Phaser from 'phaser';
import { SCENES } from '@/scenes/Boot';
import { applyViewport } from '@/config/layout';

/** Placeholder; replaced by the M1 implementation. */
export class ShopScene extends Phaser.Scene {
  constructor() {
    super(SCENES.shop);
  }
  create(): void {
    applyViewport(this);
    this.time.delayedCall(100, () => { window.__game.ready = true; });
  }
}
