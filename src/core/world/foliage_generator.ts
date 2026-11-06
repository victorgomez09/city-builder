import { SimplexNoise } from '@core/utils/noise';
import { PRNG } from '@core/utils/prng';
import { TerrainGridData } from '@core/terrain_data';
import {
  NaturalLandscapeGenerator,
} from '@core/terrain/natural_landscape_generator';
import { LandscapeConfig, DEFAULT_LANDSCAPE_CONFIG } from '@core/terrain/landscape_config';

export interface FoliagePoint {
  x: number;
  y: number;
  z: number;
  scale?: number;
  type?: 'tree' | 'bush';
}

/**
 * Generador Bioclimático de Vegetación y Bosques de Escala Mundial (Fable Cities / Cities: Skylines II):
 * - Distribuye vegetación de forma natural por TODO el paisaje visible (radio de varios kilómetros).
 * - Cero sesgo de parcela: los bosques visten las cordilleras lejanas, el valle central y el corredor fluvial continuo.
 * - Conexión reactiva: en la zona activa editable, interpola con las alturas de TerrainGridData (sincronizado con terraformación);
 *   en el paisaje circundante exterior, muestrea la orografía analítica de NaturalLandscapeGenerator.
 * - Reglas ecológicas estrictas:
 *   - Pinares alpinos en laderas montañosas (18m - 65m).
 *   - Bosques de ribera acompañando todo el curso fluvial y lagos.
 *   - Masas forestales caducifolias y dehesas en el valle.
 *   - Matorrales costeros y pinares marítimos en mesetas litorales.
 *   - Exclusión de agua, playas arenosas, paredes verticales de acantilados y nieves perpetuas.
 */
