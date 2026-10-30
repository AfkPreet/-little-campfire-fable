/**
 * Landscape: the parallax camp world (ART_BIBLE section 3) assembled from the painters in src/art/landscape and
 * src/art/props. One root Container holds the bands in depth order; each band is a Container whose x follows the
 * camera by its scroll factor. Everything is painted once into textures; per-frame work is tints, positions and a
 * handful of sines (no allocations).
 *
 *   const land = new Landscape(scene, { parallax: true });
 *   land.setLighting(lightingAt(dayT, weather)); land.setWeather(weather); land.setFireLit(true);
 *   scene.events.on('update', (_t, dt) => land.update(dt, cam.worldView.x, dayT));
 *   land.addActor(hero); // hero/tent/companion live in the clearing's actor layer, sorted by y
 */
import Phaser from 'phaser';
import { viewport } from '@/config/layout';
import { DEBUG } from '@/config/debug';
import { PALETTE, hexToInt, mix } from '@/config/palette';
import { lightingAt, type Lighting } from '@/world/lighting';
import { BAND_SCROLL, BAND_Y, LAYOUT, SCENERY, WORLD_WIDTH, groundTopAt } from '@/world/layout';
import { cloudDrift, moonPosition, sunPosition } from '@/world/sky';
import { makeImg } from '@/art/pipeline';
import { isReduceMotion } from '@/fx/juice';
import { fireflies, rain, starsTwinkle, type FirefliesHandle, type RainHandle, type StarsHandle } from '@/fx/particles';
import { FX_KEYS, paintFxTextures } from '@/fx/textures';
import { TILE_W, colorDistance } from '@/art/landscape/common';
import { SKY_KEYS, SKY_SIZES, paintSkyGradient, paintSkyTextures } from '@/art/landscape/sky';
import { RIDGE_H, RIDGE_KEYS, paintRidges } from '@/art/landscape/ridges';
import { ESTATE_KEY, ESTATE_REFLECT_KEY, ESTATE_WINDOWS, paintEstate, paintEstateReflection } from '@/art/landscape/estate';
import { MIST_H, MIST_KEY, MIST_W, paintMistBand } from '@/art/landscape/mist';
import { WATER_KEYS, WATER_SIZES, paintWaterBase, paintWaterTextures } from '@/art/landscape/water';
import { SHALLOWS_KEYS, SHALLOWS_SIZES, paintShallows } from '@/art/landscape/shallows';
import { GROUND_KEYS, GROUND_SIZES, paintGround } from '@/art/landscape/ground';
import { FRINGE_KEYS, FRINGE_SIZES, paintFringe } from '@/art/landscape/fringe';
import { makeFire, type FireRig } from '@/art/props/fire';
import { FORAGE_KEYS, makeForageProp, makeRockPool, type RockPoolRig } from '@/art/props/forage';
import { makeCoracle, makeJetty, type CoracleRig } from '@/art/props/jetty';
import { makeShop, type ShopRig } from '@/art/props/shop';
import { makeBamboo, makeJackfruitTree, makeJamunTree, type TreeRig } from '@/art/props/trees';

type Container = Phaser.GameObjects.Container;
type Image = Phaser.GameObjects.Image;
type Tintable = { setTint(n: number): unknown };

/**
 * A band strip: a row of Images sharing one tileable texture (a TileSprite would allocate a canvas the size of the
 * whole world per band, and re-upload it whenever its tile position moves). Scroll it by moving the container.
 */
class Strip extends Phaser.GameObjects.Container {
  readonly imgs: Image[] = [];
  constructor(scene: Phaser.Scene, x: number, y: number, key: string, texW: number, spanW: number, o: { flipY?: boolean; squash?: number; cropW?: number } = {}) {
    super(scene, x, y);
    const count = Math.ceil(spanW / texW);
    for (let i = 0; i < count; i++) {
      const im = makeImg(scene, i * texW, 0, key).setOrigin(0, 0);
      im.setScale(B, B * (o.squash ?? 1));
      if (o.flipY) im.setFlipY(true);
      if (o.cropW !== undefined && (i + 1) * texW > o.cropW) im.setCrop(0, 0, Math.max(0, o.cropW - i * texW) * 2, im.height);
      this.imgs.push(im);
      this.add(im);
    }
  }
  setTint(n: number): this {
    for (const im of this.imgs) im.setTint(n);
    return this;
  }
  setSquash(sy: number): this {
    for (const im of this.imgs) im.setScale(B, B * sy);
    return this;
  }
}

export type LandscapeOpts = {
  /** world width in logical px (default LAYOUT.worldWidth, 2600) */
  worldWidth?: number;
  /** true: bands move at their scroll factors; false: the backdrop is pinned to the view and the clearing is static */
  parallax: boolean;
  /** start with the fire lit */
  lit?: boolean;
  /** width of the view the sky must cover (default viewport().w) */
  viewWidth?: number;
  /** stars in the field (default 60; boards with several landscapes share the particle budget) */
  starCount?: number;
};

