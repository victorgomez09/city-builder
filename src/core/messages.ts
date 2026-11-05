// Mensajes enviados desde Main Thread hacia Sim Worker
export type MainToWorkerMessage =
  | { type: 'INIT_WORLD'; payload: { seed: number; mapWidth: number; mapHeight: number; heights?: Float32Array } }
  | { type: 'SET_SIMULATION_SPEED'; payload: { speed: number } }
  | { type: 'SYNC_TERRAIN'; payload: { heights: Float32Array } }
  | { type: 'ADD_WATER_SOURCE'; payload: { x: number; z: number; targetDepth: number; flowRate: number } }
  | { type: 'TICK_MANUAL'; payload: { delta: number } };

// Tipos de zonas en la cuadrícula
export enum ZoneType {
  NONE = 0,
  RESIDENTIAL_LOW = 1,
  RESIDENTIAL_HIGH = 2,
  COMMERCIAL_LOW = 3,
  COMMERCIAL_HIGH = 4,
  INDUSTRIAL = 5,
}

// Resumen del estado económico y poblacional enviado en cada delta
export interface SimulationStats {
  population: number;
  money: number;
  rDemand: number;
  cDemand: number;
  iDemand: number;
  currentTick: number;
  totalWaterVolume: number;
}

// Mensajes enviados desde Sim Worker hacia Main Thread
export type WorkerToMainMessage =
  | { type: 'WORLD_INITIALIZED'; payload: { width: number; height: number; seed: number } }
  | {
      type: 'SIMULATION_UPDATE';
      payload: {
        stats: SimulationStats;
        // Buffer transferible continuo con la profundidad de agua d[x, z] por celda
        waterDepthBuffer?: Float32Array;
      };
    }
  | { type: 'SIMULATION_ERROR'; payload: { message: string; stack?: string } };
