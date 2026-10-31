/**
 * Album: the Trip Album scrapbook that opens after sleeping on Night 7 (and again from the Journal's Trip tab).
 * Cover ("{Title}: Trip {n}") -> one page per day (polaroids) -> the companion's page -> the mystery page (map) ->
 * the postcard (Mallige Falls) with "Stay a little longer" (back to Camp, free play) and "Start a new trip"
 * (confirm -> startNewTrip() -> Intro). Arrows or a swipe turn pages with a 'pageFlip';
 * Close (44 px) returns to Camp.
 *
 *   scene.start(SCENES.album)
 * Standalone: ?scene=album&state=midtrip[&page=last|<n>]. Camp and HUD are stopped if they still run.
 */
import Phaser from 'phaser';
import { SCENES } from '@/scenes/Boot';
import { DEBUG } from '@/config/debug';
import { applyViewport, viewport, type Viewport } from '@/config/layout';
import { PALETTE, hexToInt, mix } from '@/config/palette';
import { makeImg } from '@/art/pipeline';
import { ALBUM, ALBUM_TEX, paintAlbumTextures } from '@/art/album';
import { JOURNAL_TEX, paintJournalTextures } from '@/art/journal';
import { Button, TEX, UI, makeText, ensureUiTextures } from '@/ui';
import { POSTCARD_PAGE, albumPages, buildAlbumPage, type AlbumPage } from '@/ui/AlbumPages';
import { confirmNewTrip } from '@/ui/SettingsOverlay';
import { isReduceMotion, squash } from '@/fx/juice';
import { audio } from '@/audio';
import { STRINGS, fill } from '@/data';
import { getState, initStore, type DebugStateKind, type GameState } from '@/state';

const L = {
  depth: { back: 0, book: 10, ui: 20 },
  margin: 16,
  inset: { left: 64, right: 28, top: 20, bottom: 22 },
  headerH: 56,
  counterSize: 18,
  coverTitleSize: 44,
  coverSubSize: 22,
  coverHintSize: 20,
  flipOutMs: 140,
  flipInMs: 280,
  flipDx: 60,
  openMs: 360,
  closeMs: 180,
  swipePx: 50,
  readyMs: 500,
  pulseMs: 2200,
} as const;

export class AlbumScene extends Phaser.Scene {
  private back!: Phaser.GameObjects.Rectangle;
  private book!: Phaser.GameObjects.Container;
  private cover!: Phaser.GameObjects.Container;
  private pages!: Phaser.GameObjects.Container;
  private pageRoot: Phaser.GameObjects.Container | null = null;
  private counterText!: Phaser.GameObjects.Text;
  private prevBtn!: Button;
  private nextBtn!: Button;
  private closeBtn!: Button;
  private list: AlbumPage[] = [];
  private page = 0;
  private flipping = false;
  private leaving = false;

  constructor() {
    super(SCENES.album);
  }

