/**
 * CityVI map data: a deterministic procedural
 * fallback terrain generator, plus a pure raster-to-grid resampler for
 * AI-generated map packs. No I/O and no three.js/DOM here — PNG decoding to
 * pixels happens elsewhere; this module only turns numbers into numbers.
 */

import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { MAP_SIZE, MAX_BUILD_SLOPE, SEA_LEVEL } from '../shared/constants';
import type { MapData, MapOptions, TilePoint } from '../shared/types';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — seeds simplex-noise's permutation table
// so the same numeric seed always produces the same noise field.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Fractal Brownian motion over a simplex-noise field. Each octave's simplex
// sample is in [-1, 1], and a weighted average of such samples stays within
// [-1, 1] too, so fbm(...) is bounded there regardless of octave count.
// ---------------------------------------------------------------------------

function fbm(
  noise: NoiseFunction2D,
  x: number,
  z: number,
  octaves: number,
  lacunarity: number,
  gain: number,
): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * noise(x * frequency, z * frequency);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

// ---------------------------------------------------------------------------
// Shared buildability + spawn selection. Deliberately independent of
// GridState/isBuildable in grid.ts: MapData has no zone/road/building
// layers yet at generation time, so this checks only terrain (water+slope)
// directly against the raw height/water arrays.
// ---------------------------------------------------------------------------

function terrainBuildable(
  size: number,
  height: Float32Array,
  water: Uint8Array,
  x: number,
  z: number,
): boolean {
  if (x < 0 || z < 0 || x >= size || z >= size) return false;
  const i = z * size + x;
  if (water[i]) return false;

  const h = height[i]!;
  const offsets: ReadonlyArray<readonly [number, number]> = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  for (const [ox, oz] of offsets) {
    const nx = x + ox;
    const nz = z + oz;
    if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
    const nh = height[nz * size + nx]!;
    if (Math.abs(h - nh) > MAX_BUILD_SLOPE) return false;
  }
  return true;
}

/** Nearest-to-center buildable tile, searching outward ring by ring. */
function findSpawn(size: number, height: Float32Array, water: Uint8Array): TilePoint {
  const cx = Math.floor(size / 2);
  const cz = Math.floor(size / 2);

  if (terrainBuildable(size, height, water, cx, cz)) {
    return { x: cx, z: cz };
  }

  const maxRadius = size; // generous — the ring search bails out via inner bounds checks
  for (let r = 1; r <= maxRadius; r++) {
    let best: TilePoint | null = null;
    let bestDist = Infinity;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; // ring border only
        const x = cx + dx;
        const z = cz + dz;
        if (!terrainBuildable(size, height, water, x, z)) continue;
        const dist = dx * dx + dz * dz;
        if (dist < bestDist) {
          bestDist = dist;
          best = { x, z };
        }
      }
    }
    if (best) return best;
  }

  // No buildable tile anywhere on the map (degenerate terrain) — fall back
  // to the clamped center so spawn is always at least in bounds.
  return { x: clamp(cx, 0, size - 1), z: clamp(cz, 0, size - 1) };
}

// ---------------------------------------------------------------------------
// Procedural generation
// ---------------------------------------------------------------------------

const TERRAIN_FREQUENCY = 1 / 96;
const TERRAIN_OCTAVES = 5;
const TERRAIN_LACUNARITY = 2;
const TERRAIN_GAIN = 0.5;

const TREE_FREQUENCY = 1 / 24;
const TREE_OCTAVES = 3;
const TREE_LACUNARITY = 2;
const TREE_GAIN = 0.5;
// Distinguishes the tree and feature noise streams from the terrain stream
// even when derived from the same seed.
const TREE_SEED_SALT = 0x9e3779b9;
const FEATURE_SEED_SALT = 0x85ebca6b;

/**
 * Deterministic simplex-noise FBM terrain influenced by MapOptions:
 * elevation range scaled by relief, water coverage driven by waterLevel,
 * macro terrain shaping driven by archetype (valley river, coastal bay, plains,
 * island archipelago, or mountain pass), and vegetation density driven by treeDensity.
 * Spawn is placed on the most-buildable land tile nearest to the map center.
 */
export interface ProceduralWorldEvaluator {
  heightAt(tileX: number, tileZ: number): number;
  treeDensityAt(tileX: number, tileZ: number, height: number): number;
}

/**
 * Continuous deterministic procedural world evaluator.
 * Evaluates the exact mathematical elevation and tree coverage for ANY tile coordinates (tileX, tileZ),
 * seamlessly extending valleys, meandering rivers, coastlines, and mountain ranges across the infinite horizon.
 */
