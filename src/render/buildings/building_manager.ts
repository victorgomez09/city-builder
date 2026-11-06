import * as THREE from 'three';
import { AssetManager } from '@render/assets/asset_manager';

export interface BuildingInstanceData {
  x: number;
  y: number;
  z: number;
  yaw: number;
  type: 'skyscraper' | 'midrise' | 'suburb' | 'commercial' | 'industrial';
  width: number;
  depth: number;
  height: number;
  colorTint?: number;
  hasSpire?: boolean;
}

/**
 * Gestor de Edificios Procedimentales PBR de Alta Fidelidad (Fable Cities / Cities: Skylines II):
 * - Rascacielos acristalados Downtown (40m - 98m) con fachadas de muro cortina (/assets/shared/facade_glass/).
 * - Iluminación nocturna de oficinas mediante mapa de emisión (/assets/shared/facade_glass_night/emission.jpg).
 * - Bloques comerciales y residenciales de media densidad con ladrillo (/assets/shared/bricks_red/) y revoco (/assets/shared/plaster_modern/).
 * - Viviendas unifamiliares con tejados inclinados de teja cerámica (/assets/shared/roof_tiles_clay/).
 * - Casetones técnicos de cubierta, antenas de telecomunicaciones y remates de azotea.
 * - Renderizado masivo mediante InstancedMesh agrupado por material: Cero caídas de FPS (< 15 llamadas de dibujo en GPU).
 */
export class BuildingManager {
  public group: THREE.Group = new THREE.Group();
  private scene: THREE.Scene;

  // Materiales PBR
  private glassMat: THREE.MeshStandardMaterial;
  private concreteMat: THREE.MeshStandardMaterial;
  private brickMat: THREE.MeshStandardMaterial;
  private plasterMat: THREE.MeshStandardMaterial;
  private roofTileMat: THREE.MeshStandardMaterial;
  private metalMat: THREE.MeshStandardMaterial;

  private buildingRecords: BuildingInstanceData[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const assets = AssetManager.getInstance();

    // 1. Vidrio de fachada de muro cortina reflectante con iluminación nocturna
    const emissionTex = assets.loadTexture('/assets/shared/facade_glass_night/emission.jpg', 4, 4, false);
    emissionTex.wrapS = emissionTex.wrapT = THREE.RepeatWrapping;

    this.glassMat = assets.createPBRMaterial({
      colorMapUrl: '/assets/shared/facade_glass/color.jpg',
      normalMapUrl: '/assets/shared/facade_glass/normal.jpg',
      roughnessMapUrl: '/assets/shared/facade_glass/roughness.jpg',
      repeat: 4,
      roughness: 0.08,
      metalness: 0.15,
      colorTint: 0x486b88,
    });
    this.glassMat.emissiveMap = emissionTex;
    this.glassMat.emissive = new THREE.Color(0xffe6b0);
    this.glassMat.emissiveIntensity = 0.0;

    // 2. Hormigón estructural arquitectónico
    this.concreteMat = assets.createPBRMaterial({
      colorMapUrl: '/assets/shared/concrete/albedo.jpg',
      normalMapUrl: '/assets/shared/concrete/normal.jpg',
      roughnessMapUrl: '/assets/shared/concrete/roughness.jpg',
      repeat: 3,
      roughness: 0.78,
      metalness: 0.04,
      colorTint: 0xd0cbc2,
    });

    // 3. Ladrillo visto caravista
    this.brickMat = assets.createPBRMaterial({
      colorMapUrl: '/assets/shared/bricks_red/color.jpg',
      normalMapUrl: '/assets/shared/bricks_red/normal.jpg',
      roughnessMapUrl: '/assets/shared/bricks_red/roughness.jpg',
      aoMapUrl: '/assets/shared/bricks_red/ao.jpg',
      repeat: 4,
      roughness: 0.85,
      metalness: 0.02,
      colorTint: 0xba6a50,
    });

    // 4. Revoco / estuco contemporáneo
    this.plasterMat = assets.createPBRMaterial({
      colorMapUrl: '/assets/shared/plaster_modern/color.jpg',
      normalMapUrl: '/assets/shared/plaster_modern/normal.jpg',
      roughnessMapUrl: '/assets/shared/plaster_modern/roughness.jpg',
      repeat: 3,
      roughness: 0.82,
      metalness: 0.02,
      colorTint: 0xe0ddd5,
    });

    // 5. Tejas cerámicas tradicionales
    this.roofTileMat = assets.createPBRMaterial({
      colorMapUrl: '/assets/shared/roof_tiles_clay/color.jpg',
      normalMapUrl: '/assets/shared/roof_tiles_clay/normal.jpg',
      roughnessMapUrl: '/assets/shared/roof_tiles_clay/roughness.jpg',
      repeat: 3,
      roughness: 0.75,
      metalness: 0.02,
      colorTint: 0xa84832,
    });

    // 6. Metal de casetones e instalaciones
    this.metalMat = assets.createPBRMaterial({
      colorMapUrl: '/assets/shared/corrugatedsteel005/color.jpg',
      normalMapUrl: '/assets/shared/corrugatedsteel005/normalgl.jpg',
      roughnessMapUrl: '/assets/shared/corrugatedsteel005/roughness.jpg',
      repeat: 2,
      roughness: 0.45,
      metalness: 0.85,
      colorTint: 0x8a929a,
    });

    this.scene.add(this.group);
  }

