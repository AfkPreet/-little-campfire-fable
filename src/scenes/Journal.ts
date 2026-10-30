/**
 * Journal: the full-screen notebook overlay. Opens on the cover ("{Hero}'s Journal", "{n} / 36 stamps", badges);
 * a tap opens it to the last tab. Paper tabs on the right edge switch tabs; arrows or a horizontal swipe turn pages
 * within a tab (a slide flip + 'pageFlip'). Close (top-left, 44 px) emits 'journal:closed' on the Camp scene when it
 * runs and stops this scene; the HUD pauses/resumes the Camp clock around it.
 *
 *   scene.launch(SCENES.journal, { tab?: JournalTab })
 * Standalone: ?scene=journal&state=midtrip&tab=fish (the cover is skipped when a tab is given, for screenshots).
 */
import Phaser from 'phaser';
import { SCENES } from '@/scenes/Boot';
import { DEBUG } from '@/config/debug';
import { applyViewport, viewport, type Viewport } from '@/config/layout';
import { PALETTE, hexToInt, mix } from '@/config/palette';
import { makeImg } from '@/art/pipeline';
import { BOOK, JOURNAL_TABS, JOURNAL_TEX, paintJournalTextures, tabTexKey, type JournalTab } from '@/art/journal';
import { Button, TEX, UI, makeText, ensureUiTextures } from '@/ui';
import { buildJournalPage, pageCount } from '@/ui/JournalPages';
import { isReduceMotion, squash } from '@/fx/juice';
import { audio } from '@/audio';
import { STRINGS, fill } from '@/data';
import { getState, initStore, update, stampCount, checkBadges, STAMP_TOTAL, type BadgeId, type DebugStateKind, type GameState } from '@/state';

export type JournalLaunchData = { tab?: JournalTab };
export const JOURNAL_EVENTS = { closed: 'journal:closed' } as const;

const L = {
  dim: 0.55,
  depth: { backdrop: 0, book: 10, ui: 20 },
  /** book center sits a touch below the middle so the Close button has room */
  bookDy: 8,
  margin: 16,
  /** writing area inside the page */
  inset: { left: 24, right: 28, top: 20, bottom: 22 },
  headerH: 56,
  titleSize: 32,
  counterSize: 18,
  coverTitleSize: 44,
  coverStampsSize: 24,
  coverHintSize: 20,
  tabLabelSize: 17,
  flipOutMs: 140,
  flipInMs: 280,
  flipDx: 60,
  openMs: 360,
  closeMs: 180,
  swipePx: 50,
  readyMs: 500,
  badgeGap: 100,
  pulseMs: 2200,
} as const;

/** Remembered across opens within a session. */
let lastTab: JournalTab = 'fish';

export class JournalScene extends Phaser.Scene {
  private launchData: JournalLaunchData = {};
  private backdrop!: Phaser.GameObjects.Rectangle;
  private book!: Phaser.GameObjects.Container;
  private cover!: Phaser.GameObjects.Container;
  private pages!: Phaser.GameObjects.Container;
  private tabs: Partial<Record<JournalTab, Phaser.GameObjects.Container>> = {};
  private pageRoot: Phaser.GameObjects.Container | null = null;
  private titleText!: Phaser.GameObjects.Text;
  private counterText!: Phaser.GameObjects.Text;
  private prevBtn!: Button;
  private nextBtn!: Button;
  private closeBtn!: Button;
  private tab: JournalTab = 'fish';
  private page = 0;
  private opened = false;
  private closing = false;
  private flipping = false;

  constructor() {
    super(SCENES.journal);
  }

  init(data?: JournalLaunchData): void {
    this.launchData = data ?? {};
  }

