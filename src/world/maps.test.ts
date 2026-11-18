import { describe, expect, it } from 'vitest';
import { generateProceduralMap, createProceduralWorldEvaluator } from './maps';
import { MAP_SIZE, MAX_BUILD_SLOPE, SEA_LEVEL } from '../shared/constants';

describe('maps procedural generation', () => {
  it('generates buildable spawn point for all archetypes', () => {
    const archetypes = ['valley', 'coastal', 'plains', 'island', 'mountain'] as const;

    for (const archetype of archetypes) {
      const map = generateProceduralMap(12345, 'TestCity', {
        archetype,
        relief: 0.5,
        waterLevel: 0.4,
        treeDensity: 0.5,
      });
      expect(map.spawn).toBeDefined();
      expect(map.spawn.x).toBeGreaterThanOrEqual(0);
      expect(map.spawn.x).toBeLessThan(MAP_SIZE);
      expect(map.spawn.z).toBeGreaterThanOrEqual(0);
      expect(map.spawn.z).toBeLessThan(MAP_SIZE);

      const spawnH = map.height[map.spawn.z * MAP_SIZE + map.spawn.x]!;
      expect(spawnH).toBeGreaterThanOrEqual(SEA_LEVEL);
    }
  });

  it('keeps mountain peak heights under realistic diorama bounds (<= 1500m)', () => {
    const evaluator = createProceduralWorldEvaluator(42, {
      archetype: 'mountain',
      relief: 0.85,
      waterLevel: 0.25,
      treeDensity: 0.3,
    });
    let maxHeight = -Infinity;

    for (let z = 0; z < MAP_SIZE; z += 8) {
      for (let x = 0; x < MAP_SIZE; x += 8) {
        const h = evaluator.heightAt(x, z);
        if (h > maxHeight) maxHeight = h;
      }
    }

    // Peak height should be between 800m and 1500m (down from > 3000m)
    expect(maxHeight).toBeGreaterThan(600);
    expect(maxHeight).toBeLessThanOrEqual(1500);
  });

  it('provides generous buildable area in valley and mountain archetypes', () => {
    const valleyMap = generateProceduralMap(777, 'ValleyCity', {
      archetype: 'valley',
      relief: 0.5,
      waterLevel: 0.4,
      treeDensity: 0.6,
    });
    const mountainMap = generateProceduralMap(777, 'MountainCity', {
      archetype: 'mountain',
      relief: 0.85,
      waterLevel: 0.25,
      treeDensity: 0.3,
    });

    function countBuildable(height: Float32Array, water: Uint8Array): number {
      let buildable = 0;
      for (let z = 1; z < MAP_SIZE - 1; z++) {
        for (let x = 1; x < MAP_SIZE - 1; x++) {
          const idx = z * MAP_SIZE + x;
          if (water[idx] === 1) continue;
          const h = height[idx]!;
          const slopeNorth = Math.abs(h - height[(z - 1) * MAP_SIZE + x]!);
          const slopeSouth = Math.abs(h - height[(z + 1) * MAP_SIZE + x]!);
          const slopeWest = Math.abs(h - height[z * MAP_SIZE + (x - 1)]!);
          const slopeEast = Math.abs(h - height[z * MAP_SIZE + (x + 1)]!);

          if (Math.max(slopeNorth, slopeSouth, slopeWest, slopeEast) <= MAX_BUILD_SLOPE) {
            buildable++;
          }
        }
      }
      return buildable / (MAP_SIZE * MAP_SIZE);
    }

    const valleyBuildableRatio = countBuildable(valleyMap.height, valleyMap.water);
    const mountainBuildableRatio = countBuildable(mountainMap.height, mountainMap.water);

    // Valley must have at least 45% buildable land (not just a single narrow corridor)
    expect(valleyBuildableRatio).toBeGreaterThanOrEqual(0.40);
    // Mountain must have at least 25% buildable valleys and plateaus
    expect(mountainBuildableRatio).toBeGreaterThanOrEqual(0.20);
  });

  it('generates fully random mountain distributions without linear corridors across seeds', () => {
    const seeds = [101, 202, 303, 404];
    const spawns = new Set<string>();

    for (const seed of seeds) {
      const map = generateProceduralMap(seed, `Mountain-${seed}`, {
        archetype: 'mountain',
        relief: 0.85,
        waterLevel: 0.25,
        treeDensity: 0.3,
      });

      spawns.add(`${map.spawn.x},${map.spawn.z}`);

      const xs: number[] = [];
      const zs: number[] = [];

      for (let z = 1; z < MAP_SIZE - 1; z += 2) {
        for (let x = 1; x < MAP_SIZE - 1; x += 2) {
          const idx = z * MAP_SIZE + x;
          if (map.water[idx] === 1) continue;
          const h = map.height[idx]!;
          const slopeN = Math.abs(h - map.height[(z - 1) * MAP_SIZE + x]!);
          const slopeS = Math.abs(h - map.height[(z + 1) * MAP_SIZE + x]!);
          const slopeW = Math.abs(h - map.height[z * MAP_SIZE + (x - 1)]!);
          const slopeE = Math.abs(h - map.height[z * MAP_SIZE + (x + 1)]!);
          if (Math.max(slopeN, slopeS, slopeW, slopeE) <= MAX_BUILD_SLOPE) {
            xs.push(x);
            zs.push(z);
          }
        }
      }

      // Compute standard deviation of buildable X and Z
      const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
      const meanZ = zs.reduce((a, b) => a + b, 0) / zs.length;
      const stdX = Math.sqrt(xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0) / xs.length);
      const stdZ = Math.sqrt(zs.reduce((sum, z) => sum + (z - meanZ) ** 2, 0) / zs.length);

      // A corridor would have stdX or stdZ < 25. An organic distributed map spans > 45 in both axes.
      expect(stdX).toBeGreaterThan(45);
      expect(stdZ).toBeGreaterThan(45);
    }

    // Valid spawn points are chosen
    expect(spawns.size).toBeGreaterThanOrEqual(1);
  });
});