  public setNightFactor(nightFactor: number): void {
    this.glassMat.emissiveIntensity = nightFactor * 1.5;
  }

  /**
   * Genera el skyline y manzanas de edificios de la ciudad demostrativa como en hero.jpg.
   */
  public generateDemoCityBuildings(worldCoords: (gx: number, gz: number) => { x: number; y: number; z: number }): void {
    this.clear();

    const buildings: BuildingInstanceData[] = [];

    // --- 1. DOWNTOWN FINANCIAL DISTRICT: Rascacielos y Torres Insignia (fable_cities_hero.jpg) ---
    const downtownTowers = [
      // Manzana Principal (Frente al mar y avenida)
      { x: 62, z: 62, w: 10, d: 10, h: 68, yaw: 0, tint: 0x487295, spire: false },
      { x: 68, z: 62, w: 12, d: 11, h: 86, yaw: 0.04, tint: 0x3d6485, spire: true },
      { x: 74, z: 62, w: 14, d: 13, h: 96, yaw: 0, tint: 0x33536f, spire: true }, // Torre más alta
      { x: 80, z: 62, w: 11, d: 11, h: 76, yaw: -0.05, tint: 0x426888, spire: false },
      { x: 86, z: 62, w: 9,  d: 9,  h: 58, yaw: 0, tint: 0x527c9e, spire: false },

      // Segunda Fila Central
      { x: 62, z: 54, w: 11, d: 10, h: 72, yaw: 0, tint: 0x385d7c, spire: false },
      { x: 68, z: 54, w: 13, d: 12, h: 90, yaw: -0.03, tint: 0x30506c, spire: true },
      { x: 74, z: 54, w: 12, d: 12, h: 82, yaw: 0.05, tint: 0x3c6282, spire: true },
      { x: 80, z: 54, w: 10, d: 10, h: 66, yaw: 0, tint: 0x4a7292, spire: false },
      { x: 86, z: 54, w: 9,  d: 8,  h: 52, yaw: 0.06, tint: 0x5580a2, spire: false },

      // Tercera Fila Norte
      { x: 62, z: 46, w: 9,  d: 9,  h: 54, yaw: 0.08, tint: 0x426888, spire: false },
      { x: 68, z: 46, w: 11, d: 10, h: 65, yaw: -0.04, tint: 0x3a6080, spire: false },
      { x: 74, z: 46, w: 10, d: 10, h: 62, yaw: 0, tint: 0x4c7596, spire: false },
      { x: 80, z: 46, w: 9,  d: 8,  h: 48, yaw: -0.06, tint: 0x5884a6, spire: false },

      // Costado Este
      { x: 92, z: 62, w: 8,  d: 8,  h: 46, yaw: 0, tint: 0x4e789a, spire: false },
      { x: 92, z: 54, w: 8,  d: 9,  h: 44, yaw: 0.1, tint: 0x426888, spire: false },
      { x: 92, z: 46, w: 7.5,d: 7.5,h: 40, yaw: -0.08, tint: 0x507a9c, spire: false },

      // Costado Oeste (Transición a media densidad)
      { x: 56, z: 62, w: 9,  d: 9,  h: 50, yaw: 0.05, tint: 0x466f91, spire: false },
      { x: 56, z: 54, w: 8.5,d: 8.5,h: 48, yaw: 0, tint: 0x406788, spire: false },
      { x: 56, z: 46, w: 8,  d: 8,  h: 42, yaw: -0.05, tint: 0x4d7698, spire: false },
    ];

    for (const tw of downtownTowers) {
      const pos = worldCoords(tw.x, tw.z);
      buildings.push({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        yaw: tw.yaw,
        type: 'skyscraper',
        width: tw.w,
        depth: tw.d,
        height: tw.h,
        colorTint: tw.tint,
        hasSpire: tw.spire,
      });
    }

    // --- 2. MID-RISE RESIDENTIAL & COMMERCIAL DISTRICT (Ladrillo caravista y revoco) ---
    const midrises = [
      // Manzanas oeste (hacia el río y lagunas)
      { x: 48, z: 62, w: 8, d: 7, h: 24, yaw: 0, tint: 0xba6a50 },
      { x: 48, z: 54, w: 8, d: 8, h: 28, yaw: 0, tint: 0xdcd8cf },
      { x: 48, z: 46, w: 7, d: 7, h: 22, yaw: 0.05, tint: 0xba6a50 },
      { x: 48, z: 38, w: 8, d: 7, h: 18, yaw: 0, tint: 0xd8d4cb },

      { x: 40, z: 62, w: 7, d: 7, h: 20, yaw: 0.1, tint: 0xd8d4cb },
      { x: 40, z: 54, w: 8, d: 7, h: 22, yaw: -0.08, tint: 0xba6a50 },
      { x: 40, z: 46, w: 7, d: 6, h: 18, yaw: 0, tint: 0xdcd8cf },

      // Manzanas norte (pie de colinas)
      { x: 56, z: 38, w: 8, d: 8, h: 20, yaw: 0, tint: 0xba6a50 },
      { x: 64, z: 38, w: 9, d: 8, h: 22, yaw: 0.04, tint: 0xdcd8cf },
      { x: 72, z: 38, w: 8, d: 7, h: 24, yaw: 0, tint: 0xba6a50 },
      { x: 80, z: 38, w: 8, d: 8, h: 20, yaw: -0.05, tint: 0xd8d4cb },
      { x: 88, z: 38, w: 7, d: 7, h: 18, yaw: 0, tint: 0xba6a50 },

      // Manzanas este (hacia el acantilado este)
      { x: 98, z: 62, w: 8, d: 7, h: 22, yaw: 0, tint: 0xd8d4cb },
      { x: 98, z: 54, w: 7, d: 7, h: 20, yaw: -0.05, tint: 0xba6a50 },
      { x: 98, z: 46, w: 8, d: 7, h: 18, yaw: 0, tint: 0xdcd8cf },
      { x: 104, z: 58, w: 7, d: 6, h: 16, yaw: 0.1, tint: 0xba6a50 },
    ];

    for (const mr of midrises) {
      const pos = worldCoords(mr.x, mr.z);
      buildings.push({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        yaw: mr.yaw,
        type: 'midrise',
        width: mr.w,
        depth: mr.d,
        height: mr.h,
        colorTint: mr.tint,
      });
    }

    // --- 3. SUBURBAN RESIDENTIAL HOMES & VILLAS (Tejado cerámico inclinado) ---
    const suburbs = [
      // Ribera oeste del río y lagunas
      { x: 26, z: 68, w: 5.5, d: 5, h: 7.5, yaw: 0.2 },
      { x: 26, z: 60, w: 5,   d: 5, h: 7,   yaw: -0.15 },
      { x: 26, z: 52, w: 5.5, d: 4.5, h: 6.5, yaw: 0 },
      { x: 26, z: 44, w: 5,   d: 5, h: 7.5, yaw: 0.1 },

      { x: 32, z: 68, w: 5.5, d: 5, h: 7.5, yaw: -0.1 },
      { x: 32, z: 60, w: 6,   d: 5, h: 8,   yaw: 0.05 },
      { x: 32, z: 44, w: 5,   d: 5, h: 7,   yaw: 0 },

      // Suburbios norte en las colinas
      { x: 42, z: 32, w: 5.5, d: 5, h: 7,   yaw: 0.2 },
      { x: 50, z: 30, w: 5,   d: 5, h: 6.5, yaw: -0.1 },
      { x: 58, z: 28, w: 6,   d: 5, h: 7.5, yaw: 0.08 },
      { x: 68, z: 28, w: 5.5, d: 5, h: 7,   yaw: 0 },
      { x: 78, z: 28, w: 5.5, d: 5, h: 7.5, yaw: -0.15 },
      { x: 88, z: 30, w: 5,   d: 4.5, h: 6.5, yaw: 0.2 },
    ];

    for (const sb of suburbs) {
      const pos = worldCoords(sb.x, sb.z);
      buildings.push({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        yaw: sb.yaw,
        type: 'suburb',
        width: sb.w,
        depth: sb.d,
        height: sb.h,
      });
    }

    // --- 4. WATERFRONT PROMENADE (Pabellones y marinas junto a la playa) ---
    const waterfrontShops = [
      { x: 58, z: 70, w: 7, d: 6, h: 12, yaw: -0.15, tint: 0xe8e4db },
      { x: 66, z: 72, w: 8, d: 6, h: 14, yaw: -0.25, tint: 0x486b88 },
      { x: 76, z: 74, w: 8, d: 6, h: 13, yaw: -0.32, tint: 0xd8d4cb },
      { x: 86, z: 76, w: 7, d: 5.5, h: 11, yaw: -0.40, tint: 0xba6a50 },
      { x: 94, z: 76, w: 8, d: 6, h: 12, yaw: -0.45, tint: 0xdcd8cf },
    ];

    for (const wf of waterfrontShops) {
      const pos = worldCoords(wf.x, wf.z);
      buildings.push({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        yaw: wf.yaw,
        type: 'commercial',
        width: wf.w,
        depth: wf.d,
        height: wf.h,
        colorTint: wf.tint,
      });
    }

    this.buildingRecords = buildings;
    this.buildInstancedMeshes();
  }

