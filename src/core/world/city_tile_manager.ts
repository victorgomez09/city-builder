export interface CityTile {
  tx: number;
  tz: number;
  unlocked: boolean;
  cost: number;
  name: string;
  metricSize: number;       // Ancho y largo métrico en metros (ej. 128m o 256m)
  areaHectares: number;     // Área en hectáreas (1 ha = 10.000 m²)
  waterCoveragePct: number; // Porcentaje de superficie con agua
  flatBuildablePct: number; // Porcentaje de suelo llano apto para construcción rápida
  forestCoveragePct: number;// Cobertura arbórea y forestal
  upkeepWeekly: number;     // Coste semanal de mantenimiento administrativo ($/sem)
}

export interface CityMilestone {
  level: number;
  name: string;
  minPopulation: number;
  maxTilesAllowed: number;
}

export const CITY_MILESTONES: CityMilestone[] = [
  { level: 0, name: 'Pionero', minPopulation: 0, maxTilesAllowed: 1 },
  { level: 1, name: 'Aldea', minPopulation: 250, maxTilesAllowed: 2 },
  { level: 2, name: 'Pueblo', minPopulation: 1000, maxTilesAllowed: 4 },
  { level: 3, name: 'Villa Próspera', minPopulation: 3500, maxTilesAllowed: 6 },
  { level: 4, name: 'Ciudad', minPopulation: 8000, maxTilesAllowed: 9 },
  { level: 5, name: 'Gran Metrópolis', minPopulation: 20000, maxTilesAllowed: 16 },
];

/**
 * Gestor de Macro-Parcelas de Ciudad y Límites de Expansión (Cities: Skylines / CityRT):
 * - Las parcelas tienen dimensiones a macro-escala realista (ej. 128m x 128m o 256m x 256m).
 * - En una sola macro-parcela cabe una ciudad o núcleo urbano completo con avenidas, barrios y servicios.
 * - Desbloqueo progresivo vinculado a hitos demográficos de población (Milestones).
 * - Tasa semanal de mantenimiento territorial (Tile Upkeep).
 * - Análisis orográfico y de recursos naturales por parcela (agua dulce, litoral, llanuras).
 */
export class CityTileManager {
  public readonly tilesX: number;
  public readonly tilesZ: number;
  public readonly tileCellSize: number; // Cantidad de celdas por lado de cada parcela (ej. 64 o 32)
  public readonly worldWidth: number;
  public readonly worldHeight: number;
  public readonly cellSize: number;
  public readonly tileMetricSize: number; // Tamaño métrico por lado en metros

  private tiles: CityTile[][];

  constructor(
    worldWidth: number = 128,
    worldHeight: number = 128,
    cellSize: number = 2.0,
    tileCellSize: number = 64, // Macro-parcela por defecto: 64 celdas * 2m = 128m x 128m (1.64 ha)
    startTileX: number = 0,
    startTileZ: number = 1
  ) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cellSize = cellSize;
    this.tileCellSize = tileCellSize;
    this.tileMetricSize = tileCellSize * cellSize;

    this.tilesX = Math.max(1, Math.floor(worldWidth / tileCellSize));
    this.tilesZ = Math.max(1, Math.floor(worldHeight / tileCellSize));

    this.tiles = [];

    const areaHectares = (this.tileMetricSize * this.tileMetricSize) / 10000.0;

