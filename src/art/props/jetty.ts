/**
 * The bamboo jetty (deck planks in mix(butter, sage, 0.45) on four bark posts) and the coracle (a round bowl with a
 * laterite rim and woven lines, tethered to the last post, bobbing 3 px on a 2.8 s sine).
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { ellipsePath, makeImg, paintTexture, roundRectPath, type Ctx } from '@/art/pipeline';
import { CULM } from './trees';

export const JETTY_KEYS = { deck: 'jetty-deck', post: 'jetty-post', coracle: 'coracle', rope: 'coracle-rope' } as const;
export const JETTY_SIZES = {
  deck: { w: 270, h: 24 },
  post: { w: 16, h: 76 },
  coracle: { w: 104, h: 58 },
  rope: { w: 70, h: 26 },
} as const;

function paintDeck(ctx: Ctx, w: number, h: number): void {
  const plank = CULM;
  roundRectPath(ctx, 2, 3, w - 4, h - 6, 5);
  ctx.fillStyle = plank;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = outline(plank, 0.26);
  ctx.stroke();
  // darker underside edge
  ctx.fillStyle = alpha(outline(plank, 0.3), 0.7);
  roundRectPath(ctx, 4, h - 9, w - 8, 5, 2);
  ctx.fill();
  // plank seams and rope lashings
  ctx.strokeStyle = alpha(outline(plank, 0.3), 0.6);
  ctx.lineWidth = 1.6;
  for (let x = 20; x < w - 10; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 5);
    ctx.lineTo(x, h - 9);
    ctx.stroke();
  }
  ctx.strokeStyle = alpha(PALETTE.bark, 0.8);
  ctx.lineWidth = 2.2;
  for (const x of [34, 112, 190, 246]) {
    ctx.beginPath();
    ctx.moveTo(x - 6, 4);
    ctx.lineTo(x + 6, h - 8);
    ctx.moveTo(x + 6, 4);
    ctx.lineTo(x - 6, h - 8);
    ctx.stroke();
  }
  ctx.fillStyle = alpha(PALETTE.cream, 0.28);
  roundRectPath(ctx, 8, 5, w - 16, 3, 1.5);
  ctx.fill();
}

function paintPost(ctx: Ctx, w: number, h: number): void {
  roundRectPath(ctx, 3, 2, w - 6, h - 4, 4);
  ctx.fillStyle = PALETTE.bark;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = outline(PALETTE.bark, 0.28);
  ctx.stroke();
  ctx.fillStyle = alpha(PALETTE.cream, 0.18);
  roundRectPath(ctx, 5, 6, 2.5, h - 30, 1);
  ctx.fill();
  // waterline darkening at the bottom
  ctx.fillStyle = alpha(shade(PALETTE.bark, -0.3), 0.6);
  roundRectPath(ctx, 3, h - 22, w - 6, 20, 3);
  ctx.fill();
}

function paintCoracle(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, rimY = 16, rx = w / 2 - 4;
  const hull = mix(PALETTE.bark, ACCENTS.laterite, 0.25);
  // hull: a bowl under the rim
  ctx.beginPath();
  ctx.moveTo(cx - rx, rimY);
  ctx.bezierCurveTo(cx - rx, h + 2, cx + rx, h + 2, cx + rx, rimY);
  ctx.closePath();
  ctx.fillStyle = hull;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = outline(hull, 0.28);
  ctx.stroke();
  // woven lines: two crossing sets of curves
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = alpha(outline(hull, 0.3), 0.55);
  ctx.lineWidth = 1.4;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 13 - 20, rimY);
    ctx.quadraticCurveTo(cx + i * 13, h * 0.7, cx + i * 13 + 20, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + i * 13 + 20, rimY);
    ctx.quadraticCurveTo(cx + i * 13, h * 0.7, cx + i * 13 - 20, h);
    ctx.stroke();
  }
  ctx.strokeStyle = alpha(PALETTE.cream, 0.2);
  ctx.lineWidth = 2;
  for (const yy of [rimY + 10, rimY + 20]) {
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.quadraticCurveTo(cx, yy + 6, w, yy);
    ctx.stroke();
  }
  ctx.restore();
  // inside (we see a sliver of the far rim's interior) then the laterite rim
  ellipsePath(ctx, cx, rimY, rx, 7);
  ctx.fillStyle = mix(hull, PALETTE.cream, 0.35);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline(hull, 0.25);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, rimY, rx, 7, 0, 0, Math.PI);
  ctx.lineWidth = 6;
  ctx.strokeStyle = ACCENTS.laterite;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline(ACCENTS.laterite, 0.26);
  ctx.beginPath();
  ctx.ellipse(cx, rimY + 3, rx + 1, 7, 0, 0, Math.PI);
  ctx.stroke();
  ctx.fillStyle = alpha(PALETTE.cream, 0.3);
  ellipsePath(ctx, cx - rx * 0.4, rimY + 14, rx * 0.2, 4, -0.3);
  ctx.fill();
}

function paintRope(ctx: Ctx, w: number, h: number): void {
  ctx.strokeStyle = mix(PALETTE.bark, PALETTE.cream, 0.35);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(2, 2);
  ctx.quadraticCurveTo(w * 0.5, h + 4, w - 2, h - 6);
  ctx.stroke();
}

export function paintJetty(scene: Phaser.Scene): void {
  const S = JETTY_SIZES;
  paintTexture(scene, JETTY_KEYS.deck, S.deck.w, S.deck.h, paintDeck);
  paintTexture(scene, JETTY_KEYS.post, S.post.w, S.post.h, paintPost);
  paintTexture(scene, JETTY_KEYS.coracle, S.coracle.w, S.coracle.h, paintCoracle);
  paintTexture(scene, JETTY_KEYS.rope, S.rope.w, S.rope.h, paintRope);
}

export type JettyRig = { container: Phaser.GameObjects.Container; deck: Phaser.GameObjects.Image; posts: Phaser.GameObjects.Image[] };

/** Jetty from x0 to x1 with its deck top at deckY; posts stand into the water below. */
export function makeJetty(scene: Phaser.Scene, x0: number, x1: number, deckY: number, postCount = 4): JettyRig {
  paintJetty(scene);
  const container = scene.add.container(0, 0);
  const posts: Phaser.GameObjects.Image[] = [];
  const len = x1 - x0;
  for (let i = 0; i < postCount; i++) {
    const px = x0 + 12 + (i / (postCount - 1)) * (len - 24);
    const p = makeImg(scene, px, deckY + 2, JETTY_KEYS.post).setOrigin(0.5, 0);
    posts.push(p);
    container.add(p);
  }
  const deck = makeImg(scene, (x0 + x1) / 2, deckY, JETTY_KEYS.deck).setOrigin(0.5, 0);
  deck.setDisplaySize(len, JETTY_SIZES.deck.h);
  deck.setData('baseScale', deck.scaleY);
  container.add(deck);
  return { container, deck, posts };
}

export type CoracleRig = { container: Phaser.GameObjects.Container; hull: Phaser.GameObjects.Image; rope: Phaser.GameObjects.Image };

/** The coracle at (x, waterY) with a slack rope back to the jetty's last post on the left. */
export function makeCoracle(scene: Phaser.Scene, x: number, y: number): CoracleRig {
  paintJetty(scene);
  const container = scene.add.container(x, y);
  const rope = makeImg(scene, -JETTY_SIZES.coracle.w / 2 - 4, -16, JETTY_KEYS.rope).setOrigin(1, 0);
  const hull = makeImg(scene, 0, 0, JETTY_KEYS.coracle).setOrigin(0.5, 0.72);
  container.add([rope, hull]);
  return { container, hull, rope };
}