export type LandscapeLayers = {
  sky: Container;
  far: Container;
  mistFar: Container;
  estate: Container;
  water: Container;
  mistNear: Container;
  shallows: Container;
  clearing: Container;
  /** ground strip, path, tent spots (behind everything in the clearing) */
  ground: Container;
  /** trees, shop, gatepost: behind the actors */
  clearingBack: Container;
  /** hero, tent, companion, fire, forage props: sorted by y via sortActors() */
  actors: Container;
  /** small things that overlap actors' feet */
  clearingFront: Container;
  /** additive light: firelight pool, fireflies */
  light: Container;
  fringe: Container;
  /** pinned to the view: rain and vignette */
  overlay: Container;
};

type Band = { c: Container; f: number };
type Sway = { img: Image; w: number; p: number; a: number };
type Ring = { img: Image; t: number; dur: number; sc: number; fresh: boolean };

const B = 0.5; // 1 / ART_SCALE
const SKY_H = BAND_Y.skyBottom;
const WATER_TOP = BAND_Y.shoreline;
const WATER_H = BAND_Y.waterBottom - BAND_Y.shoreline;
const SKY_MARGIN = 400;
const REPAINT_DIST = 5;
const RING_COUNT = 14;
const FIREFLY_FADE_S = 1.8;
const GUST = { minS: 8, maxS: 15, angle: 0.035, ms: 1400 };
const BOB = { px: 3, ms: 2800 };
const RIPPLE_SPEED = 4.5; // logical px / s (the tile slides; tilePosition changes would re-upload the texture each frame)
const RIPPLE_W = WATER_SIZES.ripple.w;
const MIST_SPEED = [5, -3.5, 2.5];
const CLOUD_SPEED = 6;
const EGRET_SPEED = 22;
const REFLECT_ALPHA = 0.28;
const VIGNETTE_MIN = 0.1;
const REFLECT_SQUASH = 0.5;

let instances = 0;

function tintAll(objs: Iterable<Tintable>, hex: string): void {
  const n = hexToInt(hex);
  for (const o of objs) o.setTint(n);
}
/** Tint the plain (non-additive) images of a rig container. */
function tintRig(c: Container, hex: string, skip?: ReadonlySet<Phaser.GameObjects.GameObject>): void {
  const n = hexToInt(hex);
  for (const o of c.list) {
    if (skip?.has(o)) continue;
    if (o instanceof Phaser.GameObjects.Image && o.blendMode !== Phaser.BlendModes.ADD) o.setTint(n);
  }
}
const clamp01 = (v: number) => Phaser.Math.Clamp(v, 0, 1);
const nightOf = (L: Lighting) => clamp01((0.7 - L.ambient) / 0.35);

export class Landscape {
  readonly root: Container;
  readonly layers: LandscapeLayers;
  readonly worldWidth: number;
  readonly viewW: number;
  readonly parallax: boolean;

  private readonly scene: Phaser.Scene;
  private readonly id: number;
  private readonly bands: Band[] = [];
  private L!: Lighting;
  private weather = { rain: 0, mist: 0 };
  private t = 0;
  private dayT = 0.42;
  private scrollX = 0;
  private destroyed = false;

  // sky
  private readonly skyKey: string;
  private readonly waterKey: string;
  private skyGradient!: Image;
  private sun!: Image;
  private halo!: Image;
  private moon!: Image;
  private clouds: Image[] = [];
  private egrets: Image[] = [];
  private stars?: StarsHandle;
  private lastSkyTop = '';
  private lastSkyHorizon = '';
  private lastWater = '';
  // far
  private ridges: Strip[] = [];
  private estateTile!: Strip;
  private windows: Image[] = [];
  private mists: Strip[] = [];
  // water
  private waterBase!: Image;
  private waterOpen!: Image;
  private rippleOpen!: Strip;
  private reflections: Array<{ t: Strip; band: Band; which: 'far' | 'r3' | 'mid' }> = [];
  private ripple!: Strip;
  private path!: Image;
  private lilies: Image[] = [];
  private rings: Ring[] = [];
  // shallows
  private shallowImgs: Image[] = [];
  private cormorant!: Image;
  // clearing
  private groundImgs: Tintable[] = [];
  private propRigs: Container[] = [];
  private bamboo!: TreeRig;
  private jamun!: TreeRig;
  private jackfruit!: TreeRig;
  private shop!: ShopRig;
  private rockPool!: RockPoolRig;
  private coracle!: CoracleRig;
  private fire!: FireRig;
  private fireImgs: Image[] = [];
  private gustTimer?: Phaser.Time.TimerEvent;
  private gustTween?: Phaser.Tweens.Tween;
  private bobTween?: Phaser.Tweens.Tween;
  // fringe
  private sways: Sway[] = [];
  // fx
  private flies: FirefliesHandle[] = [];
  private flyK = 0;
  private flyTarget = 0;
  private rainFx?: RainHandle;
  private vignette!: Image;

