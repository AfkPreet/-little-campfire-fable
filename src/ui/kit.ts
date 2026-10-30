/**
 * UI kit textures and nine-slice helpers.
 *
 * Every UI texture is painted once at ART_SCALE (2x) through paintTexture and registered under a stable key (TEX.*).
 * Panels (cards, buttons, pills, bubbles) are nine-slice textures with the soft ink shadow BAKED INTO A MARGIN around
 * the visible shape, so stretching keeps corners and shadows crisp.
 *
 * Nine-slice approach (verified on the style board):
 *   - the texture is painted at 2x, so a NineSlice is created with texture-pixel sizes (logical * ART_SCALE) and
 *     slice insets in texture pixels, then scaled by 1/ART_SCALE (and tagged with baseScale like every image);
 *   - the slice insets sit `margin + radius + SLICE_PAD` from each texture edge, so the stretched edge regions contain
 *     only straight outline + flat fill + uniform shadow (no curvature leaks into the stretch, hence no seams);
 *   - callers think in logical px of the VISIBLE shape: nine(scene, spec, x, y, w, h) centers the visible box on (x, y)
 *     and offsets the object by the asymmetric shadow margin.
 *
 * Paper grain is a separate small tile texture (TEX.grain) laid over cards by Card, because grain inside a stretched
 * nine-slice region would smear into streaks.
 */
import Phaser from 'phaser';
import { PALETTE, alpha, shade, outline, mix, desaturate } from '@/config/palette';
import { ART_SCALE, paintTexture, makeImg, img, roundRectPath, ellipsePath, paperGrain, type Ctx } from '@/art/pipeline';

// ---------- locked numbers ----------
export const UI = {
  /** card corner radius */
  radius: 20,
  /** speech bubble corner radius */
  bubbleRadius: 16,
  /** outline width (logical px) */
  outline: 2,
  /** soft shadow: ink-tinted, blur 12, y 4, alpha 0.15 */
  shadow: { blur: 12, y: 4, alpha: 0.15 },
  /** standard button height (>= 44) */
  buttonH: 52,
  /** small pill height (toasts, bubble actions) */
  pillH: 44,
  /** round icon button diameter */
  iconButton: 56,
  /** minimum touch target */
  minTouch: 44,
  /** card inner padding */
  pad: 20,
  /** gap between buttons */
  gap: 12,
} as const;

/** Extra straight run between the corner arc and the slice boundary (keeps the shadow uniform in stretched regions). */
const SLICE_PAD = 12;

/** Shadow margins baked into panel textures (logical px). Bottom is larger because the shadow is offset down. */
const CARD_MARGIN = { l: 20, r: 20, t: 16, b: 24 } as const;
const PILL_MARGIN = { l: 16, r: 16, t: 12, b: 20 } as const;

export const COLORS = {
  cardFill: PALETTE.cream,
  cardLine: shade(PALETTE.cream, -0.2),
  primaryFill: PALETTE.rose,
  primaryLine: outline(PALETTE.rose),
  primaryText: PALETTE.cream,
  secondaryFill: PALETTE.cream,
  secondaryLine: shade(PALETTE.cream, -0.22),
  secondaryText: PALETTE.ink,
  disabledFill: desaturate(mix(PALETTE.rose, PALETTE.cream, 0.5), 0.55),
  disabledLine: desaturate(mix(PALETTE.rose, PALETTE.cream, 0.2), 0.55),
  disabledText: mix(PALETTE.ink, PALETTE.cream, 0.42),
  track: shade(PALETTE.cream, -0.14),
  trackOn: PALETTE.sage,
  trackFill: PALETTE.rose,
  muted: mix(PALETTE.ink, PALETTE.cream, 0.35),
  backdrop: PALETTE.ink,
  ribbon: PALETTE.rose,
} as const;

