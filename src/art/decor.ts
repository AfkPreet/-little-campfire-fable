/**
 * decor.ts: part textures for the 11 Cozy-tab decor items (spec section 6 "Decor", ART_BIBLE sections 5-6).
 * Keys are stable: 'decor-<id>-<part>'. Each item is split into the parts its idle animation moves
 * (a nodding bloom, a swaying lantern, fluttering leaves, swinging chime tubes, twinkling bulbs).
 * Sizes are world px (40-90). Everything is painted once at 2x through the pipeline.
 */
import type Phaser from 'phaser';
import { PALETTE, ACCENTS, alpha, mix, outline, shade } from '@/config/palette';
import {
  paintTexture, roundRectPath, ellipsePath, fillOutlined, contactShadow, softGlow, sheen, linearGradient, type Ctx,
} from '@/art/pipeline';
import { paintFxTextures } from '@/fx/textures';

const P = PALETTE, A = ACCENTS;

export const DECOR_KEYS = {
  flowerPot: 'decor-flower-pot',
  flowerBloom: 'decor-flower-bloom',
  lanternBody: 'decor-lantern-body',
  lanternCord: 'decor-lantern-cord',
  cushion: 'decor-cushion-body',
  buntingLeaf: (i: number) => `decor-bunting-leaf-${i}`,
  chimeTop: 'decor-chime-top',
  chimeTube: (i: number) => `decor-chime-tube-${i}`,
  rug: 'decor-rug-body',
  lightsBulb: 'decor-lights-bulb',
  bookshelf: 'decor-bookshelf-body',
  hammockSling: 'decor-hammock-sling',
  telescopeTripod: 'decor-telescope-tripod',
  telescopeTube: 'decor-telescope-tube',
  guardianBody: 'decor-guardian_lantern-body',
  guardianHalo: 'decor-guardian_lantern-halo',
  snapRing: 'decor-snap-ring',
  glowPool: 'decor-glow-pool',
} as const;

/** Logical sizes of the parts (the entity reads these for anchors and hit rects). */
export const DECOR_SIZES = {
  flowerPot: { w: 44, h: 34 },
  flowerBloom: { w: 40, h: 44 },
  lanternBody: { w: 42, h: 58 },
  lanternCord: { w: 6, h: 16 },
  cushion: { w: 62, h: 30 },
  buntingLeaf: { w: 16, h: 26 },
  buntingLeaves: 7,
  buntingSpan: 92,
  chimeTop: { w: 42, h: 14 },
  chimeTube: { w: 8, h: 44 },
  chimeTubes: 4,
  rug: { w: 92, h: 26 },
  lightsBulb: { w: 12, h: 16 },
  lightsBulbs: 8,
  bookshelf: { w: 58, h: 62 },
  hammockSling: { w: 132, h: 42 },
  telescopeTripod: { w: 52, h: 62 },
  telescopeTube: { w: 58, h: 16 },
  guardianBody: { w: 46, h: 50 },
  guardianHalo: 110,
  snapRing: 40,
  glowPool: 128,
} as const;

export const BAMBOO = mix(P.butter, P.sage, 0.42);
const BRASS = mix(A.marigold, P.butter, 0.3);
const JAMKHANA = [P.rose, P.sage, P.butter, P.rose, P.sage, P.butter] as const;
export const BOOK_SPINES = [P.rose, P.sage, A.marigold, P.powder, P.lavender] as const;

