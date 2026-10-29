import Phaser from 'phaser';
import { DPR } from '@/config/layout';
import { PALETTE } from '@/config/palette';

export const FONT_UI = '"Baloo 2"';
export const FONT_HAND = '"Patrick Hand"';

export type TextOpts = {
  size?: number;
  color?: string;
  weight?: 400 | 600 | 700;
  hand?: boolean;
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  lineSpacing?: number;
  /** soft ink shadow (for text over scenery) */
  shadow?: boolean;
};

/** Large text accessibility multiplier (set from settings). */
let textScale = 1;
export function setTextScale(s: number): void {
  textScale = s;
}
export function getTextScale(): number {
  return textScale;
}

function style(o: TextOpts): Phaser.Types.GameObjects.Text.TextStyle {
  const size = Math.round((o.size ?? 18) * textScale);
  const st: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: o.hand ? FONT_HAND : FONT_UI,
    fontSize: `${size}px`,
    fontStyle: o.hand ? '400' : String(o.weight ?? 600),
    color: o.color ?? PALETTE.ink,
    align: o.align ?? 'left',
    lineSpacing: o.lineSpacing ?? Math.round(size * 0.15),
  };
  if (o.wrap) st.wordWrap = { width: o.wrap, useAdvancedWrap: true };
  if (o.shadow) {
    st.shadow = { offsetX: 0, offsetY: 2, color: 'rgba(74,66,80,0.35)', blur: 6, stroke: false, fill: true };
  }
  return st;
}

/** Every text in the game goes through here so it is crisp on Retina and uses the house fonts. */
export function text(scene: Phaser.Scene, x: number, y: number, content: string, o: TextOpts = {}): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, content, style(o));
  t.setResolution(DPR);
  return t;
}
export function makeText(scene: Phaser.Scene, x: number, y: number, content: string, o: TextOpts = {}): Phaser.GameObjects.Text {
  const t = scene.make.text({ x, y, text: content, style: style(o), add: false });
  t.setResolution(DPR);
  return t;
}
