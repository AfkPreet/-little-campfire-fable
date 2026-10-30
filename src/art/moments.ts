/**
 * art/moments.ts: visuals for the rare moments (spec section 6). Textures are painted once (2x) through the
 * pipeline; the factories return display objects the moments system tweens. The handwritten banner is the
 * cream card in the hand font that slides in at top-center of the HUD.
 */
import Phaser from 'phaser';
import { PALETTE } from '@/config/palette';
import { viewport } from '@/config/layout';
import { alpha, makeImg, paintTexture, radialGradient, shade, type Ctx } from './pipeline';
import { FX_KEYS } from '@/fx/textures';
import { makeText, nineCard, UI, ensureUiTextures } from '@/ui';
import { isReduceMotion } from '@/fx/juice';

export const MOMENT_KEYS = {
  rainbow: 'moment-rainbow',
  moonbow: 'moment-moonbow',
  streak: 'moment-streak',
} as const;

/** Arc texture size (logical px) and the band palette: 6 soft bands, no neon. */
export const MOMENT_ART = {
  arcW: 1000,
  arcH: 420,
  bandW: 11,
  bandGap: 1,
  arcAlpha: 0.5,
  rainbowBands: [PALETTE.rose, PALETTE.peach, PALETTE.butter, PALETTE.sage, PALETTE.powder, PALETTE.lavender],
  moonbowBands: [PALETTE.lavender, PALETTE.cream, PALETTE.butter, PALETTE.cream, PALETTE.powder, PALETTE.lavender],
  moonbowAlpha: 0.32,
  streakW: 220,
  streakH: 40,
  banner: { h: 60, padX: 28, textSize: 24, topGap: 72, slideMs: 420, holdMs: 3000, debugHoldMs: 30000, depth: 1300 },
} as const;

function paintArc(ctx: Ctx, w: number, h: number, bands: readonly string[], a: number): void {
  const cx = w / 2;
  const cy = h - 10; // centre sits just under the texture's bottom edge
  const rOuter = Math.min(cx, h) - 14;
  const step = MOMENT_ART.bandW + MOMENT_ART.bandGap;
  ctx.save();
  ctx.lineCap = 'butt';
  bands.forEach((c, i) => {
    const r = rOuter - i * step - MOMENT_ART.bandW / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
    ctx.lineWidth = MOMENT_ART.bandW + 0.8;
    ctx.strokeStyle = alpha(c, a);
    ctx.stroke();
  });
  // soften the whole arc: feather the ends toward the horizon and the outer/inner edges
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createLinearGradient(0, h * 0.55, 0, h);
  g.addColorStop(0, alpha(PALETTE.ink, 0));
  g.addColorStop(1, alpha(PALETTE.ink, 0.85));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function paintStreak(ctx: Ctx, w: number, h: number): void {
  const cy = h / 2;
  // tail: a soft horizontal gradient from nothing to the glow colour, head: a bright round glow
  const tail = ctx.createLinearGradient(0, 0, w, 0);
  tail.addColorStop(0, alpha(PALETTE.glow, 0));
  tail.addColorStop(0.75, alpha(PALETTE.glow, 0.55));
  tail.addColorStop(1, alpha(PALETTE.cream, 0.9));
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.quadraticCurveTo(w * 0.6, cy - h * 0.18, w - 16, cy - 5);
  ctx.lineTo(w - 16, cy + 5);
  ctx.quadraticCurveTo(w * 0.6, cy + h * 0.18, 0, cy);
  ctx.fill();
  const head = radialGradient(ctx, w - 16, cy, 0, h / 2, [[0, alpha(PALETTE.cream, 1)], [0.35, alpha(PALETTE.glow, 0.8)], [1, alpha(PALETTE.glow, 0)]]);
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(w - 16, cy, h / 2, 0, Math.PI * 2);
  ctx.fill();
}

export function paintMomentTextures(scene: Phaser.Scene): void {
  const { arcW, arcH, streakW, streakH } = MOMENT_ART;
  paintTexture(scene, MOMENT_KEYS.rainbow, arcW, arcH, (ctx, w, h) => paintArc(ctx, w, h, MOMENT_ART.rainbowBands, MOMENT_ART.arcAlpha));
  paintTexture(scene, MOMENT_KEYS.moonbow, arcW, arcH, (ctx, w, h) => paintArc(ctx, w, h, MOMENT_ART.moonbowBands, MOMENT_ART.moonbowAlpha));
  paintTexture(scene, MOMENT_KEYS.streak, streakW, streakH, paintStreak);
}

/** A rainbow (or moonbow) arc image, origin bottom-centre, not yet added to a container. Starts invisible. */
export function makeArc(scene: Phaser.Scene, kind: 'rainbow' | 'moonbow', x: number, baseY: number): Phaser.GameObjects.Image {
  const im = makeImg(scene, x, baseY, kind === 'rainbow' ? MOMENT_KEYS.rainbow : MOMENT_KEYS.moonbow);
  im.setOrigin(0.5, 1).setAlpha(0);
  return im;
}

/** The shooting star's streak image (origin at its head), not yet added. */
export function makeStreak(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  const im = makeImg(scene, x, y, MOMENT_KEYS.streak);
  im.setOrigin(0.93, 0.5).setBlendMode(Phaser.BlendModes.ADD);
  return im;
}

/** A big soft butter glow (the misty sunrise's light), additive, not yet added. */
export function makeSunGlow(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  const im = makeImg(scene, x, y, FX_KEYS.glow);
  im.setTint(Phaser.Display.Color.HexStringToColor(shade(PALETTE.butter, 0.1)).color);
  im.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  const base = (im.getData('baseScale') as number) ?? 1;
  im.setScale(base * 14);
  return im;
}

/**
 * Handwritten banner: a cream card in the hand font slides in at top-center for 3 s, then slides out.
 * Lives in the UI scene's camera space. Resolves when it is gone.
 */
export function showMomentBanner(scene: Phaser.Scene, message: string, instant = false): Promise<void> {
  ensureUiTextures(scene);
  const B = MOMENT_ART.banner;
  const v = viewport();
  const label = makeText(scene, 0, 0, message, { hand: true, size: B.textSize, color: PALETTE.ink, align: 'center' }).setOrigin(0.5);
  const w = Math.min(v.w - UI.gap * 2, Math.max(220, label.width + B.padX * 2));
  const card = nineCard(scene, 0, 0, w, B.h, false);
  const c = scene.add.container(v.w / 2, 0, [card, label]).setDepth(B.depth);
  const yIn = v.safe.top + B.topGap;
  const yOut = -B.h;
  const rm = isReduceMotion();
  const hold = instant ? B.debugHoldMs : B.holdMs;
  c.setY(rm || instant ? yIn : yOut).setAlpha(rm ? 0 : 1);
  const onViewport = (): void => { c.setX(viewport().w / 2); };
  scene.game.events.on('viewport', onViewport);
  return new Promise((resolve) => {
    const done = (): void => {
      scene.game.events.off('viewport', onViewport);
      c.destroy();
      resolve();
    };
    if (rm) {
      scene.tweens.add({ targets: c, alpha: 1, duration: 200, hold, yoyo: true, onComplete: done });
      return;
    }
    scene.tweens.add({
      targets: c, y: yIn, duration: instant ? 0 : B.slideMs, ease: 'Back.easeOut',
      onComplete: () => {
        scene.tweens.add({ targets: c, y: yOut, duration: B.slideMs, delay: hold, ease: 'Sine.easeIn', onComplete: done });
      },
    });
  });
}
