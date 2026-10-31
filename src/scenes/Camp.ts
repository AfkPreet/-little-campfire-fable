/**
 * Camp: the world. Owns the Landscape (parallax), the Hero, the camera, the clock runner, the interactables and the
 * day's flows (tent, fire, rest/sleep). Fishing and foraging plug in through `hooks` and `registerInteractable`.
 *
 * Protocol: launches HUD in parallel; -> Shop via scene.start(SCENES.shop) after stopping HUD; Cooking and DaySummary
 * are overlays launched by the flows (see systems/fireFlow.ts, systems/restFlow.ts).
 * Events on `this.events`: 'phase' (DayPhase), 'dawn', 'night', 'weather', 'ready', 'cooking:closed', 'summary:closed'.
 */
import Phaser from 'phaser';
import { SCENES } from '@/scenes/Boot';
import { applyViewport, LOGICAL_H } from '@/config/layout';
import { getState, setHero } from '@/state';
import { Landscape } from '@/world/Landscape';
import { GROUND_Y, LAYOUT, WORLD_WIDTH, groundTopAt } from '@/world/layout';
import { InteractableManager, type CampContext, type Interactable } from '@/world/Interactable';
import { Hero } from '@/entities/Hero';
import type { Tent } from '@/entities/Tent';
import { isReduceMotion } from '@/fx/juice';
import { toast as kitToast, modal as kitModal, type BubbleAction, type ModalOpts, type OverlayHandle } from '@/ui';
import { ClockRunner } from '@/systems/clockRunner';
import { TentFlow } from '@/systems/tentFlow';
import { FireFlow } from '@/systems/fireFlow';
import { RestFlow } from '@/systems/restFlow';
import { installCampApi, type CampApi } from '@/systems/campApi';
import { installFishing } from '@/systems/fishing';
import { installForaging } from '@/systems/foraging';
import { installWeather } from '@/systems/weatherFlow';
import { installTiers } from '@/systems/tiers';
import { installMoments } from '@/systems/moments';
import { installDecorMode } from '@/systems/decorMode';
import { installCompanion } from '@/systems/companionFlow';

/** Camera and input tuning for the Camp scene. */
export const CAMP = {
  followLerp: 0.08,
  /** a pointer that moved more than this is a drag, not a tap */
  dragPx: 12,
  /** where the hero stands on a fresh trip (state.hero.x === 0) */
  startX: LAYOUT.bamboo.x,
  /** the hero stops here before heading up the path to the shop */
  shopExitX: LAYOUT.path.x1,
  /** world x the hero is saved at when leaving to the shop (so they return at the gate) */
  shopReturnX: LAYOUT.path.x1 + 40,
  readyDelayMs: 600,
} as const;

/** What the hero is doing in a pose that taps elsewhere should end. */
export type HeroActivity = 'none' | 'fireSit' | 'rest';

/** Hooks for the fishing / foraging agents. */
export type CampHooks = {
  /** Tap on water (world point). Set by the fishing system. */
  onWaterTap?: (x: number, y: number) => void;
  /** The hero is about to walk/act: let a flow cancel its own state (e.g. reel in). */
  onInterrupt?: () => void;
};

/** HUD scene surface Camp talks to (methods are optional: the HUD is another module). */
type HudLike = Phaser.Scene & {
  showBubble?: (sx: number, sy: number, actions: BubbleAction[]) => void;
  hideBubble?: () => void;
};

export class CampScene extends Phaser.Scene implements CampContext {
  landscape!: Landscape;
  hero!: Hero;
  worldCam!: Phaser.Cameras.Scene2D.Camera;
  interactables!: InteractableManager;
  clock!: ClockRunner;
  tentFlow!: TentFlow;
  fireFlow!: FireFlow;
  restFlow!: RestFlow;
  api!: CampApi;
  hooks: CampHooks = {};
  activity: HeroActivity = 'none';
  /** The pitched (or pitching) tent, if any. */
  tent: Tent | null = null;

  private readonly pauseReasons = new Set<string>();
  private walkSeq = 0;
  private leaving = false;
  private onViewport = (): void => this.layout();

  constructor() {
    super(SCENES.camp);
  }

  // ---------- lifecycle ----------
  create(): void {
    this.leaving = false;
    this.pauseReasons.clear();
    this.worldCam = this.cameras.main;
    this.layout();
    this.game.events.on('viewport', this.onViewport);

    this.landscape = new Landscape(this, { parallax: true });
    const st = getState();
    const hx = st.hero.x > 0 ? st.hero.x : CAMP.startX;
    this.hero = new Hero(this, hx, groundTopAt(hx));
    this.hero.setFacing(st.hero.facing);
    this.hero.startIdle();
    this.landscape.addActor(this.hero);
    this.interactables = new InteractableManager(this, this.landscape.layers.clearingFront);

    this.worldCam.startFollow(this.hero, true, isReduceMotion() ? 1 : CAMP.followLerp, isReduceMotion() ? 1 : CAMP.followLerp);
    this.worldCam.centerOn(hx, LOGICAL_H / 2);

    this.scene.launch(SCENES.hud);

    this.clock = new ClockRunner(this);
    this.tentFlow = new TentFlow(this);
    this.fireFlow = new FireFlow(this);
    this.restFlow = new RestFlow(this);
    this.tentFlow.create();
    this.fireFlow.create();
    this.restFlow.create();
    this.clock.applyNow();

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.events.once('shutdown', this.shutdown, this);

    installFishing(this);
    installForaging(this);
    installWeather(this);
    installTiers(this);
    installMoments(this);
    installDecorMode(this);
    installCompanion(this);
    this.api = installCampApi(this);
    this.time.delayedCall(CAMP.readyDelayMs, () => {
      window.__game.ready = true;
      this.events.emit('ready');
    });
  }

