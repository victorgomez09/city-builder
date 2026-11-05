export interface WaterSource {
  x: number;       // Celda X en la cuadrícula
  z: number;       // Celda Z en la cuadrícula
  targetDepth: number; // Altura objetivo del agua en esta celda
  flowRate: number;    // Caudal de inyección/extracción por segundo
}

export interface WaterGridData {
  width: number;
  height: number;
  cellSize: number;
  waterDepth: Float32Array; // Profundidad de la columna de agua por celda (d)
  terrainHeight: Float32Array; // Altura del lecho del terreno por celda (b)
}

/**
 * Solver Hidrodinámico de Ecuaciones de Aguas Someras (Shallow Water Equations - SWE 2.5D).
 * 
 * Implementación basada en flujo de tuberías / diferencias finitas conservativas:
 * - Calcula la diferencia de nivel de superficie libre (b + d).
 * - Transfiere volumen de agua entre celdas vecinas impulsado por la aceleración de gravedad (g = 9.81 m/s²).
 * - Aplica amortiguación de fricción del lecho para garantizar estabilidad numérica sin explosiones.
 * - Soporta manantiales (sources) y sumideros infinitos en los bordes del mapa.
 */
export class ShallowWaterSolver {
  public width: number;
  public height: number;
  public cellSize: number;

  // Arrays de estado
  public waterDepth: Float32Array;       // Altura de agua d[x, z]
  private newWaterDepth: Float32Array;   // Buffer de doble swap
  public terrainHeight: Float32Array;    // Altura del terreno b[x, z]

  // Flujos horizontales en las aristas de la celda (Eje X y Eje Z)
  public fluxX: Float32Array; // (width + 1) * height
  public fluxZ: Float32Array; // width * (height + 1)

  // Fuentes de agua activas
  public sources: WaterSource[] = [];

  // Parámetros físicos calibrados
  public gravity: number = 9.81;
  public damping: number = 0.985; // Fricción viscosa para evitar resonancias

  constructor(width: number, height: number, cellSize: number = 2.0) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;

    const cellCount = width * height;
    this.waterDepth = new Float32Array(cellCount);
    this.newWaterDepth = new Float32Array(cellCount);
    this.terrainHeight = new Float32Array(cellCount);

