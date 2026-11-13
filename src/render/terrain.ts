/**
 * Chunked terrain renderer. Chunk meshes
 * are heightmap-displaced PlaneGeometry with per-vertex colors: sand/grass/
 * rock ramp above sea level (with ground-cover hue/patch/mown texture),
 * a seabed depth ramp below sea level, and a shoreline foam band straddling
 * SEA_LEVEL — so the land-to-water line reads correctly under the translucent
 * water surface owned by water.ts (this module does not render water;
 * WaterRenderer is the single owner). markDirty()/update() support incremental
 * rebuilds when the sim terraforms the map (applyHeightPatches) or the road
 * network changes (applyRoadTiles, for the "mown" ground-cover band).
 */

import * as THREE from 'three';
import { MeshStandardNodeMaterial, type MeshLambertNodeMaterial } from 'three/webgpu';
import { float, mix, uniform, vec3, vertexColor } from 'three/tsl';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { nightBodyMaterial, nightTintNode } from './nightlook';
import { createProceduralWorldEvaluator, type ProceduralWorldEvaluator } from '../world/maps';
import type { MapData, TilePoint } from '../shared/types';
import {
  CHUNK_TILES,
  CHUNKS_PER_SIDE,
  MAP_SIZE,
  MAX_BUILD_SLOPE,
  MAX_WATER_DEPTH_VIS,
  SAND_BAND_METERS,
  SEA_LEVEL,
  SHORELINE_BAND_METERS,
  TILE_METERS,
} from '../shared/constants';

// --- pure color ramp ---------------------------------------------------------

export type TerrainQuality = 'low' | 'medium' | 'high' | 'ultra';

export const TERRAIN_QUALITY_SUBDIVISIONS: Record<TerrainQuality, number> = {
  low: 1, // 1 quad per tile (16 segments per chunk, 20m vertex spacing)
  medium: 2, // 2 quads per tile (32 segments per chunk, 10m vertex spacing)
  high: 4, // 4 quads per tile (64 segments per chunk, 5m vertex spacing) - HD
  ultra: 8, // 8 quads per tile (128 segments per chunk, 2.5m vertex spacing) - UHD
};

const GRASS_MAX_HEIGHT = 130; // meters at which elevation-driven effects (patchiness) saturate
const ROCK_BLEND_RANGE = 3; // meters of slope beyond MAX_BUILD_SLOPE to fully saturate to rock
const TREE_DARKEN_MAX = 0.35; // fraction darkened at full (255) tree density (canopy-shadow read)

const WET_SAND_COLOR: readonly [number, number, number] = [0.65, 0.59, 0.45]; // compacted moist sand near the water line
const DRY_SAND_COLOR: readonly [number, number, number] = [0.86, 0.81, 0.62]; // warm sun-bleached golden beach sand
const ROCK_DARK_SLATE: readonly [number, number, number] = [0.28, 0.30, 0.34];
const ROCK_GRANITE: readonly [number, number, number] = [0.44, 0.43, 0.41];
const ROCK_LIGHT_STONE: readonly [number, number, number] = [0.56, 0.54, 0.49];
const SNOW_COLOR: readonly [number, number, number] = [0.93, 0.95, 0.98];

/** Altitude in meters where alpine snowcaps begin to appear. */
export const SNOW_MIN_HEIGHT = 400;
/** Vertical transition range in meters over which snow reaches full coverage. */
export const SNOW_BLEND_RANGE = 50;

// ---------------------------------------------------------------------------
// Seasonal ground grass/terrain tints
// ---------------------------------------------------------------------------
export const TERRAIN_WINTER_TINT: readonly [number, number, number] = [0.9, 0.94, 0.98];
export const TERRAIN_SPRING_TINT: readonly [number, number, number] = [1.02, 1.08, 0.94];
export const TERRAIN_SUMMER_TINT: readonly [number, number, number] = [1.0, 1.0, 1.0];
export const TERRAIN_AUTUMN_TINT: readonly [number, number, number] = [1.08, 0.96, 0.8];

const TERRAIN_SEASON_KEYFRAMES: ReadonlyArray<
  readonly [number, readonly [number, number, number]]
> = [
  [1, TERRAIN_WINTER_TINT],
  [4, TERRAIN_SPRING_TINT],
  [7, TERRAIN_SUMMER_TINT],
  [10, TERRAIN_AUTUMN_TINT],
];

/**
 * Calculates continuous seasonal ground tint for any calendar month [1..12].
 */
export function terrainSeasonalTint(month: number): [number, number, number] {
  const wrapped = ((((month - 1) % 12) + 12) % 12) + 1; // canonical [1, 13)
  const count = TERRAIN_SEASON_KEYFRAMES.length;
  for (let i = 0; i < count; i++) {
    const [m0, c0] = TERRAIN_SEASON_KEYFRAMES[i]!;
    const [m1raw, c1] = TERRAIN_SEASON_KEYFRAMES[(i + 1) % count]!;
    const m1 = m1raw > m0 ? m1raw : m1raw + 12;
    if (wrapped >= m0 && wrapped <= m1) {
      const t = (wrapped - m0) / (m1 - m0);
      return [
        c0[0] + (c1[0] - c0[0]) * t,
        c0[1] + (c1[1] - c0[1]) * t,
        c0[2] + (c1[2] - c0[2]) * t,
      ];
    }
  }
  return [1, 1, 1];
}

// Water rendering — terrain-side seabed/shoreline treatment. The water
// SURFACE itself (translucent plane, waves, glint) is water.ts's; this is
// only the terrain color read through/around it.
const SEABED_SHALLOW_COLOR: readonly [number, number, number] = [0.55, 0.52, 0.38]; // sandy seabed just under the surface
const SEABED_DEEP_COLOR: readonly [number, number, number] = [0.24, 0.38, 0.48]; // deep cerulean stone, fully tinted at MAX_WATER_DEPTH_VIS
const FOAM_COLOR: readonly [number, number, number] = [0.9, 0.93, 0.96]; // shoreline sand/foam highlight

// Ground cover — grass hue variants, dry patches, mown band.
const GRASS_HUE_FRESH: readonly [number, number, number] = [0.27, 0.53, 0.23];
const GRASS_HUE_OLIVE: readonly [number, number, number] = [0.36, 0.48, 0.24];
const GRASS_HUE_YELLOW: readonly [number, number, number] = [0.46, 0.54, 0.25];
const DRY_PATCH_COLOR: readonly [number, number, number] = [0.48, 0.43, 0.28];
const MOWN_GREEN_COLOR: readonly [number, number, number] = [0.26, 0.58, 0.26];

/** Low-frequency cell size (meters/cycle) for the 3-hue grass blend — the "different grass types" read. */
const GRASS_HUE_CELL_METERS = 96;
/** Higher-frequency cell size (meters/cycle) for the brown dry-patch splotches. */
const DRY_PATCH_CELL_METERS = 26;
const GRASS_HUE_SEED = 1337;
const DRY_PATCH_SEED = 9173;

// Perimeter earth cross-section skirt — TerrainRenderer.build() adds a
// vertical quad strip along each of the 4 map-boundary edges, dropping from
// the terrain surface down to a fixed base so the map edge reads as a real
// cross-section instead of "floating layers" from outside. Colors ramp
// topsoil (matches the local surface color) -> dirt brown -> rock at the
// base; a single MeshLambertMaterial, no new shader.
/** Fixed absolute elevation (meters) every skirt vertex bottoms out at, regardless of local surface height. */
const SKIRT_BASE_Y = -18;
/** Depth (meters) below the surface that still reads as topsoil before the flat dirt-brown band takes over. */
const SKIRT_TOPSOIL_METERS = 0.6;
/** Meters directly above SKIRT_BASE_Y across which dirt blends to rock (anchored to the fixed base, not the surface). */
const SKIRT_ROCK_BAND_METERS = 4;
/** #6b4a2f dirt-brown anchor. */
const SKIRT_DIRT_COLOR: readonly [number, number, number] = [0x6b / 255, 0x4a / 255, 0x2f / 255];
/** #4a3b30 rock anchor at the fixed base. */
const SKIRT_ROCK_COLOR: readonly [number, number, number] = [0x4a / 255, 0x3b / 255, 0x30 / 255];
/** Cell size (meters/cycle) for the deterministic dirt-brown variation noise. */
const SKIRT_DIRT_VARIATION_CELL_METERS = 14;
const SKIRT_DIRT_VARIATION_SEED = 4271;
/** Max +/- per-channel delta the dirt variation noise applies around the anchor. */
const SKIRT_DIRT_VARIATION_RANGE = 0.06;

// ---------------------------------------------------------------------------
// Endless backdrop terrain & continuous 360-degree horizon (LOD rings)
// ---------------------------------------------------------------------------

/** Distance in meters the continuous backdrop terrain extends outward from the playable parcel. */
export const BACKDROP_REACH_METERS = 16000;

/** Distance in meters from the parcel boundary across which terrain maintains 100% full micro-definition like in-parcel ground. */
export const BACKDROP_NEAR_ZONE_METERS = 2500;

/** Distance in meters from the parcel boundary where micro-noise and fine textures fully diffuse into smooth regional tones. */
export const BACKDROP_DIFFUSE_FAR_METERS = 8000;

