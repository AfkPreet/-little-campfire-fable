/**
 * journal.ts: the notebook's art. Cover (bark-cream with a jute spine), paper page (grain + ruled lines), six paper
 * tabs (one tinted texture each), the round rose rubber stamp, the two badges, six moment vignettes, the guardian
 * lantern for the last clue, a page-turn arrow and an empty heart. All painted once at 2x through the pipeline.
 */
import Phaser from 'phaser';
import { PALETTE, ACCENTS, shade, mix, alpha, outline } from '@/config/palette';
import {
  paintTexture, ellipsePath, roundRectPath, fillOutlined, softGlow, radialGradient, linearGradient, paperGrain,
  blobPath, type Ctx,
} from '@/art/pipeline';
import type { MomentId } from '@/data/types';

export type JournalTab = 'fish' | 'recipes' | 'moments' | 'friends' | 'mystery' | 'trip';
export const JOURNAL_TABS: readonly JournalTab[] = ['fish', 'recipes', 'moments', 'friends', 'mystery', 'trip'];

/** Logical sizes (the scene lays out from these). */
export const BOOK = {
  w: 860,
  h: 600,
  radius: 22,
  spineW: 54,
  tab: { w: 60, h: 68, gap: 10, pullOut: 10, topInset: 36 },
  stamp: 80,
  badge: 84,
  vignette: { w: 150, h: 96 },
  lantern: { w: 56, h: 76 },
  arrow: 44,
  heart: 32,
} as const;

export const JOURNAL_TEX = {
  cover: 'journal-cover',
  page: 'journal-page',
  stamp: 'journal-stamp',
  badgeHappy: 'journal-badge-happy',
  badgeGuardian: 'journal-badge-guardian',
  lantern: 'journal-lantern',
  arrow: 'journal-arrow',
  heartEmpty: 'journal-heart-empty',
  ribbon: 'journal-ribbon',
} as const;

export function tabTexKey(tab: JournalTab): string {
  return `journal-tab-${tab}`;
}
export function vignetteKey(id: MomentId): string {
  return `journal-vignette-${id}`;
}

/** Paper tint per tab (all pastel palette tokens, lightened toward cream). */
export const TAB_TINT: Record<JournalTab, string> = {
  fish: mix(PALETTE.powder, PALETTE.cream, 0.25),
  recipes: mix(PALETTE.peach, PALETTE.cream, 0.3),
  moments: mix(PALETTE.lavender, PALETTE.cream, 0.3),
  friends: mix(PALETTE.sage, PALETTE.cream, 0.3),
  mystery: mix(ACCENTS.reservoir, PALETTE.cream, 0.3),
  trip: mix(PALETTE.butter, PALETTE.cream, 0.25),
};

const PAPER = PALETTE.cream;
const RULE = alpha(PALETTE.powder, 0.5);
const INK = PALETTE.ink;

export function paintJournalTextures(scene: Phaser.Scene): void {
  paintCover(scene);
  paintPage(scene);
  for (const t of JOURNAL_TABS) paintTab(scene, t);
  paintStamp(scene);
  paintBadges(scene);
  paintLantern(scene);
  paintArrow(scene);
  paintHeartEmpty(scene);
  paintRibbon(scene);
  paintVignettes(scene);
}

