import * as THREE from 'three';
import { AssetManager } from '@render/assets/asset_manager';

export interface FoliagePoint {
  x: number;
  y: number;
  z: number;
  scale?: number;
  type?: 'tree' | 'bush';
}

/**
 * Gestor de Vegetación y Arbolado de Alto Rendimiento (Fable Cities / Cities: Skylines II):
 * - Renderizado masivo mediante InstancedMesh agrupado (Troncos + Copas).
 * - Cero caídas de frames (2 draw calls en GPU para cientos de árboles y arbustos).
 * - Materiales PBR con cortezas (/assets/shared/Bark012/) y follaje verde vivo (/assets/shared/Grass004/).
 * - Sombras suaves proyectadas sobre carreteras, edificios y terreno.
 */
export class FoliageManager {
  public group: THREE.Group = new THREE.Group();
  private scene: THREE.Scene;

  private trunkMesh: THREE.InstancedMesh | null = null;
  private foliageMesh: THREE.InstancedMesh | null = null;
  private bushMesh: THREE.InstancedMesh | null = null;

  private barkMat: THREE.MeshStandardMaterial;
  private leavesMat: THREE.MeshStandardMaterial;
  private bushMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const assets = AssetManager.getInstance();

    // 1. Material PBR de corteza de tronco
    this.barkMat = assets.createPBRMaterial({
      colorMapUrl: '/assets/shared/Bark012/color.jpg',
      normalMapUrl: '/assets/shared/Bark012/normal.jpg',
      roughnessMapUrl: '/assets/shared/Bark012/roughness.jpg',
      repeat: 2,
      roughness: 0.90,
      metalness: 0.02,
      colorTint: 0x5a483c,
    });

    // 2. Material PBR de copa de hojas verde bosque
    this.leavesMat = assets.createPBRMaterial({
      colorMapUrl: '/assets/shared/Grass004/color.jpg',
      normalMapUrl: '/assets/shared/Grass004/normal.jpg',
      roughnessMapUrl: '/assets/shared/Grass004/roughness.jpg',
      repeat: 3,
      roughness: 0.76,
      metalness: 0.01,
      colorTint: 0x3d7838, // Verde orgánico natural
    });

    // 3. Material PBR para arbustos
    this.bushMat = assets.createPBRMaterial({
      colorMapUrl: '/assets/shared/Grass003/color.jpg',
      normalMapUrl: '/assets/shared/Grass003/normal.jpg',
      roughnessMapUrl: '/assets/shared/Grass003/roughness.jpg',
      repeat: 2,
      roughness: 0.82,
      metalness: 0.01,
      colorTint: 0x48883e,
    });

    this.scene.add(this.group);
  }

  /**
   * Instancia masivamente árboles y arbustos en el mundo.
   */
  public setFoliage(points: FoliagePoint[]): void {
    this.clear();

    const trees = points.filter((p) => p.type !== 'bush');
    const bushes = points.filter((p) => p.type === 'bush');

    const dummy = new THREE.Object3D();

    // 1. Instanciación de árboles (Tronco + Copa esférica/dodecaédrica)
    if (trees.length > 0) {
      // Geometría del tronco
      const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 2.6, 6);
      trunkGeo.translate(0, 1.3, 0);

      // Geometría de la copa del árbol
      const leavesGeo = new THREE.DodecahedronGeometry(1.65, 1);
      leavesGeo.translate(0, 3.4, 0);

      this.trunkMesh = new THREE.InstancedMesh(trunkGeo, this.barkMat, trees.length);
      this.trunkMesh.castShadow = true;
      this.trunkMesh.receiveShadow = true;

      this.foliageMesh = new THREE.InstancedMesh(leavesGeo, this.leavesMat, trees.length);
      this.foliageMesh.castShadow = true;
      this.foliageMesh.receiveShadow = true;

      for (let i = 0; i < trees.length; i++) {
        const pt = trees[i]!;
        const s = pt.scale ?? (0.85 + (i % 7) * 0.06);
        const rotY = (i * 1.37) % (Math.PI * 2);

        // Tronco
        dummy.position.set(pt.x, pt.y, pt.z);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        this.trunkMesh.setMatrixAt(i, dummy.matrix);

        // Copa
        this.foliageMesh.setMatrixAt(i, dummy.matrix);
      }

      this.trunkMesh.instanceMatrix.needsUpdate = true;
      this.foliageMesh.instanceMatrix.needsUpdate = true;
      this.group.add(this.trunkMesh);
      this.group.add(this.foliageMesh);
    }

    // 2. Instanciación de arbustos
    if (bushes.length > 0) {
      const bushGeo = new THREE.SphereGeometry(0.85, 6, 5);
      bushGeo.scale(1.2, 0.75, 1.1);
      bushGeo.translate(0, 0.55, 0);

      this.bushMesh = new THREE.InstancedMesh(bushGeo, this.bushMat, bushes.length);
      this.bushMesh.castShadow = true;
      this.bushMesh.receiveShadow = true;

      for (let i = 0; i < bushes.length; i++) {
        const pt = bushes[i]!;
        const s = pt.scale ?? (0.8 + (i % 5) * 0.08);
        const rotY = (i * 2.11) % (Math.PI * 2);

        dummy.position.set(pt.x, pt.y, pt.z);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        this.bushMesh.setMatrixAt(i, dummy.matrix);
      }

      this.bushMesh.instanceMatrix.needsUpdate = true;
      this.group.add(this.bushMesh);
    }
  }

  public clear(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0]!;
      this.group.remove(child);
      if ((child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose();
      }
    }
    this.trunkMesh = null;
    this.foliageMesh = null;
    this.bushMesh = null;
  }

  public dispose(): void {
    this.clear();
    this.barkMat.dispose();
    this.leavesMat.dispose();
    this.bushMat.dispose();
    this.scene.remove(this.group);
  }
}