    // Inicializar matriz de macro-parcelas
    for (let tz = 0; tz < this.tilesZ; tz++) {
      const row: CityTile[] = [];
      for (let tx = 0; tx < this.tilesX; tx++) {
        const isStart = tx === startTileX && tz === startTileZ;
        const distFromCenter = Math.hypot(tx - this.tilesX / 2 + 0.5, tz - this.tilesZ / 2 + 0.5);
        const cost = Math.round(15000 + distFromCenter * 4500);

        row.push({
          tx,
          tz,
          unlocked: isStart,
          cost,
          name: `Sector [${tx + 1}, ${tz + 1}]`,
          metricSize: this.tileMetricSize,
          areaHectares,
          waterCoveragePct: 15,
          flatBuildablePct: 75,
          forestCoveragePct: 30,
          upkeepWeekly: 65,
        });
      }
      this.tiles.push(row);
    }
  }

  /**
   * Analiza y enriquece los datos de recursos de cada macro-parcela a partir de las alturas y biomas.
   */
  public analyzeTerrainResources(heights: Float32Array, biomes: Uint8Array): void {
    const stride = this.worldWidth + 1;
    const waterLevel = 1.5;

    for (let tz = 0; tz < this.tilesZ; tz++) {
      for (let tx = 0; tx < this.tilesX; tx++) {
        const tile = this.tiles[tz]![tx]!;

        const minCX = tx * this.tileCellSize;
        const maxCX = Math.min(this.worldWidth, (tx + 1) * this.tileCellSize);
        const minCZ = tz * this.tileCellSize;
        const maxCZ = Math.min(this.worldHeight, (tz + 1) * this.tileCellSize);

        let totalCells = 0;
        let waterCount = 0;
        let flatCount = 0;
        let forestCount = 0;

        for (let cz = minCZ; cz < maxCZ; cz++) {
          for (let cx = minCX; cx < maxCX; cx++) {
            totalCells++;
            const cellIdx = cz * this.worldWidth + cx;
            const b = biomes[cellIdx] ?? 0;

            const h00 = heights[cz * stride + cx] ?? 0;
            const h10 = heights[cz * stride + (cx + 1)] ?? 0;
            const h01 = heights[(cz + 1) * stride + cx] ?? 0;

            if (h00 <= waterLevel) {
              waterCount++;
            } else {
              const slope = Math.hypot(h10 - h00, h01 - h00) / this.cellSize;
              if (slope < 0.22) flatCount++;
            }

            if (b === 3) forestCount++; // BIOME_FOREST
          }
        }

        if (totalCells > 0) {
          tile.waterCoveragePct = Math.round((waterCount / totalCells) * 100);
          tile.flatBuildablePct = Math.round((flatCount / totalCells) * 100);
          tile.forestCoveragePct = Math.round((forestCount / totalCells) * 100);

          // Ajuste de coste por recursos: más agua y llanura añade valor estratégico
          const resourceMultiplier = 1.0 + (tile.waterCoveragePct * 0.003) + (tile.flatBuildablePct * 0.002);
          tile.cost = Math.round(tile.cost * resourceMultiplier);
        }
      }
    }
  }

  /**
   * Obtiene el hito demográfico correspondiente a una cifra de población.
   */
  public getCurrentMilestone(population: number): CityMilestone {
    let current = CITY_MILESTONES[0]!;
    for (const m of CITY_MILESTONES) {
      if (population >= m.minPopulation) {
        current = m;
      } else {
        break;
      }
    }
    return current;
  }

  public getNextMilestone(population: number): CityMilestone | null {
    for (const m of CITY_MILESTONES) {
      if (population < m.minPopulation) {
        return m;
      }
    }
    return null;
  }

  /**
   * Comprueba si una celda (gx, gz) se encuentra dentro de territorio desbloqueado.
   */
  public isCellBuildable(gx: number, gz: number): boolean {
    if (gx < 0 || gx >= this.worldWidth || gz < 0 || gz >= this.worldHeight) {
      return false;
    }
    const tx = Math.floor(gx / this.tileCellSize);
    const tz = Math.floor(gz / this.tileCellSize);

    const tile = this.getTile(tx, tz);
    return tile !== null && tile.unlocked;
  }

  public isWorldPosBuildable(wx: number, wz: number): boolean {
    const offsetX = (this.worldWidth * this.cellSize) / 2;
    const offsetZ = (this.worldHeight * this.cellSize) / 2;
    const gx = Math.floor((wx + offsetX) / this.cellSize);
    const gz = Math.floor((wz + offsetZ) / this.cellSize);
    return this.isCellBuildable(gx, gz);
  }

  public getTile(tx: number, tz: number): CityTile | null {
    if (tx < 0 || tx >= this.tilesX || tz < 0 || tz >= this.tilesZ) {
      return null;
    }
    return this.tiles[tz]?.[tx] ?? null;
  }

  public isTileAdjacentToUnlocked(tx: number, tz: number): boolean {
    const tile = this.getTile(tx, tz);
    if (!tile || tile.unlocked) return false;

    const neighbors = [
      { x: tx + 1, z: tz },
      { x: tx - 1, z: tz },
      { x: tx, z: tz + 1 },
      { x: tx, z: tz - 1 },
    ];

    for (const n of neighbors) {
      const neighbor = this.getTile(n.x, n.z);
      if (neighbor && neighbor.unlocked) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determina si el jugador cumple los requisitos de dinero, adyacencia e hito de población.
   */
  public canUnlockTile(
    tx: number,
    tz: number,
    playerMoney: number,
    population: number = 0
  ): { allowed: boolean; reason?: string } {
    const tile = this.getTile(tx, tz);
    if (!tile) {
      return { allowed: false, reason: 'Parcela no existe' };
    }
    if (tile.unlocked) {
      return { allowed: false, reason: 'Parcela ya adquirida' };
    }
    if (!this.isTileAdjacentToUnlocked(tx, tz)) {
      return { allowed: false, reason: 'Debe ser adyacente a una parcela ya desbloqueada' };
    }

    const milestone = this.getCurrentMilestone(population);
    if (this.getUnlockedTileCount() >= milestone.maxTilesAllowed) {
      const nextM = this.getNextMilestone(population);
      const nextTarget = nextM ? `${nextM.name} (${nextM.minPopulation} hab.)` : 'máximo nivel';
      return { allowed: false, reason: `Límite de parcelas alcanzado. Requiere hito: ${nextTarget}` };
    }

    if (playerMoney < tile.cost) {
      return { allowed: false, reason: `Fondos insuficientes (Requiere $${tile.cost.toLocaleString()})` };
    }

    return { allowed: true };
  }

  public unlockTile(
    tx: number,
    tz: number,
    playerMoney: number,
    population: number = 0
  ): { success: boolean; costDeducted: number; reason?: string } {
    const check = this.canUnlockTile(tx, tz, playerMoney, population);
    if (!check.allowed) {
      return { success: false, costDeducted: 0, reason: check.reason };
    }

    const tile = this.getTile(tx, tz)!;
    tile.unlocked = true;
    return { success: true, costDeducted: tile.cost };
  }

  public getAllTiles(): CityTile[] {
    const list: CityTile[] = [];
    for (let tz = 0; tz < this.tilesZ; tz++) {
      for (let tx = 0; tx < this.tilesX; tx++) {
        list.push(this.tiles[tz]![tx]!);
      }
    }
    return list;
  }

  public getUnlockedTileCount(): number {
    let count = 0;
    for (let tz = 0; tz < this.tilesZ; tz++) {
      for (let tx = 0; tx < this.tilesX; tx++) {
        if (this.tiles[tz]![tx]!.unlocked) count++;
      }
    }
    return count;
  }

  /**
   * Obtiene la caja envolvente acumulada de todas las parcelas desbloqueadas en coordenadas del mundo.
   */
  public getUnlockedWorldBoundingBox(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    const offsetX = (this.worldWidth * this.cellSize) / 2;
    const offsetZ = (this.worldHeight * this.cellSize) / 2;

    let minTileX = this.tilesX;
    let maxTileX = -1;
    let minTileZ = this.tilesZ;
    let maxTileZ = -1;

    for (let tz = 0; tz < this.tilesZ; tz++) {
      for (let tx = 0; tx < this.tilesX; tx++) {
        if (this.tiles[tz]![tx]!.unlocked) {
          if (tx < minTileX) minTileX = tx;
          if (tx > maxTileX) maxTileX = tx;
          if (tz < minTileZ) minTileZ = tz;
          if (tz > maxTileZ) maxTileZ = tz;
        }
      }
    }

    if (maxTileX === -1) {
      return { minX: -offsetX, maxX: offsetX, minZ: -offsetZ, maxZ: offsetZ };
    }

    return {
      minX: minTileX * this.tileMetricSize - offsetX,
      maxX: (maxTileX + 1) * this.tileMetricSize - offsetX,
      minZ: minTileZ * this.tileMetricSize - offsetZ,
      maxZ: (maxTileZ + 1) * this.tileMetricSize - offsetZ,
    };
  }

  /**
   * Calcula el coste de mantenimiento territorial semanal acumulado de todas las parcelas activas.
   */
  public getTotalWeeklyUpkeep(): number {
    let total = 0;
    for (let tz = 0; tz < this.tilesZ; tz++) {
      for (let tx = 0; tx < this.tilesX; tx++) {
        if (this.tiles[tz]![tx]!.unlocked) {
          total += this.tiles[tz]![tx]!.upkeepWeekly;
        }
      }
    }
    return total;
  }
}
