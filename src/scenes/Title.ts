/**
 * Title: the live camp at dusk (fire lit, fireflies, Chikki dozing by the fire), the logo with a soft glow,
 * Begin / Continue / Settings and the footer. Settings is an overlay bound to the store and the audio buses.
 */
import Phaser from 'phaser';
import { SCENES, applySettings, LARGE_TEXT_SCALE } from '@/scenes/Boot';
import { applyViewport, viewport, type Viewport } from '@/config/layout';
import { PALETTE, shade } from '@/config/palette';
import { DEBUG } from '@/config/debug';
import { makeImg } from '@/art/pipeline';
import { HUD_TEX, paintHudTextures } from '@/art/hud';
import { Landscape } from '@/world/Landscape';
import { LAYOUT, GROUND_Y } from '@/world/layout';
import { lightingAt, dayTFor } from '@/world/lighting';
import { Hero } from '@/entities/Hero';
import { fireflies, type FirefliesHandle } from '@/fx/particles';
import { setReduceMotion, isReduceMotion } from '@/fx/juice';
import { Button, Slider, Toggle, modal, overlay, makeText, UI, type OverlayHandle } from '@/ui';
import { setTextScale } from '@/ui/text';
import { audio } from '@/audio';
import { STRINGS, fill } from '@/data';
import { hasSave, startNewTrip, eraseEverything, updateSettings, getState, setFlag } from '@/state';

/** Layout tuning (logical px). */
const TITLE = {
  time: 'dusk',
  /** the fire sits at this fraction of the view width */
  fireFrac: 0.68,
  heroOffsetX: -96,
  logoY: 0.26,
  logoSize: 84,
  subtitleSize: 30,
  glowScale: 2.2,
  glowAlpha: 0.75,
  buttonsY: 0.6,
  buttonW: 260,
  footerSize: 16,
  fireflies: 22,
  readyMs: 500,
  depth: { scenery: 0, ui: 10 },
  settings: { w: 420, h: 560, sliderW: 300 },
} as const;

export class TitleScene extends Phaser.Scene {
  private landscape!: Landscape;
  private hero!: Hero;
  private flies?: FirefliesHandle;
  private ui!: Phaser.GameObjects.Container;
  private viewLeft = 0;
  private dayT = 0;
  private settingsHandle: OverlayHandle | null = null;

  constructor() {
    super(SCENES.title);
  }

