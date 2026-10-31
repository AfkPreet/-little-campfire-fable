/**
 * album.ts: Trip Album art. The scrapbook cover (bark-cream with a jute tie), the page paper (cream with a faint
 * grid), a polaroid frame, three washi-tape strips, the Mallige Falls postcard and the little lake map (with a
 * second pin once the guardian has been met). All painted once at 2x through the pipeline.
 */
import Phaser from 'phaser';
import { PALETTE, ACCENTS, shade, mix, alpha, outline } from '@/config/palette';
import {
  paintTexture, ellipsePath, roundRectPath, blobPath, fillOutlined, linearGradient, softGlow, contactShadow, paperGrain, type Ctx,
} from '@/art/pipeline';

export const ALBUM_TEX = {
  cover: 'album-cover',
  page: 'album-page',
  polaroid: 'album-polaroid',
  washiRose: 'album-washi-rose',
  washiSage: 'album-washi-sage',
  washiButter: 'album-washi-butter',
  postcard: 'album-postcard',
  map: 'album-map',
  mapFinale: 'album-map-finale',
  /** three ink lines: the HUD menu button that opens Settings */
  menu: 'album-menu-icon',
} as const;

export const ALBUM = {
  w: 820,
  h: 560,
  radius: 24,
  /** polaroid frame size and the photo window inside it */
  polaroid: { w: 170, h: 198, photo: { x: 11, y: 11, w: 148, h: 120 } },
  washi: { w: 96, h: 24 },
  postcard: { w: 360, h: 220 },
  map: { w: 300, h: 180 },
  tieW: 70,
} as const;

const INK = PALETTE.ink;
export const WASHI_KEYS = [ALBUM_TEX.washiRose, ALBUM_TEX.washiSage, ALBUM_TEX.washiButter] as const;

let painted: WeakSet<Phaser.Textures.TextureManager> = new WeakSet();

export function paintAlbumTextures(scene: Phaser.Scene): void {
  if (painted.has(scene.textures)) return;
  painted.add(scene.textures);
  paintCover(scene);
  paintPage(scene);
  paintPolaroid(scene);
  paintWashi(scene);
  paintPostcard(scene);
  paintMap(scene, ALBUM_TEX.map, false);
  paintMap(scene, ALBUM_TEX.mapFinale, true);
  paintTexture(scene, ALBUM_TEX.menu, 24, 24, (ctx: Ctx, w, h) => {
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    for (const y of [h * 0.27, h * 0.5, h * 0.73]) {
      ctx.beginPath();
      ctx.moveTo(5, y);
      ctx.lineTo(w - 5, y);
      ctx.stroke();
    }
  });
}

/** Lets the style board force a repaint after a palette change. */
export function resetAlbumPaint(): void {
  painted = new WeakSet();
}

