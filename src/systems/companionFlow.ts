/**
 * companionFlow: Puttu's camp behaviour (spec section 5 "Companion").
 *  - Peeking: tier content+, dusk or night, a dish in the backpack, not yet befriended -> eyes and ears above the
 *    nearest jamun thicket (drawn behind the bush: the companion sits in clearingBack while peeking). Tap hides it.
 *  - Sharing: fireFlow passes companionNear into the Cooking launch; on 'cooking:closed' with action 'share' Puttu
 *    comes out and nibbles. The Cooking scene already applied companionVisit() (+6 Contentment): only react here.
 *  - Befriended: follows a step behind the hero, sits on the jetty while fishing, sleeps by the fire stones at night
 *    when the hero sits or rests, wiggles when the hero eats. Tinted by the clock's charTint like the hero.
 */
import Phaser from 'phaser';
import type { CampScene } from '@/scenes/Camp';
import { Companion } from '@/entities/Companion';
import { DEBUG } from '@/config/debug';
import { getState } from '@/state';
import { tierOf } from '@/state/contentment';
import { COMPANION, CONTENTMENT_TIER_ORDER, STRINGS, dishInfo, fill } from '@/data';
import type { CookedResult } from '@/scenes/Cooking';
import { LAYOUT, groundTopAt } from '@/world/layout';
import { fishingOf } from '@/systems/fishing';
import { phaseAt } from '@/world/lighting';
import { heartsFloat, sparkleBurst } from '@/fx/particles';
import { audio } from '@/audio';
import { FORAGE_SIZES } from '@/art/props/forage';

export const COMPANION_FLOW = {
  /** px behind the hero when following */
  followGap: 70,
  /** "near" for the Share action */
  nearPx: 160,
  /** re-peek after a tap-hide, ms */
  repeekMinMs: 40_000,
  repeekMaxMs: 70_000,
  /** how often the peek conditions are checked, ms */
  checkMs: 1500,
  /** tap target over the peeking eyes */
  peekHit: { w: 56, h: 56 },
  /** the hero may tap the peek from this far away (no walk needed in practice) */
  peekRadius: 900,
  /** lingers this long after a share before slipping back into the thicket */
  lingerMs: 6000,
  /** where Puttu sits while the hero fishes (left of the jetty's first post) */
  jettySeatDx: -36,
  /** curled beside the fire-ring stones, away from the cushion side */
  fireSleepDx: 64,
  /** the leaf line sits this fraction of the thicket's height above its base */
  leafLineFrac: 0.78,
  /** hearts rise from about the head */
  headY: -40,
  interactableId: 'companion-peek',
} as const;

type Mode = 'none' | 'peek' | 'follow' | 'jetty' | 'fire';

const flows = new WeakMap<Phaser.Scene, CompanionFlow>();
export function companionOf(camp: CampScene): CompanionFlow | undefined { return flows.get(camp); }

export function installCompanion(camp: CampScene): CompanionFlow {
  const flow = new CompanionFlow(camp);
  flows.set(camp, flow);
  flow.create();
  camp.events.once('shutdown', () => { flow.destroy(); flows.delete(camp); });
  return flow;
}

export class CompanionFlow {
  companion: Companion | null = null;
  private mode: Mode = 'none';
  private checkTimer?: Phaser.Time.TimerEvent;
  private lingerTimer?: Phaser.Time.TimerEvent;
  private hideUntil = 0;
  private peekToastDay = -1;
  private heroWasWalking = false;
  private lastTint = '';
  private knownBefriended = false;
  private busy = false;

  constructor(private readonly camp: CampScene) {}

  create(): void {
    this.knownBefriended = getState().journal.companion.befriended;
    if (this.knownBefriended) this.restoreBeside();
    this.camp.events.on('update', this.onUpdate, this);
    this.camp.events.on('cooking:closed', this.onCookingClosed, this);
    this.checkTimer = this.camp.time.addEvent({ delay: COMPANION_FLOW.checkMs, loop: true, callback: () => this.checkPeek() });
    if (DEBUG.enabled && DEBUG.peek) this.camp.events.once('ready', () => void this.forcePeek());
  }

  destroy(): void {
    this.camp.events.off('update', this.onUpdate, this);
    this.camp.events.off('cooking:closed', this.onCookingClosed, this);
    this.checkTimer?.remove(false);
    this.lingerTimer?.remove(false);
    this.camp.unregisterInteractable(COMPANION_FLOW.interactableId);
    this.companion?.destroy();
    this.companion = null;
  }

