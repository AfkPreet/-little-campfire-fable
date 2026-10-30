/**
 * The fire ring: laterite stones round bark logs, three flame teardrops in ember and glow flickering at different
 * phases, embers (fx) and a large additive firelight pool. An unlit variant has charred logs and ash.
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { contactShadow, ellipsePath, makeImg, paintTexture, radialGradient, softGlow, type Ctx } from '@/art/pipeline';
import { embers, type EmberHandle } from '@/fx/particles';
import { isReduceMotion } from '@/fx/juice';

export const FIRE_KEYS = {
  lit: 'fire-ring-lit',
  unlit: 'fire-ring-unlit',
  front: 'fire-ring-front',
  flames: ['flame-a', 'flame-b', 'flame-c'],
  pool: 'fire-pool',
  coalGlow: 'fire-coal-glow',
} as const;
export const FIRE_SIZES = {
  ring: { w: 140, h: 56 },
  flames: [{ w: 40, h: 60 }, { w: 30, h: 46 }, { w: 22, h: 34 }],
  pool: 560,
  coalGlow: 120,
} as const;

const STONE = ACCENTS.laterite;

function stone(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number, fill: string = STONE): void {
  ellipsePath(ctx, x, y, rx, ry, rot);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = outline(fill, 0.26);
  ctx.stroke();
  ctx.fillStyle = alpha(PALETTE.cream, 0.28);
  ellipsePath(ctx, x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.3, rot);
  ctx.fill();
}

function log(ctx: Ctx, x: number, y: number, len: number, r: number, rot: number, fill: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(-len / 2, -r);
  ctx.lineTo(len / 2 - r, -r);
  ctx.arc(len / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-len / 2, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = outline(fill, 0.28);
  ctx.stroke();
  ellipsePath(ctx, -len / 2, 0, r * 0.55, r);
  ctx.fillStyle = mix(fill, PALETTE.cream, 0.35);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Back stones and logs; `lit` adds glowing coals under the logs, otherwise charred ends and ash. */
function paintRing(lit: boolean) {
  return (ctx: Ctx, w: number, h: number): void => {
    const cx = w / 2, cy = h - 14;
    contactShadow(ctx, cx, cy + 6, 62, 8, PALETTE.ink, 0.18);
    // back half of the ring (smaller, behind)
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i / 4) * Math.PI;
      stone(ctx, cx + Math.cos(a) * 50, cy - 8 + Math.sin(a) * 12, 10 - Math.abs(i - 2), 6.5, (i - 2) * 0.15, mix(STONE, PALETTE.lavender, 0.12));
    }
    // ash bed
    ctx.fillStyle = alpha(mix(PALETTE.cream, PALETTE.lavender, 0.45), lit ? 0.5 : 0.85);
    ellipsePath(ctx, cx, cy - 3, 36, 8);
    ctx.fill();
    if (lit) {
      ctx.fillStyle = radialGradient(ctx, cx, cy - 4, 0, 30, [
        [0, alpha(PALETTE.glow, 0.95)],
        [0.5, alpha(PALETTE.ember, 0.7)],
        [1, alpha(PALETTE.ember, 0)],
      ]);
      ellipsePath(ctx, cx, cy - 4, 30, 8);
      ctx.fill();
    }
    const wood = lit ? PALETTE.bark : shade(PALETTE.bark, -0.3);
    log(ctx, cx - 4, cy - 8, 58, 6.5, -0.28, wood);
    log(ctx, cx + 6, cy - 7, 54, 6, 0.32, shade(wood, -0.06));
    if (!lit) {
      // charred middles
      ctx.fillStyle = alpha(shade(PALETTE.ink, 0.1), 0.6);
      ellipsePath(ctx, cx, cy - 8, 16, 5);
      ctx.fill();
    }
  };
}

/** The front half of the stone ring, drawn over the flames' bases. */
function paintFront(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h - 14;
  for (let i = 0; i < 6; i++) {
    const a = (i / 5) * Math.PI;
    stone(ctx, cx + Math.cos(a) * 52, cy + 2 + Math.sin(a) * 9, 12 - Math.abs(i - 2.5) * 1.2, 8, (i - 2.5) * -0.12);
  }
}