  private buildInstancedMeshes(): void {
    const skyscrapers = this.buildingRecords.filter((b) => b.type === 'skyscraper');
    const midrises = this.buildingRecords.filter((b) => b.type === 'midrise');
    const suburbs = this.buildingRecords.filter((b) => b.type === 'suburb');
    const commercials = this.buildingRecords.filter((b) => b.type === 'commercial');

    const dummy = new THREE.Object3D();

    // 1. InstancedMesh para rascacielos Downtown (Cuerpo de vidrio + casetón técnico + antena)
    if (skyscrapers.length > 0) {
      const boxGeo = new THREE.BoxGeometry(1, 1, 1);
      boxGeo.translate(0, 0.5, 0);

      const glassMesh = new THREE.InstancedMesh(boxGeo, this.glassMat, skyscrapers.length);
      glassMesh.castShadow = true;
      glassMesh.receiveShadow = true;

      // Casetones de maquinaria de cubierta de metal
      const roofMesh = new THREE.InstancedMesh(boxGeo, this.metalMat, skyscrapers.length);
      roofMesh.castShadow = true;
      roofMesh.receiveShadow = true;

      // Antenas / mástiles de telecomunicación para torres insignia
      const spires = skyscrapers.filter((b) => b.hasSpire);
      let spireMesh: THREE.InstancedMesh | null = null;
      if (spires.length > 0) {
        const spireGeo = new THREE.CylinderGeometry(0.12, 0.22, 10, 6);
        spireGeo.translate(0, 5, 0);
        spireMesh = new THREE.InstancedMesh(spireGeo, this.metalMat, spires.length);
        spireMesh.castShadow = true;
      }

      let spireIdx = 0;
      for (let i = 0; i < skyscrapers.length; i++) {
        const b = skyscrapers[i]!;
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, b.yaw, 0);
        dummy.scale.set(b.width, b.height, b.depth);
        dummy.updateMatrix();
        glassMesh.setMatrixAt(i, dummy.matrix);

        // Casetón de ático
        dummy.position.set(b.x, b.y + b.height, b.z);
        dummy.scale.set(b.width * 0.45, 3.8, b.depth * 0.45);
        dummy.updateMatrix();
        roofMesh.setMatrixAt(i, dummy.matrix);

        // Aguja / Antena
        if (b.hasSpire && spireMesh) {
          dummy.position.set(b.x, b.y + b.height + 3.8, b.z);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          spireMesh.setMatrixAt(spireIdx++, dummy.matrix);
        }
      }

      glassMesh.instanceMatrix.needsUpdate = true;
      roofMesh.instanceMatrix.needsUpdate = true;
      this.group.add(glassMesh);
      this.group.add(roofMesh);

      if (spireMesh) {
        spireMesh.instanceMatrix.needsUpdate = true;
        this.group.add(spireMesh);
      }
    }

