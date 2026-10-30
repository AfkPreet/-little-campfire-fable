/** mystery.ts: the guardian in the water, 5 clues (spec section 5 "Mystery"). Journal texts are literal. */
import type { MysteryClue } from './types';
import { MYSTERY_RULES } from './world';

export const MYSTERY_CLUES: readonly MysteryClue[] = [
  {
    step: 1, id: 'glow', title: 'A glow on the water', trigger: 'first_night_outside',
    condition: 'First night: a faint glow drifts far out on the water for about 6 s while the hero is outside.',
    journal: 'A soft glow, far out on the water. The moon? It moved like it was breathing.',
    hint: 'Stay outside on your first night.',
  },
  {
    step: 2, id: 'scale', title: 'The Glimmering Scale', trigger: 'dawn_after_first_rainy_night',
    condition: 'The dawn after the first rainy night, a sparkle on the shore: the Glimmering Scale.',
    journal: 'A scale, warm to the touch. Too big for any fish I know.',
    hint: 'Look along the shore after a rainy night.',
  },
  {
    step: 3, id: 'legend', title: 'The legend', trigger: 'enter_shop_with_scale',
    condition: 'Entering the shop with the scale triggers the legend and a recipe card. The Bamboo Steamer and Moon Blossom spot unlock.',
    journal: 'The guardian rises on rainy nights for someone truly content. It\'s fond of Moonlight Dumplings.',
    hint: 'Someone at the shop might know more.',
  },
  {
    step: 4, id: 'dumplings', title: 'Moonlight Dumplings', trigger: 'cook_moonlight_dumplings',
    condition: 'Cook Moonlight Dumplings: steamer + Flour + Moon Blossom + Night Glowfin.',
    journal: 'Moonlight Dumplings. They glow a little.',
    hint: 'Follow the recipe card.',
  },
  {
    step: 5, id: 'guardian', title: 'The guardian', trigger: 'offering_on_rainy_glowing_night',
    condition: 'On a rainy night with Contentment glowing (70+), carry the dumplings to the dock and leave an offering.',
    journal: 'I met the guardian. I think it said thank you.',
    hint: 'Bring the dumplings to the dock on the right kind of night.',
  },
];

export const MYSTERY_STEPS = MYSTERY_CLUES.length;
/** The item picked up at clue 2 (a key item, never sold). */
export const GLIMMERING_SCALE_ID = 'glimmering_scale';
/** The guardian's gift at the finale. */
export const GUARDIAN_GIFT = 'guardian_lantern' as const;

export function mysteryClue(step: number): MysteryClue | undefined {
  return MYSTERY_CLUES.find((c) => c.step === step);
}

/** Steamer and Moon Blossom are unlocked once this many clues are found. */
export function mysteryUnlocksOpen(cluesFound: number): boolean {
  return cluesFound >= MYSTERY_RULES.unlockClue;
}

export interface FinaleContext {
  cluesFound: number;
  raining: boolean;
  night: boolean;
  contentment: number;
  hasDumplings: boolean;
}
/** Can the "Leave an offering" bubble appear? Clue 4 done, rainy night, glowing (70+), dumplings in hand. */
export function canOfferDumplings(ctx: FinaleContext): boolean {
  return ctx.cluesFound >= 4 && ctx.raining && ctx.night && ctx.contentment >= 70 && ctx.hasDumplings;
}
