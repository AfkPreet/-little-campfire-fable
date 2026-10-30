/**
 * engine.ts: the singleton Web Audio engine (no Phaser sound).
 *
 * Graph:  source -> bus (music | sfx | ambience) -> [music: duck] -> master -> limiter -> destination
 *
 * - `unlock()` must be called from a user gesture (pointerdown / touchend / keydown). On iOS the
 *   AudioContext is created and resumed inside that handler and a silent buffer is played.
 * - Everything is safe to call before unlock and when the Web Audio API is missing: calls are
 *   no-ops or queued (`whenUnlocked`). Modules that keep state (ambience, music) store their
 *   desired state and apply it once `onUnlock` fires.
 * - Bus volumes persist in localStorage under `little-campfire:audio:v1`.
 * - `duck()` lowers the music bus for a moment (the catch fanfare ducks music by 30%).
 * - A gentle DynamicsCompressor on the master keeps the sum from clipping.
 */
import { DEBUG } from '@/config/debug';

export type BusName = 'music' | 'sfx' | 'ambience';
export type Volumes = Record<BusName, number>;

export const AUDIO_STORAGE_KEY = 'little-campfire:audio:v1';
export const DEFAULT_VOLUMES: Volumes = { music: 0.7, sfx: 0.8, ambience: 0.6 };

/** Handle a module gets when the engine is live: the context and the bus to connect to. */
export type Tap = { ctx: AudioContext; out: GainNode };

type ContextCtor = typeof AudioContext;

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const rand = (min: number, max: number): number => min + (max - min) * Math.random();
export const randInt = (min: number, maxInclusive: number): number => Math.floor(rand(min, maxInclusive + 1));
export const chance = (p: number): boolean => Math.random() < p;
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const centsToRatio = (cents: number): number => Math.pow(2, cents / 1200);
export const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
/** Smallest value exponential ramps may target (they cannot reach 0). */
export const EPS = 0.0001;

function findContextCtor(): ContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: ContextCtor; webkitAudioContext?: ContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function loadVolumes(): Volumes {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(AUDIO_STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULT_VOLUMES };
    const parsed = JSON.parse(raw) as Partial<Record<BusName, unknown>>;
    const read = (k: BusName) => (typeof parsed[k] === 'number' && Number.isFinite(parsed[k]) ? clamp01(parsed[k] as number) : DEFAULT_VOLUMES[k]);
    return { music: read('music'), sfx: read('sfx'), ambience: read('ambience') };
  } catch {
    return { ...DEFAULT_VOLUMES };
  }
}

function saveVolumes(v: Volumes): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* private mode or blocked storage: volumes just do not persist */
  }
}

class AudioEngine {
  /** False when the Web Audio API is missing or `?noaudio=1` was passed; every call is then a no-op. */
  readonly available: boolean;

  private ctx: AudioContext | null = null;
  master: GainNode | null = null;
  limiter: DynamicsCompressorNode | null = null;
  private buses: Record<BusName, GainNode> | null = null;
  private duckNode: GainNode | null = null;
  private unlocked = false;
  private unlocking: Promise<boolean> | null = null;
  private pending: Array<() => void> = [];
  private listeners = new Set<() => void>();
  private volumes: Volumes = loadVolumes();
  private whiteBuf: AudioBuffer | null = null;
  private pinkBuf: AudioBuffer | null = null;

