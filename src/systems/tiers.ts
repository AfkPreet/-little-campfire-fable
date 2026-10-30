/**
 * tiers: the Contentment tier shows on the hero (spec section 5 "Contentment"): cozy = neutral, content = happy,
 * glowing = happy with an occasional sparkle, blissful = blissful face. Applied only while the hero is idle
 * (standing, not walking, no activity) so flows that set their own faces are not fought. A tier change toasts
 * the tier label and plays the chime (the HUD lantern already shows the tier). Per-day gains reset in endDay()
 * (resetForDawn), so the dawn handler only re-evaluates quietly.
 */
import type { CampScene } from '@/scenes/Camp';
import { getState, subscribe, tierLabel, tierOf } from '@/state';
import type { ContentmentTier } from '@/data/types';
import type { HeroExpression } from '@/entities/Hero';
import { audio } from '@/audio';
import { sparkleBurst } from '@/fx/particles';
import { isReduceMotion } from '@/fx/juice';

export const TIERS = {
  /** idle re-check cadence */
  pollMs: 1500,
  /** glowing: a sparkle burst every ~8 s */
  sparkleEveryMs: 8000,
  sparkleCount: 10,
  sparkleCountReduced: 5,
  /** sparkles pop around the hero's head */
  sparkleDy: -70,
  expression: { cozy: 'neutral', content: 'happy', glowing: 'happy', blissful: 'blissful' } as Record<ContentmentTier, HeroExpression>,
  /** faces we may overwrite when idle (others belong to a flow in progress) */
  idleFaces: ['neutral', 'happy', 'blissful'] as readonly HeroExpression[],
} as const;

export class TierFlow {
  private tier: ContentmentTier;
  private unsub: (() => void) | null = null;
  private sparkleT = 0;
  private pollT = 0;
  private quiet = false;

  constructor(private readonly camp: CampScene) {
    this.tier = tierOf(getState());
  }

  create(): void {
    const camp = this.camp;
    this.unsub = subscribe(() => this.onStore());
    camp.events.on('dawn', this.onDawn, this);
    camp.events.on('update', this.onUpdate, this);
    camp.events.once('shutdown', this.destroy, this);
    this.applyFace();
  }

  get current(): ContentmentTier {
    return this.tier;
  }

  private heroIdle(): boolean {
    const h = this.camp.hero;
    return !h.isWalking && this.camp.activity === 'none' && TIERS.idleFaces.includes(h.expression);
  }

  /** Put the tier's face on the hero if it is idle. */
  applyFace(): void {
    const face = TIERS.expression[this.tier];
    const h = this.camp.hero;
    if (this.heroIdle() && h.expression !== face) h.setExpression(face);
  }

  private onStore(): void {
    const next = tierOf(getState());
    if (next === this.tier) return;
    this.tier = next;
    this.applyFace();
    if (this.quiet) return;
    this.camp.toast(tierLabel(next));
    audio.sfx.play('chime');
  }

  /** The new day starts at the baseline: re-evaluate without the "feeling cozy" toast. */
  private onDawn(): void {
    this.quiet = true;
    this.onStore();
    this.quiet = false;
    this.sparkleT = 0;
  }

  private onUpdate(_t: number, dt: number): void {
    if (this.camp.clockPaused) return;
    this.pollT += dt;
    if (this.pollT >= TIERS.pollMs) { this.pollT = 0; this.applyFace(); }
    if (this.tier !== 'glowing') { this.sparkleT = 0; return; }
    this.sparkleT += dt;
    if (this.sparkleT >= TIERS.sparkleEveryMs) {
      this.sparkleT = 0;
      const h = this.camp.hero;
      sparkleBurst(this.camp, h.x, h.y + TIERS.sparkleDy, isReduceMotion() ? TIERS.sparkleCountReduced : TIERS.sparkleCount);
    }
  }

  destroy(): void {
    this.unsub?.();
    this.unsub = null;
    const e = this.camp.events;
    e.off('dawn', this.onDawn, this);
    e.off('update', this.onUpdate, this);
  }
}

const flows = new WeakMap<CampScene, TierFlow>();
export function installTiers(camp: CampScene): TierFlow {
  const f = new TierFlow(camp);
  flows.set(camp, f);
  f.create();
  return f;
}
export function tiersOf(camp: CampScene): TierFlow | undefined {
  return flows.get(camp);
}
