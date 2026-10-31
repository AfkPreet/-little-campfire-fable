/**
 * decorSeats: the Little Bookshelf and the Hammock as interactables once placed (spec section 6). Read: the hero sits
 * by the shelf holding a tiny book; Nap: the hero sleeps in the hammock sling. Both set activity 'fireSit', the same
 * gain path fireFlow's Sit uses (clockRunner pays fireSitting at night). Standing up (any tap elsewhere) drops the book.
 */
import type { CampScene } from '@/scenes/Camp';
import { PALETTE, shade } from '@/config/palette';
import { makeImg, paintTexture, roundRectPath, type Ctx } from '@/art/pipeline';
import { STRINGS, type DecorId } from '@/data';
import { getState, subscribe } from '@/state';
import { LAYOUT } from '@/world/layout';
import { decorSitPoint } from '@/systems/decorMode';
import { squash } from '@/fx/juice';
import { audio } from '@/audio';

export const DECOR_SEATS = {
  radius: 40,
  hit: { w: 70, h: 70 },
  book: { key: 'decor-seat-book', w: 16, h: 12 },
  /** the hero sits this far below the hammock point so the sling holds the body */
  hammockDrop: 18,
} as const;

type Seat = { id: DecorId; label: () => string; act: (camp: CampScene, x: number, y: number) => void };

function paintBook(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = PALETTE.rose;
  roundRectPath(ctx, 1, 1, w - 2, h - 2, 3);
  ctx.fill();
  ctx.strokeStyle = shade(PALETTE.rose, -0.25);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = PALETTE.cream;
  roundRectPath(ctx, 3, 3, w - 6, h - 6, 2);
  ctx.fill();
  ctx.strokeStyle = shade(PALETTE.rose, -0.25);
  ctx.beginPath();
  ctx.moveTo(w / 2, 3);
  ctx.lineTo(w / 2, h - 3);
  ctx.stroke();
}

async function settle(camp: CampScene, x: number): Promise<boolean> {
  camp.hideActions();
  await camp.walkHeroTo(x);
  return Math.abs(camp.hero.x - x) <= 2;
}

const SEATS: Seat[] = [
  {
    id: 'bookshelf',
    label: () => STRINGS.decorSeats.read,
    act: async (camp, x) => {
      if (!(await settle(camp, x))) return;
      const hero = camp.hero;
      hero.setFacing(x < LAYOUT.fire.x ? 1 : -1);
      hero.setPose('sit');
      hero.setExpression('happy');
      hero.hold('dish');
      hero.heldSlot.add(makeImg(camp, 0, -3, DECOR_SEATS.book.key).setAngle(-10));
      camp.activity = 'fireSit';
      audio.sfx.play('pageFlip', { volume: 0.6 });
      camp.hooks.onStandUp = () => { hero.hold('none'); camp.hooks.onStandUp = undefined; };
    },
  },
  {
    id: 'hammock',
    label: () => STRINGS.decorSeats.nap,
    act: async (camp, x, y) => {
      if (!(await settle(camp, x))) return;
      const hero = camp.hero;
      hero.setFacing(x < LAYOUT.fire.x ? 1 : -1);
      camp.heroLift = y + DECOR_SEATS.hammockDrop - camp.groundAt(x);
      hero.setPose('sleep');
      squash(camp, hero, 0.1, 260);
      camp.activity = 'fireSit';
      audio.sfx.play('sleep', { volume: 0.5 });
      camp.hooks.onStandUp = () => { camp.heroLift = 0; camp.hooks.onStandUp = undefined; };
    },
  },
];

/** Install on Camp create (after decor mode). Registers/unregisters the seat interactables as decor is placed or stored. */
export function installDecorSeats(camp: CampScene): void {
  paintTexture(camp, DECOR_SEATS.book.key, DECOR_SEATS.book.w, DECOR_SEATS.book.h, paintBook);
  const live = new Set<DecorId>();
  const sync = (): void => {
    for (const seat of SEATS) {
      const p = decorSitPoint(seat.id);
      const key = `seat_${seat.id}`;
      if (p && !live.has(seat.id)) {
        live.add(seat.id);
        camp.registerInteractable({
          id: key, x: p.x, y: p.y, radius: DECOR_SEATS.radius, hit: DECOR_SEATS.hit,
          labelFor: () => seat.label(),
          actionsFor: () => [{ label: seat.label(), onPick: () => void seat.act(camp, p.x, p.y) }],
        });
      } else if (!p && live.has(seat.id)) {
        live.delete(seat.id);
        camp.unregisterInteractable(key);
      } else if (p) camp.interactables.moveTo(key, p.x, p.y);
    }
  };
  // decor spawns from state on the next tick; follow placement changes (placedDecor is part of camp state)
  const off = subscribe(() => camp.time.delayedCall(0, sync));
  camp.events.once('ready', sync);
  camp.events.on('dawn', sync);
  camp.events.once('shutdown', () => { off(); camp.events.off('dawn', sync); });
  void getState;
}