// ---------- cover and page ----------
function paintCover(scene: Phaser.Scene): void {
  const { w, h, radius, spineW } = BOOK;
  paintTexture(scene, JOURNAL_TEX.cover, w + 24, h + 28, (ctx) => {
    const x = 12, y = 10;
    // soft ink shadow under the book
    ctx.save();
    ctx.shadowColor = alpha(INK, 0.22);
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = PALETTE.bark;
    ctx.fill();
    ctx.restore();
    // bark-cream cover (warm, lightened bark)
    const cover = mix(PALETTE.bark, PALETTE.cream, 0.55);
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = linearGradient(ctx, 0, y, 0, y + h, [[0, shade(cover, 0.06)], [1, shade(cover, -0.05)]]);
    ctx.fill();
    paperGrain(ctx, x, y, w, h, INK, 0.05, 11);
    // a faint inner frame, hand-drawn feel
    ctx.save();
    ctx.strokeStyle = alpha(shade(cover, -0.35), 0.45);
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 7]);
    roundRectPath(ctx, x + spineW + 18, y + 18, w - spineW - 36, h - 36, radius - 6);
    ctx.stroke();
    ctx.restore();
    // jute spine: woven stripes
    ctx.save();
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.clip();
    const jute = ACCENTS.marigold;
    ctx.fillStyle = shade(jute, -0.12);
    ctx.fillRect(x, y, spineW, h);
    ctx.strokeStyle = alpha(shade(jute, -0.45), 0.35);
    ctx.lineWidth = 2;
    for (let yy = y + 6; yy < y + h; yy += 9) {
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + spineW, yy + 3);
      ctx.stroke();
    }
    for (let xx = x + 8; xx < x + spineW; xx += 11) {
      ctx.beginPath();
      ctx.moveTo(xx, y);
      ctx.lineTo(xx + 2, y + h);
      ctx.stroke();
    }
    // stitching along the spine edge
    ctx.strokeStyle = alpha(PALETTE.cream, 0.7);
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + spineW - 6, y + 10);
    ctx.lineTo(x + spineW - 6, y + h - 10);
    ctx.stroke();
    ctx.restore();
    // outline
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.strokeStyle = outline(cover, 0.3);
    ctx.lineWidth = 3;
    ctx.stroke();
    // a label patch for the title (cream paper, slightly tilted)
    ctx.save();
    ctx.translate(x + spineW + (w - spineW) / 2, y + h * 0.36);
    ctx.rotate(-0.02);
    roundRectPath(ctx, -230, -56, 460, 112, 16);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.strokeStyle = outline(PAPER, 0.25);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    paperGrain(ctx, -230, -56, 460, 112, INK, 0.04, 3);
    ctx.restore();
  });
}

function paintPage(scene: Phaser.Scene): void {
  const { w, h, radius, spineW } = BOOK;
  paintTexture(scene, JOURNAL_TEX.page, w + 24, h + 28, (ctx) => {
    const x = 12, y = 10;
    ctx.save();
    ctx.shadowColor = alpha(INK, 0.2);
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.restore();
    // back cover peeking at the right/bottom edge (stack feel)
    const cover = mix(PALETTE.bark, PALETTE.cream, 0.55);
    roundRectPath(ctx, x + 4, y + 6, w, h, radius);
    ctx.fillStyle = shade(cover, -0.05);
    ctx.fill();
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = PAPER;
    ctx.fill();
    paperGrain(ctx, x, y, w, h, INK, 0.035, 5);
    // ruled lines over the writing area
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 1.5;
    for (let yy = y + 70; yy < y + h - 30; yy += 28) {
      ctx.beginPath();
      ctx.moveTo(x + spineW + 10, yy);
      ctx.lineTo(x + w - 24, yy);
      ctx.stroke();
    }
    // margin line (rose, faint)
    ctx.strokeStyle = alpha(PALETTE.rose, 0.45);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + spineW + 10, y + 14);
    ctx.lineTo(x + spineW + 10, y + h - 14);
    ctx.stroke();
    // spine gutter: a soft shade and ring holes
    ctx.fillStyle = linearGradient(ctx, x, 0, x + spineW, 0, [[0, alpha(INK, 0.1)], [1, alpha(INK, 0)]]);
    ctx.fillRect(x, y, spineW, h);
    const holes = 7;
    for (let i = 0; i < holes; i++) {
      const hy = y + 50 + (i * (h - 100)) / (holes - 1);
      ellipsePath(ctx, x + spineW / 2, hy, 7, 7);
      ctx.fillStyle = mix(PALETTE.bark, PALETTE.cream, 0.6);
      ctx.fill();
      ctx.strokeStyle = outline(PALETTE.bark, 0.1);
      ctx.lineWidth = 2;
      ctx.stroke();
      // jute ring
      ctx.beginPath();
      ctx.ellipse(x + spineW / 2 - 8, hy, 12, 9, 0, -Math.PI * 0.55, Math.PI * 0.55);
      ctx.strokeStyle = shade(ACCENTS.marigold, -0.25);
      ctx.lineWidth = 3.5;
      ctx.stroke();
    }
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.strokeStyle = outline(PAPER, 0.22);
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });
}