// ---------- cover ----------
function paintCover(scene: Phaser.Scene): void {
  const { w, h, radius } = ALBUM;
  paintTexture(scene, ALBUM_TEX.cover, w + 24, h + 28, (ctx: Ctx) => {
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
    // bark-cream board: a warm linen gradient
    const board = mix(PALETTE.bark, PALETTE.cream, 0.55);
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = linearGradient(ctx, 0, y, 0, y + h, [[0, shade(board, 0.06)], [1, shade(board, -0.05)]]);
    ctx.fill();
    ctx.strokeStyle = outline(board, 0.28);
    ctx.lineWidth = 3;
    ctx.stroke();
    paperGrain(ctx, x, y, w, h, INK, 0.05, 11);
    // spine strip in deeper bark with stitch marks
    roundRectPath(ctx, x, y, 46, h, radius);
    ctx.fillStyle = mix(PALETTE.bark, PALETTE.cream, 0.2);
    ctx.fill();
    ctx.fillRect(x + 23, y, 23, h);
    ctx.strokeStyle = alpha(PALETTE.cream, 0.5);
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(x + 46 + 10, y + 18);
    ctx.lineTo(x + 46 + 10, y + h - 18);
    ctx.stroke();
    ctx.setLineDash([]);
    // cream label patch with a slight tilt
    ctx.save();
    ctx.translate(x + w * 0.5, y + h * 0.42);
    ctx.rotate(-0.025);
    roundRectPath(ctx, -230, -70, 460, 140, 18);
    fillOutlined(ctx, PALETTE.cream, 2.5, 0.16);
    ctx.restore();
    // jute tie: two twisted cords across the right third and a bow
    const tx = x + w * 0.82, ty = y + h * 0.42;
    const jute = mix(ACCENTS.marigold, PALETTE.bark, 0.35);
    ctx.strokeStyle = shade(jute, -0.1);
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (const dy of [-5, 5]) {
      ctx.beginPath();
      ctx.moveTo(tx, y + 2);
      ctx.quadraticCurveTo(tx + dy * 1.5, ty, tx, y + h - 2);
      ctx.stroke();
    }
    ctx.strokeStyle = alpha(PALETTE.cream, 0.35);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 20; i++) {
      const yy = y + 14 + i * ((h - 28) / 19);
      ctx.beginPath();
      ctx.moveTo(tx - 6, yy);
      ctx.lineTo(tx + 6, yy + 6);
      ctx.stroke();
    }
    // bow loops
    for (const dir of [-1, 1]) {
      ellipsePath(ctx, tx + dir * 20, ty - 4, 20, 11, dir * 0.4);
      fillOutlined(ctx, jute, 2.5, 0.25);
    }
    ellipsePath(ctx, tx, ty, 9, 8);
    fillOutlined(ctx, shade(jute, -0.08), 2.5, 0.25);
    // tails
    ctx.strokeStyle = jute;
    ctx.lineWidth = 6;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(tx, ty + 6);
      ctx.quadraticCurveTo(tx + dir * 10, ty + 30, tx + dir * 18, ty + 46);
      ctx.stroke();
    }
    // small pressed-flower corner sticker (jasmine)
    jasmine(ctx, x + 90, y + h - 70, 11);
    jasmine(ctx, x + 118, y + h - 92, 8);
  });
}

// ---------- page paper ----------
function paintPage(scene: Phaser.Scene): void {
  const { w, h, radius } = ALBUM;
  paintTexture(scene, ALBUM_TEX.page, w + 24, h + 28, (ctx: Ctx) => {
    const x = 12, y = 10;
    ctx.save();
    ctx.shadowColor = alpha(INK, 0.2);
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = PALETTE.cream;
    ctx.fill();
    ctx.restore();
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = linearGradient(ctx, 0, y, 0, y + h, [[0, PALETTE.cream], [1, mix(PALETTE.cream, PALETTE.butter, 0.18)]]);
    ctx.fill();
    ctx.strokeStyle = outline(PALETTE.cream, 0.14);
    ctx.lineWidth = 3;
    ctx.stroke();
    // faint grid
    ctx.save();
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.clip();
    ctx.strokeStyle = alpha(PALETTE.powder, 0.35);
    ctx.lineWidth = 1;
    const step = 28;
    for (let gx = x + step; gx < x + w; gx += step) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }
    for (let gy = y + step; gy < y + h; gy += step) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }
    ctx.restore();
    paperGrain(ctx, x, y, w, h, INK, 0.03, 5);
    // the ring binding along the left edge
    ctx.fillStyle = mix(PALETTE.bark, PALETTE.cream, 0.25);
    for (let i = 0; i < 9; i++) {
      const cy = y + 40 + i * ((h - 80) / 8);
      ellipsePath(ctx, x + 18, cy, 7, 7);
      ctx.fillStyle = mix(PALETTE.cream, INK, 0.12);
      ctx.fill();
      ellipsePath(ctx, x + 18, cy, 4, 4);
      ctx.fillStyle = mix(PALETTE.bark, PALETTE.cream, 0.1);
      ctx.fill();
    }
  });
}

