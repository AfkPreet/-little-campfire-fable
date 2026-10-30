/**
 * LAYOUT: the clearing's world positions (ART_BIBLE.md section 3). World units, y grows downward, ground at y 600.
 * Gameplay code reads these; nothing in scene code repeats the numbers.
 */
export type XY = { x: number; y: number };

export const WORLD_WIDTH = 2600;
export const GROUND_Y = 600;

/** Parallax scroll factors per band (ART_BIBLE section 3). 1 = moves with the world, 0 = fixed to the camera. */
export const BAND_SCROLL = {
  sky: 0,
  ridges: 0.1,
  estate: 0.25,
  water: 1,
  shallows: 0.5,
  clearing: 1,
  fringe: 1.3,
} as const;

/** Vertical extents of the bands (world y). */
export const BAND_Y = {
  skyBottom: 420,
  ridgeTop: 170,
  ridgeBottom: 320,
  estateTop: 290,
  shoreline: 420,
  waterBottom: 720,
  shallowsTop: 400,
  shallowsBottom: 580,
  ground: GROUND_Y,
  /** the laterite earth face shows between these; below it the fringe grass covers everything */
  earthTop: 640,
  earthBottom: 676,
  fringeTop: 640,
} as const;

export type ForageKind = 'thicket' | 'log' | 'lemongrass' | 'jackfruit' | 'rockPool';
export type ForageSpot = XY & { id: string; kind: ForageKind };
export type HangPoint = XY & { id: string };

export const LAYOUT = {
  worldWidth: WORLD_WIDTH,
  groundY: GROUND_Y,
  /** The laterite path climbing off-left; tapping x < pathTapX heads to the shop. */
  path: { x0: 0, x1: 220, tapX: 120 },
  gatepost: { x: 160, y: GROUND_Y - 22 },
  shop: { x: 40, y: GROUND_Y - 34 },
  bamboo: { x: 300, y: GROUND_Y, topY: 120 },
  tentSpots: [
    { x: 560, y: GROUND_Y },
    { x: 760, y: GROUND_Y },
    { x: 960, y: GROUND_Y },
  ] as const satisfies readonly XY[],
  fire: { x: 1180, y: 588 },
  cushion: { x: 1110, y: GROUND_Y },
  bookshelf: { x: 1260, y: GROUND_Y },
  jamunTree: { x: 1250, y: GROUND_Y, crownTopY: 190 },
  hammock: { x: 1425, y: GROUND_Y - 70 },
  jackfruitTree: { x: 1600, y: GROUND_Y, crownTopY: 230 },
  /** Where the bank slopes down to the water. */
  shore: { x: 1720, waterY: 615 },
  rockPool: { x: 1760, y: 612 },
  jetty: { x0: 1820, x1: 2080, deckY: 592, posts: 4 },
  coracle: { x: 2130, y: 598 },
  /** Any water point here is a fishing tap (plus the band directly beside the jetty). */
  fishingZone: { x0: 1740, x1: WORLD_WIDTH, y0: 400, y1: 600 },
  forageSpots: [
    { id: 'thicket-1', kind: 'thicket', x: 420, y: GROUND_Y },
    { id: 'log-1', kind: 'log', x: 640, y: GROUND_Y },
    { id: 'lemongrass', kind: 'lemongrass', x: 1320, y: GROUND_Y },
    { id: 'thicket-2', kind: 'thicket', x: 1400, y: GROUND_Y },
    { id: 'log-2', kind: 'log', x: 1500, y: GROUND_Y },
    { id: 'jackfruit', kind: 'jackfruit', x: 1600, y: GROUND_Y },
    { id: 'rock-pool', kind: 'rockPool', x: 1760, y: 612 },
  ] as const satisfies readonly ForageSpot[],
  /** Companion peek spots are the two thickets. */
  peekSpots: [{ x: 420, y: GROUND_Y - 30 }, { x: 1400, y: GROUND_Y - 30 }] as const satisfies readonly XY[],
  /** Hang points on the jamun tree's lowest branch. Tents add their own (2 / 4 / 6). */
  jamunHangPoints: [
    { id: 'jamun-left', x: 1180, y: 420 },
    { id: 'jamun-right', x: 1330, y: 440 },
  ] as const satisfies readonly HangPoint[],
  /** Ring of 6 ground decor points around the fire and tent spots. */
  decorPoints: [
    { x: 500, y: GROUND_Y },
    { x: 680, y: GROUND_Y },
    { x: 880, y: GROUND_Y },
    { x: 1060, y: GROUND_Y },
    { x: 1300, y: GROUND_Y },
    { x: 1460, y: GROUND_Y },
  ] as const satisfies readonly XY[],
  /** Firelight warms everything within this radius at night. */
  firelightRadius: 260,
  /** Interactables glow when the hero is within this distance; at most 3 at once. */
  interactRange: 180,
  interactMaxGlow: 3,
} as const;

