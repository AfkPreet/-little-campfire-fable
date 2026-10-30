/**
 * intro.ts: three small storybook vignettes (~260x160) for the Intro cards.
 * 1 Chikki with a cowrie jar, 2 the lake with ridges, 3 the shop door with a toran. Painted once at 2x.
 */
import Phaser from 'phaser';
import { PALETTE, ACCENTS, LIGHT_KEYS, shade, mix, alpha } from '@/config/palette';
import {
  paintTexture, ellipsePath, roundRectPath, fillOutlined, softGlow, sheen, kawaiiEye, blushOval, linearGradient,
  contactShadow, paperGrain, type Ctx,
} from '@/art/pipeline';

export const VIGNETTE = { w: 260, h: 160, radius: 18 } as const;
export const INTRO_TEX = ['intro-jar', 'intro-lake', 'intro-shop'] as const;
export type IntroTex = (typeof INTRO_TEX)[number];

const P = PALETTE, A = ACCENTS;

function frame(ctx: Ctx, w: number, h: number, top: string, bottom: string): void {
  roundRectPath(ctx, 1.5, 1.5, w - 3, h - 3, VIGNETTE.radius);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = linearGradient(ctx, 0, 0, 0, h, [[0, top], [1, bottom]]);
  ctx.fillRect(0, 0, w, h);
}
function finish(ctx: Ctx, w: number, h: number): void {
  paperGrain(ctx, 0, 0, w, h, P.ink, 0.03, 3);
  ctx.restore();
  roundRectPath(ctx, 1.5, 1.5, w - 3, h - 3, VIGNETTE.radius);
  ctx.strokeStyle = shade(P.cream, -0.25);
  ctx.lineWidth = 2.5;
  ctx.stroke();
}
function ridge(ctx: Ctx, w: number, baseY: number, amp: number, color: string, phase: number): void {
  ctx.beginPath();
  ctx.moveTo(-4, baseY + 40);
  for (let x = -4; x <= w + 4; x += 6) {
    const y = baseY - amp * (0.6 + 0.4 * Math.sin(x / 38 + phase)) * Math.abs(Math.sin(x / 70 + phase * 0.7));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w + 4, baseY + 40);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
function chikkiHead(ctx: Ctx, cx: number, cy: number, r: number): void {
  const fur = P.butter;
  for (const d of [-1, 1]) {
    ellipsePath(ctx, cx + d * r * 0.8, cy - r * 0.65, r * 0.28, r * 0.36, d * 0.35);
    fillOutlined(ctx, fur, 2.5);
  }
  ellipsePath(ctx, cx, cy, r, r * 0.92);
  fillOutlined(ctx, fur, 2.5);
  ellipsePath(ctx, cx, cy + r * 0.32, r * 0.46, r * 0.3);
  ctx.fillStyle = alpha(P.cream, 0.7);
  ctx.fill();
  kawaiiEye(ctx, cx - r * 0.36, cy - r * 0.05, r * 0.1, r * 0.14, P.ink, P.cream);
  kawaiiEye(ctx, cx + r * 0.36, cy - r * 0.05, r * 0.1, r * 0.14, P.ink, P.cream);
  blushOval(ctx, cx - r * 0.55, cy + r * 0.22, r * 0.15, r * 0.1, P.blush);
  blushOval(ctx, cx + r * 0.55, cy + r * 0.22, r * 0.15, r * 0.1, P.blush);
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.26, r * 0.16, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

export function paintIntroTextures(scene: Phaser.Scene): void {
  const { w, h } = VIGNETTE;
  // 1. Chikki with a cowrie jar
  paintTexture(scene, INTRO_TEX[0], w, h, (ctx) => {
    frame(ctx, w, h, mix(P.peach, P.cream, 0.55), mix(P.butter, P.cream, 0.4));
    softGlow(ctx, w * 0.62, h * 0.55, 70, P.glow, 0.45);
    // table edge
    ctx.fillStyle = mix(P.bark, P.cream, 0.35);
    ctx.fillRect(0, h * 0.74, w, h);
    ctx.fillStyle = alpha(shade(P.bark, -0.2), 0.5);
    ctx.fillRect(0, h * 0.74, w, 3);
    // jar
    const jx = w * 0.66, jy = h * 0.56;
    contactShadow(ctx, jx, h * 0.75, 34, 6, P.ink, 0.14);
    roundRectPath(ctx, jx - 30, jy - 24, 60, 50, 14);
    fillOutlined(ctx, mix(A.reservoir, P.cream, 0.55), 2.5);
    roundRectPath(ctx, jx - 18, jy - 34, 36, 12, 5);
    fillOutlined(ctx, P.bark, 2.5);
    // cowries inside
    ctx.fillStyle = P.cream;
    for (let i = 0; i < 9; i++) {
      const cx = jx - 20 + (i % 3) * 20 + ((i / 3) | 0) * 2, cy = jy + 14 - ((i / 3) | 0) * 11;
      ellipsePath(ctx, cx, cy, 7, 5, 0.3 * (i % 2));
      fillOutlined(ctx, mix(P.cream, P.butter, 0.4), 1.5);
      ctx.strokeStyle = alpha(P.bark, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy);
      ctx.lineTo(cx + 3, cy);
      ctx.stroke();
    }
    sheen(ctx, jx - 18, jy - 10, 5, 14, P.cream, 0.45);
    // Chikki peeking from the left, paws on the table
    const hx = w * 0.3, hy = h * 0.5;
    ellipsePath(ctx, hx, h * 0.8, 36, 22);
    fillOutlined(ctx, P.butter, 2.5);
    chikkiHead(ctx, hx, hy, 34);
    for (const d of [-1, 1]) {
      ellipsePath(ctx, hx + d * 22, h * 0.73, 9, 6);
      fillOutlined(ctx, P.butter, 2);
    }
    // one cowrie held up
    ellipsePath(ctx, hx + 36, h * 0.66, 8, 6, 0.4);
    fillOutlined(ctx, mix(P.cream, P.butter, 0.4), 1.5);
    finish(ctx, w, h);
  });
  // 2. The lake with ridges
  paintTexture(scene, INTRO_TEX[1], w, h, (ctx) => {
    frame(ctx, w, h, LIGHT_KEYS.day.top, LIGHT_KEYS.day.horizon);
    softGlow(ctx, w * 0.75, h * 0.2, 34, P.butter, 0.8);
    ridge(ctx, w, h * 0.52, 44, mix(P.lavender, LIGHT_KEYS.day.horizon, 0.45), 0.4);
    ridge(ctx, w, h * 0.56, 34, mix(P.lavender, P.sage, 0.4), 2.1);
    ridge(ctx, w, h * 0.6, 24, mix(P.moss, P.sage, 0.5), 4.2);
    // water
    ctx.fillStyle = linearGradient(ctx, 0, h * 0.6, 0, h, [[0, mix(A.reservoir, LIGHT_KEYS.day.horizon, 0.3)], [1, A.reservoir]]);
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
    ctx.strokeStyle = alpha(P.cream, 0.55);
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = h * 0.66 + i * 11, x0 = 20 + ((i * 53) % 160);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + 22 + (i % 3) * 10, y);
      ctx.stroke();
    }
    // lily pads and a coracle
    for (const [px, py, r] of [[40, h * 0.86, 10], [62, h * 0.9, 7], [200, h * 0.8, 8]] as const) {
      ellipsePath(ctx, px, py, r, r * 0.55);
      fillOutlined(ctx, P.sage, 1.8);
    }
    const bx = w * 0.56, by = h * 0.74;
    ellipsePath(ctx, bx, by, 22, 8);
    fillOutlined(ctx, A.laterite, 2.2);
    ellipsePath(ctx, bx, by - 2, 16, 4);
    ctx.fillStyle = shade(A.laterite, -0.25);
    ctx.fill();
    // near bank
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.quadraticCurveTo(w * 0.2, h * 0.86, w * 0.42, h);
    ctx.closePath();
    ctx.fillStyle = P.moss;
    ctx.fill();
    finish(ctx, w, h);
  });
  // 3. The shop door with a toran
  paintTexture(scene, INTRO_TEX[2], w, h, (ctx) => {
    frame(ctx, w, h, mix(P.butter, P.cream, 0.5), mix(A.laterite, P.cream, 0.6));
    // wall
    ctx.fillStyle = mix(P.cream, P.butter, 0.3);
    ctx.fillRect(0, h * 0.18, w, h);
    ctx.fillStyle = alpha(P.bark, 0.25);
    ctx.fillRect(0, h * 0.18, w, 4);
    // tiled eave
    ctx.fillStyle = A.laterite;
    for (let x = -6; x < w + 6; x += 16) {
      ellipsePath(ctx, x, h * 0.16, 9, 6);
      fillOutlined(ctx, A.laterite, 1.8);
    }
    // door
    const dx = w / 2, dy = h * 0.6;
    contactShadow(ctx, dx, h * 0.96, 48, 6, P.ink, 0.12);
    roundRectPath(ctx, dx - 44, dy - 40, 88, 100, 10);
    fillOutlined(ctx, shade(P.bark, -0.05), 2.5);
    ctx.strokeStyle = alpha(shade(P.bark, -0.3), 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dx, dy - 36);
    ctx.lineTo(dx, dy + 56);
    ctx.stroke();
    // warm glow from inside through the gap
    softGlow(ctx, dx, dy + 10, 26, P.glow, 0.5);
    // handles
    for (const d of [-1, 1]) {
      ellipsePath(ctx, dx + d * 8, dy + 8, 3.5, 3.5);
      fillOutlined(ctx, A.marigold, 1.5);
    }
    // toran: a string of marigold and mango leaves
    ctx.strokeStyle = shade(P.bark, -0.2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dx - 60, dy - 48);
    ctx.quadraticCurveTo(dx, dy - 30, dx + 60, dy - 48);
    ctx.stroke();
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, x = dx - 60 + t * 120, y = dy - 48 + 18 * 4 * t * (1 - t);
      ellipsePath(ctx, x, y + 9, 4, 8);
      fillOutlined(ctx, P.sage, 1.5);
      ellipsePath(ctx, x, y + 1, 5, 5);
      fillOutlined(ctx, A.marigold, 1.5);
    }
    // a potted plant and a small sign
    roundRectPath(ctx, 28, h * 0.78, 30, 26, 6);
    fillOutlined(ctx, A.laterite, 2);
    for (const [lx, ly] of [[36, h * 0.7], [46, h * 0.66], [56, h * 0.72]] as const) {
      ellipsePath(ctx, lx, ly, 8, 11, 0.2);
      fillOutlined(ctx, P.sage, 1.8);
    }
    roundRectPath(ctx, w - 74, h * 0.4, 48, 22, 6);
    fillOutlined(ctx, P.cream, 2);
    ctx.strokeStyle = alpha(P.ink, 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w - 66, h * 0.4 + 11);
    ctx.lineTo(w - 34, h * 0.4 + 11);
    ctx.stroke();
    finish(ctx, w, h);
  });
}
