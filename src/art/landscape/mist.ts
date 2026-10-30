/**
 * Mist band: a soft cream horizontal blob, seamless across 512 px, tinted with `lighting.mistColor` and faded with
 * `lighting.mist`. Two bands drift between the ridges and at the estate base; a third swallows the slope in mist weather.
 */
import Phaser from 'phaser';
import { PALETTE, alpha } from '@/config/palette';
import { paintTexture, radialGradient, type Ctx } from '@/art/pipeline';
import { seeded, wrapped } from './common';

export const MIST_KEY = 'mist-band';
export const MIST_W = 512;
export const MIST_H = 110;

function paintMist(ctx: Ctx, w: number, h: number): void {
  const rnd = seeded(77);
  wrapped(ctx, w, h, (ctx) => {
    // overlapping lumpy ellipses, each a soft radial falloff; denser along the middle line
    for (let i = 0; i < 14; i++) {
      const cx = rnd() * w;
      const cy = h * (0.35 + rnd() * 0.3);
      const rx = 70 + rnd() * 110, ry = 18 + rnd() * 22;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      ctx.fillStyle = radialGradient(ctx, 0, 0, 0, rx, [
        [0, alpha(PALETTE.cream, 0.5)],
        [0.5, alpha(PALETTE.cream, 0.22)],
        [1, alpha(PALETTE.cream, 0)],
      ]);
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}

export function paintMistBand(scene: Phaser.Scene): void {
  paintTexture(scene, MIST_KEY, MIST_W, MIST_H, paintMist);
}
