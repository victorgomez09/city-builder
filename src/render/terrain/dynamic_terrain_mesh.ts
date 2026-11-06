import * as THREE from 'three';
import { TerrainGridData } from '@core/terrain_data';
import { AssetManager } from '@render/assets/asset_manager';

/**
 * Renderizador de Terreno PBR Continuo y Suave (Fable Cities / Cities: Skylines II):
 * - Geometría INDEXADA con vértices compartidos: Elimina cualquier faceta triangular o aspecto low-poly.
 * - Normales calculadas continuamente mediante diferencias centrales sobre el campo de alturas:
 *   n_x = -(h(x+1,z) - h(x-1,z)) / (2*dx), n_z = -(h(x,z+1) - h(x,z-1)) / (2*dz).
 * - Splatting multi-escala PBR (macro + micro) con modulación por textura de ruido continuo (fBm):
 *   - Hierba viva (/assets/shared/Grass004/color.jpg).
 *   - Suelo fértil / tierra (/assets/shared/Ground048/color.jpg).
 *   - Arena de playa / ribera (/assets/shared/Ground033/color.jpg).
 *   - Risco rocoso y acantilados con proyección triplanar (/assets/shared/Rock030/color.jpg).
 *   - Manto de nieve alpina en cumbres.
 * - Franja húmeda oscurecida en la costa (shoreline wet band) que se funde con el agua.
 * - Actualización reactiva de sub-regiones en GPU durante terraformación en tiempo real.
 */
export class DynamicTerrainMesh {
  public group: THREE.Group = new THREE.Group();
  public mesh: THREE.Mesh;
  public gridData: TerrainGridData;
  public material: THREE.MeshStandardMaterial;

  private posAttr: THREE.Float32BufferAttribute;
  private normAttr: THREE.Float32BufferAttribute;
  private uvAttr: THREE.Float32BufferAttribute;
  private indexAttr: THREE.BufferAttribute;

  public uniforms: {
    uNoise: { value: THREE.Texture };
    uGrassCol: { value: THREE.Texture };
    uDirtCol: { value: THREE.Texture };
    uSandCol: { value: THREE.Texture };
    uRockCol: { value: THREE.Texture };
    uWaterLevel: { value: number };
    uNight: { value: number };
  };

