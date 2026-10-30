/**
 * Particle FX: fireflies, rain, embers, steam, sparkles, dust, petals, stars, hearts and notes.
 *
 * Budget: at most ~400 live particles across the game (200 under Reduce motion), tracked by `particleBudget`.
 * Every factory reserves its slots and releases them on destroy(); emitters get `maxAliveParticles` from the grant.
 *
 * Phaser 3.90 APIs used (verified against node_modules/phaser/types/phaser.d.ts):
 *   scene.add.particles(x, y, texture, ParticleEmitterConfig) -> ParticleEmitter
 *   emitter.setFrequency / setQuantity / explode / emitParticleAt / start / stop / killAll / getAliveParticleCount
 *   emitter ops: EmitterOpRandomMinMaxConfig {min,max}, EmitterOpEaseConfig {start,end,ease}, EmitterOpCustomUpdateConfig {onEmit,onUpdate}
 *   emitZone: ParticleEmitterRandomZoneConfig { type:'random', source: Geom.Rectangle }
 *   deathZone: ParticleEmitterDeathZoneConfig { type:'onEnter', source: Geom.Rectangle }
 *
 * Nothing moves linearly except rain (rain emitters have no easing by design).
 */
import Phaser from 'phaser';
import { ART_SCALE, makeImg, img } from '@/art/pipeline';
import { isReduceMotion, popIn } from '@/fx/juice';
import { FX_KEYS, paintFxTextures } from '@/fx/textures';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
type Particle = Phaser.GameObjects.Particles.Particle;

export type Bounds = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

/** Base display scale for 2x-painted textures. */
const B = 1 / ART_SCALE;
const TAU = Math.PI * 2;
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
/** Deterministic pseudo-random in [0,1) from a particle's own random lifespan (no allocations, no state). */
const hash01 = (p: Particle, salt: number): number => {
  const v = Math.sin(p.life * 0.7131 + salt * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};
const backOut = (t: number): number => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// ---------------------------------------------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------------------------------------------

export class ParticleBudget {
  static readonly MAX_LIVE = 400;
  private reserved = 0;

  /** Current cap: 400, or 200 under Reduce motion. */
  get max(): number {
    return isReduceMotion() ? ParticleBudget.MAX_LIVE / 2 : ParticleBudget.MAX_LIVE;
  }
  /** Slots currently reserved by live effects. */
  get used(): number {
    return this.reserved;
  }
  get free(): number {
    return Math.max(0, this.max - this.reserved);
  }
  /** Halve a requested count under Reduce motion. */
  scaled(n: number): number {
    return isReduceMotion() ? Math.ceil(n / 2) : n;
  }
  /** Reserve up to n slots (already scaled for Reduce motion); returns how many were granted. */
  reserve(n: number): number {
    const granted = Math.max(0, Math.min(this.scaled(n), this.free));
    this.reserved += granted;
    return granted;
  }
  release(n: number): void {
    this.reserved = Math.max(0, this.reserved - n);
  }
}
export const particleBudget = new ParticleBudget();

// ---------------------------------------------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------------------------------------------

export type FxHandle = { destroy(): void };
export type IntensityHandle = FxHandle & { setIntensity(k: number): void };

/** Run `fn` when the scene shuts down (so handles never leak across scene changes); returns an unhook function. */
function onSceneShutdown(scene: Phaser.Scene, fn: () => void): () => void {
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, fn);
  return () => scene.events.off(Phaser.Scenes.Events.SHUTDOWN, fn);
}

/** Make a tracked reservation that releases itself once (on destroy or scene shutdown). */
function reservation(scene: Phaser.Scene, wanted: number): { n: number; release(): void } {
  let n = particleBudget.reserve(wanted);
  let unhook: (() => void) | undefined;
  const release = (): void => {
    if (n > 0) particleBudget.release(n);
    n = 0;
    unhook?.();
    unhook = undefined;
  };
  unhook = onSceneShutdown(scene, release);
  return { get n() { return n; }, release };
}

function emitterOf(scene: Phaser.Scene, key: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig): Emitter {
  paintFxTextures(scene);
  return scene.add.particles(0, 0, key, cfg);
}


