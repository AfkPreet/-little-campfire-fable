/**
 * rotateCard.ts: Chikki's head on the portrait "turn your device" card (#rotate-hero), drawn with plain Canvas 2D.
 * No Phaser here: the card shows before (and outside) the game canvas. Palette colors and pipeline helpers only.
 */
import { PALETTE, shade, alpha } from '@/config/palette';
import { ellipsePath, fillOutlined, kawaiiEye, blushOval, softGlow, type Ctx } from '@/art/pipeline';

const CARD = { size: 240, tiltDeg: -9, headR: 72, earR: 20, eyeRx: 7, eyeRy: 10, blushRx: 11, blushRy: 7 } as const;

function paintHead(ctx: Ctx, cx: number, cy: number): void {
  const fur = PALETTE.butter;
  const inner = shade(PALETTE.peach, 0.1);
  // soft firelight behind
  softGlow(ctx, cx, cy + 10, CARD.headR * 1.6, PALETTE.glow, 0.5);
  // ears
  for (const dir of [-1, 1]) {
    ellipsePath(ctx, cx + dir * CARD.headR * 0.78, cy - CARD.headR * 0.62, CARD.earR, CARD.earR * 1.25, dir * 0.35);
    fillOutlined(ctx, fur, 3);
    ellipsePath(ctx, cx + dir * CARD.headR * 0.78, cy - CARD.headR * 0.6, CARD.earR * 0.5, CARD.earR * 0.7, dir * 0.35);
    ctx.fillStyle = inner;
    ctx.fill();
  }
  // head
  ellipsePath(ctx, cx, cy, CARD.headR, CARD.headR * 0.92);
  fillOutlined(ctx, fur, 3);
  // muzzle patch
  ellipsePath(ctx, cx, cy + CARD.headR * 0.32, CARD.headR * 0.46, CARD.headR * 0.3);
  ctx.fillStyle = alpha(PALETTE.cream, 0.7);
  ctx.fill();
  // eyes, blush, smile, nose
  kawaiiEye(ctx, cx - 26, cy - 4, CARD.eyeRx, CARD.eyeRy, PALETTE.ink, PALETTE.cream);
  kawaiiEye(ctx, cx + 26, cy - 4, CARD.eyeRx, CARD.eyeRy, PALETTE.ink, PALETTE.cream);
  blushOval(ctx, cx - 40, cy + 16, CARD.blushRx, CARD.blushRy, PALETTE.blush);
  blushOval(ctx, cx + 40, cy + 16, CARD.blushRx, CARD.blushRy, PALETTE.blush);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy + 20, 12, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ellipsePath(ctx, cx, cy + 14, 5, 3.5);
  ctx.fillStyle = shade(PALETTE.ink, 0.1);
  ctx.fill();
}

/** Draw once into #rotate-hero (a 240x240 canvas). Safe to call when the element is missing. */
export function drawRotateHero(doc: Document = document): void {
  const canvas = doc.getElementById('rotate-hero') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const s = canvas.width / CARD.size;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(s, canvas.height / CARD.size);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const c = CARD.size / 2;
  ctx.translate(c, c + 8);
  ctx.rotate((CARD.tiltDeg * Math.PI) / 180);
  paintHead(ctx, 0, 0);
}