  constructor() {
    this.available = !!findContextCtor() && !DEBUG.noAudio;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.resumeIfNeeded();
      });
    }
  }

  // ---------- lifecycle ----------

  /** Call from a user gesture. Resolves true once the context is running. Safe to call repeatedly. */
  unlock(): Promise<boolean> {
    if (!this.available) return Promise.resolve(false);
    if (this.unlocked) {
      this.resumeIfNeeded();
      return Promise.resolve(true);
    }
    if (this.unlocking) return this.unlocking;
    this.unlocking = (async () => {
      try {
        const ctx = this.ctx ?? this.createContext();
        if (!ctx) return false;
        // iOS: a silent buffer started inside the gesture is what actually opens the gate.
        try {
          const b = ctx.createBuffer(1, 1, ctx.sampleRate);
          const s = ctx.createBufferSource();
          s.buffer = b;
          s.connect(ctx.destination);
          s.start(0);
        } catch {
          /* ignore */
        }
        if (ctx.state !== 'running') {
          // resume() can hang forever when called outside a gesture; race it with a short timeout.
          await Promise.race([ctx.resume().catch(() => undefined), new Promise<void>((r) => setTimeout(r, 1500))]);
        }
        if ((ctx.state as string) !== 'running') return false;
        this.finishUnlock();
        return true;
      } catch {
        return false;
      } finally {
        this.unlocking = null;
      }
    })();
    return this.unlocking;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  /** Run `fn` now if the engine is live, otherwise once it unlocks. */
  whenUnlocked(fn: () => void): void {
    if (!this.available) return;
    if (this.unlocked) fn();
    else this.pending.push(fn);
  }

  /** Subscribe to every unlock (fires once per engine lifetime, right after the queue flushes). Returns an unsubscribe. */
  onUnlock(listener: () => void): () => void {
    this.listeners.add(listener);
    if (this.unlocked) listener();
    return () => this.listeners.delete(listener);
  }

  /** The context and a bus to connect to, or null before unlock. */
  tap(bus: BusName): Tap | null {
    if (!this.unlocked || !this.ctx || !this.buses) return null;
    return { ctx: this.ctx, out: this.buses[bus] };
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  /** Current context time (0 before unlock). */
  now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ---------- mixing ----------

  getVolumes(): Volumes {
    return { ...this.volumes };
  }

  setVolumes(v: Partial<Volumes>): void {
    for (const k of ['music', 'sfx', 'ambience'] as const) {
      const val = v[k];
      if (typeof val === 'number' && Number.isFinite(val)) this.volumes[k] = clamp01(val);
    }
    saveVolumes(this.volumes);
    this.applyVolumes();
  }

  /**
   * Lower the music bus by `amount` (0..1) for a moment: ramp down over attackMs, hold holdMs, ramp back over releaseMs.
   * The catch fanfare uses duck(0.3, 60, 800, 1200).
   */
  duck(amount: number, attackMs = 60, holdMs = 600, releaseMs = 1200): void {
    if (!this.ctx || !this.duckNode) return;
    const g = this.duckNode.gain;
    const t = this.ctx.currentTime;
    const a = Math.max(0.005, attackMs / 1000), h = Math.max(0, holdMs / 1000), r = Math.max(0.01, releaseMs / 1000);
    const target = clamp01(1 - amount);
    try {
      const current = g.value;
      g.cancelScheduledValues(t);
      g.setValueAtTime(current, t);
      g.linearRampToValueAtTime(Math.min(current, target), t + a);
      g.setValueAtTime(Math.min(current, target), t + a + h);
      g.linearRampToValueAtTime(1, t + a + h + r);
    } catch {
      /* ignore */
    }
  }

  // ---------- shared buffers (generated once per context) ----------

  /** 2 s of white noise, shared. */
  whiteNoise(ctx: AudioContext): AudioBuffer {
    if (!this.whiteBuf) {
      const len = Math.floor(ctx.sampleRate * 2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.whiteBuf = buf;
    }
    return this.whiteBuf;
  }

  /** 4 s of pink noise (Paul Kellet's filter over white noise), shared. Peak-normalized to ~0.5. */
  pinkNoise(ctx: AudioContext): AudioBuffer {
    if (!this.pinkBuf) {
      const len = Math.floor(ctx.sampleRate * 4);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      let peak = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        const p = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
        d[i] = p;
        const a = Math.abs(p);
        if (a > peak) peak = a;
      }
      const norm = peak > 0 ? 0.5 / peak : 1;
      for (let i = 0; i < len; i++) d[i] *= norm;
      // soften the loop seam
      const fade = Math.min(2048, len >> 2);
      for (let i = 0; i < fade; i++) {
        const k = i / fade;
        d[i] *= k;
        d[len - 1 - i] *= k;
      }
      this.pinkBuf = buf;
    }
    return this.pinkBuf;
  }

  // ---------- internals ----------

  private createContext(): AudioContext | null {
    const Ctor = findContextCtor();
    if (!Ctor) return null;
    let ctx: AudioContext;
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
    } catch {
      try {
        ctx = new Ctor();
      } catch {
        return null;
      }
    }
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 1;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 18;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.25;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    const duck = ctx.createGain();
    duck.gain.value = 1;
    duck.connect(master);
    const mk = () => {
      const g = ctx.createGain();
      g.gain.value = 0;
      return g;
    };
    const buses: Record<BusName, GainNode> = { music: mk(), sfx: mk(), ambience: mk() };
    buses.music.connect(duck);
    buses.sfx.connect(master);
    buses.ambience.connect(master);
    this.master = master;
    this.limiter = limiter;
    this.duckNode = duck;
    this.buses = buses;
    ctx.addEventListener('statechange', () => {
      if ((ctx.state as string) === 'running' && !this.unlocked) this.finishUnlock();
    });
    return ctx;
  }

  private finishUnlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    this.applyVolumes();
    const queue = this.pending;
    this.pending = [];
    for (const fn of queue) {
      try {
        fn();
      } catch (e) {
        console.warn('[audio] queued call failed', e);
      }
    }
    for (const l of this.listeners) {
      try {
        l();
      } catch (e) {
        console.warn('[audio] unlock listener failed', e);
      }
    }
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.buses) return;
    const t = this.ctx.currentTime;
    for (const k of ['music', 'sfx', 'ambience'] as const) {
      const g = this.buses[k].gain;
      try {
        g.cancelScheduledValues(t);
        g.setTargetAtTime(this.volumes[k], t, 0.03);
      } catch {
        g.value = this.volumes[k];
      }
    }
  }

  private resumeIfNeeded(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const st = ctx.state as string;
    if (st === 'suspended' || st === 'interrupted') void ctx.resume().catch(() => undefined);
  }
}

export const engine = new AudioEngine();
export type { AudioEngine };