  constructor(scene: Phaser.Scene, opts: LandscapeOpts) {
    this.scene = scene;
    this.id = instances++;
    this.worldWidth = opts.worldWidth ?? WORLD_WIDTH;
    this.viewW = opts.viewWidth ?? viewport().w;
    this.parallax = opts.parallax;
    this.skyKey = `${SKY_KEYS.gradient}-${this.id}`;
    this.waterKey = `${WATER_KEYS.base}-${this.id}`;
    this.paintAll();

    const c = () => scene.make.container({ x: 0, y: 0, add: false }) as Container;
    this.root = scene.add.container(0, 0);
    const band = (f: number): Container => {
      const k = c();
      this.bands.push({ c: k, f });
      this.root.add(k);
      return k;
    };
    const sky = band(BAND_SCROLL.sky);
    const far = band(BAND_SCROLL.ridges);
    const mistFar = band(BAND_SCROLL.ridges + 0.05);
    const estate = band(BAND_SCROLL.estate);
    const water = band(BAND_SCROLL.water);
    const mistNear = band(BAND_SCROLL.estate + 0.1);
    const shallows = band(BAND_SCROLL.shallows);
    const clearing = band(BAND_SCROLL.clearing);
    const ground = c(), clearingBack = c(), actors = c(), clearingFront = c();
    clearing.add([ground, clearingBack, actors, clearingFront]);
    const light = band(BAND_SCROLL.clearing);
    const fringe = band(BAND_SCROLL.fringe);
    const overlay = band(0);
    this.layers = { sky, far, mistFar, estate, water, mistNear, shallows, clearing, ground, clearingBack, actors, clearingFront, light, fringe, overlay };

    this.buildSky(opts.starCount ?? 60);
    this.buildFar();
    this.buildWater();
    this.buildShallows();
    this.buildClearing();
    this.buildFringe();
    this.buildOverlay();

    this.setFireLit(opts.lit ?? false);
    this.update(0, 0, this.dayT);
  }

  // ------------------------------------------------------------------------------------------------ build

  private paintAll(): void {
    const s = this.scene;
    paintSkyTextures(s);
    paintRidges(s);
    paintEstate(s);
    paintEstateReflection(s, WATER_TOP - SCENERY.estateTop);
    paintMistBand(s);
    paintWaterTextures(s);
    paintShallows(s);
    paintGround(s);
    paintFringe(s);
    paintFxTextures(s);
    // provisional gradients so the images bind to real textures; setLighting repaints them
    const L0 = lightingAt(this.dayT);
    paintSkyGradient(s, L0, this.skyKey);
    paintWaterBase(s, L0, this.waterKey);
  }

  private mk(x: number, y: number, key: string): Image {
    return makeImg(this.scene, x, y, key);
  }
  /** A tileable band strip of Images: origin top-left, spanning w logical px. */
  private strip(x: number, y: number, w: number, key: string, texW: number, o?: { flipY?: boolean; squash?: number; cropW?: number }): Strip {
    return new Strip(this.scene, x, y, key, texW, w, o);
  }

  private buildSky(starCount: number): void {
    const { sky } = this.layers;
    const s = this.scene;
    const skyW = this.viewW + SKY_MARGIN;
    this.skyGradient = s.make.image({ x: 0, y: 0, key: this.skyKey, add: false }).setOrigin(0, 0);
    this.skyGradient.setDisplaySize(skyW, SKY_H + 2);
    this.halo = this.mk(0, 0, SKY_KEYS.halo).setBlendMode(Phaser.BlendModes.ADD);
    this.sun = this.mk(0, 0, SKY_KEYS.sun);
    this.moon = this.mk(0, 0, SKY_KEYS.moon);
    sky.add([this.skyGradient]);
    const starsH = SCENERY.starsH;
    this.stars = starsTwinkle(s, { x: 0, y: 0, w: this.viewW, h: starsH }, starCount);
    sky.add(this.stars.container);
    sky.add([this.halo, this.sun, this.moon]);
    this.clouds = SKY_KEYS.clouds.map((k, i) => this.mk(0, SCENERY.cloudY[i], k).setAlpha(0.7));
    this.egrets = SCENERY.egretY.map((y, i) => this.mk(0, y, SKY_KEYS.egret).setScale(B * (1 - i * 0.2)));
    sky.add([...this.clouds, ...this.egrets]);
  }

