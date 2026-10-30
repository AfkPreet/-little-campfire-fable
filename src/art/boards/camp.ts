/**
 * Style board page: ?board=camp. One full-screen Landscape with parallax, the camera panning slowly across the world
 * so depth can be judged. Lighting from ?time= and ?weather=; the fire is lit from golden hour on.
 */
import Phaser from 'phaser';
import { DEBUG } from '@/config/debug';
import { LOGICAL_H, viewport } from '@/config/layout';
import { dayTFor, lightingAt } from '@/world/lighting';
import { Landscape } from '@/world/Landscape';

const PAN = { center: 850, amplitude: 650, periodS: 30 };
const FIRE_FROM_DAYT = 0.7;
const READY_MS = 800;

export default function campBoard(scene: Phaser.Scene): void {
  const dayT = dayTFor(DEBUG.time);
  const weather = { rain: DEBUG.weather === 'rain' ? 1 : 0, mist: DEBUG.weather === 'mist' ? 1 : 0 };
  const land = new Landscape(scene, { parallax: true, lit: dayT >= FIRE_FROM_DAYT });
  land.setLighting(lightingAt(dayT, weather));
  land.setWeather(weather);

  const cam = scene.cameras.main;
  cam.setBounds(0, 0, land.worldWidth, LOGICAL_H);
  let t = 0;
  const place = (): number => {
    const w = viewport().w;
    const raw = PAN.center + PAN.amplitude * Math.sin((t / PAN.periodS) * Math.PI * 2);
    const left = Phaser.Math.Clamp(raw, 0, land.worldWidth - w);
    cam.centerOn(left + w / 2, LOGICAL_H / 2);
    return left;
  };
  land.update(0, place(), dayT);
  scene.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, dt: number) => {
    if (!DEBUG.freeze) t += dt / 1000;
    land.update(dt, place(), dayT);
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => land.destroy());
  // real time, not game time: a slow (software-rendered) frame caps Phaser's clock delta, which would stall the flag
  window.setTimeout(() => { window.__game.ready = true; }, READY_MS);
}
