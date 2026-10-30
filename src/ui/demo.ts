/**
 * UI style board page (?scene=styleboard&board=ui): one of everything on a cream background.
 * Demo-only strings and layout numbers live here; nothing in this file ships in gameplay scenes.
 */
import Phaser from 'phaser';
import { applyViewport } from '@/config/layout';
import { PALETTE, hexToInt } from '@/config/palette';
import { paintTexture, img, blobPath, fillOutlined, kawaiiEye, blushOval, ellipsePath } from '@/art/pipeline';
import { TEX, ensureUiTextures, makeStars, ninePill, breathingRing, icon } from './kit';
import { text, makeText } from './text';
import { Card } from './Card';
import { Button } from './Button';
import { toast } from './Toast';
import { Bubble } from './Bubble';
import { showCatch } from './CatchCard';
import { Slider, Toggle, Stepper } from './controls';

const DEMO = {
  header: 'UI kit',
  toast: 'Caught a Bubble Carp! (24 cm)',
  cardTitle: 'Campfire notes',
  cardBody: 'The kettle hums. Pine needles crunch underfoot. A good spot for a tent.',
  keep: 'Keep',
  letGo: 'Let go',
  soldOut: 'Sold out',
  journal: 'Journal',
  bubbleActions: ['Cook', 'Sit'],
  pill: 'Day 3 · Golden hour',
  hi: 'Hi!',
  slider: 'Music',
  toggle: 'Reduce motion',
  stepper: 'Marshmallows',
  rarity: ['common', 'uncommon', 'rare'],
  fishName: 'Bubble Carp',
  fishKey: 'demo-fish',
  icons: [
    ['heart', TEX.heart], ['coin', TEX.coin], ['sun', TEX.sun], ['moon', TEX.moon],
    ['lantern', TEX.lantern], ['backpack', TEX.backpack], ['journal', TEX.journal], ['close', TEX.close],
    ['minus', TEX.minus], ['plus', TEX.plus], ['leaf', TEX.leafTag], ['star', TEX.starFull],
  ] as Array<[string, string]>,
} as const;

/** Composition width; centered when the viewport is wider. */
const LAYOUT = { compW: 980, colA: 300, colB: 260, gapAB: 24, gapBC: 36, cardW: 360, margin: 24, readyMs: 300 } as const;

function paintDemoFish(scene: Phaser.Scene): void {
  paintTexture(scene, DEMO.fishKey, 120, 80, (ctx) => {
    // tail
    ctx.beginPath();
    ctx.moveTo(86, 40);
    ctx.quadraticCurveTo(104, 18, 112, 22);
    ctx.quadraticCurveTo(106, 40, 112, 58);
    ctx.quadraticCurveTo(104, 62, 86, 40);
    ctx.closePath();
    fillOutlined(ctx, PALETTE.peach);
    // body
    blobPath(ctx, [[14, 40], [26, 20], [56, 12], [84, 24], [92, 40], [84, 56], [56, 68], [26, 60]]);
    fillOutlined(ctx, PALETTE.peach);
    // belly sheen
    ctx.fillStyle = PALETTE.cream;
    ctx.globalAlpha = 0.35;
    ellipsePath(ctx, 54, 50, 26, 9);
    ctx.fill();
    ctx.globalAlpha = 1;
    // fin
    ctx.beginPath();
    ctx.moveTo(52, 20);
    ctx.quadraticCurveTo(60, 4, 72, 14);
    ctx.quadraticCurveTo(64, 20, 56, 24);
    ctx.closePath();
    fillOutlined(ctx, PALETTE.rose);
    kawaiiEye(ctx, 34, 36, 6, 7, PALETTE.ink, PALETTE.cream);
    blushOval(ctx, 30, 48, 7, 4, PALETTE.blush);
    // bubbles
    ctx.strokeStyle = PALETTE.powder;
    ctx.lineWidth = 2;
    [[12, 22, 4], [6, 12, 3]].forEach(([bx, by, r]) => {
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.stroke();
    });
  });
}

