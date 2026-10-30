/**
 * FX textures: every particle, glow and twinkle sprite the game uses, painted once at 2x via paintTexture.
 * Keys are stable and prefixed 'fx-' (see FX_KEYS). Colors come only from palette.ts.
 * Sizes below are logical px (the pipeline paints at ART_SCALE and img()/emitters display at 1/ART_SCALE).
 */
import Phaser from 'phaser';
import { PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { paintTexture, radialGradient, softGlow, ellipsePath, type Ctx } from '@/art/pipeline';

export const FX_KEYS = {
  dot: 'fx-dot',
  glow: 'fx-glow',
  firefly: 'fx-firefly',
  sparkle: 'fx-sparkle',
  ember: 'fx-ember',
  rainA: 'fx-rain-a',
  rainB: 'fx-rain-b',
  splash: 'fx-splash',
  drop: 'fx-drop',
  steam: 'fx-steam',
  dust: 'fx-dust',
  petal: 'fx-petal',
  leaf: 'fx-leaf',
  heart: 'fx-heart',
  note: 'fx-note',
  star: 'fx-star',
  vignette: 'fx-vignette',
} as const;
export type FxKey = (typeof FX_KEYS)[keyof typeof FX_KEYS];

/** Logical sizes of the FX textures (so callers can scale by radius etc.). */
export const FX_SIZES = {
  dot: 16,
  glow: 128,
  firefly: 40,
  sparkle: 28,
  ember: { w: 10, h: 14 },
  rainA: { w: 3, h: 22 },
  rainB: { w: 2, h: 14 },
  splash: { w: 18, h: 7 },
  drop: { w: 5, h: 8 },
  steam: 48,
  dust: 28,
  petal: { w: 14, h: 18 },
  leaf: { w: 16, h: 9 },
  heart: 18,
  note: { w: 14, h: 20 },
  star: 12,
  vignette: { w: 256, h: 160 },
} as const;

/** Four-point sparkle path (a soft star with concave sides). */
function sparklePath(ctx: Ctx, cx: number, cy: number, r: number, inner = 0.22): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * inner;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else {
      // curve through the inner point so the arms are gently concave
      const pa = ((i - 1) * Math.PI) / 4 - Math.PI / 2;
      const pr = (i - 1) % 2 === 0 ? r : r * inner;
      const px = cx + Math.cos(pa) * pr, py = cy + Math.sin(pa) * pr;
      const mx = (px + x) / 2, my = (py + y) / 2;
      const k = 0.55;
      ctx.quadraticCurveTo(cx + (mx - cx) * k, cy + (my - cy) * k, x, y);
    }
  }
  ctx.closePath();
}

function teardropPath(ctx: Ctx, cx: number, top: number, w: number, h: number): void {
  // pointed top, round bottom
  const r = w / 2;
  const by = top + h - r;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.bezierCurveTo(cx + r * 0.2, top + h * 0.3, cx + r, by - r * 0.6, cx + r, by);
  ctx.arc(cx, by, r, 0, Math.PI, false);
  ctx.bezierCurveTo(cx - r, by - r * 0.6, cx - r * 0.2, top + h * 0.3, cx, top);
  ctx.closePath();
}

function heartPath(ctx: Ctx, cx: number, cy: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.45);
  ctx.bezierCurveTo(cx - s * 0.05, cy + s * 0.35, cx - s * 0.5, cy + s * 0.05, cx - s * 0.5, cy - s * 0.15);
  ctx.bezierCurveTo(cx - s * 0.5, cy - s * 0.42, cx - s * 0.15, cy - s * 0.48, cx, cy - s * 0.22);
  ctx.bezierCurveTo(cx + s * 0.15, cy - s * 0.48, cx + s * 0.5, cy - s * 0.42, cx + s * 0.5, cy - s * 0.15);
  ctx.bezierCurveTo(cx + s * 0.5, cy + s * 0.05, cx + s * 0.05, cy + s * 0.35, cx, cy + s * 0.45);
  ctx.closePath();
}