    this.fluxX = new Float32Array((width + 1) * height);
    this.fluxZ = new Float32Array(width * (height + 1));
  }

  /**
   * Sincroniza las alturas del terreno desde el Heightfield del mundo.
   */
  public updateTerrainHeights(vertexHeights: Float32Array): void {
    const vStride = this.width + 1;
    for (let z = 0; z < this.height; z++) {
      for (let x = 0; x < this.width; x++) {
        // Altura media de la celda cuadrangular
        const h00 = vertexHeights[z * vStride + x] ?? 0;
        const h10 = vertexHeights[z * vStride + (x + 1)] ?? 0;
        const h01 = vertexHeights[(z + 1) * vStride + x] ?? 0;
        const h11 = vertexHeights[(z + 1) * vStride + (x + 1)] ?? 0;
        this.terrainHeight[z * this.width + x] = (h00 + h10 + h01 + h11) * 0.25;
      }
    }
  }

  /**
   * Añade o actualiza una fuente de agua continua (manantial).
   */
  public addSource(source: WaterSource): void {
    this.sources.push(source);
  }

  /**
   * Ejecuta un paso de integración física en tiempo fijo (Fixed Timestep).
   * 
   * @param dt Delta de tiempo en segundos (ej. 0.05 para 20Hz)
   */
  public step(dt: number): void {
    const w = this.width;
    const h = this.height;
    const g = this.gravity;
    const dx = this.cellSize;
    const dt_dx = dt / dx;

    // 1. Inyectar / extraer agua de las fuentes
    for (let i = 0; i < this.sources.length; i++) {
      const src = this.sources[i]!;
      if (src.x >= 0 && src.x < w && src.z >= 0 && src.z < h) {
        const idx = src.z * w + src.x;
        const currentD = this.waterDepth[idx] ?? 0;
        const diff = src.targetDepth - currentD;
        const injected = Math.min(Math.abs(diff), src.flowRate * dt) * Math.sign(diff);
        this.waterDepth[idx] = Math.max(0, currentD + injected);
      }
    }

    // 2. Calcular flujos horizontales en el eje X
    for (let z = 0; z < h; z++) {
      for (let x = 0; x <= w; x++) {
        const fluxIdx = z * (w + 1) + x;

        // Borde exterior del mapa: sumidero infinito de drenaje
        if (x === 0 || x === w) {
          this.fluxX[fluxIdx] = 0;
          continue;
        }

        const idxLeft = z * w + (x - 1);
        const idxRight = z * w + x;

        const hLeft = (this.terrainHeight[idxLeft] ?? 0) + (this.waterDepth[idxLeft] ?? 0);
        const hRight = (this.terrainHeight[idxRight] ?? 0) + (this.waterDepth[idxRight] ?? 0);

        // Aceleración por desnivel de superficie libre: g * deltaH
        const deltaH = hLeft - hRight;
        let newFlux = (this.fluxX[fluxIdx] ?? 0) * this.damping + g * deltaH * dt;

        // Limitar flujo según el agua disponible en la celda donante
        if (newFlux > 0) {
          const maxVolume = ((this.waterDepth[idxLeft] ?? 0) * dx) / dt;
          newFlux = Math.min(newFlux, maxVolume);
        } else if (newFlux < 0) {
          const maxVolume = ((this.waterDepth[idxRight] ?? 0) * dx) / dt;
          newFlux = Math.max(newFlux, -maxVolume);
        }

        this.fluxX[fluxIdx] = newFlux;
      }
    }

    // 3. Calcular flujos horizontales en el eje Z
    for (let z = 0; z <= h; z++) {
      for (let x = 0; x < w; x++) {
        const fluxIdx = z * w + x;

        // Bordes de mapa: sumideros
        if (z === 0 || z === h) {
          this.fluxZ[fluxIdx] = 0;
          continue;
        }

        const idxUp = (z - 1) * w + x;
        const idxDown = z * w + x;

        const hUp = (this.terrainHeight[idxUp] ?? 0) + (this.waterDepth[idxUp] ?? 0);
        const hDown = (this.terrainHeight[idxDown] ?? 0) + (this.waterDepth[idxDown] ?? 0);

        const deltaH = hUp - hDown;
        let newFlux = (this.fluxZ[fluxIdx] ?? 0) * this.damping + g * deltaH * dt;

        if (newFlux > 0) {
          const maxVolume = ((this.waterDepth[idxUp] ?? 0) * dx) / dt;
          newFlux = Math.min(newFlux, maxVolume);
        } else if (newFlux < 0) {
          const maxVolume = ((this.waterDepth[idxDown] ?? 0) * dx) / dt;
          newFlux = Math.max(newFlux, -maxVolume);
        }

        this.fluxZ[fluxIdx] = newFlux;
      }
    }

    // 4. Actualizar profundidad de agua (Conservación estricta de masa)
    for (let z = 0; z < h; z++) {
      for (let x = 0; x < w; x++) {
        const cellIdx = z * w + x;
        const currentD = this.waterDepth[cellIdx] ?? 0;

        const fLeft = this.fluxX[z * (w + 1) + x] ?? 0;
        const fRight = this.fluxX[z * (w + 1) + (x + 1)] ?? 0;
        const fUp = this.fluxZ[z * w + x] ?? 0;
        const fDown = this.fluxZ[(z + 1) * w + x] ?? 0;

        // Divergencia neta de flujo
        const netFlux = (fLeft - fRight) + (fUp - fDown);
        let updatedD = currentD + netFlux * (dt_dx / dx);

        // Filtrar residuos ínfimos para evitar temblores numéricos
        if (updatedD < 0.005) {
          updatedD = 0;
        }

        this.newWaterDepth[cellIdx] = updatedD;
      }
    }

    // 5. Swap de buffers sin alocación
    for (let i = 0; i < this.waterDepth.length; i++) {
      this.waterDepth[i] = this.newWaterDepth[i] ?? 0;
    }
  }

  /**
   * Comprueba si una celda está sumergida bajo el agua.
   */
  public isUnderwater(x: number, z: number, threshold: number = 0.2): boolean {
    if (x < 0 || x >= this.width || z < 0 || z >= this.height) return false;
    return (this.waterDepth[z * this.width + x] ?? 0) > threshold;
  }
}
