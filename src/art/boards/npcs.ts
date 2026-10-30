/**
 * Style board: the three NPC rigs. ?scene=styleboard&board=npcs
 * (a) Puttu standing, peeking behind a leaf tuft and sleeping, beside a 100 px hero-size circle;
 * (b) Doddamma chewing behind a teak counter; (c) Bangari risen on an indigo water panel at 45% with her halo.
 */
import Phaser from 'phaser';
import { viewport } from '@/config/layout';
import { ACCENTS, LIGHT_KEYS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { type Ctx, ellipsePath, fillOutlined, img, linearGradient, paintTexture, paperGrain, roundRectPath } from '@/art/pipeline';
import { text } from '@/ui/text';
import { paintCompanionTextures } from '@/art/companion';
import { paintShopkeeperTextures } from '@/art/shopkeeper';
import { paintGuardianTextures } from '@/art/guardian';
import { Companion } from '@/entities/Companion';
import { Shopkeeper } from '@/entities/Shopkeeper';
import { Guardian } from '@/entities/Guardian';

const LABEL = mix(PALETTE.ink, PALETTE.bark, 0.35);
const PANEL_PAD = 10;

/** A cream card with a soft ink shadow baked into its margins. Returns the inner rect. */
function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): void {
  const key = `board-panel-${w}x${h}`;
  paintTexture(scene, key, w + PANEL_PAD * 2, h + PANEL_PAD * 2, (ctx) => {
    ctx.save();
    ctx.shadowColor = alpha(PALETTE.ink, 0.14);
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    roundRectPath(ctx, PANEL_PAD, PANEL_PAD, w, h, 20);
    ctx.fillStyle = shade(PALETTE.cream, -0.035);
    ctx.fill();
    ctx.restore();
    roundRectPath(ctx, PANEL_PAD, PANEL_PAD, w, h, 20);
    ctx.lineWidth = 2;
    ctx.strokeStyle = outline(PALETTE.cream, 0.12);
    ctx.stroke();
    ctx.save();
    roundRectPath(ctx, PANEL_PAD, PANEL_PAD, w, h, 20);
    ctx.clip();
    paperGrain(ctx, PANEL_PAD, PANEL_PAD, w, h, PALETTE.ink, 0.025);
    ctx.restore();
  });
  img(scene, x + w / 2, y + h / 2, key);
}

function label(scene: Phaser.Scene, x: number, y: number, s: string, color = LABEL): void {
  text(scene, x, y, s, { hand: true, size: 20, color });
}
function caption(scene: Phaser.Scene, x: number, y: number, s: string, color = LABEL): void {
  text(scene, x, y, s, { hand: true, size: 16, color, align: 'center' }).setOrigin(0.5, 0);
}

/** A jamun thicket tuft Puttu peeks from. Returns the leaf-line y relative to the texture top. */
function paintLeafTuft(ctx: Ctx, w: number, h: number): void {
  const deep = shade(PALETTE.moss, -0.1);
  const blobs: Array<[number, number, number, number, string]> = [
    [30, 58, 28, 22, deep], [88, 60, 30, 22, deep], [58, 44, 34, 26, PALETTE.moss],
    [24, 40, 20, 16, PALETTE.sage], [94, 42, 22, 17, PALETTE.sage], [60, 28, 22, 16, PALETTE.sage],
  ];
  for (const [cx, cy, rx, ry, c] of blobs) {
    ellipsePath(ctx, cx, cy, rx, ry);
    fillOutlined(ctx, c, 2.2, 0.2);
  }
  // jamun berries with a cream glint
  for (const [bx, by] of [[36, 52], [74, 36], [96, 58], [58, 62]] as const) {
    ellipsePath(ctx, bx, by, 3.6, 3.6);
    fillOutlined(ctx, ACCENTS.jamun, 1.4, 0.2);
    ctx.fillStyle = alpha(PALETTE.cream, 0.8);
    ellipsePath(ctx, bx - 1.2, by - 1.3, 1.1, 0.9);
    ctx.fill();
  }
  void w; void h;
}

function paintCounter(ctx: Ctx, w: number, h: number): void {
  roundRectPath(ctx, 2, 8, w - 4, h - 12, 10);
  fillOutlined(ctx, PALETTE.bark, 2.5);
  // lit top edge and a little grain
  roundRectPath(ctx, 8, 9, w - 16, 9, 4);
  ctx.fillStyle = alpha(mix(PALETTE.bark, PALETTE.butter, 0.4), 0.85);
  ctx.fill();
  ctx.strokeStyle = alpha(shade(PALETTE.bark, -0.2), 0.5);
  ctx.lineWidth = 1.5;
  for (const gy of [26, 32]) {
    ctx.beginPath();
    ctx.moveTo(30, gy);
    ctx.bezierCurveTo(w * 0.3, gy - 3, w * 0.6, gy + 3, w - 30, gy);
    ctx.stroke();
  }
}

