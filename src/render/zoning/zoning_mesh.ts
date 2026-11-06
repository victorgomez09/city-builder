import * as THREE from 'three';
import { ZoningManager, ZoneType } from '@core/zoning/zoning_manager';

/**
 * Renderizador de Casillas de Zonificación RCI (Estilo CityRT):
 * Dibuja la cuadrícula de zonificación de 4m x 4m que bordea las calles.
 * Tiñe las parcelas con colores RCI semi-translúcidos:
 * - Verde (#4caf50): Residencial
 * - Azul (#2196f3): Comercial
 * - Naranja (#ff9800): Industrial
 * - Blanco translúcido: Disponible para zonificar
 */
export class ZoningMesh {
  public group: THREE.Group = new THREE.Group();
  private mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.MeshBasicMaterial;

  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.renderOrder = 3;
    this.group.add(this.mesh);
  }

  /**
   * Reconstruye la malla de casillas de zonificación.
   */
  public rebuild(manager: ZoningManager, onlyShowActive: boolean = false): void {
    const positions: number[] = [];
    const colors: number[] = [];

    const halfS = (manager.cellSize * 0.92) / 2;

    const colRes = new THREE.Color(0x4caf50); // Verde Residencial
    const colCom = new THREE.Color(0x2196f3); // Azul Comercial
    const colInd = new THREE.Color(0xff9800); // Amarillo/Naranja Industrial
    const colEmpty = new THREE.Color(0x90caf9); // Azul pálido para casillas vacías disponibles

    for (const cell of manager.cells.values()) {
      if (onlyShowActive && cell.zoneType === ZoneType.NONE) continue;

      let c = colEmpty;
      let alphaMultiplier = 0.28;

      if (cell.zoneType === ZoneType.RESIDENTIAL) {
        c = colRes;
        alphaMultiplier = 0.85;
      } else if (cell.zoneType === ZoneType.COMMERCIAL) {
        c = colCom;
        alphaMultiplier = 0.85;
      } else if (cell.zoneType === ZoneType.INDUSTRIAL) {
        c = colInd;
        alphaMultiplier = 0.85;
      }

      const cosY = Math.cos(cell.yaw);
      const sinY = Math.sin(cell.yaw);

      const corners = [
        { x: -halfS, z: -halfS },
        { x: halfS, z: -halfS },
        { x: halfS, z: halfS },
        { x: -halfS, z: halfS },
      ];

      const rotated = corners.map((pt) => ({
        x: cell.x + pt.x * cosY - pt.z * sinY,
        y: cell.elevation + 0.12,
        z: cell.z + pt.x * sinY + pt.z * cosY,
      }));

      // 2 triángulos por casilla
      const quad = [
        rotated[0]!, rotated[1]!, rotated[2]!,
        rotated[0]!, rotated[2]!, rotated[3]!,
      ];

      for (const p of quad) {
        positions.push(p.x, p.y, p.z);
        colors.push(c.r * alphaMultiplier, c.g * alphaMultiplier, c.b * alphaMultiplier);
      }
    }

    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.geometry.computeVertexNormals();
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.group.clear();
  }
}
