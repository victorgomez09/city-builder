import { RoadGraph } from '@core/graph/road_graph';
import { ROAD_CONFIGS } from '@core/graph/road_types';

export enum ZoneType {
  NONE = 'NONE',
  RESIDENTIAL = 'RESIDENTIAL',
  COMMERCIAL = 'COMMERCIAL',
  INDUSTRIAL = 'INDUSTRIAL',
}

export interface ZoningCell {
  id: string; // Clave única "x,z"
  x: number;  // Coordenada métrica mundial X
  z: number;  // Coordenada métrica mundial Z
  elevation: number;
  yaw: number; // Orientación perpendicular a la carretera
  zoneType: ZoneType;
  hasBuilding: boolean;
  roadEdgeId: number;
}

/**
 * Gestor de Casillas de Zonificación RCI (Estilo CityRT / Cities: Skylines):
 * Genera automáticamente casillas de zonificación de 4m x 4m a ambos lados de cada carretera trazada.
 * Permite pintar zonas Residenciales (verde), Comerciales (azul) e Industriales (amarillo).
 */
export class ZoningManager {
  public cells: Map<string, ZoningCell> = new Map();
  public cellSize: number = 4.0; // Casillas de 4m x 4m estándar

  private getCellKey(x: number, z: number): string {
    const gx = Math.round(x / this.cellSize);
    const gz = Math.round(z / this.cellSize);
    return `${gx},${gz}`;
  }

  /**
   * Regenera las casillas de zonificación basándose en la red de carreteras actual.
   */
  public generateZoningCells(
    graph: RoadGraph,
    getElevation: (gx: number, gz: number) => number,
    cellSizeMeters: number = 2.0,
    halfMapWidth: number = 128.0,
    halfMapHeight: number = 128.0
  ): void {
    const existingZones = new Map<string, { type: ZoneType; hasBuilding: boolean }>();
    for (const [key, cell] of this.cells.entries()) {
      existingZones.set(key, { type: cell.zoneType, hasBuilding: cell.hasBuilding });
    }

    this.cells.clear();

    const depthRows = 4; // 4 casillas de profundidad a cada lado
    const cellStep = this.cellSize;

    for (const edge of graph.edges.values()) {
      const nodeA = graph.nodes.get(edge.fromNodeId);
      const nodeB = graph.nodes.get(edge.toNodeId);
      if (!nodeA || !nodeB) continue;

      const pA = {
        x: (nodeA.x + 0.5) * cellSizeMeters - halfMapWidth,
        z: (nodeA.z + 0.5) * cellSizeMeters - halfMapHeight,
      };
      const pB = {
        x: (nodeB.x + 0.5) * cellSizeMeters - halfMapWidth,
        z: (nodeB.z + 0.5) * cellSizeMeters - halfMapHeight,
      };

      const dx = pB.x - pA.x;
      const dz = pB.z - pA.z;
      const length = Math.hypot(dx, dz);
      if (length < 2.0) continue;

      const dirX = dx / length;
      const dirZ = dz / length;
      const perpX = -dirZ;
      const perpZ = dirX;

      const roadConfig = ROAD_CONFIGS[edge.roadType];
      const roadHalfW = (roadConfig.width * 1.3) / 2 + 0.8; // Calzada + acera

      const numAlong = Math.max(1, Math.floor(length / cellStep));
      const yaw = Math.atan2(perpZ, perpX);

      for (let i = 0; i < numAlong; i++) {
        const t = (i + 0.5) / numAlong;
        const cx = pA.x + dx * t;
        const cz = pA.z + dz * t;

        // Generar casillas a la izquierda (offset negativo) y a la derecha (offset positivo)
        for (const side of [-1, 1]) {
          for (let row = 0; row < depthRows; row++) {
            const distFromCenter = roadHalfW + (row + 0.5) * cellStep;
            const wx = cx + perpX * side * distFromCenter;
            const wz = cz + perpZ * side * distFromCenter;

            const key = this.getCellKey(wx, wz);
            if (this.cells.has(key)) continue;

            const gridX = Math.round((wx + halfMapWidth) / cellSizeMeters);
            const gridZ = Math.round((wz + halfMapHeight) / cellSizeMeters);
            const elev = getElevation(gridX, gridZ);

            const prev = existingZones.get(key);

            this.cells.set(key, {
              id: key,
              x: wx,
              z: wz,
              elevation: elev,
              yaw: side > 0 ? yaw : yaw + Math.PI,
              zoneType: prev ? prev.type : ZoneType.NONE,
              hasBuilding: prev ? prev.hasBuilding : false,
              roadEdgeId: edge.id,
            });
          }
        }
      }
    }
  }

  /**
   * Pinta casillas de zonificación dentro de un radio alrededor de (wx, wz).
   */
  public paintZone(wx: number, wz: number, radius: number = 8.0, zoneType: ZoneType): string[] {
    const affectedKeys: string[] = [];
    const rSq = radius * radius;

    for (const [key, cell] of this.cells.entries()) {
      const dx = cell.x - wx;
      const dz = cell.z - wz;
      if (dx * dx + dz * dz <= rSq) {
        if (cell.zoneType !== zoneType) {
          cell.zoneType = zoneType;
          if (zoneType === ZoneType.NONE) {
            cell.hasBuilding = false;
          }
          affectedKeys.push(key);
        }
      }
    }

    return affectedKeys;
  }

  /**
   * Obtiene casillas zonificadas que aún no tienen edificio construido.
   */
  public getUnbuiltZonedCells(): ZoningCell[] {
    const unbuilt: ZoningCell[] = [];
    for (const cell of this.cells.values()) {
      if (cell.zoneType !== ZoneType.NONE && !cell.hasBuilding) {
        unbuilt.push(cell);
      }
    }
    return unbuilt;
  }
}