/** Set an emitter's frequency from a base interval and 0..1 intensity, stopping it cleanly at 0. */
function applyIntensity(e: Emitter, baseFreqMs: number, k: number, quantity = 1): void {
  if (k <= 0.02) {
    if (e.emitting) e.stop();
    return;
  }
  e.setFrequency(baseFreqMs / k, quantity);
  if (!e.emitting) e.start();
}

/** Tween-driven sprites (hearts, notes, trails) count against the budget too. */
function tweenSprite(scene: Phaser.Scene, x: number, y: number, key: string, depth?: number): Phaser.GameObjects.Image | undefined {
  if (particleBudget.free <= 0) return undefined;
  particleBudget.reserve(1);
  paintFxTextures(scene);
  const s = img(scene, x, y, key);
  if (depth !== undefined) s.setDepth(depth);
  s.once(Phaser.GameObjects.Events.DESTROY, () => particleBudget.release(1));
  return s;
}
function killAndDestroy(scene: Phaser.Scene, s: Phaser.GameObjects.Image): void {
  scene.tweens.killTweensOf(s);
  if (s.active) s.destroy();
}

// ---------------------------------------------------------------------------------------------------------------
// Fireflies: custom pooled glow images, noise wander (sum of sines), bob and glow pulse, additive blend
// ---------------------------------------------------------------------------------------------------------------

type Fly = {
  img: Phaser.GameObjects.Image;
  bx: number; by: number; // slow-drifting anchor
  vx: number; vy: number;
  ax1: number; ax2: number; ay1: number; ay2: number; // wander amplitudes
  wx1: number; wx2: number; wy1: number; wy2: number; // wander frequencies (rad/s)
  px1: number; px2: number; py1: number; py2: number; // phases
  wb: number; pb: number; // bob
  wp: number; pp: number; // glow pulse
  size: number;
};

export type FirefliesHandle = FxHandle & {
  container: Phaser.GameObjects.Container;
  setCount(n: number): void;
  setBounds(b: Bounds): void;
  /** 0..1 overall brightness (fade in at dusk, out at dawn). */
  setIntensity(k: number): void;
  readonly count: number;
};

function makeFly(scene: Phaser.Scene, b: Bounds): Fly {
  const im = makeImg(scene, 0, 0, FX_KEYS.firefly);
  im.setBlendMode(Phaser.BlendModes.ADD);
  const size = rnd(0.55, 1.0);
  return {
    img: im,
    bx: rnd(b.x, b.x + b.w), by: rnd(b.y, b.y + b.h),
    vx: rnd(-6, 6), vy: rnd(-3, 3),
    ax1: rnd(14, 34), ax2: rnd(4, 12), ay1: rnd(8, 20), ay2: rnd(3, 9),
    wx1: rnd(0.15, 0.4) * TAU, wx2: rnd(0.5, 0.9) * TAU, wy1: rnd(0.12, 0.3) * TAU, wy2: rnd(0.45, 0.8) * TAU,
    px1: rnd(0, TAU), px2: rnd(0, TAU), py1: rnd(0, TAU), py2: rnd(0, TAU),
    wb: rnd(0.3, 0.6) * TAU, pb: rnd(0, TAU),
    wp: TAU / rnd(1.6, 4.2), pp: rnd(0, TAU),
    size,
  };
}

/**
 * A field of fireflies inside `bounds`. 20-40 at night is the spec; counts are halved under Reduce motion.
 * Animation is driven from the scene 'update' event (no per-frame allocations).
 */