    // 2. InstancedMesh para bloques de media altura (Ladrillo y revoco)
    if (midrises.length > 0) {
      const boxGeo = new THREE.BoxGeometry(1, 1, 1);
      boxGeo.translate(0, 0.5, 0);

      const brickMesh = new THREE.InstancedMesh(boxGeo, this.brickMat, midrises.length);
      brickMesh.castShadow = true;
      brickMesh.receiveShadow = true;

      for (let i = 0; i < midrises.length; i++) {
        const b = midrises[i]!;
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, b.yaw, 0);
        dummy.scale.set(b.width, b.height, b.depth);
        dummy.updateMatrix();
        brickMesh.setMatrixAt(i, dummy.matrix);
      }

      brickMesh.instanceMatrix.needsUpdate = true;
      this.group.add(brickMesh);
    }

    // 3. InstancedMesh para viviendas suburbanas (Muros de revoco + tejados de teja cerámica)
    if (suburbs.length > 0) {
      const wallGeo = new THREE.BoxGeometry(1, 1, 1);
      wallGeo.translate(0, 0.5, 0);

      const roofGeo = new THREE.ConeGeometry(0.72, 1, 4);
      roofGeo.rotateY(Math.PI / 4);
      roofGeo.translate(0, 0.5, 0);

      const wallMesh = new THREE.InstancedMesh(wallGeo, this.plasterMat, suburbs.length);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;

      const roofMesh = new THREE.InstancedMesh(roofGeo, this.roofTileMat, suburbs.length);
      roofMesh.castShadow = true;
      roofMesh.receiveShadow = true;

      for (let i = 0; i < suburbs.length; i++) {
        const b = suburbs[i]!;
        const wallH = b.height * 0.65;
        const roofH = b.height * 0.35;

        // Muros
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, b.yaw, 0);
        dummy.scale.set(b.width, wallH, b.depth);
        dummy.updateMatrix();
        wallMesh.setMatrixAt(i, dummy.matrix);

        // Tejado a 4 aguas
        dummy.position.set(b.x, b.y + wallH, b.z);
        dummy.scale.set(b.width * 1.08, roofH, b.depth * 1.08);
        dummy.updateMatrix();
        roofMesh.setMatrixAt(i, dummy.matrix);
      }

      wallMesh.instanceMatrix.needsUpdate = true;
      roofMesh.instanceMatrix.needsUpdate = true;
      this.group.add(wallMesh);
      this.group.add(roofMesh);
    }

    // 4. InstancedMesh para edificios comerciales costeros
    if (commercials.length > 0) {
      const boxGeo = new THREE.BoxGeometry(1, 1, 1);
      boxGeo.translate(0, 0.5, 0);

      const commMesh = new THREE.InstancedMesh(boxGeo, this.concreteMat, commercials.length);
      commMesh.castShadow = true;
      commMesh.receiveShadow = true;

      for (let i = 0; i < commercials.length; i++) {
        const b = commercials[i]!;
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, b.yaw, 0);
        dummy.scale.set(b.width, b.height, b.depth);
        dummy.updateMatrix();
        commMesh.setMatrixAt(i, dummy.matrix);
      }

      commMesh.instanceMatrix.needsUpdate = true;
      this.group.add(commMesh);
    }

    // 5. InstancedMesh para naves y plantas industriales (Chapa ondulada / hormigón)
    const industrials = this.buildingRecords.filter((b) => b.type === 'industrial');
    if (industrials.length > 0) {
      const boxGeo = new THREE.BoxGeometry(1, 1, 1);
      boxGeo.translate(0, 0.5, 0);

      const indMesh = new THREE.InstancedMesh(boxGeo, this.metalMat, industrials.length);
      indMesh.castShadow = true;
      indMesh.receiveShadow = true;

      for (let i = 0; i < industrials.length; i++) {
        const b = industrials[i]!;
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, b.yaw, 0);
        dummy.scale.set(b.width, b.height, b.depth);
        dummy.updateMatrix();
        indMesh.setMatrixAt(i, dummy.matrix);
      }

      indMesh.instanceMatrix.needsUpdate = true;
      this.group.add(indMesh);
    }
  }

  public addBuilding(b: BuildingInstanceData): void {
    this.buildingRecords.push(b);
    this.rebuildMeshes();
  }

  public setBuildings(buildings: BuildingInstanceData[]): void {
    this.buildingRecords = [...buildings];
    this.rebuildMeshes();
  }

  public rebuildMeshes(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0]!;
      this.group.remove(child);
      if ((child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose();
      }
    }
    this.buildInstancedMeshes();
  }

  public getBuildingCount(): number {
    return this.buildingRecords.length;
  }

  public clear(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0]!;
      this.group.remove(child);
      if ((child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose();
      }
    }
    this.buildingRecords = [];
  }

  public dispose(): void {
    this.clear();
    this.glassMat.dispose();
    this.concreteMat.dispose();
    this.brickMat.dispose();
    this.plasterMat.dispose();
    this.roofTileMat.dispose();
    this.metalMat.dispose();
    this.scene.remove(this.group);
  }
}
