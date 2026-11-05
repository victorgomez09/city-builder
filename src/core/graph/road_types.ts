/**
 * Tipologías de carretera disponibles para el trazado vial.
 */
export enum RoadType {
  LOCAL_2L = 'LOCAL_2L',       // Calle local (2 carriles, doble sentido)
  ONE_WAY_2L = 'ONE_WAY_2L',   // Calle de sentido único (2 carriles en una dirección)
  AVENUE_4L = 'AVENUE_4L',     // Avenida principal (4 carriles, doble sentido con mediana)
  HIGHWAY_4L = 'HIGHWAY_4L',   // Autopista / Autovía de alta velocidad (4 carriles, sentido único)
}

export interface RoadTypeConfig {
  type: RoadType;
  name: string;
  width: number;       // Ancho físico en metros
  lanes: number;       // Número total de carriles
  speedLimit: number;  // km/h (utilizado como coste de tiempo en A*)
  isOneWay: boolean;   // Si restringe el flujo a una sola dirección
  costPerCell: number; // Coste en dólares por celda construida
}

export const ROAD_CONFIGS: Record<RoadType, RoadTypeConfig> = {
  [RoadType.LOCAL_2L]: {
    type: RoadType.LOCAL_2L,
    name: 'Calle Local (2 Carriles)',
    width: 1.4,
    lanes: 2,
    speedLimit: 40,
    isOneWay: false,
    costPerCell: 20,
  },
  [RoadType.ONE_WAY_2L]: {
    type: RoadType.ONE_WAY_2L,
    name: 'Calle Sentido Único (2 Carriles)',
    width: 1.4,
    lanes: 2,
    speedLimit: 50,
    isOneWay: true,
    costPerCell: 25,
  },
  [RoadType.AVENUE_4L]: {
    type: RoadType.AVENUE_4L,
    name: 'Avenida (4 Carriles con Mediana)',
    width: 2.2,
    lanes: 4,
    speedLimit: 70,
    isOneWay: false,
    costPerCell: 60,
  },
  [RoadType.HIGHWAY_4L]: {
    type: RoadType.HIGHWAY_4L,
    name: 'Autopista (4 Carriles Rápida)',
    width: 2.2,
    lanes: 4,
    speedLimit: 100,
    isOneWay: true,
    costPerCell: 120,
  },
};