export function fireflies(scene: Phaser.Scene, bounds: Bounds, count = 30): FirefliesHandle {
  paintFxTextures(scene);
  let b: Bounds = { ...bounds };
  const container = scene.add.container(0, 0);
  const pool: Fly[] = [];
  const res = reservation(scene, count);
  let active = res.n;
  let intensity = 1;
  let t = rnd(0, 100);

  const ensure = (n: number): void => {
    while (pool.length < n) {
      const f = makeFly(scene, b);
      pool.push(f);
      container.add(f.img);
    }
    pool.forEach((f, i) => f.img.setVisible(i < n));
  };
  ensure(active);

  const update = (_time: number, delta: number): void => {
    const dt = Math.min(delta, 50) / 1000;
    t += dt;
    for (let i = 0; i < active; i++) {
      const f = pool[i];
      f.bx += f.vx * dt;
      f.by += f.vy * dt;
      if (f.bx < b.x) f.bx += b.w;
      else if (f.bx > b.x + b.w) f.bx -= b.w;
      if (f.by < b.y) f.by += b.h;
      else if (f.by > b.y + b.h) f.by -= b.h;
      const x = f.bx + f.ax1 * Math.sin(f.wx1 * t + f.px1) + f.ax2 * Math.sin(f.wx2 * t + f.px2);
      const y = f.by + f.ay1 * Math.sin(f.wy1 * t + f.py1) + f.ay2 * Math.sin(f.wy2 * t + f.py2) + 3 * Math.sin(f.wb * t + f.pb);
      // glow pulse 0.3..1.0, each on its own period; squared sine gives a softer "breath" with a brighter peak
      const s = Math.sin(f.wp * t + f.pp);
      const pulse = 0.3 + 0.7 * s * s;
      f.img.setPosition(x, y);
      f.img.setAlpha(pulse * intensity);
      const sc = B * f.size * (0.75 + 0.35 * pulse);
      f.img.setScale(sc);
    }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, update);
  update(0, 16);

  const handle: FirefliesHandle = {
    container,
    get count() { return active; },
    setCount(n: number) {
      const want = particleBudget.scaled(n);
      if (want > active) {
        const extra = particleBudget.reserve(want - active);
        active += extra;
      } else {
        particleBudget.release(active - want);
        active = want;
      }
      // keep the reservation object in sync so shutdown releases the right amount
      ensure(active);
    },
    setBounds(nb: Bounds) {
      b = { ...nb };
    },
    setIntensity(k: number) {
      intensity = Phaser.Math.Clamp(k, 0, 1);
      container.setVisible(intensity > 0.001);
    },
    destroy() {
      scene.events.off(Phaser.Scenes.Events.UPDATE, update);
      // release whatever is live now (setCount adjusts the count outside the original reservation)
      particleBudget.release(active - res.n);
      res.release();
      active = 0;
      container.destroy(true);
    },
  };
  onSceneShutdown(scene, () => scene.events.off(Phaser.Scenes.Events.UPDATE, update));
  return handle;
}

// ---------------------------------------------------------------------------------------------------------------
// Rain: two linear layers, splashes at a ground line, drips off an edge
// ---------------------------------------------------------------------------------------------------------------

export type RainHandle = IntensityHandle & {
  far: Emitter;
  near: Emitter;
  splash: Emitter;
  /** Spawn small drops falling from a horizontal edge (a tent's eave) between x0 and x1 at y. */
  drips(x0: number, x1: number, y: number): FxHandle;
  setGroundY(y: number): void;
};

const RAIN_ANGLE = 8; // degrees off vertical
const RAIN_TAN = Math.tan((RAIN_ANGLE * Math.PI) / 180);

