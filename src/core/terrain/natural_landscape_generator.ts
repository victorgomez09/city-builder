import { SimplexNoise } from '@core/utils/noise';
import { PRNG } from '@core/utils/prng';
import { LandscapeConfig, DEFAULT_LANDSCAPE_CONFIG } from '@core/terrain/landscape_config';

export interface LandscapeSample {
  height: number;
  slope: number;
  normalX: number;
  normalZ: number;
  biome: number;
  isCliff: boolean;
  isBeach: boolean;
  isWater: boolean;
}

export const BIOME_WATER = 0;
export const BIOME_SAND = 1;
export const BIOME_GRASS = 2;
export const BIOME_FOREST = 3;
export const BIOME_ROCK = 4;

/**
 * Generador Geomorfológico Unificado del Paisaje Natural (Macro-Scale World Generation - CityRT):
 * - Modela el relieve como un continuo geográfico a escala real regional (~160 km²).
 * - Cero dependencia de mallas o Three.js (Headless, 100% determinista).
 * - Algoritmos geomorfológicos avanzados:
 *   1. Deformación tectónica multi-escala por ruido de dominio (Domain Warping).
 *   2. Cordillera alpina septentrional con crestas afiladas multifractales (knife-edge arêtes y horn peaks).
 *   3. Canales de erosión glaciar y fluvial (V-shaped ravines) y talud parabólico de derrubios (scree slopes).
 *   4. Gran valle aluvial central con terrazas fluviales de meandro aptas para construcción metropolitana.
 *   5. Gran red fluvial continua con cauce parabólico y llanuras de inundación que desemboca en el mar.
 *   6. Litoral continental con playas de perfil cóncavo de equilibrio (Dean) y acantilados marinos verticales.
 *   7. Lagos y lagunas naturales integradas con la hidrología.
 */
export class NaturalLandscapeGenerator {
  private config: LandscapeConfig;
  private simplex: SimplexNoise;
  private riverPhase: number;
  private coastPhase: number;

  constructor(config: LandscapeConfig = DEFAULT_LANDSCAPE_CONFIG) {
    this.config = { ...config };
    this.simplex = new SimplexNoise(this.config.seed);

    const prng = new PRNG(this.config.seed);
    this.riverPhase = prng.rangeFloat(0, Math.PI * 2);
    this.coastPhase = prng.rangeFloat(0, Math.PI * 2);
  }

