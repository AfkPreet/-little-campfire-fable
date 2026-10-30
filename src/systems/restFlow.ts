/**
 * restFlow: Rest in the tent doorway (rain rest gains while it rains; tap elsewhere to stand) and Sleep at night ->
 * "Turn in for the night?" -> fade to ink, endDay(), DaySummary overlay, wait for 'summary:closed', dawn, fade in.
 * Sleeping under the stars (no tent) is offered by fireFlow and runs the same sleep.
 */
import type Phaser from 'phaser';
import type { CampScene } from '@/scenes/Camp';
import { SCENES } from '@/scenes/Boot';
import type { Tent } from '@/entities/Tent';
import { endDay, getState } from '@/state';
import { STRINGS } from '@/data';
import { LAYOUT } from '@/world/layout';
import { PALETTE, hexToInt } from '@/config/palette';
import { viewport } from '@/config/layout';
import { isReduceMotion } from '@/fx/juice';
import { audio } from '@/audio';
import type { BubbleAction } from '@/ui/Bubble';

export const REST_FLOW = {
  fadeMs: 800,
  fadeAlpha: 0.9,
  pauseReason: 'sleeping',
  /** where the hero sleeps without a tent */
  starsX: LAYOUT.cushion.x,
  veilDepth: 5000,
} as const;

export class RestFlow {
  private sleeping = false;
  private veil: Phaser.GameObjects.Rectangle | null = null;

  constructor(private readonly camp: CampScene) {}

  create(): void {
    // the tent interactable is registered by tentFlow once a tent stands; nothing to do here
  }

  /** Bubble actions for the pitched tent. */
  tentActions(tent: Tent): BubbleAction[] {
    const acts: BubbleAction[] = [{ label: STRINGS.bubbles.rest, onPick: () => void this.rest(tent) }];
    if (getState().isNight) acts.push({ label: STRINGS.bubbles.sleep, onPick: () => void this.askSleep() });
    return acts;
  }

  /** Sit in the doorway. clockRunner pays rainRest while activity === 'rest' and it rains. */
  async rest(tent: Tent): Promise<void> {
    this.camp.hideActions();
    const door = tent.doorPoint();
    await this.camp.walkHeroTo(door.x);
    if (Math.abs(this.camp.hero.x - door.x) > 2) return;
    this.camp.hero.setFacing(LAYOUT.fire.x > door.x ? 1 : -1);
    this.camp.hero.setPose('sit');
    this.camp.hero.setExpression(getState().weather.raining ? 'blissful' : 'happy');
    this.camp.activity = 'rest';
  }

  /** "Turn in for the night?" */
  askSleep(): Promise<boolean> {
    this.camp.hideActions();
    return new Promise((resolve) => {
      const h = this.camp.modal({
        title: STRINGS.camp.sleepPrompt,
        hand: true,
        buttons: [
          { label: STRINGS.camp.sleep, kind: 'primary', onPick: () => { h.close(); void this.sleep().then(() => resolve(true)); } },
          { label: STRINGS.camp.stayUp, kind: 'secondary', onPick: () => { h.close(); resolve(false); } },
        ],
      });
    });
  }

  /** The whole night: fade out, endDay, summary overlay, dawn, fade in. Resolves at dawn. */
  async sleep(): Promise<void> {
    if (this.sleeping) return;
    this.sleeping = true;
    const camp = this.camp;
    camp.hideActions();
    camp.standUp();
    camp.pauseClock(REST_FLOW.pauseReason);
    audio.sfx.play('sleep');
    camp.hero.setExpression('sleepy');
    camp.hero.setPose('sleep');
    const ms = isReduceMotion() ? 0 : REST_FLOW.fadeMs;
    await this.fadeTo(REST_FLOW.fadeAlpha, ms);

    const { page } = endDay();
    await new Promise<void>((resolve) => {
      camp.events.once('summary:closed', () => resolve());
      camp.scene.launch(SCENES.daysummary, { page });
    });

    // dawn
    const tent = camp.tent;
    const at = tent ? tent.doorPoint().x : REST_FLOW.starsX;
    camp.hero.setPosition(at, camp.groundAt(at));
    camp.hero.setPose('stand');
    camp.hero.setExpression('happy');
    camp.hero.setFacing(LAYOUT.fire.x > at ? 1 : -1);
    camp.clock.fireLitByPlayer = false;
    camp.clock.applyNow();
    camp.worldCam.centerOn(at, camp.worldCam.midPoint.y);
    camp.events.emit('dawn');
    camp.resumeClock(REST_FLOW.pauseReason);
    await this.fadeTo(0, ms);
    this.sleeping = false;
  }

  /** Ink veil over the view (fixed to the camera), tweened to `alpha`. */
  private fadeTo(alpha: number, ms: number): Promise<void> {
    if (!this.veil) {
      const v = viewport();
      this.veil = this.camp.add.rectangle(v.w / 2, v.h / 2, v.w * 2, v.h * 2, hexToInt(PALETTE.ink), 1)
        .setScrollFactor(0).setDepth(REST_FLOW.veilDepth).setAlpha(0);
    }
    const veil = this.veil;
    return new Promise((resolve) => {
      if (ms <= 0) { veil.setAlpha(alpha); resolve(); return; }
      this.camp.tweens.add({ targets: veil, alpha, duration: ms, ease: 'Sine.easeInOut', onComplete: () => resolve() });
    });
  }
}
