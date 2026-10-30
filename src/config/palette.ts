/**
 * palette.ts: the single source of truth for every color in the game.
 * Nothing in src/ may use a hex literal outside this file.
 * Base tokens come from the art bible (section 8) and are locked.
 * Setting accents are added at M0 (ART_BIBLE.md) at HSB saturation <= 40% (ember excepted) and logged in DECISIONS.md.
 */
export const PALETTE = {
  cream: '#F6EFE6', // paper, highlights, UI cards
  butter: '#F2DFA7', // sunlight, warm accents
  peach: '#F2B8A0', // dawn, food
  rose: '#D9A0A6', // flowers, UI accents
  blush: '#EFA3A8', // cheeks at 60% alpha
  lavender: '#B9AACB', // mist, far ridges
  powder: '#A9C3D9', // day sky, water
  sage: '#A8BFA0', // foliage
  moss: '#7E9C82', // deep foliage, near trees
  bark: '#8C6F5E', // wood, tent poles, ground edges
  ink: '#4A4250', // eyes, text, the darkest value (never #000)
  ember: '#F29E6B', // fire; the only saturated warm
  glow: '#FFD59A', // firelight, lanterns, fireflies
} as const;

/** Setting accents (locked at M0, ART_BIBLE.md section 2). All at or under 40% HSB saturation. */
export const ACCENTS = {
  laterite: '#C99886', // red-earth path, fire-ring stones, coracle rim, clay pot (33%)
  reservoir: '#8FB5B0', // teal-green water by day, lily pads, the kettle (21%)
  marigold: '#DFBE8F', // Doddamma's shawl, garlands, jackfruit flesh, Honey Whisker (36%)
  jamun: '#9A7F9F', // jamun berries and stains, Firefly Catfish, dusk shadow (20%)
} as const;
export type AccentToken = keyof typeof ACCENTS;

export type PaletteToken = keyof typeof PALETTE;

/** Lighting keys from the art bible. Each key tints every layer. */
export const LIGHT_KEYS = {
  dawn: { top: '#C9B6D6', horizon: '#F4C9B8' },
  day: { top: '#A9C9E3', horizon: '#E8F0EC' },
  golden: { top: '#E8C3A0', horizon: '#F6E3B4' },
  dusk: { top: '#8E86B5', horizon: '#E9A9A6' },
  night: { top: '#2F3558', horizon: '#5B5E86' },
} as const;
export type LightKey = keyof typeof LIGHT_KEYS;
/** Rain overlay: blend 40% toward this, desaturate 30%, thicker mist, cooler. */
export const RAIN_TINT = '#9AA6B8';

// ---------- color math (pure, no Phaser) ----------
export type RGB = { r: number; g: number; b: number };

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}
/** Hex string -> 0xRRGGBB number for Phaser tints. */
export function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}
export function intToHex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`.toUpperCase();
}
/** Linear mix of two hex colors, t in [0,1]. */
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex({ r: A.r + (B.r - A.r) * k, g: A.g + (B.g - A.g) * k, b: A.b + (B.b - A.b) * k });
}
/** rgba() string with alpha. */
export function alpha(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}
export function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case R: h = (G - B) / d + (G < B ? 6 : 0); break;
      case G: h = (B - R) / d + 2; break;
      default: h = (R - G) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
}
export function hslToRgb(h: number, s: number, l: number): RGB {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return { r: hue2rgb(p, q, h + 1 / 3) * 255, g: hue2rgb(p, q, h) * 255, b: hue2rgb(p, q, h - 1 / 3) * 255 };
}
/** Darken (amt<0) or lighten (amt>0) by moving lightness; amt in [-1,1]. Keeps hue, so outlines stay a darker shade of the fill. */
export function shade(hex: string, amt: number): string {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  const nl = Math.max(0, Math.min(1, amt < 0 ? l * (1 + amt) : l + (1 - l) * amt));
  return rgbToHex(hslToRgb(h, s, nl));
}
/** Outline color for a fill: a darker shade of the same hue (never black). */
export function outline(hex: string, amt = 0.22): string {
  return shade(hex, -amt);
}
/** Reduce saturation by amt in [0,1]. */
export function desaturate(hex: string, amt: number): string {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb(h, s * (1 - amt), l));
}
/** HSB saturation in percent (for the <=40% accent rule). */
export function hsbSaturation(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b);
  if (max === 0) return 0;
  return Math.round(((max - Math.min(r, g, b)) / max) * 100);
}
