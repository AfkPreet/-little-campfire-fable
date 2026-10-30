import Phaser from 'phaser';
import { DEBUG } from '@/config/debug';
import { PALETTE, hexToInt } from '@/config/palette';
import { applyViewport, viewport } from '@/config/layout';

/** Scene keys. Boot decides where to go from DEBUG.scene. */
export const SCENES = {
  boot: 'Boot',
  styleboard: 'StyleBoard',
  title: 'Title',
  intro: 'Intro',
  shop: 'Shop',
  camp: 'Camp',
  hud: 'HUD',
  cooking: 'Cooking',
  journal: 'Journal',
  album: 'Album',
  daysummary: 'DaySummary',
} as const;

async function waitForFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  const wanted = ['400 16px "Baloo 2"', '600 16px "Baloo 2"', '700 16px "Baloo 2"', '400 16px "Patrick Hand"'];
  await Promise.race([
    Promise.all(wanted.map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  await document.fonts.ready;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    const v = applyViewport(this);
    this.cameras.main.setBackgroundColor(hexToInt(PALETTE.ink));
    // Tiny loading pip so the first frame is never a hard black
    const pip = this.add.circle(v.w / 2, v.h / 2, 6, hexToInt(PALETTE.glow)).setAlpha(0.8);
    this.tweens.add({ targets: pip, alpha: 0.3, scale: 1.4, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    void (async () => {
      await waitForFonts();
      const target = resolveStartScene();
      window.__game.scene = target;
      this.scene.start(target);
    })();
  }
}

function resolveStartScene(): string {
  const req = (DEBUG.scene ?? '').toLowerCase();
  const map: Record<string, string> = {
    styleboard: SCENES.styleboard,
    title: SCENES.title,
    intro: SCENES.intro,
    shop: SCENES.shop,
    camp: SCENES.camp,
    journal: SCENES.journal,
    album: SCENES.album,
  };
  if (req && map[req]) return map[req];
  // Until the Title scene exists (M1), the style board is the default.
  return SCENES.styleboard;
}

export { viewport };