  /** The Cooking scene offers Share while this is true. */
  isNear(): boolean {
    const c = this.companion;
    if (!c) return false;
    if (c.state === 'peek') return true;
    return getState().journal.companion.befriended && Math.abs(c.x - this.camp.hero.x) < COMPANION_FLOW.nearPx;
  }

  /** Debug: peek from the nearest thicket regardless of the conditions. */
  forcePeek(): Promise<void> {
    return this.peek();
  }

  // ---------- peeking ----------

  private peekConditionsMet(): boolean {
    const s = getState();
    if (s.journal.companion.befriended) return false;
    if (s.inventory.dishes.length === 0) return false;
    const phase = phaseAt(s.dayT);
    if (!(COMPANION.appearsPhases as readonly string[]).includes(phase)) return false;
    return CONTENTMENT_TIER_ORDER.indexOf(tierOf(s)) >= CONTENTMENT_TIER_ORDER.indexOf(COMPANION.appearsAtTier);
  }

  private checkPeek(): void {
    if (this.busy || this.mode !== 'none' || this.camp.clockPaused) return;
    if (this.camp.time.now < this.hideUntil) return;
    if (this.peekConditionsMet()) void this.peek();
  }

  private nearestThicket(): { x: number; y: number } {
    const hx = this.camp.hero.x;
    let best: { x: number; y: number } = LAYOUT.peekSpots[0];
    for (const p of LAYOUT.peekSpots) if (Math.abs(p.x - hx) < Math.abs(best.x - hx)) best = p;
    return best;
  }

  private async peek(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const thicket = this.nearestThicket();
    const spot = { x: thicket.x, y: groundTopAt(thicket.x) - FORAGE_SIZES.thicket.h * COMPANION_FLOW.leafLineFrac };
    const c = this.ensure(spot.x, groundTopAt(spot.x) + 40);
    c.x = spot.x;
    c.setFacing(this.camp.hero.x >= spot.x ? 1 : -1);
    // behind the bush: the leaves draw in front of the eyes
    this.camp.landscape.layers.clearingBack.add(c);
    this.mode = 'peek';
    this.camp.registerInteractable({
      id: COMPANION_FLOW.interactableId,
      x: spot.x,
      y: spot.y + COMPANION_FLOW.peekHit.h / 2 - 10,
      radius: COMPANION_FLOW.peekRadius,
      hit: COMPANION_FLOW.peekHit,
      labelFor: () => null,
      actionsFor: () => [],
      onTap: () => void this.hidePeek(),
    });
    const s = getState();
    if (this.peekToastDay !== s.day) {
      this.peekToastDay = s.day;
      this.camp.toast(STRINGS.companion.peeking);
    }
    audio.sfx.play('squeak', { volume: 0.35 });
    this.busy = false;
    await c.peek(spot.y);
  }

  private async hidePeek(): Promise<void> {
    const c = this.companion;
    if (!c || this.mode !== 'peek') return;
    this.camp.unregisterInteractable(COMPANION_FLOW.interactableId);
    this.mode = 'none';
    this.hideUntil = this.camp.time.now + Phaser.Math.Between(COMPANION_FLOW.repeekMinMs, COMPANION_FLOW.repeekMaxMs);
    await c.hide();
  }

  // ---------- sharing / eating ----------

  private onCookingClosed(result: { cooked?: CookedResult | null } | undefined): void {
    const cooked = result?.cooked;
    if (!cooked) return;
    if (cooked.action === 'share') void this.onShared(cooked);
    else if (cooked.action === 'eat' && this.companion && this.mode !== 'none' && this.mode !== 'peek') void this.companion.wiggle();
  }

