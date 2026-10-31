/**
 * decorMode: placing decor (spec section 5 "Shelter and decor"). Snap points: the tent's hang points (2/4/6) plus the
 * two jamun-branch points, the ring of ground points and the two-tree hammock point. Enter from the tent's "Decorate"
 * bubble or the backpack: a toast, soft dotted rings on the free points, a tray at the bottom of the HUD listing the
 * owned-but-unplaced decor; drag an icon into the world, it snaps to the nearest free point (60 px) with a squash;
 * drop -> placeDecor (+5 Contentment the first time, sparkles, pop). Tap a placed item -> Move / Store. Done or a tap
 * on empty ground exits. Placed decor is restored from state at Camp create and animates; gusts every 8-15 s.
 */
import Phaser from 'phaser';
import type { CampScene } from '@/scenes/Camp';
import { DEBUG } from '@/config/debug';
import { viewport } from '@/config/layout';
import { PALETTE, shade } from '@/config/palette';
import { DECOR, DECOR_BY_ID, STRINGS, fill, type DecorId, type DecorPlacement } from '@/data';
import { decorInBackpack, getState, moveDecor, placeDecor, storeDecor, subscribe } from '@/state';
import { LAYOUT, type XY } from '@/world/layout';
import { Decor, type DecorPoint, type DecorPointKind } from '@/entities/Decor';
import { paintDecorTextures, DECOR_KEYS } from '@/art/decor';
import { itemIconKey } from '@/art/items';
import { makeImg } from '@/art/pipeline';
import { Button, UI, makeText, nineCard, type BubbleAction } from '@/ui';
import { isReduceMotion, squash } from '@/fx/juice';
import { sparkleBurst } from '@/fx/particles';
import { audio } from '@/audio';

export const DECOR_MODE = {
  snapPx: 60,
  /** gusts of wind, seconds */
  gustMin: 8,
  gustMax: 15,
  lightingPollMs: 250,
  tray: { h: 96, icon: 48, cell: 68, depth: 560, bottomPad: 14, countSize: 16, labelSize: 16, doneW: 110 },
  zoneDepth: 540,
  ring: { breatheMs: 1400, breathe: 0.08, hotScale: 1.25 },
  ghostAlpha: 0.85,
  ghostScale: 1.1,
  /** screenshots: enter this long after Camp is ready */
  debugEnterMs: 300,
  tapPx: 12,
} as const;

const KIND_OF: Record<DecorPlacement, DecorPointKind> = { ground: 'ground', hang: 'hang', hang_span: 'hang', two_tree: 'two_tree' };

export interface DecorMode {
  readonly active: boolean;
  enter(initial?: DecorId): void;
  exit(): void;
  /** where the hero sits for a placed item (cushion, bookshelf, hammock), or null when it is not placed */
  sitPoint(id: DecorId): XY | null;
  placed(): readonly Decor[];
}

let current: DecorModeImpl | null = null;

/** Install on Camp create (after the tent flow). Returns the mode; also reachable through enterDecorMode(). */
export function installDecorMode(camp: CampScene): DecorMode {
  current?.destroy();
  current = new DecorModeImpl(camp);
  return current;
}
/** Enter decor mode from anywhere with a Camp running (HUD backpack, tent bubble). */
export function enterDecorMode(initial?: DecorId): void {
  current?.enter(initial);
}
/** Sit point of a placed item, for fireFlow. */
export function decorSitPoint(id: DecorId): XY | null {
  return current?.sitPoint(id) ?? null;
}

type Carry = { id: DecorId; fromPoint: string | null; ghost: Phaser.GameObjects.Image; snapped: DecorPoint | null };

class DecorModeImpl implements DecorMode {
  active = false;
  private decors = new Map<string, Decor>();
  private lastTent: unknown = undefined;
  private lightTimer: Phaser.Time.TimerEvent;
  private gustTimer: Phaser.Time.TimerEvent | null = null;
  private unsubscribe: (() => void) | null = null;
  // mode UI
  private zone: Phaser.GameObjects.Zone | null = null;
  private tray: Phaser.GameObjects.Container | null = null;
  private rings: Phaser.GameObjects.Image[] = [];
  private carry: Carry | null = null;
  private hudMove = (p: Phaser.Input.Pointer): void => this.onMove(p);
  private hudUp = (p: Phaser.Input.Pointer): void => this.onUp(p);

  constructor(private readonly camp: CampScene) {
    paintDecorTextures(camp);
    this.syncPlaced();
    this.lightTimer = camp.time.addEvent({ delay: DECOR_MODE.lightingPollMs, loop: true, callback: () => this.tick() });
    this.scheduleGust();
    this.unsubscribe = subscribe((_s, tag) => { if (tag === 'camp' || tag === 'set' || tag === 'load') this.syncPlaced(); });
    camp.events.on('dawn', this.syncPlaced, this);
    camp.events.once('shutdown', () => this.destroy());
    if (DEBUG.decor) camp.events.once('ready', () => camp.time.delayedCall(DECOR_MODE.debugEnterMs, () => this.enter()));
  }