  update(_t: number, dt: number): void {
    if (this.leaving) return;
    this.hero.y = groundTopAt(this.hero.x);
    this.clock.update(dt);
    this.interactables.update(this.hero.x, this.hero.y);
    this.landscape.sortActors();
  }

  private layout(): void {
    applyViewport(this, this.worldCam);
    this.worldCam.setBounds(0, 0, WORLD_WIDTH, LOGICAL_H);
  }

  private shutdown(): void {
    this.game.events.off('viewport', this.onViewport);
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.off('pointerup', this.onPointerUp, this);
    this.clock.destroy();
    this.interactables.destroy();
    this.landscape.destroy();
  }

  // ---------- public contract (docs/M1_PLAN.md) ----------
  registerInteractable(i: Interactable): void {
    this.interactables.register(i);
  }
  unregisterInteractable(id: string): void {
    this.interactables.unregister(id);
  }

  pauseClock(reason: string): void {
    this.pauseReasons.add(reason);
    this.clock.onPauseChanged(true);
  }
  resumeClock(reason: string): void {
    this.pauseReasons.delete(reason);
    this.clock.onPauseChanged(this.pauseReasons.size > 0);
  }
  get clockPaused(): boolean {
    return this.pauseReasons.size > 0;
  }

  /** World -> screen (HUD space): every camera shares the viewport zoom and the HUD never scrolls. */
  worldToScreen(x: number, y: number): { x: number; y: number } {
    const v = this.worldCam.worldView;
    return { x: x - v.x, y: y - v.y };
  }

  hud(): HudLike | null {
    const s = this.scene.get(SCENES.hud) as HudLike | null;
    return s && s.scene.isActive() ? s : null;
  }
  /** Scene that hosts fixed-camera UI (toasts, modals): the HUD when it runs, else Camp. */
  uiScene(): Phaser.Scene {
    return this.hud() ?? this;
  }
  toast(message: string): void {
    kitToast(this.uiScene(), message);
  }
  modal(opts: ModalOpts): OverlayHandle {
    return kitModal(this.uiScene(), opts);
  }

  showActions(worldX: number, worldY: number, actions: BubbleAction[]): void {
    const p = this.worldToScreen(worldX, worldY);
    this.hud()?.showBubble?.(p.x, p.y, actions);
  }
  hideActions(): void {
    this.hud()?.hideBubble?.();
  }

  /** Walk the hero; a newer walk or interruption resolves the older promise early. Saves hero x on arrival. */
  async walkHeroTo(x: number): Promise<void> {
    const seq = ++this.walkSeq;
    this.standUp();
    const target = Phaser.Math.Clamp(x, LAYOUT.path.x0 + 20, WORLD_WIDTH - 40);
    await this.hero.walkTo(target);
    if (seq !== this.walkSeq) return;
    setHero(this.hero.x, this.hero.facing);
  }

  /** End a sit/rest pose (taps elsewhere, walks). */
  standUp(): void {
    if (this.activity === 'none') return;
    this.activity = 'none';
    this.hero.setPose('stand');
    this.hideActions();
  }

  /** Leave for the shop: walk to the path, stop HUD, start Shop. */
  async leaveForShop(): Promise<void> {
    if (this.leaving) return;
    this.hideActions();
    await this.walkHeroTo(CAMP.shopExitX);
    if (this.leaving) return;
    this.leaving = true;
    this.clock.persist();
    setHero(CAMP.shopReturnX, 1);
    this.scene.stop(SCENES.hud);
    this.scene.start(SCENES.shop);
  }

  // ---------- input routing (see world/Interactable.ts header) ----------
  private onPointerDown(): void {
    this.interactables.claimedPointerId = null;
    this.interactables.pending = null;
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.leaving) return;
    const hud = this.hud();
    if (hud && hud.input.hitTestPointer(pointer).length > 0) return; // HUD swallowed it
    if (pointer.getDistance() > CAMP.dragPx) return; // a drag, not a tap
    const im = this.interactables;
    if (im.claimedPointerId === pointer.id && im.pending) {
      const i = im.pending;
      im.pending = null;
      this.hideActions();
      this.hooks.onInterrupt?.();
      void im.activate(this, i);
      return;
    }
    this.hideActions();
    const wx = pointer.worldX, wy = pointer.worldY;
    const Z = LAYOUT.fishingZone, J = LAYOUT.jetty;
    const inWater = (wx > LAYOUT.shore.x && wy > Z.y0 && wy < Z.y1) ||
      (wx >= J.x0 && wx <= J.x1 && Math.abs(wy - J.deckY) < 60);
    if (inWater) {
      this.standUp();
      if (this.hooks.onWaterTap) { this.hooks.onWaterTap(wx, wy); return; }
      void this.walkHeroTo(Math.min(wx, LAYOUT.shore.x));
      return;
    }
    this.hooks.onInterrupt?.();
    if (wx < LAYOUT.path.tapX) { void this.leaveForShop(); return; }
    void this.walkHeroTo(wx);
  }

  /** Ground y under a world x (hero and props stand here). */
  groundAt(x: number): number {
    return x >= 0 ? groundTopAt(x) : GROUND_Y;
  }
}