function paintTab(scene: Phaser.Scene, tab: JournalTab): void {
  const { w, h } = BOOK.tab;
  paintTexture(scene, tabTexKey(tab), w + 12, h + 16, (ctx) => {
    const x = 2, y = 6;
    const fill = TAB_TINT[tab];
    ctx.save();
    ctx.shadowColor = alpha(INK, 0.16);
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    // left edge square (tucks into the book), right side rounded
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - 14, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + 14);
    ctx.lineTo(x + w, y + h - 14);
    ctx.quadraticCurveTo(x + w, y + h, x + w - 14, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
    paperGrain(ctx, x, y, w, h, INK, 0.04, 9);
    ctx.strokeStyle = outline(fill, 0.2);
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });
}

// ---------- stamp and badges ----------
function paintStamp(scene: Phaser.Scene): void {
  const d = BOOK.stamp;
  paintTexture(scene, JOURNAL_TEX.stamp, d, d, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2, r = d / 2 - 4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.16);
    ctx.globalAlpha = 0.8;
    const ink = PALETTE.rose;
    // outer ring, slightly uneven like a real stamp
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const rr = r + Math.sin(a * 5) * 0.8;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r - 8, 0, Math.PI * 2);
    ctx.stroke();
    // a little leaf in the middle
    ctx.fillStyle = ink;
    ellipsePath(ctx, 0, 2, 12, 20, 0.5);
    ctx.fill();
    ctx.strokeStyle = alpha(PALETTE.cream, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-7, 14);
    ctx.lineTo(8, -10);
    ctx.stroke();
    // worn patches: erase a few flecks
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39, rr = (r - 4) * (0.3 + ((i * 37) % 10) / 14);
      ellipsePath(ctx, Math.cos(a) * rr, Math.sin(a) * rr, 2.2, 1.4, a);
      ctx.fill();
    }
    ctx.restore();
  });
}

function paintBadges(scene: Phaser.Scene): void {
  const d = BOOK.badge;
  // Happy Camper: a tiny tent inside a laurel
  paintTexture(scene, JOURNAL_TEX.badgeHappy, d, d, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    ellipsePath(ctx, cx, cy, d / 2 - 3, d / 2 - 3);
    ctx.fillStyle = mix(PALETTE.butter, PALETTE.cream, 0.4);
    ctx.fill();
    ctx.strokeStyle = outline(PALETTE.butter, 0.25);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // laurel leaves on both sides
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 2 + side * (0.35 + i * 0.3);
        const r = d / 2 - 13;
        const lx = cx + Math.cos(a) * r, ly = cy + Math.sin(a) * r;
        ellipsePath(ctx, lx, ly, 7, 3.6, a + side * 0.9);
        fillOutlined(ctx, PALETTE.sage, 1.5);
      }
    }
    // tent
    const tx = cx, ty = cy + 10;
    ctx.beginPath();
    ctx.moveTo(tx - 20, ty);
    ctx.lineTo(tx, ty - 26);
    ctx.lineTo(tx + 20, ty);
    ctx.closePath();
    fillOutlined(ctx, PALETTE.peach, 2);
    ctx.beginPath();
    ctx.moveTo(tx - 6, ty);
    ctx.lineTo(tx, ty - 12);
    ctx.lineTo(tx + 6, ty);
    ctx.closePath();
    ctx.fillStyle = shade(PALETTE.peach, -0.35);
    ctx.fill();
    softGlow(ctx, tx, ty - 6, 10, PALETTE.glow, 0.5);
  });
  // Guardian Friend: a scale with a glow
  paintTexture(scene, JOURNAL_TEX.badgeGuardian, d, d, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    ellipsePath(ctx, cx, cy, d / 2 - 3, d / 2 - 3);
    ctx.fillStyle = mix(PALETTE.lavender, PALETTE.cream, 0.4);
    ctx.fill();
    ctx.strokeStyle = outline(PALETTE.lavender, 0.25);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    softGlow(ctx, cx, cy, d / 2 - 10, PALETTE.glow, 0.7);
    // scale: a rounded teardrop
    ctx.beginPath();
    ctx.moveTo(cx, cy - 24);
    ctx.quadraticCurveTo(cx + 24, cy - 2, cx, cy + 22);
    ctx.quadraticCurveTo(cx - 24, cy - 2, cx, cy - 24);
    ctx.closePath();
    ctx.fillStyle = radialGradient(ctx, cx - 4, cy - 6, 2, 26, [[0, PALETTE.cream], [0.5, ACCENTS.reservoir], [1, shade(ACCENTS.reservoir, -0.2)]]);
    ctx.fill();
    ctx.strokeStyle = outline(ACCENTS.reservoir, 0.25);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // ridges
    ctx.strokeStyle = alpha(PALETTE.cream, 0.6);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 6 + i * 5, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    }
  });
}

