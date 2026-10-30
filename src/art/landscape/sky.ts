/**
 * Sky painters: the 4x256 lighting gradient (repainted when the lighting changes), the sun disc, the moon crescent,
 * a glow halo, three cloud blobs and an egret V. All white/cream painted where they get tinted later.
 */
import Phaser from 'phaser';
import { PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { blobPath, ellipsePath, linearGradient, paintTexture, repaintTexture, softGlow, type Ctx } from '@/art/pipeline';
import type { Lighting } from '@/world/lighting';

export const SKY_KEYS = {
  gradient: 'sky-gradient',
  sun: 'sky-sun',
  moon: 'sky-moon',
  halo: 'sky-halo',
  clouds: ['sky-cloud-a', 'sky-cloud-b', 'sky-cloud-c'],
  egret: 'sky-egret',
} as const;

export const SKY_SIZES = {
  gradient: { w: 4, h: 256 },
  sun: 72,
  moon: 64,
  halo: 300,
  clouds: [{ w: 170, h: 64 }, { w: 130, h: 52 }, { w: 220, h: 72 }],
  egret: { w: 30, h: 12 },
} as const;

function paintGradient(L: Lighting) {
  return (ctx: Ctx, w: number, h: number): void => {
    // a touch of warmth gathers at the horizon so the band is never a flat two-stop ramp
    const midTone = mix(L.skyTop, L.skyHorizon, 0.55);
    ctx.fillStyle = linearGradient(ctx, 0, 0, 0, h, [
      [0, L.skyTop],
      [0.5, midTone],
      [0.86, L.skyHorizon],
      [1, mix(L.skyHorizon, PALETTE.cream, 0.12)],
    ]);
    ctx.fillRect(0, 0, w, h);
  };
}

/** Paints the gradient for a lighting (first call) or repaints it in place (later calls). */
export function paintSkyGradient(scene: Phaser.Scene, L: Lighting, key: string = SKY_KEYS.gradient): string {
  const { w, h } = SKY_SIZES.gradient;
  if (scene.textures.exists(key)) repaintTexture(scene, key, paintGradient(L));
  else paintTexture(scene, key, w, h, paintGradient(L));
  return key;
}

function paintSun(ctx: Ctx, w: number, h: number): void {
  const c = w / 2;
  softGlow(ctx, c, c, c, PALETTE.butter, 0.55);
  ellipsePath(ctx, c, c, w * 0.26, w * 0.26);
  ctx.fillStyle = mix(PALETTE.cream, PALETTE.butter, 0.35);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = alpha(mix(PALETTE.butter, PALETTE.peach, 0.4), 0.7);
  ctx.stroke();
}

function paintMoon(ctx: Ctx, w: number, h: number): void {
  const c = w / 2, r = w * 0.3;
  softGlow(ctx, c, c, c, PALETTE.cream, 0.35);
  ctx.save();
  // crescent: full disc minus an offset disc
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.arc(c + r * 0.55, c - r * 0.25, r * 0.86, 0, Math.PI * 2, true);
  ctx.fillStyle = mix(PALETTE.cream, PALETTE.butter, 0.25);
  ctx.fill('evenodd');
  ctx.restore();
}

function paintHalo(ctx: Ctx, w: number, h: number): void {
  softGlow(ctx, w / 2, h / 2, w / 2, PALETTE.cream, 0.5);
}

/** Cream cloud: a rounded blob with a slightly cooler underside and a cream top sheen. */
function paintCloud(seed: number) {
  return (ctx: Ctx, w: number, h: number): void => {
    const pts: Array<[number, number]> = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const a = t * Math.PI * 2;
      const wob = 0.82 + 0.18 * Math.sin(a * 3 + seed) * Math.cos(a * 2 + seed * 0.7);
      const rx = (w / 2 - 6) * wob, ry = (h / 2 - 6) * (Math.sin(a) < 0 ? 0.96 : 0.75 + 0.2 * wob);
      pts.push([w / 2 + Math.cos(a) * rx, h / 2 + Math.sin(a) * ry]);
    }
    blobPath(ctx, pts);
    ctx.fillStyle = linearGradient(ctx, 0, 0, 0, h, [
      [0, PALETTE.cream],
      [0.7, mix(PALETTE.cream, PALETTE.lavender, 0.12)],
      [1, mix(PALETTE.cream, PALETTE.lavender, 0.28)],
    ]);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = alpha(mix(PALETTE.cream, PALETTE.lavender, 0.4), 0.7);
    ctx.stroke();
  };
}

/** Egret V: two soft wing strokes, cream with a lavender edge. */
function paintEgret(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h * 0.8;
  ctx.lineWidth = 3;
  ctx.strokeStyle = shade(mix(PALETTE.cream, PALETTE.lavender, 0.5), -0.1);
  ctx.beginPath();
  ctx.moveTo(2, 3);
  ctx.quadraticCurveTo(cx - 6, cy - 2, cx, cy);
  ctx.quadraticCurveTo(cx + 6, cy - 2, w - 2, 3);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = PALETTE.cream;
  ctx.stroke();
}

/** Registers every sky texture except the gradient (which needs a Lighting). */
export function paintSkyTextures(scene: Phaser.Scene): void {
  paintTexture(scene, SKY_KEYS.sun, SKY_SIZES.sun, SKY_SIZES.sun, paintSun);
  paintTexture(scene, SKY_KEYS.moon, SKY_SIZES.moon, SKY_SIZES.moon, paintMoon);
  paintTexture(scene, SKY_KEYS.halo, SKY_SIZES.halo, SKY_SIZES.halo, paintHalo);
  SKY_KEYS.clouds.forEach((k, i) => paintTexture(scene, k, SKY_SIZES.clouds[i].w, SKY_SIZES.clouds[i].h, paintCloud(i * 1.7 + 0.4)));
  paintTexture(scene, SKY_KEYS.egret, SKY_SIZES.egret.w, SKY_SIZES.egret.h, paintEgret);
}

/** Outline tone used by far-band painters that want a hint of edge (kept here so the sky and ridges agree). */
export const FAR_EDGE = outline(PALETTE.cream, 0.06);