// ---------- texture keys ----------
export const TEX = {
  card: 'ui-card',
  bubbleBody: 'ui-bubble-body',
  bubbleTail: 'ui-bubble-tail',
  bubble: 'ui-bubble',
  pill: 'ui-pill',
  pillFill: 'ui-pill-fill',
  btnPrimary: 'ui-btn-primary',
  btnSecondary: 'ui-btn-secondary',
  btnDisabled: 'ui-btn-disabled',
  iconBtn: 'ui-icon-btn',
  knob: 'ui-knob',
  knobSmall: 'ui-knob-sm',
  disc: 'ui-disc',
  ribbon: 'ui-ribbon',
  leafTag: 'ui-leaf-tag',
  ring: 'ui-ring',
  starFull: 'ui-star',
  starEmpty: 'ui-star-empty',
  heart: 'ui-heart',
  coin: 'ui-coin',
  sun: 'ui-sun',
  moon: 'ui-moon',
  lantern: 'ui-lantern',
  backpack: 'ui-backpack',
  journal: 'ui-journal',
  close: 'ui-close',
  minus: 'ui-minus',
  plus: 'ui-plus',
  grain: 'ui-grain',
} as const;

// ---------- nine-slice specs ----------
export type NineMargin = { l: number; r: number; t: number; b: number };
export type NineSpec = {
  key: string;
  /** shadow margin around the visible shape (logical px) */
  margin: NineMargin;
  /** slice insets from the texture edges (logical px). t = b = 0 means a 3-slice with fixed height. */
  inset: NineMargin;
  /** full texture size (logical px) */
  texW: number;
  texH: number;
  /** visible height for 3-slice specs */
  visibleH?: number;
};

function panelSpec(key: string, radius: number, margin: NineMargin): NineSpec {
  const inset = { l: margin.l + radius + SLICE_PAD, r: margin.r + radius + SLICE_PAD, t: margin.t + radius + SLICE_PAD, b: margin.b + radius + SLICE_PAD };
  return { key, margin, inset, texW: inset.l + 8 + inset.r, texH: inset.t + 8 + inset.b };
}
function pillSpec(key: string, h: number, margin: NineMargin): NineSpec {
  const r = h / 2;
  const inset = { l: margin.l + r + 8, r: margin.r + r + 8, t: 0, b: 0 };
  return { key, margin, inset, texW: inset.l + 8 + inset.r, texH: margin.t + h + margin.b, visibleH: h };
}

/**
 * Card: radius 20, margins l/r 20, t 16, b 24; slice insets l/r 52, t 48, b 56 (logical) => 104/96/112 texture px.
 * Minimum visible size is 72x72 logical (below that the corners would overlap).
 */
export const CARD_SPEC: NineSpec = panelSpec(TEX.card, UI.radius, CARD_MARGIN);
/** Speech bubble body: radius 16, same margins; insets l/r 48, t 44, b 52. */
export const BUBBLE_SPEC: NineSpec = panelSpec(TEX.bubbleBody, UI.bubbleRadius, CARD_MARGIN);
/** Toast pill: 3-slice, visible height 44, insets l/r 46. */
export const PILL_SPEC: NineSpec = pillSpec(TEX.pill, UI.pillH, PILL_MARGIN);
/** Slider fill pill (no shadow): 10 tall. */
export const PILL_FILL_SPEC: NineSpec = pillSpec(TEX.pillFill, 10, { l: 2, r: 2, t: 2, b: 2 });

const buttonSpecs = new Map<string, NineSpec>();
export type ButtonSkin = 'primary' | 'secondary' | 'disabled';

/** Button 3-slice spec for a skin and visible height (painted lazily for non-default heights). */
export function buttonSpec(scene: Phaser.Scene, skin: ButtonSkin, h = UI.buttonH): NineSpec {
  const hh = Math.max(UI.minTouch, Math.round(h));
  const key = hh === UI.buttonH ? buttonKey(skin) : `${buttonKey(skin)}-${hh}`;
  let spec = buttonSpecs.get(key);
  if (!spec) {
    spec = pillSpec(key, hh, PILL_MARGIN);
    buttonSpecs.set(key, spec);
  }
  if (!scene.textures.exists(key)) paintButtonTexture(scene, spec, skin);
  return spec;
}
function buttonKey(skin: ButtonSkin): string {
  return skin === 'primary' ? TEX.btnPrimary : skin === 'secondary' ? TEX.btnSecondary : TEX.btnDisabled;
}

