/**
 * foraging: one Interactable per clearing spot (LAYOUT.forageSpots mapped onto data FORAGE_SPOTS). Tap -> walk there
 * -> a little pick hop -> 1-3 items arc into the hero's sling bag with sparkle trails -> addForage + "+n Item".
 * A spot picked today shows no glow ring and says so; spots regrow on the Camp 'dawn' event. Day-only spots are
 * "Asleep for the night". The moon-lily rock pool only registers when forageSpotsAvailable allows it (phase/clues).
 *
 * Installed by Camp.create(): `installForaging(this)`; the debug API reaches it through `foragingOf(camp)`.
 */
import type Phaser from 'phaser';
import type { CampScene } from '@/scenes/Camp';
import { RIG } from '@/art/hero';
import { iconFor } from '@/art/items';
import { img } from '@/art/pipeline';
import { FORAGE_BY_ID, FORAGE_SPOTS, STRINGS, fill, forageAvailable, rollForageYield } from '@/data';
import type { ForageId, ForageSpot as DataSpot } from '@/data/types';
import { addForage, getRng, getState, markDirty, phaseOf } from '@/state';
import { LAYOUT, type ForageKind, type ForageSpot as LayoutSpot } from '@/world/layout';
import type { Interactable } from '@/world/Interactable';
import { audio } from '@/audio';
import { isReduceMotion, squash } from '@/fx/juice';
import { sparkleTrail } from '@/fx/particles';

export const FORAGE_FLOW = {
  radius: 70,
  hit: { thicket: { w: 110, h: 70 }, log: { w: 110, h: 50 }, lemongrass: { w: 90, h: 70 }, jackfruit: { w: 90, h: 120 }, rockPool: { w: 120, h: 50 } } as Record<ForageKind, { w: number; h: number }>,
  /** where items spawn above a spot's base */
  spawnDy: { thicket: -42, log: -26, lemongrass: -40, jackfruit: -150, rockPool: -14 } as Record<ForageKind, number>,
  spawnJitter: 22,
  staggerMs: 140,
  arcMs: 620,
  iconScale: 0.8,
} as const;

/** LAYOUT kinds -> data spot kinds. */
const KIND_MAP: Record<ForageKind, DataSpot['kind']> = {
  thicket: 'berry_bush', log: 'mushroom_log', lemongrass: 'herb_patch', jackfruit: 'nut_tree', rockPool: 'shore',
};

type Spot = { layout: LayoutSpot; data: DataSpot };

const flows = new WeakMap<Phaser.Scene, ForagingFlow>();
export function foragingOf(camp: CampScene): ForagingFlow | undefined { return flows.get(camp); }

export function installForaging(camp: CampScene): ForagingFlow {
  const flow = new ForagingFlow(camp);
  flows.set(camp, flow);
  flow.create();
  camp.events.once('shutdown', () => { flow.destroy(); flows.delete(camp); });
  return flow;
}

/** Pair each LAYOUT spot with a data spot of the matching kind, in order (thicket-1 -> berry_bush_1, ...). */
export function pairSpots(): Spot[] {
  const used = new Set<string>();
  const out: Spot[] = [];
  for (const layout of LAYOUT.forageSpots) {
    const kind = KIND_MAP[layout.kind];
    const data = FORAGE_SPOTS.find((d) => d.kind === kind && !used.has(d.id));
    if (!data) continue;
    used.add(data.id);
    out.push({ layout, data });
  }
  return out;
}

export class ForagingFlow {
  readonly spots: Spot[] = pairSpots();
  /** data spot id -> day it was picked */
  readonly pickedDay = new Map<string, number>();
  private readonly registered = new Set<string>();
  private busy = false;
  private readonly onDawn = (): void => { this.pickedDay.clear(); this.refresh(); };
  private readonly onPhase = (): void => this.refresh();

  constructor(private readonly camp: CampScene) {}

  create(): void {
    this.refresh();
    this.camp.events.on('dawn', this.onDawn);
    this.camp.events.on('phase', this.onPhase);
  }

  destroy(): void {
    this.camp.events.off('dawn', this.onDawn);
    this.camp.events.off('phase', this.onPhase);
  }

  /** Register the spots that exist right now (the rock pool only when the Moon Lily is unlocked and it is night). */
  refresh(): void {
    const s = getState();
    const ctx = { phase: phaseOf(s), cluesFound: s.journal.mystery.step };
    for (const spot of this.spots) {
      const f = FORAGE_BY_ID[spot.data.yields];
      const gated = f.unlockAfterClue !== undefined;
      const present = !gated || forageAvailable(spot.data.yields, ctx);
      const id = spot.data.id;
      if (present && !this.registered.has(id)) {
        this.camp.registerInteractable(this.interactableFor(spot));
        this.registered.add(id);
      } else if (!present && this.registered.has(id)) {
        this.camp.unregisterInteractable(id);
        this.registered.delete(id);
      }
      const i = this.camp.interactables.get(id);
      if (i) i.glow = !this.isPicked(id);
    }
  }

  isPicked(id: string): boolean {
    return this.pickedDay.get(id) === getState().day;
  }

