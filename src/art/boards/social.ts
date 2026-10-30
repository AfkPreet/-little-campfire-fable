import Phaser from 'phaser';
import { PALETTE } from '@/config/palette';
import { viewport } from '@/config/layout';
import { makeImg } from '@/art/pipeline';
import { Landscape } from '@/world/Landscape';
import { lightingAt, dayTFor } from '@/world/lighting';
import { LAYOUT, GROUND_Y } from '@/world/layout';
import { Hero } from '@/entities/Hero';
import { HUD_TEX, paintHudTextures } from '@/art/hud';
import { makeText } from '@/ui/text';
import { STRINGS, fill } from '@/data';

/** 1200x630 social image: the camp at dusk with the title. scripts/icons.mjs screenshots the whole viewport. */
export default function socialBoard(scene: Phaser.Scene): void {
  const v = viewport();
  paintHudTextures(scene);
  const land = new Landscape(scene, { parallax: false, lit: true, viewWidth: v.w });
  const L = lightingAt(dayTFor('dusk'));
  land.setLighting(L);
  land.setFireLit(true);
  // frame the fire a little right of center (the sky band follows the view left edge passed to update)
  const viewLeft = LAYOUT.fire.x - v.w * 0.58;
  land.root.setPosition(-viewLeft, 0);
  land.update(16, viewLeft, dayTFor('dusk'));
  const hero = new Hero(scene, LAYOUT.fire.x - 110, GROUND_Y);
  hero.setFacing(1).setExpression('happy');
  land.addActor(hero);
  land.sortActors();
  const cx = v.w / 2, logoY = v.h * 0.3;
  const glow = makeImg(scene, cx, logoY, HUD_TEX.titleGlow).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.75);
  glow.setScale((glow.getData('baseScale') as number) * 2.2);
  scene.add.existing(glow);
  scene.add.existing(makeText(scene, cx, logoY, fill(STRINGS.title.logo), { size: 96, weight: 700, color: PALETTE.cream, shadow: true, align: 'center' }).setOrigin(0.5));
  scene.add.existing(makeText(scene, cx, logoY + 64, fill(STRINGS.title.subtitle), { size: 36, hand: true, color: PALETTE.butter, shadow: true, align: 'center' }).setOrigin(0.5));
  scene.time.delayedCall(400, () => { window.__game.ready = true; });
}
