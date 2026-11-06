import { LandscapeConfig, DEFAULT_LANDSCAPE_CONFIG } from '@core/terrain/landscape_config';
import {
  NaturalLandscapeGenerator,
  BIOME_WATER,
  BIOME_SAND,
  BIOME_GRASS,
  BIOME_FOREST,
  BIOME_ROCK,
} from '@core/terrain/natural_landscape_generator';

export interface TerrainGridData {
  width: number;
  height: number;
  cellSize: number;
  heights: Float32Array; // Campo continuo de alturas suaves
  biomes: Uint8Array;
}

export {
  BIOME_WATER,
  BIOME_SAND,
  BIOME_GRASS,
  BIOME_FOREST,
  BIOME_ROCK,
};

/**
 * Generador de Topografía Natural de Alta Fidelidad (Fable Cities / Cities: Skylines II):
 * Delega en NaturalLandscapeGenerator para garantizar una orografía matemáticamente continua,
 * coherente a macro-escala y determinista mediante LandscapeConfig.
 */
export class TerrainGenerator {
  public static generate(
    width: number,
    height: number,
    cellSize: number = 2.0,
    seedOrConfig: number | LandscapeConfig = 42
  ): TerrainGridData {
    const config: LandscapeConfig =
      typeof seedOrConfig === 'number'
        ? { ...DEFAULT_LANDSCAPE_CONFIG, seed: seedOrConfig }
        : seedOrConfig;

    const generator = new NaturalLandscapeGenerator(config);
    const heights = new Float32Array((width + 1) * (height + 1));
    const biomes = new Uint8Array(width * height);

    const halfW = (width * cellSize) / 2;
    const halfH = (height * cellSize) / 2;

    // 1. Generación del campo de alturas continuo y orgánico para los vértices
    for (let z = 0; z <= height; z++) {
      for (let x = 0; x <= width; x++) {
        const index = z * (width + 1) + x;
        const wx = x * cellSize - halfW;
        const wz = z * cellSize - halfH;
        heights[index] = generator.getHeight(wx, wz);
      }
    }

    // 2. Clasificación geomorfológica de biomas por celda
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const cellIndex = z * width + x;
        const cx = (x + 0.5) * cellSize - halfW;
        const cz = (z + 0.5) * cellSize - halfH;
        const sample = generator.getSample(cx, cz);
        biomes[cellIndex] = sample.biome;
      }
    }

    return {
      width,
      height,
      cellSize,
      heights,
      biomes,
    };
  }
}
