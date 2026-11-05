import * as THREE from 'three';
import { TerrainGridData, BIOME_WATER, BIOME_SAND, BIOME_GRASS, BIOME_FOREST, BIOME_ROCK } from '@core/terrain_data';

/**
 * Paleta de colores cálida Low-Poly para los diferentes biomas.
 */
const BIOME_COLORS: Record<number, THREE.Color> = {
  [BIOME_WATER]: new THREE.Color(0x3a9bdc), // Azul vibrante
  [BIOME_SAND]: new THREE.Color(0xe8d098),  // Arena cálida
  [BIOME_GRASS]: new THREE.Color(0x76b852), // Verde pradera vivo
  [BIOME_FOREST]: new THREE.Color(0x56963d),// Verde bosque profundo
  [BIOME_ROCK]: new THREE.Color(0x9e9e9e),  // Gris roca montañosa
};

/**
 * Renderizador del Terreno Low-Poly con sombreado plano (Flat Shading) y colores por vértice.
 * Todo el terreno se genera en un único BufferGeometry y una sola llamada de render (1 Draw Call).
 */
export class TerrainMesh {
  public group: THREE.Group = new THREE.Group();
  private terrainMesh: THREE.Mesh | null = null;
  private waterMesh: THREE.Mesh | null = null;
  private gridData: TerrainGridData;

  constructor(gridData: TerrainGridData) {
    this.gridData = gridData;
    this.buildMesh();
  }

  private buildMesh(): void {
    const { width, height, cellSize, heights, biomes } = this.gridData;

    // Centro del mundo en (0, 0, 0)
    const offsetX = (width * cellSize) / 2;
    const offsetZ = (height * cellSize) / 2;

    const positions: number[] = [];
    const colors: number[] = [];

    // Construcción de quads descompuestos en 2 triángulos por celda
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const biome = biomes[z * width + x] ?? BIOME_GRASS;
        const color = BIOME_COLORS[biome] ?? BIOME_COLORS[BIOME_GRASS]!;

        // 4 esquinas de la celda
        const x0 = x * cellSize - offsetX;
        const x1 = (x + 1) * cellSize - offsetX;
        const z0 = z * cellSize - offsetZ;
        const z1 = (z + 1) * cellSize - offsetZ;

        const h00 = heights[z * (width + 1) + x] ?? 0;
        const h10 = heights[z * (width + 1) + (x + 1)] ?? 0;
        const h01 = heights[(z + 1) * (width + 1) + x] ?? 0;
        const h11 = heights[(z + 1) * (width + 1) + (x + 1)] ?? 0;

        // Triángulo 1: (0,0) -> (0,1) -> (1,0)
        positions.push(
          x0, h00, z0,
          x0, h01, z1,
          x1, h10, z0
        );

        // Triángulo 2: (1,0) -> (0,1) -> (1,1)
        positions.push(
          x1, h10, z0,
          x0, h01, z1,
          x1, h11, z1
        );

        // Colores por vértice (6 vértices)
        for (let i = 0; i < 6; i++) {
          colors.push(color.r, color.g, color.b);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true, // Sombreado plano low-poly característico
    });

    this.terrainMesh = new THREE.Mesh(geometry, material);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.castShadow = true;
    this.group.add(this.terrainMesh);

    // Malla de plano de agua low-poly translúcido
    const waterGeo = new THREE.PlaneGeometry(width * cellSize, height * cellSize, 1, 1);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshLambertMaterial({
      color: 0x3a9bdc,
      transparent: true,
      opacity: 0.75,
      flatShading: true,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.y = 0.55; // Nivel de agua justo por encima de las hendiduras
    this.waterMesh.receiveShadow = true;
    this.group.add(this.waterMesh);
  }

  /**
   * Modifica la altura de un vértice en tiempo real (terraformación)
   */
  public setVertexHeight(x: number, z: number, newHeight: number): void {
    const { width, height } = this.gridData;
    if (x < 0 || x > width || z < 0 || z > height) return;

    const index = z * (width + 1) + x;
    this.gridData.heights[index] = newHeight;

    // Reconstruir geometría para actualizar normales flat shading
    if (this.terrainMesh) {
      this.group.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
      this.buildMesh();
    }
  }

  public dispose(): void {
    if (this.terrainMesh) {
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
    }
    if (this.waterMesh) {
      this.waterMesh.geometry.dispose();
      (this.waterMesh.material as THREE.Material).dispose();
    }
  }
}
