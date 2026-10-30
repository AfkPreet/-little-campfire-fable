/**
 * The three tents (ART_BIBLE section 6) built from parts so the pitch animation can unfold the floor sheet, glow the
 * four pegs and spring the canopy up: floor sheet, poles, canopy, door flap, window (dome/homestay) and 4 pegs.
 *  - teak: Teak-Leaf Tent, an A-frame in sage with a cream door flap (2 hang points)
 *  - dome: Monsoon Dome, a powder-tinted cream dome with a laterite rim and a small window (4 hang points)
 *  - homestay: Little Homestay Kit, a tiny red-tiled cabin in cream laterite blocks with a lit window (6 hang points)
 */
import Phaser from 'phaser';
import { ACCENTS, PALETTE, alpha, mix, outline, shade } from '@/config/palette';
import { contactShadow, ellipsePath, makeImg, paintTexture, roundRectPath, softGlow, type Ctx } from '@/art/pipeline';
import type { XY } from '@/world/layout';

export type TentKind = 'teak' | 'dome' | 'homestay';
export const TENT_KINDS: TentKind[] = ['teak', 'dome', 'homestay'];

/** Logical footprint (w x h) of each tent texture set; the ground line is at h - 6. */
export const TENT_SIZES: Record<TentKind, { w: number; h: number }> = {
  teak: { w: 180, h: 130 },
  dome: { w: 190, h: 120 },
  homestay: { w: 200, h: 160 },
};
const PEG = { w: 18, h: 18 };
const WINDOW_GLOW = 72;

const key = (kind: TentKind, part: string) => `tent-${kind}-${part}`;

/** Hang points in tent-local coordinates (origin at the ground center). */
const HANG: Record<TentKind, XY[]> = {
  teak: [{ x: -62, y: -58 }, { x: 62, y: -58 }],
  dome: [{ x: -66, y: -40 }, { x: -30, y: -84 }, { x: 30, y: -84 }, { x: 66, y: -40 }],
  homestay: [{ x: -74, y: -70 }, { x: -40, y: -116 }, { x: 0, y: -128 }, { x: 40, y: -116 }, { x: 74, y: -70 }, { x: 0, y: -60 }],
};

// ------------------------------------------------------------------ shared parts

function paintFloor(fill: string) {
  return (ctx: Ctx, w: number, h: number): void => {
    contactShadow(ctx, w / 2, h / 2 + 2, w / 2 - 4, 7, PALETTE.ink, 0.16);
    ellipsePath(ctx, w / 2, h / 2, w / 2 - 6, h / 2 - 5);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = outline(fill, 0.24);
    ctx.stroke();
  };
}

function paintPeg(ctx: Ctx, w: number, h: number): void {
  const fill = PALETTE.bark;
  ctx.beginPath();
  ctx.moveTo(w * 0.5 - 3, 3);
  ctx.lineTo(w * 0.5 + 3, 3);
  ctx.lineTo(w * 0.5 + 1, h - 2);
  ctx.lineTo(w * 0.5 - 1, h - 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = outline(fill, 0.26);
  ctx.stroke();
  // rope loop
  ctx.strokeStyle = mix(PALETTE.cream, PALETTE.bark, 0.3);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w * 0.5, 5, 4, 0, Math.PI * 2);
  ctx.stroke();
}

function paintWindowGlow(ctx: Ctx, w: number, h: number): void {
  softGlow(ctx, w / 2, h / 2, w / 2, PALETTE.glow, 0.9);
}

// ------------------------------------------------------------------ teak-leaf A-frame

function paintTeakPoles(ctx: Ctx, w: number, h: number): void {
  const g = h - 6, apexY = 18, cx = w / 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = outline(PALETTE.bark, 0.26);
  ctx.lineWidth = 7;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * 70, g);
    ctx.lineTo(cx + sx * 4, apexY);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - 12, apexY - 6);
  ctx.lineTo(cx + 12, apexY - 6);
  ctx.stroke();
  ctx.strokeStyle = PALETTE.bark;
  ctx.lineWidth = 4;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * 70, g);
    ctx.lineTo(cx + sx * 4, apexY);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - 12, apexY - 6);
  ctx.lineTo(cx + 12, apexY - 6);
  ctx.stroke();
}