  /**
   * Resolve a spot by data id or layout id. Without an id: the herb patch when it is unpicked (the one spot in season
   * at every phase, so scripts get a deterministic default), else the first unpicked spot available right now.
   */
  find(spotId?: string): Spot | undefined {
    if (spotId) return this.spots.find((s) => s.data.id === spotId || s.layout.id === spotId);
    const s = getState();
    const ctx = { phase: phaseOf(s), cluesFound: s.journal.mystery.step };
    const open = (sp: Spot): boolean => this.registered.has(sp.data.id) && !this.isPicked(sp.data.id) && forageAvailable(sp.data.yields, ctx);
    const herbs = this.spots.find((sp) => sp.data.kind === 'herb_patch');
    if (herbs && open(herbs)) return herbs;
    return this.spots.find(open);
  }

  private interactableFor(spot: Spot): Interactable {
    const f = FORAGE_BY_ID[spot.data.yields];
    const { x, y } = spot.layout;
    return {
      id: spot.data.id, x, y, radius: FORAGE_FLOW.radius, hit: FORAGE_FLOW.hit[spot.layout.kind],
      labelFor: () => f.whereLabel,
      actionsFor: () => [],
      onTap: () => void this.pick(spot),
    };
  }

  /** Walk (if needed), hop, and gather. Resolves when the items have landed. */
  async forage(spotId?: string): Promise<{ id: ForageId; n: number } | null> {
    const spot = this.find(spotId);
    if (!spot) return null;
    const dx = spot.layout.x - this.camp.hero.x;
    if (Math.abs(dx) > FORAGE_FLOW.radius) await this.camp.walkHeroTo(spot.layout.x - Math.sign(dx) * FORAGE_FLOW.radius * 0.8);
    return this.pick(spot);
  }

  private async pick(spot: Spot): Promise<{ id: ForageId; n: number } | null> {
    if (this.busy) return null;
    const camp = this.camp, hero = camp.hero;
    const s = getState();
    const id = spot.data.id, yields = spot.data.yields;
    const f = FORAGE_BY_ID[yields];
    if (this.isPicked(id)) {
      audio.sfx.play('nope');
      camp.toast(STRINGS.foraging.pickedOut);
      return null;
    }
    if (!forageAvailable(yields, { phase: phaseOf(s), cluesFound: s.journal.mystery.step })) {
      audio.sfx.play('nope');
      camp.toast(STRINGS.foraging.asleep);
      return null;
    }
    this.busy = true;
    try {
      hero.setFacing(spot.layout.x >= hero.x ? 1 : -1);
      void hero.react('happy');
      squash(camp, hero, 0.12, 220);
      audio.sfx.play('squish');

      const rainedRecently = s.weather.raining || s.weather.kind === 'rain' || s.flags.lastRainyNight === s.day - 1;
      const n = rollForageYield(getRng(), yields, { rainedRecently });
      const rm = isReduceMotion();
      const key = iconFor(camp, yields, 'forage');
      const x0 = spot.layout.x, y0 = spot.layout.y + FORAGE_FLOW.spawnDy[spot.layout.kind];
      const bag = hero.worldPoint(RIG.bag);
      const flights: Promise<void>[] = [];
      for (let i = 0; i < n; i++) {
        const from = { x: x0 + (i - (n - 1) / 2) * FORAGE_FLOW.spawnJitter, y: y0 - (i % 2) * 10 };
        const delay = rm ? 0 : i * FORAGE_FLOW.staggerMs;
        flights.push(new Promise<void>((resolve) => {
          camp.time.delayedCall(delay, () => {
            const icon = img(camp, from.x, from.y, key);
            camp.landscape.layers.clearingFront.add(icon);
            const b = icon.scaleX * FORAGE_FLOW.iconScale;
            icon.setScale(b).setData('baseScale', b);
            squash(camp, icon, 0.15, 200);
            const land = () => {
              icon.destroy();
              audio.sfx.play('basketBounce');
              squash(camp, hero, 0.08, 180);
              resolve();
            };
            if (rm) { camp.time.delayedCall(200, land); return; }
            const to = hero.worldPoint(RIG.bag, bag);
            void sparkleTrail(camp, from, to, FORAGE_FLOW.arcMs);
            const lift = Math.abs(to.x - from.x) * 0.35 + 40;
            const prog = { t: 0 };
            camp.tweens.add({
              targets: prog, t: 1, duration: FORAGE_FLOW.arcMs, ease: 'Sine.easeInOut',
              onUpdate: () => {
                const u = 1 - prog.t, cx = (from.x + to.x) / 2, cy = Math.min(from.y, to.y) - lift;
                icon.setPosition(u * u * from.x + 2 * u * prog.t * cx + prog.t * prog.t * to.x, u * u * from.y + 2 * u * prog.t * cy + prog.t * prog.t * to.y);
              },
              onComplete: land,
            });
          });
        }));
      }
      await Promise.all(flights);
      addForage(yields, n);
      this.pickedDay.set(id, s.day);
      const i = camp.interactables.get(id);
      if (i) i.glow = false;
      markDirty();
      camp.toast(fill(STRINGS.foraging.picked, { n, Item: f.name }));
      return { id: yields, n };
    } finally {
      this.busy = false;
    }
  }
}
