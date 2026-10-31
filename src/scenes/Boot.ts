/**
 * Boot: fonts, every texture family painted once, the store (save, or ?state= fixture), autosave, audio unlock,
 * the UI->audio glue and (in dev) the data validation report. Then the ?scene= target or the Title.
 */
import Phaser from 'phaser';
import { DEBUG, trackScenes } from '@/config/debug';
import { PALETTE, hexToInt } from '@/config/palette';
import { applyViewport, viewport } from '@/config/layout';
import { paintHeroTextures } from '@/art/hero';
import { paintCompanionTextures } from '@/art/companion';
import { paintShopkeeperTextures } from '@/art/shopkeeper';
import { paintGuardianTextures } from '@/art/guardian';
import { paintItemTextures } from '@/art/items';
import { paintFish } from '@/art/fish';
import { paintFishingTextures } from '@/art/fishing';
import { paintHudTextures } from '@/art/hud';
import { paintIntroTextures } from '@/art/intro';
import { ensureUiTextures } from '@/ui/kit';
import { setTextScale } from '@/ui/text';
import { paintFxTextures } from '@/fx/textures';
import { setReduceMotion } from '@/fx/juice';
import { audio } from '@/audio';
import { installAudioGlue } from '@/audio/glue';
import { validateData } from '@/data';
import { initStore, installAutosave, getState, type DebugStateKind } from '@/state';

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

const FONT_TIMEOUT_MS = 2500;
const DEBUG_STATES: readonly DebugStateKind[] = ['fresh', 'midtrip', 'finale'];

async function waitForFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  const wanted = ['400 16px "Baloo 2"', '600 16px "Baloo 2"', '700 16px "Baloo 2"', '400 16px "Patrick Hand"'];
  await Promise.race([
    Promise.all(wanted.map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, FONT_TIMEOUT_MS)),
  ]);
  await document.fonts.ready;
}

/** Push the saved settings into the subsystems that read them (volumes, motion, text size). */
export function applySettings(): void {
  const s = getState().settings;
  audio.engine.setVolumes({ music: s.music, sfx: s.sounds, ambience: s.ambience });
  setReduceMotion(s.reduceMotion || DEBUG.reduceMotion);
  setTextScale(s.largeText ? LARGE_TEXT_SCALE : 1);
}
export const LARGE_TEXT_SCALE = 1.2;

let booted = false;

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
      this.paintAll();
      if (!booted) {
        booted = true;
        const debug = DEBUG.state && (DEBUG_STATES as readonly string[]).includes(DEBUG.state) ? (DEBUG.state as DebugStateKind) : undefined;
        initStore({ debug, seed: DEBUG.seed, day: DEBUG.day });
        trackScenes(this.game);
        installAutosave(window);
        if (!DEBUG.noAudio) audio.unlockOnFirstGesture(window);
        installAudioGlue();
        applySettings();
        if (DEBUG.enabled) {
          const report = validateData();
          if (report.ok) console.info('[little-campfire] data ok (%d checks)', report.rows.length);
          else console.warn('[little-campfire] data validation:\n' + report.errors.join('\n'));
        }
      }
      const target = resolveStartScene();
      window.__game.scene = target;
      this.scene.start(target);
    })();
  }

  /** Every texture family, once. The Landscape paints its own on construction. */
  private paintAll(): void {
    ensureUiTextures(this);
    paintFxTextures(this);
    paintHeroTextures(this);
    paintCompanionTextures(this);
    paintShopkeeperTextures(this);
    paintGuardianTextures(this);
    paintItemTextures(this);
    paintFish(this);
    paintFishingTextures(this);
    paintHudTextures(this);
    paintIntroTextures(this);
  }
}

function resolveStartScene(): string {
  const req = (DEBUG.scene ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const map: Record<string, string> = {
    styleboard: SCENES.styleboard,
    title: SCENES.title,
    intro: SCENES.intro,
    shop: SCENES.shop,
    camp: SCENES.camp,
    hud: SCENES.hud,
    cooking: SCENES.cooking,
    journal: SCENES.journal,
    album: SCENES.album,
    daysummary: SCENES.daysummary,
    summary: SCENES.daysummary,
  };
  if (req && map[req]) return map[req];
  return SCENES.title;
}

export { viewport };
