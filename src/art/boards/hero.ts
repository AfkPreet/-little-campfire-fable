/**
 * Style board page: ?board=hero. Chikki in every expression, the curious-tail quirk, a pacing walker, a 90 px size
 * test, and a night-tint panel to prove the hero still reads at night.
 */
import Phaser from 'phaser';
import { viewport } from '@/config/layout';
import { LIGHT_KEYS, PALETTE, hexToInt, mix, shade } from '@/config/palette';
import { lightingAt } from '@/world/lighting';
import { text } from '@/ui/text';
import { Hero, type HeroExpression } from '@/entities/Hero';

const EXPRESSIONS: HeroExpression[] = ['neutral', 'happy', 'blissful', 'surprised', 'sleepy', 'munching'];
const ROW1_GROUND = 252;
const ROW2_GROUND = 446;
const PANEL = { x: 40, y: 500, h: 204, radius: 22 };
const READY_MS = 400;

function label(scene: Phaser.Scene, x: number, y: number, s: string, color = shade(PALETTE.ink, 0.12)): Phaser.GameObjects.Text {
  return text(scene, x, y, s, { size: 17, hand: true, align: 'center', color }).setOrigin(0.5, 0);
}

function groundLine(scene: Phaser.Scene, x0: number, x1: number, y: number, color: string): void {
  const g = scene.add.graphics();
  g.lineStyle(2, hexToInt(color), 1);
  g.lineBetween(x0, y, x1, y);
  g.fillStyle(hexToInt(color), 1);
  g.fillCircle(x0, y, 3.5);
  g.fillCircle(x1, y, 3.5);
}

function addHero(scene: Phaser.Scene, x: number, y: number, tuning?: ConstructorParameters<typeof Hero>[3]): Hero {
  const h = new Hero(scene, x, y, tuning);
  scene.add.existing(h);
  h.startIdle();
  return h;
}

function expressionRow(scene: Phaser.Scene, w: number): void {
  const gap = Math.min(152, (w - 80) / EXPRESSIONS.length);
  const x0 = w / 2 - gap * (EXPRESSIONS.length - 1) / 2;
  EXPRESSIONS.forEach((e, i) => {
    const x = x0 + i * gap;
    const h = addHero(scene, x, ROW1_GROUND);
    h.setExpression(e);
    if (e === 'surprised') h.lookAt(x + 60, ROW1_GROUND - 120);
    if (e === 'sleepy') h.lookAt(x - 40, ROW1_GROUND);
    label(scene, x, ROW1_GROUND + 14, e);
  });
}

function demoRow(scene: Phaser.Scene, w: number): void {
  // the curious tail, cycling fast
  const cx = w * 0.17;
  const curious = addHero(scene, cx, ROW2_GROUND, { curlMin: 300, curlMax: 600, curlHold: 900, blinkMin: 900, blinkMax: 1500 });
  curious.lookAt(cx + 90, ROW2_GROUND - 110);
  label(scene, cx, ROW2_GROUND + 14, 'curious tail (fast cycle)');

  // a walker pacing between two points
  const xa = w * 0.36, xb = w * 0.62;
  groundLine(scene, xa, xb, ROW2_GROUND + 2, mix(PALETTE.cream, PALETTE.sage, 0.6));
  const walker = addHero(scene, xa, ROW2_GROUND);
  walker.hold('basket');
  let toB = true;
  const pace = (): void => {
    const target = toB ? xb : xa;
    toB = !toB;
    void walker.walkTo(target).then(() => scene.time.delayedCall(650, pace));
  };
  scene.time.delayedCall(300, pace);
  label(scene, (xa + xb) / 2, ROW2_GROUND + 14, 'hop-walk 140 px/s · pacing');

  // size test
  const sx = w * 0.84;
  const small = addHero(scene, sx, ROW2_GROUND);
  small.setScale(0.9);
  small.setFacing(-1);
  small.setExpression('happy');
  label(scene, sx, ROW2_GROUND + 14, '90 px size test');
}

function nightRow(scene: Phaser.Scene, w: number): void {
  const pw = w - PANEL.x * 2;
  const g = scene.add.graphics();
  g.fillStyle(hexToInt(LIGHT_KEYS.night.top), 1);
  g.fillRoundedRect(PANEL.x, PANEL.y, pw, PANEL.h, PANEL.radius);
  // a darker ground band inside the panel so the heroes stand on something
  g.fillStyle(hexToInt(shade(LIGHT_KEYS.night.top, -0.18)), 1);
  g.fillRoundedRect(PANEL.x, PANEL.y + PANEL.h - 44, pw, 44, { tl: 0, tr: 0, bl: PANEL.radius, br: PANEL.radius });

  const ground = PANEL.y + PANEL.h - 36;
  const night = lightingAt(1);
  const day = lightingAt(0.42);
  const nx = w * 0.4, dx = w * 0.6;

  const heroNight = addHero(scene, nx, ground);
  heroNight.setTint(hexToInt(night.charTint));
  heroNight.setExpression('sleepy');
  const heroDay = addHero(scene, dx, ground);
  heroDay.setTint(hexToInt(day.charTint));
  heroDay.setFacing(-1);
  heroNight.lookAt(dx, ground - 70);
  heroDay.lookAt(nx, ground - 70);

  const onPanel = mix(PALETTE.cream, LIGHT_KEYS.night.horizon, 0.25);
  label(scene, nx, ground + 10, 'night · lightingAt(1).charTint', onPanel);
  label(scene, dx, ground + 10, 'day · charTint (cream)', onPanel);
  text(scene, PANEL.x + 22, PANEL.y + 14, 'Reads at night', { size: 18, color: onPanel, weight: 700 });
}

export default function heroBoard(scene: Phaser.Scene): void {
  const v = viewport();
  text(scene, 40, 18, 'Chikki, the hero', { size: 30, weight: 700 });
  text(scene, 40, 58, 'Indian palm squirrel · 100 px standing · fur mix(bark, cream, 0.3) · tail 40% of the silhouette', {
    size: 17, hand: true, color: shade(PALETTE.ink, 0.18),
  });
  expressionRow(scene, v.w);
  demoRow(scene, v.w);
  nightRow(scene, v.w);
  scene.time.delayedCall(READY_MS, () => { window.__game.ready = true; });
}