  create(): void {
    const v = applyViewport(this);
    paintHudTextures(this);
    this.dayT = dayTFor(DEBUG.time ?? TITLE.time);
    this.buildWorld(v);
    this.ui = this.add.container(0, 0).setDepth(TITLE.depth.ui);
    this.buildUi(v);
    audio.music.setMood(this.dayT >= dayTFor('night') ? 'night' : 'day');
    audio.ambience.set({ dayT: this.dayT, rain: 0, nearWater: 0.2, nearFire: 1, inTent: 0, wind: 0.2 });

    const onViewport = (nv: Viewport) => {
      applyViewport(this);
      this.layoutWorld(nv);
      this.ui.removeAll(true);
      this.buildUi(nv);
    };
    this.game.events.on('viewport', onViewport);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('viewport', onViewport);
      this.flies?.destroy();
      this.landscape.destroy();
      this.settingsHandle?.close();
    });
    this.time.delayedCall(TITLE.readyMs, () => { window.__game.ready = true; });
  }

  update(_t: number, dt: number): void {
    this.landscape.update(DEBUG.freeze ? 0 : dt, this.viewLeft, this.dayT);
  }

  // ---------- world ----------
  private buildWorld(v: Viewport): void {
    this.landscape = new Landscape(this, { parallax: false, lit: true, viewWidth: v.w });
    this.landscape.root.setDepth(TITLE.depth.scenery);
    this.landscape.setLighting(lightingAt(this.dayT));
    this.landscape.setWeather({ rain: 0, mist: 0 });
    this.hero = new Hero(this, LAYOUT.fire.x + TITLE.heroOffsetX, GROUND_Y);
    this.hero.setFacing(1).setPose('sleep');
    this.landscape.addActor(this.hero);
    this.landscape.sortActors();
    this.layoutWorld(v);
  }

  private layoutWorld(v: Viewport): void {
    this.viewLeft = LAYOUT.fire.x - v.w * TITLE.fireFrac;
    this.landscape.root.setPosition(-this.viewLeft, 0);
    this.flies?.destroy();
    const jx = LAYOUT.jamunTree.x - this.viewLeft;
    this.flies = fireflies(this, { x: jx - 160, y: LAYOUT.jamunTree.crownTopY + 40, w: 320, h: GROUND_Y - LAYOUT.jamunTree.crownTopY - 80 }, TITLE.fireflies);
  }

  // ---------- ui ----------
  private buildUi(v: Viewport): void {
    const cx = v.w / 2;
    const logoY = v.h * TITLE.logoY;
    const glow = makeImg(this, cx, logoY, HUD_TEX.titleGlow).setBlendMode(Phaser.BlendModes.ADD).setAlpha(TITLE.glowAlpha);
    const gb = glow.getData('baseScale') as number;
    glow.setScale(gb * TITLE.glowScale);
    if (!isReduceMotion()) {
      this.tweens.add({ targets: glow, alpha: TITLE.glowAlpha * 0.7, scale: gb * TITLE.glowScale * 1.06, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const logo = makeText(this, cx, logoY, fill(STRINGS.title.logo), { size: TITLE.logoSize, weight: 700, color: PALETTE.cream, shadow: true, align: 'center' }).setOrigin(0.5);
    const sub = makeText(this, cx, logoY + TITLE.logoSize * 0.62, fill(STRINGS.title.subtitle), { size: TITLE.subtitleSize, hand: true, color: PALETTE.butter, shadow: true, align: 'center' }).setOrigin(0.5);
    this.ui.add([glow, logo, sub]);

    let y = v.h * TITLE.buttonsY;
    const step = UI.buttonH + UI.gap;
    const begin = new Button(this, cx, y, STRINGS.title.begin, () => this.onBegin(), { kind: 'primary', width: TITLE.buttonW });
    this.ui.add(begin);
    y += step;
    if (hasSave()) {
      const cont = new Button(this, cx, y, STRINGS.title.continue, () => this.onContinue(), { kind: 'secondary', width: TITLE.buttonW });
      this.ui.add(cont);
      y += step;
    }
    const settings = new Button(this, cx, y, STRINGS.title.settings, () => this.openSettings(), { kind: 'secondary', width: TITLE.buttonW });
    this.ui.add(settings);

    const footer = makeText(this, cx, v.h - v.safe.bottom - 14, fill(STRINGS.title.footer), { size: TITLE.footerSize, color: shade(PALETTE.cream, -0.08), shadow: true, align: 'center' }).setOrigin(0.5, 1);
    this.ui.add(footer);
  }

  private onBegin(): void {
    if (hasSave()) {
      modal(this, {
        title: STRINGS.settings.newTrip,
        body: STRINGS.settings.newTripConfirm,
        buttons: [
          { label: STRINGS.settings.keepCamping, kind: 'secondary' },
          { label: STRINGS.settings.startOver, kind: 'primary', onPick: () => this.beginTrip() },
        ],
      });
      return;
    }
    this.beginTrip();
  }

  private beginTrip(): void {
    if (hasSave()) startNewTrip();
    // A new trip always replays the storybook.
    setFlag('introSeen', false);
    this.scene.start(SCENES.intro);
  }

  private onContinue(): void {
    this.scene.start(SCENES.camp);
  }

  // ---------- settings ----------
  private openSettings(): void {
    if (this.settingsHandle && !this.settingsHandle.closed) return;
    const s = getState().settings;
    const S = STRINGS.settings;
    const v = viewport();
    const w = Math.min(TITLE.settings.w, v.w - UI.pad * 2);
    const h = Math.min(TITLE.settings.h, v.h - UI.pad * 2);
    this.settingsHandle = overlay(this, {
      w, h, title: S.title,
      onClose: () => { this.settingsHandle = null; },
      build: (card) => {
        const c = card.content;
        const left = -w / 2 + UI.pad;
        const sliderW = Math.min(TITLE.settings.sliderW, w - UI.pad * 2);
        let y = -h / 2 + UI.pad + 34 + 36;
        const rowH = 66;
        const addSlider = (label: string, value: number, onChange: (k: number) => void) => {
          c.add(new Slider(this, 0, y, { label, width: sliderW, value, onChange }));
          y += rowH;
        };
        addSlider(S.music, s.music, (k) => { updateSettings({ music: k }); audio.engine.setVolumes({ music: k }); });
        addSlider(S.sounds, s.sounds, (k) => { updateSettings({ sounds: k }); audio.engine.setVolumes({ sfx: k }); audio.sfx.play('plip'); });
        addSlider(S.ambience, s.ambience, (k) => { updateSettings({ ambience: k }); audio.engine.setVolumes({ ambience: k }); });
        y += 4;
        const addToggle = (label: string, value: boolean, onChange: (b: boolean) => void) => {
          const t = new Toggle(this, w / 2 - UI.pad - 32, y, { value, onChange });
          c.add([makeText(this, left, y, label, { size: 18, weight: 600 }).setOrigin(0, 0.5), t]);
          y += 52;
        };
        addToggle(S.reduceMotion, s.reduceMotion, (b) => { updateSettings({ reduceMotion: b }); setReduceMotion(b); });
        addToggle(S.largeText, s.largeText, (b) => { updateSettings({ largeText: b }); setTextScale(b ? LARGE_TEXT_SCALE : 1); });
        y += 10;
        const bw = w - UI.pad * 2;
        c.add(new Button(this, 0, y + UI.buttonH / 2, S.newTrip, () => this.confirmNewTrip(), { kind: 'secondary', width: bw }));
        y += UI.buttonH + UI.gap;
        c.add(new Button(this, 0, y + UI.buttonH / 2, S.erase, () => this.confirmErase(), { kind: 'secondary', width: bw }));
        y += UI.buttonH + UI.gap;
        c.add(new Button(this, 0, y + UI.buttonH / 2, S.cancel, () => this.settingsHandle?.close(), { kind: 'primary', width: bw }));
      },
    });
  }

  private confirmNewTrip(): void {
    const S = STRINGS.settings;
    modal(this, {
      title: S.newTrip, body: S.newTripConfirm,
      buttons: [
        { label: S.keepCamping, kind: 'secondary' },
        { label: S.startOver, kind: 'primary', onPick: () => { startNewTrip(); applySettings(); this.settingsHandle?.close(); this.rebuild(); } },
      ],
    });
  }

  private confirmErase(): void {
    const S = STRINGS.settings;
    modal(this, {
      title: S.erase, body: S.eraseConfirm,
      buttons: [
        { label: S.cancel, kind: 'secondary' },
        { label: S.eraseConfirmButton, kind: 'primary', onPick: () => { eraseEverything(); applySettings(); this.settingsHandle?.close(); this.rebuild(); } },
      ],
    });
  }

  /** Re-lay the buttons (the Continue button depends on hasSave()). */
  private rebuild(): void {
    this.ui.removeAll(true);
    this.buildUi(viewport());
  }
}

