/**
 * keyboard: desktop extras (spec section 7). A/D or the arrow keys walk the hero while held (the Camp pointer flow
 * keeps working: a tap simply starts a newer walk); E or Space activates the nearest glowing interactable; J toggles
 * the Journal; B opens the Backpack; Esc closes the newest open overlay, bubble or the Journal, else opens the menu.
 * Installed from Camp create; uninstalls itself on Camp shutdown.
 */
import Phaser from 'phaser';
import type { CampScene } from '@/scenes/Camp';
import { SCENES } from '@/scenes/Boot';
import { setHero } from '@/state';
import { WORLD_WIDTH } from '@/world/layout';
import { closeTopOverlay } from '@/ui/Modal';
import { isDecorModeActive } from '@/systems/decorMode';

export const KEYBOARD = {
  left: ['A', 'LEFT'],
  right: ['D', 'RIGHT'],
  interact: ['E', 'SPACE'],
  journal: 'J',
  backpack: 'B',
  menu: 'ESC',
} as const;

type HudKeys = Phaser.Scene & { openJournal(): void; openBackpack(): void; openMenu(): void; bubbleOpen(): boolean; hideBubble(): void };
type JournalKeys = Phaser.Scene & { requestClose(): void };

export function installKeyboard(camp: CampScene): void {
  const kb = camp.input.keyboard;
  if (!kb) return;
  const K = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;
  const keys = (names: readonly string[]) => names.map((n) => kb.addKey(K[n], false));
  const left = keys(KEYBOARD.left), right = keys(KEYBOARD.right), interact = keys(KEYBOARD.interact);
  const journal = kb.addKey(K[KEYBOARD.journal], false), backpack = kb.addKey(K[KEYBOARD.backpack], false), menu = kb.addKey(K[KEYBOARD.menu], false);
  kb.addCapture([K.SPACE, K.LEFT, K.RIGHT]);

  let walkDir: -1 | 0 | 1 = 0;
  const hud = () => camp.hud() as HudKeys | null;
  const journalScene = (): JournalKeys | null => {
    const j = camp.scene.get(SCENES.journal) as JournalKeys | null;
    return j && j.scene.isActive() ? j : null;
  };
  /** World input is free: no journal, overlay, decor mode or scene exit in progress. */
  const worldFree = () => camp.input.enabled && camp.scene.isActive() && !journalScene() && !isDecorModeActive() && !camp.leavingCamp;

  const walk = (dir: -1 | 1) => {
    if (!worldFree()) return;
    walkDir = dir;
    camp.hideActions();
    camp.hooks.onInterrupt?.();
    void camp.walkHeroTo(dir > 0 ? WORLD_WIDTH : 0);
  };
  const stopWalk = (dir: -1 | 1) => {
    if (walkDir !== dir) return;
    const other = dir > 0 ? left : right;
    if (other.some((k) => k.isDown)) { walk(dir > 0 ? -1 : 1); return; }
    walkDir = 0;
    camp.hero.stop();
    setHero(camp.hero.x, camp.hero.facing);
  };
  const onDown = (ks: Phaser.Input.Keyboard.Key[], fn: () => void) => ks.forEach((k) => k.on('down', (_k: unknown, ev?: KeyboardEvent) => { if (!ev?.repeat) fn(); }));
  const onUp = (ks: Phaser.Input.Keyboard.Key[], fn: () => void) => ks.forEach((k) => k.on('up', fn));

  onDown(left, () => walk(-1));
  onDown(right, () => walk(1));
  onUp(left, () => stopWalk(-1));
  onUp(right, () => stopWalk(1));
  onDown(interact, () => {
    if (!worldFree() || walkDir !== 0) return;
    const i = camp.interactables.nearest(camp.hero.x, camp.hero.y);
    if (!i) return;
    camp.hideActions();
    camp.hooks.onInterrupt?.();
    void camp.interactables.activate(camp, i);
  });
  onDown([journal], () => {
    const j = journalScene();
    if (j) { j.requestClose(); return; }
    if (worldFree()) hud()?.openJournal();
  });
  onDown([backpack], () => { if (worldFree()) hud()?.openBackpack(); });
  onDown([menu], () => {
    const j = journalScene();
    if (j) { j.requestClose(); return; }
    if (closeTopOverlay()) return;
    const h = hud();
    if (!h) return;
    if (h.bubbleOpen()) { h.hideBubble(); return; }
    if (worldFree()) h.openMenu();
  });

  camp.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    [...left, ...right, ...interact, journal, backpack, menu].forEach((k) => kb.removeKey(k, true));
  });
}