/** Distance in meters from the parcel boundary where procedural natural 2D rolling relief begins to emerge. */
export const BACKDROP_RELIEF_START_METERS = 20;

/** Distance in meters from the parcel boundary where procedural macro relief reaches full undulating amplitude. */
export const BACKDROP_RELIEF_FULL_METERS = 350;

/** Number of perimeter segments per straight edge of the inner boundary (256 segments across 5120m = 20m quad width, matching city tile resolution 1:1). */
export const BACKDROP_SEGMENTS_PER_SIDE = 256;

/** Number of radial segments per corner arc (16 segments across 90-degree corner). */
export const BACKDROP_CORNER_SEGMENTS = 16;

/** Concentric LOD radial offsets (meters) with smooth isotropic geometric progression from parcel edge to horizon. */
export const BACKDROP_RING_RADII: readonly number[] = [
  0,
  10,
  20,
  32,
  46,
  62,
  80,
  100,
  122,
  146,
  172,
  200,
  230,
  262,
  296,
  332,
  370,
  410,
  452,
  496,
  542,
  590,
  640,
  692,
  746,
  802,
  860,
  920,
  982,
  1050,
  1125,
  1205,
  1290,
  1380,
  1475,
  1575,
  1680,
  1790,
  1910,
  2040,
  2180,
  2330,
  2490,
  2660,
  2840,
  3030,
  3230,
  3450,
  3690,
  3950,
  4230,
  4530,
  4860,
  5220,
  5610,
  6030,
  6490,
  6990,
  7540,
  8150,
  8820,
  9560,
  10380,
  11300,
  12340,
  13520,
  14700,
  BACKDROP_REACH_METERS, // Ring 67: 16000m horizon edge
];

/** Transition distance (meters) over which boundary edge elevation smoothly blends into macro procedural landscape. */
export const BACKDROP_BLEND_METERS = 800;

export interface DetailLevels {
  /** 2.8m - 4m micro-grain (sand grain, rock crag, lawn micro). Attenuated in near buffer to prevent Gouraud interpolation streaks. */
  readonly micro: number;
  /** 10m - 24m patches (dry grass, rock boulders, dunes). Preserved across near/mid buffer. */
  readonly mid: number;
  /** 30m - 96m broad variation (grass hues, regional tones). Active across entire panorama. */
  readonly macro: number;
}

/**
 * Multiscale anti-aliased detail levels:
 * Filters out high-frequency spatial noise before the local quad size exceeds its Nyquist wavelength,
 * completely eliminating anisotropic stretching/streaks while preserving full definition near the city.
 */
export function backdropDetailLevels(dist: number): DetailLevels {
  const micro = dist <= 80 ? 1.0 : dist >= 350 ? 0.0 : 1.0 - quinticStep(80, 350, dist);
  const mid = dist <= 250 ? 1.0 : dist >= 1600 ? 0.0 : 1.0 - quinticStep(250, 1600, dist);
  const macro = dist <= 3000 ? 1.0 : dist >= 8500 ? 0.0 : 1.0 - quinticStep(3000, 8500, dist);
  return { micro, mid, macro };
}

export function backdropDetailFactor(dist: number): number {
  return backdropDetailLevels(dist).mid;
}

/** Deterministic PRNG for backdrop macro noise. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerp3 = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/**
 * 32-bit avalanche hash of (ix, iz, seed) -> [0,1). Same technique as
 * trees.ts's tileHash (deterministic, no Math.random anywhere), a fresh
 * instance here since terrain's ground-cover noise is keyed by continuous
 * world-meter cell coordinates rather than tile indices.
 */