function paintWater(ctx: Ctx, w: number, h: number, waterLine: number): void {
  const top = LIGHT_KEYS.night.top, horizon = LIGHT_KEYS.night.horizon;
  roundRectPath(ctx, 0, 0, w, h, 20);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = linearGradient(ctx, 0, 0, 0, waterLine, [[0, top], [1, mix(top, horizon, 0.5)]]);
  ctx.fillRect(0, 0, w, waterLine);
  // stars
  let s = 11;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 26; i++) {
    ellipsePath(ctx, rnd() * w, rnd() * waterLine * 0.85, 1.3, 1.3);
    ctx.fillStyle = alpha(PALETTE.cream, 0.35 + rnd() * 0.4);
    ctx.fill();
  }
  // the water band, a lighter indigo with a soft edge and faint ripples
  const water = mix(top, horizon, 0.42);
  ctx.fillStyle = linearGradient(ctx, 0, waterLine - 8, 0, waterLine + 16, [[0, mix(top, horizon, 0.5)], [1, water]]);
  ctx.fillRect(0, waterLine - 8, w, h);
  ctx.strokeStyle = alpha(PALETTE.cream, 0.09);
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y = waterLine + 24 + rnd() * (h - waterLine - 40), x0 = rnd() * w * 0.8, len = 40 + rnd() * 120;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo(x0 + len / 2, y - 2, x0 + len, y);
    ctx.stroke();
  }
  ctx.restore();
  roundRectPath(ctx, 0, 0, w, h, 20);
  ctx.lineWidth = 2;
  ctx.strokeStyle = shade(top, -0.3);
  ctx.stroke();
}

async function puttuPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Promise<void> {
  label(scene, x + 18, y + 12, 'Puttu · companion · 64 px');
  const ground = y + h - 62;
  const slots = [0.17, 0.4, 0.62, 0.85].map((t) => x + w * t);

  // hero-size reference
  const circleKey = 'board-hero-size';
  paintTexture(scene, circleKey, 108, 108, (ctx) => {
    ellipsePath(ctx, 54, 54, 50, 50);
    fillOutlined(ctx, PALETTE.cream, 2.5, 0.14);
  });
  img(scene, slots[0], ground - 50, circleKey);
  caption(scene, slots[0], ground + 10, 'hero size 100 px');

  const standing = new Companion(scene, slots[1], ground);
  caption(scene, slots[1], ground + 10, 'stand');

  // peeking behind the leaf tuft
  const tuftKey = 'board-leaf-tuft';
  const tuftW = 120, tuftH = 80;
  paintTexture(scene, tuftKey, tuftW, tuftH, paintLeafTuft);
  const tuftTop = ground - tuftH + 6;
  const leafLine = tuftTop + 22;
  const peeker = new Companion(scene, slots[2] + 2, ground);
  void peeker.peek(leafLine);
  img(scene, slots[2], ground - tuftH / 2 + 6, tuftKey);
  caption(scene, slots[2], ground + 10, 'peek');

  const sleeper = new Companion(scene, slots[3], ground);
  sleeper.setFacing(-1);
  void sleeper.sleep();
  caption(scene, slots[3], ground + 10, 'sleep');
  void standing;
}

function doddammaPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): void {
  label(scene, x + 18, y + h - 34, 'Doddamma · shopkeeper · 320 px bust');
  const counterKey = `board-counter-${w}`;
  const counterH = 46, counterW = w - 36;
  paintTexture(scene, counterKey, counterW, counterH, paintCounter);
  const counterTop = y + h - 40 - counterH + 8;
  const bust = new Shopkeeper(scene, x + w / 2, counterTop + 8);
  bust.setScale(0.72);
  img(scene, x + w / 2, counterTop + counterH / 2 - 8, counterKey);
  caption(scene, x + w - 80, y + h - 32, 'chewing · blink 4 s');
}

async function bangariPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Promise<void> {
  const waterLine = Math.round(h * 0.5);
  const waterKey = `board-water-${w}x${h}`;
  paintTexture(scene, waterKey, w, h, (ctx, tw, th) => paintWater(ctx, tw, th, waterLine));
  img(scene, x + w / 2, y + h / 2, waterKey);
  label(scene, x + 18, y + 12, 'Bangari · guardian · 900 px at 45%', mix(PALETTE.cream, LIGHT_KEYS.night.horizon, 0.2));
  const guardian = new Guardian(scene, x + w / 2 + 20, y + waterLine);
  guardian.setScale(0.45);
  // keep her halo inside the water panel on this cream page
  const maskShape = scene.make.graphics({ x: 0, y: 0 }, false);
  maskShape.fillRect(x + 2, y + 2, w - 4, h - 4);
  guardian.setMask(maskShape.createGeometryMask());
  await guardian.rise(1500);
}

export default async function npcsBoard(scene: Phaser.Scene): Promise<void> {
  const v = viewport();
  paintCompanionTextures(scene);
  paintShopkeeperTextures(scene);
  paintGuardianTextures(scene);
  text(scene, 40, 14, 'NPC rigs · Puttu, Doddamma, Bangari', { size: 20, weight: 700 });

  const W = Math.round(Math.min(v.w - 80, 1040)), x0 = Math.round((v.w - W) / 2);
  const gap = 16, row1Y = 58, row1H = 306, row2Y = row1Y + row1H + gap, row2H = 720 - row2Y - 22;
  const aW = Math.round(W * 0.42) - gap / 2, bW = W - aW - gap;

  panel(scene, x0, row1Y, aW, row1H);
  panel(scene, x0 + aW + gap, row1Y, bW, row1H);
  await puttuPanel(scene, x0, row1Y, aW, row1H);
  doddammaPanel(scene, x0 + aW + gap, row1Y, bW, row1H);
  await bangariPanel(scene, x0, row2Y, W, row2H);
}