function stroke(ctx: Ctx, color: string, w: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

// ---------- painters ----------
function flowerPot(ctx: Ctx, w: number, h: number): void {
  contactShadow(ctx, w / 2, h - 3, w / 2 - 4, 4, P.ink, 0.14);
  ctx.beginPath();
  ctx.moveTo(6, 8); ctx.lineTo(w - 6, 8); ctx.lineTo(w - 11, h - 5); ctx.quadraticCurveTo(w / 2, h - 1, 11, h - 5); ctx.closePath();
  fillOutlined(ctx, A.laterite);
  roundRectPath(ctx, 3, 2, w - 6, 10, 4);
  fillOutlined(ctx, shade(A.laterite, 0.1), 2);
  sheen(ctx, 14, 18, 4, 9, P.cream, 0.22);
}
function flowerBloom(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  // stem and two leaves (pivot at the bottom center)
  ctx.beginPath(); ctx.moveTo(cx, h - 2); ctx.quadraticCurveTo(cx + 2, h / 2, cx, 20);
  stroke(ctx, P.moss, 3);
  for (const s of [-1, 1]) {
    ellipsePath(ctx, cx + s * 8, h - 14, 8, 4, s * 0.6);
    fillOutlined(ctx, P.sage, 1.6);
  }
  // hibiscus: five rose petals, butter stamen
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k / 5) * Math.PI * 2;
    ellipsePath(ctx, cx + Math.cos(a) * 9, 17 + Math.sin(a) * 9, 9, 6.5, a);
    fillOutlined(ctx, k % 2 ? P.rose : shade(P.rose, 0.08), 1.8);
  }
  ellipsePath(ctx, cx, 17, 4.5, 4.5);
  fillOutlined(ctx, P.butter, 1.4);
  ctx.beginPath(); ctx.moveTo(cx, 17); ctx.lineTo(cx + 5, 7); stroke(ctx, A.marigold, 1.6);
  ellipsePath(ctx, cx + 5, 6.5, 1.8, 1.8); ctx.fillStyle = P.butter; ctx.fill();
}
function lanternBody(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  roundRectPath(ctx, cx - 8, 1, 16, 7, 3); fillOutlined(ctx, P.bark, 1.8);
  roundRectPath(ctx, cx - 8, h - 8, 16, 7, 3); fillOutlined(ctx, P.bark, 1.8);
  ellipsePath(ctx, cx, h / 2, w / 2 - 2, h / 2 - 9);
  ctx.fillStyle = linearGradient(ctx, 0, 8, 0, h - 8, [[0, mix(P.cream, P.butter, 0.5)], [1, P.butter]]);
  ctx.fill();
  stroke(ctx, outline(P.butter, 0.26), 2.2);
  for (const t of [0.3, 0.5, 0.7]) {
    const y = 8 + (h - 16) * t;
    const rx = (w / 2 - 2) * Math.sqrt(1 - ((y - h / 2) / (h / 2 - 9)) ** 2);
    ctx.beginPath(); ctx.moveTo(cx - rx, y); ctx.lineTo(cx + rx, y);
    stroke(ctx, alpha(shade(P.butter, -0.25), 0.5), 1.4);
  }
  ellipsePath(ctx, cx, h / 2 + 2, 6, 9); ctx.fillStyle = alpha(P.glow, 0.7); ctx.fill();
  sheen(ctx, cx - 9, h / 2 - 8, 3.5, 9, P.cream, 0.4);
}
function lanternCord(ctx: Ctx, w: number, h: number): void {
  ctx.beginPath(); ctx.moveTo(w / 2, 1); ctx.lineTo(w / 2, h - 1); stroke(ctx, P.bark, 2.4);
}
function cushion(ctx: Ctx, w: number, h: number): void {
  contactShadow(ctx, w / 2, h - 3, w / 2 - 6, 4, P.ink, 0.14);
  roundRectPath(ctx, 2, 6, w - 4, h - 9, 13);
  fillOutlined(ctx, P.rose);
  ctx.save();
  roundRectPath(ctx, 2, 6, w - 4, h - 9, 13); ctx.clip();
  JAMKHANA.forEach((c, i) => { ctx.fillStyle = alpha(c, 0.55); ctx.fillRect(2 + i * ((w - 4) / 6), 6, (w - 4) / 6, h); });
  ctx.restore();
  roundRectPath(ctx, 7, 2, w - 14, 12, 6); fillOutlined(ctx, shade(P.rose, 0.14), 1.8);
  ellipsePath(ctx, w / 2, 9, 2.6, 2.6); ctx.fillStyle = P.cream; ctx.fill();
}
function buntingLeaf(i: number) {
  return (ctx: Ctx, w: number, h: number): void => {
    const fill = [P.sage, mix(P.sage, P.moss, 0.5), mix(P.sage, P.butter, 0.25)][i % 3];
    // mango leaf hanging from the top center: a long pointed ellipse
    ctx.beginPath();
    ctx.moveTo(w / 2, 1);
    ctx.quadraticCurveTo(w - 1, h * 0.45, w / 2, h - 1);
    ctx.quadraticCurveTo(1, h * 0.45, w / 2, 1);
    ctx.closePath();
    fillOutlined(ctx, fill, 1.6);
    ctx.beginPath(); ctx.moveTo(w / 2, 3); ctx.lineTo(w / 2, h - 4); stroke(ctx, alpha(shade(fill, -0.3), 0.6), 1);
  };
}
function chimeTop(ctx: Ctx, w: number, h: number): void {
  ellipsePath(ctx, w / 2, h / 2 + 1, w / 2 - 2, h / 2 - 2);
  fillOutlined(ctx, P.bark, 2);
  sheen(ctx, w / 2 - 8, h / 2 - 1, 7, 2, P.cream, 0.2);
}
function chimeTube(i: number) {
  return (ctx: Ctx, w: number, h: number): void => {
    roundRectPath(ctx, 1, 1, w - 2, h - 2, 3);
    fillOutlined(ctx, i % 2 ? BAMBOO : shade(BAMBOO, 0.06), 1.6);
    for (const t of [0.35, 0.72]) { ctx.beginPath(); ctx.moveTo(1.5, h * t); ctx.lineTo(w - 1.5, h * t); stroke(ctx, alpha(shade(BAMBOO, -0.35), 0.6), 1.2); }
  };
}
function rug(ctx: Ctx, w: number, h: number): void {
  contactShadow(ctx, w / 2, h - 3, w / 2 - 4, 3, P.ink, 0.1);
  // a flat woven oval seen in side view, striped
  ctx.save();
  ellipsePath(ctx, w / 2, h / 2, w / 2 - 2, h / 2 - 3);
  ctx.clip();
  const n = 9;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = JAMKHANA[i % 3];
    ctx.fillRect(2 + (i * (w - 4)) / n, 0, (w - 4) / n + 1, h);
  }
  ctx.restore();
  ellipsePath(ctx, w / 2, h / 2, w / 2 - 2, h / 2 - 3);
  stroke(ctx, outline(P.rose, 0.26), 2.2);
  // fringe knots at both ends
  for (const s of [3, w - 3]) for (let k = -1; k <= 1; k++) { ellipsePath(ctx, s, h / 2 + k * 4, 1.6, 1.6); ctx.fillStyle = P.cream; ctx.fill(); }
}
function lightsBulb(ctx: Ctx, w: number, h: number): void {
  roundRectPath(ctx, w / 2 - 2.5, 1, 5, 4, 1.5); fillOutlined(ctx, P.bark, 1.2);
  ellipsePath(ctx, w / 2, h / 2 + 3, w / 2 - 1.5, h / 2 - 4.5);
  fillOutlined(ctx, P.glow, 1.4);
  sheen(ctx, w / 2 - 1.5, h / 2 + 1, 1.3, 2.4, P.cream, 0.6);
}
function bookshelf(ctx: Ctx, w: number, h: number): void {
  contactShadow(ctx, w / 2, h - 3, w / 2 - 4, 4, P.ink, 0.14);
  roundRectPath(ctx, 2, 2, w - 4, h - 5, 5);
  fillOutlined(ctx, P.bark);
  // inside: two shelves
  ctx.fillStyle = shade(P.bark, -0.18);
  ctx.fillRect(6, 8, w - 12, h / 2 - 11);
  ctx.fillRect(6, h / 2 + 2, w - 12, h / 2 - 11);
  // spines, five palette colors, two per top shelf and three below
  const spine = (x: number, y: number, bw: number, bh: number, c: string) => { roundRectPath(ctx, x, y, bw, bh, 2); fillOutlined(ctx, c, 1.4); };
  spine(9, 12, 9, h / 2 - 15, BOOK_SPINES[0]);
  spine(20, 15, 8, h / 2 - 18, BOOK_SPINES[1]);
  spine(8, h / 2 + 6, 8, h / 2 - 15, BOOK_SPINES[2]);
  spine(18, h / 2 + 9, 9, h / 2 - 18, BOOK_SPINES[3]);
  spine(29, h / 2 + 5, 8, h / 2 - 14, BOOK_SPINES[4]);
  // a leaning book on the top shelf
  ctx.save(); ctx.translate(40, h / 2 - 3); ctx.rotate(-0.35);
  spine(-4, -(h / 2 - 16), 8, h / 2 - 16, BOOK_SPINES[2]);
  ctx.restore();
}
function hammockSling(ctx: Ctx, w: number, h: number): void {
  // a woven cream sling sagging between two rope ends
  ctx.beginPath();
  ctx.moveTo(4, 4); ctx.quadraticCurveTo(w / 2, h + 10, w - 4, 4);
  ctx.quadraticCurveTo(w / 2, h - 6, 4, 4);
  ctx.closePath();
  fillOutlined(ctx, mix(P.cream, P.butter, 0.35), 2.4);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(4, 4); ctx.quadraticCurveTo(w / 2, h + 10, w - 4, 4); ctx.quadraticCurveTo(w / 2, h - 6, 4, 4); ctx.clip();
  for (let x = 12; x < w; x += 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 6, h + 6); stroke(ctx, alpha(P.bark, 0.22), 1.2); }
  ctx.restore();
  for (const x of [4, w - 4]) { ellipsePath(ctx, x, 4, 3.2, 3.2); fillOutlined(ctx, P.bark, 1.4); }
}
function telescopeTripod(ctx: Ctx, w: number, h: number): void {
  contactShadow(ctx, w / 2, h - 3, w / 2 - 8, 4, P.ink, 0.14);
  const top = { x: w / 2, y: 8 };
  for (const dx of [-18, 0, 18]) {
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(top.x + dx, h - 4);
    stroke(ctx, outline(P.bark), 5.5);
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(top.x + dx, h - 4);
    stroke(ctx, P.bark, 3);
  }
  ellipsePath(ctx, top.x, top.y, 6, 6); fillOutlined(ctx, BRASS, 1.6);
}
function telescopeTube(ctx: Ctx, w: number, h: number): void {
  roundRectPath(ctx, 2, 3, w - 4, h - 6, 5);
  fillOutlined(ctx, BRASS, 2);
  roundRectPath(ctx, w - 14, 1, 12, h - 2, 4); fillOutlined(ctx, shade(BRASS, -0.12), 1.6);
  roundRectPath(ctx, 1, 4, 8, h - 8, 3); fillOutlined(ctx, shade(BRASS, -0.2), 1.4);
  sheen(ctx, w / 2, 6, w / 2 - 14, 1.4, P.cream, 0.35);
}
function guardianBody(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h / 2 + 4;
  roundRectPath(ctx, cx - 7, 1, 14, 6, 3); fillOutlined(ctx, P.bark, 1.6);
  // lotus: outer marigold petals, inner glow petals, a cream heart
  for (let k = 0; k < 5; k++) {
    const a = Math.PI + (k / 4) * Math.PI;
    ellipsePath(ctx, cx + Math.cos(a) * 13, cy + 6 + Math.sin(a) * 9, 7.5, 12, a + Math.PI / 2);
    fillOutlined(ctx, A.marigold, 1.8);
  }
  for (let k = 0; k < 3; k++) {
    const a = Math.PI + ((k + 0.5) / 3) * Math.PI;
    ellipsePath(ctx, cx + Math.cos(a) * 7, cy + 4 + Math.sin(a) * 6, 6.5, 11, a + Math.PI / 2);
    fillOutlined(ctx, P.glow, 1.6);
  }
  ellipsePath(ctx, cx, cy + 2, 5, 6); ctx.fillStyle = P.cream; ctx.fill();
  ellipsePath(ctx, cx, cy + 14, 12, 4); fillOutlined(ctx, shade(A.marigold, -0.15), 1.6);
}
function guardianHalo(ctx: Ctx, w: number, h: number): void {
  softGlow(ctx, w / 2, h / 2, w / 2, P.glow, 0.9);
}
function snapRing(ctx: Ctx, w: number, h: number): void {
  ctx.setLineDash([4, 5]);
  ellipsePath(ctx, w / 2, h / 2, w / 2 - 3, h / 2 - 3);
  stroke(ctx, alpha(P.cream, 0.95), 2.6);
  ctx.setLineDash([]);
  ellipsePath(ctx, w / 2, h / 2, 4, 4); ctx.fillStyle = alpha(P.cream, 0.8); ctx.fill();
}
function glowPool(ctx: Ctx, w: number, h: number): void {
  softGlow(ctx, w / 2, h / 2, w / 2, P.glow, 0.75);
}