function paintTeakCanopy(ctx: Ctx, w: number, h: number): void {
  const g = h - 6, apexY = 20, cx = w / 2, half = 66;
  const fill = PALETTE.sage;
  ctx.beginPath();
  ctx.moveTo(cx - half, g);
  ctx.quadraticCurveTo(cx - half * 0.55, g - (g - apexY) * 0.45, cx - 8, apexY + 2);
  ctx.quadraticCurveTo(cx, apexY - 6, cx + 8, apexY + 2);
  ctx.quadraticCurveTo(cx + half * 0.55, g - (g - apexY) * 0.45, cx + half, g);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = outline(fill, 0.26);
  ctx.stroke();
  // fabric seams and a lighter sunward panel
  ctx.fillStyle = alpha(mix(fill, PALETTE.cream, 0.5), 0.35);
  ctx.beginPath();
  ctx.moveTo(cx - half + 8, g - 2);
  ctx.quadraticCurveTo(cx - half * 0.5, g - (g - apexY) * 0.45, cx - 6, apexY + 6);
  ctx.lineTo(cx - 18, apexY + 20);
  ctx.quadraticCurveTo(cx - half * 0.6, g - (g - apexY) * 0.3, cx - half + 20, g - 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = alpha(outline(fill, 0.3), 0.5);
  ctx.lineWidth = 1.4;
  for (const t of [0.33, 0.66]) {
    const y = apexY + (g - apexY) * t;
    ctx.beginPath();
    ctx.moveTo(cx - half * t - 4, y);
    ctx.lineTo(cx + half * t + 4, y);
    ctx.stroke();
  }
}

function paintTeakDoor(ctx: Ctx, w: number, h: number): void {
  // the door is a smaller triangle on the front face, cream, with one flap folded aside
  const g = h - 6, cx = w / 2, top = 44, half = 34;
  ctx.beginPath();
  ctx.moveTo(cx - half, g);
  ctx.quadraticCurveTo(cx - half * 0.5, g - (g - top) * 0.5, cx, top);
  ctx.quadraticCurveTo(cx + half * 0.5, g - (g - top) * 0.5, cx + half, g);
  ctx.closePath();
  ctx.fillStyle = PALETTE.cream;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = outline(PALETTE.cream, 0.18);
  ctx.stroke();
  // the dim inside, seen through the open flap
  ctx.beginPath();
  ctx.moveTo(cx + 2, g);
  ctx.quadraticCurveTo(cx + 4, g - (g - top) * 0.5, cx + 1, top + 6);
  ctx.quadraticCurveTo(cx + half * 0.5, g - (g - top) * 0.5, cx + half - 4, g);
  ctx.closePath();
  ctx.fillStyle = mix(PALETTE.sage, PALETTE.ink, 0.45);
  ctx.fill();
  // flap tie
  ctx.fillStyle = PALETTE.rose;
  ellipsePath(ctx, cx + 18, g - 26, 3.5, 3.5);
  ctx.fill();
}

// ------------------------------------------------------------------ monsoon dome

const DOME = mix(PALETTE.cream, PALETTE.powder, 0.42);

function paintDomePoles(ctx: Ctx, w: number, h: number): void {
  const g = h - 6, cx = w / 2;
  ctx.strokeStyle = PALETTE.bark;
  ctx.lineWidth = 3;
  for (const k of [-0.6, 0, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(cx - 76, g);
    ctx.quadraticCurveTo(cx + k * 40, 6, cx + 76, g);
    ctx.stroke();
  }
}

function paintDomeCanopy(ctx: Ctx, w: number, h: number): void {
  const g = h - 6, cx = w / 2, rx = 78, ry = 92;
  ctx.beginPath();
  ctx.ellipse(cx, g, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = DOME;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = outline(DOME, 0.24);
  ctx.stroke();
  // pole seams
  ctx.strokeStyle = alpha(outline(DOME, 0.26), 0.6);
  ctx.lineWidth = 1.6;
  for (const k of [-0.55, 0.55]) {
    ctx.beginPath();
    ctx.moveTo(cx + k * rx * 1.05, g);
    ctx.quadraticCurveTo(cx + k * rx * 0.25, g - ry * 0.95, cx - k * rx * 0.3, g - ry * 0.4);
    ctx.stroke();
  }
  // sheen
  ctx.fillStyle = alpha(PALETTE.cream, 0.45);
  ellipsePath(ctx, cx - rx * 0.4, g - ry * 0.62, rx * 0.22, ry * 0.12, -0.6);
  ctx.fill();
  // laterite rim
  ctx.beginPath();
  ctx.ellipse(cx, g - 2, rx + 1, 10, 0, Math.PI, Math.PI * 2);
  ctx.lineTo(cx + rx + 1, g + 2);
  ctx.lineTo(cx - rx - 1, g + 2);
  ctx.closePath();
  ctx.fillStyle = ACCENTS.laterite;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = outline(ACCENTS.laterite, 0.26);
  ctx.stroke();
}

function paintDomeDoor(ctx: Ctx, w: number, h: number): void {
  const g = h - 6, cx = w / 2;
  // arched door, cream, zip line
  ctx.beginPath();
  ctx.moveTo(cx - 26, g);
  ctx.quadraticCurveTo(cx - 26, g - 62, cx, g - 62);
  ctx.quadraticCurveTo(cx + 26, g - 62, cx + 26, g);
  ctx.closePath();
  ctx.fillStyle = PALETTE.cream;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = outline(PALETTE.cream, 0.2);
  ctx.stroke();
  ctx.strokeStyle = alpha(outline(PALETTE.cream, 0.3), 0.7);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx, g - 58);
  ctx.lineTo(cx, g - 6);
  ctx.stroke();
  ctx.fillStyle = PALETTE.rose;
  ellipsePath(ctx, cx, g - 30, 3, 3);
  ctx.fill();
}

function paintDomeWindow(ctx: Ctx, w: number, h: number): void {
  const c = w / 2;
  ellipsePath(ctx, c, c, c - 3, c - 3);
  ctx.fillStyle = mix(PALETTE.powder, PALETTE.cream, 0.35);
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = outline(DOME, 0.3);
  ctx.stroke();
  ctx.fillStyle = alpha(PALETTE.cream, 0.6);
  ellipsePath(ctx, c - 4, c - 4, 4, 2.5, -0.6);
  ctx.fill();
}

// ------------------------------------------------------------------ little homestay

const WALL = mix(PALETTE.cream, ACCENTS.laterite, 0.12);
const TILE = ACCENTS.laterite;

function paintHomestayPoles(ctx: Ctx, w: number, h: number): void {
  // corner posts in bark
  const g = h - 6, cx = w / 2;
  ctx.strokeStyle = PALETTE.bark;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * 66, g);
    ctx.lineTo(cx + sx * 66, g - 72);
    ctx.stroke();
  }
}