export function uiDemo(scene: Phaser.Scene): void {
  const v = applyViewport(scene);
  scene.cameras.main.setBackgroundColor(hexToInt(PALETTE.cream));
  ensureUiTextures(scene);
  paintDemoFish(scene);

  const x0 = Math.max(LAYOUT.margin, (v.w - LAYOUT.compW) / 2);
  const colA = x0 + LAYOUT.colA / 2;
  const colB = x0 + LAYOUT.colA + LAYOUT.gapAB + LAYOUT.colB / 2;
  const colC = x0 + LAYOUT.compW - LAYOUT.cardW / 2;
  const noop = () => {};

  text(scene, x0, 18, `${DEMO.header} · ${Math.round(v.w)}x${v.h}`, { size: 18, weight: 700 });

  // ---- column A: card, buttons, bubble, pill
  const card = new Card(scene, colA, 160, LAYOUT.colA, 200, { title: DEMO.cardTitle, hand: true });
  const inner = card.inner();
  card.content.add(makeText(scene, 0, inner.top, DEMO.cardBody, { size: 18, align: 'center', wrap: inner.w }).setOrigin(0.5, 0));

  new Button(scene, colA - 70, 300, DEMO.keep, noop, { kind: 'primary', width: 128 });
  new Button(scene, colA + 70, 300, DEMO.letGo, noop, { kind: 'secondary', width: 128 });
  new Button(scene, colA - 36, 366, DEMO.soldOut, noop, { kind: 'secondary', width: 156 }).setEnabled(false);
  new Button(scene, colA + 86, 366, DEMO.journal, noop, { kind: 'icon', icon: TEX.backpack });

  breathingRing(scene, colA, 542, 22);
  Bubble.showAt(scene, colA, 520, DEMO.bubbleActions.map((label) => ({ label, onPick: noop })));

  const pillLabel = makeText(scene, colA, 600, DEMO.pill, { size: 18, weight: 600, align: 'center' }).setOrigin(0.5);
  const pill = ninePill(scene, colA, 600, Math.ceil(pillLabel.width + 44));
  scene.add.existing(pillLabel);
  pill.setDepth(0);
  pillLabel.setDepth(1);

  // ---- column B: controls, stars, icons
  new Slider(scene, colB, 110, { label: DEMO.slider, width: 220, value: 0.7 });
  new Toggle(scene, colB - 92, 170, { label: DEMO.toggle, value: true });
  new Stepper(scene, colB, 250, { label: DEMO.stepper, min: 0, max: 5, value: 2 });

  DEMO.rarity.forEach((name, i) => {
    const y = 318 + i * 34;
    text(scene, colB - 110, y, name, { size: 16, weight: 600 }).setOrigin(0, 0.5);
    for (const s of makeStars(scene, colB + 40, y, i + 1)) scene.add.existing(s);
  });

  DEMO.icons.forEach(([name, key], i) => {
    const cx = colB - 108 + (i % 4) * 72;
    const cy = 440 + Math.floor(i / 4) * 68;
    icon(scene, cx, cy, key);
    text(scene, cx, cy + 26, name, { size: 16, weight: 600, align: 'center' }).setOrigin(0.5, 0);
  });

  // ---- column C: icon+label button, catch card, quick-label bubble
  new Button(scene, colC, 100, DEMO.journal, noop, { kind: 'primary', icon: TEX.journal, width: 180 });
  showCatch(scene, {
    name: DEMO.fishName,
    sizeCm: 24,
    rarity: 2,
    isNew: true,
    spriteKey: DEMO.fishKey,
    onKeep: noop,
    onRelease: noop,
    // the board shows the card un-dimmed: backdrop behind everything, faint
    dim: 0.1,
    depth: -1,
    at: (vp) => ({ x: Math.max(LAYOUT.margin, (vp.w - LAYOUT.compW) / 2) + LAYOUT.compW - LAYOUT.cardW / 2, y: 380 }),
  });
  img(scene, colC, 640, TEX.bubble);
  text(scene, colC, 632, DEMO.hi, { hand: true, size: 26, align: 'center' }).setOrigin(0.5);

  toast(scene, DEMO.toast);

  const onViewport = () => applyViewport(scene);
  scene.game.events.on('viewport', onViewport);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.game.events.off('viewport', onViewport));
  scene.time.delayedCall(LAYOUT.readyMs, () => {
    window.__game.ready = true;
  });
}
