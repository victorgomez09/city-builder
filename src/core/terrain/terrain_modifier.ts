/**
 * Modos de brocha de terraformación disponibles para el jugador.
 */
export enum TerraformTool {
  NONE = 'NONE',
  RAISE = 'RAISE',     // Elevar terreno progresivamente
  LOWER = 'LOWER',     // Hundir terreno progresivamente
  FLATTEN = 'FLATTEN', // Nivelar / Allanar a una altura objetivo fija
  SMOOTH = 'SMOOTH',   // Suavizar desniveles abruptos (filtro de promedio)
}

export interface BrushSettings {
  tool: TerraformTool;
  radius: number;       // Radio en unidades del mundo
  strength: number;     // Fuerza de elevación/suavizado por segundo
  targetHeight: number; // Altura objetivo para la herramienta FLATTEN
}

/**
 * Lógica matemática pura de deformación de terreno (Agnóstica de render, ejecutable en headless/Worker/Main).
 * Opera directamente sobre arrays contiguos de alturas (Heightfield).
 */
export class TerrainModifier {
  /**
   * Aplica la brocha seleccionada sobre el array de alturas en la zona de influencia circular.
   * 
   * @param heights Array contiguo de alturas de vértices ((width + 1) * (height + 1))
   * @param width Cantidad de celdas en el eje X
   * @param height Cantidad de celdas en el eje Z
   * @param cellSize Tamaño métrico de cada celda
   * @param worldX Coordenada X del centro de la brocha en el mundo
   * @param worldZ Coordenada Z del centro de la brocha en el mundo
   * @param settings Parámetros de la brocha (radio, fuerza, herramienta)
   * @param deltaTime Segundos transcurridos desde el último cálculo
   * @returns Bounding box de vértices modificados [minVX, maxVX, minVZ, maxVZ] para optimizar la GPU
   */
  public static applyBrush(
    heights: Float32Array,
    width: number,
    height: number,
    cellSize: number,
    worldX: number,
    worldZ: number,
    settings: BrushSettings,
    deltaTime: number
  ): [number, number, number, number] | null {
    if (settings.tool === TerraformTool.NONE || settings.radius <= 0) {
      return null;
    }

    const offsetX = (width * cellSize) / 2;
    const offsetZ = (height * cellSize) / 2;

    // Convertir coordenadas del mundo a índices de vértices continuos
    const gridX = (worldX + offsetX) / cellSize;
    const gridZ = (worldZ + offsetZ) / cellSize;
    const radiusInCells = settings.radius / cellSize;
    const radiusSq = radiusInCells * radiusInCells;

    const minVX = Math.max(0, Math.floor(gridX - radiusInCells));
    const maxVX = Math.min(width, Math.ceil(gridX + radiusInCells));
    const minVZ = Math.max(0, Math.floor(gridZ - radiusInCells));
    const maxVZ = Math.min(height, Math.ceil(gridZ + radiusInCells));

    if (minVX > maxVX || minVZ > maxVZ) return null;

    const amount = settings.strength * deltaTime;
    const stride = width + 1;

    // Si la herramienta es SMOOTH, precalculamos el promedio local antes de sobreescribir
    let localAvg = 0;
    let localCount = 0;
    if (settings.tool === TerraformTool.SMOOTH) {
      for (let vz = minVZ; vz <= maxVZ; vz++) {
        for (let vx = minVX; vx <= maxVX; vx++) {
          const dx = vx - gridX;
          const dz = vz - gridZ;
          const distSq = dx * dx + dz * dz;
          if (distSq <= radiusSq) {
            localAvg += heights[vz * stride + vx] ?? 0;
            localCount++;
          }
        }
      }
      if (localCount > 0) {
        localAvg /= localCount;
      }
    }

    // Aplicar deformación con atenuación radial cuadrática suave (Falloff cosenoidal / suave)
    for (let vz = minVZ; vz <= maxVZ; vz++) {
      for (let vx = minVX; vx <= maxVX; vx++) {
        const dx = vx - gridX;
        const dz = vz - gridZ;
        const distSq = dx * dx + dz * dz;

        if (distSq <= radiusSq) {
          const dist = Math.sqrt(distSq);
          // Factor de atenuación: 1 en el centro, 0 en el borde
          const falloff = 0.5 * (1 + Math.cos((dist / radiusInCells) * Math.PI));
          const idx = vz * stride + vx;
          const currentH = heights[idx] ?? 0;

          switch (settings.tool) {
            case TerraformTool.RAISE:
              heights[idx] = Math.min(25.0, currentH + amount * falloff);
              break;

            case TerraformTool.LOWER:
              heights[idx] = Math.max(0.0, currentH - amount * falloff);
              break;

            case TerraformTool.FLATTEN: {
              const diff = settings.targetHeight - currentH;
              heights[idx] = currentH + diff * Math.min(1.0, amount * falloff * 2.0);
              break;
            }

            case TerraformTool.SMOOTH: {
              const diff = localAvg - currentH;
              heights[idx] = currentH + diff * Math.min(1.0, amount * falloff * 2.0);
              break;
            }
          }
        }
      }
    }

    return [minVX, maxVX, minVZ, maxVZ];
  }
}