function paintHomestayCanopy(ctx: Ctx, w: number, h: number): void {
  const g = h - 6, cx = w / 2, half = 66, wallTop = g - 70, ridgeY = 14;
  // walls: cream-washed laterite blocks
  roundRectPath(ctx, cx - half, wallTop, half * 2, g - wallTop, 6);
  ctx.fillStyle = WALL;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = outline(WALL, 0.22);
  ctx.stroke();
  ctx.strokeStyle = alpha(mix(WALL, ACCENTS.laterite, 0.5), 0.5);
  ctx.lineWidth = 1.4;
  for (let r = 0; r < 4; r++) {
    const y = wallTop + 12 + r * 15;
    ctx.beginPath();
    ctx.moveTo(cx - half + 4, y);
    ctx.lineTo(cx + half - 4, y);
    ctx.stroke();
    for (let b = 0; b < 5; b++) {
      const x = cx - half + 10 + b * 26 + (r % 2) * 13;
      if (x > cx + half - 6) continue;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 15);
      ctx.stroke();
    }
  }
  // roof: a gable of red tiles with scalloped rows
  const eaveY = wallTop + 4, over = 14;
  ctx.beginPath();
  ctx.moveTo(cx - half - over, eaveY);
  ctx.quadraticCurveTo(cx - half * 0.5, eaveY - (eaveY - ridgeY) * 0.55, cx, ridgeY);
  ctx.quadraticCurveTo(cx + half * 0.5, eaveY - (eaveY - ridgeY) * 0.55, cx + half + over, eaveY);
  ctx.lineTo(cx + half + over, eaveY + 8);
  ctx.lineTo(cx - half - over, eaveY + 8);
  ctx.closePath();
  ctx.fillStyle = TILE;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = outline(TILE, 0.26);
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = alpha(outline(TILE, 0.3), 0.6);
  ctx.lineWidth = 1.5;
  for (let row = 0; row < 5; row++) {
    const y = eaveY + 2 - row * 11;
    ctx.beginPath();
    for (let x = cx - half - over; x < cx + half + over; x += 14) {
      ctx.arc(x + 7 + (row % 2) * 7, y, 7, Math.PI, 0, true);
    }
    ctx.stroke();
  }
  ctx.restore();
  // ridge beam
  ctx.strokeStyle = outline(TILE, 0.3);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 10, ridgeY + 1);
  ctx.lineTo(cx + 10, ridgeY + 1);
  ctx.stroke();
}