  private async onShared(cooked: CookedResult): Promise<void> {
    const hero = this.camp.hero;
    const c = this.ensure(hero.x - COMPANION_FLOW.followGap * hero.facing, groundTopAt(hero.x));
    this.camp.unregisterInteractable(COMPANION_FLOW.interactableId);
    this.lingerTimer?.remove(false);
    this.busy = true;
    // come out of the bush into the actor layer, then trot up beside the hero
    this.camp.landscape.addActor(c);
    c.y = groundTopAt(c.x);
    await c.stand();
    await c.followTo(hero.x - COMPANION_FLOW.followGap * hero.facing);
    c.setFacing(hero.x >= c.x ? 1 : -1);
    this.mode = 'follow';
    heartsFloat(this.camp, c.x, c.y + COMPANION_FLOW.headY, 3);
    audio.sfx.play('squeak');
    this.camp.toast(fill(STRINGS.companion.nibbled, { Dish: dishInfo(cooked.dishId).name }));
    await c.wiggle();
    this.busy = false;
    const befriended = getState().journal.companion.befriended;
    if (befriended && !this.knownBefriended) {
      this.knownBefriended = true;
      sparkleBurst(this.camp, c.x, c.y + COMPANION_FLOW.headY, 14);
      audio.sfx.play('chime');
      this.camp.toast(fill(STRINGS.companion.befriended));
    }
    if (!befriended) {
      this.lingerTimer = this.camp.time.delayedCall(COMPANION_FLOW.lingerMs, () => void this.slipAway());
    }
  }

  /** Not yet a friend: trot back to the nearest thicket and sink out of sight. */
  private async slipAway(): Promise<void> {
    const c = this.companion;
    if (!c || getState().journal.companion.befriended) return;
    this.busy = true;
    const spot = this.nearestThicket();
    await c.followTo(spot.x);
    this.camp.landscape.layers.clearingBack.add(c);
    await c.hide();
    this.mode = 'none';
    this.busy = false;
    this.hideUntil = this.camp.time.now + COMPANION_FLOW.repeekMinMs;
  }

  // ---------- befriended behaviour ----------

  private restoreBeside(): void {
    const hero = this.camp.hero;
    const x = hero.x - COMPANION_FLOW.followGap * hero.facing;
    const c = this.ensure(x, groundTopAt(x));
    this.camp.landscape.addActor(c);
    c.setFacing(hero.facing);
    this.mode = 'follow';
  }

  private onUpdate(): void {
    const c = this.companion;
    if (!c) return;
    const tint = this.camp.clock.lighting?.charTint;
    if (tint && tint !== this.lastTint) {
      this.lastTint = tint;
      c.setTint(tint);
    }
    if (!getState().journal.companion.befriended || this.busy) return;
    const hero = this.camp.hero;
    const walking = hero.isWalking;
    if (walking) {
      this.heroWasWalking = true;
      return;
    }
    if (this.heroWasWalking) {
      this.heroWasWalking = false;
      void this.follow();
      return;
    }
    if (this.mode === 'follow') {
      const s = getState();
      if ((fishingOf(this.camp)?.phase ?? 'idle') !== 'idle') void this.sitOnJetty();
      else if (s.isNight && (this.camp.activity === 'fireSit' || this.camp.activity === 'rest')) void this.sleepByFire();
    }
  }

  private async follow(): Promise<void> {
    const c = this.companion;
    if (!c) return;
    const hero = this.camp.hero;
    this.busy = true;
    this.mode = 'follow';
    if (c.state !== 'stand') await c.stand();
    await c.followTo(hero.x - COMPANION_FLOW.followGap * hero.facing);
    c.y = groundTopAt(c.x);
    c.setFacing(hero.facing);
    this.busy = false;
  }

  private async sitOnJetty(): Promise<void> {
    const c = this.companion;
    if (!c) return;
    this.busy = true;
    this.mode = 'jetty';
    const x = LAYOUT.jetty.x0 + COMPANION_FLOW.jettySeatDx;
    await c.followTo(x);
    c.y = groundTopAt(x);
    c.setFacing(1);
    await c.sit();
    this.busy = false;
  }

  private async sleepByFire(): Promise<void> {
    const c = this.companion;
    if (!c) return;
    this.busy = true;
    this.mode = 'fire';
    const x = LAYOUT.fire.x + COMPANION_FLOW.fireSleepDx;
    await c.followTo(x);
    c.y = groundTopAt(x);
    c.setFacing(-1);
    await c.sleep();
    this.busy = false;
  }

  // ---------- helpers ----------

  private ensure(x: number, y: number): Companion {
    if (!this.companion) {
      this.companion = new Companion(this.camp, x, y);
      this.companion.setData('baseScale', 1);
      if (this.lastTint) this.companion.setTint(this.lastTint);
    }
    return this.companion;
  }
}
