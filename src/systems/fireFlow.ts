/**
 * fireFlow: the fire ring interactable. Cook launches the Cooking overlay (clock paused until 'cooking:closed');
 * Sit walks the hero to the cushion for fire-sitting gains at night (clockRunner pays them); Sleep under the stars
 * at night when there is no tent (restFlow runs the sleep).
 */
import type { CampScene } from '@/scenes/Camp';
import { SCENES } from '@/scenes/Boot';
import { getState } from '@/state';
import { STRINGS } from '@/data';
import { LAYOUT } from '@/world/layout';
import { FIRE_SIZES } from '@/art/props/fire';
import type { BubbleAction } from '@/ui/Bubble';
import { decorSitPoint } from '@/systems/decorMode';
import { companionOf } from '@/systems/companionFlow';

export const FIRE_FLOW = {
  hit: { w: FIRE_SIZES.ring.w, h: 90 },
  radius: 110,
  pauseReason: 'cooking',
} as const;

/** What the Cooking scene hands back through 'cooking:closed' (loosely typed: the Cooking agent owns the shape). */
export type CookingResult = { cooked?: string; eaten?: boolean; newRecipe?: boolean } | undefined;

export class FireFlow {
  constructor(private readonly camp: CampScene) {}

  create(): void {
    const f = LAYOUT.fire;
    this.camp.registerInteractable({
      id: 'fire', x: f.x, y: f.y + 12, radius: FIRE_FLOW.radius, hit: FIRE_FLOW.hit,
      labelFor: () => STRINGS.bubbles.cook,
      actionsFor: () => this.actions(),
    });
  }

  actions(): BubbleAction[] {
    const acts: BubbleAction[] = [
      { label: STRINGS.bubbles.cook, onPick: () => void this.cook() },
      { label: STRINGS.bubbles.sit, onPick: () => void this.sit() },
    ];
    if (getState().isNight && !this.camp.tent) {
      acts.push({ label: STRINGS.bubbles.sleep, onPick: () => void this.camp.restFlow.askSleep() });
    }
    return acts;
  }

  /** Open the Cooking overlay; the fire lights while cooking and stays lit for the rest of the day. */
  cook(): Promise<CookingResult> {
    this.camp.hideActions();
    this.camp.standUp();
    this.camp.pauseClock(FIRE_FLOW.pauseReason);
    this.camp.clock.fireLitByPlayer = true;
    this.camp.landscape.setFireLit(true);
    return new Promise((resolve) => {
      this.camp.events.once('cooking:closed', (result: CookingResult) => {
        this.camp.resumeClock(FIRE_FLOW.pauseReason);
        resolve(result);
      });
      this.camp.scene.launch(SCENES.cooking, { companionNear: companionOf(this.camp)?.isNear() ?? false });
    });
  }

  /** Walk to the cushion and sit facing the fire. clockRunner pays fireSitting while activity === 'fireSit'. */
  async sit(): Promise<void> {
    this.camp.hideActions();
    const seat = decorSitPoint('cushion') ?? LAYOUT.cushion;
    await this.camp.walkHeroTo(seat.x);
    if (Math.abs(this.camp.hero.x - seat.x) > 2) return; // interrupted
    this.camp.hero.setFacing(LAYOUT.fire.x > seat.x ? 1 : -1);
    this.camp.hero.setPose('sit');
    this.camp.hero.setExpression('happy');
    this.camp.activity = 'fireSit';
  }
}
