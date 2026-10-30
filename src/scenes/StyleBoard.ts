import Phaser from 'phaser';
import { SCENES } from '@/scenes/Boot';
import { DEBUG } from '@/config/debug';

const BOARDS = import.meta.glob<{ default: (scene: Phaser.Scene) => void | Promise<void> }>('../art/boards/*.ts');
import { applyViewport } from '@/config/layout';
import { PALETTE, LIGHT_KEYS, hexToInt } from '@/config/palette';
import { paintTexture, img, blobPath, fillOutlined, kawaiiEye, blushOval, contactShadow } from '@/art/pipeline';

/**
 * M0 style board. Pages via ?board=palette|characters|landscape|ui (default palette).
 * This first version only proves the pipeline; art modules replace it as they land.
 */
export class StyleBoardScene extends Phaser.Scene {
  constructor() {
    super(SCENES.styleboard);
  }

  create(): void {
    const v = applyViewport(this);
    this.cameras.main.setBackgroundColor(hexToInt(PALETTE.cream));
    this.game.events.on('viewport', () => applyViewport(this));

    // Board pages are modules in src/art/boards/<name>.ts exporting `default(scene)`; ?board=<name> loads one.
    const board = (DEBUG.board ?? '').toLowerCase();
    const loader = BOARDS[`../art/boards/${board}.ts`];
    if (loader) {
      void loader().then((m) => {
        const r = m.default(this);
        void Promise.resolve(r).then(() => this.time.delayedCall(500, () => { window.__game.ready = true; }));
      });
      return;
    }

    // Palette swatches
    const tokens = Object.entries(PALETTE);
    const sw = 72, gap = 12, x0 = 40, y0 = 60;
    tokens.forEach(([name, hex], i) => {
      const x = x0 + (i % 7) * (sw + gap), y = y0 + Math.floor(i / 7) * (sw + 34);
      const g = this.add.graphics();
      g.fillStyle(hexToInt(hex), 1);
      g.fillRoundedRect(x, y, sw, sw, 18);
      this.add.text(x + sw / 2, y + sw + 10, name, { fontFamily: 'Baloo 2', fontSize: '15px', color: PALETTE.ink }).setOrigin(0.5, 0).setResolution(2);
    });

    // Lighting key gradients
    Object.entries(LIGHT_KEYS).forEach(([name, k], i) => {
      const x = x0 + i * (120 + gap), y = 290;
      const g = this.add.graphics();
      g.fillGradientStyle(hexToInt(k.top), hexToInt(k.top), hexToInt(k.horizon), hexToInt(k.horizon), 1);
      g.fillRoundedRect(x, y, 120, 90, 18);
      this.add.text(x + 60, y + 98, name, { fontFamily: 'Patrick Hand', fontSize: '18px', color: PALETTE.ink }).setOrigin(0.5, 0).setResolution(2);
    });

    // Pipeline proof: a painted blob critter at 2x
    paintTexture(this, 'proof-critter', 120, 120, (ctx, w, h) => {
      contactShadow(ctx, w / 2, h - 8, 40, 10, PALETTE.ink);
      blobPath(ctx, [[20, 70], [30, 30], [60, 18], [90, 30], [100, 70], [85, 105], [60, 112], [35, 105]]);
      fillOutlined(ctx, PALETTE.peach);
      kawaiiEye(ctx, 44, 62, 7, 9, PALETTE.ink, PALETTE.cream);
      kawaiiEye(ctx, 76, 62, 7, 9, PALETTE.ink, PALETTE.cream);
      blushOval(ctx, 36, 76, 9, 5, PALETTE.blush);
      blushOval(ctx, 84, 76, 9, 5, PALETTE.blush);
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(60, 76, 4, 0.2, Math.PI - 0.2);
      ctx.stroke();
    });
    img(this, v.w - 120, 160, 'proof-critter');
    this.add.text(v.w - 120, 230, 'pipeline proof (2x)', { fontFamily: 'Baloo 2', fontSize: '14px', color: PALETTE.ink }).setOrigin(0.5, 0).setResolution(2);

    this.add.text(40, 20, `Style board · ${Math.round(v.w)}x${v.h} logical · zoom ${v.zoom.toFixed(2)}`, { fontFamily: 'Baloo 2', fontSize: '18px', color: PALETTE.ink }).setResolution(2);

    this.time.delayedCall(100, () => { window.__game.ready = true; });
  }
}
