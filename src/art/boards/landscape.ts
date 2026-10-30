/**
 * Style board page: ?board=landscape. Six masked panels of the camp around the fire at dawn, day, golden hour, dusk,
 * night (fire lit, fireflies) and rain, each its own Landscape at 0.34 scale with the backdrop pinned (no parallax).
 */
import Phaser from 'phaser';
import { viewport } from '@/config/layout';
import { PALETTE, hexToInt, shade } from '@/config/palette';
import { dayTFor, lightingAt } from '@/world/lighting';
import { LAYOUT } from '@/world/layout';
import { Landscape } from '@/world/Landscape';
import { text } from '@/ui/text';

const PANEL = { h: 220, gap: 24, margin: 12, top: 64, labelH: 34, radius: 18, scale: 0.34, skyCrop: 40 };
const STARS_PER_PANEL = 24;
const READY_MS = 800;
type Panel = { label: string; time: string; fire?: boolean; rain?: number };
const PANELS: Panel[] = [
  { label: 'dawn', time: 'dawn' },
  { label: 'day', time: 'day' },
  { label: 'golden hour', time: 'golden' },
  { label: 'dusk', time: 'dusk' },
  { label: 'night · fire lit, fireflies', time: 'night', fire: true },
  { label: 'rain · cooler, rings on the water', time: 'day', rain: 1 },
];

export default function landscapeBoard(scene: Phaser.Scene): void {
  const v = viewport();
  const panelW = v.w / 3 - PANEL.gap;
  const viewWidth = panelW / PANEL.scale;
  text(scene, 40, 16, 'The camp through the day', { size: 28, weight: 700 });

  const live: Array<{ land: Landscape; left: number; dayT: number }> = [];
  PANELS.forEach((p, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const px = PANEL.margin + col * (panelW + PANEL.gap);
    const py = PANEL.top + row * (PANEL.h + PANEL.labelH + 14);
    // soft ink shadow under the panel, then the masked world
    const shadow = scene.add.graphics();
    shadow.fillStyle(hexToInt(PALETTE.ink), 0.08);
    shadow.fillRoundedRect(px + 2, py + 5, panelW, PANEL.h, PANEL.radius);
    const dayT = dayTFor(p.time);
    const weather = { rain: p.rain ?? 0, mist: 0 };
    const land = new Landscape(scene, { parallax: false, viewWidth, starCount: STARS_PER_PANEL, lit: p.fire });
    const left = LAYOUT.fire.x - viewWidth / 2;
    land.root.setScale(PANEL.scale);
    land.root.setPosition(px - left * PANEL.scale, py - PANEL.skyCrop * PANEL.scale);
    const maskG = scene.make.graphics({ x: 0, y: 0 }, false);
    maskG.fillStyle(hexToInt(PALETTE.cream), 1);
    maskG.fillRoundedRect(px, py, panelW, PANEL.h, PANEL.radius);
    land.root.setMask(maskG.createGeometryMask());
    land.setLighting(lightingAt(dayT, weather));
    land.setWeather(weather);
    live.push({ land, left, dayT });
    text(scene, px + panelW / 2, py + PANEL.h + 8, p.label, { size: 17, hand: true, align: 'center', color: shade(PALETTE.ink, 0.12) }).setOrigin(0.5, 0);
  });

  scene.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
    for (const l of live) l.land.update(dt, l.left, l.dayT);
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => live.forEach((l) => l.land.destroy()));
  window.setTimeout(() => { window.__game.ready = true; }, READY_MS);
}