function paintLantern(scene: Phaser.Scene): void {
  const { w, h } = BOOK.lantern;
  paintTexture(scene, JOURNAL_TEX.lantern, w + 40, h + 40, (ctx, tw, th) => {
    const cx = tw / 2, top = 20;
    softGlow(ctx, cx, top + h * 0.55, w * 0.9, PALETTE.glow, 0.8);
    // hanger
    ctx.strokeStyle = shade(PALETTE.bark, -0.2);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, top + 6, 6, Math.PI, 0);
    ctx.stroke();
    // cap
    roundRectPath(ctx, cx - 14, top + 8, 28, 8, 4);
    fillOutlined(ctx, PALETTE.bark, 2);
    // body
    ellipsePath(ctx, cx, top + h * 0.55, w / 2 - 4, h / 2 - 12);
    ctx.fillStyle = radialGradient(ctx, cx, top + h * 0.55, 2, w / 2, [[0, PALETTE.glow], [0.7, ACCENTS.reservoir], [1, shade(ACCENTS.reservoir, -0.15)]]);
    ctx.fill();
    ctx.strokeStyle = outline(ACCENTS.reservoir, 0.25);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // ribs
    ctx.strokeStyle = alpha(PALETTE.cream, 0.5);
    ctx.lineWidth = 1.5;
    for (const k of [-0.5, 0, 0.5]) {
      ellipsePath(ctx, cx, top + h * 0.55, Math.abs(k) * (w / 2 - 4) + 2, h / 2 - 12);
      if (k === 0) ctx.stroke();
      else ctx.stroke();
    }
    // base
    roundRectPath(ctx, cx - 12, top + h - 8, 24, 8, 4);
    fillOutlined(ctx, PALETTE.bark, 2);
    void th;
  });
}

function paintArrow(scene: Phaser.Scene): void {
  const d = BOOK.arrow;
  paintTexture(scene, JOURNAL_TEX.arrow, d, d, (ctx, w, h) => {
    // a soft chevron pointing right
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w * 0.38, h * 0.26);
    ctx.lineTo(w * 0.62, h * 0.5);
    ctx.lineTo(w * 0.38, h * 0.74);
    ctx.stroke();
  });
}

function paintHeartEmpty(scene: Phaser.Scene): void {
  const d = BOOK.heart;
  paintTexture(scene, JOURNAL_TEX.heartEmpty, d, d, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2 + 1, s = 11;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s);
    ctx.bezierCurveTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.9, cy - s * 1.2, cx, cy - s * 0.4);
    ctx.bezierCurveTo(cx + s * 0.9, cy - s * 1.2, cx + s * 1.6, cy - s * 0.2, cx, cy + s);
    ctx.closePath();
    ctx.fillStyle = alpha(PALETTE.rose, 0.18);
    ctx.fill();
    ctx.strokeStyle = alpha(PALETTE.rose, 0.8);
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });
}

function paintRibbon(scene: Phaser.Scene): void {
  // a small rose bookmark ribbon hanging from the cover
  paintTexture(scene, JOURNAL_TEX.ribbon, 28, 90, (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(w - 4, 0);
    ctx.lineTo(w - 4, h - 14);
    ctx.lineTo(w / 2, h - 2);
    ctx.lineTo(4, h - 14);
    ctx.closePath();
    fillOutlined(ctx, PALETTE.rose, 2);
  });
}

// ---------- moment vignettes ----------
const SKY_NIGHT = LIGHT_NIGHT();
function LIGHT_NIGHT(): { top: string; bottom: string } {
  return { top: mix(PALETTE.ink, PALETTE.lavender, 0.35), bottom: mix(PALETTE.lavender, PALETTE.ink, 0.35) };
}