function hash01(ix: number, iz: number, seed: number): number {
  let h =
    (Math.imul(ix | 0, 374761393) +
      Math.imul(iz | 0, 668265263) +
      Math.imul(seed | 0, 2246822519)) >>>
    0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/** Quintic smoothstep (Perlin's improved fade curve) — smooths the value-noise lattice interpolation. */
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const quinticStep = (edge0: number, edge1: number, x: number): number =>
  fade(clamp01((x - edge0) / (edge1 - edge0)));

/**
 * Deterministic, smoothed 2D value noise in [0,1) at world (x, z) meters,
 * sampled on a lattice of `cellMeters` per cycle. Bilinear blend of the 4
 * surrounding lattice hashes with a quintic fade, so it reads as smooth
 * patches rather than a blocky grid. Pure; no Math.random/Date.now.
 */
export function valueNoise2D(x: number, z: number, cellMeters: number, seed: number): number {
  const gx = x / cellMeters;
  const gz = z / cellMeters;
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const tx = fade(gx - x0);
  const tz = fade(gz - z0);
  const h00 = hash01(x0, z0, seed);
  const h10 = hash01(x0 + 1, z0, seed);
  const h01 = hash01(x0, z0 + 1, seed);
  const h11 = hash01(x0 + 1, z0 + 1, seed);
  const top = lerp(h00, h10, tx);
  const bottom = lerp(h01, h11, tx);
  return lerp(top, bottom, tz);
}

/** Fraction (0..1) the vertex color is darkened by dense tree cover — a subtle canopy-shadow read under dense tree clusters. */
export function treeShadeFactor(treeDensity: number): number {
  const treeT = clamp01(treeDensity / 255);
  return 1 - treeT * TREE_DARKEN_MAX;
}

/**
 * Underwater seabed color ramp: sandy just under the surface, ramping to a
 * deep blue-green, fully tinted at MAX_WATER_DEPTH_VIS meters. `depth` is
 * meters below SEA_LEVEL (0 at the surface). In shallow waters (<4m), subtle
 * sandy ripples break up flat shading.
 */
export function seabedDepthColor(
  depth: number,
  worldX: number = 0,
  worldZ: number = 0,
): [number, number, number] {
  const t = fade(clamp01(depth / MAX_WATER_DEPTH_VIS));
  const base = lerp3(SEABED_SHALLOW_COLOR, SEABED_DEEP_COLOR, t);
  if (depth < 4) {
    const ripple = valueNoise2D(worldX, worldZ, 6.0, 7723);
    const shallowFactor = fade(clamp01(1 - depth / 4));
    const mod = 1 + (ripple - 0.5) * 0.14 * shallowFactor;
    return [clamp01(base[0] * mod), clamp01(base[1] * mod), clamp01(base[2] * mod)];
  }
  return base;
}

/**
 * Shoreline foam/sand band weight (0..1, peaking at 0.75 exactly at SEA_LEVEL,
 * smoothly fading to 0 at SHORELINE_BAND_METERS away on either side with zero tangent):
 * vertices within SHORELINE_BAND_METERS of SEA_LEVEL get a soft foam highlight.
 */
export function shorelineBandWeight(height: number): number {
  const dist = Math.abs(height - SEA_LEVEL);
  if (dist >= SHORELINE_BAND_METERS) return 0;
  const t = dist / SHORELINE_BAND_METERS;
  return (1 - t * t * (3 - 2 * t)) * 0.75;
}

/**
 * Procedural beach and coastal sand texture:
 * Blends from compacted wet sand at the shoreline to warm sunlit dry sand,
 * with deterministic fine grain and coastal ripple noise.
 * `detail` (0..1) allows seamless distance attenuation of micro-grain to prevent aliasing.
 */
export function sandColorAt(
  worldX: number,
  worldZ: number,
  height: number,
  detail: number | DetailLevels = 1.0,
): [number, number, number] {
  const micro = typeof detail === 'number' ? detail : detail.micro;
  const mid = typeof detail === 'number' ? detail : detail.mid;
  const wetT = quinticStep(0, 1.8, height - SEA_LEVEL);
  const baseSand = lerp3(WET_SAND_COLOR, DRY_SAND_COLOR, wetT);

  // Micro-grain noise (fine sand particles and pebbles)
  const grainNoise = valueNoise2D(worldX, worldZ, 2.8, 1193);
  // Coastal ripple noise (wind and tide ripples across dunes)
  const duneNoise = valueNoise2D(worldX, worldZ, 12, 5231);

  const factor =
    1.0 +
    (grainNoise - 0.5) * 0.12 * micro +
    (duneNoise - 0.5) * 0.08 * (0.35 + 0.65 * mid);
  return [
    clamp01(baseSand[0] * factor),
    clamp01(baseSand[1] * factor),
    clamp01(baseSand[2] * factor),
  ];
}

/** 3-hue grass blend (fresh green / olive / yellow-green) from a single low-frequency noise value in [0,1). */
function grassHueBlend(n: number): [number, number, number] {
  if (n < 0.5) return lerp3(GRASS_HUE_FRESH, GRASS_HUE_OLIVE, fade(n / 0.5));
  return lerp3(GRASS_HUE_OLIVE, GRASS_HUE_YELLOW, fade((n - 0.5) / 0.5));
}

/**
 * Dry-patch blend weight (0..1) from the higher-frequency splotch noise,
 * biased patchier where tree density is low (open plains) and at higher
 * elevation, down in lush/low areas. The noise VALUE at a
 * position never depends on treeDensity/height — only how strongly it's
 * allowed to show through does — so patchiness scales smoothly with those
 * inputs rather than snapping across a moving threshold.
 */
function dryPatchWeight(patchNoise: number, treeDensity: number, height: number): number {
  const signal = fade(clamp01((patchNoise - 0.55) / 0.45));
  const sparseT = 1 - clamp01(treeDensity / 255);
  const elevT = fade(
    clamp01((height - SEA_LEVEL - SAND_BAND_METERS) / (GRASS_MAX_HEIGHT - SAND_BAND_METERS)),
  );
  const bias = clamp01(sparseT * 0.6 + elevT * 0.4 + 0.15);
  return signal * bias;
}

/**
 * Ground-cover tint: 3 grass hue variants blended by seeded
 * low-frequency value noise, brown dry-patch splotches from a higher-
 * frequency noise (patchier where trees are sparse / elevation is high), and
 * a uniform "mown" fresh-green override on tiles within 1 of a road. Pure;
 * exported for direct testing and composed into vertexColorFor.
 * `detail` provides continuous multiscale progressive diffusion with distance.
 */
export function groundCoverTint(
  worldX: number,
  worldZ: number,
  treeDensity: number,
  height: number,
  nearRoad: boolean,
  detail: number | DetailLevels = 1.0,
): [number, number, number] {
  const micro = typeof detail === 'number' ? detail : detail.micro;
  const mid = typeof detail === 'number' ? detail : detail.mid;
  if (nearRoad) {
    const lawnMicro = valueNoise2D(worldX, worldZ, 4, 1847);
    const lawnFactor = 1.0 + (lawnMicro - 0.5) * 0.08 * micro;
    return [
      clamp01(MOWN_GREEN_COLOR[0] * lawnFactor),
      clamp01(MOWN_GREEN_COLOR[1] * lawnFactor),
      clamp01(MOWN_GREEN_COLOR[2] * lawnFactor),
    ];
  }
  const hueNoise = valueNoise2D(worldX, worldZ, GRASS_HUE_CELL_METERS, GRASS_HUE_SEED);
  const patchNoise = valueNoise2D(worldX, worldZ, DRY_PATCH_CELL_METERS, DRY_PATCH_SEED);
  const base = grassHueBlend(hueNoise);
  const patchT = dryPatchWeight(patchNoise, treeDensity, height) * (0.3 + 0.7 * mid);
  const tinted = lerp3(base, DRY_PATCH_COLOR, patchT);

  // Subtle organic micro-noise (fine grass blade / soil variation):
  // At micro = 1.0, provides full definition matching in-parcel terrain.
  // Smoothly diffuses before quad spacing exceeds Nyquist limit to prevent directional stretching:
  const bladeNoise = valueNoise2D(worldX, worldZ, 5, 3141);
  const microFactor = 1.0 + (bladeNoise - 0.5) * 0.14 * micro;
  return [
    clamp01(tinted[0] * microFactor),
    clamp01(tinted[1] * microFactor),
    clamp01(tinted[2] * microFactor),
  ];
}

/**
 * Procedural geological rock texture:
 * Sedimentary horizontal strata, mineral variations, and micro-fractures blending
 * dark basalt/slate, weathered mountain granite, and sunlit limestone layers.
 * `detail` attenuates fine crags and micro-noise with distance.
 */
export function rockColorAt(
  worldX: number,
  worldZ: number,
  height: number,
  detail: number | DetailLevels = 1.0,
): [number, number, number] {
  const micro = typeof detail === 'number' ? detail : detail.micro;
  const mid = typeof detail === 'number' ? detail : detail.mid;
  const strataNoise = valueNoise2D(worldX, worldZ, 32, 4821);
  const microNoise = valueNoise2D(worldX, worldZ, 7, 9217);
  const cragNoise = valueNoise2D(worldX, worldZ, 2.8, 3317);
  const strataBand = Math.sin(height * 0.35 + strataNoise * 3.2) * 0.5 + 0.5;

  const blendedMicro = lerp(0.5, microNoise, mid);
  const baseStone = lerp3(ROCK_DARK_SLATE, ROCK_GRANITE, blendedMicro);
  const stratified = lerp3(baseStone, ROCK_LIGHT_STONE, strataBand * 0.45);

  const cragFactor = 1.0 + (cragNoise - 0.5) * 0.14 * micro;
  return [
    clamp01(stratified[0] * cragFactor),
    clamp01(stratified[1] * cragFactor),
    clamp01(stratified[2] * cragFactor),
  ];
}

/**
 * Deterministic terrain vertex color:
 * - underwater (height < SEA_LEVEL): seabedDepthColor ramp by depth with sandy ripples.
 * - on land: natural coastal dunes and wet/dry sand fading into ground-cover tint,
 *   blended into rock where local slope exceeds MAX_BUILD_SLOPE or at high alpine altitudes.
 * - high alpine summits receive organic snowcaps on gentle ledges and mountain gullies.
 * - a shoreline foam band is blended in wherever height sits within
 *   SHORELINE_BAND_METERS of SEA_LEVEL, on either side.
 * - dense tree cover darkens the final color (canopy-shadow read).
 * - `detail` seamlessly diffuses spatial noise with distance to eliminate anisotropic stretching.
 */
export function vertexColorFor(
  height: number,
  slope: number,
  treeDensity: number,
  worldX: number,
  worldZ: number,
  nearRoad: boolean,
  detail: number | DetailLevels = 1.0,
): [number, number, number] {
  const micro = typeof detail === 'number' ? detail : detail.micro;
  const mid = typeof detail === 'number' ? detail : detail.mid;
  const macro = typeof detail === 'number' ? detail : detail.macro;
  let rgb: [number, number, number];

  if (height < SEA_LEVEL) {
    rgb = seabedDepthColor(SEA_LEVEL - height, worldX, worldZ);
  } else {
    // Multi-frequency organic dune & coastal vegetation shaping:
    // 1. Broad undulating dune formations (30m wavelength)
    const broadDune = (valueNoise2D(worldX, worldZ, 30, 6199) - 0.5) * 2.4 * macro;
    // 2. Finer vegetation tongues and sandy hollows (10m wavelength)
    const finePatch = (valueNoise2D(worldX, worldZ, 10, 8377) - 0.5) * 1.3 * mid;
    const coastalNoise = broadDune + finePatch;

    // Progressive transition from beach sand to inland ground cover:
    // Pure sand foreshore near sea level, then a gentle, progressive S-curve blend
    // across the dune band centered on SAND_BAND_METERS, eliminating hard cut lines.
    const sandT = quinticStep(
      SEA_LEVEL + 0.6,
      SEA_LEVEL + SAND_BAND_METERS + 2.0,
      height + coastalNoise,
    );
    const sand = sandColorAt(worldX, worldZ, height, { micro, mid, macro });
    const cover = groundCoverTint(worldX, worldZ, treeDensity, height, nearRoad, { micro, mid, macro });
    rgb = lerp3(sand, cover, sandT);

    // Multi-criteria rock blending with smoothstep
    const rockNoise = (valueNoise2D(worldX, worldZ, 18, 4423) - 0.5) * 1.2 * mid;
    const slopeRock = quinticStep(
      MAX_BUILD_SLOPE - 1.0,
      MAX_BUILD_SLOPE - 1.0 + ROCK_BLEND_RANGE,
      slope + rockNoise * 0.5,
    );
    // 2. High altitude transition (rock emerges naturally above 36m, dominates above 68m)
    const altitudeRock = quinticStep(36, 68, height + rockNoise * 4);
    const rockT = Math.max(slopeRock, altitudeRock * 0.9);

    if (rockT > 0) {
      const rockRgb = rockColorAt(worldX, worldZ, height, { micro, mid, macro });
      rgb = lerp3(rgb, rockRgb, rockT);
    }

    // High alpine snowcaps:
    // Above SNOW_MIN_HEIGHT, snow appears on summits and gentle high-altitude ledges,
    // perturbed organically along gullies and ridges.
    if (height > SNOW_MIN_HEIGHT - 25) {
      const snowWobble = (valueNoise2D(worldX, worldZ, 22, 7331) - 0.5) * 35 * (0.4 + 0.6 * mid);
      const effectiveSnowMin = SNOW_MIN_HEIGHT + snowWobble;
      if (height > effectiveSnowMin) {
        const snowAltitude = quinticStep(0, SNOW_BLEND_RANGE, height - effectiveSnowMin);
        const snowSlopeFactor = quinticStep(8, 2, slope);
        const fineSnow = valueNoise2D(worldX, worldZ, 6, 2911);
        const fineSnowMod = lerp(0.85, 0.65 + fineSnow * 0.45, micro);
        const snowT = clamp01(snowAltitude * snowSlopeFactor * fineSnowMod);
        rgb = lerp3(rgb, SNOW_COLOR, snowT);
      }
    }
  }

  const shoreT = shorelineBandWeight(height);
  rgb = lerp3(rgb, FOAM_COLOR, shoreT);

  const shade = treeShadeFactor(treeDensity);
  return [rgb[0] * shade, rgb[1] * shade, rgb[2] * shade];
}

/**
 * Deterministic dirt-brown variation for the skirt strata: a small
 * seeded per-position wobble around the #6b4a2f anchor so the perimeter
 * skirt's dirt band doesn't read as one flat, obviously-tiled color. Pure —
 * built on valueNoise2D, no Math.random.
 */
export function dirtColorAt(worldX: number, worldZ: number): [number, number, number] {
  const n = valueNoise2D(
    worldX,
    worldZ,
    SKIRT_DIRT_VARIATION_CELL_METERS,
    SKIRT_DIRT_VARIATION_SEED,
  );
  const t = (n - 0.5) * 2 * SKIRT_DIRT_VARIATION_RANGE; // roughly [-range, +range]
  return [
    clamp01(SKIRT_DIRT_COLOR[0] + t),
    clamp01(SKIRT_DIRT_COLOR[1] + t * 0.7),
    clamp01(SKIRT_DIRT_COLOR[2] + t * 0.5),
  ];
}

/**
 * Earth cross-section color at absolute height `y` on the
 * perimeter skirt hanging below a boundary vertex whose terrain surface sits
 * at `surfaceHeight` with color `surfaceColor` (that same edge vertex's
 * vertexColorFor output, so the skirt's top row reads seamlessly against the
 * terrain chunk it hangs from):
 * - at or above the surface: the surface color itself (clamped — never
 *   reads "above ground").
 * - a thin topsoil band (SKIRT_TOPSOIL_METERS deep) blending the surface
 *   color into `dirtColorAt(worldX, worldZ)`.
 * - a flat dirt-brown middle.
 * - across the last SKIRT_ROCK_BAND_METERS immediately above the fixed
 *   SKIRT_BASE_Y, dirt blends to the rock anchor; below SKIRT_BASE_Y it's
 *   saturated rock. This band is anchored to the absolute base rather than
 *   the surface, so a tall edge gets a long flat dirt run while a low edge
 *   still shows the full rock transition just above the base.
 * Pure and exported for direct testing; TerrainRenderer's skirt geometry
 * calls this verbatim per row so the rendered strata match exactly.
 */
export function skirtColorAt(
  y: number,
  surfaceHeight: number,
  surfaceColor: readonly [number, number, number],
  worldX: number,
  worldZ: number,
): [number, number, number] {
  const depthBelowSurface = surfaceHeight - y;
  if (depthBelowSurface <= 0) return [surfaceColor[0], surfaceColor[1], surfaceColor[2]];

  const dirt = dirtColorAt(worldX, worldZ);
  if (depthBelowSurface <= SKIRT_TOPSOIL_METERS) {
    return lerp3(surfaceColor, dirt, depthBelowSurface / SKIRT_TOPSOIL_METERS);
  }

  const rockBandTop = SKIRT_BASE_Y + SKIRT_ROCK_BAND_METERS;
  const rockT = clamp01((rockBandTop - y) / SKIRT_ROCK_BAND_METERS);
  return lerp3(dirt, SKIRT_ROCK_COLOR, rockT);
}

/** Which chunk a tile coordinate belongs to. */
export function chunkOfTile(x: number, z: number): { cx: number; cz: number } {
  return { cx: Math.floor(x / CHUNK_TILES), cz: Math.floor(z / CHUNK_TILES) };
}

const chunkKey = (cx: number, cz: number): number => cz * CHUNKS_PER_SIDE + cx;
const clampInt = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

interface ChunkEntry {
  mesh: THREE.Mesh;
}

/** The 4 map-boundary edges the skirt covers — each built exactly once, meeting at the 4 corners. */
type SkirtSide = 'west' | 'east' | 'north' | 'south';
const SKIRT_SIDES: readonly SkirtSide[] = ['west', 'east', 'north', 'south'];
/** Exported so tests (and any future caller) can assert scene child counts without hard-coding the number of sides. */
export const SKIRT_SIDE_COUNT = SKIRT_SIDES.length;
/** Rows per skirt column: surface, topsoil-band bottom, rock-band top, fixed base — see skirtColorAt. */
const SKIRT_ROWS = 4;

interface SkirtEntry {
  mesh: THREE.Mesh;
}

export class TerrainRenderer {
  private readonly scene: THREE.Scene;
  private readonly material: MeshStandardNodeMaterial;
  private readonly skirtMaterial: MeshLambertNodeMaterial;
  /** 0 (day) .. 1 (night): what the ground's colour shades by. */
  private readonly nightFactorUniform = uniform(0);
  /** 0 (dry) .. 1 (drenched): wetness from rain / storms. */
  private readonly wetnessUniform = uniform(0);
  /** 0 (none) .. 1 (full blanket): snow cover accumulation. */
  private readonly snowCoverUniform = uniform(0);
  /** RGB tint for the current calendar month / season. */
  private readonly seasonTintUniform = uniform(new THREE.Vector3(1, 1, 1));

  private chunks: (ChunkEntry | null)[];
  private skirts: Record<SkirtSide, SkirtEntry | null>;
  private backdropMesh: THREE.Mesh | null = null;
  private dirtyBackdrop = false;
  private readonly backdropNoise: NoiseFunction2D;
  private map: MapData | null = null;
  private worldEvaluator: ProceduralWorldEvaluator | null = null;
  private quality: TerrainQuality = 'high';
  private subdivisionsPerTile = TERRAIN_QUALITY_SUBDIVISIONS.high;
  private readonly dirtyChunks = new Set<number>();
  /** Which perimeter sides need their skirt geometry rebuilt on next update(). */
  private readonly dirtySides = new Set<SkirtSide>();
  /** Flat-index (z*size+x) set of tiles currently carrying a road — drives the "mown" band. */
  private roadTiles = new Set<number>();

  constructor(scene: THREE.Scene, quality: TerrainQuality = 'high') {
    this.scene = scene;
    this.quality = quality;
    this.subdivisionsPerTile = TERRAIN_QUALITY_SUBDIVISIONS[quality] ?? 4;
    this.chunks = new Array<ChunkEntry | null>(CHUNKS_PER_SIDE * CHUNKS_PER_SIDE).fill(null);
    this.skirts = { west: null, east: null, north: null, south: null };
    this.backdropNoise = createNoise2D(mulberry32(0x517cc1b7));

    // Environmental surface shading: seasonal vegetation tint, wetness darkening + specular sheen,
    // snow accumulation overlay, and night tint.
    const vCol = vertexColor();
    const seasonalColor = vCol.mul(this.seasonTintUniform);
    // Water reduces diffuse scattering, deepening and saturating wet soil/grass/rock
    const wetDarken = mix(vec3(1, 1, 1), vec3(0.74, 0.74, 0.77), this.wetnessUniform);
    const dayGround = seasonalColor.mul(wetDarken);
    // Snow accumulation overlay
    const snowGround = mix(dayGround, vec3(0.96, 0.97, 1.0), this.snowCoverUniform);
    const nightTint = nightTintNode(this.nightFactorUniform);

    this.material = new MeshStandardNodeMaterial({
      vertexColors: false,
      roughness: 0.9,
      metalness: 0.05,
    });
    this.material.colorNode = snowGround.mul(nightTint);

    // Wetness drops roughness (puddle sheen / specular shine), snow is soft matte
    this.material.roughnessNode = mix(
      float(0.9).sub(this.wetnessUniform.mul(0.45)),
      float(0.85),
      this.snowCoverUniform,
    );
    this.material.metalnessNode = mix(
      float(0.05).add(this.wetnessUniform.mul(0.2)),
      float(0.02),
      this.snowCoverUniform,
    );

    // Skirt: DoubleSide so the perimeter reads correctly regardless of which
    // way the camera happens to be facing it from.
    this.skirtMaterial = nightBodyMaterial(this.nightFactorUniform, {
      vertexColors: true,
      side: THREE.DoubleSide,
    });
  }

  /** Dynamically updates the mesh quad density according to graphic quality settings. */
  setQuality(quality: TerrainQuality): void {
    const subs = TERRAIN_QUALITY_SUBDIVISIONS[quality] ?? 4;
    if (this.quality === quality && this.subdivisionsPerTile === subs) return;
    this.quality = quality;
    this.subdivisionsPerTile = subs;
    if (this.map) {
      this.rebuildAll();
    }
  }

  getQuality(): TerrainQuality {
    return this.quality;
  }

  private rebuildAll(): void {
    for (let cz = 0; cz < CHUNKS_PER_SIDE; cz++) {
      for (let cx = 0; cx < CHUNKS_PER_SIDE; cx++) {
        this.refreshChunk(cx, cz);
      }
    }
    for (const side of SKIRT_SIDES) {
      this.refreshSkirt(side);
    }
    this.refreshBackdrop();
  }

  /** Updates environment uniforms: nightFactor, wetness (rain), snowCover, and calendar month (season). */
  setEnvironment(
    nightFactor: number,
    wetness = 0,
    snowCover = 0,
    month = 7,
  ): void {
    this.nightFactorUniform.value = clamp01(nightFactor);
    this.wetnessUniform.value = clamp01(wetness);
    this.snowCoverUniform.value = clamp01(snowCover);

    const [sr, sg, sb] = terrainSeasonalTint(month);
    this.seasonTintUniform.value.set(sr, sg, sb);
  }

  /** 0 (day) .. 1 (night): how far the ground shades toward the night tint. */
  setNightFactor(nightFactor: number): void {
    this.nightFactorUniform.value = Math.min(1, Math.max(0, nightFactor));
  }

  nightFactor(): number {
    return this.nightFactorUniform.value;
  }

  build(map: MapData): void {
    this.map = map;
    if (map.seed !== undefined) {
      this.worldEvaluator = createProceduralWorldEvaluator(map.seed, map.options, map.size);
    } else {
      this.worldEvaluator = null;
    }
    this.dirtyChunks.clear();
    this.dirtySides.clear();
    this.dirtyBackdrop = false;
    this.roadTiles = new Set();
    this.disposeChunks();
    this.disposeSkirts();
    this.disposeBackdrop();

    for (let cz = 0; cz < CHUNKS_PER_SIDE; cz++) {
      for (let cx = 0; cx < CHUNKS_PER_SIDE; cx++) {
        const mesh = this.buildChunkMesh(cx, cz);
        this.chunks[chunkKey(cx, cz)] = { mesh };
        this.scene.add(mesh);
      }
    }

    for (const side of SKIRT_SIDES) {
      const mesh = this.buildSkirtMesh(side);
      // Continuous backdrop terrain extends beyond the parcel; skirts are kept dormant
      mesh.visible = false;
      this.skirts[side] = { mesh };
      this.scene.add(mesh);
    }

    this.backdropMesh = this.buildBackdropMesh();
    this.scene.add(this.backdropMesh);
  }

  /**
   * Height in meters at a tile corner (worldX/Z = cornerIx/cornerIz *
   * TILE_METERS) — the bilinear average of the four map cells meeting there.
   * These are the exact values makeChunkGeometry writes into the terrain mesh
   * vertices, so heightAt() (below) reproduces the *rendered* surface rather
   * than a separate interpolation that would drift from it between corners.
   */
  private cornerHeight(cornerIx: number, cornerIz: number): number {
    const map = this.map;
    if (!map) return 0;
    const size = map.size;
    const h = map.height;
    const cx0 = clampInt(cornerIx - 1, 0, size - 1);
    const cx1 = clampInt(cornerIx, 0, size - 1);
    const cz0 = clampInt(cornerIz - 1, 0, size - 1);
    const cz1 = clampInt(cornerIz, 0, size - 1);
    return (
      0.25 *
      (h[cz0 * size + cx0]! + h[cz0 * size + cx1]! + h[cz1 * size + cx0]! + h[cz1 * size + cx1]!)
    );
  }

  /**
   * Evaluates the Hermite-interpolated surface elevation along the exact playable perimeter [0..mapMeters].
   * Clamped to ensure zero out-of-bounds sampling and airtight boundary seam alignment.
   */
  private sampleBoundaryHeight(x: number, z: number): number {
    if (!this.map) return 0;
    const mapMeters = this.map.size * TILE_METERS;
    const cx = Math.min(mapMeters, Math.max(0, x));
    const cz = Math.min(mapMeters, Math.max(0, z));
    const gx = cx / TILE_METERS;
    const gz = cz / TILE_METERS;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const u = gx - ix;
    const v = gz - iz;
    if (u === 0 && v === 0) return this.cornerHeight(ix, iz);

    const su = u * u * (3 - 2 * u);
    const sv = v * v * (3 - 2 * v);
    const h00 = this.cornerHeight(ix, iz);
    const h10 = this.cornerHeight(ix + 1, iz);
    const h01 = this.cornerHeight(ix, iz + 1);
    const h11 = this.cornerHeight(ix + 1, iz + 1);

    const top = h00 + (h10 - h00) * su;
    const bottom = h01 + (h11 - h01) * su;
    return top + (bottom - top) * sv;
  }

  /**
   * Computes the directional outward slope (dh/ddist) of the terrain at the city boundary.
   * Samples 10m inside the boundary to establish C1 tangent slope continuity across the boundary.
   */
  private boundaryOutwardSlope(edgeX: number, edgeZ: number): number {
    const map = this.map;
    if (!map) return 0;
    const mapMeters = map.size * TILE_METERS;
    const step = 10;

    const edgeH = this.sampleBoundaryHeight(edgeX, edgeZ);
    let insideH = edgeH;

    if (edgeZ <= 0) {
      insideH = this.sampleBoundaryHeight(edgeX, step);
    } else if (edgeZ >= mapMeters) {
      insideH = this.sampleBoundaryHeight(edgeX, mapMeters - step);
    } else if (edgeX <= 0) {
      insideH = this.sampleBoundaryHeight(step, edgeZ);
    } else if (edgeX >= mapMeters) {
      insideH = this.sampleBoundaryHeight(mapMeters - step, edgeZ);
    }

    const slope = (edgeH - insideH) / step;
    return Math.min(0.12, Math.max(-0.12, slope));
  }

  /**
   * Procedural terrain elevation beyond the playable city parcel.
   * Seamlessly continues boundary edge elevation and tangent slope outward without flat shelves or walls,
   * gradually introducing gentle rolling hills at mid-distance and majestic mountain silhouettes far away.
   */
  backdropHeightAt(x: number, z: number): number {
    const map = this.map;
    if (!map) return 0;
    const mapMeters = map.size * TILE_METERS;

    const edgeX = Math.min(mapMeters, Math.max(0, x));
    const edgeZ = Math.min(mapMeters, Math.max(0, z));
    const edgeHeight = this.sampleBoundaryHeight(edgeX, edgeZ);

    const dx = x < 0 ? -x : x > mapMeters ? x - mapMeters : 0;
    const dz = z < 0 ? -z : z > mapMeters ? z - mapMeters : 0;
    const dist = Math.hypot(dx, dz);
    if (dist <= 0) return edgeHeight;

    let height: number;
    if (this.worldEvaluator) {
      // 1. Natural procedural world continuation: exactly evaluates the continuous world generator
      // (meandering river channels, valleys, coastlines, mountain ranges) across the landscape:
      const tileX = x / TILE_METERS;
      const tileZ = z / TILE_METERS;
      const rawProceduralH = this.worldEvaluator.heightAt(tileX, tileZ);

      // Boundary stitching: blend out any delta between chunk edge height (e.g. terraforming, road grades)
      // and untouched procedural terrain across 250m:
      const edgeTileX = edgeX / TILE_METERS;
      const edgeTileZ = edgeZ / TILE_METERS;
      const edgeProceduralH = this.worldEvaluator.heightAt(edgeTileX, edgeTileZ);
      const seamDelta = edgeHeight - edgeProceduralH;
      const deltaWeight = 1.0 - quinticStep(0, 250, dist);

      // C1 outward slope continuity across the boundary:
      const outwardSlope = this.boundaryOutwardSlope(edgeX, edgeZ);
      const tangentOffset = outwardSlope * dist * (1.0 - quinticStep(10, 180, dist));

      height = rawProceduralH + seamDelta * deltaWeight + tangentOffset;
    } else {
      // Fallback for custom raster maps without procedural seed:
      const outwardSlope = this.boundaryOutwardSlope(edgeX, edgeZ);
      const tangentDecay = 1.0 - quinticStep(20, 300, dist);
      const tangentOffset = outwardSlope * dist * tangentDecay;

      const n1 = this.backdropNoise(x * 0.0004, z * 0.0004);
      const n1Edge = this.backdropNoise(edgeX * 0.0004, edgeZ * 0.0004);
      const rolling = (n1 - n1Edge) * 18;

      const n2 = this.backdropNoise(x * 0.0009 + 17.3, z * 0.0009 + 31.7);
      const n2Edge = this.backdropNoise(edgeX * 0.0009 + 17.3, edgeZ * 0.0009 + 31.7);
      const foothills = (n2 - n2Edge) * 10;
      const reliefWeight = quinticStep(20, 350, dist);

      if (edgeHeight < SEA_LEVEL) {
        const wobble = Math.sin(dist * 0.03) * 10;
        height = Math.min(SEA_LEVEL - 1.5, edgeHeight - Math.min(10, (dist / 1500) * 4) + wobble * 0.2);
      } else {
        height = Math.max(SEA_LEVEL + 0.8, edgeHeight + tangentOffset + (rolling + foothills) * reliefWeight);
      }
    }

    // Horizon elevation taper: as distance approaches BACKDROP_REACH_METERS (dist > 8500m),
    // mountains gently subside into sea-level coastal plains and ocean:
    if (dist > 8500) {
      const taperT = quinticStep(8500, BACKDROP_REACH_METERS, dist);
      height = lerp(height, SEA_LEVEL + 1.5, taperT);
    }

    return height;
  }

  /**
   * World-space surface height in meters, matching the *triangulated* terrain
   * mesh exactly (not a bilinear approximation that only agrees at corners).
   * Each terrain quad is split by PlaneGeometry along the u+v=1 diagonal into
   * triangles (H00,H10,H01) and (H11,H01,H10); we interpolate within whichever
   * triangle the point falls in. This is what keeps roads, driveways, aprons
   * and props sitting flush on the surface they conform to instead of dipping
   * below a terrain bulge and letting it poke through. Edge-clamped via
   * cornerHeight; 0 before build().
   */
  heightAt(x: number, z: number): number {
    if (!this.map) return 0;
    const mapMeters = this.map.size * TILE_METERS;
    if (x < 0 || x > mapMeters || z < 0 || z > mapMeters) {
      return this.backdropHeightAt(x, z);
    }
    const gx = x / TILE_METERS;
    const gz = z / TILE_METERS;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const u = gx - ix;
    const v = gz - iz;
    if (u === 0 && v === 0) return this.cornerHeight(ix, iz);

    // Smooth cubic Hermite interpolation between tile corners:
    // Produces a continuous, curved surface (C1 slope continuity) across tile boundaries,
    // eliminating straight planar facets and sharp polygonal diagonal creases.
    const su = u * u * (3 - 2 * u);
    const sv = v * v * (3 - 2 * v);
    const h00 = this.cornerHeight(ix, iz);
    const h10 = this.cornerHeight(ix + 1, iz);
    const h01 = this.cornerHeight(ix, iz + 1);
    const h11 = this.cornerHeight(ix + 1, iz + 1);

    const top = h00 + (h10 - h00) * su;
    const bottom = h01 + (h11 - h01) * su;
    return top + (bottom - top) * sv;
  }

  /**
   * Continuous analytical terrain surface normal at (x, z):
   * derives normal from the continuous central height gradient, guaranteeing
   * bit-for-bit identical normals across mesh boundaries (eliminating lighting creases).
   */
  surfaceNormalAt(x: number, z: number): [number, number, number] {
    const eps = 0.5;
    const hL = this.heightAt(x - eps, z);
    const hR = this.heightAt(x + eps, z);
    const hD = this.heightAt(x, z - eps);
    const hU = this.heightAt(x, z + eps);
    const dhdx = (hR - hL) / (2 * eps);
    const dhdz = (hU - hD) / (2 * eps);
    const len = Math.hypot(dhdx, 1, dhdz);
    return [-dhdx / len, 1 / len, -dhdz / len];
  }

  /**
   * Marks a tile-space rectangle dirty; affected chunks rebuild on next
   * update(). Also marks any perimeter skirt side(s) the rectangle
   * touches (tile column 0 / size-1, or row 0 / size-1) — the same tile
   * columns/rows heightAt's edge-clamping means the boundary skirt vertices
   * actually sample from, so this covers both real edits (terraform) and
   * cosmetic ones (a road painted next to the map edge, which shifts the
   * skirt's top-row "mown" color via applyRoadTiles's own markDirty call).
   */
  markDirty(minX: number, minZ: number, maxX: number, maxZ: number): void {
    // One tile of halo, because a rendered corner averages the four tiles
    // around it (see cornerHeight). A tile on a chunk boundary therefore owns
    // vertices the NEXT chunk draws too — rebuild only the patched chunk and
    // the neighbour keeps the old height for their shared edge, tearing the
    // two meshes apart into a crack you can see the water through.
    const lo = chunkOfTile(Math.min(minX, maxX) - 1, Math.min(minZ, maxZ) - 1);
    const hi = chunkOfTile(Math.max(minX, maxX) + 1, Math.max(minZ, maxZ) + 1);
    const czLo = Math.max(0, lo.cz);
    const czHi = Math.min(CHUNKS_PER_SIDE - 1, hi.cz);
    const cxLo = Math.max(0, lo.cx);
    const cxHi = Math.min(CHUNKS_PER_SIDE - 1, hi.cx);
    for (let cz = czLo; cz <= czHi; cz++) {
      for (let cx = cxLo; cx <= cxHi; cx++) {
        this.dirtyChunks.add(chunkKey(cx, cz));
      }
    }

    const size = this.map?.size ?? MAP_SIZE;
    const xLo = Math.min(minX, maxX);
    const xHi = Math.max(minX, maxX);
    const zLo = Math.min(minZ, maxZ);
    const zHi = Math.max(minZ, maxZ);
    if (xLo <= 0 && 0 <= xHi) this.dirtySides.add('west');
    if (xLo <= size - 1 && size - 1 <= xHi) this.dirtySides.add('east');
    if (zLo <= 0 && 0 <= zHi) this.dirtySides.add('north');
    if (zLo <= size - 1 && size - 1 <= zHi) this.dirtySides.add('south');
    if (xLo <= 1 || xHi >= size - 2 || zLo <= 1 || zHi >= size - 2) {
      this.dirtyBackdrop = true;
    }
  }

  /**
   * Applies worker-derived height-patch updates (emitted after
   * terraform strokes, terraformSet undo/redo restores, and loadSave) to the
   * height source and marks exactly the chunks the patch's tile rectangle
   * covers dirty, so they rebuild on the next update(). No-op before the
   * first build() (matches heightAt's "0 before build" defensive style).
   */
  applyHeightPatches(
    patches: readonly { x: number; z: number; w: number; h: number; heights: Float32Array }[],
  ): void {
    const map = this.map;
    if (!map) return;
    const size = map.size;
    for (const patch of patches) {
      for (let row = 0; row < patch.h; row++) {
        const z = patch.z + row;
        if (z < 0 || z >= size) continue;
        const rowBase = row * patch.w;
        for (let col = 0; col < patch.w; col++) {
          const x = patch.x + col;
          if (x < 0 || x >= size) continue;
          const v = patch.heights[rowBase + col];
          if (v !== undefined) map.height[z * size + x] = v;
        }
      }
      this.markDirty(patch.x, patch.z, patch.x + patch.w - 1, patch.z + patch.h - 1);
    }
  }

  /**
   * Ground cover: replaces the tracked set of road tiles (drives the
   * "within 1 tile of a road -> uniform mown fresh-green" band) and marks
   * every chunk touched by a tile that entered or left the road set dirty,
   * so the manicured band stays in sync as the network changes.
   */
  applyRoadTiles(tiles: readonly TilePoint[]): void {
    const size = this.map?.size ?? MAP_SIZE;
    const next = new Set<number>();
    for (const t of tiles) {
      if (t.x < 0 || t.z < 0 || t.x >= size || t.z >= size) continue;
      next.add(t.z * size + t.x);
    }

    const touched = new Set<number>();
    for (const key of this.roadTiles) if (!next.has(key)) touched.add(key);
    for (const key of next) if (!this.roadTiles.has(key)) touched.add(key);

    this.roadTiles = next;

    for (const key of touched) {
      const x = key % size;
      const z = Math.floor(key / size);
      this.markDirty(x - 1, z - 1, x + 1, z + 1);
    }
  }

  /** Rebuilds dirty chunk geometry and any perimeter skirt side(s) touched since the last update(). */
  update(): void {
    if (this.map && this.dirtyChunks.size > 0) {
      for (const key of this.dirtyChunks) {
        const cz = Math.floor(key / CHUNKS_PER_SIDE);
        const cx = key % CHUNKS_PER_SIDE;
        this.refreshChunk(cx, cz);
      }
      this.dirtyChunks.clear();
    }
    if (this.map && this.dirtySides.size > 0) {
      for (const side of this.dirtySides) {
        this.refreshSkirt(side);
      }
      this.dirtySides.clear();
    }
    if (this.map && this.dirtyBackdrop && this.backdropMesh) {
      this.refreshBackdrop();
      this.dirtyBackdrop = false;
    }
  }

  private refreshChunk(cx: number, cz: number): void {
    const entry = this.chunks[chunkKey(cx, cz)];
    if (!entry) return;
    entry.mesh.geometry.dispose();
    entry.mesh.geometry = this.makeChunkGeometry(cx, cz);
  }

  private refreshSkirt(side: SkirtSide): void {
    const entry = this.skirts[side];
    if (!entry) return;
    entry.mesh.geometry.dispose();
    entry.mesh.geometry = this.makeSkirtGeometry(side);
  }

  private buildChunkMesh(cx: number, cz: number): THREE.Mesh {
    const geometry = this.makeChunkGeometry(cx, cz);
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    // The ground stays solid underground: it is what the pipes run under.
    mesh.userData['underground'] = 'keep';
    return mesh;
  }

  private makeChunkGeometry(cx: number, cz: number): THREE.BufferGeometry {
    const chunkMeters = CHUNK_TILES * TILE_METERS;
    // Chunk quads scaled by quality subdivision factor
    const segments = CHUNK_TILES * this.subdivisionsPerTile;
    const geometry = new THREE.PlaneGeometry(chunkMeters, chunkMeters, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(cx * chunkMeters + chunkMeters / 2, 0, cz * chunkMeters + chunkMeters / 2);

    const position = geometry.attributes.position;
    if (!position) throw new Error('terrain chunk geometry is missing its position attribute');

    const count = position.count;
    const colors = new Float32Array(count * 3);
    const map = this.map;
    const trees = map?.trees ?? null;
    const mapSize = map?.size ?? MAP_SIZE;

    for (let i = 0; i < count; i++) {
      const worldX = position.getX(i);
      const worldZ = position.getZ(i);
      const h = this.heightAt(worldX, worldZ);
      position.setY(i, h);

      const [r, g, b] = this.terrainColorAt(worldX, worldZ, h, trees, mapSize);
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    position.needsUpdate = true;
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    // Stitch boundary vertices along the map perimeter to exact analytical surface normals:
    const mapMeters = mapSize * TILE_METERS;
    const normals = geometry.attributes.normal;
    if (normals) {
      for (let i = 0; i < count; i++) {
        const wx = position.getX(i);
        const wz = position.getZ(i);
        if (
          wx <= 0.001 ||
          wx >= mapMeters - 0.001 ||
          wz <= 0.001 ||
          wz >= mapMeters - 0.001
        ) {
          const [nx, ny, nz] = this.surfaceNormalAt(wx, wz);
          normals.setXYZ(i, nx, ny, nz);
        }
      }
      normals.needsUpdate = true;
    }

    return geometry;
  }

  /**
   * Continuous bilinear Hermite interpolation of tree density from the tile grid.
   * Eliminates sharp stair-stepped shading lines along 20m tile boundaries.
   */
  private treeDensityAt(
    worldX: number,
    worldZ: number,
    trees: Uint8Array | null,
    mapSize: number,
  ): number {
    if (!trees) return 0;
    const gx = worldX / TILE_METERS - 0.5;
    const gz = worldZ / TILE_METERS - 0.5;
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const u = gx - x0;
    const v = gz - z0;
    const su = u * u * (3 - 2 * u);
    const sv = v * v * (3 - 2 * v);

    const cx0 = clampInt(x0, 0, mapSize - 1);
    const cx1 = clampInt(x0 + 1, 0, mapSize - 1);
    const cz0 = clampInt(z0, 0, mapSize - 1);
    const cz1 = clampInt(z0 + 1, 0, mapSize - 1);

    const t00 = trees[cz0 * mapSize + cx0] ?? 0;
    const t10 = trees[cz0 * mapSize + cx1] ?? 0;
    const t01 = trees[cz1 * mapSize + cx0] ?? 0;
    const t11 = trees[cz1 * mapSize + cx1] ?? 0;

    const top = t00 + (t10 - t00) * su;
    const bottom = t01 + (t11 - t01) * su;
    return top + (bottom - top) * sv;
  }

  /**
   * The terrain surface's own vertex color at a world position whose height
   * is already known (`h`) — the exact same slope/tree-density/near-road
   * inputs makeChunkGeometry feeds vertexColorFor, factored out so the
   * skirt's top row can call it verbatim and read seamlessly against
   * the terrain chunk it hangs from (no separate/approximate surface color).
   */
  private terrainColorAt(
    worldX: number,
    worldZ: number,
    h: number,
    trees: Uint8Array | null,
    mapSize: number,
  ): [number, number, number] {
    const slope = this.slopeAt(worldX, worldZ);
    const tileX = clampInt(Math.floor(worldX / TILE_METERS), 0, mapSize - 1);
    const tileZ = clampInt(Math.floor(worldZ / TILE_METERS), 0, mapSize - 1);
    const density = this.treeDensityAt(worldX, worldZ, trees, mapSize);
    const nearRoad = this.isNearRoad(tileX, tileZ);
    return vertexColorFor(h, slope, density, worldX, worldZ, nearRoad);
  }

  private buildSkirtMesh(side: SkirtSide): THREE.Mesh {
    const geometry = this.makeSkirtGeometry(side);
    const mesh = new THREE.Mesh(geometry, this.skirtMaterial);
    mesh.name = `skirt-${side}`;
    mesh.userData['underground'] = 'keep';
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    return mesh;
  }

  /**
   * One vertical quad-strip column per boundary vertex along `side`
   * (MAP_SIZE*subdivisions+1 of them, so adjoining sides meet exactly at the 4
   * corners with no gap/overlap and seamlessly match the subdivided terrain chunk edge).
   */
  private makeSkirtGeometry(side: SkirtSide): THREE.BufferGeometry {
    const map = this.map;
    const mapSize = map?.size ?? MAP_SIZE;
    const trees = map?.trees ?? null;
    const columns = MAP_SIZE * this.subdivisionsPerTile + 1;
    const rockBandTop = SKIRT_BASE_Y + SKIRT_ROCK_BAND_METERS;

    const positions = new Float32Array(columns * SKIRT_ROWS * 3);
    const colors = new Float32Array(columns * SKIRT_ROWS * 3);

    for (let col = 0; col < columns; col++) {
      const { wx, wz } = this.skirtColumnWorld(side, col);
      const surfaceHeight = this.heightAt(wx, wz);
      const surfaceColor = this.terrainColorAt(wx, wz, surfaceHeight, trees, mapSize);

      const topsoilBottom = Math.min(
        surfaceHeight,
        Math.max(surfaceHeight - SKIRT_TOPSOIL_METERS, SKIRT_BASE_Y),
      );
      const rockTop = Math.min(topsoilBottom, rockBandTop);
      const rowYs: readonly [number, number, number, number] = [
        surfaceHeight,
        topsoilBottom,
        rockTop,
        SKIRT_BASE_Y,
      ];

      for (let row = 0; row < SKIRT_ROWS; row++) {
        const vi = col * SKIRT_ROWS + row;
        const y = rowYs[row]!;
        positions[vi * 3] = wx;
        positions[vi * 3 + 1] = y;
        positions[vi * 3 + 2] = wz;

        const [r, g, b] = skirtColorAt(y, surfaceHeight, surfaceColor, wx, wz);
        colors[vi * 3] = r;
        colors[vi * 3 + 1] = g;
        colors[vi * 3 + 2] = b;
      }
    }

    const indices: number[] = [];
    for (let col = 0; col < columns - 1; col++) {
      for (let row = 0; row < SKIRT_ROWS - 1; row++) {
        const a = col * SKIRT_ROWS + row;
        const b = col * SKIRT_ROWS + row + 1;
        const c = (col + 1) * SKIRT_ROWS + row;
        const d = (col + 1) * SKIRT_ROWS + row + 1;
        indices.push(a, b, d, a, d, c);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  /** World (x, z) of the `col`-th boundary vertex along a perimeter side. */
  private skirtColumnWorld(side: SkirtSide, col: number): { wx: number; wz: number } {
    const extent = MAP_SIZE * TILE_METERS;
    const along = (col / this.subdivisionsPerTile) * TILE_METERS;
    switch (side) {
      case 'west':
        return { wx: 0, wz: along };
      case 'east':
        return { wx: extent, wz: along };
      case 'north':
        return { wx: along, wz: 0 };
      case 'south':
        return { wx: along, wz: extent };
    }
  }

  /** Local slope proxy: max height delta to the four axis neighbors one tile away. */
  private slopeAt(x: number, z: number): number {
    const d = TILE_METERS;
    const c = this.heightAt(x, z);
    const n = this.heightAt(x, z - d);
    const s = this.heightAt(x, z + d);
    const e = this.heightAt(x + d, z);
    const w = this.heightAt(x - d, z);
    return Math.max(Math.abs(c - n), Math.abs(c - s), Math.abs(c - e), Math.abs(c - w));
  }

  /** Whether any of the 8 neighbors (or the tile itself) carries a road — the "within 1 tile" rule. */
  private isNearRoad(tileX: number, tileZ: number): boolean {
    if (this.roadTiles.size === 0) return false;
    const size = this.map?.size ?? MAP_SIZE;
    for (let dz = -1; dz <= 1; dz++) {
      const z = tileZ + dz;
      if (z < 0 || z >= size) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const x = tileX + dx;
        if (x < 0 || x >= size) continue;
        if (this.roadTiles.has(z * size + x)) return true;
      }
    }
    return false;
  }

  /**
   * Deterministic surface vertex color for the backdrop terrain:
   * blends seamlessly from parcel boundary tree density and slope shading
   * into procedural beaches, inland grass/soil, slope rock, stratified cliffs,
   * snowcaps on distant high-altitude peaks, and tree canopy shading.
   * Progressively diffuses micro-detail with distance to eliminate aliasing/distortion.
   */
  backdropColorAt(wx: number, wz: number, h: number): [number, number, number] {
    const map = this.map;
    const mapSize = map?.size ?? MAP_SIZE;
    const mapMeters = mapSize * TILE_METERS;

    const edgeX = Math.min(mapMeters, Math.max(0, wx));
    const edgeZ = Math.min(mapMeters, Math.max(0, wz));
    const dx = wx < 0 ? -wx : wx > mapMeters ? wx - mapMeters : 0;
    const dz = wz < 0 ? -wz : wz > mapMeters ? wz - mapMeters : 0;
    const dist = Math.hypot(dx, dz);

    let slope: number;
    if (dist <= 60) {
      // In the immediate perimeter (dist <= 60m), match the exact slope calculation used inside the city parcel:
      slope = this.slopeAt(wx, wz);
    } else {
      // Symmetrically sample 2D slope matching local mesh scale:
      const slopeStep = Math.max(TILE_METERS, Math.min(100, dist * 0.04));
      const hN = this.backdropHeightAt(wx, wz - slopeStep);
      const hS = this.backdropHeightAt(wx, wz + slopeStep);
      const hE = this.backdropHeightAt(wx + slopeStep, wz);
      const hW = this.backdropHeightAt(wx - slopeStep, wz);
      slope =
        Math.max(Math.abs(h - hN), Math.abs(h - hS), Math.abs(h - hE), Math.abs(h - hW)) *
        (TILE_METERS / slopeStep);
    }

    // 2D organic woodland density: seam-locked to edgeDensity at dist = 0,
    // seamlessly transitioning across 20m-160m into 2D isotropic procedural woodlands:
    const edgeDensity = this.treeDensityAt(edgeX, edgeZ, map?.trees ?? null, mapSize);
    let proceduralDensity: number;
    if (this.worldEvaluator) {
      proceduralDensity = this.worldEvaluator.treeDensityAt(wx / TILE_METERS, wz / TILE_METERS, h);
    } else {
      const treeNoise = valueNoise2D(wx, wz, 160, 5431);
      const slopeFactor = quinticStep(10, 4, slope);
      const altFactor = quinticStep(SEA_LEVEL, SEA_LEVEL + 1.5, h) * quinticStep(75, 45, h);
      const treeSignal = clamp01((treeNoise - 0.40) * 2.5);
      proceduralDensity = Math.round(treeSignal * slopeFactor * altFactor * 190);
    }
    const blendT = quinticStep(20, 160, dist);
    let treeDensity = Math.round(lerp(edgeDensity, proceduralDensity, blendT));
    if (dist > 2200) {
      const taper = quinticStep(3500, 2200, dist);
      treeDensity = Math.round(treeDensity * taper);
    }

    // Road manicured mown grass band extends 80m past dead-end boundary roads:
    const tileX = clampInt(Math.floor(edgeX / TILE_METERS), 0, mapSize - 1);
    const tileZ = clampInt(Math.floor(edgeZ / TILE_METERS), 0, mapSize - 1);
    const nearRoad = dist <= 80 && this.isNearRoad(tileX, tileZ);

    // Multiscale anti-aliased detail levels:
    const details = backdropDetailLevels(dist);

    return vertexColorFor(h, slope, treeDensity, wx, wz, nearRoad, details);
  }

  private buildBackdropMesh(): THREE.Mesh {
    const geometry = this.makeBackdropGeometry();
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.name = 'terrain-backdrop';
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData['underground'] = 'keep';
    return mesh;
  }

  /**
   * Non-shearing 8-sector concentric LOD rings expanding outward from the 5120m playable parcel to 16000m horizon.
   * Straight edges project perpendicularly with zero lateral shear, while corners expand in smooth quarter-circle fans.
   * Ring 0 anchors exactly onto boundary edge coordinates, guaranteeing zero gaps.
   */
  private makeBackdropGeometry(): THREE.BufferGeometry {
    const map = this.map;
    const mapSize = map?.size ?? MAP_SIZE;
    const mapMeters = mapSize * TILE_METERS;
    const ringCount = BACKDROP_RING_RADII.length;
    // Perimeter segment count scales with quality subdivisions so Ring 0 vertices align 1:1 with chunk boundaries:
    const N = mapSize * this.subdivisionsPerTile;
    const C = 16 * this.subdivisionsPerTile;
    const perimeterCount = 4 * N + 4 * C;
    const totalVertices = ringCount * perimeterCount;

    const positions = new Float32Array(totalVertices * 3);
    const colors = new Float32Array(totalVertices * 3);

    for (let ringIdx = 0; ringIdx < ringCount; ringIdx++) {
      const r = BACKDROP_RING_RADII[ringIdx]!;
      const ringBase = ringIdx * perimeterCount;
      let p = 0;

      // Sector 1: South edge (s = 0 .. N-1) - pure orthogonal projection along -Z
      for (let s = 0; s < N; s++, p++) {
        const wx = (s / N) * mapMeters;
        const wz = -r;
        this.setBackdropVertex(ringBase + p, ringIdx, wx, wz, positions, colors);
      }

      // Sector 2: South-East corner (c = 0 .. C-1) - smooth circular quarter-arc
      for (let c = 0; c < C; c++, p++) {
        const theta = (c / C) * (Math.PI / 2);
        const wx = mapMeters + r * Math.sin(theta);
        const wz = -r * Math.cos(theta);
        this.setBackdropVertex(ringBase + p, ringIdx, wx, wz, positions, colors);
      }

      // Sector 3: East edge (s = 0 .. N-1) - pure orthogonal projection along +X
      for (let s = 0; s < N; s++, p++) {
        const wx = mapMeters + r;
        const wz = (s / N) * mapMeters;
        this.setBackdropVertex(ringBase + p, ringIdx, wx, wz, positions, colors);
      }

      // Sector 4: North-East corner (c = 0 .. C-1) - smooth circular quarter-arc
      for (let c = 0; c < C; c++, p++) {
        const theta = (c / C) * (Math.PI / 2);
        const wx = mapMeters + r * Math.cos(theta);
        const wz = mapMeters + r * Math.sin(theta);
        this.setBackdropVertex(ringBase + p, ringIdx, wx, wz, positions, colors);
      }

      // Sector 5: North edge (s = 0 .. N-1) - pure orthogonal projection along +Z
      for (let s = 0; s < N; s++, p++) {
        const wx = mapMeters - (s / N) * mapMeters;
        const wz = mapMeters + r;
        this.setBackdropVertex(ringBase + p, ringIdx, wx, wz, positions, colors);
      }

      // Sector 6: North-West corner (c = 0 .. C-1) - smooth circular quarter-arc
      for (let c = 0; c < C; c++, p++) {
        const theta = (c / C) * (Math.PI / 2);
        const wx = -r * Math.sin(theta);
        const wz = mapMeters + r * Math.cos(theta);
        this.setBackdropVertex(ringBase + p, ringIdx, wx, wz, positions, colors);
      }

      // Sector 7: West edge (s = 0 .. N-1) - pure orthogonal projection along -X
      for (let s = 0; s < N; s++, p++) {
        const wx = -r;
        const wz = mapMeters - (s / N) * mapMeters;
        this.setBackdropVertex(ringBase + p, ringIdx, wx, wz, positions, colors);
      }

      // Sector 8: South-West corner (c = 0 .. C-1) - smooth circular quarter-arc
      for (let c = 0; c < C; c++, p++) {
        const theta = (c / C) * (Math.PI / 2);
        const wx = -r * Math.cos(theta);
        const wz = -r * Math.sin(theta);
        this.setBackdropVertex(ringBase + p, ringIdx, wx, wz, positions, colors);
      }
    }

    const indices: number[] = [];
    for (let ringIdx = 0; ringIdx < ringCount - 1; ringIdx++) {
      const innerBase = ringIdx * perimeterCount;
      const outerBase = (ringIdx + 1) * perimeterCount;

      for (let p = 0; p < perimeterCount; p++) {
        const nextP = (p + 1) % perimeterCount;

        const i00 = innerBase + p;
        const i10 = innerBase + nextP;
        const i01 = outerBase + p;
        const i11 = outerBase + nextP;

        indices.push(i00, i10, i01);
        indices.push(i10, i11, i01);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // Stitch Ring 0 vertices to exact analytical surface normals, guaranteeing bit-for-bit
    // normal equality with chunk boundary vertices (eliminating lighting creases):
    const normals = geometry.attributes.normal;
    if (normals) {
      for (let p = 0; p < perimeterCount; p++) {
        const wx = positions[p * 3]!;
        const wz = positions[p * 3 + 2]!;
        const [nx, ny, nz] = this.surfaceNormalAt(wx, wz);
        normals.setXYZ(p, nx, ny, nz);
      }
      normals.needsUpdate = true;
    }

    return geometry;
  }

  private setBackdropVertex(
    vi: number,
    ringIdx: number,
    wx: number,
    wz: number,
    positions: Float32Array,
    colors: Float32Array,
  ): void {
    const h = ringIdx === 0 ? this.sampleBoundaryHeight(wx, wz) : this.backdropHeightAt(wx, wz);
    const [cr, cg, cb] = this.backdropColorAt(wx, wz, h);

    positions[vi * 3] = wx;
    positions[vi * 3 + 1] = h;
    positions[vi * 3 + 2] = wz;

    colors[vi * 3] = cr;
    colors[vi * 3 + 1] = cg;
    colors[vi * 3 + 2] = cb;
  }

  private refreshBackdrop(): void {
    if (!this.backdropMesh) return;
    this.backdropMesh.geometry.dispose();
    this.backdropMesh.geometry = this.makeBackdropGeometry();
  }

  private disposeBackdrop(): void {
    if (this.backdropMesh) {
      this.scene.remove(this.backdropMesh);
      this.backdropMesh.geometry.dispose();
      this.backdropMesh = null;
    }
  }

  private disposeChunks(): void {
    for (const entry of this.chunks) {
      if (entry) {
        this.scene.remove(entry.mesh);
        entry.mesh.geometry.dispose();
      }
    }
    this.chunks = new Array<ChunkEntry | null>(CHUNKS_PER_SIDE * CHUNKS_PER_SIDE).fill(null);
    this.disposeBackdrop();
  }

  private disposeSkirts(): void {
    for (const side of SKIRT_SIDES) {
      const entry = this.skirts[side];
      if (entry) {
        this.scene.remove(entry.mesh);
        entry.mesh.geometry.dispose();
      }
    }
    this.skirts = { west: null, east: null, north: null, south: null };
  }
}
