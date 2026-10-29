import Phaser from 'phaser';

type Scalable = Phaser.GameObjects.Components.Transform & { getData?: (key: string) => unknown };

export function baseScaleOf(obj: Scalable): number {
  const s = obj.getData?.('baseScale');
  return typeof s === 'number' ? s : obj.scaleX;
}

let reduceMotion = false;
export function setReduceMotion(v: boolean): void {
  reduceMotion = v;
}
export function isReduceMotion(): boolean {
  return reduceMotion;
}

/** Squash then settle: 0.85/1.15 pop on pickups, presses and spawns. */
export function squash(scene: Phaser.Scene, obj: Scalable, amount = 0.15, duration = 180): Phaser.Tweens.Tween | undefined {
  const b = baseScaleOf(obj);
  if (reduceMotion) {
    obj.setScale(b);
    return undefined;
  }
  scene.tweens.killTweensOf(obj);
  obj.setScale(b * (1 + amount), b * (1 - amount));
  return scene.tweens.add({ targets: obj, scaleX: b, scaleY: b, duration, ease: 'Back.easeOut' });
}

/** Pop in from nothing with easeOutBack. */
export function popIn(scene: Phaser.Scene, obj: Scalable & { alpha?: number }, duration = 260, delay = 0): Phaser.Tweens.Tween {
  const b = baseScaleOf(obj);
  if (reduceMotion) {
    obj.setScale(b);
    return scene.tweens.add({ targets: obj, alpha: 1, duration: 120, delay });
  }
  obj.setScale(b * 0.2);
  return scene.tweens.add({ targets: obj, scaleX: b, scaleY: b, alpha: 1, duration, delay, ease: 'Back.easeOut' });
}

/** Breathing loop: scaleY 1.00 -> 1.03 on a 2.4 s sine. Returns the tween so callers can stop it. */
export function breathe(scene: Phaser.Scene, obj: Scalable, period = 2400, amount = 0.03): Phaser.Tweens.Tween {
  const b = baseScaleOf(obj);
  return scene.tweens.add({ targets: obj, scaleY: b * (1 + amount), duration: period / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

/** Gentle nudge (used for peg taps, disabled buttons). */
export function nudge(scene: Phaser.Scene, obj: Phaser.GameObjects.Components.Transform, dx = 3, duration = 70): Phaser.Tweens.Tween | undefined {
  if (reduceMotion) return undefined;
  const x0 = obj.x;
  return scene.tweens.add({ targets: obj, x: x0 + dx, duration, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => { obj.x = x0; } });
}

/** Float up and fade (hearts, +notes). */
export function floatAway(scene: Phaser.Scene, obj: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Alpha & { destroy: () => void }, dy = 40, duration = 900): void {
  scene.tweens.add({ targets: obj, y: obj.y - dy, alpha: 0, duration, ease: 'Sine.easeOut', onComplete: () => obj.destroy() });
}
