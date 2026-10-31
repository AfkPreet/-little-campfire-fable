/**
 * SettingsOverlay: the shared Settings card (Title, HUD menu, Album). Sliders for Music / Sounds / Ambience write the
 * store and the audio buses; toggles for Reduce motion and Large text; "Start a new trip" and "Erase everything" with
 * their confirm modals; Close.
 *
 *   openSettings(scene, { onClose, onNewTrip, onErase })
 *
 * After a confirmed new trip or erase the overlay closes itself, then calls the matching callback (the caller decides
 * where to go: Title rebuilds, Camp/Album start the Intro).
 */
import Phaser from 'phaser';
import { viewport } from '@/config/layout';
import { applySettings, LARGE_TEXT_SCALE } from '@/scenes/Boot';
import { setReduceMotion } from '@/fx/juice';
import { audio } from '@/audio';
import { STRINGS } from '@/data';
import { startNewTrip, eraseEverything, updateSettings, getState } from '@/state';
import { Button } from './Button';
import { Slider, Toggle } from './controls';
import { MODAL, modal, overlay, type OverlayHandle } from './Modal';
import { UI } from './kit';
import { makeText, setTextScale } from './text';

export const SETTINGS_UI = {
  w: 420,
  h: 560,
  sliderW: 300,
  rowH: 66,
  toggleRowH: 52,
  /** space under the card title before the first row */
  topInset: 70,
  labelSize: 18,
  /** depth of the backdrop (card is one above); just under the confirm modals so they stack on top */
  depth: MODAL.depth - 10,
} as const;

export type SettingsOpts = {
  onClose?: () => void;
  /** after startNewTrip() ran and the overlay closed */
  onNewTrip?: () => void;
  /** after eraseEverything() ran and the overlay closed */
  onErase?: () => void;
  depth?: number;
};

export function openSettings(scene: Phaser.Scene, opts: SettingsOpts = {}): OverlayHandle {
  const s = getState().settings;
  const S = STRINGS.settings;
  const v = viewport();
  const w = Math.min(SETTINGS_UI.w, v.w - UI.pad * 2);
  const h = Math.min(SETTINGS_UI.h, v.h - UI.pad * 2);
  const handle: OverlayHandle = overlay(scene, {
    w, h, title: S.title,
    depth: opts.depth ?? SETTINGS_UI.depth,
    onClose: opts.onClose,
    build: (card) => {
      const c = card.content;
      const left = -w / 2 + UI.pad;
      const sliderW = Math.min(SETTINGS_UI.sliderW, w - UI.pad * 2);
      let y = -h / 2 + SETTINGS_UI.topInset;
      const addSlider = (label: string, value: number, onChange: (k: number) => void) => {
        c.add(new Slider(scene, 0, y, { label, width: sliderW, value, onChange }));
        y += SETTINGS_UI.rowH;
      };
      addSlider(S.music, s.music, (k) => { updateSettings({ music: k }); audio.engine.setVolumes({ music: k }); });
      addSlider(S.sounds, s.sounds, (k) => { updateSettings({ sounds: k }); audio.engine.setVolumes({ sfx: k }); audio.sfx.play('plip'); });
      addSlider(S.ambience, s.ambience, (k) => { updateSettings({ ambience: k }); audio.engine.setVolumes({ ambience: k }); });
      y += 4;
      const addToggle = (label: string, value: boolean, onChange: (b: boolean) => void) => {
        const t = new Toggle(scene, w / 2 - UI.pad - 32, y, { value, onChange });
        c.add([makeText(scene, left, y, label, { size: SETTINGS_UI.labelSize, weight: 600 }).setOrigin(0, 0.5), t]);
        y += SETTINGS_UI.toggleRowH;
      };
      addToggle(S.reduceMotion, s.reduceMotion, (b) => { updateSettings({ reduceMotion: b }); setReduceMotion(b); });
      addToggle(S.largeText, s.largeText, (b) => { updateSettings({ largeText: b }); setTextScale(b ? LARGE_TEXT_SCALE : 1); });
      y += 10;
      const bw = w - UI.pad * 2;
      c.add(new Button(scene, 0, y + UI.buttonH / 2, S.newTrip, () => confirmNewTrip(scene, handle, opts), { kind: 'secondary', width: bw }));
      y += UI.buttonH + UI.gap;
      c.add(new Button(scene, 0, y + UI.buttonH / 2, S.erase, () => confirmErase(scene, handle, opts), { kind: 'secondary', width: bw }));
      y += UI.buttonH + UI.gap;
      c.add(new Button(scene, 0, y + UI.buttonH / 2, S.cancel, () => handle.close(), { kind: 'primary', width: bw }));
    },
  });
  return handle;
}

/** "Start over? Your gear and camp reset; your journal stays." Resolves true when the trip was restarted. */
export function confirmNewTrip(scene: Phaser.Scene, parent: OverlayHandle | null, opts: SettingsOpts = {}): OverlayHandle {
  const S = STRINGS.settings;
  return modal(scene, {
    title: S.newTrip, body: S.newTripConfirm, dim: 0.2,
    buttons: [
      { label: S.keepCamping, kind: 'secondary' },
      { label: S.startOver, kind: 'primary', onPick: () => { startNewTrip(); applySettings(); parent?.close(); opts.onNewTrip?.(); } },
    ],
  });
}

export function confirmErase(scene: Phaser.Scene, parent: OverlayHandle | null, opts: SettingsOpts = {}): OverlayHandle {
  const S = STRINGS.settings;
  return modal(scene, {
    title: S.erase, body: S.eraseConfirm, dim: 0.2,
    buttons: [
      { label: S.cancel, kind: 'secondary' },
      { label: S.eraseConfirmButton, kind: 'primary', onPick: () => { eraseEverything(); applySettings(); parent?.close(); opts.onErase?.(); } },
    ],
  });
}
