import { describe, it, expect } from 'vitest';
import { TerrainGenerator, BIOME_WATER, BIOME_GRASS } from '@core/terrain_data';

describe('TerrainGenerator (Procedural Determinism)', () => {
  it('debe generar exactamente la misma topografía con idéntica semilla', () => {
    const seed = 9876;
    const terrainA = TerrainGenerator.generate(16, 16, 2.0, seed);
    const terrainB = TerrainGenerator.generate(16, 16, 2.0, seed);

    expect(terrainA.heights.length).toBe(terrainB.heights.length);
    expect(terrainA.biomes.length).toBe(terrainB.biomes.length);

    for (let i = 0; i < terrainA.heights.length; i++) {
      expect(terrainA.heights[i]).toBe(terrainB.heights[i]);
    }

    for (let i = 0; i < terrainA.biomes.length; i++) {
      expect(terrainA.biomes[i]).toBe(terrainB.biomes[i]);
    }
  });

  it('debe clasificar celdas en agua y tierra correctamente según la altura', () => {
    const terrain = TerrainGenerator.generate(32, 32, 2.0, 123);
    let hasWater = false;
    let hasGrass = false;

    for (let i = 0; i < terrain.biomes.length; i++) {
      if (terrain.biomes[i] === BIOME_WATER) hasWater = true;
      if (terrain.biomes[i] === BIOME_GRASS) hasGrass = true;
    }

    expect(hasWater).toBe(true);
    expect(hasGrass).toBe(true);
  });
});
