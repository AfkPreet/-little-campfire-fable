/**
 * Title: the live camp at dusk (fire lit, fireflies, Chikki dozing by the fire), the logo with a soft glow,
 * Begin / Continue / Settings and the footer. Settings is an overlay bound to the store and the audio buses.
 */
import Phaser from 'phaser';
import { SCENES } from '@/scenes/Boot';
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
import { isReduceMotion } from '@/fx/juice';
import { Button, modal, makeText, UI, type OverlayHandle } from '@/ui';
import { openSettings } from '@/ui/SettingsOverlay';
import { audio } from '@/audio';
import { STRINGS, fill } from '@/data';
import { hasSave, startNewTrip, setFlag } from '@/state';

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
    this.landscape = new Landscape(this, { parallax: false, lit: true, viewWidth: v.w, tentSpots: false });
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
    this.settingsHandle = openSettings(this, {
      onClose: () => { this.settingsHandle = null; },
      onNewTrip: () => this.rebuild(),
      onErase: () => this.rebuild(),
    });
  }

  /** Re-lay the buttons (the Continue button depends on hasSave()). */
  private rebuild(): void {
    this.ui.removeAll(true);
    this.buildUi(viewport());
  }
}

