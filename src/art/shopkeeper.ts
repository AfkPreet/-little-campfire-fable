/**
 * Doddamma, the shopkeeper (old water buffalo): bust painters, 320 px wide at 1x.
 * Parts are separate textures ('shop-' keys) so the rig in entities/Shopkeeper.ts can chew, blink, nod and flick.
 * The bust's origin is the counter line (x center, y = counter top); everything is drawn above it.
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { type Ctx, blobPath, blushOval, ellipsePath, fillOutlined, linearGradient, paintTexture } from '@/art/pipeline';

export const SHOP_KEYS = {
  shoulders: 'shop-shoulders',
  head: 'shop-head',
  eyesOpen: 'shop-eyes-open',
  eyesClosed: 'shop-eyes-closed',
  muzzle: 'shop-muzzle',
  jaw: 'shop-jaw',
  horn: 'shop-horn',
  jasmine: 'shop-jasmine',
  specs: 'shop-specs',
  ear: 'shop-ear',
} as const;

export const SHOP = {
  hide: mix(PALETTE.ink, PALETTE.lavender, 0.55),
  shoulders: { w: 340, h: 130 },
  head: { w: 200, h: 170, eyeL: [66, 80] as const, eyeR: [134, 80] as const },
  muzzle: { w: 120, h: 60 },
  jaw: { w: 110, h: 44 },
  horn: { w: 140, h: 118, base: [132, 104] as const },
  jasmine: { w: 44, h: 34 },
  specs: { w: 160, h: 56 },
  ear: { w: 64, h: 40 },
  /** part anchors in bust coordinates (y up from the counter line) */
  layout: {
    shoulders: [0, -58],
    head: [0, -182],
    muzzle: [0, -128],
    jaw: [0, -104],
    specs: [0, -168],
    hornL: [-50, -244],
    hornR: [50, -244],
    jasmine: [-104, -262],
    earL: [-78, -196],
    earR: [78, -196],
  },
} as const;

const HIDE = SHOP.hide;
const HIDE_LINE = outline(HIDE);

function shoulderDome(ctx: Ctx, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(6, h + 6);
  ctx.bezierCurveTo(6, 44, 70, 12, w / 2, 10);
  ctx.bezierCurveTo(w - 70, 12, w - 6, 44, w - 6, h + 6);
  ctx.closePath();
}

