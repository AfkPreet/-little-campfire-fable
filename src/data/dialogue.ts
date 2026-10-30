/**
 * dialogue.ts: every literal UI string (spec section 7), grouped by screen. Scenes never hold strings; they read
 * STRINGS.<screen>.<key> and fill placeholders with fill(template, vars). World names ({Title}, {Hero}, {Shopkeeper},
 * {Companion}, {Guardian}, {Water}, {Place}, {NextCampsite}, {Currency}, {CurrencySymbol}, {Version}) come from
 * worldVars() automatically; per-use values ({n}, {Fish}, {size}, {Dish}, {Moment}, {total}) are passed in.
 */
import type { ContentmentTier, DayPhase, MomentId, ShopTab } from './types';
import { worldVars } from './world';

/** Replace {Key} placeholders from `vars`, then from the world names. Unknown keys are left as written. */
export function fill(template: string, vars: Record<string, string | number> = {}): string {
  const world = worldVars();
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    if (key in vars) return String(vars[key]);
    if (key in world) return world[key];
    return whole;
  });
}

export const STRINGS = {
  portrait: {
    turnSideways: 'Turn your device sideways',
  },

  hud: {
    dayLabel: 'Day {n} · {Phase}',
    timeLabels: {
      dawn: 'Dawn',
      morning: 'Morning',
      afternoon: 'Afternoon',
      golden: 'Golden hour',
      dusk: 'Dusk',
      night: 'Night',
    } as Record<DayPhase, string>,
    contentment: {
      cozy: 'Feeling cozy',
      content: 'Feeling content',
      glowing: 'Glowing',
      blissful: 'Blissful',
    } as Record<ContentmentTier, string>,
    backpack: 'Backpack',
    journal: 'Journal',
  },

  bubbles: {
    fish: 'Fish',
    forage: 'Forage',
    cook: 'Cook',
    sit: 'Sit',
    rest: 'Rest',
    sleep: 'Sleep',
    decorate: 'Decorate',
    share: 'Share',
    leaveOffering: 'Leave an offering',
  },

  toasts: {
    caught: 'Caught a {Fish}! ({size} cm)',
    newRecipe: 'New recipe: {Dish}!',
    journalUpdated: 'Journal updated',
    slippedAway: 'It slipped away... maybe next time!',
  },

  title: {
    logo: '{Title}',
    subtitle: '{Subtitle}',
    begin: 'Begin your trip',
    continue: 'Continue',
    settings: 'Settings',
    footer: 'Best with sound on · {Version}',
  },

  intro: {
    pages: [
      '{Hero} has been saving up for a little camping trip.',
      'Seven days. A quiet place by the water. Nothing to do but be cozy.',
      'First, a stop at the shop...',
    ],
    skip: 'Skip',
  },

  shop: {
    header: "{Shopkeeper}'s General Store",
    tabs: {
      camp: 'Camp',
      fishing: 'Fishing',
      kitchen: 'Kitchen',
      pantry: 'Pantry',
      cozy: 'Cozy',
      sell: 'Sell',
    } as Record<ShopTab, string>,
    buy: 'Buy',
    owned: 'Owned',
    sell: 'Sell',
    tooPricey: 'Saving up for that one?',
    day1: "First trip? You'll want a tent, a rod and something to cook in.",
    leavingWithoutEssentials: "Sure you're ready?",
    backToShopping: 'Back to shopping',
    headOutAnyway: 'Head out anyway',
    exit: 'Head to camp',
    /** Doddamma's small talk on entering (ART_BIBLE section 5). */
    greetings: [
      'Come in, come in, putta. The mist will lift by the time your kaapi cools.',
      'First trip? Tent, rod, something to cook in. The rest is just nice to have.',
      'Rain tonight, if my knees are right. Mushrooms come up double after rain.',
      "Jamun stains purple. Pick them before lunch and wash your paws, that's all I'll say.",
      'The murrels wake at dusk. Cast when the water turns pink.',
      'Estate honey. Good in kaapi, better in payasa, best straight off the spoon.',
      "Fireflies like the jamun tree. Sit still by the fire and they'll come to you.",
      "A cane rod bends but doesn't break. Like a good auntie.",
      'Cooked food fetches more than raw. Even a plain meen fry is a kind of magic.',
      'Sleep when you like, putta. Manjukere keeps its own time.',
    ] as string[],
  },

  /** Mystery clue 3: three shopkeeper lines. */
  legend: [
    'Oh my. Where did you find this scale?',
    'Old campers say a gentle guardian lives in the {Water}. It rises on rainy nights, for someone truly content.',
    'And they say she loves Moonlight Kadubu. Here, take my old recipe card.',
  ] as string[],

  camp: {
    pickSpot: 'Pick a cozy spot for your tent',
    tapPegs: 'Tap the pegs!',
    homeSweetHome: 'Home sweet home!',
    decorMode: 'Drag to decorate. Tap an item to move or store it.',
    sleepPrompt: 'Turn in for the night?',
    sleep: 'Sleep',
    stayUp: 'Stay up a bit',
  },

  /** Camp shell (M1 Camp scene): strings the spec implies but does not word. */
  campShell: {
    needTent: "You'll need a tent for that. {Shopkeeper}'s shop has one!",
  },

  summary: {
    title: 'Day {n} done',
    caughtFish: 'Caught {n} fish',
    caughtOneFish: 'Caught 1 fish',
    cookedNew: 'Cooked {Dish} (new!)',
    cooked: 'Cooked {Dish}',
    moment: 'Moment: {Moment}',
    sweetDreams: 'Sweet dreams...',
  },

  fishing: {
    keep: 'Keep',
    letGo: 'Let go',
    newRibbon: 'NEW!',
    rodHint: 'Something big is down there... a sturdier rod might help.',
  },

  cooking: {
    tray: 'Basket',
    hintDrag: 'Drag up to 3 ingredients into the pot',
    hintStir: 'Stir!',
    eat: 'Eat',
    save: 'Save',
    share: 'Share with {Companion}',
    noCookware: "You'll need a pot or pan for that. The shop has some!",
    noMatch: "Mystery Mush... it's... edible?",
    newRecipeRibbon: 'NEW RECIPE!',
  },

  companion: {
    peeking: 'Something is peeking from the bushes...',
    nibbled: 'It nibbled the {Dish} and looked very pleased.',
    befriended: '{Companion} wants to stay with you!',
  },

  /** Handwritten banner per rare moment. */
  moments: {
    shooting_star: 'A shooting star! Make a wish.',
    rainbow: 'A rainbow over the {Water}!',
    firefly_swirl: 'The fireflies are dancing.',
    misty_sunrise: 'Everything is wrapped in soft mist.',
    golden_whisker: "A Golden Whisker! It's practically glowing.",
    moonbow: "A moonbow... that's rare.",
  } as Record<MomentId, string>,

  journal: {
    cover: "{Hero}'s Journal",
    stamps: '{n} / {total} stamps',
    tabs: {
      fish: 'Fish',
      recipes: 'Recipes',
      moments: 'Moments',
      friends: 'Friends',
      mystery: 'Mystery',
      trip: 'Trip',
    },
    locked: '???',
  },

  badges: {
    happy_camper: 'Happy Camper',
    guardian_friend: 'Guardian Friend',
  },

  album: {
    cover: '{Title}: Trip {n}',
    guardianMet: 'You met the guardian of {Water}.',
    guardianUnmet: 'The glow is still out there...',
    postcard: 'Next trip: {NextCampsite}. Coming soon.',
    stayLonger: 'Stay a little longer',
    newTrip: 'Start a new trip',
  },

  settings: {
    title: 'Settings',
    music: 'Music',
    sounds: 'Sounds',
    ambience: 'Ambience',
    reduceMotion: 'Reduce motion',
    largeText: 'Large text',
    newTrip: 'Start a new trip',
    newTripConfirm: 'Start over? Your gear and camp reset; your journal stays.',
    keepCamping: 'Keep camping',
    startOver: 'Start over',
    erase: 'Erase everything',
    eraseConfirm: 'This clears your journal too.',
    cancel: 'Cancel',
    eraseConfirmButton: 'Erase',
  },
} as const;

export type Strings = typeof STRINGS;