  create(): void {
    ensureStore();
    applyViewport(this);
    ensureUiTextures(this);
    paintJournalTextures(this);
    const v = viewport();

    this.backdrop = this.add.rectangle(v.w / 2, v.h / 2, v.w * 4, v.h * 4, hexToInt(PALETTE.ink), L.dim).setDepth(L.depth.backdrop).setInteractive();
    this.book = this.add.container(v.w / 2, v.h / 2 + L.bookDy).setDepth(L.depth.book);
    this.cover = this.make.container({ x: 0, y: 0, add: false });
    this.pages = this.make.container({ x: 0, y: 0, add: false }).setVisible(false);
    this.book.add([this.pages, this.cover]);

    this.closeBtn = new Button(this, 0, 0, '', () => this.close(), { kind: 'icon', icon: TEX.close }).setDepth(L.depth.ui);

    const requested = parseTab(this.launchData.tab ?? DEBUG.tab);
    this.tab = requested ?? lastTab;
    this.buildCover();
    this.buildBook();
    this.layout(v);

    // swipe to turn pages; a tap on the cover opens the book
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.game.events.on('viewport', this.onViewport);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('viewport', this.onViewport);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    });

    if (requested) this.openBook(false);
    else if (!isReduceMotion()) {
      const base = this.book.getData('baseScale') as number;
      this.book.setScale(base * 0.9).setAlpha(0);
      this.tweens.add({ targets: this.book, scale: base, alpha: 1, duration: L.openMs, ease: 'Back.easeOut' });
    }
    this.time.delayedCall(L.readyMs, () => { window.__game.ready = true; });
  }

  // ---------- cover ----------
  private buildCover(): void {
    const s = getState();
    update((st) => { checkBadges(st); }, 'journal');
    const badges = s.journal.badges;
    const cover = makeImg(this, 0, 0, JOURNAL_TEX.cover);
    this.cover.add(cover);
    const ribbon = makeImg(this, BOOK.w / 2 - 70, BOOK.h / 2 - 2, JOURNAL_TEX.ribbon).setOrigin(0.5, 1);
    this.cover.add(ribbon);
    const cx = BOOK.spineW / 2; // label patch is centered on the page area (right of the spine)
    const labelY = -BOOK.h / 2 + BOOK.h * 0.36;
    this.cover.add(makeText(this, cx, labelY - 20, fill(STRINGS.journal.cover), { size: L.coverTitleSize, hand: true, align: 'center', color: PALETTE.ink }).setOrigin(0.5).setAngle(-1.2));
    this.cover.add(makeText(this, cx, labelY + 28, fill(STRINGS.journal.stamps, { n: stampCount(s), total: STAMP_TOTAL }), { size: L.coverStampsSize, weight: 600, align: 'center', color: mix(PALETTE.ink, PALETTE.cream, 0.2) }).setOrigin(0.5).setAngle(-1.2));
    // badges: earned ones in full, the rest as faint silhouettes
    const all: BadgeId[] = ['happy_camper', 'guardian_friend'];
    const bx0 = cx - ((all.length - 1) * L.badgeGap) / 2;
    const by = labelY + 150;
    all.forEach((id, i) => {
      const key = id === 'happy_camper' ? JOURNAL_TEX.badgeHappy : JOURNAL_TEX.badgeGuardian;
      const earned = badges.includes(id);
      const im = makeImg(this, bx0 + i * L.badgeGap, by, key);
      if (!earned) im.setTintFill(hexToInt(PALETTE.ink)).setAlpha(0.18);
      this.cover.add(im);
      this.cover.add(makeText(this, bx0 + i * L.badgeGap, by + BOOK.badge / 2 + 8, STRINGS.badges[id], { size: 16, weight: 600, align: 'center', color: earned ? PALETTE.ink : mix(PALETTE.ink, PALETTE.cream, 0.45) }).setOrigin(0.5, 0));
    });
    const hint = makeText(this, cx, BOOK.h / 2 - 44, STRINGS.journalExtras.tapToOpen, { size: L.coverHintSize, hand: true, align: 'center', color: mix(PALETTE.ink, PALETTE.cream, 0.3) }).setOrigin(0.5);
    this.cover.add(hint);
    if (!isReduceMotion()) this.tweens.add({ targets: hint, alpha: 0.45, duration: L.pulseMs / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.book.setData('baseScale', 1);
  }

  // ---------- open book ----------
  private buildBook(): void {
    this.pages.add(makeImg(this, 0, 0, JOURNAL_TEX.page));
    // tabs along the right edge, from the top
    const x0 = BOOK.w / 2 - BOOK.tab.pullOut;
    const y0 = -BOOK.h / 2 + BOOK.tab.topInset + BOOK.tab.h / 2;
    JOURNAL_TABS.forEach((t, i) => {
      const c = this.make.container({ x: x0, y: y0 + i * (BOOK.tab.h + BOOK.tab.gap), add: false });
      const im = makeImg(this, (BOOK.tab.w + 12) / 2 - 2, 0, tabTexKey(t));
      const label = makeText(this, BOOK.tab.w / 2 + 2, 0, STRINGS.journal.tabs[t], { size: L.tabLabelSize, weight: 700, align: 'center', color: PALETTE.ink }).setOrigin(0.5).setAngle(90);
      c.add([im, label]);
      c.setData('baseScale', 1).setData('baseX', x0);
      c.setSize(BOOK.tab.w + 12, BOOK.tab.h + 16);
      c.setInteractive(new Phaser.Geom.Rectangle(0, -(BOOK.tab.h + 16) / 2, BOOK.tab.w + 12, BOOK.tab.h + 16), Phaser.Geom.Rectangle.Contains);
      c.on(Phaser.Input.Events.POINTER_UP, () => this.selectTab(t));
      this.tabs[t] = c;
      this.pages.add(c);
    });
    const box = this.writingBox();
    this.titleText = makeText(this, box.x, box.y + L.headerH / 2 - 4, '', { size: L.titleSize, hand: true, color: PALETTE.ink }).setOrigin(0, 0.5);
    this.counterText = makeText(this, box.x + box.w - UI.iconButton * 2 - UI.gap * 3 - 10, box.y + L.headerH / 2 - 4, '', { size: L.counterSize, weight: 600, align: 'right', color: mix(PALETTE.ink, PALETTE.cream, 0.3) }).setOrigin(1, 0.5);
    this.nextBtn = new Button(this, box.x + box.w - UI.iconButton / 2, box.y + L.headerH / 2 - 4, '', () => this.turn(1), { kind: 'icon', icon: JOURNAL_TEX.arrow, width: UI.minTouch });
    this.prevBtn = new Button(this, box.x + box.w - UI.iconButton * 1.5 - UI.gap, box.y + L.headerH / 2 - 4, '', () => this.turn(-1), { kind: 'icon', icon: JOURNAL_TEX.arrow, width: UI.minTouch });
    this.prevBtn.setScale(-1, 1).setData('baseScale', 1);
    this.pages.add([this.titleText, this.counterText, this.prevBtn, this.nextBtn]);
  }

  /** Writing area in book-local coordinates (top-left + size). */
  private writingBox(): { x: number; y: number; w: number; h: number } {
    const x = -BOOK.w / 2 + BOOK.spineW + L.inset.left;
    const y = -BOOK.h / 2 + L.inset.top;
    return { x, y, w: BOOK.w - BOOK.spineW - L.inset.left - L.inset.right, h: BOOK.h - L.inset.top - L.inset.bottom };
  }

  private openBook(animate: boolean): void {
    if (this.opened) return;
    this.opened = true;
    lastTab = this.tab;
    this.pages.setVisible(true);
    this.page = 0;
    this.showPage(false);
    const done = () => { this.cover.setVisible(false); };
    if (!animate || isReduceMotion()) {
      done();
      return;
    }
    audio.sfx.play('pageFlip');
    // the cover swings away to the left and the first page settles
    this.tweens.add({ targets: this.cover, x: -BOOK.w * 0.55, alpha: 0, scaleX: 0.3, duration: L.openMs, ease: 'Sine.easeIn', onComplete: done });
    this.pages.setAlpha(0.6);
    this.tweens.add({ targets: this.pages, alpha: 1, duration: L.openMs, ease: 'Sine.easeOut' });
  }

  private selectTab(t: JournalTab): void {
    if (this.flipping) return;
    if (t === this.tab) {
      squash(this, this.tabs[t]!, 0.08);
      return;
    }
    this.tab = t;
    lastTab = t;
    this.page = 0;
    squash(this, this.tabs[t]!, 0.1);
    this.showPage(true, 1);
  }

  private turn(dir: 1 | -1): void {
    if (this.flipping || !this.opened) return;
    const n = pageCount(this.tab, getState());
    const next = this.page + dir;
    if (next < 0 || next >= n) {
      audio.sfx.play('nope');
      return;
    }
    this.page = next;
    this.showPage(true, dir);
  }

  /** Lay out the tabs (selected pulled out), header and the page content; flips the page when `animate`. */
  private showPage(animate: boolean, dir: 1 | -1 = 1): void {
    const s: GameState = getState();
    const n = pageCount(this.tab, s);
    const box = this.writingBox();
    for (const t of JOURNAL_TABS) {
      const c = this.tabs[t]!;
      const baseX = c.getData('baseX') as number;
      const x = t === this.tab ? baseX + BOOK.tab.pullOut : baseX;
      if (animate && !isReduceMotion()) this.tweens.add({ targets: c, x, duration: 160, ease: 'Sine.easeOut' });
      else c.setX(x);
      c.setAlpha(t === this.tab ? 1 : 0.85);
    }
    this.titleText.setText(STRINGS.journal.tabs[this.tab]);
    this.counterText.setText(fill(STRINGS.journalExtras.pageOf, { i: this.page + 1, n }));
    this.prevBtn.setEnabled(this.page > 0);
    this.nextBtn.setEnabled(this.page < n - 1);

    const content = buildJournalPage(this, this.tab, this.page, s, { w: box.w, h: box.h - L.headerH });
    content.setPosition(box.x, box.y + L.headerH);
    const old = this.pageRoot;
    this.pageRoot = content;
    this.pages.addAt(content, 1); // above the paper, under the tabs and header

    if (!animate || isReduceMotion()) {
      old?.destroy();
      return;
    }
    this.flipping = true;
    audio.sfx.play('pageFlip');
    if (old) {
      this.tweens.add({ targets: old, x: box.x - L.flipDx * dir, alpha: 0, duration: L.flipOutMs, ease: 'Sine.easeIn', onComplete: () => old.destroy() });
    }
    content.setX(box.x + L.flipDx * dir).setAlpha(0);
    this.tweens.add({ targets: content, x: box.x, alpha: 1, duration: L.flipInMs, ease: 'Back.easeOut', onComplete: () => { this.flipping = false; } });
  }

  // ---------- input ----------
  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.closing) return;
    const hits = this.input.hitTestPointer(pointer);
    const onUi = hits.some((o) => o !== this.backdrop);
    if (!this.opened) {
      if (!onUi && pointer.getDistance() < L.swipePx) this.openBook(true);
      return;
    }
    const dx = pointer.upX - pointer.downX, dy = pointer.upY - pointer.downY;
    if (Math.abs(dx) >= L.swipePx && Math.abs(dx) > Math.abs(dy) * 1.5) this.turn(dx < 0 ? 1 : -1);
  }

  private readonly onViewport = (): void => {
    applyViewport(this);
    this.layout(viewport());
  };

  private layout(v: Viewport): void {
    this.backdrop.setPosition(v.w / 2, v.h / 2);
    // shrink the book a little on narrow viewports so the tabs stay inside the frame
    const need = BOOK.w + (BOOK.tab.w + BOOK.tab.pullOut) * 2 + L.margin * 2;
    const k = Math.min(1, v.w / need, (v.h - L.margin * 2) / (BOOK.h + 28));
    this.book.setPosition(v.w / 2, v.h / 2 + L.bookDy).setScale(k).setData('baseScale', k);
    this.closeBtn.setPosition(v.safe.left + L.margin + UI.iconButton / 2, v.safe.top + L.margin + UI.iconButton / 2);
  }

  // ---------- leaving ----------
  private close(): void {
    if (this.closing) return;
    this.closing = true;
    audio.sfx.play('tok');
    const done = () => {
      const camp = this.scene.get(SCENES.camp);
      if (camp && camp.scene.isActive()) camp.events.emit(JOURNAL_EVENTS.closed);
      this.scene.stop();
    };
    if (isReduceMotion()) {
      done();
      return;
    }
    const base = this.book.getData('baseScale') as number;
    this.tweens.add({ targets: this.book, alpha: 0, scale: base * 0.92, duration: L.closeMs, ease: 'Sine.easeIn' });
    this.tweens.add({ targets: this.backdrop, fillAlpha: 0, duration: L.closeMs, onComplete: done });
  }
}

function parseTab(raw?: string): JournalTab | undefined {
  const t = (raw ?? '').toLowerCase();
  return (JOURNAL_TABS as readonly string[]).includes(t) ? (t as JournalTab) : undefined;
}

/** Boot owns initStore(); this guard only covers a direct ?scene=journal start before Boot does it. */
function ensureStore(): void {
  let ok = false;
  try {
    ok = !!getState()?.journal;
  } catch {
    ok = false;
  }
  if (!ok) {
    const kind = (DEBUG.state ?? 'midtrip') as DebugStateKind;
    initStore({ debug: kind, seed: DEBUG.seed, day: DEBUG.day });
  }
}
