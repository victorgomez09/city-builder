/**
 * Configuración Paramétrica del Paisaje Natural (CityRT / Cities: Skylines):
 * Permite personalizar antes de iniciar la partida o generar proceduralmente mundos
 * con perfiles geográficos diversos: más planos, más montañosos, con más costa, etc.
 */
export interface LandscapeConfig {
  seed: number;

  // 1. Orografía y Relieve Montañoso
  mountainIntensity: number; // 0.0 (llanura casi plana) a 1.0 (grandes cordilleras alpinas)
  mountainRoughness: number; // Frecuencia/aspereza fractal de crestas y picos
  plainElevation: number;    // Elevación base de valles y mesetas habitables (m)

  // 2. Hidrografía y Nivel del Mar
  waterLevel: number;        // Cota de la superficie del agua (m)
  coastExtent: number;       // Cobertura de mar/bahía (0.0 = interior continental, 1.0 = gran bahía/archipiélago)
  cliffIntensity: number;    // Proporción de acantilados escarpados vs playas de arena suave (0.0 a 1.0)

  // 3. Río y Valles Fluviales
  riverWidth: number;        // Anchura media del cauce fluvial en metros
  riverDepth: number;        // Profundidad de incisión del cauce respecto al valle
  riverMeander: number;      // Amplitud de curvatura de los meandros fluviales
  lakeCount: number;         // Escala y presencia de lagunas litorales y ensenadas
}

export type LandscapePresetName = 'COASTAL_VALLEY' | 'MOUNTAIN_HIGHLANDS' | 'ROLLING_PLAINS' | 'RUGGED_COAST';

export const LANDSCAPE_PRESETS: Record<LandscapePresetName, LandscapeConfig> = {
  // 1. Valle Costero (Estilo CityRT / Fable Cities - Por defecto):
  // Gran cordillera alpina al norte, inmenso valle fértil aluvial con terrazas de meandro,
  // río meándrico continuo que recorre todo el mapa y desemboca en una gran bahía marítima con playas y acantilados
  COASTAL_VALLEY: {
    seed: 1337,
    mountainIntensity: 0.90,
    mountainRoughness: 0.52,
    plainElevation: 7.0,
    waterLevel: 4.0,
    coastExtent: 0.52,
    cliffIntensity: 0.65,
    riverWidth: 120.0,
    riverDepth: 2.8,
    riverMeander: 24.0,
    lakeCount: 2,
  },

  // 2. Tierras Altas Alpinas:
  // Dominancia de macizos escarpados, crestas multifractales afiladas y valles encañonados
  MOUNTAIN_HIGHLANDS: {
    seed: 2048,
    mountainIntensity: 1.0,
    mountainRoughness: 0.65,
    plainElevation: 9.5,
    waterLevel: 4.0,
    coastExtent: 0.35,
    cliffIntensity: 0.85,
    riverWidth: 95.0,
    riverDepth: 3.2,
    riverMeander: 18.0,
    lakeCount: 3,
  },

  // 3. Praderas y Llanuras Fluviales Abiertas:
  // Relieve suavemente ondulado con terrazas aptas para grandes extensiones metropolitanas, río ancho y amplias playas
  ROLLING_PLAINS: {
    seed: 4096,
    mountainIntensity: 0.25,
    mountainRoughness: 0.35,
    plainElevation: 6.2,
    waterLevel: 4.0,
    coastExtent: 0.45,
    cliffIntensity: 0.25,
    riverWidth: 140.0,
    riverDepth: 2.5,
    riverMeander: 30.0,
    lakeCount: 3,
  },

  // 4. Costa de Acantilados y Fiordos:
  // Paisaje marítimo espectacular donde altos promontorios y acantilados caen a pique sobre el océano
  RUGGED_COAST: {
    seed: 8192,
    mountainIntensity: 0.80,
    mountainRoughness: 0.58,
    plainElevation: 8.0,
    waterLevel: 4.0,
    coastExtent: 0.68,
    cliffIntensity: 0.95,
    riverWidth: 105.0,
    riverDepth: 3.0,
    riverMeander: 20.0,
    lakeCount: 2,
  },
};

export const DEFAULT_LANDSCAPE_CONFIG: LandscapeConfig = LANDSCAPE_PRESETS.COASTAL_VALLEY;
