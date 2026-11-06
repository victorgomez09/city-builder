import { describe, it, expect } from 'vitest';
import {
  NaturalLandscapeGenerator,
  BIOME_WATER,
  BIOME_SAND,
  BIOME_GRASS,
  BIOME_ROCK,
} from '@core/terrain/natural_landscape_generator';
import {
  DEFAULT_LANDSCAPE_CONFIG,
  LANDSCAPE_PRESETS,
} from '@core/terrain/landscape_config';

describe('NaturalLandscapeGenerator', () => {
  it('genera alturas 100% deterministas para una misma semilla y configuración', () => {
    const genA = new NaturalLandscapeGenerator({ ...DEFAULT_LANDSCAPE_CONFIG, seed: 42 });
    const genB = new NaturalLandscapeGenerator({ ...DEFAULT_LANDSCAPE_CONFIG, seed: 42 });

    const testCoords = [
      [0, 0],
      [100, -150],
      [-250, 400],
      [1200, -850],
      [-3000, 2500],
    ];

    for (const [x, z] of testCoords) {
      const hA = genA.getHeight(x!, z!);
      const hB = genB.getHeight(x!, z!);
      expect(hA).toBeCloseTo(hB, 6);
    }
  });

  it('diferentes semillas producen orografías distintas', () => {
    const gen1 = new NaturalLandscapeGenerator({ ...DEFAULT_LANDSCAPE_CONFIG, seed: 1001 });
    const gen2 = new NaturalLandscapeGenerator({ ...DEFAULT_LANDSCAPE_CONFIG, seed: 9999 });

    const h1 = gen1.getHeight(-150, -200);
    const h2 = gen2.getHeight(-150, -200);
    expect(h1).not.toEqual(h2);
  });

  it('el preset MOUNTAIN_HIGHLANDS produce cotas montañosas más elevadas que ROLLING_PLAINS', () => {
    const mountainGen = new NaturalLandscapeGenerator({
      ...LANDSCAPE_PRESETS.MOUNTAIN_HIGHLANDS,
      seed: 777,
    });
    const plainsGen = new NaturalLandscapeGenerator({
      ...LANDSCAPE_PRESETS.ROLLING_PLAINS,
      seed: 777,
    });

    let maxMountain = -Infinity;
    let maxPlains = -Infinity;

    // Muestrear cordilleras alpinas lejanas
    for (let r = 200; r <= 1000; r += 100) {
      const hM = mountainGen.getHeight(r, -r);
      const hP = plainsGen.getHeight(r, -r);
      if (hM > maxMountain) maxMountain = hM;
      if (hP > maxPlains) maxPlains = hP;
    }

    expect(maxMountain).toBeGreaterThan(maxPlains);
  });

  it('clasifica correctamente biomas de agua, arena, vegetación o roca', () => {
    const gen = new NaturalLandscapeGenerator({ ...DEFAULT_LANDSCAPE_CONFIG, seed: 1337 });

    const biomesEncountered = new Set<number>();

    // Muestrear cuadrícula
    for (let z = -200; z <= 200; z += 20) {
      for (let x = -200; x <= 200; x += 20) {
        const sample = gen.getSample(x, z);
        biomesEncountered.add(sample.biome);

        // Si la cota está por debajo del agua, el bioma debe ser BIOME_WATER
        if (sample.height < DEFAULT_LANDSCAPE_CONFIG.waterLevel) {
          expect(sample.biome).toBe(BIOME_WATER);
        }
      }
    }

    // Debe contener al menos agua y tierra firme (hierba, bosque o arena)
    expect(biomesEncountered.has(BIOME_WATER)).toBe(true);
    expect(
      biomesEncountered.has(BIOME_GRASS) ||
      biomesEncountered.has(BIOME_SAND) ||
      biomesEncountered.has(BIOME_ROCK)
    ).toBe(true);
  });

  it('el cálculo de componentes normales y pendientes produce valores coherentes', () => {
    const gen = new NaturalLandscapeGenerator({ ...DEFAULT_LANDSCAPE_CONFIG, seed: 1337 });

    const coords = [
      [0, 0],
      [150, 200],
      [-300, -100],
      [-80, -60],
    ];

    for (const [x, z] of coords) {
      const sample = gen.getSample(x!, z!);
      expect(Number.isFinite(sample.normalX)).toBe(true);
      expect(Number.isFinite(sample.normalZ)).toBe(true);
      expect(Number.isFinite(sample.slope)).toBe(true);
      expect(sample.slope).toBeGreaterThanOrEqual(0.0);
    }
  });
});