export function rain(scene: Phaser.Scene, bounds: Bounds, intensity = 1, groundY = bounds.y + bounds.h): RainHandle {
  paintFxTextures(scene);
  const farSpeed = 540, nearSpeed = 900;
  const farLife = ((bounds.h + 80) / farSpeed) * 1000;
  const nearLife = ((bounds.h + 80) / nearSpeed) * 1000;
  // Budget: far 90, near 60, splash 26, drips come from their own reservation.
  const resFar = reservation(scene, 90), resNear = reservation(scene, 60), resSplash = reservation(scene, 26);
  const topZone = new Phaser.Geom.Rectangle(bounds.x - bounds.h * RAIN_TAN - 20, bounds.y - 40, bounds.w + bounds.h * RAIN_TAN + 40, 24);

  const far = emitterOf(scene, FX_KEYS.rainB, {
    emitZone: new Phaser.GameObjects.Particles.Zones.RandomZone(topZone as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource),
    speedY: { min: farSpeed * 0.9, max: farSpeed * 1.05 },
    speedX: { min: farSpeed * RAIN_TAN * 0.9, max: farSpeed * RAIN_TAN * 1.05 },
    rotate: -RAIN_ANGLE,
    lifespan: farLife,
    alpha: { min: 0.35, max: 0.6 },
    scaleX: { min: B * 0.8, max: B },
    scaleY: { min: B * 0.7, max: B * 1.1 },
    frequency: 14,
    quantity: 1,
    maxAliveParticles: resFar.n,
    advance: 1800,
  });
  const near = emitterOf(scene, FX_KEYS.rainA, {
    emitZone: new Phaser.GameObjects.Particles.Zones.RandomZone(topZone as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource),
    speedY: { min: nearSpeed * 0.92, max: nearSpeed * 1.08 },
    speedX: { min: nearSpeed * RAIN_TAN * 0.92, max: nearSpeed * RAIN_TAN * 1.08 },
    rotate: -RAIN_ANGLE,
    lifespan: nearLife,
    alpha: { min: 0.5, max: 0.85 },
    scaleX: { min: B * 0.9, max: B * 1.1 },
    scaleY: { min: B * 0.8, max: B * 1.2 },
    frequency: 16,
    quantity: 1,
    maxAliveParticles: resNear.n,
    advance: 1200,
  });
  const splash = emitterOf(scene, FX_KEYS.splash, {
    x: { min: bounds.x, max: bounds.x + bounds.w },
    y: groundY,
    lifespan: { min: 320, max: 460 },
    scale: { start: B * 0.25, end: B * 1.15, ease: 'Sine.easeOut' },
    alpha: { start: 0.75, end: 0, ease: 'Quad.easeIn' },
    frequency: 36,
    quantity: 1,
    maxAliveParticles: resSplash.n,
  });
  far.setDepth(0);
  near.setDepth(1);
  splash.setDepth(1);

  const dripHandles: FxHandle[] = [];
  let current = intensity;
  const apply = (): void => {
    applyIntensity(far, 14, current);
    applyIntensity(near, 16, current);
    applyIntensity(splash, 36, current);
    for (const d of dripHandles) (d as IntensityHandle).setIntensity?.(current);
  };
  apply();

  const handle: RainHandle = {
    far, near, splash,
    setIntensity(k: number) {
      current = Phaser.Math.Clamp(k, 0, 1);
      apply();
    },
    setGroundY(y: number) {
      splash.y = 0;
      splash.setConfig({ y });
    },
    drips(x0: number, x1: number, y: number) {
      const res = reservation(scene, 12);
      const e = emitterOf(scene, FX_KEYS.drop, {
        x: { min: Math.min(x0, x1), max: Math.max(x0, x1) },
        y,
        speedY: { min: 10, max: 30 },
        speedX: { min: -3, max: 3 },
        gravityY: 520,
        lifespan: 720,
        alpha: { start: 0.9, end: 0.6 },
        scale: { min: B * 0.8, max: B * 1.1 },
        frequency: 260,
        quantity: 1,
        maxAliveParticles: res.n,
      });
      e.setDepth(2);
      const dh: IntensityHandle = {
        setIntensity(k: number) { applyIntensity(e, 260, k); },
        destroy() {
          res.release();
          e.destroy();
          const i = dripHandles.indexOf(dh);
          if (i >= 0) dripHandles.splice(i, 1);
        },
      };
      dh.setIntensity(current);
      dripHandles.push(dh);
      return dh;
    },
    destroy() {
      for (const d of dripHandles.slice()) d.destroy();
      resFar.release(); resNear.release(); resSplash.release();
      far.destroy(); near.destroy(); splash.destroy();
    },
  };
  return handle;
}

// ---------------------------------------------------------------------------------------------------------------
// Embers and steam
// ---------------------------------------------------------------------------------------------------------------

export type EmberHandle = IntensityHandle & { emitter: Emitter; setPosition(x: number, y: number): void };