/**
 * Create a NineSlice for a spec. (x, y) is the center of the VISIBLE box and (w, h) its logical size; the shadow
 * margin is handled here. The object is scaled 1/ART_SCALE with baseScale stored, like every painted image.
 * NineSlice is WebGL-only in Phaser 3.60+; the game runs Phaser.AUTO (WebGL everywhere we ship).
 */
export function nine(scene: Phaser.Scene, spec: NineSpec, x: number, y: number, w: number, h: number, add = true): Phaser.GameObjects.NineSlice {
  const S = ART_SCALE;
  const m = spec.margin, i = spec.inset;
  const is3 = i.t === 0 && i.b === 0;
  const vh = is3 ? (spec.visibleH ?? h) : h;
  const tw = (Math.max(w, i.l + i.r - m.l - m.r) + m.l + m.r) * S;
  const th = (Math.max(vh, i.t + i.b - m.t - m.b) + m.t + m.b) * S;
  const n = new Phaser.GameObjects.NineSlice(
    scene,
    x + (m.r - m.l) / 2,
    y + (m.b - m.t) / 2,
    spec.key,
    undefined,
    tw,
    th,
    i.l * S,
    i.r * S,
    is3 ? undefined : i.t * S,
    is3 ? undefined : i.b * S,
  );
  n.setScale(1 / S);
  n.setData('baseScale', 1 / S);
  if (add) scene.add.existing(n);
  return n;
}

/** Resize a NineSlice made by nine() to a new visible logical size (height ignored for 3-slices). */
export function resizeNine(n: Phaser.GameObjects.NineSlice, spec: NineSpec, w: number, h: number): void {
  const S = ART_SCALE;
  const m = spec.margin, i = spec.inset;
  const tw = (Math.max(w, i.l + i.r - m.l - m.r) + m.l + m.r) * S;
  if (n.is3Slice) n.setSize(tw, n.height);
  else n.setSize(tw, (Math.max(h, i.t + i.b - m.t - m.b) + m.t + m.b) * S);
}

/** A card panel NineSlice at logical size, visible box centered on (x, y). */
export function nineCard(scene: Phaser.Scene, x: number, y: number, w: number, h: number, add = true): Phaser.GameObjects.NineSlice {
  return nine(scene, CARD_SPEC, x, y, w, h, add);
}
/** A button background 3-slice at logical width (visible height = spec height). */
export function nineButton(scene: Phaser.Scene, skin: ButtonSkin, x: number, y: number, w: number, h = UI.buttonH, add = true): Phaser.GameObjects.NineSlice {
  const spec = buttonSpec(scene, skin, h);
  return nine(scene, spec, x, y, w, spec.visibleH ?? h, add);
}
/** A toast/label pill 3-slice. */
export function ninePill(scene: Phaser.Scene, x: number, y: number, w: number, add = true): Phaser.GameObjects.NineSlice {
  return nine(scene, PILL_SPEC, x, y, w, UI.pillH, add);
}

// ---------- painting helpers ----------

/** Run a fill with the house soft shadow (ink-tinted). Blur/offset are in device px, so multiply by ART_SCALE. */
export function withInkShadow(ctx: Ctx, draw: () => void, a: number = UI.shadow.alpha, blur: number = UI.shadow.blur, y: number = UI.shadow.y): void {
  ctx.save();
  ctx.shadowColor = alpha(PALETTE.ink, a);
  ctx.shadowBlur = blur * ART_SCALE;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = y * ART_SCALE;
  draw();
  ctx.restore();
}

export type PanelStyle = {
  fill: string;
  line: string;
  lineW?: number;
  shadow?: boolean;
  shadowAlpha?: number;
  /** cream sheen band along the top (buttons) */
  sheen?: number;
};