export type Layout = typeof LAYOUT;

/** The laterite rise at the world's left: its grass top climbs from ground level at x = RISE.w up by RISE.climb at x 0. */
export const RISE = { w: 320, climb: 50, pathW: 280 } as const;
/** Ground-surface y at world x (the rise lifts the left end; flat at GROUND_Y elsewhere). */
export function groundTopAt(x: number): number {
  if (x >= RISE.w) return GROUND_Y;
  const k = 1 - Math.max(0, x) / RISE.w;
  return GROUND_Y - k * k * RISE.climb;
}

/**
 * Scenery placement for the Landscape bands (ART_BIBLE section 3). The three ridge chains share one texture height
 * whose bottom edge sits on the far shoreline (y 420); each chain's crest is placed inside it (ridges.ts).
 */
export const SCENERY = {
  /** parallax factors of the three ridge chains, far -> near */
  ridgeScroll: [0.08, 0.1, 0.13] as const,
  /** all three ridge strips hang from this y; their textures reach down to the shoreline */
  ridgeTop: BAND_Y.ridgeTop,
  estateTop: BAND_Y.estateTop,
  /** mist band centers: between ridges 2-3, along the far shore, and the weather mist that swallows the slope */
  mistY: { far: 262, estate: 412, weather: 345 },
  /** shallows band (scroll 0.5): snags stand with their base at this y; local x along the band */
  snagBaseY: 548,
  snags: [
    { x: 260, variant: 0, bird: false },
    { x: 700, variant: 1, bird: false },
    { x: 1140, variant: 2, bird: true },
    { x: 1560, variant: 3, bird: false },
    { x: 1990, variant: 1, bird: false },
    { x: 2420, variant: 0, bird: false },
  ] as const,
  reeds: [480, 1380, 2210] as const,
  /** lily pad clusters along the near shore (world x, water y, size 0..1) */
  lilyPads: [
    { x: 600, y: 566, s: 0.85 }, { x: 640, y: 574, s: 1 }, { x: 684, y: 562, s: 0.8 }, { x: 668, y: 580, s: 0.9 },
    { x: 1020, y: 572, s: 1 }, { x: 1062, y: 564, s: 0.85 }, { x: 1050, y: 582, s: 0.9 },
    { x: 2230, y: 570, s: 1 }, { x: 2272, y: 562, s: 0.8 }, { x: 2300, y: 578, s: 0.95 }, { x: 2350, y: 566, s: 0.85 },
  ] as const,
  /** the far coracle (scroll 0.25) drifting along the far shore by day: water y and px/s */
  farCoracle: { y: 436, speed: 3, x0: 700 },
  /** fringe (scroll 1.3): clumps every `step` px with jitter, feet between the two y values */
  fringe: { step: 96, jitter: 30, y0: 690, y1: 724 },
  /** sky furniture (sky-band local y) */
  cloudY: [66, 118, 92] as const,
  egretY: [128, 158] as const,
  starsH: 230,
  /** where fireflies gather at night: the jamun crown and the bamboo culms (world rects) */
  fireflyBounds: [
    { x: 1060, y: 200, w: 380, h: 230 },
    { x: 200, y: 160, w: 220, h: 340 },
  ] as const,
} as const;