/** Paint every decor part texture (idempotent). */
export function paintDecorTextures(scene: Phaser.Scene): void {
  paintFxTextures(scene);
  const S = DECOR_SIZES;
  paintTexture(scene, DECOR_KEYS.flowerPot, S.flowerPot.w, S.flowerPot.h, flowerPot);
  paintTexture(scene, DECOR_KEYS.flowerBloom, S.flowerBloom.w, S.flowerBloom.h, flowerBloom);
  paintTexture(scene, DECOR_KEYS.lanternBody, S.lanternBody.w, S.lanternBody.h, lanternBody);
  paintTexture(scene, DECOR_KEYS.lanternCord, S.lanternCord.w, S.lanternCord.h, lanternCord);
  paintTexture(scene, DECOR_KEYS.cushion, S.cushion.w, S.cushion.h, cushion);
  for (let i = 0; i < 3; i++) paintTexture(scene, DECOR_KEYS.buntingLeaf(i), S.buntingLeaf.w, S.buntingLeaf.h, buntingLeaf(i));
  paintTexture(scene, DECOR_KEYS.chimeTop, S.chimeTop.w, S.chimeTop.h, chimeTop);
  for (let i = 0; i < S.chimeTubes; i++) paintTexture(scene, DECOR_KEYS.chimeTube(i), S.chimeTube.w, S.chimeTube.h - i * 6, chimeTube(i));
  paintTexture(scene, DECOR_KEYS.rug, S.rug.w, S.rug.h, rug);
  paintTexture(scene, DECOR_KEYS.lightsBulb, S.lightsBulb.w, S.lightsBulb.h, lightsBulb);
  paintTexture(scene, DECOR_KEYS.bookshelf, S.bookshelf.w, S.bookshelf.h, bookshelf);
  paintTexture(scene, DECOR_KEYS.hammockSling, S.hammockSling.w, S.hammockSling.h, hammockSling);
  paintTexture(scene, DECOR_KEYS.telescopeTripod, S.telescopeTripod.w, S.telescopeTripod.h, telescopeTripod);
  paintTexture(scene, DECOR_KEYS.telescopeTube, S.telescopeTube.w, S.telescopeTube.h, telescopeTube);
  paintTexture(scene, DECOR_KEYS.guardianBody, S.guardianBody.w, S.guardianBody.h, guardianBody);
  paintTexture(scene, DECOR_KEYS.guardianHalo, S.guardianHalo, S.guardianHalo, guardianHalo);
  paintTexture(scene, DECOR_KEYS.snapRing, S.snapRing, S.snapRing, snapRing);
  paintTexture(scene, DECOR_KEYS.glowPool, S.glowPool, S.glowPool, glowPool);
}