/** Rising, wobbling embers from a fire at (x, y): additive, fading and shrinking. */
export function embers(scene: Phaser.Scene, x: number, y: number, intensity = 1): EmberHandle {
  const res = reservation(scene, 32);
  const e = emitterOf(scene, FX_KEYS.ember, {
    x: { min: -10, max: 10 },
    y: { min: -4, max: 4 },
    speedY: { min: -95, max: -45 },
    speedX: { min: -14, max: 14 },
    accelerationX: {
      onEmit: () => 0,
      onUpdate: (p: Particle, _k: string, t: number) => Math.sin(t * TAU * 1.6 + hash01(p, 1) * TAU) * 90,
    },
    gravityY: -12,
    lifespan: { min: 1300, max: 2300 },
    alpha: { start: 0.95, end: 0, ease: 'Quad.easeIn' },
    scale: { start: B * 1.0, end: B * 0.35, ease: 'Sine.easeIn' },
    rotate: { onEmit: (p?: Particle) => (p ? hash01(p, 2) * 40 - 20 : 0) },
    blendMode: Phaser.BlendModes.ADD,
    frequency: 75,
    quantity: 1,
    maxAliveParticles: res.n,
    advance: 1500,
  });
  e.setPosition(x, y);
  const h: EmberHandle = {
    emitter: e,
    setPosition(nx, ny) { e.setPosition(nx, ny); },
    setIntensity(k: number) { applyIntensity(e, 75, Phaser.Math.Clamp(k, 0, 1)); },
    destroy() { res.release(); e.destroy(); },
  };
  h.setIntensity(intensity);
  return h;
}

export type SteamHandle = IntensityHandle & { emitter: Emitter; setPosition(x: number, y: number): void };

/** Soft steam puffs rising from (x, y), expanding and fading (pots, kettles, mugs). */
export function steam(scene: Phaser.Scene, x: number, y: number, intensity = 1): SteamHandle {
  const res = reservation(scene, 16);
  const e = emitterOf(scene, FX_KEYS.steam, {
    x: { min: -8, max: 8 },
    speedY: { min: -46, max: -28 },
    speedX: { min: -6, max: 6 },
    accelerationX: {
      onEmit: () => 0,
      onUpdate: (p: Particle, _k: string, t: number) => Math.sin(t * TAU * 0.9 + hash01(p, 3) * TAU) * 30,
    },
    lifespan: { min: 1700, max: 2600 },
    alpha: { start: 0.0, end: 0, ease: 'Sine.easeInOut', easeParams: [] , onUpdate: (_p: Particle, _k: string, t: number) => 0.55 * Math.sin(Math.min(1, t) * Math.PI) } as never,
    scale: { start: B * 0.45, end: B * 1.5, ease: 'Sine.easeOut' },
    frequency: 230,
    quantity: 1,
    maxAliveParticles: res.n,
    advance: 2000,
  });
  e.setPosition(x, y);
  const h: SteamHandle = {
    emitter: e,
    setPosition(nx, ny) { e.setPosition(nx, ny); },
    setIntensity(k: number) { applyIntensity(e, 230, Phaser.Math.Clamp(k, 0, 1)); },
    destroy() { res.release(); e.destroy(); },
  };
  h.setIntensity(intensity);
  return h;
}

// ---------------------------------------------------------------------------------------------------------------
// One-shots: sparkle burst, dust puff (shared per-scene emitters so bursts allocate nothing)
// ---------------------------------------------------------------------------------------------------------------

const burstEmitters = new WeakMap<Phaser.Scene, Emitter>();
const dustEmitters = new WeakMap<Phaser.Scene, Emitter>();

function sharedEmitter(scene: Phaser.Scene, map: WeakMap<Phaser.Scene, Emitter>, make: (max: number) => Emitter, slots: number): Emitter {
  let e = map.get(scene);
  if (e && e.active) return e;
  const res = reservation(scene, slots);
  e = make(res.n);
  e.once(Phaser.GameObjects.Events.DESTROY, () => { res.release(); map.delete(scene); });
  map.set(scene, e);
  return e;
}