/** A rounded panel: shadowed fill, outline, optional sheen. Coordinates are the visible box. */
export function paintPanel(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, st: PanelStyle): void {
  const draw = () => {
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = st.fill;
    ctx.fill();
  };
  if (st.shadow !== false) withInkShadow(ctx, draw, st.shadowAlpha ?? UI.shadow.alpha);
  else draw();
  if (st.sheen) {
    ctx.save();
    roundRectPath(ctx, x + 3, y + 3, w - 6, h - 6, Math.max(2, r - 3));
    ctx.clip();
    ctx.fillStyle = alpha(PALETTE.cream, st.sheen);
    ctx.fillRect(x, y, w, h * 0.46);
    ctx.restore();
  }
  roundRectPath(ctx, x, y, w, h, r);
  ctx.lineWidth = st.lineW ?? UI.outline;
  ctx.strokeStyle = st.line;
  ctx.stroke();
}

/** A shadowed disc with outline (icon buttons, knobs). */
export function paintDisc(ctx: Ctx, cx: number, cy: number, d: number, st: PanelStyle): void {
  const r = d / 2;
  const draw = () => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = st.fill;
    ctx.fill();
  };
  if (st.shadow !== false) withInkShadow(ctx, draw, st.shadowAlpha ?? UI.shadow.alpha);
  else draw();
  if (st.sheen) {
    ctx.fillStyle = alpha(PALETTE.cream, st.sheen);
    ellipsePath(ctx, cx - r * 0.1, cy - r * 0.42, r * 0.6, r * 0.32);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = st.lineW ?? UI.outline;
  ctx.strokeStyle = st.line;
  ctx.stroke();
}

function fillStroke(ctx: Ctx, fill: string, line: string = outline(fill), w: number = UI.outline): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = w;
  ctx.strokeStyle = line;
  ctx.stroke();
}

export function starPath(ctx: Ctx, cx: number, cy: number, rOuter: number, rInner: number): void {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 === 0 ? rOuter : rInner;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function heartPath(ctx: Ctx, cx: number, cy: number, s: number): void {
  // s = half width
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.95);
  ctx.bezierCurveTo(cx - s * 1.1, cy + s * 0.15, cx - s * 1.05, cy - s * 0.95, cx, cy - s * 0.4);
  ctx.bezierCurveTo(cx + s * 1.05, cy - s * 0.95, cx + s * 1.1, cy + s * 0.15, cx, cy + s * 0.95);
  ctx.closePath();
}

function skinStyle(skin: ButtonSkin): PanelStyle {
  switch (skin) {
    case 'primary':
      return { fill: COLORS.primaryFill, line: COLORS.primaryLine, sheen: 0.22 };
    case 'secondary':
      return { fill: COLORS.secondaryFill, line: COLORS.secondaryLine, sheen: 0.3 };
    default:
      return { fill: COLORS.disabledFill, line: COLORS.disabledLine, shadowAlpha: 0.07 };
  }
}

function paintButtonTexture(scene: Phaser.Scene, spec: NineSpec, skin: ButtonSkin): void {
  const m = spec.margin;
  const h = spec.visibleH ?? UI.buttonH;
  paintTexture(scene, spec.key, spec.texW, spec.texH, (ctx) => {
    paintPanel(ctx, m.l, m.t, spec.texW - m.l - m.r, h, h / 2, skinStyle(skin));
  });
}

// ---------- the kit ----------

