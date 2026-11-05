import { PRNG } from '@core/utils/prng';
import { ShallowWaterSolver } from '@core/water/shallow_water_solver';
import type { MainToWorkerMessage, WorkerToMainMessage, SimulationStats } from '@core/messages';

let prng: PRNG | null = null;
let worldWidth = 64;
let worldHeight = 64;
let simSpeed = 1;
let currentTick = 0;
let simTimer: number | null = null;

let waterSolver: ShallowWaterSolver | null = null;

const stats: SimulationStats = {
  population: 0,
  money: 50000,
  rDemand: 50,
  cDemand: 30,
  iDemand: 20,
  currentTick: 0,
  totalWaterVolume: 0,
};

function tick(): void {
  currentTick++;
  stats.currentTick = currentTick;

  let waterDepthBuffer: Float32Array | undefined;

  // 1. Integración física del agua con SWE 2.5D
  if (waterSolver && simSpeed > 0) {
    // 50ms timestep
    waterSolver.step(0.05);

    // Calcular volumen de agua activo
    let volume = 0;
    const len = waterSolver.waterDepth.length;
    for (let i = 0; i < len; i++) {
      volume += waterSolver.waterDepth[i] ?? 0;
    }
    stats.totalWaterVolume = Math.round(volume);

    // Clonar buffer para transferencia segura a Main Thread
    waterDepthBuffer = new Float32Array(waterSolver.waterDepth);
  }

  // 2. Lógica económica básica por tick
  if (simSpeed > 0 && prng) {
    const variation = (prng.next() - 0.5) * 2;
    stats.rDemand = Math.max(0, Math.min(100, stats.rDemand + variation));
  }

  const response: WorkerToMainMessage = {
    type: 'SIMULATION_UPDATE',
    payload: {
      stats: { ...stats },
      waterDepthBuffer,
    },
  };

  self.postMessage(response);
}

function startLoop(): void {
  if (simTimer !== null) {
    clearInterval(simTimer);
  }
  simTimer = setInterval(tick, 50) as unknown as number;
}

// Escucha de mensajes desde Main Thread
self.onmessage = (event: MessageEvent<MainToWorkerMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'INIT_WORLD': {
      const { seed, mapWidth, mapHeight, heights } = msg.payload;
      prng = new PRNG(seed);
      worldWidth = mapWidth;
      worldHeight = mapHeight;
      currentTick = 0;

      // Inicializar solver hidrodinámico
      waterSolver = new ShallowWaterSolver(worldWidth, worldHeight, 2.0);
      if (heights) {
        waterSolver.updateTerrainHeights(heights);
      }

      // Manantial de agua continuo por defecto en el centro-norte del mapa
      waterSolver.addSource({
        x: Math.floor(worldWidth / 2),
        z: Math.floor(worldHeight / 4),
        targetDepth: 3.5,
        flowRate: 3.0,
      });

      const reply: WorkerToMainMessage = {
        type: 'WORLD_INITIALIZED',
        payload: { width: worldWidth, height: worldHeight, seed },
      };
      self.postMessage(reply);
      startLoop();
      break;
    }

    case 'SYNC_TERRAIN': {
      if (waterSolver) {
        waterSolver.updateTerrainHeights(msg.payload.heights);
      }
      break;
    }

    case 'ADD_WATER_SOURCE': {
      if (waterSolver) {
        waterSolver.addSource(msg.payload);
      }
      break;
    }

    case 'SET_SIMULATION_SPEED': {
      simSpeed = msg.payload.speed;
      break;
    }

    case 'TICK_MANUAL': {
      tick();
      break;
    }

    default:
      console.warn('[SimWorker] Mensaje desconocido:', msg);
  }
};