function burstEmitter(scene: Phaser.Scene): Emitter {
  return sharedEmitter(scene, burstEmitters, (max) => {
    const e = emitterOf(scene, FX_KEYS.sparkle, {
      speed: { min: 28, max: 120 },
      angle: { min: 0, max: 360 },
      gravityY: 36,
      lifespan: { min: 520, max: 820 },
      scale: {
        onEmit: () => 0,
        onUpdate: (p: Particle, _k: string, t: number) => {
          const base = B * (0.45 + hash01(p, 4) * 0.55);
          const pop = backOut(Math.min(1, t / 0.3));
          const fade = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
          return base * pop * Math.max(0, fade);
        },
      },
      alpha: { start: 1, end: 0, ease: 'Quad.easeIn' },
      rotate: {
        onEmit: (p?: Particle) => (p ? hash01(p, 5) * 90 : 0),
        onUpdate: (_p: Particle, _k: string, t: number, v: number) => v + (t < 1 ? 0.9 : 0),
      },
      emitting: false,
      maxAliveParticles: max,
    });
    e.setDepth(1000);
    return e;
  }, 48);
}

/** One-shot burst of 4-point sparkles (discoveries, rare catches). Back.easeOut pop then fade. */
export function sparkleBurst(scene: Phaser.Scene, x: number, y: number, n = 12): void {
  burstEmitter(scene).explode(particleBudget.scaled(n), x, y);
}

/** 3-5 soft dust puffs out sideways (hop-walk landings, tent pegs). */
export function dustPuff(scene: Phaser.Scene, x: number, y: number, n = 4): void {
  const e = sharedEmitter(scene, dustEmitters, (max) => {
    const em = emitterOf(scene, FX_KEYS.dust, {
      angle: { onEmit: () => (Math.random() < 0.5 ? 0 : 180) + rnd(-28, 8) },
      speed: { min: 30, max: 80 },
      gravityY: -18,
      lifespan: { min: 380, max: 620 },
      scale: { start: B * 0.45, end: B * 1.3, ease: 'Sine.easeOut' },
      alpha: { start: 0.85, end: 0, ease: 'Quad.easeIn' },
      emitting: false,
      maxAliveParticles: max,
    });
    em.setDepth(5);
    return em;
  }, 24);
  e.explode(Phaser.Math.Clamp(particleBudget.scaled(n), 1, 5), x, y);
}

// ---------------------------------------------------------------------------------------------------------------
// Hearts, notes (tween sprites), sparkle trail
// ---------------------------------------------------------------------------------------------------------------