function vignetteFrame(ctx: Ctx, w: number, h: number, top: string, bottom: string, draw: () => void): void {
  const r = 14;
  ctx.save();
  roundRectPath(ctx, 2, 2, w - 4, h - 4, r);
  ctx.clip();
  ctx.fillStyle = linearGradient(ctx, 0, 0, 0, h, [[0, top], [1, bottom]]);
  ctx.fillRect(0, 0, w, h);
  draw();
  ctx.restore();
  roundRectPath(ctx, 2, 2, w - 4, h - 4, r);
  ctx.strokeStyle = alpha(INK, 0.35);
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function hills(ctx: Ctx, w: number, h: number, color: string, y: number): void {
  blobPath(ctx, [[-10, h + 10], [-10, y + 10], [w * 0.2, y - 6], [w * 0.5, y + 8], [w * 0.8, y - 4], [w + 10, y + 6], [w + 10, h + 10]]);
  ctx.fillStyle = color;
  ctx.fill();
}

function stars(ctx: Ctx, w: number, h: number, n: number, seed: number): void {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  ctx.fillStyle = alpha(PALETTE.cream, 0.85);
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h * 0.6, r = 0.8 + rnd() * 1.2;
    ellipsePath(ctx, x, y, r, r);
    ctx.fill();
  }
}