export function createProceduralWorldEvaluator(
  seed: number,
  options?: MapOptions,
  size = MAP_SIZE,
): ProceduralWorldEvaluator {
  const relief = options?.relief ?? 0.5;
  const waterLevel = options?.waterLevel ?? 0.4;
  const treeDensity = options?.treeDensity ?? 0.5;
  const archetype = options?.archetype ?? 'valley';

  const terrainNoise = createNoise2D(mulberry32(seed));
  const treeNoise = createNoise2D(mulberry32((seed ^ TREE_SEED_SALT) >>> 0));
  const featureNoise = createNoise2D(mulberry32((seed ^ FEATURE_SEED_SALT) >>> 0));

  const maxPeakAltitude = 10 + relief * 500;

  function heightAt(tileX: number, tileZ: number): number {
    const nx = (tileX / (size - 1)) * 2 - 1;
    const nz = (tileZ / (size - 1)) * 2 - 1;
    const distFromCenter = Math.sqrt(nx * nx + nz * nz);

    let baseLandform: number;
    let mountainMask: number;

    switch (archetype) {
      case 'coastal': {
        baseLandform = (nx + 0.05) * 12 - (waterLevel - 0.4) * 14;
        mountainMask = Math.max(0, (nx - 0.2) * 1.5);
        break;
      }

      case 'island': {
        const radial = 0.65 - distFromCenter;
        baseLandform = radial * 18 - (waterLevel - 0.4) * 16;
        mountainMask = Math.max(0, (radial - 0.15) * 1.6);
        break;
      }

      case 'plains': {
        baseLandform = 8 - (waterLevel - 0.4) * 16;
        mountainMask = 0.05;
        break;
      }

      case 'mountain': {
        baseLandform = 10 - (waterLevel - 0.4) * 16;
        const pass = (featureNoise(tileX * 0.008, tileZ * 0.008) + 1) * 0.5;
        mountainMask = Math.max(0.3, pass * 1.3);
        break;
      }

      case 'custom': {
        const continent = featureNoise(tileX * 0.008, tileZ * 0.008);
        baseLandform = continent * 14 - (waterLevel - 0.4) * 16;
        mountainMask = Math.max(0, (continent - 0.1) * 1.4);
        break;
      }

      case 'valley':
      default: {
        const flankDist = Math.abs(nx);
        baseLandform = 8 - (waterLevel - 0.4) * 16;
        mountainMask = Math.max(0, (flankDist - 0.28) * 1.8);

        // Meandering river flowing through the center of the valley
        const riverCenter =
          size / 2 + Math.sin(tileZ * 0.04) * 18 + featureNoise(0, tileZ * 0.02) * 12;
        const distToRiver = Math.abs(tileX - riverCenter);

        const riverWidth = 8;
        if (distToRiver < riverWidth) {
          const t = distToRiver / riverWidth;
          // Smooth cubic hermite curve (smoothstep): seamless zero-derivative blend at bank
          const trench = 1 - t * t * (3 - 2 * t);
          baseLandform -= trench * 14;
        }
        break;
      }
    }

    const rollingNoise =
      fbm(
        terrainNoise,
        tileX * TERRAIN_FREQUENCY,
        tileZ * TERRAIN_FREQUENCY,
        TERRAIN_OCTAVES,
        TERRAIN_LACUNARITY,
        TERRAIN_GAIN,
      ) * 10;

    const mFreq1 = 1 / 140;
    const mFreq2 = 1 / 70;
    const r1 = 1.0 - Math.abs(terrainNoise(tileX * mFreq1, tileZ * mFreq1));
    const r2 = 1.0 - Math.abs(terrainNoise((tileX + 127) * mFreq2, (tileZ + 311) * mFreq2));
    const ridgeSample = Math.pow(r1 * 0.7 + r2 * 0.3, 1.4);
    const mountainAltitude = ridgeSample * maxPeakAltitude * mountainMask;

    return baseLandform + rollingNoise + mountainAltitude;
  }

  function treeDensityAt(tileX: number, tileZ: number, h: number): number {
    if (h < SEA_LEVEL) return 0;
    const t = fbm(
      treeNoise,
      tileX * TREE_FREQUENCY,
      tileZ * TREE_FREQUENCY,
      TREE_OCTAVES,
      TREE_LACUNARITY,
      TREE_GAIN,
    );
    const baseTree = (t + 1) / 2;

    const treeLineStart = Math.min(220, maxPeakAltitude * 0.5);
    let biomeFactor = 1.0;
    if (h < 1.5) {
      biomeFactor = 0.15;
    } else if (h > treeLineStart) {
      biomeFactor = Math.max(0, 1 - (h - treeLineStart) / 60);
    }

    const finalTree = baseTree * biomeFactor * (treeDensity * 1.6);
    return clamp(Math.round(finalTree * 255), 0, 255);
  }

  return { heightAt, treeDensityAt };
}

