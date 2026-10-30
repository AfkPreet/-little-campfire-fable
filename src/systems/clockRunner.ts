/**
 * clockRunner: each frame (when not paused) advances the clock, relights the world, drives weather fx, ambience and
 * music mood, and pays the timed Contentment gains (fire sitting at night, rain rest in the doorway).
 * Night holds at dayT 1 until sleep (state/clock.tick does that). Persists dayT at most every 2 s and on pause.
 */
import Phaser from 'phaser';
import type { CampScene } from '@/scenes/Camp';
import { getState, update, tick, fireSitting, rainRest } from '@/state';
import { lightingAt, phaseAt, type DayPhase, type Lighting } from '@/world/lighting';
import { LAYOUT } from '@/world/layout';
import { audio } from '@/audio';
import type { Mood } from '@/audio/music';
import { DEBUG } from '@/config/debug';
import { dayTFor } from '@/world/lighting';
import type { WeatherKind } from '@/data/types';

export const CLOCK_RUNNER = {
  ambienceEveryMs: 250,
  persistEveryMs: 2000,
  /** the fire lights itself from this dayT (dusk) */
  fireLitFrom: 0.7,
  /** the hero hears the water from this far off the shore */
  waterHearingPx: 320,
} as const;

export class ClockRunner {
  private ambienceT = 0;
  private persistT = 0;
  private lastPhase: DayPhase | null = null;
  private lastMood: Mood | null = null;
  private lastRaining: boolean | null = null;
  private lastKind: WeatherKind | null = null;
  /** The player lit the fire (cooking) before dusk; it stays lit for the day. */
  fireLitByPlayer = false;
  lighting!: Lighting;

  constructor(private readonly camp: CampScene) {
    this.applyDebugOverrides();
  }

  /** ?time= and ?weather= for screenshots. */
  private applyDebugOverrides(): void {
    if (!DEBUG.enabled) return;
    if (!DEBUG.time && !DEBUG.weather) return;
    update((s) => {
      if (DEBUG.time) {
        s.dayT = dayTFor(DEBUG.time);
        s.isNight = phaseAt(s.dayT) === 'night';
      }
      if (DEBUG.weather) {
        const k = DEBUG.weather as WeatherKind;
        s.weather.kind = k;
        s.weather.raining = k === 'rain';
        s.weather.mistBurnedOff = false;
      }
    }, 'debug');
  }

  private weatherFor(): { rain: number; mist: number } {
    const w = getState().weather;
    return { rain: w.raining ? 1 : 0, mist: w.kind === 'mist' && !w.mistBurnedOff ? 1 : 0 };
  }

  get fireLit(): boolean {
    return getState().dayT >= CLOCK_RUNNER.fireLitFrom || this.fireLitByPlayer;
  }

  /** Relight everything right now from the state (create, dawn, debug jumps). */
  applyNow(): void {
    const s = getState();
    const w = this.weatherFor();
    this.lighting = lightingAt(s.dayT, w);
    const land = this.camp.landscape;
    land.setLighting(this.lighting);
    land.setWeather(w);
    land.setFireLit(this.fireLit);
    land.update(0, this.camp.worldCam.scrollX, s.dayT);
    this.camp.hero.setTint(Phaser.Display.Color.HexStringToColor(this.lighting.charTint).color);
    this.camp.tent?.setNight(phaseAt(s.dayT) === 'night');
    this.lastPhase = phaseAt(s.dayT);
    this.pushAmbience();
    this.pushMood();
    this.camp.events.emit('phase', this.lastPhase);
  }

  onPauseChanged(paused: boolean): void {
    if (paused) this.persist();
  }

  /** Flag the store dirty so the autosave writes dayT. */
  persist(): void {
    update(() => { /* dayT and weather were mutated in place by tick() */ }, 'clock');
    this.persistT = 0;
  }

  update(dt: number): void {
    const s = getState();
    const paused = this.camp.clockPaused;
    const r = tick(s, dt, paused);
    const w = this.weatherFor();
    this.lighting = lightingAt(s.dayT, w);
    const land = this.camp.landscape;
    land.setLighting(this.lighting);
    land.update(dt, this.camp.worldCam.scrollX, s.dayT);
    this.camp.hero.setTint(Phaser.Display.Color.HexStringToColor(this.lighting.charTint).color);
    land.setFireLit(this.fireLit);

    if (r.phaseChanged || r.phase !== this.lastPhase) {
      this.lastPhase = r.phase;
      this.camp.events.emit('phase', r.phase);
      this.camp.tent?.setNight(r.phase === 'night');
      this.pushMood();
    }
    if (r.enteredNight) this.camp.events.emit('night');
    if (s.weather.raining !== this.lastRaining || s.weather.kind !== this.lastKind || r.mistBurnedOff) {
      this.lastRaining = s.weather.raining;
      this.lastKind = s.weather.kind;
      land.setWeather(w);
      this.camp.events.emit('weather', s.weather);
      this.pushMood();
    }

    if (!paused) {
      const dts = dt / 1000;
      if (this.camp.activity === 'fireSit' && r.phase === 'night') fireSitting(s, dts);
      if (this.camp.activity === 'rest') rainRest(s, dts);
    }

    this.ambienceT += dt;
    if (this.ambienceT >= CLOCK_RUNNER.ambienceEveryMs) { this.ambienceT = 0; this.pushAmbience(); }
    this.persistT += dt;
    if (!paused && this.persistT >= CLOCK_RUNNER.persistEveryMs) this.persist();
  }

  private pushAmbience(): void {
    const s = getState();
    const hx = this.camp.hero.x;
    const nearWater = Phaser.Math.Clamp(1 - (LAYOUT.shore.x - hx) / CLOCK_RUNNER.waterHearingPx, 0, 1);
    const dFire = Math.abs(hx - LAYOUT.fire.x);
    const nearFire = this.fireLit ? Phaser.Math.Clamp(1 - dFire / LAYOUT.firelightRadius, 0, 1) : 0;
    audio.ambience.set({
      dayT: s.dayT,
      rain: s.weather.raining ? 1 : 0,
      nearWater,
      nearFire,
      inTent: this.camp.activity === 'rest',
    });
  }

  private pushMood(): void {
    const s = getState();
    const mood: Mood = s.weather.raining ? 'rain' : phaseAt(s.dayT) === 'night' ? 'night' : 'day';
    if (mood === this.lastMood) return;
    this.lastMood = mood;
    audio.music.setMood(mood);
  }

  destroy(): void {
    this.persist();
  }
}