  private buildFar(): void {
    const { far, estate, mistFar, mistNear } = this.layers;
    const w = this.worldWidth + TILE_W;
    this.ridges = RIDGE_KEYS.map((k, i) => this.strip(0, SCENERY.ridgeTops[i], w, k, TILE_W));
    far.add(this.ridges);
    this.estateTile = this.strip(0, SCENERY.estateTop, w, ESTATE_KEY, TILE_W);
    estate.add(this.estateTile);
    // homestay windows: a soft glow per tile repeat, lit at night
    const glowTint = hexToInt(PALETTE.glow);
    for (let k = 0; k * TILE_W < w; k++) {
      for (const [wx, wy] of ESTATE_WINDOWS) {
        const g = this.mk(wx + k * TILE_W, SCENERY.estateTop + wy + 2, FX_KEYS.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(glowTint);
        g.setScale(B * 0.28).setData('baseScale', B * 0.28).setAlpha(0);
        this.windows.push(g);
        estate.add(g);
      }
    }
    const mw = this.worldWidth + MIST_W * 2;
    const m1 = this.strip(-MIST_W, SCENERY.mistY.far - MIST_H / 2, mw, MIST_KEY, MIST_W);
    const m2 = this.strip(-MIST_W, SCENERY.mistY.estate - MIST_H / 2, mw, MIST_KEY, MIST_W);
    const m3 = this.strip(-MIST_W, SCENERY.mistY.weather - MIST_H, mw, MIST_KEY, MIST_W, { squash: 2.2 });
    mistFar.add(m1);
    mistNear.add([m2, m3]);
    this.mists = [m1, m2, m3];
  }

  private buildWater(): void {
    const { water } = this.layers;
    const s = this.scene;
    const w = this.worldWidth + TILE_W;
    this.waterBase = s.make.image({ x: 0, y: WATER_TOP, key: this.waterKey, add: false }).setOrigin(0, 0);
    this.waterBase.setDisplaySize(w, WATER_H);
    this.waterBase.setCrop(0, 0, WATER_SIZES.base.w * 2, ((LAYOUT.groundY - WATER_TOP) / WATER_H) * WATER_SIZES.base.h * 2);
    // the open water past the shore continues down to the frame bottom
    this.waterOpen = s.make.image({ x: LAYOUT.shore.x - 40, y: WATER_TOP, key: this.waterKey, add: false }).setOrigin(0, 0);
    this.waterOpen.setDisplaySize(w - LAYOUT.shore.x + 40, WATER_H);
    water.add([this.waterBase, this.waterOpen]);
    // mirrored, squashed far bands at low alpha
    const refl = (key: string, band: Band, which: 'far' | 'r3' | 'mid', squash = REFLECT_SQUASH, flip = true) => {
      const t = this.strip(0, WATER_TOP, w, key, TILE_W, { flipY: flip, squash });
      t.setAlpha(REFLECT_ALPHA);
      this.reflections.push({ t, band, which });
      water.add(t);
    };
    const farBand = this.bands.find((b) => b.c === this.layers.far)!;
    const estBand = this.bands.find((b) => b.c === this.layers.estate)!;
    // the ridge texture's own skirt (below the crest) sits under the shoreline; mirror the crest region only
    refl(RIDGE_KEYS[0], farBand, 'far', (WATER_TOP - SCENERY.ridgeTops[0]) / RIDGE_H * 0.55);
    refl(RIDGE_KEYS[2], farBand, 'r3', (WATER_TOP - SCENERY.ridgeTops[2]) / RIDGE_H * 0.5);
    refl(ESTATE_REFLECT_KEY, estBand, 'mid', REFLECT_SQUASH, false);
    // ripples only where water shows: above the bank across the world, and down to the frame bottom past the shore
    this.ripple = this.strip(-RIPPLE_W, WATER_TOP, w + RIPPLE_W, WATER_KEYS.ripple, RIPPLE_W);
    this.ripple.setAlpha(0.55);
    this.rippleOpen = this.strip(LAYOUT.shore.x - RIPPLE_W, LAYOUT.groundY, w - LAYOUT.shore.x + RIPPLE_W, WATER_KEYS.ripple, RIPPLE_W);
    this.rippleOpen.setAlpha(0.55);
    water.add([this.ripple, this.rippleOpen]);
    this.path = this.mk(0, WATER_TOP - 2, WATER_KEYS.path).setOrigin(0.5, 0).setAlpha(0);
    this.path.setScale(B, B * (WATER_H / WATER_SIZES.path.h) * 0.8);
    water.add(this.path);
    SCENERY.lilyPads.forEach((p, i) => {
      const im = this.mk(p.x, p.y, WATER_KEYS.lily[i % 3]).setScale(B * p.s);
      im.setData('baseScale', B * p.s);
      this.lilies.push(im);
      water.add(im);
    });
    for (let i = 0; i < RING_COUNT; i++) {
      const im = this.mk(0, 0, WATER_KEYS.ring).setAlpha(0);
      this.rings.push({ img: im, t: Infinity, dur: 900 + Math.random() * 500, sc: 1, fresh: true });
      water.add(im);
    }
  }

  private buildShallows(): void {
    const { shallows } = this.layers;
    for (const sp of SCENERY.snags) {
      const im = this.mk(sp.x, SCENERY.snagBaseY, SHALLOWS_KEYS.snags[sp.variant]).setOrigin(0.5, 1);
      this.shallowImgs.push(im);
      shallows.add(im);
      if (sp.bird) {
        // perch on the trunk top: variant 2's top is at texture y 56 (snag-c), leaning +10
        this.cormorant = this.mk(sp.x + 11, SCENERY.snagBaseY - (SHALLOWS_SIZES.snag.h - 56) - 3, SHALLOWS_KEYS.cormorant).setOrigin(0.5, 1);
        this.shallowImgs.push(this.cormorant);
        shallows.add(this.cormorant);
      }
    }
    for (const x of SCENERY.reeds) {
      const im = this.mk(x, SCENERY.snagBaseY + 6, SHALLOWS_KEYS.reeds).setOrigin(0.5, 1);
      this.shallowImgs.push(im);
      shallows.add(im);
    }
  }

  private buildClearing(): void {
    const s = this.scene;
    const { ground, clearingBack, actors, light } = this.layers;
    const G = GROUND_SIZES;
    const grassTop = LAYOUT.groundY - (G.strip.tuft + 4);
    const stripW = LAYOUT.shore.x;
    const strip = this.strip(0, grassTop, stripW, GROUND_KEYS.strip, TILE_W, { cropW: stripW });
    const bankEnd = this.mk(LAYOUT.shore.x, grassTop, GROUND_KEYS.bankEnd).setOrigin(0, 0);
    const rise = this.mk(0, LAYOUT.groundY + 14, GROUND_KEYS.rise).setOrigin(0, 1);
    const path = this.mk(0, LAYOUT.groundY + 16, GROUND_KEYS.path).setOrigin(0, 1);
    ground.add([strip, bankEnd, rise, path]);
    this.groundImgs.push(strip, bankEnd, rise, path);
    for (const sp of LAYOUT.tentSpots) {
      const im = this.mk(sp.x, sp.y, GROUND_KEYS.tentSpot);
      ground.add(im);
      this.groundImgs.push(im);
    }
    const scatter = this.mk(LAYOUT.jamunTree.x, LAYOUT.groundY + 6, GROUND_KEYS.jamunScatter);
    ground.add(scatter);
    this.groundImgs.push(scatter);

    // back row: shop, gatepost, trees (origin at their base)
    this.shop = makeShop(s, LAYOUT.shop.x, groundTopAt(LAYOUT.shop.x) + 2);
    const gatepost = this.mk(LAYOUT.gatepost.x, groundTopAt(LAYOUT.gatepost.x) + 3, GROUND_KEYS.gatepost)
      .setOrigin(24 / G.gatepost.w, (G.gatepost.h - 4) / G.gatepost.h);
    this.bamboo = makeBamboo(s, LAYOUT.bamboo.x, LAYOUT.bamboo.y);
    this.jamun = makeJamunTree(s, LAYOUT.jamunTree.x, LAYOUT.jamunTree.y);
    this.jackfruit = makeJackfruitTree(s, LAYOUT.jackfruitTree.x, LAYOUT.jackfruitTree.y);
    clearingBack.add([this.shop.container, gatepost, this.bamboo.container, this.jamun.container, this.jackfruit.container]);
    this.groundImgs.push(gatepost);
    this.propRigs.push(this.shop.container, this.bamboo.container, this.jamun.container, this.jackfruit.container);

    // actors: forage props, jetty, coracle, fire (hero and tents are added by gameplay)
    const forageKey: Record<string, string> = {
      thicket: FORAGE_KEYS.thicket, log: FORAGE_KEYS.log, lemongrass: FORAGE_KEYS.lemongrass, jackfruit: '', rockPool: '',
    };
    for (const sp of LAYOUT.forageSpots) {
      const key = forageKey[sp.kind];
      if (!key) continue;
      const im = makeForageProp(s, sp.x, sp.y, key);
      const holder = s.make.container({ x: 0, y: sp.y, add: false }) as Container;
      holder.add(im);
      im.y = 0;
      actors.add(holder);
      this.propRigs.push(holder);
    }
    this.rockPool = makeRockPool(s, LAYOUT.rockPool.x, LAYOUT.rockPool.y);
    actors.add(this.rockPool.container);
    this.propRigs.push(this.rockPool.container);
    const jetty = makeJetty(s, LAYOUT.jetty.x0, LAYOUT.jetty.x1, LAYOUT.jetty.deckY, LAYOUT.jetty.posts);
    actors.add(jetty.container);
    this.propRigs.push(jetty.container);
    this.coracle = makeCoracle(s, LAYOUT.coracle.x, LAYOUT.coracle.y);
    actors.add(this.coracle.container);
    this.propRigs.push(this.coracle.container);
    this.fire = makeFire(s, LAYOUT.fire.x, LAYOUT.fire.y);
    actors.add(this.fire.container);
    this.fireImgs = this.fire.container.list.filter(
      (o): o is Image => o instanceof Phaser.GameObjects.Image && !this.fire.flames.includes(o) && o.blendMode !== Phaser.BlendModes.ADD,
    );
    light.add(this.fire.pool);
    this.sortActors();

    // coracle bob, bamboo gusts
    if (!isReduceMotion()) {
      this.bobTween = s.tweens.add({
        targets: this.coracle.container, y: LAYOUT.coracle.y - BOB.px, duration: BOB.ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      this.scheduleGust();
    }
  }

  private scheduleGust(): void {
    if (this.destroyed) return;
    const delay = Phaser.Math.Between(GUST.minS * 1000, GUST.maxS * 1000);
    this.gustTimer = this.scene.time.delayedCall(delay, () => {
      if (this.destroyed) return;
      this.gustTween = this.scene.tweens.add({
        targets: this.bamboo.container, rotation: GUST.angle, duration: GUST.ms, yoyo: true, ease: 'Sine.easeInOut',
        onComplete: () => this.scheduleGust(),
      });
    });
  }

  private buildFringe(): void {
    const { fringe } = this.layers;
    const F = SCENERY.fringe;
    const x0 = -200, x1 = this.worldWidth * BAND_SCROLL.fringe + 300;
    let i = 0;
    for (let x = x0; x < x1; x += F.step, i++) {
      const jitter = (Math.random() - 0.5) * 2 * F.jitter;
      const fern = i % 3 === 1;
      const keys = fern ? FRINGE_KEYS.fern : FRINGE_KEYS.grass;
      const key = keys[Math.floor(Math.random() * keys.length)];
      const size = fern ? FRINGE_SIZES.fern : FRINGE_SIZES.grass;
      const im = this.mk(x + jitter, Phaser.Math.Between(F.y0, F.y1), key).setOrigin(0.5, (size.h - 4) / size.h);
      const sc = B * (0.9 + Math.random() * 0.35) * (fern ? 0.95 : 1);
      im.setScale(sc).setData('baseScale', sc);
      if (Math.random() < 0.5) im.setFlipX(true);
      fringe.add(im);
      this.sways.push({ img: im, w: 0.9 + Math.random() * 0.7, p: Math.random() * Math.PI * 2, a: fern ? 0.018 : 0.03 });
    }
  }

  private buildOverlay(): void {
    const { overlay } = this.layers;
    this.vignette = this.mk(0, 0, FX_KEYS.vignette).setOrigin(0, 0);
    this.vignette.setDisplaySize(this.viewW, BAND_Y.waterBottom);
    this.vignette.setAlpha(0);
    overlay.add(this.vignette);
  }

  // ------------------------------------------------------------------------------------------------ public API

  /** Add a gameplay object (hero, tent, companion) to the clearing's actor layer; call sortActors() after moves. */
  addActor(obj: Phaser.GameObjects.GameObject): void {
    this.layers.actors.add(obj);
    this.sortActors();
  }
  /** Depth-sort the actor layer by y (stable: later additions win ties). */
  sortActors(): void {
    this.layers.actors.sort('y');
  }

  setLighting(L: Lighting): void {
    this.L = L;
    // sky and water gradients: repaint only when the key colors moved noticeably
    if (colorDistance(L.skyTop, this.lastSkyTop) > REPAINT_DIST || colorDistance(L.skyHorizon, this.lastSkyHorizon) > REPAINT_DIST) {
      paintSkyGradient(this.scene, L, this.skyKey);
      this.lastSkyTop = L.skyTop;
      this.lastSkyHorizon = L.skyHorizon;
    }
    const waterSig = mix(L.waterTint, L.skyHorizon, 0.5);
    if (colorDistance(waterSig, this.lastWater) > REPAINT_DIST) {
      paintWaterBase(this.scene, L, this.waterKey);
      this.lastWater = waterSig;
    }
    // far bands: white-painted, tinted
    // ridge 1 is the lightest (most air in front of it); each nearer chain steps toward `mid`
    const farTints = [mix(L.far, L.skyHorizon, 0.3), L.far, mix(L.far, L.mid, 0.55)];
    this.ridges.forEach((r, i) => r.setTint(hexToInt(farTints[i])));
    this.estateTile.setTint(hexToInt(L.mid));
    for (const r of this.reflections) {
      const c = r.which === 'far' ? farTints[0] : r.which === 'r3' ? farTints[2] : L.mid;
      r.t.setTint(hexToInt(mix(c, L.skyHorizon, 0.25)));
    }
    const mistTint = hexToInt(L.mistColor);
    this.mists.forEach((m) => m.setTint(mistTint));
    this.mists[0].setAlpha(L.mist * 0.75);
    this.mists[1].setAlpha(L.mist * 0.85);
    this.mists[2].setAlpha(clamp01(this.weather.mist) * 0.9);
    // sky furniture
    const cloudTint = hexToInt(mix(PALETTE.cream, L.skyHorizon, 0.45));
    this.clouds.forEach((c) => c.setTint(cloudTint).setAlpha(0.7 * (0.6 + 0.4 * L.ambient)));
    this.egrets.forEach((e) => e.setAlpha(0.9 * clamp01((L.sun - 0.3) / 0.4)));
    this.stars?.setAlpha(L.stars);
    this.sun.setTint(hexToInt(mix(PALETTE.cream, L.skyHorizon, 0.25)));
    this.halo.setTint(hexToInt(mix(PALETTE.butter, L.skyHorizon, 0.5)));
    // water
    this.ripple.setTint(hexToInt(L.waterTint));
    tintAll(this.lilies, L.nearTint);
    this.rings.forEach((r) => r.img.setTint(hexToInt(mix(PALETTE.cream, L.waterTint, 0.3))));
    this.path.setTint(hexToInt(L.moon > L.sun ? PALETTE.cream : mix(PALETTE.cream, PALETTE.butter, 0.55)));
    // shallows, clearing, fringe
    tintAll(this.shallowImgs, L.nearTint);
    this.cormorant.setAlpha(clamp01((L.sun - 0.25) / 0.4));
    tintAll(this.groundImgs, L.groundTint);
    for (const c of this.propRigs) tintRig(c, L.charTint);
    tintAll(this.fireImgs, L.charTint);
    tintAll(this.sways.map((s) => s.img), L.fgTint);
    // night things
    const night = nightOf(L);
    this.windows.forEach((w) => w.setAlpha(night * 0.85));
    this.shop.setNight(night);
    this.rockPool.setNight(night);
    const rim = clamp01(L.warmth * L.sun * 2.2) * 0.7;
    this.bamboo.rim?.setAlpha(rim);
    this.jamun.rim?.setAlpha(rim);
    this.fire.setWarmth(L.warmth);
    this.vignette.setAlpha(L.vignette).setVisible(L.vignette >= VIGNETTE_MIN);
    this.flyTarget = L.warmth > 0.5 ? Math.round(20 + 20 * L.warmth) : 0;
  }

  /** Weather fx: rain streaks and rings over the view, and the mist that swallows the estate slope. */
  setWeather(w: { rain: number; mist: number }): void {
    this.weather = { rain: clamp01(w.rain), mist: clamp01(w.mist) };
    this.mists[2].setAlpha(this.weather.mist * 0.9);
    if (this.weather.rain > 0 && !this.rainFx) {
      this.rainFx = rain(this.scene, { x: 0, y: 0, w: this.viewW, h: LAYOUT.groundY }, this.weather.rain, LAYOUT.groundY);
      this.layers.overlay.add([this.rainFx.far, this.rainFx.near, this.rainFx.splash]);
    }
    this.rainFx?.setIntensity(this.weather.rain);
  }

  setFireLit(lit: boolean): void {
    this.fire.setLit(lit);
  }
  get fireLit(): boolean {
    return this.fire.lit;
  }

  /** World x of the camera's left edge for a band with scroll factor f. */
  private bandX(f: number): number {
    if (this.parallax) return this.scrollX * (1 - f);
    return f < 1 ? this.scrollX : 0;
  }

  /** Advance the world: dt in ms, scrollX = the camera's left edge in world units, dayT 0..1. */
  update(dt: number, scrollX: number, dayT: number): void {
    if (this.destroyed) return;
    const dts = Math.min(0.1, dt / 1000);
    this.t += dts;
    this.scrollX = scrollX;
    this.dayT = dayT;
    const t = this.t;
    const L = this.L;
    for (const b of this.bands) b.c.x = this.bandX(b.f);

    // sun, moon and their path on the water
    const sun = sunPosition(dayT, this.viewW), moon = moonPosition(dayT, this.viewW);
    this.sun.setPosition(sun.x, sun.y).setAlpha(L ? L.sun * sun.up : 0);
    this.halo.setPosition(sun.x, sun.y).setAlpha(L ? L.sun * sun.up * 0.75 : 0);
    this.halo.setScale(B * (1 + 0.04 * Math.sin(t * 0.7)));
    this.moon.setPosition(moon.x, moon.y).setAlpha(L ? L.moon * moon.up : 0);
    if (L) {
      const moonLit = L.moon * moon.up > L.sun * sun.up;
      const src = moonLit ? moon : sun;
      this.path.x = this.bandX(0) + src.x;
      this.path.setAlpha(moonLit ? L.moon * moon.up * 0.8 : L.sun * sun.up * (0.35 + 0.3 * L.warmth));
    }
    // reflections follow their bands
    for (const r of this.reflections) r.t.x = this.bandX(r.band.f);
    // drift
    const rx = -RIPPLE_W + ((t * RIPPLE_SPEED) % RIPPLE_W);
    this.ripple.x = rx;
    this.rippleOpen.x = LAYOUT.shore.x + rx;
    this.mists.forEach((m, i) => { m.x = -MIST_W + ((((t * MIST_SPEED[i]) % MIST_W) + MIST_W) % MIST_W); });
    this.clouds.forEach((c, i) => { c.x = cloudDrift(t, i * (this.viewW / 3) + 120, this.viewW, SKY_SIZES.clouds[i].w, CLOUD_SPEED); });
    this.egrets.forEach((e, i) => {
      e.x = cloudDrift(t * 0.5 + i * 7, i * 260 + 40, this.viewW, SKY_SIZES.egret.w, EGRET_SPEED);
      e.y = SCENERY.egretY[i] + 3 * Math.sin(t * 1.7 + i);
    });
    // fringe sway
    const still = isReduceMotion() ? 0.25 : 1;
    for (const s of this.sways) s.img.rotation = still * s.a * Math.sin(t * s.w + s.p);
    // fire
    this.fire.update(t);
    // fireflies fade toward the lighting's target count
    this.updateFireflies(dts);
    // rain rings
    this.updateRings(dts);
  }

  private updateFireflies(dts: number): void {
    const want = this.flyTarget > 0 ? 1 : 0;
    if (this.flyK !== want || (want && this.flies.length === 0)) {
      if (want && this.flies.length === 0) {
        const split = [0.6, 0.4];
        this.flies = SCENERY.fireflyBounds.map((b, i) => {
          const h = fireflies(this.scene, b, Math.round(this.flyTarget * split[i]));
          h.setIntensity(0);
          this.layers.light.add(h.container);
          return h;
        });
      }
      const step = DEBUG.freeze ? 1 : dts / FIREFLY_FADE_S;
      this.flyK = Phaser.Math.Clamp(this.flyK + (want ? step : -step), 0, 1);
      for (const f of this.flies) f.setIntensity(this.flyK);
      if (this.flyK === 0 && !want) {
        for (const f of this.flies) f.destroy();
        this.flies = [];
      }
    }
    if (want && this.flies.length) {
      const split = [0.6, 0.4];
      this.flies.forEach((f, i) => {
        const n = Math.round(this.flyTarget * split[i]);
        if (f.count !== n) f.setCount(n);
      });
    }
  }

  private updateRings(dts: number): void {
    const k = this.weather.rain;
    if (k <= 0) {
      if (this.rings[0].img.alpha > 0) this.rings.forEach((r) => r.img.setAlpha(0));
      return;
    }
    const x0 = this.scrollX, x1 = this.scrollX + this.viewW;
    for (const r of this.rings) {
      r.t += dts * 1000;
      if (r.t >= r.dur) {
        r.dur = 800 + Math.random() * 600;
        r.t = r.fresh ? Math.random() * r.dur : 0; // stagger the first wave
        r.fresh = false;
        const depth = Math.random();
        r.img.setPosition(Phaser.Math.Between(x0, x1), WATER_TOP + 14 + depth * (LAYOUT.groundY - WATER_TOP - 24));
        r.sc = 0.9 + depth * 1.3;
      }
      const u = r.t / r.dur;
      const e = Math.sin((u * Math.PI) / 2);
      r.img.setScale(B * r.sc * (0.25 + 0.75 * e), B * r.sc * (0.25 + 0.75 * e) * 0.9);
      r.img.setAlpha(k * 0.85 * (1 - u));
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.gustTimer?.remove(false);
    this.gustTween?.stop();
    this.bobTween?.stop();
    this.stars?.destroy();
    for (const f of this.flies) f.destroy();
    this.rainFx?.destroy();
    this.fire.destroy();
    this.root.destroy(true);
    this.scene.textures.remove(this.skyKey);
    this.scene.textures.remove(this.waterKey);
  }
}
