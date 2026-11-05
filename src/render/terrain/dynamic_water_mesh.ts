import * as THREE from 'three';

/**
 * Renderizador de Malla Dinámica de Agua SWE calibrado estilo Fable Cities:
 * - Color azul océano / turquesa vibrante translúcido (`#1b7cb0`).
 * - Especularidad PBR suave con reflejos directos del cielo y del sol.
 * - Integración con el solver de ecuaciones de aguas someras (SWE).
 */
export class DynamicWaterMesh {
  public mesh: THREE.Mesh;
  private width: number;
  private height: number;
  private cellSize: number;
  private posAttr: THREE.Float32BufferAttribute;

  constructor(width: number, height: number, cellSize: number = 2.0) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;

    const cellCount = width * height;
    const vertexCount = cellCount * 6;
    const positions = new Float32Array(vertexCount * 3);

    this.posAttr = new THREE.Float32BufferAttribute(positions, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.posAttr);

    const material = new THREE.MeshStandardMaterial({
      color: 0x1b7cb0,
      roughness: 0.08,
      metalness: 0.12,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 2;
  }

  public updateWaterLevels(waterDepths: Float32Array, terrainHeights: Float32Array): void {
    const posArray = this.posAttr.array as Float32Array;
    const w = this.width;
    const h = this.height;
    const cs = this.cellSize;
    const offsetX = (w * cs) / 2;
    const offsetZ = (h * cs) / 2;
    const vStride = w + 1;

    for (let z = 0; z < h; z++) {
      for (let x = 0; x < w; x++) {
        const cellIdx = z * w + x;
        const depth = waterDepths[cellIdx] ?? 0;
        const vOffset = cellIdx * 18;

        const x0 = x * cs - offsetX;
        const x1 = (x + 1) * cs - offsetX;
        const z0 = z * cs - offsetZ;
        const z1 = (z + 1) * cs - offsetZ;

        // Si la cota de terreno ya está bajo el nivel del mar base (1.5) o hay agua SWE
        const baseH00 = terrainHeights[z * vStride + x] ?? 0;
        const isBelowSea = baseH00 < 1.48;

        if (depth <= 0.04 && !isBelowSea) {
          for (let i = 0; i < 6; i++) {
            posArray[vOffset + i * 3 + 1] = -15.0; // Ocultar celda sin agua
          }
          continue;
        }

        const effectiveDepth = Math.max(depth, isBelowSea ? 1.5 - baseH00 : 0);

        const h00 = Math.max(1.5, baseH00 + effectiveDepth);
        const h10 = Math.max(1.5, (terrainHeights[z * vStride + (x + 1)] ?? 0) + effectiveDepth);
        const h01 = Math.max(1.5, (terrainHeights[(z + 1) * vStride + x] ?? 0) + effectiveDepth);
        const h11 = Math.max(1.5, (terrainHeights[(z + 1) * vStride + (x + 1)] ?? 0) + effectiveDepth);

        posArray[vOffset + 0] = x0;  posArray[vOffset + 1] = h00; posArray[vOffset + 2] = z0;
        posArray[vOffset + 3] = x0;  posArray[vOffset + 4] = h01; posArray[vOffset + 5] = z1;
        posArray[vOffset + 6] = x1;  posArray[vOffset + 7] = h10; posArray[vOffset + 8] = z0;

        posArray[vOffset + 9] = x1;  posArray[vOffset + 10] = h10; posArray[vOffset + 11] = z0;
        posArray[vOffset + 12] = x0; posArray[vOffset + 13] = h01; posArray[vOffset + 14] = z1;
        posArray[vOffset + 15] = x1; posArray[vOffset + 16] = h11; posArray[vOffset + 17] = z1;
      }
    }

    this.posAttr.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