function floatSprite(scene: Phaser.Scene, s: Phaser.GameObjects.Image, delay: number, dy: number, duration: number, sway: number, spin = 0): void {
  s.setAlpha(0);
  const rm = isReduceMotion();
  popIn(scene, s, 240, delay);
  scene.tweens.add({ targets: s, y: s.y - dy, duration, delay, ease: 'Sine.easeOut' });
  if (!rm) {
    scene.tweens.add({ targets: s, x: s.x + sway, duration: duration / 3, delay, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
    if (spin) scene.tweens.add({ targets: s, angle: spin, duration: duration / 2, delay, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
  }
  scene.tweens.add({
    targets: s, alpha: 0, duration: duration * 0.4, delay: delay + duration * 0.6, ease: 'Quad.easeIn',
    onComplete: () => killAndDestroy(scene, s),
  });
}

/** Little hearts floating up with a gentle sway (blissful companion, a good meal). */
export function heartsFloat(scene: Phaser.Scene, x: number, y: number, n = 3): void {
  const count = particleBudget.scaled(n);
  for (let i = 0; i < count; i++) {
    const s = tweenSprite(scene, x + rnd(-14, 14), y + rnd(-6, 6), FX_KEYS.heart, 1000);
    if (!s) return;
    s.setScale(B * rnd(0.7, 1.05));
    s.setData('baseScale', s.scaleX);
    floatSprite(scene, s, i * 160, rnd(44, 64), rnd(1000, 1300), rnd(-8, 8), rnd(-12, 12));
  }
}

/** Music notes floating up (humming, chimes, the companion's song). */
export function notesFloat(scene: Phaser.Scene, x: number, y: number, n = 2): void {
  const count = particleBudget.scaled(n);
  for (let i = 0; i < count; i++) {
    const s = tweenSprite(scene, x + rnd(-12, 12), y + rnd(-4, 4), FX_KEYS.note, 1000);
    if (!s) return;
    s.setScale(B * rnd(0.75, 1.0));
    s.setData('baseScale', s.scaleX);
    floatSprite(scene, s, i * 220, rnd(40, 58), rnd(1100, 1400), rnd(-10, 10), rnd(-16, 16));
  }
}

/**
 * A few sparkles arcing along a quadratic path from `from` to `to` (forage items flying to the basket).
 * Resolves when the lead sparkle arrives; `onComplete` is also called if given.
 */
export function sparkleTrail(scene: Phaser.Scene, from: Point, to: Point, duration = 600, onComplete?: () => void): Promise<void> {
  return new Promise((resolve) => {
    const dist = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const lift = dist * 0.35 + 40;
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(from.x, from.y),
      new Phaser.Math.Vector2((from.x + to.x) / 2, Math.min(from.y, to.y) - lift),
      new Phaser.Math.Vector2(to.x, to.y),
    );
    const lead = tweenSprite(scene, from.x, from.y, FX_KEYS.sparkle, 1001);
    const finish = (): void => {
      if (lead) killAndDestroy(scene, lead);
      onComplete?.();
      resolve();
    };
    if (!lead) { finish(); return; }
    lead.setScale(B * 0.9);
    const pt = new Phaser.Math.Vector2();
    const prog = { t: 0 };
    let nextSpawn = 0;
    const spawnEvery = isReduceMotion() ? 0.3 : 0.12;
    scene.tweens.add({
      targets: prog, t: 1, duration, ease: 'Sine.easeInOut',
      onUpdate: () => {
        curve.getPoint(prog.t, pt);
        lead.setPosition(pt.x, pt.y);
        lead.angle += 4;
        if (prog.t >= nextSpawn && prog.t < 0.97) {
          nextSpawn += spawnEvery;
          const s = tweenSprite(scene, pt.x + rnd(-4, 4), pt.y + rnd(-4, 4), FX_KEYS.sparkle, 1000);
          if (s) {
            s.setScale(0);
            s.setAlpha(0.9);
            scene.tweens.add({ targets: s, scale: B * rnd(0.35, 0.65), duration: 180, ease: 'Back.easeOut' });
            scene.tweens.add({
              targets: s, alpha: 0, y: s.y - 8, duration: 320, delay: 160, ease: 'Quad.easeIn',
              onComplete: () => killAndDestroy(scene, s),
            });
          }
        }
      },
      onComplete: finish,
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Petals / leaves drifting by day
// ---------------------------------------------------------------------------------------------------------------

export type DriftHandle = FxHandle & { emitter: Emitter; setCount(n: number): void; setIntensity(k: number): void };

/**
 * Slowly drifting petals or leaves across `bounds` with a sine sway; they enter from the top and leave at the bottom
 * (a continuous flow reads like wrap-around). `count` is the target number alive at once.
 */
export function petalsDrift(scene: Phaser.Scene, bounds: Bounds, kind: 'petal' | 'leaf' = 'petal', count = 10): DriftHandle {
  const res = reservation(scene, count);
  const leaf = kind === 'leaf';
  const fall = leaf ? { min: 22, max: 40 } : { min: 16, max: 30 };
  const lifespan = ((bounds.h + 80) / fall.min) * 1000;
  const alive = Math.max(1, res.n);
  // frequency so that roughly `alive` particles are alive at once over a mean lifespan
  const meanLife = ((bounds.h + 80) / ((fall.min + fall.max) / 2)) * 1000;
  const baseFreq = meanLife / alive;
  const e = emitterOf(scene, leaf ? FX_KEYS.leaf : FX_KEYS.petal, {
    emitZone: new Phaser.GameObjects.Particles.Zones.RandomZone(new Phaser.Geom.Rectangle(bounds.x - 40, bounds.y - 30, bounds.w + 40, 16) as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource),
    deathZone: { type: 'onEnter', source: new Phaser.Geom.Rectangle(bounds.x - 400, bounds.y + bounds.h + 30, bounds.w + 800, 200) },
    speedY: fall,
    speedX: leaf ? { min: 4, max: 22 } : { min: 2, max: 14 },
    accelerationX: {
      onEmit: () => 0,
      onUpdate: (p: Particle, _k: string, t: number) => {
        const elapsed = (t * p.life) / 1000;
        return Math.sin(elapsed * TAU * (leaf ? 0.45 : 0.38) + hash01(p, 6) * TAU) * (leaf ? 70 : 55);
      },
    },
    rotate: {
      onEmit: (p?: Particle) => (p ? hash01(p, 7) * 360 : 0),
      onUpdate: (p: Particle, _k: string, t: number) => {
        const elapsed = (t * p.life) / 1000;
        return hash01(p, 7) * 360 + Math.sin(elapsed * TAU * 0.3 + hash01(p, 8) * TAU) * (leaf ? 80 : 40) + (leaf ? elapsed * 25 : 0);
      },
    },
    scale: { onEmit: (p?: Particle) => B * (p ? 0.6 + hash01(p, 9) * 0.5 : 0.8) },
    alpha: {
      onEmit: () => 0,
      onUpdate: (_p: Particle, _k: string, t: number) => Phaser.Math.Clamp(Math.min(t * 12, (1 - t) * 10), 0, 0.92),
    },
    lifespan,
    frequency: baseFreq,
    quantity: 1,
    maxAliveParticles: alive,
    advance: Math.min(20000, meanLife),
  });
  e.setDepth(3);
  let k = 1;
  const h: DriftHandle = {
    emitter: e,
    setCount(n: number) {
      const want = particleBudget.scaled(n);
      let cur = e.maxAliveParticles;
      if (want > cur) cur += particleBudget.reserve(want - cur);
      else { particleBudget.release(cur - want); cur = want; }
      e.maxAliveParticles = cur;
      applyIntensity(e, meanLife / Math.max(1, cur), k);
    },
    setIntensity(v: number) {
      k = Phaser.Math.Clamp(v, 0, 1);
      applyIntensity(e, meanLife / Math.max(1, e.maxAliveParticles), k);
    },
    destroy() {
      particleBudget.release(e.maxAliveParticles - res.n);
      res.release();
      e.destroy();
    },
  };
  return h;
}

// ---------------------------------------------------------------------------------------------------------------
// Star field with twinkle
// ---------------------------------------------------------------------------------------------------------------

export type StarsHandle = FxHandle & { container: Phaser.GameObjects.Container; setAlpha(a: number): void };

/** A static star field in `bounds` with per-star alpha twinkle; setAlpha() fades the whole field with lighting. */
export function starsTwinkle(scene: Phaser.Scene, bounds: Bounds, count = 60): StarsHandle {
  paintFxTextures(scene);
  const res = reservation(scene, count);
  const container = scene.add.container(0, 0);
  const slow = isReduceMotion();
  for (let i = 0; i < res.n; i++) {
    const s = makeImg(scene, rnd(bounds.x, bounds.x + bounds.w), rnd(bounds.y, bounds.y + bounds.h), FX_KEYS.star);
    // bias toward the top of the band (stars thin out near the horizon)
    s.y = bounds.y + Math.pow(Math.random(), 1.4) * bounds.h;
    const sc = B * rnd(0.35, 1.0);
    s.setScale(sc).setData('baseScale', sc);
    const lo = rnd(0.25, 0.5), hi = rnd(0.75, 1);
    s.setAlpha(rnd(lo, hi));
    container.add(s);
    scene.tweens.add({
      targets: s, alpha: { from: lo, to: hi }, duration: rnd(1200, 3600) * (slow ? 1.8 : 1), delay: rnd(0, 2500),
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    if (!slow && Math.random() < 0.3) {
      scene.tweens.add({ targets: s, scale: sc * 1.25, duration: rnd(1500, 3000), delay: rnd(0, 2000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }
  return {
    container,
    setAlpha(a: number) { container.setAlpha(Phaser.Math.Clamp(a, 0, 1)); },
    destroy() { res.release(); container.destroy(true); },
  };
}
