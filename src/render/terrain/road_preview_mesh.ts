import * as THREE from 'three';
import { RoadType, ROAD_CONFIGS } from '@core/graph/road_types';
import { RoadDrawMode } from '@core/graph/road_draw_mode';
import { SplineUtils } from '@core/graph/spline_utils';
import { Vec2 } from '@core/utils/math';

/**
 * Previsualizador 3D interactivo para el trazado de carreteras.
 * Soporta rectas ortogonales, curvas Bézier continuas y rotondas circulares.
 */
export class RoadPreviewMesh {
  public group: THREE.Group = new THREE.Group();
  private mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private cellSize: number;
  private worldWidth: number;
  private worldHeight: number;

  constructor(worldWidth: number = 64, worldHeight: number = 64, cellSize: number = 2.0) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cellSize = cellSize;

    this.geometry = new THREE.BufferGeometry();
    const material = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.group.add(this.mesh);
    this.group.visible = false;
  }

  /**
   * Actualiza la geometría del trazado de vista previa según el modo seleccionado.
   */
  public updatePreview(
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    mode: RoadDrawMode,
    roadType: RoadType,
    getElevation: (x: number, z: number) => number
  ): void {
    const positions: number[] = [];
    const offsetX = (this.worldWidth * this.cellSize) / 2;
    const offsetZ = (this.worldHeight * this.cellSize) / 2;

    const config = ROAD_CONFIGS[roadType];
    const halfW = config.width / 2;

    const segments: Array<{ x0: number; z0: number; x1: number; z1: number }> = [];

    if (mode === RoadDrawMode.ROUNDABOUT) {
      // 1. Previsualizar anillo de rotonda circular centrado en (endX, endZ)
      const roundaboutNodes = SplineUtils.generateRoundaboutNodes(endX, endZ, 2.5, 12);
      for (let i = 0; i < roundaboutNodes.length; i++) {
        const nextIdx = (i + 1) % roundaboutNodes.length;
        segments.push({
          x0: roundaboutNodes[i]!.x,
          z0: roundaboutNodes[i]!.z,
          x1: roundaboutNodes[nextIdx]!.x,
          z1: roundaboutNodes[nextIdx]!.z,
        });
      }
    } else if (mode === RoadDrawMode.CURVE) {
      // 2. Previsualizar curva Bézier suave
      // Punto de control calculado ortogonalmente para formar un arco suave de 90°
      const controlX = startX;
      const controlZ = endZ;
      const sampled = SplineUtils.sampleBezierCells(
        new Vec2(startX, startZ),
        new Vec2(controlX, controlZ),
        new Vec2(endX, endZ),
        10
      );

      for (let i = 0; i < sampled.length - 1; i++) {
        segments.push({
          x0: sampled[i]!.x,
          z0: sampled[i]!.z,
          x1: sampled[i + 1]!.x,
          z1: sampled[i + 1]!.z,
        });
      }
    } else {
      // 3. Trazado recto ortogonal clásico (Manhattan)
      const stepX = Math.sign(endX - startX);
      if (stepX !== 0) {
        for (let x = startX; x !== endX; x += stepX) {
          segments.push({ x0: x, z0: startZ, x1: x + stepX, z1: startZ });
        }
      }

      const stepZ = Math.sign(endZ - startZ);
      if (stepZ !== 0) {
        for (let z = startZ; z !== endZ; z += stepZ) {
          segments.push({ x0: endX, z0: z, x1: endX, z1: z + stepZ });
        }
      }
    }

    // Si start === end en modo recta/curva, mostrar marcador único
    if (segments.length === 0) {
      const cx = (startX + 0.5) * this.cellSize - offsetX;
      const cz = (startZ + 0.5) * this.cellSize - offsetZ;
      const cy = getElevation(startX, startZ) + 0.1;
      const x0 = cx - halfW;
      const x1 = cx + halfW;
      const z0 = cz - halfW;
      const z1 = cz + halfW;

      positions.push(
        x0, cy, z0,
        x0, cy, z1,
        x1, cy, z0,
        x1, cy, z0,
        x0, cy, z1,
        x1, cy, z1
      );
    }

    for (const seg of segments) {
      const elevA = getElevation(seg.x0, seg.z0);
      const elevB = getElevation(seg.x1, seg.z1);

      const pA = new THREE.Vector3(
        (seg.x0 + 0.5) * this.cellSize - offsetX,
        elevA + 0.1,
        (seg.z0 + 0.5) * this.cellSize - offsetZ
      );
      const pB = new THREE.Vector3(
        (seg.x1 + 0.5) * this.cellSize - offsetX,
        elevB + 0.1,
        (seg.z1 + 0.5) * this.cellSize - offsetZ
      );

      const dir = new THREE.Vector3().subVectors(pB, pA).normalize();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(halfW);

      const c1 = new THREE.Vector3().addVectors(pA, perp);
      const c2 = new THREE.Vector3().subVectors(pA, perp);
      const c3 = new THREE.Vector3().addVectors(pB, perp);
      const c4 = new THREE.Vector3().subVectors(pB, perp);

      positions.push(
        c1.x, c1.y, c1.z,
        c2.x, c2.y, c2.z,
        c3.x, c3.y, c3.z,

        c3.x, c3.y, c3.z,
        c2.x, c2.y, c2.z,
        c4.x, c4.y, c4.z
      );
    }

    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.computeVertexNormals();
    this.group.visible = true;
  }

  public hide(): void {
    this.group.visible = false;
  }

  public dispose(): void {
    this.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