  /**
   * Calcula la cota de altitud exacta H(wx, wz) en cualquier coordenada métrica del mundo.
   * Regla de Cero Alocaciones: prohibido instanciar objetos temporales (`new`) dentro del bucle.
   */
  public getHeight(wx: number, wz: number): number {
    const {
      mountainIntensity,
      mountainRoughness,
      plainElevation,
      waterLevel,
      coastExtent,
      cliffIntensity,
      riverWidth,
      riverDepth,
      riverMeander,
      lakeCount,
    } = this.config;

    const sx = wx;
    const sz = wz;

    // 1. --- DEFORMACIÓN TECTÓNICA MULTI-ESCALA (Domain Warping: 5 km y 1.5 km) ---
    // Deforma el espacio de coordenadas para producir pliegues y fallas orográficas naturales
    const warp1X = this.simplex.noise2D((sx + 1200) * 0.00020, (sz - 900) * 0.00020) * 850.0;
    const warp1Z = this.simplex.noise2D((sx - 3400) * 0.00020, (sz + 2800) * 0.00020) * 850.0;
    const warp2X = this.simplex.noise2D((sx + warp1X + 500) * 0.00065, (sz + warp1Z) * 0.00065) * 220.0;
    const warp2Z = this.simplex.noise2D((sx + warp1X - 700) * 0.00065, (sz + warp1Z + 400) * 0.00065) * 220.0;
    const px = sx + warp1X + warp2X;
    const pz = sz + warp1Z + warp2Z;

    // 2. --- CORDILLERA ALPINA Y SISTEMAS MONTAÑOSOS (Norte / Noroeste / Noreste) ---
    // Enmarca el norte (pz < -1800m) y hombros laterales, dejando el inmenso valle habitable central
    const northDist = Math.max(0, -pz - 1800.0);
    const westDist = Math.max(0, -px - 3400.0);
    const eastDist = Math.max(0, px - 3800.0);

    const mountFactor = Math.min(1.0, northDist * 0.00035 + westDist * 0.00022 + eastDist * 0.00026);
    const mountMask = Math.pow(Math.max(0, mountFactor), 1.35);

    // Crestas afiladas multifractales (knife-edge arêtes y horn peaks)
    const ridge1 = this.simplex.ridged2D(px * 0.00042, pz * 0.00042, 5, 2.05, mountainRoughness);
    const ridge2 = this.simplex.ridged2D((px + 1800) * 0.0010, (pz - 1400) * 0.0010, 4, 2.10, mountainRoughness);
    const mountainShape = ridge1 * 0.72 + ridge2 * 0.28 * ridge1;
    const mountainElev = mountMask * mountainIntensity * (mountainShape * 580.0 + 15.0);

    // Canales de erosión fluvial y glaciar (V-shaped ravines)
    const drainageNoise = Math.pow(Math.abs(this.simplex.noise2D(px * 0.0015, pz * 0.0015)), 1.25);
    const erodedMountain = Math.max(0, mountainElev - mountMask * drainageNoise * 65.0);
    // Transición cóncava parabólica de talud (scree slope / derrubios de ladera)
    const finalMountain = erodedMountain * (erodedMountain / (erodedMountain + 40.0));

    // 3. --- GRAN VALLE ALUVIAL CENTRAL Y TERRAZAS FLUVIALES ---
    // Declive suave continental de norte a sur hacia la cuenca oceánica (cota habitable 6.5m a 8.5m)
    const valleySlopeZ = (pz < 0 ? -pz * 0.0006 : -pz * 0.0003);
    const valleyUndulation = this.simplex.fbm2D(px * 0.00032, pz * 0.00032, 3, 2.0, 0.45) * 1.8;
    const rawValley = plainElevation + valleySlopeZ + valleyUndulation;

    // Terrazas fluviales de meandro (bancos planos naturales aptos para construcción urbana)
    const terraceStep = 2.5;
    const terraceProgress = (((rawValley % terraceStep) + terraceStep) % terraceStep) / terraceStep;
    const smoothedTerrace =
      Math.floor(rawValley / terraceStep) * terraceStep + Math.pow(terraceProgress, 1.4) * terraceStep;

    let baseH = smoothedTerrace + finalMountain;

    // 4. --- GRAN RED FLUVIAL CONTINUA A TRAVÉS DE TODO EL MUNDO ---
    // Recorre todo el mapa de norte a sur, cruza de pleno la parcela inicial [1, 1] y desemboca en la bahía
    const meanderAmp = (riverMeander / 22.0) * 1100.0;
    const riverX =
      Math.sin(sz * 0.00075) * meanderAmp +
      Math.sin(sz * 0.0018 + this.riverPhase) * 60.0 * (1.0 - Math.exp(-Math.abs(sz) * 0.002)) +
      warp2X * 0.12;

    const distToRiver = Math.abs(sx - riverX);
    const southProgress = Math.max(0, Math.min(1.0, (sz + 6400.0) / 12800.0));
    // La anchura del cauce se ensancha progresivamente hacia la desembocadura
    const currentRiverWidth = riverWidth * (1.0 + Math.pow(southProgress, 1.2) * 2.2);
    const halfRiverW = currentRiverWidth * 0.5;
    const floodplainW = halfRiverW * 2.2;

    if (distToRiver < floodplainW) {
      if (distToRiver < halfRiverW) {
        // Dentro del cauce activo del río: lecho parabólico bajo el agua continuo (1.2m a 3m de agua)
        const u = distToRiver / halfRiverW;
        const bedH = (waterLevel - 0.5) - Math.pow(Math.max(0, 1.0 - u * u), 1.2) * riverDepth;
        baseH = Math.min(baseH, bedH);
      } else {
        // Llanura de inundación y ribera aluvial: transición suave y verde hacia el valle
        const t = (distToRiver - halfRiverW) / (floodplainW - halfRiverW);
        const bankH = (waterLevel - 0.5) + Math.pow(t, 1.2) * Math.max(0.0, baseH - (waterLevel - 0.5));
        baseH = Math.min(baseH, bankH);
      }
    }

    // 5. --- LAGOS Y MASAS DE AGUA NATURALES ---
    if (lakeCount >= 1) {
      // Gran Lago de la Llanura Oriental
      const l1Dist = Math.hypot(sx - 1800 + warp2X * 0.2, sz - (-400) + warp2Z * 0.2);
      const l1R = 480.0;
      if (l1Dist < l1R) {
        const u = l1Dist / l1R;
        const bedDepth = Math.pow(Math.max(0, 1.0 - u * u), 1.3) * Math.max(2.0, baseH - (waterLevel - 4.5));
        baseH = baseH - bedDepth;
      }
    }
    if (lakeCount >= 2) {
      // Laguna Meándrica Occidental
      const l2Dist = Math.hypot(sx - (-2200) + warp2X * 0.2, sz - 800 + warp2Z * 0.2);
      const l2R = 380.0;
      if (l2Dist < l2R) {
        const u = l2Dist / l2R;
        const bedDepth = Math.pow(Math.max(0, 1.0 - u * u), 1.3) * Math.max(2.0, baseH - (waterLevel - 3.8));
        baseH = baseH - bedDepth;
      }
    }

    let h = baseH;

    // 6. --- COSTA CONTINENTAL: OCÉANO, PLAYAS Y ACANTILADOS ---
    const coastBaseZ = 3400.0 - (coastExtent - 0.5) * 2600.0;
    const coastWave = this.simplex.fbm2D(px * 0.00042 + this.coastPhase, 124.5, 3, 2.0, 0.48) * 650.0;
    const coastZ = coastBaseZ + coastWave;
    const coastDist = pz - coastZ; // > 0 en el mar, < 0 en tierra

    if (coastDist > 0) {
      // Mar abierto / bahía profunda
      const oceanDepth = Math.min(50.0, Math.sqrt(coastDist * 2.8) + coastDist * 0.015);
      h = Math.max(0.1, waterLevel - 1.0 - oceanDepth);
    } else {
      // Zona litoral
      const shoreDist = -coastDist;
      const cliffSectorNoise = this.simplex.fbm2D((px + 2800) * 0.0008, 54.0, 2, 2.0, 0.5);
      const isCliff = cliffSectorNoise > (0.28 - cliffIntensity * 0.38) && h > waterLevel + 8.0;

      if (isCliff) {
        // Acantilado costero: meseta que cae a pique sobre el agua
        if (shoreDist < 45.0) {
          const tC = shoreDist / 45.0;
          const cliffBase = waterLevel - 0.8;
          h = cliffBase + Math.pow(tC, 0.45) * Math.max(0.0, h - cliffBase);
        }
      } else {
        // Playa de arena: perfil cóncavo de equilibrio (Dean)
        if (shoreDist < 180.0) {
          const tB = shoreDist / 180.0;
          const beachH = (waterLevel - 0.4) + Math.pow(tB, 0.72) * 5.5;
          h = Math.min(h, beachH);
        }
      }
    }

    return Math.max(0.1, h);
  }