  destroy(): void {
    this.exit();
    this.lightTimer.remove();
    this.gustTimer?.remove();
    this.unsubscribe?.();
    this.camp.events.off('dawn', this.syncPlaced, this);
    for (const d of this.decors.values()) d.destroy();
    this.decors.clear();
    if (current === this) current = null;
  }

  placed(): readonly Decor[] { return [...this.decors.values()]; }

  sitPoint(id: DecorId): XY | null {
    for (const d of this.decors.values()) if (d.id === id) return d.sitPoint();
    return null;
  }

  // ---------- points ----------
  points(): DecorPoint[] {
    const pts: DecorPoint[] = [];
    const tent = this.camp.tent;
    if (tent && !tent.isFlat) tent.hangPoints().forEach((p, i) => pts.push({ id: `tent_hang_${i}`, x: p.x, y: p.y, kind: 'hang' }));
    for (const j of LAYOUT.jamunHangPoints) pts.push({ id: j.id, x: j.x, y: j.y, kind: 'hang' });
    LAYOUT.decorPoints.forEach((p, i) => pts.push({ id: `ground_${i}`, x: p.x, y: p.y, kind: 'ground' }));
    pts.push({ id: 'hammock', x: LAYOUT.hammock.x, y: LAYOUT.hammock.y, kind: 'two_tree' });
    return pts;
  }

  /** Free points an item may snap to (its own current point counts as free while moving). */
  private freePoints(id: DecorId, except: string | null): DecorPoint[] {
    const kind = KIND_OF[DECOR_BY_ID[id].placement];
    const taken = new Set(getState().camp.placedDecor.map((d) => d.point));
    if (except) taken.delete(except);
    return this.points().filter((p) => p.kind === kind && !taken.has(p.id));
  }

  private withSpan(id: DecorId, p: DecorPoint): DecorPoint {
    if (DECOR_BY_ID[id].placement !== 'hang_span') return p;
    let best: DecorPoint | null = null, bd = Infinity;
    for (const q of this.points()) {
      if (q.kind !== 'hang' || q.id === p.id) continue;
      const d = Phaser.Math.Distance.Between(p.x, p.y, q.x, q.y);
      if (d < bd) { bd = d; best = q; }
    }
    return best ? { ...p, span: { x: best.x, y: best.y } } : p;
  }

  // ---------- world ----------
  /** Rebuild the placed decor from state (idempotent; cheap when nothing changed). */
  private syncPlaced = (): void => {
    const st = getState().camp.placedDecor;
    const pts = new Map(this.points().map((p) => [p.id, p]));
    const want = new Set<string>();
    const tentChanged = this.camp.tent !== this.lastTent;
    this.lastTent = this.camp.tent;
    for (const d of st) {
      const p = pts.get(d.point);
      if (!p) continue;
      want.add(d.point);
      const have = this.decors.get(d.point);
      if (have && have.id === d.id && !(tentChanged && d.point.startsWith('tent_'))) continue;
      have?.destroy();
      this.spawn(d.id, this.withSpan(d.id, p));
    }
    for (const [pt, d] of this.decors) if (!want.has(pt)) { d.destroy(); this.decors.delete(pt); }
    this.tick();
  };

  private spawn(id: DecorId, p: DecorPoint): Decor {
    const d = new Decor(this.camp, id, p);
    const L = this.camp.landscape;
    // hanging things sit in front of the tent; ground things sort with the actors by y
    if (p.kind === 'ground') L.addActor(d); else L.layers.clearingFront.add(d);
    this.decors.set(p.id, d);
    return d;
  }

  private tick(): void {
    const L = this.camp.clock?.lighting;
    if (!L) return;
    for (const d of this.decors.values()) d.setLighting(L);
  }

  private scheduleGust(): void {
    const s = Phaser.Math.FloatBetween(DECOR_MODE.gustMin, DECOR_MODE.gustMax);
    this.gustTimer = this.camp.time.delayedCall(s * 1000, () => {
      const strength = Phaser.Math.FloatBetween(0.6, 1);
      this.camp.events.emit('gust', strength);
      for (const d of this.decors.values()) d.gust(strength);
      this.scheduleGust();
    });
  }