/** Paints every FX texture (idempotent: skips keys that already exist). Call once per scene that uses FX. */
export function paintFxTextures(scene: Phaser.Scene): void {
  const K = FX_KEYS, S = FX_SIZES;

  // soft dot: radial cream
  paintTexture(scene, K.dot, S.dot, S.dot, (ctx, w, h) => {
    softGlow(ctx, w / 2, h / 2, w / 2, PALETTE.cream, 1);
  });

  // glow disc: large, very soft, for additive light pools and bloom-ish halos
  paintTexture(scene, K.glow, S.glow, S.glow, (ctx, w, h) => {
    const r = w / 2;
    ctx.fillStyle = radialGradient(ctx, r, r, 0, r, [
      [0, alpha(PALETTE.glow, 0.95)],
      [0.18, alpha(PALETTE.glow, 0.7)],
      [0.42, alpha(PALETTE.glow, 0.32)],
      [0.7, alpha(PALETTE.glow, 0.09)],
      [1, alpha(PALETTE.glow, 0)],
    ]);
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // firefly: bright warm core with a wide soft halo (one sprite = core + bloom)
  paintTexture(scene, K.firefly, S.firefly, S.firefly, (ctx, w, h) => {
    const r = w / 2;
    ctx.fillStyle = radialGradient(ctx, r, r, 0, r, [
      [0, alpha(PALETTE.cream, 1)],
      [0.1, alpha(mix(PALETTE.glow, PALETTE.cream, 0.5), 0.95)],
      [0.2, alpha(PALETTE.glow, 0.6)],
      [0.45, alpha(PALETTE.glow, 0.2)],
      [0.75, alpha(PALETTE.glow, 0.05)],
      [1, alpha(PALETTE.glow, 0)],
    ]);
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // 4-point sparkle: cream core, butter-glow tint toward the tips
  paintTexture(scene, K.sparkle, S.sparkle, S.sparkle, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    softGlow(ctx, cx, cy, w / 2, PALETTE.glow, 0.45);
    sparklePath(ctx, cx, cy, w * 0.46);
    ctx.fillStyle = radialGradient(ctx, cx, cy, 0, w * 0.46, [
      [0, PALETTE.cream],
      [0.5, mix(PALETTE.cream, PALETTE.glow, 0.5)],
      [1, alpha(PALETTE.glow, 0.85)],
    ]);
    ctx.fill();
  });

  // ember: small warm teardrop, brighter heart
  paintTexture(scene, K.ember, S.ember.w, S.ember.h, (ctx, w, h) => {
    teardropPath(ctx, w / 2, 1, w - 2, h - 2);
    ctx.fillStyle = radialGradient(ctx, w / 2, h * 0.62, 0, w * 0.6, [
      [0, mix(PALETTE.glow, PALETTE.cream, 0.4)],
      [0.5, PALETTE.ember],
      [1, shade(PALETTE.ember, -0.1)],
    ]);
    ctx.fill();
  });

  // rain streaks: thin, silvery (powder/cream) at low alpha, fading at both ends. Two variants.
  const rainPainter = (tint: string, a: number) => (ctx: Ctx, w: number, h: number) => {
    ctx.fillStyle = ctx.createLinearGradient(0, 0, 0, h);
    const g = ctx.fillStyle as CanvasGradient;
    g.addColorStop(0, alpha(tint, 0));
    g.addColorStop(0.35, alpha(tint, a));
    g.addColorStop(0.8, alpha(tint, a));
    g.addColorStop(1, alpha(tint, 0));
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  paintTexture(scene, K.rainA, S.rainA.w, S.rainA.h, rainPainter(mix(PALETTE.cream, PALETTE.powder, 0.35), 0.75));
  paintTexture(scene, K.rainB, S.rainB.w, S.rainB.h, rainPainter(mix(PALETTE.powder, PALETTE.cream, 0.4), 0.6));

  // splash ring: thin ellipse outline
  paintTexture(scene, K.splash, S.splash.w, S.splash.h, (ctx, w, h) => {
    ellipsePath(ctx, w / 2, h / 2, w / 2 - 1.2, h / 2 - 1.2);
    ctx.strokeStyle = alpha(mix(PALETTE.cream, PALETTE.powder, 0.3), 0.9);
    ctx.lineWidth = 1.4;
    ctx.stroke();
  });

  // drop: tiny
  paintTexture(scene, K.drop, S.drop.w, S.drop.h, (ctx, w, h) => {
    teardropPath(ctx, w / 2, 0.5, w - 1, h - 1);
    ctx.fillStyle = alpha(mix(PALETTE.cream, PALETTE.powder, 0.4), 0.85);
    ctx.fill();
  });

  // steam puff: soft cream blob
  paintTexture(scene, K.steam, S.steam, S.steam, (ctx, w, h) => {
    const r = w / 2;
    ctx.fillStyle = radialGradient(ctx, r, r * 1.05, 0, r, [
      [0, alpha(PALETTE.cream, 0.55)],
      [0.4, alpha(PALETTE.cream, 0.32)],
      [0.75, alpha(PALETTE.cream, 0.08)],
      [1, alpha(PALETTE.cream, 0)],
    ]);
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // dust puff: soft sage/bark blob at low alpha
  paintTexture(scene, K.dust, S.dust, S.dust, (ctx, w, h) => {
    const r = w / 2;
    const c = mix(PALETTE.sage, PALETTE.bark, 0.45);
    ctx.fillStyle = radialGradient(ctx, r, r, 0, r, [
      [0, alpha(c, 0.5)],
      [0.5, alpha(c, 0.22)],
      [1, alpha(c, 0)],
    ]);
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // petal: rose teardrop with a darker-rose outline
  paintTexture(scene, K.petal, S.petal.w, S.petal.h, (ctx, w, h) => {
    teardropPath(ctx, w / 2, 1.5, w - 3, h - 3);
    ctx.fillStyle = radialGradient(ctx, w / 2, h * 0.6, 0, w * 0.7, [
      [0, mix(PALETTE.rose, PALETTE.cream, 0.45)],
      [1, PALETTE.rose],
    ]);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = outline(PALETTE.rose, 0.18);
    ctx.stroke();
  });

  // leaf: small sage almond with a midrib
  paintTexture(scene, K.leaf, S.leaf.w, S.leaf.h, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    ctx.beginPath();
    ctx.moveTo(1.5, cy);
    ctx.quadraticCurveTo(cx, 0.5, w - 1.5, cy);
    ctx.quadraticCurveTo(cx, h - 0.5, 1.5, cy);
    ctx.closePath();
    ctx.fillStyle = mix(PALETTE.sage, PALETTE.butter, 0.2);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = outline(PALETTE.sage, 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, cy);
    ctx.lineTo(w - 3, cy);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = alpha(PALETTE.moss, 0.7);
    ctx.stroke();
  });

  // heart: blush with a soft highlight
  paintTexture(scene, K.heart, S.heart, S.heart, (ctx, w, h) => {
    heartPath(ctx, w / 2, h / 2 + 0.5, w * 0.92);
    ctx.fillStyle = PALETTE.blush;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = outline(PALETTE.blush, 0.18);
    ctx.stroke();
    ctx.fillStyle = alpha(PALETTE.cream, 0.5);
    ellipsePath(ctx, w * 0.36, h * 0.36, w * 0.1, h * 0.07, -0.6);
    ctx.fill();
  });

  // music note: ink, small (eighth note)
  paintTexture(scene, K.note, S.note.w, S.note.h, (ctx, w, h) => {
    ctx.strokeStyle = PALETTE.ink;
    ctx.fillStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    const hx = w * 0.38, hy = h * 0.78;
    ellipsePath(ctx, hx, hy, w * 0.3, h * 0.14, -0.45);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + w * 0.26, hy - h * 0.05);
    ctx.lineTo(hx + w * 0.26, h * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx + w * 0.26, h * 0.1);
    ctx.quadraticCurveTo(w * 0.95, h * 0.2, w * 0.8, h * 0.45);
    ctx.stroke();
  });

  // star twinkle: cream 4-point with a tiny halo
  paintTexture(scene, K.star, S.star, S.star, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    softGlow(ctx, cx, cy, w / 2, PALETTE.cream, 0.35);
    sparklePath(ctx, cx, cy, w * 0.42, 0.3);
    ctx.fillStyle = PALETTE.cream;
    ctx.fill();
  });

  // vignette (Canvas fallback for light.ts): ink at low alpha, clear in the middle
  paintTexture(scene, K.vignette, S.vignette.w, S.vignette.h, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    const g = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.max(w, h) * 0.62);
    g.addColorStop(0, alpha(PALETTE.ink, 0));
    g.addColorStop(0.6, alpha(PALETTE.ink, 0.25));
    g.addColorStop(1, alpha(PALETTE.ink, 0.7));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
