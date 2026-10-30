/**
 * tentFlow: the three flat spots -> pick one -> the tent lies flat -> tap 4 pegs -> it springs up -> "Home sweet home!"
 * Owns the Tent entity in the Camp and its spot / peg interactables. The pitched tent's own Rest / Sleep actions come
 * from restFlow (registered through `camp.restFlow.tentActions`).
 */
import type Phaser from 'phaser';
import type { CampScene } from '@/scenes/Camp';
import { Tent } from '@/entities/Tent';
import { choosePitchSpot, getState, pitchTent, tapPeg, TENT_PEGS } from '@/state';
import { STRINGS, fill, worldVars } from '@/data';
import type { TentId } from '@/data/types';
import { LAYOUT } from '@/world/layout';
import { GROUND_KEYS } from '@/art/landscape/ground';
import { audio } from '@/audio';
import { sparkleBurst } from '@/fx/particles';
import type { Interactable } from '@/world/Interactable';

export const TENT_FLOW = {
  spotHit: { w: 170, h: 60 },
  pegHit: { w: 44, h: 44 },
  spotRadius: 70,
  pegRadius: 60,
  /** best tent first: the one pitched when several are owned */
  tentOrder: ['tent_cabin', 'tent_dome', 'tent_leaf'] as readonly TentId[],
  springSparkles: 18,
} as const;

export class TentFlow {
  private pickHintShown = false;

  constructor(private readonly camp: CampScene) {}

  create(): void {
    LAYOUT.tentSpots.forEach((sp, i) => this.registerSpot(i, sp.x, sp.y));
    const c = getState().camp;
    if (c.tentId !== null && c.tentSpot !== null) {
      const spot = c.tentSpot;
      const tent = this.makeTent(c.tentId, spot);
      if (c.pitched) this.finishPitched(tent, spot, false);
      else {
        tent.layFlat();
        this.registerPegs(tent, spot);
      }
    }
  }

  /** The best tent in the backpack, or null. */
  ownedTent(): TentId | null {
    const gear = getState().inventory.gear;
    return TENT_FLOW.tentOrder.find((id) => gear[id]) ?? null;
  }

  private registerSpot(i: number, x: number, y: number): void {
    const id = `tent-spot-${i}`;
    const spot: Interactable = {
      id, x, y, radius: TENT_FLOW.spotRadius, hit: TENT_FLOW.spotHit,
      labelFor: () => null,
      actionsFor: () => [],
      onTap: () => this.onSpotTap(i),
    };
    this.camp.registerInteractable(spot);
  }

  private onSpotTap(i: number): void {
    const c = getState().camp;
    if (c.tentId !== null) return; // already pitching or pitched
    const tentId = this.ownedTent();
    if (!tentId) {
      audio.sfx.play('nope');
      this.camp.toast(fill(STRINGS.campShell.needTent, worldVars()));
      return;
    }
    if (!this.pickHintShown) {
      this.pickHintShown = true;
      this.camp.toast(STRINGS.camp.pickSpot);
    }
    if (!choosePitchSpot(tentId, i)) return;
    const tent = this.makeTent(tentId, i);
    tent.layFlat();
    this.camp.toast(STRINGS.camp.tapPegs);
    this.registerPegs(tent, i);
  }

  private makeTent(tentId: TentId, spot: number): Tent {
    const sp = LAYOUT.tentSpots[spot];
    const tent = new Tent(this.camp, tentId, sp.x, sp.y);
    this.camp.landscape.addActor(tent);
    this.camp.tent = tent;
    for (let k = 0; k < LAYOUT.tentSpots.length; k++) this.camp.unregisterInteractable(`tent-spot-${k}`);
    this.setSpotMarkersVisible(false);
    return tent;
  }

  private registerPegs(tent: Tent, spot: number): void {
    const tapped = getState().camp.pegsTapped;
    for (let i = tapped; i < TENT_PEGS; i++) {
      const p = tent.pegPoint(i);
      this.camp.registerInteractable({
        id: `tent-peg-${i}`, x: p.x, y: p.y + 6, radius: TENT_FLOW.pegRadius, hit: TENT_FLOW.pegHit,
        labelFor: () => null,
        actionsFor: () => [],
        onTap: () => this.onPegTap(tent, spot, i),
      });
    }
  }

  private onPegTap(tent: Tent, spot: number, i: number): void {
    this.camp.unregisterInteractable(`tent-peg-${i}`);
    tent.peg(i);
    const n = tapPeg();
    if (n >= TENT_PEGS) void this.springUp(tent, spot);
  }

  private async springUp(tent: Tent, spot: number): Promise<void> {
    for (let i = 0; i < TENT_PEGS; i++) this.camp.unregisterInteractable(`tent-peg-${i}`);
    await tent.springUp();
    audio.sfx.play('chime');
    sparkleBurst(this.camp, tent.x, tent.y - tent.size.h / 2, TENT_FLOW.springSparkles);
    this.camp.toast(STRINGS.camp.homeSweetHome);
    pitchTent(tent.tentId, spot);
    this.finishPitched(tent, spot, true);
  }

  /** The tent stands: window glow for the phase and the Rest / Sleep interactable. */
  private finishPitched(tent: Tent, _spot: number, _fresh: boolean): void {
    tent.setNight(getState().isNight);
    const z = tent.hitZone();
    this.camp.registerInteractable({
      id: 'tent', x: z.x, y: z.y, radius: tent.size.w / 2 + 20, hit: { w: z.w, h: z.h },
      labelFor: () => STRINGS.bubbles.rest,
      actionsFor: () => this.camp.restFlow.tentActions(tent),
    });
  }

  /** Hide / show the dotted spot ellipses the Landscape paints into its ground layer. */
  private setSpotMarkersVisible(v: boolean): void {
    const ground = this.camp.landscape.layers.ground;
    ground.each((o: Phaser.GameObjects.GameObject) => {
      const im = o as Phaser.GameObjects.Image;
      if (im.texture && im.texture.key === GROUND_KEYS.tentSpot) im.setVisible(v);
    });
  }
}
