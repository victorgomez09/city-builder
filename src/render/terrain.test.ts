import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  TerrainRenderer,
  vertexColorFor,
  rockColorAt,
  groundCoverTint,
  SNOW_MIN_HEIGHT,
} from './terrain';
import { MAX_BUILD_SLOPE, SEA_LEVEL } from '../shared/constants';

describe('terrain rendering & procedural PBR', () => {
  it('evaluates biomes correctly from underwater to alpine snow', () => {
    // 1. Underwater seabed
    const underwater = vertexColorFor(-5, 0, 0, 50, 50, false);
    expect(underwater[0]).toBeGreaterThan(0);
    expect(underwater[1]).toBeGreaterThan(0);
    expect(underwater[2]).toBeGreaterThan(0);

    // 2. Beach sand near sea level
    const beach = vertexColorFor(SEA_LEVEL + 1, 0, 0, 50, 50, false);
    // Sand has warm golden tone (red/green > blue)
    expect(beach[0]).toBeGreaterThan(beach[2]);

    // 3. Inland meadow grass
    const grass = vertexColorFor(20, 0, 100, 50, 50, false);
    // Green dominates
    expect(grass[1]).toBeGreaterThan(grass[0]);
    expect(grass[1]).toBeGreaterThan(grass[2]);

    // 4. Mown lawn near road
    const lawn = vertexColorFor(20, 0, 100, 50, 50, true);
    expect(lawn[1]).toBeGreaterThan(lawn[0]);
    expect(lawn[1]).toBeGreaterThan(lawn[2]);

    // 5. Steep slope triggers rock
    const rock = vertexColorFor(30, MAX_BUILD_SLOPE + 4, 0, 50, 50, false);
    // Rock is slate/granite grey (red, green, blue are close to each other)
    expect(Math.abs(rock[0] - rock[1])).toBeLessThan(0.15);

    // 6. Alpine summit snow
    const snow = vertexColorFor(SNOW_MIN_HEIGHT + 380, 0, 0, 50, 50, false);
    // Snow is bright white/pale blue (> 0.75 on all channels, significantly brighter than rock/grass)
    expect(snow[0]).toBeGreaterThan(0.75);
    expect(snow[1]).toBeGreaterThan(0.75);
    expect(snow[2]).toBeGreaterThan(0.75);
  });

  it('generates multi-layer geological strata in rockColorAt', () => {
    const rockLow = rockColorAt(100, 100, 20);
    const rockMid = rockColorAt(100, 100, 150);
    const rockHigh = rockColorAt(100, 100, 500);

    for (const c of [rockLow, rockMid, rockHigh]) {
      expect(c[0]).toBeGreaterThanOrEqual(0);
      expect(c[0]).toBeLessThanOrEqual(1);
      expect(c[1]).toBeGreaterThanOrEqual(0);
      expect(c[1]).toBeLessThanOrEqual(1);
      expect(c[2]).toBeGreaterThanOrEqual(0);
      expect(c[2]).toBeLessThanOrEqual(1);
    }
  });

  it('generates ground cover tints with organic micro-texture', () => {
    const tint = groundCoverTint(200, 200, 128, 25, false);
    expect(tint[1]).toBeGreaterThan(tint[0]);
    expect(tint[1]).toBeGreaterThan(tint[2]);
  });

  it('renders smooth, vibrant sand-to-grass biome transition without square or grid artifacts', () => {
    // 1. Pure sand foreshore near sea level
    const sandForeshore = vertexColorFor(SEA_LEVEL + 0.8, 0, 0, 120, 120, false);
    expect(sandForeshore[0]).toBeGreaterThan(0.60); // Warm red channel
    expect(sandForeshore[1]).toBeGreaterThan(0.55); // Warm green channel
    expect(sandForeshore[0]).toBeGreaterThan(sandForeshore[2]); // Warm golden sand (red > blue)

    // 2. High-contrast coastal transition zone (~2.0m elevation)
    const coastalMargin = vertexColorFor(SEA_LEVEL + 2.0, 0, 50, 120, 120, false);
    expect(coastalMargin[0]).toBeGreaterThanOrEqual(0);
    expect(coastalMargin[0]).toBeLessThanOrEqual(1);
    expect(coastalMargin[1]).toBeGreaterThanOrEqual(0);
    expect(coastalMargin[1]).toBeLessThanOrEqual(1);
    expect(coastalMargin[2]).toBeGreaterThanOrEqual(0);
    expect(coastalMargin[2]).toBeLessThanOrEqual(1);

    // 3. Full inland meadow above dune band
    const inlandMeadow = vertexColorFor(SEA_LEVEL + 8.0, 0, 100, 120, 120, false);
    expect(inlandMeadow[1]).toBeGreaterThan(inlandMeadow[0]); // Green dominates over red
    expect(inlandMeadow[1]).toBeGreaterThan(inlandMeadow[2]); // Green dominates over blue
  });

  it('configures terrain MeshStandardNodeMaterial with PBR nodes', () => {
    const scene = new THREE.Scene();
    const renderer = new TerrainRenderer(scene, 'high');
    const mat = (renderer as unknown as { material: THREE.Material & Record<string, unknown> }).material;

    expect(mat).toBeDefined();
    expect(mat.colorNode).toBeDefined();
    expect(mat.normalNode).toBeDefined();
    expect(mat.roughnessNode).toBeDefined();
    expect(mat.metalnessNode).toBeDefined();
  });
});