  create(): void {
    ensureStore();
    // the album replaces Camp: nothing from the camp HUD should stay on screen
    if (this.scene.isActive(SCENES.hud)) this.scene.stop(SCENES.hud);
    if (this.scene.isActive(SCENES.camp)) this.scene.stop(SCENES.camp);
    applyViewport(this);
    ensureUiTextures(this);
    paintAlbumTextures(this);
    paintJournalTextures(this);
    const v = viewport();
    const s = getState();
    this.list = albumPages(s);

    this.back = this.add.rectangle(v.w / 2, v.h / 2, v.w * 4, v.h * 4, hexToInt(mix(PALETTE.ink, PALETTE.lavender, 0.25)), 1).setDepth(L.depth.back).setInteractive();
    this.book = this.add.container(v.w / 2, v.h / 2).setDepth(L.depth.book);
    this.cover = this.make.container({ x: 0, y: 0, add: false });
    this.pages = this.make.container({ x: 0, y: 0, add: false }).setVisible(false);
    this.book.add([this.pages, this.cover]);
    this.book.setData('baseScale', 1);

    this.closeBtn = new Button(this, 0, 0, '', () => this.close(), { kind: 'icon', icon: TEX.close }).setDepth(L.depth.ui);
    this.buildCover(s);
    this.buildBook();
    this.layout(v);

    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.game.events.on('viewport', this.onViewport);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('viewport', this.onViewport);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    });

    const start = parsePage(DEBUG.page, this.list.length);
    if (start > 0) {
      this.page = start;
      this.showPage(false);
    } else if (!isReduceMotion()) {
      this.book.setScale(0.9).setAlpha(0);
      this.tweens.add({ targets: this.book, scale: 1, alpha: 1, duration: L.openMs, ease: 'Back.easeOut' });
    }
    this.time.delayedCall(L.readyMs, () => { window.__game.ready = true; });
  }

  // ---------- cover ----------
  private buildCover(s: GameState): void {
    this.cover.add(makeImg(this, 0, 0, ALBUM_TEX.cover));
    const cx = 0; // the label patch is centered, left of the jute tie
    const cy = -ALBUM.h * 0.08;
    this.cover.add(makeText(this, cx, cy - 18, fill(STRINGS.album.cover, { n: s.trip }), { size: L.coverTitleSize, hand: true, align: 'center', color: PALETTE.ink }).setOrigin(0.5).setAngle(-1.4));
    this.cover.add(makeText(this, cx, cy + 30, fill(STRINGS.albumExtras.subtitle), { size: L.coverSubSize, hand: true, align: 'center', color: mix(PALETTE.ink, PALETTE.cream, 0.25) }).setOrigin(0.5).setAngle(-1.4));
    const hint = makeText(this, cx, ALBUM.h / 2 - 48, STRINGS.albumExtras.tapToOpen, { size: L.coverHintSize, hand: true, align: 'center', color: mix(PALETTE.cream, PALETTE.ink, 0.15) }).setOrigin(0.5);
    this.cover.add(hint);
    if (!isReduceMotion()) this.tweens.add({ targets: hint, alpha: 0.45, duration: L.pulseMs / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ---------- pages ----------
  private buildBook(): void {
    this.pages.add(makeImg(this, 0, 0, ALBUM_TEX.page));
    const box = this.writingBox();
    const hy = box.y + L.headerH / 2 - 4;
    this.counterText = makeText(this, box.x + box.w - UI.iconButton * 2 - UI.gap * 3 - 10, hy, '', { size: L.counterSize, weight: 600, align: 'right', color: mix(PALETTE.ink, PALETTE.cream, 0.3) }).setOrigin(1, 0.5);
    this.nextBtn = new Button(this, box.x + box.w - UI.iconButton / 2, hy, STRINGS.albumExtras.next, () => this.turn(1), { kind: 'icon', icon: JOURNAL_TEX.arrow, width: UI.minTouch });
    this.prevBtn = new Button(this, box.x + box.w - UI.iconButton * 1.5 - UI.gap, hy, STRINGS.albumExtras.prev, () => this.turn(-1), { kind: 'icon', icon: JOURNAL_TEX.arrow, width: UI.minTouch });
    this.prevBtn.setScale(-1, 1).setData('baseScale', 1);
    this.pages.add([this.counterText, this.prevBtn, this.nextBtn]);
  }

  /** Writing area in book-local coordinates (top-left + size), right of the ring binding. */
  private writingBox(): { x: number; y: number; w: number; h: number } {
    const x = -ALBUM.w / 2 + L.inset.left;
    const y = -ALBUM.h / 2 + L.inset.top;
    return { x, y, w: ALBUM.w - L.inset.left - L.inset.right, h: ALBUM.h - L.inset.top - L.inset.bottom };
  }

  private turn(dir: 1 | -1): void {
    if (this.flipping || this.leaving) return;
    const next = this.page + dir;
    if (next < 0 || next >= this.list.length) {
      audio.sfx.play('nope');
      return;
    }
    this.page = next;
    this.showPage(true, dir);
  }

  private showPage(animate: boolean, dir: 1 | -1 = 1): void {
    const s = getState();
    const n = this.list.length;
    const current = this.list[this.page];
    const onCover = current.kind === 'cover';
    const box = this.writingBox();
    this.counterText.setText(fill(STRINGS.albumExtras.pageOf, { i: this.page, n: n - 1 }));
    this.prevBtn.setEnabled(this.page > 1);
    this.nextBtn.setEnabled(this.page < n - 1);

    const wasOnCover = !this.pages.visible;
    if (onCover) {
      this.pages.setVisible(false);
      this.cover.setVisible(true).setAlpha(1).setX(0).setScale(1);
      this.pageRoot?.destroy();
      this.pageRoot = null;
      return;
    }
    this.pages.setVisible(true);
    const content = buildAlbumPage(this, current, s, { w: box.w, h: box.h - L.headerH });
    content.setPosition(box.x, box.y + L.headerH);
    if (current.kind === 'postcard') this.addEndButtons(content, { w: box.w, h: box.h - L.headerH });
    const old = this.pageRoot;
    this.pageRoot = content;
    this.pages.addAt(content, 1);

    if (!animate || isReduceMotion()) {
      old?.destroy();
      this.cover.setVisible(false);
      return;
    }
    audio.sfx.play('pageFlip');
    if (wasOnCover) {
      // the cover swings away to the left
      this.tweens.add({ targets: this.cover, x: -ALBUM.w * 0.55, alpha: 0, scaleX: 0.3, duration: L.openMs, ease: 'Sine.easeIn', onComplete: () => { this.cover.setVisible(false); } });
      this.pages.setAlpha(0.6);
      this.tweens.add({ targets: this.pages, alpha: 1, duration: L.openMs, ease: 'Sine.easeOut' });
    }
    this.flipping = true;
    if (old) this.tweens.add({ targets: old, x: box.x - L.flipDx * dir, alpha: 0, duration: L.flipOutMs, ease: 'Sine.easeIn', onComplete: () => old.destroy() });
    content.setX(box.x + L.flipDx * dir).setAlpha(0);
    this.tweens.add({ targets: content, x: box.x, alpha: 1, duration: L.flipInMs, ease: 'Back.easeOut', onComplete: () => { this.flipping = false; } });
  }

  private addEndButtons(root: Phaser.GameObjects.Container, box: { w: number; h: number }): void {
    const B = POSTCARD_PAGE.buttons;
    const bw = Math.min(B.w, box.w * 0.42);
    const x = box.w * B.x, y = box.h * B.y;
    const stay = new Button(this, x, y + UI.buttonH / 2, STRINGS.album.stayLonger, () => this.stay(), { kind: 'primary', width: bw });
    const fresh = new Button(this, x, y + UI.buttonH * 1.5 + UI.gap, STRINGS.album.newTrip, () => this.newTrip(), { kind: 'secondary', width: bw });
    root.add([stay, fresh]);
  }

  // ---------- input ----------
  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.leaving) return;
    const hits = this.input.hitTestPointer(pointer);
    if (hits.some((o) => o !== this.back)) return;
    const dx = pointer.upX - pointer.downX, dy = pointer.upY - pointer.downY;
    if (this.list[this.page].kind === 'cover') {
      if (pointer.getDistance() < L.swipePx) this.turn(1);
      return;
    }
    if (Math.abs(dx) >= L.swipePx && Math.abs(dx) > Math.abs(dy) * 1.5) this.turn(dx < 0 ? 1 : -1);
  }

  private readonly onViewport = (): void => {
    applyViewport(this);
    this.layout(viewport());
  };

  private layout(v: Viewport): void {
    this.back.setPosition(v.w / 2, v.h / 2);
    const k = Math.min(1, (v.w - L.margin * 2) / (ALBUM.w + 24), (v.h - L.margin * 2) / (ALBUM.h + 28));
    this.book.setPosition(v.w / 2, v.h / 2).setScale(k).setData('baseScale', k);
    this.closeBtn.setPosition(v.safe.left + L.margin + UI.iconButton / 2, v.safe.top + L.margin + UI.iconButton / 2);
  }

  // ---------- leaving ----------
  /** Close and "Stay a little longer": back to Camp, free play continues past Day 7. */
  private close(): void {
    this.stay();
  }

  private stay(): void {
    if (this.leaving) return;
    this.leaving = true;
    audio.sfx.play('tok');
    this.fadeOut(() => this.scene.start(SCENES.camp));
  }

  private newTrip(): void {
    if (this.leaving) return;
    squash(this, this.book, 0.03);
    confirmNewTrip(this, null, {
      onNewTrip: () => {
        this.leaving = true;
        this.fadeOut(() => this.scene.start(SCENES.intro));
      },
    });
  }

  private fadeOut(done: () => void): void {
    if (isReduceMotion()) {
      done();
      return;
    }
    const base = this.book.getData('baseScale') as number;
    this.tweens.add({ targets: this.book, alpha: 0, scale: base * 0.92, duration: L.closeMs, ease: 'Sine.easeIn', onComplete: done });
  }
}

function parsePage(raw: string | undefined, n: number): number {
  if (!raw) return 0;
  if (raw === 'last') return n - 1;
  const i = Number(raw);
  return Number.isFinite(i) ? Phaser.Math.Clamp(Math.floor(i), 0, n - 1) : 0;
}

/** Boot owns initStore(); this guard only covers a direct ?scene=album start before Boot does it. */
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