function paintHomestayDoor(ctx: Ctx, w: number, h: number): void {
  const g = h - 6, cx = w / 2 + 28;
  roundRectPath(ctx, cx - 15, g - 46, 30, 46, 6);
  ctx.fillStyle = PALETTE.bark;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = outline(PALETTE.bark, 0.28);
  ctx.stroke();
  ctx.strokeStyle = alpha(outline(PALETTE.bark, 0.3), 0.6);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx, g - 42);
  ctx.lineTo(cx, g - 4);
  ctx.stroke();
  ctx.fillStyle = ACCENTS.marigold;
  ellipsePath(ctx, cx - 6, g - 24, 2.5, 2.5);
  ctx.fill();
}

function paintHomestayWindow(ctx: Ctx, w: number, h: number): void {
  roundRectPath(ctx, 3, 3, w - 6, h - 6, 5);
  ctx.fillStyle = mix(PALETTE.powder, PALETTE.cream, 0.3);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = PALETTE.bark;
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(w / 2, 4);
  ctx.lineTo(w / 2, h - 4);
  ctx.moveTo(4, h / 2);
  ctx.lineTo(w - 4, h / 2);
  ctx.stroke();
}

// ------------------------------------------------------------------ registry and rig

type PartSpec = { key: string; w: number; h: number; paint: (ctx: Ctx, w: number, h: number) => void };

function parts(kind: TentKind): Record<string, PartSpec> {
  const S = TENT_SIZES[kind];
  const floorFill = kind === 'homestay' ? mix(PALETTE.bark, PALETTE.cream, 0.45) : mix(PALETTE.bark, PALETTE.cream, 0.3);
  const base: Record<string, PartSpec> = {
    floor: { key: key(kind, 'floor'), w: S.w, h: 34, paint: paintFloor(floorFill) },
    peg: { key: 'tent-peg', w: PEG.w, h: PEG.h, paint: paintPeg },
    glow: { key: 'tent-window-glow', w: WINDOW_GLOW, h: WINDOW_GLOW, paint: paintWindowGlow },
  };
  switch (kind) {
    case 'teak':
      return {
        ...base,
        poles: { key: key(kind, 'poles'), w: S.w, h: S.h, paint: paintTeakPoles },
        canopy: { key: key(kind, 'canopy'), w: S.w, h: S.h, paint: paintTeakCanopy },
        door: { key: key(kind, 'door'), w: S.w, h: S.h, paint: paintTeakDoor },
      };
    case 'dome':
      return {
        ...base,
        poles: { key: key(kind, 'poles'), w: S.w, h: S.h, paint: paintDomePoles },
        canopy: { key: key(kind, 'canopy'), w: S.w, h: S.h, paint: paintDomeCanopy },
        door: { key: key(kind, 'door'), w: S.w, h: S.h, paint: paintDomeDoor },
        window: { key: key(kind, 'window'), w: 26, h: 26, paint: paintDomeWindow },
      };
    case 'homestay':
      return {
        ...base,
        poles: { key: key(kind, 'poles'), w: S.w, h: S.h, paint: paintHomestayPoles },
        canopy: { key: key(kind, 'canopy'), w: S.w, h: S.h, paint: paintHomestayCanopy },
        door: { key: key(kind, 'door'), w: S.w, h: S.h, paint: paintHomestayDoor },
        window: { key: key(kind, 'window'), w: 30, h: 26, paint: paintHomestayWindow },
      };
  }
}

