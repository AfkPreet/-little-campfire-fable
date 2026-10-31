/**
 * DaySummary: overlay card "Day n done", the Contentment bloom, up to 3 highlight lines, "Sweet dreams...".
 * Tap anywhere to continue: emits 'summary:closed' on the Camp scene (when it runs) and stops itself.
 */
import Phaser from 'phaser';
import { SCENES } from '@/scenes/Boot';
import { applyViewport, viewport } from '@/config/layout';
import { PALETTE, hexToInt } from '@/config/palette';
import { Bloom, BLOOM } from '@/art/hud';
import { Card, makeText, UI, MODAL } from '@/ui';
import { isReduceMotion, popIn } from '@/fx/juice';
import { sparkleBurst } from '@/fx/particles';
import { DEBUG } from '@/config/debug';
import { audio } from '@/audio';
import { STRINGS, fill, RECIPE_BY_ID, MOMENT_BY_ID, dishInfo } from '@/data';
import { getState, todayPage, type DayPage } from '@/state';

const SUMMARY = {
  w: 420,
  h: 520,
  dim: 0.55,
  depth: 1000,
  titleSize: 34,
  lineSize: 20,
  lineGap: 34,
  bloomY: -90,
  bloomScale: 1.15,
  linesY: 86,
  dreamsY: 0.5,
  popMs: 320,
  bloomDelayMs: 350,
  closeMs: 200,
  maxLines: 3,
  readyMs: 2200,
  bloomSparkles: 8,
} as const;

export type DaySummaryData = { page?: DayPage };

export class DaySummaryScene extends Phaser.Scene {
  private closing = false;

  constructor() {
    super(SCENES.daysummary);
  }

  create(data: DaySummaryData = {}): void {
    const v = applyViewport(this);
    this.closing = false;
    const page = data.page ?? pageForSummary();

    const backdrop = this.add.rectangle(v.w / 2, v.h / 2, v.w * 4, v.h * 4, hexToInt(PALETTE.ink), 0).setDepth(SUMMARY.depth);
    this.tweens.add({ targets: backdrop, fillAlpha: SUMMARY.dim, duration: MODAL.fadeMs });

    const w = Math.min(SUMMARY.w, v.w - MODAL.margin * 2);
    const h = Math.min(SUMMARY.h, v.h - MODAL.margin * 2);
    const card = new Card(this, v.w / 2, v.h / 2, w, h, { title: fill(STRINGS.summary.title, { n: page.day }), hand: true, titleSize: SUMMARY.titleSize });
    card.setDepth(SUMMARY.depth + 1);
    this.add.existing(card);

    const bloom = new Bloom(this, 0, SUMMARY.bloomY + BLOOM.petalH * 0.2);
    bloom.setScale(SUMMARY.bloomScale).setData('baseScale', SUMMARY.bloomScale).setAlpha(0);
    card.content.add(bloom);
    const open = Phaser.Math.Clamp(page.peakContentment / 100, 0, 1);
    // the bud pops in closed, then the petals fan open one by one (Bloom.setOpen staggers them) with a sparkle
    popIn(this, bloom, SUMMARY.popMs, isReduceMotion() ? 0 : SUMMARY.bloomDelayMs * 0.5);
    this.time.delayedCall(isReduceMotion() ? 0 : SUMMARY.bloomDelayMs, () => {
      bloom.setOpen(open, !isReduceMotion());
      audio.sfx.play('sparkle');
      if (!isReduceMotion()) sparkleBurst(this, card.x, card.y + bloom.y * SUMMARY.bloomScale - BLOOM.petalH * 0.4, SUMMARY.bloomSparkles);
    });

    const lines = highlightLines(page);
    if (lines.length === 0) lines.push(STRINGS.summary.quietDay);
    lines.forEach((line, i) => {
      card.content.add(makeText(this, 0, SUMMARY.linesY + i * SUMMARY.lineGap, line, { size: SUMMARY.lineSize, align: 'center', wrap: w - UI.pad * 2, color: PALETTE.ink }).setOrigin(0.5, 0));
    });
    const dreamsY = h / 2 - UI.pad - 8;
    card.content.add(makeText(this, 0, dreamsY, STRINGS.summary.sweetDreams, { size: 24, hand: true, align: 'center', color: PALETTE.ink }).setOrigin(0.5, 1).setAlpha(0.85));

    if (!isReduceMotion()) {
      const base = card.getData('baseScale') as number | undefined ?? 1;
      card.setScale(base * 0.85).setAlpha(0);
      this.tweens.add({ targets: card, scale: base, alpha: 1, duration: SUMMARY.popMs, ease: 'Back.easeOut' });
    }

    this.input.once(Phaser.Input.Events.POINTER_UP, () => this.close(card, backdrop));
    const onViewport = () => { applyViewport(this); const nv = viewport(); card.setPosition(nv.w / 2, nv.h / 2); backdrop.setPosition(nv.w / 2, nv.h / 2); };
    this.game.events.on('viewport', onViewport);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('viewport', onViewport));
    window.setTimeout(() => { window.__game.ready = true; }, SUMMARY.readyMs);
  }

  private close(card: Card, backdrop: Phaser.GameObjects.Rectangle): void {
    if (this.closing) return;
    this.closing = true;
    audio.sfx.play('sleep');
    const done = () => {
      const camp = this.scene.get(SCENES.camp);
      if (camp && camp.scene.isActive()) camp.events.emit('summary:closed');
      this.scene.stop();
    };
    if (isReduceMotion()) {
      done();
      return;
    }
    this.tweens.add({ targets: card, alpha: 0, scale: card.scale * 0.92, duration: SUMMARY.closeMs, ease: 'Sine.easeIn' });
    this.tweens.add({ targets: backdrop, fillAlpha: 0, duration: SUMMARY.closeMs, onComplete: done });
  }
}

/** Today's page; when the overlay is opened straight from the debug URL on an untouched day, the latest trip page. */
function pageForSummary(): DayPage {
  const s = getState();
  const today = todayPage(s);
  const empty = today.fishCaught === 0 && today.dishesCooked === 0 && today.moments.length === 0;
  const last = s.journal.trip[s.journal.trip.length - 1];
  return DEBUG.scene === 'daysummary' && empty && last ? last : today;
}

/** Up to 3 lines: fish caught, the (new) dish, a moment. */
export function highlightLines(page: DayPage): string[] {
  const S = STRINGS.summary;
  const out: string[] = [];
  if (page.fishCaught === 1) out.push(S.caughtOneFish);
  else if (page.fishCaught > 1) out.push(fill(S.caughtFish, { n: page.fishCaught }));
  const newRecipe = page.newRecipes[0];
  if (newRecipe) out.push(fill(S.cookedNew, { Dish: RECIPE_BY_ID[newRecipe].name }));
  else if (page.mostCooked) out.push(fill(S.cooked, { Dish: dishInfo(page.mostCooked).name }));
  const moment = page.moments[0];
  if (moment) out.push(fill(S.moment, { Moment: MOMENT_BY_ID[moment].name }));
  return out.slice(0, SUMMARY.maxLines);
}