function paintShoulders(ctx: Ctx, w: number, h: number): void {
  // hide-colored dome with the cream chest blaze
  shoulderDome(ctx, w, h);
  fillOutlined(ctx, HIDE, 3);
  ctx.save();
  shoulderDome(ctx, w, h);
  ctx.clip();
  blobPath(ctx, [[w / 2 - 22, 34], [w / 2 + 22, 34], [w / 2 + 34, 80], [w / 2 + 24, h + 10], [w / 2 - 24, h + 10], [w / 2 - 34, 80]]);
  ctx.fillStyle = PALETTE.cream;
  ctx.fill();
  ctx.restore();
  // the marigold shawl, one panel per shoulder, with an inner V edge that shows the blaze
  for (const side of [1, -1] as const) {
    ctx.save();
    ctx.translate(w / 2, 0);
    ctx.scale(side, 1);
    // clip region: this half of the dome, inside the shawl's inner edge
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 10, -10);
    ctx.lineTo(-44, -10);
    ctx.lineTo(-44, 26);
    ctx.bezierCurveTo(-48, 60, -62, 95, -72, h + 12);
    ctx.lineTo(-w / 2 - 10, h + 12);
    ctx.closePath();
    ctx.clip();
    ctx.translate(-w / 2, 0);
    shoulderDome(ctx, w, h);
    ctx.fillStyle = ACCENTS.marigold;
    ctx.fill();
    // woven dot pattern and two soft folds
    ctx.fillStyle = alpha(PALETTE.cream, 0.55);
    for (let y = 30; y < h; y += 16) {
      for (let x = 10 + ((y / 16) % 2) * 8; x < w; x += 16) {
        ellipsePath(ctx, x, y, 2, 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = alpha(shade(ACCENTS.marigold, -0.18), 0.55);
    ctx.lineWidth = 2.5;
    for (const fx of [40, 78]) {
      ctx.beginPath();
      ctx.moveTo(fx, 30);
      ctx.quadraticCurveTo(fx + 10, 80, fx - 4, h + 6);
      ctx.stroke();
    }
    shoulderDome(ctx, w, h);
    ctx.lineWidth = 3;
    ctx.strokeStyle = outline(ACCENTS.marigold);
    ctx.stroke();
    ctx.restore();
    // inner edge with a darker border stripe
    ctx.save();
    ctx.translate(w / 2, 0);
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.moveTo(-44, 22);
    ctx.bezierCurveTo(-48, 60, -62, 95, -72, h + 12);
    ctx.lineWidth = 7;
    ctx.strokeStyle = shade(ACCENTS.marigold, -0.16);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = outline(ACCENTS.marigold);
    ctx.stroke();
    ctx.restore();
  }
}

function headPath(ctx: Ctx): void {
  blobPath(ctx, [[22, 74], [36, 28], [76, 10], [124, 10], [164, 28], [178, 74], [172, 122], [142, 160], [100, 168], [58, 160], [28, 122]]);
}

function paintHead(ctx: Ctx): void {
  headPath(ctx);
  fillOutlined(ctx, HIDE, 3);
  // forehead swirl: three soft curls in a darker hide
  ctx.strokeStyle = alpha(shade(HIDE, -0.22), 0.5);
  ctx.lineWidth = 2.5;
  for (const [cx, cy, r] of [[88, 34, 7], [100, 28, 8], [112, 34, 7]] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  blushOval(ctx, 44, 116, 15, 8, PALETTE.blush);
  blushOval(ctx, 156, 116, 15, 8, PALETTE.blush);
}

function paintEyes(ctx: Ctx, open: boolean): void {
  for (const [ex, ey] of [SHOP.head.eyeL, SHOP.head.eyeR]) {
    const out = ex < SHOP.head.w / 2 ? -1 : 1; // which side is the outer corner
    if (!open) {
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ex + out * 14, ey + 2);
      ctx.quadraticCurveTo(ex, ey - 6, ex - out * 14, ey - 1);
      ctx.stroke();
      continue;
    }
    ellipsePath(ctx, ex, ey, 14, 16);
    ctx.fillStyle = PALETTE.ink;
    ctx.fill();
    // half lid: a relaxed arch, a little lower at the outer corner (a kind, sleepy elder)
    const lid = (): void => {
      ctx.beginPath();
      ctx.moveTo(ex + out * 16, ey - 2);
      ctx.quadraticCurveTo(ex + out * 2, ey - 9, ex - out * 16, ey - 6);
    };
    ctx.save();
    ellipsePath(ctx, ex, ey, 15.5, 17.5);
    ctx.clip();
    lid();
    ctx.lineTo(ex - out * 20, ey - 24);
    ctx.lineTo(ex + out * 20, ey - 24);
    ctx.closePath();
    ctx.fillStyle = HIDE;
    ctx.fill();
    ctx.restore();
    lid();
    ctx.strokeStyle = HIDE_LINE;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = PALETTE.cream;
    ellipsePath(ctx, ex - out * 4, ey + 2, 4.2, 3.6);
    ctx.fill();
    ellipsePath(ctx, ex + out * 5, ey + 8, 2.2, 1.8);
    ctx.fill();
  }
}

function paintMuzzle(ctx: Ctx, w: number, h: number): void {
  ellipsePath(ctx, w / 2, h / 2, 56, 25);
  fillOutlined(ctx, PALETTE.cream, 2.5, 0.2);
  ctx.fillStyle = shade(PALETTE.cream, -0.32);
  for (const nx of [40, 80]) {
    ellipsePath(ctx, nx, h / 2 + 4, 5.5, 3.6, nx < w / 2 ? -0.3 : 0.3);
    ctx.fill();
  }
}

function paintJaw(ctx: Ctx, w: number, h: number): void {
  ellipsePath(ctx, w / 2, h / 2 + 2, 50, 17);
  fillOutlined(ctx, shade(PALETTE.cream, -0.05), 2.5, 0.2);
  // the mouth line sits along the top of the jaw so its 2 px chew reads
  ctx.strokeStyle = alpha(PALETTE.ink, 0.5);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 34, 14);
  ctx.quadraticCurveTo(w / 2, 22, w / 2 + 34, 14);
  ctx.stroke();
}

/** One sweeping crescent horn: base at the bottom-right of the texture, bulging out left and curling up; bark fading to a cream tip. */
function paintHorn(ctx: Ctx, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(w - 2, h - 10);
  ctx.bezierCurveTo(w - 80, h + 6, -12, 92, 34, 10);
  ctx.bezierCurveTo(14, 66, 64, 82, w - 26, 66);
  ctx.closePath();
  ctx.fillStyle = linearGradient(ctx, w - 10, h - 30, 30, 14, [[0, PALETTE.bark], [0.28, PALETTE.bark], [0.8, PALETTE.cream], [1, PALETTE.cream]]);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = outline(PALETTE.bark);
  ctx.stroke();
  // a soft lit edge along the top of the sweep
  ctx.strokeStyle = alpha(PALETTE.cream, 0.22);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(w - 30, 72);
  ctx.bezierCurveTo(70, 88, 24, 70, 36, 22);
  ctx.stroke();
}

function paintJasmine(ctx: Ctx, w: number, h: number): void {
  ctx.strokeStyle = alpha(PALETTE.ink, 0.35);
  ctx.lineWidth = 1.5;
  ellipsePath(ctx, w / 2, h / 2, 16, 11);
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    ellipsePath(ctx, w / 2 + Math.cos(a) * 16, h / 2 + Math.sin(a) * 11, 3.6, 3.6);
    fillOutlined(ctx, PALETTE.cream, 1.2, 0.18);
  }
}

