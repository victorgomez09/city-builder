import { PRNG } from '@core/utils/prng';

export interface TerrainGridData {
  width: number;
  height: number;
  cellSize: number;
  heights: Float32Array; // Alturas continuas y suaves
  biomes: Uint8Array;
}

export const BIOME_WATER = 0;
export const BIOME_SAND = 1;
export const BIOME_GRASS = 2;
export const BIOME_FOREST = 3;
export const BIOME_ROCK = 4;

/**
 * Generador de Topografía Natural de Alta Fidelidad (estilo Fable Cities / Cities: Skylines II):
 * - Mar / Costa en el sureste con playas amplias de arena y transición suave.
 * - Río meándrico y lagunas costeras que cruzan el valle central.
 * - Valle amplio y llanuras fértiles (2.5m - 5m) óptimas para el trazado urbano.
 * - Cordillera montañosa en el norte/noroeste con riscos rocosos y cumbres con nieve.
 */
export class TerrainGenerator {
  public static generate(
    width: number,
    height: number,
    cellSize: number = 2.0,
    seed: number = 42
  ): TerrainGridData {
    const prng = new PRNG(seed);
    const heights = new Float32Array((width + 1) * (height + 1));
    const biomes = new Uint8Array(width * height);

    const halfW = (width * cellSize) / 2;
    const halfH = (height * cellSize) / 2;

    const waterLevel = 1.5;

    const phaseX = prng.rangeFloat(0, Math.PI * 2);
    const phaseZ = prng.rangeFloat(0, Math.PI * 2);

    // 1. Generación de campo de alturas continuo
    for (let z = 0; z <= height; z++) {
      for (let x = 0; x <= width; x++) {
        const index = z * (width + 1) + x;
        const wx = x * cellSize - halfW;
        const wz = z * cellSize - halfH;

        // A. Macizo montañoso en el cuadrante norte / noroeste (negative z, negative x)
        const mountDistX = Math.max(0, (-wx + 15) / (halfW * 0.7));
        const mountDistZ = Math.max(0, (-wz - 5) / (halfH * 0.7));
        const mountMask = Math.min(1.0, mountDistX * mountDistZ);

        const peak1 = Math.abs(Math.sin(wx * 0.08 + phaseX) * Math.cos(wz * 0.08 + phaseZ)) * 14.0;
        const peak2 = Math.abs(Math.sin(wx * 0.15 - phaseZ) * Math.sin(wz * 0.15 + phaseX)) * 8.0;
        const mountainElevation = mountMask * (6.0 + peak1 + peak2);

        // B. Mar y costa en el cuadrante sureste (positive z, positive x)
        const coastGrad = (wz * 0.75 + wx * 0.65) - halfW * 0.28;

        // C. Río meándrico con cuenca y lagunas
        const riverCenter = Math.sin(wz * 0.04 + phaseZ) * (halfW * 0.25) - halfW * 0.18;
        const distToRiver = Math.abs(wx - riverCenter);
        const inRiver = Math.max(0, 1.0 - distToRiver / 10.0);
        const riverChannel = Math.pow(inRiver, 1.4) * 2.8;

        // Lagunas costeras donde el río se ensancha antes del mar
        const lake1 = Math.hypot(wx - (-halfW * 0.12), wz - (halfH * 0.1));
        const inLake1 = Math.max(0, 1.0 - lake1 / 20.0);
        const lakeChannel = Math.pow(inLake1, 1.5) * 3.2;

        // D. Valle base suave y ondulado para la ciudad
        const roll1 = Math.sin(wx * 0.025 + phaseX) * Math.cos(wz * 0.025 + phaseZ) * 1.6;
        const roll2 = Math.sin(wx * 0.06 - phaseZ) * 0.7;
        let h = 4.2 + roll1 + roll2 + mountainElevation - riverChannel - lakeChannel;

        // E. Transición a costa marina y playa
        if (coastGrad > 0) {
          // Mar adentro: pendiente sumergida suave
          h = Math.max(0.05, h - coastGrad * 0.45);
        } else if (coastGrad > -12.0) {
          // Franja de playa de arena
          const beachFactor = (coastGrad + 12.0) / 12.0;
          h = (1.0 - beachFactor) * h + beachFactor * 1.35;
        }

        heights[index] = Math.max(0.05, h);
      }
    }

    // 2. Clasificación de biomas por celda
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const cellIndex = z * width + x;
        const vIndex = z * (width + 1) + x;
        const avgHeight = heights[vIndex] ?? 0;

        if (avgHeight <= waterLevel) {
          biomes[cellIndex] = BIOME_WATER;
        } else if (avgHeight <= waterLevel + 0.6) {
          biomes[cellIndex] = BIOME_SAND;
        } else if (avgHeight <= 6.5) {
          biomes[cellIndex] = BIOME_GRASS;
        } else if (avgHeight <= 14.0) {
          biomes[cellIndex] = BIOME_FOREST;
        } else {
          biomes[cellIndex] = BIOME_ROCK;
        }
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
