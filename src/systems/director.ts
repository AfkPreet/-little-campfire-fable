/**
 * Director mode (?director=1): offline, deterministic capture for trailers.
 *
 * Headless Chromium renders the game at a few frames per second, so instead of recording in real time the
 * director stops Phaser's loop and steps the game one fixed frame at a time (Phaser.Game#step with a virtual clock).
 * After each step the canvas is handed to WebCodecs VideoEncoders (VP9) with explicit timestamps and muxed into
 * WebM by webm-muxer, so the output plays at a true 30 fps no matter how slowly it was produced.
 *
 * Node drives it through window.__game.director (see scripts/trailer-capture.mjs). Because the loop is stopped,
 * any game promise (walkTo, fish, finale...) only advances while step() is being called: start the action with
 * run(), then step until isDone(token).
 */
import Phaser from 'phaser';
import { PALETTE, hexToInt, mix } from '@/config/palette';
import { viewport } from '@/config/layout';
import { makeText } from '@/ui/text';
import { STRINGS, fill } from '@/data';
import { Hero } from '@/entities/Hero';

export type DirectorBegin = { fps?: number; width?: number; height?: number; masterKbps?: number; webKbps?: number };

type Encoder = { encoder: VideoEncoder; muxer: WebmMuxer; target: WebmTarget; kbps: number };
type WebmMuxer = { addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): void; finalize(): void };
type WebmTarget = { buffer: ArrayBuffer | null };

const DIRECTOR = {
  sceneKey: 'Director',
  caption: { size: 34, margin: 40, fadeMs: 300 },
  keyframeEvery: 60,
  card: { w: 560, h: 250, radius: 40, heroScale: 1.15 },
} as const;

/** The always-on-top overlay scene: captions and the title card are drawn inside the game canvas. */
class DirectorScene extends Phaser.Scene {
  private captionText: Phaser.GameObjects.Text | null = null;
  private card: Phaser.GameObjects.Container | null = null;

  constructor() {
    super(DIRECTOR.sceneKey);
  }

  create(): void {
    const v = viewport();
    this.cameras.main.setZoom(v.zoom);
    this.cameras.main.centerOn(v.w / 2, v.h / 2);
  }

  caption(text: string, holdMs = 0, fadeMs: number = DIRECTOR.caption.fadeMs): void {
    const v = viewport();
    const old = this.captionText;
    if (old) {
      this.tweens.add({ targets: old, alpha: 0, duration: fadeMs, onComplete: () => old.destroy() });
      this.captionText = null;
    }
    if (!text) return;
    const t = makeText(this, DIRECTOR.caption.margin, v.h - DIRECTOR.caption.margin, text, {
      size: DIRECTOR.caption.size, hand: true, color: PALETTE.cream, shadow: true,
    }).setOrigin(0, 1).setAlpha(0);
    this.add.existing(t);
    this.captionText = t;
    this.tweens.add({ targets: t, alpha: 1, duration: fadeMs });
    if (holdMs > 0) this.time.delayedCall(holdMs, () => { if (this.captionText === t) this.caption('', 0, fadeMs); });
  }

  titleCard(show: boolean): void {
    if (!show) {
      if (this.card) {
        const c = this.card;
        this.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => c.destroy() });
        this.card = null;
      }
      return;
    }
    if (this.card) return;
    const v = viewport();
    const C = DIRECTOR.card;
    const root = this.add.container(v.w / 2, v.h / 2).setAlpha(0).setScale(0.7);
    const g = this.add.graphics();
    g.fillStyle(hexToInt(PALETTE.ink), 0.18);
    g.fillRoundedRect(-C.w / 2, -C.h / 2 + 10, C.w, C.h, C.radius);
    g.fillStyle(hexToInt(PALETTE.cream), 1);
    g.fillRoundedRect(-C.w / 2, -C.h / 2, C.w, C.h, C.radius);
    g.lineStyle(3, hexToInt(mix(PALETTE.cream, PALETTE.bark, 0.25)), 1);
    g.strokeRoundedRect(-C.w / 2, -C.h / 2, C.w, C.h, C.radius);
    root.add(g);
    const hero = new Hero(this, -C.w / 2 + 95, C.h / 2 - 34);
    hero.setScale(C.heroScale);
    hero.setFacing(1).setExpression('happy');
    root.add(hero);
    const textX = -C.w / 2 + 180;
    const title = makeText(this, textX, -62, fill(STRINGS.title.logo), { size: 56, weight: 700, color: PALETTE.ink }).setOrigin(0, 0);
    const sub = makeText(this, textX, 4, fill(STRINGS.title.subtitle), { size: 30, hand: true, color: mix(PALETTE.ink, PALETTE.cream, 0.3) }).setOrigin(0, 0);
    const pillW = 190, pillH = 48, pillY = 62;
    const pill = this.add.graphics();
    pill.fillStyle(hexToInt(PALETTE.rose), 1);
    pill.fillRoundedRect(textX, pillY, pillW, pillH, pillH / 2);
    const pillText = makeText(this, textX + pillW / 2, pillY + pillH / 2, STRINGS.trailer.comingSoon, { size: 24, weight: 700, color: PALETTE.cream }).setOrigin(0.5);
    root.add([title, sub, pill, pillText]);
    this.card = root;
    this.tweens.add({ targets: root, alpha: 1, scale: 1, duration: 500, ease: 'Back.easeOut' });
  }
}