/** Paint and register every reusable UI texture (idempotent). Call once per scene that uses the kit. */
export function paintUiTextures(scene: Phaser.Scene): void {
  const cream = PALETTE.cream;

  // Card 9-slice: cream, darker-cream outline, baked ink shadow.
  {
    const s = CARD_SPEC, m = s.margin;
    paintTexture(scene, s.key, s.texW, s.texH, (ctx) => {
      paintPanel(ctx, m.l, m.t, s.texW - m.l - m.r, s.texH - m.t - m.b, UI.radius, { fill: COLORS.cardFill, line: COLORS.cardLine });
    });
  }
  // Speech bubble body (radius 16) + tail. The tail image overlaps the body's bottom edge by 4 px to hide the outline.
  {
    const s = BUBBLE_SPEC, m = s.margin;
    paintTexture(scene, s.key, s.texW, s.texH, (ctx) => {
      paintPanel(ctx, m.l, m.t, s.texW - m.l - m.r, s.texH - m.t - m.b, UI.bubbleRadius, { fill: COLORS.cardFill, line: COLORS.cardLine });
    });
    paintTexture(scene, TEX.bubbleTail, 36, 24, (ctx, w) => {
      // top edge sits 4 px above the body's bottom outline; the tip is at the bottom center
      const top = 0, base = 4, tip = 20;
      withInkShadow(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(4, base);
        ctx.quadraticCurveTo(w / 2 - 2, base + 2, w / 2, tip);
        ctx.quadraticCurveTo(w / 2 + 2, base + 2, w - 4, base);
        ctx.closePath();
        ctx.fillStyle = cream;
        ctx.fill();
      }, 0.1, 6, 2);
      ctx.fillStyle = cream;
      ctx.fillRect(6, top, w - 12, base + 1.5);
      ctx.beginPath();
      ctx.moveTo(4, base);
      ctx.quadraticCurveTo(w / 2 - 2, base + 2, w / 2, tip);
      ctx.quadraticCurveTo(w / 2 + 2, base + 2, w - 4, base);
      ctx.lineWidth = UI.outline;
      ctx.strokeStyle = COLORS.cardLine;
      ctx.stroke();
    });
    // A complete single-size bubble (160x64 body) for quick labels.
    paintTexture(scene, TEX.bubble, 200, 112, (ctx) => {
      const bx = 20, by = 16, bw = 160, bh = 64;
      paintPanel(ctx, bx, by, bw, bh, UI.bubbleRadius, { fill: cream, line: COLORS.cardLine });
      ctx.beginPath();
      ctx.moveTo(100 - 14, by + bh - 1);
      ctx.quadraticCurveTo(100 - 2, by + bh + 2, 100, by + bh + 16);
      ctx.quadraticCurveTo(100 + 2, by + bh + 2, 100 + 14, by + bh - 1);
      ctx.closePath();
      ctx.fillStyle = cream;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(100 - 14, by + bh - 1);
      ctx.quadraticCurveTo(100 - 2, by + bh + 2, 100, by + bh + 16);
      ctx.quadraticCurveTo(100 + 2, by + bh + 2, 100 + 14, by + bh - 1);
      ctx.lineWidth = UI.outline;
      ctx.strokeStyle = COLORS.cardLine;
      ctx.stroke();
    });
  }
  // Toast pill (3-slice)
  {
    const s = PILL_SPEC, m = s.margin;
    paintTexture(scene, s.key, s.texW, s.texH, (ctx) => {
      paintPanel(ctx, m.l, m.t, s.texW - m.l - m.r, UI.pillH, UI.pillH / 2, { fill: cream, line: COLORS.cardLine });
    });
    const f = PILL_FILL_SPEC, fm = f.margin;
    paintTexture(scene, f.key, f.texW, f.texH, (ctx) => {
      paintPanel(ctx, fm.l, fm.t, f.texW - fm.l - fm.r, 10, 5, { fill: COLORS.trackFill, line: outline(COLORS.trackFill, 0.12), shadow: false, lineW: 1.5 });
    });
  }
  // Buttons at the default height
  buttonSpec(scene, 'primary');
  buttonSpec(scene, 'secondary');
  buttonSpec(scene, 'disabled');

  // Round icon-button background (56) and knobs (44, 28)
  const discTex = (key: string, d: number, st: PanelStyle) =>
    paintTexture(scene, key, d + 36, d + 36, (ctx, w, h) => paintDisc(ctx, w / 2, h / 2 - 2, d, st));
  discTex(TEX.iconBtn, UI.iconButton, { fill: cream, line: COLORS.cardLine, sheen: 0.3 });
  discTex(TEX.knob, 44, { fill: cream, line: COLORS.cardLine, sheen: 0.3 });
  discTex(TEX.knobSmall, 28, { fill: cream, line: COLORS.cardLine, sheen: 0.3, shadowAlpha: 0.12 });

  // Soft empty disc (fish image placeholder area on the catch card)
  paintTexture(scene, TEX.disc, 160, 160, (ctx, w, h) => {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 68, 0, Math.PI * 2);
    ctx.fillStyle = shade(cream, -0.06);
    ctx.fill();
    ctx.lineWidth = UI.outline;
    ctx.strokeStyle = shade(cream, -0.16);
    ctx.stroke();
    ctx.fillStyle = alpha(PALETTE.powder, 0.22);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 52, 0, Math.PI * 2);
    ctx.fill();
  });

  // Ribbon ("NEW!" backing): small rose banner with notched ends
  paintTexture(scene, TEX.ribbon, 112, 44, (ctx, w, h) => {
    const x = 10, y = 8, bw = w - 20, bh = 28, notch = 9;
    withInkShadow(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + bw, y);
      ctx.lineTo(x + bw - notch, y + bh / 2);
      ctx.lineTo(x + bw, y + bh);
      ctx.lineTo(x, y + bh);
      ctx.lineTo(x + notch, y + bh / 2);
      ctx.closePath();
      ctx.fillStyle = COLORS.ribbon;
      ctx.fill();
    }, 0.12, 8, 3);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + bw, y);
    ctx.lineTo(x + bw - notch, y + bh / 2);
    ctx.lineTo(x + bw, y + bh);
    ctx.lineTo(x, y + bh);
    ctx.lineTo(x + notch, y + bh / 2);
    ctx.closePath();
    ctx.lineWidth = UI.outline;
    ctx.strokeStyle = outline(COLORS.ribbon);
    ctx.stroke();
    void h;
  });

  // Leaf tag (shop essentials)
  paintTexture(scene, TEX.leafTag, 40, 28, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(5, 22);
    ctx.quadraticCurveTo(6, 4, 34, 5);
    ctx.quadraticCurveTo(33, 24, 5, 22);
    ctx.closePath();
    fillStroke(ctx, PALETTE.sage, outline(PALETTE.sage));
    ctx.beginPath();
    ctx.moveTo(8, 21);
    ctx.quadraticCurveTo(18, 14, 30, 8);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = PALETTE.moss;
    ctx.stroke();
  });

  // Breathing outline ring for interactables (glow, soft halo). Tween its scale/alpha with juice.breathe.
  paintTexture(scene, TEX.ring, 112, 112, (ctx, w, h) => {
    ctx.save();
    ctx.shadowColor = alpha(PALETTE.glow, 0.9);
    ctx.shadowBlur = 10 * ART_SCALE;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 42, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = alpha(PALETTE.glow, 0.95);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 42, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = alpha(cream, 0.8);
    ctx.stroke();
  });

  // Stars (rarity): filled butter, empty cream-ish
  paintTexture(scene, TEX.starFull, 32, 32, (ctx, w, h) => {
    starPath(ctx, w / 2, h / 2 + 1, 13, 6);
    fillStroke(ctx, PALETTE.butter, outline(PALETTE.butter, 0.3));
    ctx.fillStyle = alpha(cream, 0.5);
    ellipsePath(ctx, w / 2 - 3, h / 2 - 3, 3, 2, -0.6);
    ctx.fill();
  });
  paintTexture(scene, TEX.starEmpty, 32, 32, (ctx, w, h) => {
    starPath(ctx, w / 2, h / 2 + 1, 13, 6);
    fillStroke(ctx, shade(cream, -0.08), shade(cream, -0.28));
  });

  // Heart
  paintTexture(scene, TEX.heart, 32, 32, (ctx, w, h) => {
    heartPath(ctx, w / 2, h / 2 + 1, 12);
    fillStroke(ctx, PALETTE.blush, outline(PALETTE.blush));
    ctx.fillStyle = alpha(cream, 0.55);
    ellipsePath(ctx, w / 2 - 5, h / 2 - 5, 3, 2, -0.7);
    ctx.fill();
  });

  // Coin: butter disc with a darker rim (generic; the world may re-skin)
  paintTexture(scene, TEX.coin, 32, 32, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    fillStroke(ctx, PALETTE.butter, shade(PALETTE.butter, -0.32), 2.5);
    ctx.beginPath();
    ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = shade(PALETTE.butter, -0.2);
    ctx.stroke();
    ctx.fillStyle = alpha(cream, 0.6);
    ellipsePath(ctx, cx - 4, cy - 5, 3.5, 2, -0.7);
    ctx.fill();
  });

  // Sun and moon (HUD clock)
  paintTexture(scene, TEX.sun, 40, 40, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    ctx.lineWidth = 3;
    ctx.strokeStyle = shade(PALETTE.butter, -0.22);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13);
      ctx.lineTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    fillStroke(ctx, PALETTE.butter, shade(PALETTE.butter, -0.28));
    ctx.fillStyle = alpha(cream, 0.5);
    ellipsePath(ctx, cx - 3, cy - 3.5, 3, 2, -0.7);
    ctx.fill();
  });
  paintTexture(scene, TEX.moon, 40, 40, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    ctx.save();
    ctx.shadowColor = alpha(PALETTE.glow, 0.7);
    ctx.shadowBlur = 6 * ART_SCALE;
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.fillStyle = mix(PALETTE.glow, cream, 0.35);
    ctx.fill();
    ctx.restore();
    // bite out of the moon (lavender night sky tone)
    ctx.beginPath();
    ctx.arc(cx + 7, cy - 4, 10, 0, Math.PI * 2);
    ctx.fillStyle = mix(PALETTE.lavender, cream, 0.15);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 13, Math.PI * 0.75, Math.PI * 2.35);
    ctx.lineWidth = 2;
    ctx.strokeStyle = shade(PALETTE.glow, -0.25);
    ctx.stroke();
    ctx.fillStyle = alpha(cream, 0.5);
    ctx.beginPath();
    ctx.arc(cx - 1, cy - 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alpha(PALETTE.lavender, 0.25);
    ctx.beginPath();
    ctx.arc(cx - 6, cy + 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Lantern (Contentment HUD): bark cap and base, glowing body, little flame
  paintTexture(scene, TEX.lantern, 40, 48, (ctx, w) => {
    const cx = w / 2;
    // handle
    ctx.beginPath();
    ctx.arc(cx, 10, 6, Math.PI, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = outline(PALETTE.bark);
    ctx.stroke();
    // glow halo
    ctx.save();
    ctx.shadowColor = alpha(PALETTE.glow, 0.8);
    ctx.shadowBlur = 8 * ART_SCALE;
    roundRectPath(ctx, cx - 10, 14, 20, 24, 6);
    ctx.fillStyle = PALETTE.glow;
    ctx.fill();
    ctx.restore();
    roundRectPath(ctx, cx - 10, 14, 20, 24, 6);
    ctx.lineWidth = 2;
    ctx.strokeStyle = shade(PALETTE.glow, -0.3);
    ctx.stroke();
    // flame
    ellipsePath(ctx, cx, 27, 4, 6);
    ctx.fillStyle = PALETTE.ember;
    ctx.fill();
    ellipsePath(ctx, cx, 29, 2, 3);
    ctx.fillStyle = PALETTE.butter;
    ctx.fill();
    // cap and base
    roundRectPath(ctx, cx - 13, 9, 26, 7, 3);
    fillStroke(ctx, PALETTE.bark);
    roundRectPath(ctx, cx - 11, 36, 22, 7, 3);
    fillStroke(ctx, PALETTE.bark);
  });

  // Backpack: moss bag, bark flap, little pocket
  paintTexture(scene, TEX.backpack, 44, 44, (ctx, w, h) => {
    const cx = w / 2;
    // straps
    ctx.lineWidth = 3;
    ctx.strokeStyle = outline(PALETTE.bark);
    ctx.beginPath();
    ctx.moveTo(cx - 7, 9);
    ctx.quadraticCurveTo(cx, 2, cx + 7, 9);
    ctx.stroke();
    roundRectPath(ctx, cx - 15, 10, 30, 30, 10);
    fillStroke(ctx, PALETTE.moss);
    roundRectPath(ctx, cx - 9, 24, 18, 12, 5);
    fillStroke(ctx, shade(PALETTE.moss, 0.12), outline(PALETTE.moss));
    roundRectPath(ctx, cx - 16, 8, 32, 12, 6);
    fillStroke(ctx, PALETTE.bark);
    ctx.fillStyle = PALETTE.butter;
    ctx.beginPath();
    ctx.arc(cx, 20, 2.5, 0, Math.PI * 2);
    ctx.fill();
    void h;
  });

  // Journal: rose cover, cream page edge, butter bookmark
  paintTexture(scene, TEX.journal, 40, 44, (ctx, w, h) => {
    const x = 6, y = 4, bw = 28, bh = 36;
    roundRectPath(ctx, x + 3, y + 2, bw, bh, 5);
    fillStroke(ctx, cream, shade(cream, -0.25));
    roundRectPath(ctx, x, y, bw, bh, 5);
    fillStroke(ctx, PALETTE.rose);
    // spine
    ctx.fillStyle = outline(PALETTE.rose, 0.15);
    roundRectPath(ctx, x, y, 6, bh, 4);
    ctx.fill();
    // bookmark
    ctx.beginPath();
    ctx.moveTo(x + 18, y - 1);
    ctx.lineTo(x + 24, y - 1);
    ctx.lineTo(x + 24, y + 13);
    ctx.lineTo(x + 21, y + 10);
    ctx.lineTo(x + 18, y + 13);
    ctx.closePath();
    fillStroke(ctx, PALETTE.butter, outline(PALETTE.butter, 0.3), 1.5);
    // little label
    roundRectPath(ctx, x + 10, y + 18, 13, 9, 3);
    fillStroke(ctx, cream, shade(cream, -0.2), 1.5);
    void w;
    void h;
  });

  // Close (x), minus and plus glyphs for icon buttons
  paintTexture(scene, TEX.close, 24, 24, (ctx, w, h) => {
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.moveTo(6, 6);
    ctx.lineTo(w - 6, h - 6);
    ctx.moveTo(w - 6, 6);
    ctx.lineTo(6, h - 6);
    ctx.stroke();
  });
  paintTexture(scene, TEX.minus, 24, 24, (ctx, w, h) => {
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.moveTo(5, h / 2);
    ctx.lineTo(w - 5, h / 2);
    ctx.stroke();
  });
  paintTexture(scene, TEX.plus, 24, 24, (ctx, w, h) => {
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.moveTo(5, h / 2);
    ctx.lineTo(w - 5, h / 2);
    ctx.moveTo(w / 2, 5);
    ctx.lineTo(w / 2, h - 5);
    ctx.stroke();
  });

  // Paper grain tile (transparent, faint ink dots)
  paintTexture(scene, TEX.grain, 96, 96, (ctx, w, h) => {
    paperGrain(ctx, 0, 0, w, h, PALETTE.ink, 0.045, 11);
  });
}

// ---------- small factories ----------

/** An icon image (kit texture) added to the scene at logical size. */
export function icon(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  return img(scene, x, y, key);
}
/** An icon image made for a container. */
export function makeIcon(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  return makeImg(scene, x, y, key);
}

/** A row of rarity stars (filled up to `filled`, out of `total`), as images centered on (x, y). */
export function makeStars(scene: Phaser.Scene, x: number, y: number, filled: number, total = 3, gap = 30): Phaser.GameObjects.Image[] {
  const out: Phaser.GameObjects.Image[] = [];
  const x0 = x - ((total - 1) * gap) / 2;
  for (let k = 0; k < total; k++) {
    out.push(makeImg(scene, x0 + k * gap, y, k < filled ? TEX.starFull : TEX.starEmpty));
  }
  return out;
}

/** A paper-grain TileSprite (made, not added) covering a w x h box centered on (x, y). */
export function makeGrain(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.TileSprite {
  const t = scene.make.tileSprite({ x, y, width: Math.max(1, w * ART_SCALE), height: Math.max(1, h * ART_SCALE), key: TEX.grain, add: false });
  t.setScale(1 / ART_SCALE);
  t.setData('baseScale', 1 / ART_SCALE);
  return t;
}

/** Breathing outline ring for an interactable: pulses alpha and scale on a sine loop; returns the image. */
export function breathingRing(scene: Phaser.Scene, x: number, y: number, radius = 42): Phaser.GameObjects.Image {
  const r = img(scene, x, y, TEX.ring);
  const b = (radius / 42) / ART_SCALE;
  r.setScale(b);
  r.setData('baseScale', b);
  r.setAlpha(0.75);
  scene.tweens.add({ targets: r, scaleX: b * 1.06, scaleY: b * 1.06, alpha: 1, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return r;
}

export { ART_SCALE };