function paintSpecs(ctx: Ctx, w: number, h: number): void {
  const lensY = 18;
  for (const ex of [46, 114]) {
    ctx.beginPath();
    ctx.arc(ex, lensY, 22, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = alpha(mix(PALETTE.powder, PALETTE.cream, 0.6), 0.35);
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = PALETTE.bark;
    ctx.stroke();
  }
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(68, lensY);
  ctx.quadraticCurveTo(80, lensY - 7, 92, lensY);
  ctx.stroke();
  // the string
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(24, lensY);
  ctx.quadraticCurveTo(10, lensY + 14, 4, h - 4);
  ctx.moveTo(w - 24, lensY);
  ctx.quadraticCurveTo(w - 10, lensY + 14, w - 4, h - 4);
  ctx.stroke();
}

function paintEar(ctx: Ctx, w: number, h: number): void {
  ellipsePath(ctx, w / 2 - 2, h / 2, 28, 14, -0.12);
  fillOutlined(ctx, HIDE, 2.5);
  ellipsePath(ctx, w / 2 - 4, h / 2 + 1, 18, 7.5, -0.12);
  ctx.fillStyle = mix(HIDE, PALETTE.peach, 0.4);
  ctx.fill();
}

/** Paint every Doddamma texture once (stable 'shop-' keys). */
export function paintShopkeeperTextures(scene: Phaser.Scene): void {
  paintTexture(scene, SHOP_KEYS.shoulders, SHOP.shoulders.w, SHOP.shoulders.h, paintShoulders);
  paintTexture(scene, SHOP_KEYS.head, SHOP.head.w, SHOP.head.h, (ctx) => paintHead(ctx));
  paintTexture(scene, SHOP_KEYS.eyesOpen, SHOP.head.w, SHOP.head.h, (ctx) => paintEyes(ctx, true));
  paintTexture(scene, SHOP_KEYS.eyesClosed, SHOP.head.w, SHOP.head.h, (ctx) => paintEyes(ctx, false));
  paintTexture(scene, SHOP_KEYS.muzzle, SHOP.muzzle.w, SHOP.muzzle.h, paintMuzzle);
  paintTexture(scene, SHOP_KEYS.jaw, SHOP.jaw.w, SHOP.jaw.h, paintJaw);
  paintTexture(scene, SHOP_KEYS.horn, SHOP.horn.w, SHOP.horn.h, paintHorn);
  paintTexture(scene, SHOP_KEYS.jasmine, SHOP.jasmine.w, SHOP.jasmine.h, paintJasmine);
  paintTexture(scene, SHOP_KEYS.specs, SHOP.specs.w, SHOP.specs.h, paintSpecs);
  paintTexture(scene, SHOP_KEYS.ear, SHOP.ear.w, SHOP.ear.h, paintEar);
}