// ---------- polaroid + washi ----------
function paintPolaroid(scene: Phaser.Scene): void {
  const { w, h, photo } = ALBUM.polaroid;
  paintTexture(scene, ALBUM_TEX.polaroid, w + 12, h + 16, (ctx: Ctx) => {
    const x = 6, y = 4;
    ctx.save();
    ctx.shadowColor = alpha(INK, 0.18);
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    roundRectPath(ctx, x, y, w, h, 8);
    ctx.fillStyle = PALETTE.cream;
    ctx.fill();
    ctx.restore();
    roundRectPath(ctx, x, y, w, h, 8);
    ctx.fillStyle = mix(PALETTE.cream, PALETTE.butter, 0.08);
    ctx.fill();
    ctx.strokeStyle = outline(PALETTE.cream, 0.16);
    ctx.lineWidth = 2;
    ctx.stroke();
    // photo window: a soft powder-to-cream wash, content is layered on top at runtime
    roundRectPath(ctx, x + photo.x, y + photo.y, photo.w, photo.h, 6);
    ctx.fillStyle = linearGradient(ctx, 0, y + photo.y, 0, y + photo.y + photo.h, [[0, mix(PALETTE.powder, PALETTE.cream, 0.45)], [1, mix(PALETTE.sage, PALETTE.cream, 0.6)]]);
    ctx.fill();
    ctx.strokeStyle = alpha(INK, 0.2);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

function paintWashi(scene: Phaser.Scene): void {
  const { w, h } = ALBUM.washi;
  const tints: Array<[string, string]> = [[ALBUM_TEX.washiRose, PALETTE.rose], [ALBUM_TEX.washiSage, PALETTE.sage], [ALBUM_TEX.washiButter, PALETTE.butter]];
  tints.forEach(([key, tint], n) => {
    paintTexture(scene, key, w, h, (ctx: Ctx) => {
      // torn ends
      ctx.beginPath();
      ctx.moveTo(4, 1);
      ctx.lineTo(w - 3, 2);
      ctx.lineTo(w - 6, h / 2);
      ctx.lineTo(w - 2, h - 2);
      ctx.lineTo(3, h - 1);
      ctx.lineTo(6, h / 2);
      ctx.closePath();
      ctx.fillStyle = alpha(mix(tint, PALETTE.cream, 0.25), 0.88);
      ctx.fill();
      // pattern: dots, stripes or hearts depending on the strip
      ctx.fillStyle = alpha(PALETTE.cream, 0.7);
      if (n === 0) {
        for (let i = 0; i < 8; i++) {
          ellipsePath(ctx, 12 + i * 11, h / 2 + (i % 2 ? 4 : -4), 2.2, 2.2);
          ctx.fill();
        }
      } else if (n === 1) {
        ctx.strokeStyle = alpha(PALETTE.cream, 0.65);
        ctx.lineWidth = 3;
        for (let i = 0; i < 7; i++) {
          ctx.beginPath();
          ctx.moveTo(10 + i * 13, 2);
          ctx.lineTo(4 + i * 13, h - 2);
          ctx.stroke();
        }
      } else {
        for (let i = 0; i < 6; i++) {
          const cx = 14 + i * 14, cy = h / 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy + 4);
          ctx.bezierCurveTo(cx - 6, cy - 2, cx - 2, cy - 7, cx, cy - 3);
          ctx.bezierCurveTo(cx + 2, cy - 7, cx + 6, cy - 2, cx, cy + 4);
          ctx.fill();
        }
      }
    });
  });
}

// ---------- postcard: Mallige Falls ----------
function paintPostcard(scene: Phaser.Scene): void {
  const { w, h } = ALBUM.postcard;
  paintTexture(scene, ALBUM_TEX.postcard, w + 16, h + 20, (ctx: Ctx) => {
    const x = 8, y = 6;
    ctx.save();
    ctx.shadowColor = alpha(INK, 0.2);
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.fillStyle = PALETTE.cream;
    ctx.fill();
    ctx.restore();
    // white-cream border
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.fillStyle = PALETTE.cream;
    ctx.fill();
    ctx.strokeStyle = outline(PALETTE.cream, 0.16);
    ctx.lineWidth = 2;
    ctx.stroke();
    const px = x + 10, py = y + 10, pw = w - 20, ph = h - 20;
    ctx.save();
    roundRectPath(ctx, px, py, pw, ph, 8);
    ctx.clip();
    // golden-hour sky
    ctx.fillStyle = linearGradient(ctx, 0, py, 0, py + ph, [[0, mix(PALETTE.lavender, PALETTE.peach, 0.35)], [0.55, mix(PALETTE.peach, PALETTE.butter, 0.5)], [1, mix(PALETTE.butter, PALETTE.cream, 0.5)]]);
    ctx.fillRect(px, py, pw, ph);
    softGlow(ctx, px + pw * 0.3, py + ph * 0.3, 70, PALETTE.glow, 0.5);
    // far lavender ridges, two of them framing the falls
    const far = mix(PALETTE.lavender, PALETTE.cream, 0.2);
    blobPath(ctx, [[px - 10, py + ph], [px - 10, py + ph * 0.5], [px + pw * 0.12, py + ph * 0.3], [px + pw * 0.3, py + ph * 0.42], [px + pw * 0.4, py + ph * 0.55], [px + pw * 0.4, py + ph]]);
    ctx.fillStyle = far;
    ctx.fill();
    blobPath(ctx, [[px + pw * 0.6, py + ph], [px + pw * 0.6, py + ph * 0.52], [px + pw * 0.72, py + ph * 0.36], [px + pw * 0.9, py + ph * 0.28], [px + pw + 10, py + ph * 0.45], [px + pw + 10, py + ph]]);
    ctx.fillStyle = far;
    ctx.fill();
    // nearer ridges in lavender
    const near = PALETTE.lavender;
    blobPath(ctx, [[px - 10, py + ph], [px - 10, py + ph * 0.66], [px + pw * 0.15, py + ph * 0.5], [px + pw * 0.33, py + ph * 0.6], [px + pw * 0.42, py + ph * 0.78], [px + pw * 0.42, py + ph]]);
    ctx.fillStyle = near;
    ctx.fill();
    blobPath(ctx, [[px + pw * 0.58, py + ph], [px + pw * 0.58, py + ph * 0.76], [px + pw * 0.68, py + ph * 0.56], [px + pw * 0.85, py + ph * 0.5], [px + pw + 10, py + ph * 0.6], [px + pw + 10, py + ph]]);
    ctx.fillStyle = near;
    ctx.fill();
    // the waterfall: a soft column of powder-cream falling between the ridges into a pool
    const fx = px + pw * 0.5, top = py + ph * 0.4, bottom = py + ph * 0.84;
    ctx.fillStyle = linearGradient(ctx, 0, top, 0, bottom, [[0, alpha(PALETTE.powder, 0.9)], [1, alpha(PALETTE.cream, 0.95)]]);
    blobPath(ctx, [[fx - 16, top], [fx + 16, top], [fx + 26, bottom], [fx - 26, bottom]]);
    ctx.fill();
    ctx.strokeStyle = alpha(PALETTE.cream, 0.8);
    ctx.lineWidth = 3;
    for (const dx of [-8, 2, 10]) {
      ctx.beginPath();
      ctx.moveTo(fx + dx, top + 6);
      ctx.quadraticCurveTo(fx + dx * 1.3, (top + bottom) / 2, fx + dx * 1.6, bottom - 4);
      ctx.stroke();
    }
    // mist at the base
    softGlow(ctx, fx, bottom, 46, PALETTE.cream, 0.9);
    // pool
    ellipsePath(ctx, fx, py + ph * 0.9, pw * 0.3, ph * 0.08);
    ctx.fillStyle = mix(ACCENTS.reservoir, PALETTE.powder, 0.4);
    ctx.fill();
    // ground band with sage
    blobPath(ctx, [[px - 10, py + ph + 10], [px - 10, py + ph * 0.86], [px + pw * 0.2, py + ph * 0.82], [px + pw * 0.3, py + ph * 0.9], [px + pw * 0.28, py + ph + 10]]);
    ctx.fillStyle = PALETTE.sage;
    ctx.fill();
    blobPath(ctx, [[px + pw * 0.7, py + ph + 10], [px + pw * 0.72, py + ph * 0.9], [px + pw * 0.84, py + ph * 0.82], [px + pw + 10, py + ph * 0.86], [px + pw + 10, py + ph + 10]]);
    ctx.fillStyle = PALETTE.sage;
    ctx.fill();
    // a tiny tent on the left bank
    const tx = px + pw * 0.16, ty = py + ph * 0.86;
    contactShadow(ctx, tx, ty + 2, 16, 4, INK, 0.16);
    ctx.beginPath();
    ctx.moveTo(tx - 16, ty);
    ctx.lineTo(tx, ty - 20);
    ctx.lineTo(tx + 16, ty);
    ctx.closePath();
    fillOutlined(ctx, PALETTE.peach, 2, 0.25);
    ctx.beginPath();
    ctx.moveTo(tx, ty - 20);
    ctx.lineTo(tx + 6, ty);
    ctx.lineTo(tx - 6, ty);
    ctx.closePath();
    ctx.fillStyle = shade(PALETTE.peach, -0.2);
    ctx.fill();
    // jasmine (mallige) blossoms in cream along the banks
    jasmine(ctx, px + pw * 0.08, py + ph * 0.78, 6);
    jasmine(ctx, px + pw * 0.26, py + ph * 0.94, 5);
    jasmine(ctx, px + pw * 0.8, py + ph * 0.8, 6);
    jasmine(ctx, px + pw * 0.9, py + ph * 0.92, 5);
    jasmine(ctx, px + pw * 0.74, py + ph * 0.95, 4);
    ctx.restore();
    roundRectPath(ctx, px, py, pw, ph, 8);
    ctx.strokeStyle = alpha(INK, 0.25);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // a little painted cowrie stamp in the corner of the border
    cowrieStamp(ctx, x + w - 46, y + 8, 30, 36);
  });
}

/** A postage stamp: scalloped rose paper with a cream cowrie shell and its toothed slit. */
function cowrieStamp(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.save();
  // scalloped edge: a rounded rect with little half-circle bites along the sides
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, 3);
  ctx.fillStyle = mix(PALETTE.rose, PALETTE.cream, 0.25);
  ctx.fill();
  ctx.fillStyle = PALETTE.cream;
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.5) / 5;
    for (const [bx, by] of [[x + w * t, y], [x + w * t, y + h], [x, y + h * t], [x + w, y + h * t]]) {
      ctx.beginPath();
      ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // inner frame
  roundRectPath(ctx, x + 4, y + 4, w - 8, h - 8, 2);
  ctx.strokeStyle = alpha(shade(PALETTE.rose, -0.3), 0.6);
  ctx.lineWidth = 1;
  ctx.stroke();
  // the cowrie: a cream bean with a darker toothed slit
  const cx = x + w / 2, cy = y + h / 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 8, 10.5, -0.35, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.cream;
  ctx.fill();
  ctx.strokeStyle = alpha(shade(PALETTE.rose, -0.3), 0.7);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy - 7);
  ctx.quadraticCurveTo(cx + 1, cy, cx - 1, cy + 7);
  ctx.strokeStyle = alpha(PALETTE.bark, 0.75);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  for (let i = -5; i <= 5; i += 2.5) {
    ctx.beginPath();
    ctx.moveTo(cx - 2 + i * 0.1, cy + i);
    ctx.lineTo(cx + 1, cy + i + 0.6);
    ctx.strokeStyle = alpha(PALETTE.bark, 0.45);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.restore();
}

/** Five cream petals around a butter heart. */
function jasmine(ctx: Ctx, cx: number, cy: number, r: number): void {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ellipsePath(ctx, cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7, r * 0.55, r * 0.4, a);
    ctx.fillStyle = PALETTE.cream;
    ctx.fill();
    ctx.strokeStyle = alpha(INK, 0.25);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ellipsePath(ctx, cx, cy, r * 0.3, r * 0.3);
  ctx.fillStyle = PALETTE.butter;
  ctx.fill();
}

// ---------- map ----------
function paintMap(scene: Phaser.Scene, key: string, finale: boolean): void {
  const { w, h } = ALBUM.map;
  paintTexture(scene, key, w + 12, h + 14, (ctx: Ctx) => {
    const x = 6, y = 4;
    ctx.save();
    ctx.shadowColor = alpha(INK, 0.16);
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.fillStyle = PALETTE.cream;
    ctx.fill();
    ctx.restore();
    const paper = mix(PALETTE.cream, PALETTE.butter, 0.3);
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.fillStyle = paper;
    ctx.fill();
    ctx.strokeStyle = outline(paper, 0.2);
    ctx.lineWidth = 2;
    ctx.stroke();
    paperGrain(ctx, x, y, w, h, INK, 0.04, 3);
    ctx.save();
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.clip();
    // hills as faint sage blobs
    ctx.fillStyle = alpha(PALETTE.sage, 0.4);
    for (const [hx, hy, hr] of [[0.15, 0.25, 34], [0.3, 0.15, 26], [0.8, 0.2, 30], [0.9, 0.5, 26], [0.2, 0.85, 30]] as const) {
      ellipsePath(ctx, x + w * hx, y + h * hy, hr, hr * 0.6);
      ctx.fill();
    }
    // the lake (Manjukere)
    blobPath(ctx, [[x + w * 0.22, y + h * 0.5], [x + w * 0.32, y + h * 0.32], [x + w * 0.5, y + h * 0.3], [x + w * 0.64, y + h * 0.42], [x + w * 0.6, y + h * 0.66], [x + w * 0.42, y + h * 0.78], [x + w * 0.26, y + h * 0.7]]);
    ctx.fillStyle = mix(PALETTE.powder, ACCENTS.reservoir, 0.4);
    ctx.fill();
    ctx.strokeStyle = outline(PALETTE.powder, 0.25);
    ctx.lineWidth = 2;
    ctx.stroke();
    // ripples
    ctx.strokeStyle = alpha(PALETTE.cream, 0.7);
    ctx.lineWidth = 1.5;
    for (const [rx, ry] of [[0.4, 0.48], [0.5, 0.58], [0.36, 0.62]] as const) {
      ctx.beginPath();
      ctx.moveTo(x + w * rx - 8, y + h * ry);
      ctx.quadraticCurveTo(x + w * rx, y + h * ry - 3, x + w * rx + 8, y + h * ry);
      ctx.stroke();
    }
    // path from the shore pin toward the falls (dotted ink)
    const p1 = { x: x + w * 0.3, y: y + h * 0.74 };
    const p2 = { x: x + w * 0.82, y: y + h * 0.3 };
    ctx.strokeStyle = alpha(INK, finale ? 0.55 : 0.2);
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.bezierCurveTo(x + w * 0.2, y + h * 0.95, x + w * 0.9, y + h * 0.8, p2.x, p2.y);
    ctx.stroke();
    ctx.setLineDash([]);
    // pin 1: Nerale Thota (the camp)
    pin(ctx, p1.x, p1.y, PALETTE.rose);
    // pin 2: the next campsite, only once the guardian has been met
    if (finale) {
      // a tiny waterfall mark
      ctx.fillStyle = alpha(PALETTE.powder, 0.8);
      blobPath(ctx, [[p2.x - 4, p2.y + 10], [p2.x + 4, p2.y + 10], [p2.x + 7, p2.y + 24], [p2.x - 7, p2.y + 24]]);
      ctx.fill();
      pin(ctx, p2.x, p2.y, ACCENTS.jamun);
      softGlow(ctx, p2.x, p2.y - 8, 22, PALETTE.glow, 0.6);
    } else {
      ctx.fillStyle = alpha(INK, 0.35);
      ctx.font = 'bold 22px "Baloo 2"';
      ctx.textAlign = 'center';
      ctx.fillText('?', p2.x, p2.y + 6);
    }
    ctx.restore();
  });
}

function pin(ctx: Ctx, px: number, py: number, color: string): void {
  contactShadow(ctx, px, py + 2, 7, 3, INK, 0.2);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.bezierCurveTo(px - 12, py - 12, px - 10, py - 30, px, py - 30);
  ctx.bezierCurveTo(px + 10, py - 30, px + 12, py - 12, px, py);
  ctx.closePath();
  fillOutlined(ctx, color, 2, 0.25);
  ellipsePath(ctx, px, py - 20, 4, 4);
  ctx.fillStyle = PALETTE.cream;
  ctx.fill();
}