export function generateProceduralMap(seed: number, name: string, options?: MapOptions): MapData {
  const size = MAP_SIZE;
  const n = size * size;

  const evaluator = createProceduralWorldEvaluator(seed, options, size);

  const height = new Float32Array(n);
  const water = new Uint8Array(n);
  const trees = new Uint8Array(n);

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const i = z * size + x;
      const h = evaluator.heightAt(x, z);
      height[i] = h;
      const isWater = h < SEA_LEVEL;
      water[i] = isWater ? 1 : 0;
      trees[i] = isWater ? 0 : evaluator.treeDensityAt(x, z, h);
    }
  }

  const spawn = findSpawn(size, height, water);

  return { name, size, height, water, trees, seaLevel: SEA_LEVEL, spawn, seed, options };
}

// ---------------------------------------------------------------------------
// Raster map decoding — pure resample (bilinear) from already-decoded
// source pixels onto the MAP_SIZE grid. PNG bytes -> pixels happens
// elsewhere; this function is pure math.
// ---------------------------------------------------------------------------

export interface RasterMapSource {
  width: number;
  height: number;
  heightPx: Uint8ClampedArray | Uint16Array;
  treePx?: Uint8ClampedArray;
}

export interface DecodeMapOptions {
  name: string;
  minHeight: number;
  maxHeight: number;
  seaLevel: number;
}

/** Maps a destination index to a source coordinate, pixel-center aligned. */
function sampleCoord(dstIndex: number, dstSize: number, srcSize: number): number {
  if (srcSize <= 1) return 0;
  const raw = (dstIndex + 0.5) * (srcSize / dstSize) - 0.5;
  return clamp(raw, 0, srcSize - 1);
}

function bilinear(
  getPixel: (col: number, row: number) => number,
  srcW: number,
  srcH: number,
  sx: number,
  sz: number,
): number {
  const x0 = Math.floor(sx);
  const z0 = Math.floor(sz);
  const x1 = Math.min(srcW - 1, x0 + 1);
  const z1 = Math.min(srcH - 1, z0 + 1);
  const fx = sx - x0;
  const fz = sz - z0;

  const v00 = getPixel(x0, z0);
  const v10 = getPixel(x1, z0);
  const v01 = getPixel(x0, z1);
  const v11 = getPixel(x1, z1);

  const top = v00 + (v10 - v00) * fx;
  const bottom = v01 + (v11 - v01) * fx;
  return top + (bottom - top) * fz;
}

/**
 * Pure resample of already-decoded raster pixels onto the MAP_SIZE grid.
 * Tiles below `opts.seaLevel` become water; tree density comes from
 * `raw.treePx` if supplied (resampled the same way), else 0 everywhere, and
 * is always suppressed under water regardless of source.
 */
export function decodeMap(raw: RasterMapSource, opts: DecodeMapOptions): MapData {
  const size = MAP_SIZE;
  const n = size * size;
  const srcW = raw.width;
  const srcH = raw.height;
  const heightPx = raw.heightPx;
  const treePx = raw.treePx;
  const maxRaw = heightPx instanceof Uint16Array ? 65535 : 255;
  const heightRange = opts.maxHeight - opts.minHeight;

  const getHeightPixel = (col: number, row: number): number => heightPx[row * srcW + col]!;
  const getTreePixel = treePx
    ? (col: number, row: number): number => treePx[row * srcW + col]!
    : undefined;

  const height = new Float32Array(n);
  const water = new Uint8Array(n);
  const trees = new Uint8Array(n);

  for (let z = 0; z < size; z++) {
    const sz = sampleCoord(z, size, srcH);
    for (let x = 0; x < size; x++) {
      const sx = sampleCoord(x, size, srcW);
      const i = z * size + x;

      const rawHeight = bilinear(getHeightPixel, srcW, srcH, sx, sz);
      const norm = rawHeight / maxRaw;
      const h = opts.minHeight + norm * heightRange;
      height[i] = h;

      const isWater = h < opts.seaLevel;
      water[i] = isWater ? 1 : 0;

      if (!isWater && getTreePixel) {
        const rawTree = bilinear(getTreePixel, srcW, srcH, sx, sz);
        trees[i] = clamp(Math.round(rawTree), 0, 255);
      } else {
        trees[i] = 0;
      }
    }
  }

  const spawn = findSpawn(size, height, water);

  return { name: opts.name, size, height, water, trees, seaLevel: opts.seaLevel, spawn };
}
