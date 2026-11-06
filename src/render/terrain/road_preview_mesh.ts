import * as THREE from 'three';
import { RoadType, ROAD_CONFIGS } from '@core/graph/road_types';
import { RoadDrawMode } from '@core/graph/road_draw_mode';
import { SplineUtils } from '@core/graph/spline_utils';
import { Vec2 } from '@core/utils/math';

/**
 * Previsualizador 3D interactivo para el trazado de carreteras estilo CityRT:
 * - Soporta trazado recto directo a CUALQUIER ÁNGULO con subdivisión continua de relieve.
 * - Curvas Bézier suaves continuas.
 * - Rotondas circulares de un clic.
 * - Anillo luminoso de acoplamiento magnético (Snap Ring).
 * - Feedback visual de validez (cian si es viable, rojo si está bloqueado o fuera de límites).
 */
export class RoadPreviewMesh {
  public group: THREE.Group = new THREE.Group();
  private mesh: THREE.Mesh;
  private snapRingMesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.MeshBasicMaterial;
  private snapMaterial: THREE.MeshBasicMaterial;
  private cellSize: number;
  private worldWidth: number;
  private worldHeight: number;

  constructor(worldWidth: number = 128, worldHeight: number = 128, cellSize: number = 2.0) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cellSize = cellSize;

    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.70,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.group.add(this.mesh);

    // Anillo indicador de snapping magnético
    const ringGeo = new THREE.RingGeometry(0.8, 1.4, 24);
    ringGeo.rotateX(-Math.PI / 2);
    this.snapMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd54f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.snapRingMesh = new THREE.Mesh(ringGeo, this.snapMaterial);
    this.snapRingMesh.visible = false;
    this.group.add(this.snapRingMesh);

    this.group.visible = false;
  }

  /**
   * Muestra el anillo de atracción magnética en la coordenada mundial indicada.
   */
  public showSnapRing(wx: number, wy: number, wz: number): void {
    this.snapRingMesh.position.set(wx, wy + 0.15, wz);
    this.snapRingMesh.visible = true;
  }

  public hideSnapRing(): void {
    this.snapRingMesh.visible = false;
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
    getElevation: (x: number, z: number) => number,
    isValid: boolean = true,
    elevationOffset: number = 0
  ): void {
    // Actualizar color según validez
    this.material.color.setHex(isValid ? 0x00e5ff : 0xff3333);
    this.material.opacity = isValid ? 0.70 : 0.85;

    const positions: number[] = [];
    const offsetX = (this.worldWidth * this.cellSize) / 2;
    const offsetZ = (this.worldHeight * this.cellSize) / 2;

    const config = ROAD_CONFIGS[roadType];
    const halfW = (config.width * 1.25) / 2;

    const segments: Array<{ x0: number; z0: number; x1: number; z1: number }> = [];

    if (mode === RoadDrawMode.ROUNDABOUT) {
      // 1. Anillo de rotonda circular centrado en (endX, endZ)
      const radius = 3.5;
      const roundaboutNodes = SplineUtils.generateRoundaboutNodes(endX, endZ, radius, 16);
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
      // 2. Curva Bézier suave continua
      const controlX = startX;
      const controlZ = endZ;
      const sampled = SplineUtils.sampleBezierCells(
        new Vec2(startX, startZ),
        new Vec2(controlX, controlZ),
        new Vec2(endX, endZ),
        16
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
      // 3. Trazado recto a CUALQUIER ÁNGULO (CityRT style) con interpolación de terreno
      const dx = endX - startX;
      const dz = endZ - startZ;
      const dist = Math.hypot(dx, dz);
      const steps = Math.max(1, Math.ceil(dist / 1.5));

      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 1) / steps;
        segments.push({
          x0: startX + dx * t0,
          z0: startZ + dz * t0,
          x1: startX + dx * t1,
          z1: startZ + dz * t1,
        });
      }
    }

    // Generar geometría en cinta orientada sobre el relieve
    for (const seg of segments) {
      const el0 = getElevation(seg.x0, seg.z0) + elevationOffset;
      const el1 = getElevation(seg.x1, seg.z1) + elevationOffset;

      const p0 = new THREE.Vector3(
        (seg.x0 + 0.5) * this.cellSize - offsetX,
        el0 + 0.12,
        (seg.z0 + 0.5) * this.cellSize - offsetZ
      );
      const p1 = new THREE.Vector3(
        (seg.x1 + 0.5) * this.cellSize - offsetX,
        el1 + 0.12,
        (seg.z1 + 0.5) * this.cellSize - offsetZ
      );

      const dir = new THREE.Vector3().subVectors(p1, p0);
      const len = dir.length();
      if (len < 0.0001) continue;
      dir.normalize();

      const perp = new THREE.Vector3(-dir.z, 0, dir.x);

      const v0 = p0.clone().addScaledVector(perp, -halfW);
      const v1 = p0.clone().addScaledVector(perp, halfW);
      const v2 = p1.clone().addScaledVector(perp, -halfW);
      const v3 = p1.clone().addScaledVector(perp, halfW);

      positions.push(
        v0.x, v0.y, v0.z,
        v1.x, v1.y, v1.z,
        v2.x, v2.y, v2.z,
        v2.x, v2.y, v2.z,
        v1.x, v1.y, v1.z,
        v3.x, v3.y, v3.z
      );
    }

    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.computeVertexNormals();
    this.group.visible = positions.length > 0;
  }

  public hide(): void {
    this.group.visible = false;
    this.hideSnapRing();
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.snapMaterial.dispose();
    this.group.clear();
  }
}
