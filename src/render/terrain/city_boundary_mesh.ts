import * as THREE from 'three';
import { CityTileManager } from '@core/world/city_tile_manager';

/**
 * Renderizador Visual de Límites de Ciudad y Parcelas (Estilo Cities: Skylines / CityRT):
 * - Dibuja el perímetro exacto de las parcelas desbloqueadas mediante cintas de frontera elevadas sobre el terreno.
 * - Hitos / balizas en las esquinas de la propiedad de la ciudad.
 * - Modo de visualización de parcelas (Tile Purchase View) para ver sectores disponibles para compra.
 */
export class CityBoundaryMesh {
  public group: THREE.Group = new THREE.Group();

  private boundaryLines: THREE.LineSegments;
  private pylonMesh: THREE.InstancedMesh | null = null;
  private tileOverlayGroup: THREE.Group = new THREE.Group();

  private boundaryGeo: THREE.BufferGeometry;
  private boundaryMat: THREE.LineBasicMaterial;
  private pylonMat: THREE.MeshStandardMaterial;

  private isAreasViewActive: boolean = false;

  constructor() {
    this.boundaryGeo = new THREE.BufferGeometry();
    this.boundaryMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
      depthTest: true,
      depthWrite: false,
    });

    this.boundaryLines = new THREE.LineSegments(this.boundaryGeo, this.boundaryMat);
    this.boundaryLines.renderOrder = 20;
    this.group.add(this.boundaryLines);

    this.pylonMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00b4d8,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.8,
    });

    this.group.add(this.tileOverlayGroup);
    this.tileOverlayGroup.visible = false;
  }

  /**
   * Reconstruye las líneas perimetrales de la ciudad según las parcelas desbloqueadas.
   */
  public rebuild(
    tileManager: CityTileManager,
    getElevation: (gx: number, gz: number) => number
  ): void {
    const points: number[] = [];
    const pylonPositions: THREE.Vector3[] = [];

    const { worldWidth, worldHeight, cellSize, tileCellSize, tilesX, tilesZ } = tileManager;
    const offsetX = (worldWidth * cellSize) / 2;
    const offsetZ = (worldHeight * cellSize) / 2;

    const sampleElevation = (wx: number, wz: number): number => {
      const gx = Math.max(0, Math.min(worldWidth - 1, Math.floor((wx + offsetX) / cellSize)));
      const gz = Math.max(0, Math.min(worldHeight - 1, Math.floor((wz + offsetZ) / cellSize)));
      return getElevation(gx, gz) + 0.22; // Elevado 22cm sobre el terreno
    };

    // 1. Encontrar bordes exteriores de todas las parcelas desbloqueadas
    for (let tz = 0; tz < tilesZ; tz++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const tile = tileManager.getTile(tx, tz);
        if (!tile || !tile.unlocked) continue;

        const minCellX = tx * tileCellSize;
        const maxCellX = (tx + 1) * tileCellSize;
        const minCellZ = tz * tileCellSize;
        const maxCellZ = (tz + 1) * tileCellSize;

        const x0 = minCellX * cellSize - offsetX;
        const x1 = maxCellX * cellSize - offsetX;
        const z0 = minCellZ * cellSize - offsetZ;
        const z1 = maxCellZ * cellSize - offsetZ;

        // Comprobar los 4 bordes: si el vecino NO está desbloqueado, este borde es frontera exterior
        const topNeighbor = tileManager.getTile(tx, tz - 1);
        const bottomNeighbor = tileManager.getTile(tx, tz + 1);
        const leftNeighbor = tileManager.getTile(tx - 1, tz);
        const rightNeighbor = tileManager.getTile(tx + 1, tz);

        // Borde Norte (z0)
        if (!topNeighbor || !topNeighbor.unlocked) {
          this.addLineSubdivided(points, x0, z0, x1, z0, sampleElevation);
        }
        // Borde Sur (z1)
        if (!bottomNeighbor || !bottomNeighbor.unlocked) {
          this.addLineSubdivided(points, x0, z1, x1, z1, sampleElevation);
        }
        // Borde Oeste (x0)
        if (!leftNeighbor || !leftNeighbor.unlocked) {
          this.addLineSubdivided(points, x0, z0, x0, z1, sampleElevation);
        }
        // Borde Este (x1)
        if (!rightNeighbor || !rightNeighbor.unlocked) {
          this.addLineSubdivided(points, x1, z0, x1, z1, sampleElevation);
        }

        // Balizas en las 4 esquinas de la parcela
        pylonPositions.push(
          new THREE.Vector3(x0, sampleElevation(x0, z0), z0),
          new THREE.Vector3(x1, sampleElevation(x1, z0), z0),
          new THREE.Vector3(x0, sampleElevation(x0, z1), z1),
          new THREE.Vector3(x1, sampleElevation(x1, z1), z1)
        );
      }
    }

    // Actualizar líneas
    this.boundaryGeo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    this.boundaryGeo.computeVertexNormals();

    // Actualizar balizas / hitos
    if (this.pylonMesh) {
      this.group.remove(this.pylonMesh);
      this.pylonMesh.geometry.dispose();
      this.pylonMesh = null;
    }

    if (pylonPositions.length > 0) {
      const pylonGeo = new THREE.CylinderGeometry(0.35, 0.45, 2.2, 6);
      pylonGeo.translate(0, 1.1, 0);

      this.pylonMesh = new THREE.InstancedMesh(pylonGeo, this.pylonMat, pylonPositions.length);
      this.pylonMesh.castShadow = true;
      this.pylonMesh.renderOrder = 21;

      const dummy = new THREE.Object3D();
      for (let i = 0; i < pylonPositions.length; i++) {
        const pos = pylonPositions[i]!;
        dummy.position.copy(pos);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        this.pylonMesh.setMatrixAt(i, dummy.matrix);
      }
      this.pylonMesh.instanceMatrix.needsUpdate = true;
      this.group.add(this.pylonMesh);
    }

    // 2. Reconstruir overlays de parcelas para la vista de compra
    this.rebuildTileOverlays(tileManager, sampleElevation);
  }

  private addLineSubdivided(
    positions: number[],
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    sampleElevation: (wx: number, wz: number) => number,
    stepSize: number = 4.0
  ): void {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.ceil(len / stepSize));

    for (let i = 0; i < steps; i++) {
      const tA = i / steps;
      const tB = (i + 1) / steps;

      const pxA = x0 + (x1 - x0) * tA;
      const pzA = z0 + (z1 - z0) * tA;
      const pyA = sampleElevation(pxA, pzA);

      const pxB = x0 + (x1 - x0) * tB;
      const pzB = z0 + (z1 - z0) * tB;
      const pyB = sampleElevation(pxB, pzB);

      positions.push(pxA, pyA, pzA, pxB, pyB, pzB);
    }
  }

  private rebuildTileOverlays(
    tileManager: CityTileManager,
    sampleElevation: (wx: number, wz: number) => number
  ): void {
    while (this.tileOverlayGroup.children.length > 0) {
      const child = this.tileOverlayGroup.children[0]!;
      this.tileOverlayGroup.remove(child);
      if ((child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose();
      }
    }

    const { worldWidth, worldHeight, cellSize, tileCellSize, tilesX, tilesZ } = tileManager;
    const offsetX = (worldWidth * cellSize) / 2;
    const offsetZ = (worldHeight * cellSize) / 2;
    const tileMetricSize = tileCellSize * cellSize;

    for (let tz = 0; tz < tilesZ; tz++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const tile = tileManager.getTile(tx, tz)!;
        const centerX = (tx + 0.5) * tileMetricSize - offsetX;
        const centerZ = (tz + 0.5) * tileMetricSize - offsetZ;
        const centerY = sampleElevation(centerX, centerZ) + 0.1;

        let col = 0x37474f;
        let opacity = 0.12;

        if (tile.unlocked) {
          col = 0x4caf50; // Verde: Propiedad de la ciudad
          opacity = 0.18;
        } else if (tileManager.isTileAdjacentToUnlocked(tx, tz)) {
          col = 0x0288d1; // Azul: Disponible para compra
          opacity = 0.32;
        }

        const geo = new THREE.PlaneGeometry(tileMetricSize * 0.96, tileMetricSize * 0.96);
        geo.rotateX(-Math.PI / 2);

        const mat = new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity,
          depthWrite: false,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(centerX, centerY, centerZ);
        mesh.renderOrder = 18;
        mesh.userData = { tx, tz, tile };
        this.tileOverlayGroup.add(mesh);
      }
    }
  }

  public setAreasViewVisible(visible: boolean): void {
    this.isAreasViewActive = visible;
    this.tileOverlayGroup.visible = visible;
  }

  public get isAreasView(): boolean {
    return this.isAreasViewActive;
  }

  public dispose(): void {
    this.boundaryGeo.dispose();
    this.boundaryMat.dispose();
    this.pylonMat.dispose();
    if (this.pylonMesh) this.pylonMesh.geometry.dispose();
    this.group.clear();
  }
}
