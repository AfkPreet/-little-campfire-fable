/**
 * Interactable.ts: tappable things in the Camp world (tent spots, pegs, the tent, the fire ring, forage spots...).
 *
 * The manager owns one transparent Phaser Zone per interactable (in the clearing's front layer, above actors) and up
 * to LAYOUT.interactMaxGlow breathing rings on the nearest interactables within LAYOUT.interactRange of the hero.
 *
 * Tap routing (Camp scene, on `pointerup`, see CampScene.onPointerUp):
 *  1. Taps the HUD already handled must not fall through. Guard chosen: Camp asks the HUD scene's input plugin
 *     `hud.input.hitTestPointer(pointer)`; a non-empty hit list (button, bubble, modal backdrop) swallows the tap.
 *     The HUD needs no cooperation beyond making its widgets interactive, which the UI kit already does.
 *  2. A Zone's own `pointerup` claims the pointer (`claimedPointerId`) and routes to its interactable: walk the hero
 *     within `radius`, then `onTap(camp)` or show `actionsFor()` as a bubble.
 *  3. Otherwise Camp checks water (fishing hook), the laterite path (shop) and plain ground (walk).
 */
import Phaser from 'phaser';
import { LAYOUT } from '@/world/layout';
import { breathingRing, ensureUiTextures } from '@/ui/kit';
import type { BubbleAction } from '@/ui/Bubble';

/** The slice of the Camp scene the interactables and systems code against (avoids importing the scene class). */
export interface CampContext {
  hero: { x: number; y: number };
  walkHeroTo(x: number): Promise<void>;
  showActions(worldX: number, worldY: number, actions: BubbleAction[]): void;
  hideActions(): void;
}

export interface Interactable {
  id: string;
  x: number;
  y: number;
  /** The hero walks to within this many px before acting. */
  radius: number;
  /** Hit area centered on (x, y - h/2); each side at least MIN_HIT. */
  hit: { w: number; h: number };
  /** Short label for the glow ring (null = ring only). */
  labelFor(): string | null;
  /** Bubble actions when tapped (ignored when onTap is set). */
  actionsFor(): BubbleAction[];
  /** Custom tap behaviour (runs after the hero arrives). */
  onTap?(camp: CampContext): void;
  /** Show a glow ring when near (default true). */
  glow?: boolean;
}

/** Touch targets are 44 px or larger. */
export const MIN_HIT = 44;

type Entry = { i: Interactable; zone: Phaser.GameObjects.Zone };

export class InteractableManager {
  private readonly entries = new Map<string, Entry>();
  private readonly rings: Phaser.GameObjects.Image[] = [];
  private readonly ringFor = new Map<string, Phaser.GameObjects.Image>();
  /** Pointer id claimed by a zone this tap (the scene-level handler then skips it). */
  claimedPointerId: number | null = null;
  /** Interactable tapped this frame, read by the Camp pointerup handler. */
  pending: Interactable | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    /** world layer the zones and rings go into (above actors) */
    private readonly layer: Phaser.GameObjects.Container,
  ) {
    ensureUiTextures(scene);
    for (let k = 0; k < LAYOUT.interactMaxGlow; k++) {
      const r = breathingRing(scene, 0, 0);
      r.setVisible(false);
      layer.add(r);
      this.rings.push(r);
    }
  }

  register(i: Interactable): void {
    this.unregister(i.id);
    const w = Math.max(MIN_HIT, i.hit.w), h = Math.max(MIN_HIT, i.hit.h);
    const zone = this.scene.make.zone({ x: i.x, y: i.y - h / 2, width: w, height: h, add: false });
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.claimedPointerId = p.id;
      this.pending = i;
    });
    this.layer.add(zone);
    this.entries.set(i.id, { i, zone });
  }

  unregister(id: string): void {
    const e = this.entries.get(id);
    if (!e) return;
    e.zone.destroy();
    this.entries.delete(id);
  }

  get(id: string): Interactable | undefined {
    return this.entries.get(id)?.i;
  }

  all(): Interactable[] {
    return [...this.entries.values()].map((e) => e.i);
  }

  /** Move an interactable (and its zone). */
  moveTo(id: string, x: number, y: number): void {
    const e = this.entries.get(id);
    if (!e) return;
    e.i.x = x;
    e.i.y = y;
    e.zone.setPosition(x, y - e.zone.height / 2);
  }

  /** Reposition the glow rings onto the nearest interactables within range of (hx, hy). */
  update(hx: number, hy: number): void {
    const near: Array<{ i: Interactable; d: number }> = [];
    for (const { i } of this.entries.values()) {
      if (i.glow === false) continue;
      const d = Phaser.Math.Distance.Between(hx, hy, i.x, i.y);
      if (d <= LAYOUT.interactRange) near.push({ i, d });
    }
    near.sort((a, b) => a.d - b.d);
    this.ringFor.clear();
    for (let k = 0; k < this.rings.length; k++) {
      const r = this.rings[k];
      const n = near[k];
      if (!n) { r.setVisible(false); continue; }
      r.setVisible(true).setPosition(n.i.x, n.i.y - Math.max(MIN_HIT, n.i.hit.h) / 2);
      this.ringFor.set(n.i.id, r);
    }
  }

  /** Ring currently glowing on an interactable (for pop effects). */
  ringOf(id: string): Phaser.GameObjects.Image | undefined {
    return this.ringFor.get(id);
  }

  /** Walk the hero to the interactable, then run its tap behaviour or show its actions. */
  async activate(camp: CampContext, i: Interactable): Promise<void> {
    const dx = i.x - camp.hero.x;
    if (Math.abs(dx) > i.radius) {
      const target = i.x - Math.sign(dx) * i.radius * 0.8;
      await camp.walkHeroTo(target);
      // the interactable may have been removed while walking (e.g. a peg after the tent sprang up)
      if (!this.entries.has(i.id)) return;
    }
    if (i.onTap) i.onTap(camp);
    else {
      const actions = i.actionsFor();
      if (actions.length) camp.showActions(i.x, i.y - Math.max(MIN_HIT, i.hit.h), actions);
    }
  }

  destroy(): void {
    for (const id of [...this.entries.keys()]) this.unregister(id);
    this.rings.forEach((r) => r.destroy());
    this.rings.length = 0;
  }
}