  /**
   * Muestrea completamente la cota, normales analíticas, pendiente y clasificación ecológica.
   */
  public getSample(wx: number, wz: number): LandscapeSample {
    const delta = 1.0;
    const hCenter = this.getHeight(wx, wz);
    const hL = this.getHeight(wx - delta, wz);
    const hR = this.getHeight(wx + delta, wz);
    const hD = this.getHeight(wx, wz - delta);
    const hU = this.getHeight(wx, wz + delta);

    const normalX = -(hR - hL) / (2 * delta);
    const normalZ = -(hU - hD) / (2 * delta);
    const slope = Math.hypot(normalX, normalZ);

    const waterLevel = this.config.waterLevel;
    const isWater = hCenter <= waterLevel;
    const isCliff = slope >= 0.30;
    const isBeach = !isWater && hCenter <= waterLevel + 0.40 && slope < 0.22;

    // Afloramientos rocosos naturales en valle y laderas
    const outcrop = this.simplex.noise2D(wx * 0.035, wz * 0.035);
    const isRockOutcrop = outcrop > 0.70;

    let biome: number;
    if (isWater) {
      biome = BIOME_WATER;
    } else if (isBeach) {
      biome = BIOME_SAND;
    } else if (isCliff || hCenter > 110.0 || isRockOutcrop) {
      biome = BIOME_ROCK;
    } else if (hCenter <= 45.0 && slope < 0.18) {
      biome = BIOME_GRASS;
    } else {
      biome = BIOME_FOREST;
    }

    return {
      height: hCenter,
      slope,
      normalX,
      normalZ,
      biome,
      isCliff,
      isBeach,
      isWater,
    };
  }

  public getConfig(): LandscapeConfig {
    return { ...this.config };
  }
}