export function paintTent(scene: Phaser.Scene, kind: TentKind): void {
  for (const p of Object.values(parts(kind))) paintTexture(scene, p.key, p.w, p.h, p.paint);
}

export type TentRig = {
  kind: TentKind;
  container: Phaser.GameObjects.Container;
  parts: {
    floor: Phaser.GameObjects.Image;
    poles: Phaser.GameObjects.Image;
    canopy: Phaser.GameObjects.Image;
    door: Phaser.GameObjects.Image;
    window?: Phaser.GameObjects.Image;
    windowGlow?: Phaser.GameObjects.Image;
    pegs: Phaser.GameObjects.Image[];
  };
  /** hang points in world coordinates (container position + local offsets) */
  hangPoints(): XY[];
  /** 0..1 window glow at night (dome and homestay) */
  setWindowGlow(k: number): void;
};

const WINDOW_POS: Record<TentKind, XY | undefined> = {
  teak: undefined,
  dome: { x: 40, y: -58 },
  homestay: { x: -30, y: -44 },
};

/** A tent standing at (x, groundY), built from its parts in a Container (floor, pegs, poles, canopy, window, door). */
export function makeTent(scene: Phaser.Scene, kind: TentKind, x: number, y: number): TentRig {
  paintTent(scene, kind);
  const P = parts(kind);
  const S = TENT_SIZES[kind];
  const container = scene.add.container(x, y);
  const floor = makeImg(scene, 0, 2, P.floor.key).setOrigin(0.5, 0.5);
  const body = (k: string) => makeImg(scene, 0, 6, k).setOrigin(0.5, 1);
  const poles = body(P.poles.key), canopy = body(P.canopy.key), door = body(P.door.key);
  const pegs: Phaser.GameObjects.Image[] = [];
  const px = S.w / 2 - 6;
  for (const [dx, dy] of [[-px, 2], [px, 2], [-px * 0.6, 10], [px * 0.6, 10]]) {
    const peg = makeImg(scene, dx, dy, P.peg.key).setOrigin(0.5, 0.85);
    pegs.push(peg);
  }
  container.add([floor, ...pegs, poles, canopy]);
  let win: Phaser.GameObjects.Image | undefined, glow: Phaser.GameObjects.Image | undefined;
  const wp = WINDOW_POS[kind];
  if (wp && P.window) {
    glow = makeImg(scene, wp.x, wp.y, P.glow.key).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    win = makeImg(scene, wp.x, wp.y, P.window.key);
    container.add([win, glow]);
  }
  container.add(door);
  const local = HANG[kind];
  return {
    kind, container,
    parts: { floor, poles, canopy, door, window: win, windowGlow: glow, pegs },
    hangPoints: () => local.map((p) => ({ x: container.x + p.x, y: container.y + p.y })),
    setWindowGlow(k: number) {
      const a = Phaser.Math.Clamp(k, 0, 1);
      glow?.setAlpha(a * 0.85);
      win?.setTint(Phaser.Display.Color.HexStringToColor(mix(PALETTE.cream, PALETTE.glow, a)).color);
    },
  };
}

/** Darker shade helper re-exported so scene code never computes tent colors itself. */
export const TENT_SHADE = { dome: shade(DOME, -0.2), wall: shade(WALL, -0.2) } as const;