  constructor(gridData: TerrainGridData) {
    this.gridData = gridData;
    const assets = AssetManager.getInstance();

    const { width, height } = gridData;
    const vertCount = (width + 1) * (height + 1);

    const positions = new Float32Array(vertCount * 3);
    const normals = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = new Uint32Array(width * height * 6);

    // 1. Construir topología indexada con vértices compartidos
    let idx = 0;
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const v00 = z * (width + 1) + x;
        const v10 = z * (width + 1) + (x + 1);
        const v01 = (z + 1) * (width + 1) + x;
        const v11 = (z + 1) * (width + 1) + (x + 1);

        // Triángulo 1
        indices[idx++] = v00;
        indices[idx++] = v01;
        indices[idx++] = v10;

        // Triángulo 2
        indices[idx++] = v10;
        indices[idx++] = v01;
        indices[idx++] = v11;
      }
    }

    this.posAttr = new THREE.Float32BufferAttribute(positions, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);

    this.normAttr = new THREE.Float32BufferAttribute(normals, 3);
    this.normAttr.setUsage(THREE.DynamicDrawUsage);

    this.uvAttr = new THREE.Float32BufferAttribute(uvs, 2);
    this.indexAttr = new THREE.BufferAttribute(indices, 1);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.posAttr);
    geometry.setAttribute('normal', this.normAttr);
    geometry.setAttribute('uv', this.uvAttr);
    geometry.setIndex(this.indexAttr);

    // Cargar texturas PBR y mapa de ruido procedimental continuo
    const noiseTex = assets.getProceduralNoiseTexture(256, 1337);
    const grassTex = assets.loadTexture('/assets/shared/Grass004/color.jpg', 1, 1, true);
    const dirtTex = assets.loadTexture('/assets/shared/Ground048/color.jpg', 1, 1, true);
    const sandTex = assets.loadTexture('/assets/shared/Ground033/color.jpg', 1, 1, true);
    const rockTex = assets.loadTexture('/assets/shared/Rock030/color.jpg', 1, 1, true);

    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping;
    sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
    rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping;

    this.uniforms = {
      uNoise: { value: noiseTex },
      uGrassCol: { value: grassTex },
      uDirtCol: { value: dirtTex },
      uSandCol: { value: sandTex },
      uRockCol: { value: rockTex },
      uWaterLevel: { value: 4.0 },
      uNight: { value: 0.0 },
    };

    // Material estándar con shader PBR continuo
    this.material = new THREE.MeshStandardMaterial({
      roughness: 0.82,
      metalness: 0.02,
      flatShading: false,
    });

    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vTerrainWorldPos;
          varying vec3 vTerrainWorldNormal;`
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vTerrainWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D uNoise;
          uniform sampler2D uGrassCol;
          uniform sampler2D uDirtCol;
          uniform sampler2D uSandCol;
          uniform sampler2D uRockCol;
          uniform float uWaterLevel;
          uniform float uNight;
          varying vec3 vTerrainWorldPos;
          varying vec3 vTerrainWorldNormal;`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.94, uNight * 0.7);`
        )
        .replace(
          '#include <map_fragment>',
          `
          vec3 wPos = vTerrainWorldPos;
          vec3 wNorm = normalize(vTerrainWorldNormal);
          float h = wPos.y;
          float slope = clamp(1.0 - wNorm.y, 0.0, 1.0);

          // Ruido procedimental multi-octava continuo (cero costuras)
          vec4 noise = texture2D(uNoise, wPos.xz * 0.012);
          vec4 fineNoise = texture2D(uNoise, wPos.xz * 0.065);

          // 1. Muestreo de textura en doble escala (macro + micro)
          vec2 uvGrass1 = wPos.xz * 0.10;
          vec2 uvGrass2 = wPos.xz * 0.038 + vec2(0.42, 0.58);
          vec3 colGrass = mix(
            texture2D(uGrassCol, uvGrass1).rgb,
            texture2D(uGrassCol, uvGrass2).rgb,
            noise.r
          );

          vec2 uvDirt = wPos.xz * 0.085;
          vec3 colDirt = texture2D(uDirtCol, uvDirt).rgb;

          vec2 uvSand = wPos.xz * 0.12;
          vec3 colSand = texture2D(uSandCol, uvSand).rgb;

          // Proyección triplanar para rocas en acantilados verticales
          vec2 uvRockH = wPos.xz * 0.065;
          vec2 uvRockV = vec2(wPos.x + wPos.z, wPos.y) * 0.065;
          vec3 colRock = mix(
            texture2D(uRockCol, uvRockH).rgb,
            texture2D(uRockCol, uvRockV).rgb,
            smoothstep(0.26, 0.68, slope)
          );

          // 2. Determinación de pesos de cobertura orgánica (Splatting)
          // Acantilados rocosos: Pendientes escarpadas (slope > 0.26) donde la roca domina
          float cliffFactor = smoothstep(0.24, 0.50, slope + (fineNoise.b - 0.5) * 0.18);
          float slopeRock = smoothstep(0.26, 0.52, slope + (fineNoise.b - 0.5) * 0.20);
          float mountRock = smoothstep(110.0, 220.0, h + (noise.r - 0.5) * 12.0);
          float coastalCliffRock = cliffFactor * smoothstep(uWaterLevel - 1.2, uWaterLevel + 14.0, h);
          float rockWeight = clamp(max(slopeRock, max(mountRock, coastalCliffRock * 1.35)), 0.0, 1.0);

          // Playas de arena dorada: Solo donde el terreno se une al agua en pendiente suave
          float sandDist = (h - uWaterLevel) + (noise.g - 0.5) * 0.85;
          float nearWater = 1.0 - smoothstep(0.02, 3.2, sandDist);
          float gentleShore = 1.0 - smoothstep(0.18, 0.35, slope);
          float sandWeight = clamp(nearWater * gentleShore * (1.0 - rockWeight * 0.92), 0.0, 1.0);

          float dirtWeight = smoothstep(0.14, 0.34, slope) * (1.0 - sandWeight) * (1.0 - rockWeight * 0.7);
          float snowWeight = smoothstep(220.0, 340.0, h + (noise.g - 0.5) * 14.0) * (1.0 - smoothstep(0.55, 0.90, slope));

          float grassWeight = clamp(1.0 - sandWeight - rockWeight - dirtWeight * 0.55 - snowWeight, 0.0, 1.0);

          // 3. Mezcla ponderada de albedos PBR
          vec3 albedo = colGrass * grassWeight +
                        colDirt * (dirtWeight * 0.55) +
                        colSand * sandWeight +
                        colRock * rockWeight;

          // Franja húmeda en la línea de costa (oscurece arena mojada o roca batida por olas)
          float wetShore = smoothstep(uWaterLevel - 0.25, uWaterLevel + 0.35, h) *
                           (1.0 - smoothstep(uWaterLevel + 0.35, uWaterLevel + 0.85, h));
          albedo *= mix(1.0, 0.58, wetShore);

          if (snowWeight > 0.0) {
            vec3 snowCol = vec3(0.95, 0.97, 1.0);
            albedo = mix(albedo, snowCol, snowWeight * 0.95);
          }

          diffuseColor.rgb = albedo;
          `
        );
    };

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.group.add(this.mesh);

    this.rebuildAllVertices();
  }

  /**
   * Actualiza alturas y recalcula normales suaves continuas mediante diferencias centrales.
   */
  public updateRegion(minVX: number, maxVX: number, minVZ: number, maxVZ: number): void {
    const { width, height, cellSize, heights } = this.gridData;
    const offsetX = (width * cellSize) / 2;
    const offsetZ = (height * cellSize) / 2;

    const posArray = this.posAttr.array as Float32Array;
    const normArray = this.normAttr.array as Float32Array;
    const uvArray = this.uvAttr.array as Float32Array;

    const minZ = Math.max(0, minVZ - 1);
    const maxZ = Math.min(height, maxVZ + 1);
    const minX = Math.max(0, minVX - 1);
    const maxX = Math.min(width, maxVX + 1);

    const getH = (ix: number, iz: number): number => {
      const cx = Math.max(0, Math.min(width, ix));
      const cz = Math.max(0, Math.min(height, iz));
      return heights[cz * (width + 1) + cx] ?? 0;
    };

    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const vIdx = z * (width + 1) + x;
        const pOffset = vIdx * 3;
        const uvOffset = vIdx * 2;

        const posX = x * cellSize - offsetX;
        const posZ = z * cellSize - offsetZ;
        const posY = heights[vIdx] ?? 0;

        posArray[pOffset + 0] = posX;
        posArray[pOffset + 1] = posY;
        posArray[pOffset + 2] = posZ;

        uvArray[uvOffset + 0] = x / width;
        uvArray[uvOffset + 1] = z / height;

        // Normal continua y suave por diferencias centrales
        const hL = getH(x - 1, z);
        const hR = getH(x + 1, z);
        const hD = getH(x, z - 1);
        const hU = getH(x, z + 1);

        const dx = (hR - hL) / (2 * cellSize);
        const dz = (hU - hD) / (2 * cellSize);
        const nx = -dx;
        const ny = 1.0;
        const nz = -dz;
        const len = Math.hypot(nx, ny, nz) || 1.0;

        normArray[pOffset + 0] = nx / len;
        normArray[pOffset + 1] = ny / len;
        normArray[pOffset + 2] = nz / len;
      }
    }

    this.posAttr.needsUpdate = true;
    this.normAttr.needsUpdate = true;
    this.uvAttr.needsUpdate = true;
  }

  public rebuildAllVertices(): void {
    this.updateRegion(0, this.gridData.width, 0, this.gridData.height);
  }

  public setGridData(data: TerrainGridData, waterLevel?: number): void {
    this.gridData = data;
    if (waterLevel !== undefined) {
      this.uniforms.uWaterLevel.value = waterLevel;
    }
    this.rebuildAllVertices();
  }

  public setNightFactor(nightFactor: number): void {
    this.uniforms.uNight.value = nightFactor;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
