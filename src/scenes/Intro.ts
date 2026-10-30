/**
 * Intro: three storybook cards (vignette + one line each). Tap to turn (a card slide + a page-flip tok),
 * "Skip" top-right. Sets flags.introSeen then starts the Shop.
 */
import Phaser from 'phaser';
import { SCENES } from '@/scenes/Boot';
import { applyViewport, type Viewport } from '@/config/layout';
import { PALETTE, LIGHT_KEYS, hexToInt, mix } from '@/config/palette';
import { makeImg } from '@/art/pipeline';
import { INTRO_TEX, VIGNETTE, paintIntroTextures } from '@/art/intro';
import { Card, Button, makeText, UI } from '@/ui';
import { isReduceMotion } from '@/fx/juice';
import { audio } from '@/audio';
import { STRINGS, fill } from '@/data';
import { setFlag, flush } from '@/state';

const INTRO = {
  cardW: 380,
  cardH: 330,
  textSize: 22,
  slideMs: 320,
  skipMargin: 16,
  skipW: 110,
  hintSize: 16,
  readyMs: 400,
  bg: mix(LIGHT_KEYS.dusk.top, PALETTE.ink, 0.35),
} as const;

export class IntroScene extends Phaser.Scene {
  private page = 0;
  private card: Card | null = null;
  private turning = false;
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super(SCENES.intro);
  }

  create(): void {
    const v = applyViewport(this);
    paintIntroTextures(this);
    this.cameras.main.setBackgroundColor(hexToInt(INTRO.bg));
    this.page = 0;
    this.turning = false;
    this.ui = this.add.container(0, 0).setDepth(10);
    this.buildChrome(v);
    this.showPage(v, false);

    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (this.input.hitTestPointer(p).length > 0) return; // a button took it
      this.turn();
    });
    const onViewport = (nv: Viewport) => {
      applyViewport(this);
      this.ui.removeAll(true);
      this.buildChrome(nv);
      this.card?.setPosition(nv.w / 2, nv.h / 2);
    };
    this.game.events.on('viewport', onViewport);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('viewport', onViewport));
    this.time.delayedCall(INTRO.readyMs, () => { window.__game.ready = true; });
  }

  private buildChrome(v: Viewport): void {
    const skip = new Button(this, v.w - v.safe.right - INTRO.skipMargin - INTRO.skipW / 2, v.safe.top + INTRO.skipMargin + UI.pillH / 2, STRINGS.intro.skip, () => this.finish(), { kind: 'secondary', width: INTRO.skipW, height: UI.pillH, size: 18 });
    this.ui.add(skip);
    const dots = this.add.container(v.w / 2, v.h / 2 + INTRO.cardH / 2 + 26);
    STRINGS.intro.pages.forEach((_, i) => {
      dots.add(this.add.circle(i * 18 - (STRINGS.intro.pages.length - 1) * 9, 0, i === this.page ? 6 : 4, hexToInt(PALETTE.cream)).setAlpha(i === this.page ? 0.95 : 0.5));
    });
    dots.setName('dots');
    this.ui.add(dots);
  }

  private makeCard(v: Viewport, index: number): Card {
    const card = new Card(this, v.w / 2, v.h / 2, INTRO.cardW, INTRO.cardH);
    const vig = makeImg(this, 0, -INTRO.cardH / 2 + UI.pad + VIGNETTE.h / 2, INTRO_TEX[index]);
    const line = makeText(this, 0, -INTRO.cardH / 2 + UI.pad + VIGNETTE.h + 14, fill(STRINGS.intro.pages[index]), {
      size: INTRO.textSize, hand: true, align: 'center', wrap: INTRO.cardW - UI.pad * 2, color: PALETTE.ink,
    }).setOrigin(0.5, 0);
    card.content.add([vig, line]);
    this.add.existing(card);
    return card;
  }

  private showPage(v: Viewport, animate: boolean): void {
    const next = this.makeCard(v, this.page);
    const reduce = isReduceMotion() || !animate;
    if (reduce) {
      this.card?.destroy();
      this.card = next;
      this.turning = false;
    } else {
      const old = this.card;
      next.x = v.w / 2 + v.w;
      next.setAlpha(0);
      this.tweens.add({ targets: next, x: v.w / 2, alpha: 1, duration: INTRO.slideMs, ease: 'Back.easeOut' });
      if (old) this.tweens.add({ targets: old, x: -v.w / 2, alpha: 0, duration: INTRO.slideMs, ease: 'Sine.easeIn', onComplete: () => old.destroy() });
      this.card = next;
      this.time.delayedCall(INTRO.slideMs, () => { this.turning = false; });
    }
    // refresh the dots
    this.ui.getByName('dots')?.destroy();
    const dots = this.add.container(v.w / 2, v.h / 2 + INTRO.cardH / 2 + 26).setName('dots');
    STRINGS.intro.pages.forEach((_, i) => {
      dots.add(this.add.circle(i * 18 - (STRINGS.intro.pages.length - 1) * 9, 0, i === this.page ? 6 : 4, hexToInt(PALETTE.cream)).setAlpha(i === this.page ? 0.95 : 0.5));
    });
    this.ui.add(dots);
  }

  private turn(): void {
    if (this.turning) return;
    if (this.page >= STRINGS.intro.pages.length - 1) {
      this.finish();
      return;
    }
    this.turning = true;
    this.page += 1;
    audio.sfx.play('tok');
    this.showPage(applyViewport(this), true);
  }

  private finish(): void {
    if (this.scene.settings.status >= Phaser.Scenes.SHUTDOWN) return;
    setFlag('introSeen', true);
    flush();
    this.scene.start(SCENES.shop);
  }
}