  // ---------- mode ----------
  enter(initial?: DecorId): void {
    if (!this.active) {
      this.active = true;
      this.camp.hideActions();
      this.camp.standUp();
      this.camp.toast(STRINGS.camp.decorMode);
      const ui = this.camp.uiScene();
      const v = viewport();
      this.zone = ui.add.zone(v.w / 2, v.h / 2, v.w * 2, v.h * 2).setDepth(DECOR_MODE.zoneDepth).setInteractive();
      this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => this.onZoneTap(p));
      ui.input.on(Phaser.Input.Events.POINTER_MOVE, this.hudMove);
      ui.input.on(Phaser.Input.Events.POINTER_UP, this.hudUp);
      this.buildTray();
    }
    if (initial && decorInBackpack(initial) > 0) {
      const pt = this.camp.input.activePointer;
      this.pickUp(initial, null, this.camp.worldCam.getWorldPoint(pt.x, pt.y));
    }
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    this.dropCarry(false);
    this.clearRings();
    const ui = this.camp.uiScene();
    ui.input.off(Phaser.Input.Events.POINTER_MOVE, this.hudMove);
    ui.input.off(Phaser.Input.Events.POINTER_UP, this.hudUp);
    this.zone?.destroy();
    this.zone = null;
    this.tray?.destroy();
    this.tray = null;
    this.camp.hideActions();
  }

  // ---------- tray ----------
  private buildTray(): void {
    const ui = this.camp.uiScene();
    this.tray?.destroy();
    const T = DECOR_MODE.tray, v = viewport();
    const items = DECOR.filter((d) => decorInBackpack(d.id) > 0);
    const listW = Math.max(T.cell * 2, items.length * T.cell);
    const w = Math.min(v.w - UI.pad * 2, listW + T.doneW + UI.pad * 3);
    const h = T.h;
    const c = ui.add.container(v.w / 2, v.h - T.bottomPad - h / 2).setDepth(T.depth);
    this.tray = c;
    c.add(nineCard(ui, 0, 0, w, h, false));
    c.add(makeText(ui, -w / 2 + UI.pad, -h / 2 + 8, STRINGS.decorExtras.tray, { size: T.labelSize, weight: 700, color: shade(PALETTE.ink, 0.15) }).setOrigin(0, 0));
    const left = -w / 2 + UI.pad;
    if (items.length === 0) {
      c.add(makeText(ui, left, 10, STRINGS.decorExtras.trayEmpty, { size: T.labelSize, color: shade(PALETTE.ink, 0.25) }).setOrigin(0, 0.5));
    }
    items.forEach((d, i) => {
      const x = left + i * T.cell + T.cell / 2, y = 10;
      const ic = makeImg(ui, x, y, itemIconKey(d.id));
      const b = ic.getData('baseScale') as number;
      ic.setScale(b * (T.icon / Math.max(ic.width * b, 1)));
      ic.setData('baseScale', ic.scaleX);
      ic.setInteractive({ useHandCursor: true });
      ic.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
        squash(ui, ic, 0.12);
        this.pickUp(d.id, null, this.camp.worldCam.getWorldPoint(p.x, p.y));
      });
      const n = makeText(ui, x + T.icon / 2 - 2, y + T.icon / 2 - 4, fill(STRINGS.hudExtras.count, { Count: decorInBackpack(d.id) }), { size: T.countSize, weight: 700, color: PALETTE.ink }).setOrigin(1, 1);
      c.add([ic, n]);
    });
    c.add(new Button(ui, w / 2 - UI.pad - T.doneW / 2, 0, STRINGS.decorExtras.done, () => this.exit(), { kind: 'primary', width: T.doneW, height: UI.pillH }));
  }

  // ---------- rings ----------
  private showRings(id: DecorId, except: string | null): void {
    this.clearRings();
    const layer = this.camp.landscape.layers.clearingFront;
    for (const p of this.freePoints(id, except)) {
      const r = makeImg(this.camp, p.x, p.y, DECOR_KEYS.snapRing).setAlpha(0.85);
      r.setData('pointId', p.id);
      layer.add(r);
      this.rings.push(r);
      if (!isReduceMotion()) {
        const b = r.getData('baseScale') as number;
        this.camp.tweens.add({ targets: r, scale: b * (1 + DECOR_MODE.ring.breathe), duration: DECOR_MODE.ring.breatheMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }
  }
  private clearRings(): void {
    for (const r of this.rings) { this.camp.tweens.killTweensOf(r); r.destroy(); }
    this.rings = [];
  }
  private hotRing(pointId: string | null): void {
    for (const r of this.rings) {
      const hot = r.getData('pointId') === pointId;
      const b = r.getData('baseScale') as number;
      if (hot) { this.camp.tweens.killTweensOf(r); r.setScale(b * DECOR_MODE.ring.hotScale).setAlpha(1); }
      else if (r.alpha === 1) { r.setScale(b).setAlpha(0.85); }
    }
  }

  // ---------- carrying ----------
  private pickUp(id: DecorId, fromPoint: string | null, at: XY): void {
    this.dropCarry(false);
    this.camp.hideActions();
    const ghost = makeImg(this.camp, at.x, at.y, itemIconKey(id)).setAlpha(DECOR_MODE.ghostAlpha);
    const b = (ghost.getData('baseScale') as number) * DECOR_MODE.ghostScale;
    ghost.setScale(b).setData('baseScale', b);
    this.camp.landscape.layers.clearingFront.add(ghost);
    this.carry = { id, fromPoint, ghost, snapped: null };
    this.showRings(id, fromPoint);
    audio.sfx.play('squish');
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const c = this.carry;
    if (!c || !p.isDown) return;
    const w = this.camp.worldCam.getWorldPoint(p.x, p.y);
    const snap = this.nearest(c, w);
    if (snap !== c.snapped) {
      c.snapped = snap;
      this.hotRing(snap?.id ?? null);
      if (snap) { squash(this.camp, c.ghost, 0.15); audio.sfx.play('tok', { volume: 0.5 }); }
    }
    if (snap) {
      const ty = snap.kind === 'hang' ? snap.y + 24 : snap.y - 20;
      if (isReduceMotion()) c.ghost.setPosition(snap.x, ty);
      else { c.ghost.x += (snap.x - c.ghost.x) * 0.5; c.ghost.y += (ty - c.ghost.y) * 0.5; }
    } else c.ghost.setPosition(w.x, w.y);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const c = this.carry;
    if (!c) return;
    // a tap right after Move picks the drop point under the finger
    if (!c.snapped) { const w = this.camp.worldCam.getWorldPoint(p.x, p.y); c.snapped = this.nearest(c, w); }
    this.dropCarry(true);
  }

  private nearest(c: Carry, w: XY): DecorPoint | null {
    let best: DecorPoint | null = null, bd: number = DECOR_MODE.snapPx;
    for (const pt of this.freePoints(c.id, c.fromPoint)) {
      const d = Phaser.Math.Distance.Between(pt.x, pt.y, w.x, w.y);
      if (d <= bd) { bd = d; best = pt; }
    }
    return best;
  }

  /** Drop what is carried: place/move at the snapped point, or put it back (tray or its old point). */
  private dropCarry(commit: boolean): void {
    const c = this.carry;
    if (!c) return;
    this.carry = null;
    this.clearRings();
    c.ghost.destroy();
    const snap = commit ? c.snapped : null;
    if (snap) {
      const ok = c.fromPoint ? moveDecor(c.fromPoint, snap.id) : placeDecor(c.id, snap.id).placed;
      if (ok) {
        // the store notified 'camp' synchronously, so syncPlaced has already spawned it (and removed the old one)
        const d = this.decors.get(snap.id) ?? this.spawn(c.id, this.withSpan(c.id, snap));
        this.tick();
        squash(this.camp, d, 0.15);
        const r = d.hitRect();
        sparkleBurst(this.camp, r.x + r.w / 2, r.y + r.h / 2, 10);
        audio.sfx.play('pop');
        if (this.active) this.buildTray();
        return;
      }
    }
    if (c.fromPoint) {
      // back where it was
      const p = this.points().find((q) => q.id === c.fromPoint);
      if (p && !this.decors.has(p.id)) this.spawn(c.id, this.withSpan(c.id, p));
    } else if (this.active) this.buildTray();
  }

  // ---------- taps ----------
  private onZoneTap(p: Phaser.Input.Pointer): void {
    if (this.carry || p.getDistance() > DECOR_MODE.tapPx) return;
    const w = this.camp.worldCam.getWorldPoint(p.x, p.y);
    for (const d of this.decors.values()) {
      const r = d.hitRect();
      if (w.x >= r.x && w.x <= r.x + r.w && w.y >= r.y && w.y <= r.y + r.h) { this.showItemBubble(d); return; }
    }
    this.exit();
  }

  private showItemBubble(d: Decor): void {
    const r = d.hitRect();
    const acts: BubbleAction[] = [
      { label: STRINGS.decorExtras.move, onPick: () => {
        const pt = d.point;
        d.destroy();
        this.decors.delete(pt.id);
        this.pickUp(d.id, pt.id, { x: pt.x, y: pt.kind === 'hang' ? pt.y + 24 : pt.y - 20 });
      } },
      { label: STRINGS.decorExtras.store, onPick: () => {
        this.camp.hideActions();
        if (storeDecor(d.point.id)) {
          sparkleBurst(this.camp, r.x + r.w / 2, r.y + r.h / 2, 6);
          audio.sfx.play('squish');
          this.decors.get(d.point.id)?.destroy();
          this.decors.delete(d.point.id);
          this.camp.toast(STRINGS.decorExtras.stored);
          this.buildTray();
        }
      } },
    ];
    this.camp.showActions(r.x + r.w / 2, r.y, acts);
  }
}