function paintVignettes(scene: Phaser.Scene): void {
  const { w, h } = BOOK.vignette;
  paintTexture(scene, vignetteKey('shooting_star'), w, h, (ctx) => {
    vignetteFrame(ctx, w, h, SKY_NIGHT.top, SKY_NIGHT.bottom, () => {
      stars(ctx, w, h, 22, 3);
      hills(ctx, w, h, mix(PALETTE.moss, PALETTE.ink, 0.5), h * 0.72);
      // streak
      ctx.strokeStyle = linearGradient(ctx, w * 0.25, h * 0.2, w * 0.7, h * 0.5, [[0, alpha(PALETTE.glow, 0)], [1, PALETTE.glow]]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w * 0.25, h * 0.2);
      ctx.lineTo(w * 0.7, h * 0.5);
      ctx.stroke();
      softGlow(ctx, w * 0.7, h * 0.5, 10, PALETTE.glow, 1);
      ellipsePath(ctx, w * 0.7, h * 0.5, 3.5, 3.5);
      ctx.fillStyle = PALETTE.cream;
      ctx.fill();
    });
  });
  paintTexture(scene, vignetteKey('rainbow'), w, h, (ctx) => {
    vignetteFrame(ctx, w, h, mix(PALETTE.powder, PALETTE.cream, 0.2), PALETTE.cream, () => {
      const bands = [PALETTE.rose, PALETTE.peach, PALETTE.butter, PALETTE.sage, PALETTE.powder, PALETTE.lavender];
      bands.forEach((c, i) => {
        ctx.strokeStyle = alpha(c, 0.85);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(w / 2, h * 0.95, w * 0.42 - i * 5, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
      });
      // water
      ctx.fillStyle = ACCENTS.reservoir;
      ctx.fillRect(0, h * 0.72, w, h);
      ctx.strokeStyle = alpha(PALETTE.cream, 0.5);
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(w * (0.15 + i * 0.2), h * (0.8 + (i % 2) * 0.06));
        ctx.lineTo(w * (0.25 + i * 0.2), h * (0.8 + (i % 2) * 0.06));
        ctx.stroke();
      }
    });
  });
  paintTexture(scene, vignetteKey('firefly_swirl'), w, h, (ctx) => {
    vignetteFrame(ctx, w, h, SKY_NIGHT.top, SKY_NIGHT.bottom, () => {
      hills(ctx, w, h, mix(PALETTE.moss, PALETTE.ink, 0.5), h * 0.75);
      // fire
      softGlow(ctx, w * 0.5, h * 0.72, 30, PALETTE.ember, 0.5);
      ellipsePath(ctx, w * 0.5, h * 0.76, 10, 6);
      ctx.fillStyle = PALETTE.ember;
      ctx.fill();
      // spiral of fireflies
      for (let i = 0; i < 16; i++) {
        const t = i / 16;
        const a = t * Math.PI * 3.2;
        const r = 10 + t * 34;
        const fx = w * 0.5 + Math.cos(a) * r, fy = h * 0.55 - t * 22 + Math.sin(a) * r * 0.5;
        softGlow(ctx, fx, fy, 6, PALETTE.glow, 0.7);
        ellipsePath(ctx, fx, fy, 1.8, 1.8);
        ctx.fillStyle = PALETTE.glow;
        ctx.fill();
      }
    });
  });
  paintTexture(scene, vignetteKey('misty_sunrise'), w, h, (ctx) => {
    vignetteFrame(ctx, w, h, mix(PALETTE.lavender, PALETTE.cream, 0.3), mix(PALETTE.peach, PALETTE.cream, 0.3), () => {
      softGlow(ctx, w * 0.6, h * 0.45, 40, PALETTE.butter, 0.8);
      ellipsePath(ctx, w * 0.6, h * 0.45, 12, 12);
      ctx.fillStyle = mix(PALETTE.butter, PALETTE.cream, 0.3);
      ctx.fill();
      hills(ctx, w, h, alpha(PALETTE.lavender, 0.7), h * 0.6);
      hills(ctx, w, h, alpha(mix(PALETTE.sage, PALETTE.lavender, 0.4), 0.9), h * 0.76);
      // mist bands
      for (let i = 0; i < 3; i++) {
        ellipsePath(ctx, w * (0.3 + i * 0.25), h * (0.7 + i * 0.07), w * 0.35, 7);
        ctx.fillStyle = alpha(PALETTE.cream, 0.55);
        ctx.fill();
      }
    });
  });
  paintTexture(scene, vignetteKey('golden_whisker'), w, h, (ctx) => {
    vignetteFrame(ctx, w, h, mix(ACCENTS.reservoir, PALETTE.cream, 0.2), ACCENTS.reservoir, () => {
      softGlow(ctx, w * 0.5, h * 0.5, 36, PALETTE.glow, 0.8);
      // golden fish body
      ellipsePath(ctx, w * 0.5, h * 0.5, 30, 15);
      ctx.fillStyle = radialGradient(ctx, w * 0.5 - 6, h * 0.46, 2, 32, [[0, PALETTE.cream], [0.6, ACCENTS.marigold], [1, shade(ACCENTS.marigold, -0.2)]]);
      ctx.fill();
      ctx.strokeStyle = outline(ACCENTS.marigold, 0.25);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // tail
      ctx.beginPath();
      ctx.moveTo(w * 0.5 + 28, h * 0.5);
      ctx.lineTo(w * 0.5 + 44, h * 0.5 - 13);
      ctx.lineTo(w * 0.5 + 44, h * 0.5 + 13);
      ctx.closePath();
      fillOutlined(ctx, ACCENTS.marigold, 2);
      // whiskers
      ctx.strokeStyle = PALETTE.glow;
      ctx.lineWidth = 2;
      for (const dy of [-3, 4]) {
        ctx.beginPath();
        ctx.moveTo(w * 0.5 - 28, h * 0.5 + dy);
        ctx.quadraticCurveTo(w * 0.5 - 44, h * 0.5 + dy * 2, w * 0.5 - 50, h * 0.5 + dy * 3);
        ctx.stroke();
      }
      // eye
      ellipsePath(ctx, w * 0.5 - 18, h * 0.47, 3, 3.6);
      ctx.fillStyle = INK;
      ctx.fill();
    });
  });
  paintTexture(scene, vignetteKey('moonbow'), w, h, (ctx) => {
    vignetteFrame(ctx, w, h, SKY_NIGHT.top, SKY_NIGHT.bottom, () => {
      stars(ctx, w, h, 12, 9);
      softGlow(ctx, w * 0.82, h * 0.22, 18, PALETTE.cream, 0.6);
      ellipsePath(ctx, w * 0.82, h * 0.22, 8, 8);
      ctx.fillStyle = PALETTE.cream;
      ctx.fill();
      const bands = [PALETTE.lavender, PALETTE.powder, PALETTE.cream, PALETTE.rose];
      bands.forEach((c, i) => {
        ctx.strokeStyle = alpha(c, 0.45);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(w / 2, h * 0.95, w * 0.4 - i * 5, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
      });
      ctx.fillStyle = mix(ACCENTS.reservoir, PALETTE.ink, 0.5);
      ctx.fillRect(0, h * 0.74, w, h);
      // rain streaks
      ctx.strokeStyle = alpha(PALETTE.powder, 0.5);
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const rx = (i * 19 + 7) % w;
        ctx.beginPath();
        ctx.moveTo(rx, h * 0.3 + (i % 3) * 10);
        ctx.lineTo(rx - 3, h * 0.3 + (i % 3) * 10 + 12);
        ctx.stroke();
      }
    });
  });
}