export class FoliageGenerator {
  public static generateWorldFoliage(
    terrainData: TerrainGridData,
    seedOrConfig: number | LandscapeConfig = 1337,
    worldRadius: number = 2200.0
  ): FoliagePoint[] {
    const config: LandscapeConfig =
      typeof seedOrConfig === 'number'
        ? { ...DEFAULT_LANDSCAPE_CONFIG, seed: seedOrConfig }
        : seedOrConfig;

    const generator = new NaturalLandscapeGenerator(config);
    const { width, height, cellSize, heights } = terrainData;
    const prng = new PRNG(config.seed);
    const simplex = new SimplexNoise(config.seed);

    const halfW = (width * cellSize) / 2;
    const halfH = (height * cellSize) / 2;
    const waterLevel = config.waterLevel;

    const points: FoliagePoint[] = [];

    // Interpolador bilineal para la zona interior editable de la ciudad
    const getActiveTerrainElevation = (wx: number, wz: number): number => {
      const gx = (wx + halfW) / cellSize;
      const gz = (wz + halfH) / cellSize;

      const x0 = Math.max(0, Math.min(width - 1, Math.floor(gx)));
      const z0 = Math.max(0, Math.min(height - 1, Math.floor(gz)));
      const x1 = Math.min(width, x0 + 1);
      const z1 = Math.min(height, z0 + 1);

      const tx = Math.max(0, Math.min(1, gx - x0));
      const tz = Math.max(0, Math.min(1, gz - z0));

      const stride = width + 1;
      const h00 = heights[z0 * stride + x0] ?? 0;
      const h10 = heights[z0 * stride + x1] ?? 0;
      const h01 = heights[z1 * stride + x0] ?? 0;
      const h11 = heights[z1 * stride + x1] ?? 0;

      const top = h00 * (1 - tx) + h10 * tx;
      const btm = h01 * (1 - tx) + h11 * tx;
      return top * (1 - tz) + btm * tz;
    };

    // Muestreador unificado: editable en el centro, analítico macro en el exterior
    const sampleTerrain = (wx: number, wz: number): { height: number; slope: number } => {
      const insideActive =
        wx >= -halfW + 1.0 && wx <= halfW - 1.0 &&
        wz >= -halfH + 1.0 && wz <= halfH - 1.0;

      if (insideActive) {
        const delta = 1.0;
        const hCenter = getActiveTerrainElevation(wx, wz);
        const hL = getActiveTerrainElevation(wx - delta, wz);
        const hR = getActiveTerrainElevation(wx + delta, wz);
        const hD = getActiveTerrainElevation(wx, wz - delta);
        const hU = getActiveTerrainElevation(wx, wz + delta);
        const slope = Math.hypot(hR - hL, hU - hD) / (2 * delta);
        return { height: hCenter, slope };
      } else {
        const s = generator.getSample(wx, wz);
        return { height: s.height, slope: s.slope };
      }
    };

    // --- MUESTREO MULTI-ZONA POR TODO EL MUNDO (Hasta 2.200m de radio) ---
    // Zona 1: Centro urbano habitable (|wx|, |wz| <= 160m) - Muestreo denso
    // Zona 2: Entorno periurbano y valles (160m < r <= 550m) - Muestreo medio
    // Zona 3: Cordilleras y campiña lejana (550m < r <= 1400m) - Muestreo por masas forestales
    // Zona 4: Paisaje del horizonte (1400m < r <= worldRadius) - Agrupaciones en laderas

    const bands = [
      { minR: 0, maxR: 160, step: 3.2, densityFactor: 1.0 },
      { minR: 160, maxR: 550, step: 5.6, densityFactor: 0.85 },
      { minR: 550, maxR: 1300, step: 11.5, densityFactor: 0.70 },
      { minR: 1300, maxR: worldRadius, step: 24.0, densityFactor: 0.55 },
    ];

    for (const band of bands) {
      const step = band.step;
      const maxR = band.maxR;
      const minR = band.minR;

      for (let wz = -maxR; wz <= maxR; wz += step) {
        for (let wx = -maxR; wx <= maxR; wx += step) {
          const r = Math.hypot(wx, wz);
          if (r < minR || r > maxR) continue;

          // Jitter aleatorio para romper patrones de rejilla
          const jitter = step * 0.42;
          const jx = wx + prng.rangeFloat(-jitter, jitter);
          const jz = wz + prng.rangeFloat(-jitter, jitter);

          const { height: h, slope } = sampleTerrain(jx, jz);

          // 1. Filtros físicos y biológicos estrictos
          if (h <= waterLevel + 0.12) continue; // Agua (ríos, lagunas, mar)
          if (h <= waterLevel + 0.85 && slope < 0.22) continue; // Playas de arena dorada
          if (slope >= 0.42) continue; // Paredes rocosas de acantilados o cañones
          if (h > 65.0) continue; // Límite alpino de vegetación (nieve y roca pura)

          // 2. Ruido bioclimático multi-octava
          const forestDensity = simplex.fbm2D((jx + 1200) * 0.0032, (jz - 800) * 0.0032, 3, 2.0, 0.45);
          const patchNoise = simplex.noise2D((jx - 350) * 0.012, (jz + 420) * 0.012);
          const randChance = prng.next();

          let plantTree = false;
          let plantBush = false;
          let treeScale = 1.0;
          let bushScale = 0.85;

          // --- BIOMA 1: PINARES ALPINOS (Cordillera Norte y Laderas Altas, h >= 16m) ---
          if (h >= 16.0) {
            if (forestDensity > -0.15 && randChance < 0.62 * band.densityFactor) {
              plantTree = true;
              treeScale = prng.rangeFloat(0.9, 1.4);
              if (patchNoise > 0.15) plantBush = true;
            } else if (randChance < 0.08) {
              plantBush = true;
            }
          }
          // --- BIOMA 2: VALLE CENTRAL, LLANURAS Y MESETAS (4m <= h < 16m) ---
          else if (h >= 4.0) {
            if (forestDensity > 0.05 && randChance < 0.58 * band.densityFactor) {
              // Gran masa forestal caducifolia
              plantTree = true;
              treeScale = prng.rangeFloat(0.95, 1.3);
              if (patchNoise > 0.2) plantBush = true;
            } else if (forestDensity > -0.22 && randChance < 0.18 * band.densityFactor) {
              // Bosquecillos y arboledas dispersas
              plantTree = true;
              treeScale = prng.rangeFloat(0.85, 1.15);
            } else if (randChance < 0.02) {
              // Árbol majestuoso aislado en la campiña
              plantTree = true;
              treeScale = prng.rangeFloat(1.3, 1.55);
            } else if (randChance < 0.09) {
              plantBush = true;
            }
          }
          // --- BIOMA 3: RIBERAS Y CORREDOR FLUVIAL / LITORAL (waterLevel + 0.12 < h < 4m) ---
          else {
            if (randChance < 0.52 * band.densityFactor) {
              plantTree = true;
              treeScale = prng.rangeFloat(0.9, 1.25);
              if (patchNoise > 0.05) plantBush = true;
            } else if (randChance < 0.35) {
              plantBush = true;
              bushScale = prng.rangeFloat(0.75, 1.05);
            }
          }

          if (plantTree) {
            points.push({
              x: jx,
              y: h,
              z: jz,
              scale: treeScale,
              type: 'tree',
            });
          }

          if (plantBush) {
            const bx = jx + prng.rangeFloat(-1.5, 1.5);
            const bz = jz + prng.rangeFloat(-1.5, 1.5);
            const { height: bh, slope: bslope } = sampleTerrain(bx, bz);

            if (bh > waterLevel + 0.12 && bslope < 0.38) {
              points.push({
                x: bx,
                y: bh,
                z: bz,
                scale: bushScale,
                type: 'bush',
              });
            }
          }
        }
      }
    }

    return points;
  }
}
