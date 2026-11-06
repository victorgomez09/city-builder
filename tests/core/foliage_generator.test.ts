import { describe, it, expect } from 'vitest';
import { TerrainGenerator, BIOME_WATER, BIOME_SAND, BIOME_ROCK } from '@core/terrain_data';
import { FoliageGenerator } from '@core/world/foliage_generator';

describe('FoliageGenerator (World-wide Vegetation & Ecological Bioclimatics)', () => {
  const terrainData = TerrainGenerator.generate(128, 128, 2.0, 1337);

  it('debe generar una población sustancial de árboles y arbustos por TODO el mundo', () => {
    const points = FoliageGenerator.generateWorldFoliage(terrainData, 1337);

    // Debe poblar densamente todo el mapa (más de 1.500 elementos de vegetación)
    expect(points.length).toBeGreaterThan(1500);

    const trees = points.filter((p) => p.type === 'tree');
    const bushes = points.filter((p) => p.type === 'bush');

    expect(trees.length).toBeGreaterThan(1000);
    expect(bushes.length).toBeGreaterThan(300);
  });

  it('debe distribuir vegetación en todos los cuadrantes del mapa (Norte, Sur, Este y Oeste)', () => {
    const points = FoliageGenerator.generateWorldFoliage(terrainData, 1337);

    let northCount = 0;
    let southCount = 0;
    let eastCount = 0;
    let westCount = 0;

    for (const pt of points) {
      if (pt.z < 0) northCount++;
      else southCount++;

      if (pt.x > 0) eastCount++;
      else westCount++;
    }

    // Ningún cuadrante debe estar desprovisto de vegetación
    expect(northCount).toBeGreaterThan(300);
    expect(southCount).toBeGreaterThan(200);
    expect(eastCount).toBeGreaterThan(300);
    expect(westCount).toBeGreaterThan(300);
  });

  it('no debe plantar árboles dentro de masas de agua (h <= 1.55m)', () => {
    const points = FoliageGenerator.generateWorldFoliage(terrainData, 1337);

    for (const pt of points) {
      expect(pt.y).toBeGreaterThan(1.55);
    }
  });

  it('debe ser determinista con la misma semilla', () => {
    const runA = FoliageGenerator.generateWorldFoliage(terrainData, 42);
    const runB = FoliageGenerator.generateWorldFoliage(terrainData, 42);

    expect(runA.length).toBe(runB.length);
    for (let i = 0; i < Math.min(100, runA.length); i++) {
      expect(runA[i]!.x).toBeCloseTo(runB[i]!.x, 4);
      expect(runA[i]!.y).toBeCloseTo(runB[i]!.y, 4);
      expect(runA[i]!.z).toBeCloseTo(runB[i]!.z, 4);
      expect(runA[i]!.type).toBe(runB[i]!.type);
    }
  });
});

describe('TerrainGenerator (Playas vs Acantilados en la Costa)', () => {
  it('debe generar tanto playas de arena (BIOME_SAND) como acantilados rocosos (BIOME_ROCK)', () => {
    const terrain = TerrainGenerator.generate(128, 128, 2.0, 1337);

    let sandCount = 0;
    let rockCount = 0;
    let waterCount = 0;

    for (let i = 0; i < terrain.biomes.length; i++) {
      const b = terrain.biomes[i];
      if (b === BIOME_SAND) sandCount++;
      else if (b === BIOME_ROCK) rockCount++;
      else if (b === BIOME_WATER) waterCount++;
    }

    // La costa debe contar tanto con playas de arena suave como con acantilados rocosos
    expect(sandCount).toBeGreaterThan(50);
    expect(rockCount).toBeGreaterThan(100);
    expect(waterCount).toBeGreaterThan(200);
  });
});