/** Flame teardrop: ember skin, glow heart, cream core, with a soft outer bloom. */
function paintFlame(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, top = 4, bottom = h - 3, r = w / 2 - 4;
  softGlow(ctx, cx, bottom - r, r + 4, PALETTE.ember, 0.35);
  const flame = (scale: number, fill: string | CanvasGradient) => {
    const rr = r * scale, by = bottom - rr;
    const ty = top + (1 - scale) * (h * 0.55);
    ctx.beginPath();
    ctx.moveTo(cx, ty);
    ctx.bezierCurveTo(cx + rr * 0.25, ty + (by - ty) * 0.35, cx + rr, by - rr * 0.55, cx + rr, by);
    ctx.arc(cx, by, rr, 0, Math.PI, false);
    ctx.bezierCurveTo(cx - rr, by - rr * 0.55, cx - rr * 0.25, ty + (by - ty) * 0.35, cx, ty);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  flame(1, radialGradient(ctx, cx, bottom - r, 0, h * 0.75, [
    [0, PALETTE.glow],
    [0.45, PALETTE.ember],
    [1, shade(PALETTE.ember, -0.08)],
  ]));
  ctx.lineWidth = 2;
  ctx.strokeStyle = alpha(outline(PALETTE.ember, 0.16), 0.8);
  ctx.stroke();
  flame(0.62, mix(PALETTE.glow, PALETTE.ember, 0.3));
  flame(0.34, mix(PALETTE.cream, PALETTE.glow, 0.45));
}

function paintPool(ctx: Ctx, w: number, h: number): void {
  softGlow(ctx, w / 2, h / 2, w / 2, PALETTE.glow, 0.55);
}
function paintCoalGlow(ctx: Ctx, w: number, h: number): void {
  softGlow(ctx, w / 2, h / 2, w / 2, PALETTE.ember, 0.8);
}

export function paintFire(scene: Phaser.Scene): void {
  const S = FIRE_SIZES;
  paintTexture(scene, FIRE_KEYS.lit, S.ring.w, S.ring.h, paintRing(true));
  paintTexture(scene, FIRE_KEYS.unlit, S.ring.w, S.ring.h, paintRing(false));
  paintTexture(scene, FIRE_KEYS.front, S.ring.w, S.ring.h, paintFront);
  FIRE_KEYS.flames.forEach((k, i) => paintTexture(scene, k, S.flames[i].w, S.flames[i].h, paintFlame));
  paintTexture(scene, FIRE_KEYS.pool, S.pool, S.pool, paintPool);
  paintTexture(scene, FIRE_KEYS.coalGlow, S.coalGlow, S.coalGlow, paintCoalGlow);
}

export type FireRig = {
  /** stones, logs, flames (world layer) */
  container: Phaser.GameObjects.Container;
  /** the additive light pool; place it above the clearing's props */
  pool: Phaser.GameObjects.Image;
  flames: Phaser.GameObjects.Image[];
  readonly lit: boolean;
  setLit(lit: boolean): void;
  /** warmth 0..1 from the lighting: scales the pool and coal glow */
  setWarmth(w: number): void;
  /** advance the flicker; t in seconds */
  update(t: number): void;
  destroy(): void;
};

const FLAME_PHASE = [0, 2.1, 4.3];
const FLAME_OFFSET: Array<[number, number]> = [[0, -7], [-12, -4], [11, -3]];

/** A fire at (x, y) (y = the fire center per LAYOUT.fire, 12 px above the ground). */
export function makeFire(scene: Phaser.Scene, x: number, y: number): FireRig {
  paintFire(scene);
  const container = scene.add.container(x, y);
  const base = makeImg(scene, 0, 12, FIRE_KEYS.unlit).setOrigin(0.5, 1);
  const coal = makeImg(scene, 0, -2, FIRE_KEYS.coalGlow).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  const flames = FIRE_KEYS.flames.map((k, i) => makeImg(scene, FLAME_OFFSET[i][0], FLAME_OFFSET[i][1], k).setOrigin(0.5, 1).setAlpha(0));
  const front = makeImg(scene, 0, 12, FIRE_KEYS.front).setOrigin(0.5, 1);
  container.add([base, coal, ...flames, front]);
  const pool = scene.add.image(x, y - 20, FIRE_KEYS.pool).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  pool.setScale(1 / 2).setData('baseScale', 1 / 2);

  let lit = false, warmth = 0, ember: EmberHandle | undefined;
  const B = 1 / 2;
  const apply = () => {
    base.setTexture(lit ? FIRE_KEYS.lit : FIRE_KEYS.unlit);
    flames.forEach((f) => f.setAlpha(lit ? 1 : 0));
    if (lit && !ember) {
      ember = embers(scene, 0, -10, 0.8);
      container.addAt(ember.emitter, 1);
    }
    ember?.setIntensity(lit ? 0.8 : 0);
    coal.setAlpha(lit ? 0.5 : 0);
  };
  return {
    container, pool, flames,
    get lit() { return lit; },
    setLit(v: boolean) { if (v !== lit) { lit = v; apply(); } },
    setWarmth(w: number) { warmth = Phaser.Math.Clamp(w, 0, 1); },
    update(t: number) {
      if (!lit) { pool.setAlpha(0); return; }
      const still = isReduceMotion() ? 0.3 : 1;
      flames.forEach((f, i) => {
        const p = FLAME_PHASE[i];
        const sy = 1 + still * (0.1 * Math.sin(t * 9.1 + p) + 0.05 * Math.sin(t * 17.3 + p * 2));
        const sx = 1 - still * (0.06 * Math.sin(t * 7.7 + p) + 0.03 * Math.sin(t * 13.1 + p));
        f.setScale(B * sx, B * sy);
        f.setAlpha(0.86 + 0.14 * Math.sin(t * 11 + p));
        f.setRotation(still * 0.06 * Math.sin(t * 5.3 + p));
      });
      const flick = 0.78 + still * (0.12 * Math.sin(t * 6.3) + 0.06 * Math.sin(t * 11.7 + 1) + 0.04 * Math.sin(t * 19.1));
      pool.setAlpha(warmth * flick * 0.9);
      pool.setScale(B * (1 + 0.03 * Math.sin(t * 6.3)));
      coal.setAlpha(0.4 + 0.15 * Math.sin(t * 8.2));
    },
    destroy() { ember?.destroy(); container.destroy(true); pool.destroy(); },
  };
}