export class Director {
  private game: Phaser.Game;
  private fps = 30;
  private frameIndex = 0;
  private virtualNow = 0;
  private encoders: Encoder[] = [];
  private muted = false;
  private began = false;
  private tokens = new Map<string, boolean>();
  private tokenSeq = 0;

  constructor(game: Phaser.Game) {
    this.game = game;
  }

  private overlay(): DirectorScene | null {
    const s = this.game.scene.getScene(DIRECTOR.sceneKey) as DirectorScene | null;
    return s && s.scene.isActive() ? s : null;
  }

  private ensureOverlay(): void {
    if (!this.game.scene.getScene(DIRECTOR.sceneKey)) {
      this.game.scene.add(DIRECTOR.sceneKey, DirectorScene, true);
    } else if (!this.overlay()) {
      this.game.scene.start(DIRECTOR.sceneKey);
    }
    this.game.scene.bringToTop(DIRECTOR.sceneKey);
  }

  /** Stop the real-time loop and set up the encoders. Call once. */
  async begin(opts: DirectorBegin = {}): Promise<{ width: number; height: number; fps: number }> {
    if (this.began) throw new Error('director already began');
    this.began = true;
    this.fps = opts.fps ?? 30;
    const canvas = this.game.canvas;
    const width = opts.width ?? canvas.width, height = opts.height ?? canvas.height;
    const { Muxer, ArrayBufferTarget } = await import('webm-muxer');
    const make = (kbps: number): Encoder => {
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({ target, video: { codec: 'V_VP9', width, height, frameRate: this.fps }, firstTimestampBehavior: 'offset' });
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error('[director] encoder error', e),
      });
      encoder.configure({ codec: 'vp09.00.10.08', width, height, bitrate: kbps * 1000, framerate: this.fps, latencyMode: 'quality' });
      return { encoder, muxer: muxer as unknown as WebmMuxer, target: target as unknown as WebmTarget, kbps };
    };
    this.encoders = [make(opts.masterKbps ?? 4000), make(opts.webKbps ?? 1100)];
    this.game.loop.stop();
    this.virtualNow = performance.now();
    this.ensureOverlay();
    return { width, height, fps: this.fps };
  }

  /** Advance the game by n fixed frames, encoding each (unless muted). Yields to the event loop every frame. */
  async step(frames = 1): Promise<number> {
    const delta = 1000 / this.fps;
    for (let i = 0; i < frames; i++) {
      this.virtualNow += delta;
      this.game.step(this.virtualNow, delta);
      if (!this.muted && this.encoders.length) {
        const ts = Math.round((this.frameIndex * 1_000_000) / this.fps);
        const keyFrame = this.frameIndex % DIRECTOR.keyframeEvery === 0;
        for (const e of this.encoders) {
          const frame = new VideoFrame(this.game.canvas, { timestamp: ts, duration: Math.round(1_000_000 / this.fps) });
          e.encoder.encode(frame, { keyFrame });
          frame.close();
        }
        this.frameIndex++;
      }
      // let encoder callbacks and game promises settle
      await new Promise<void>((r) => setTimeout(r, 0));
    }
    return this.frameIndex;
  }

  frame(): number {
    return this.frameIndex;
  }
  seconds(): number {
    return this.frameIndex / this.fps;
  }
  /** Skip encoding while still stepping (used to fast-forward long beats). */
  mute(on: boolean): void {
    this.muted = on;
  }

  caption(text: string, opts: { holdMs?: number; fadeMs?: number } = {}): void {
    this.ensureOverlay();
    this.overlay()?.caption(text, opts.holdMs ?? 0, opts.fadeMs);
  }
  titleCard(show: boolean): void {
    this.ensureOverlay();
    this.overlay()?.titleCard(show);
  }
  /** Show or hide the HUD scene (and its chrome) for cinematic beats. */
  hud(visible: boolean): void {
    const hud = this.game.scene.getScene('HUD');
    if (hud) hud.scene.setVisible(visible);
  }

  /** Start an api action without awaiting it; poll isDone(token) while stepping. */
  run(fn: () => Promise<unknown> | unknown): string {
    const token = `t${++this.tokenSeq}`;
    this.tokens.set(token, false);
    Promise.resolve()
      .then(fn)
      .then(() => this.tokens.set(token, true), (e) => { console.error('[director] action failed', e); this.tokens.set(token, true); });
    return token;
  }
  isDone(token: string): boolean {
    return this.tokens.get(token) === true;
  }

  snapshot(): string {
    return this.game.canvas.toDataURL('image/png');
  }

  /** Flush and finalize both encoders. Returns base64 WebM bytes (master, web). */
  async finish(): Promise<{ master: string; web: string; frames: number; seconds: number }> {
    const out: string[] = [];
    for (const e of this.encoders) {
      await e.encoder.flush();
      e.encoder.close();
      e.muxer.finalize();
      const buf = e.target.buffer;
      out.push(buf ? toBase64(new Uint8Array(buf)) : '');
    }
    this.encoders = [];
    return { master: out[0] ?? '', web: out[1] ?? '', frames: this.frameIndex, seconds: this.frameIndex / this.fps };
  }
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  return btoa(s);
}

export function installDirector(game: Phaser.Game): Director {
  const d = new Director(game);
  window.__game.director = d;
  return d;
}
