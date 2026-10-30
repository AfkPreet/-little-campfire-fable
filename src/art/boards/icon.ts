import Phaser from 'phaser';
import { PALETTE, LIGHT_KEYS, hexToInt, mix } from '@/config/palette';
import { paintTexture, img, linearGradient } from '@/art/pipeline';
import { paintHeroTextures } from '@/art/hero';
import { Hero } from '@/entities/Hero';

/** App icon composition at logical (0,0)-(256,256): dusk gradient, a soft ground arc, Chikki's happy face. scripts/icons.mjs clips it. */
export default function iconBoard(scene: Phaser.Scene): void {
  const S = 256;
  scene.cameras.main.setBackgroundColor(hexToInt(LIGHT_KEYS.dusk.top));
  paintHeroTextures(scene);
  paintTexture(scene, 'icon-bg', S, S, (ctx, w, h) => {
    ctx.fillStyle = linearGradient(ctx, 0, 0, 0, h, [[0, LIGHT_KEYS.dusk.top], [0.7, LIGHT_KEYS.dusk.horizon], [1, mix(LIGHT_KEYS.dusk.horizon, PALETTE.butter, 0.4)]]);
    ctx.fillRect(0, 0, w, h);
    // ground arc
    ctx.fillStyle = mix(PALETTE.sage, LIGHT_KEYS.dusk.horizon, 0.3);
    ctx.beginPath();
    ctx.ellipse(w / 2, h + 40, w * 0.75, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    // a few soft stars
    ctx.fillStyle = mix(PALETTE.cream, LIGHT_KEYS.dusk.top, 0.2);
    for (const [x, y, r] of [[30, 40, 3], [210, 28, 2.5], [238, 90, 2], [60, 110, 1.8], [190, 70, 1.6]] as const) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  });
  img(scene, S / 2, S / 2, 'icon-bg');
  const hero = new Hero(scene, S / 2 - 16, S + 46);
  hero.setScale(2.4);
  hero.setFacing(1).setExpression('happy');
  scene.add.existing(hero);
  scene.time.delayedCall(300, () => { window.__game.ready = true; });
}
