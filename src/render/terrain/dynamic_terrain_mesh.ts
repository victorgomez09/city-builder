import * as THREE from 'three';
import { TerrainGridData } from '@core/terrain_data';
import { AssetManager } from '@render/assets/asset_manager';

/**
 * Renderizador de Terreno Multi-Textura PBR Continuo (estilo Fable Cities / Cities: Skylines II):
 * - Splatting multi-textura PBR continuo sin costuras poligonales:
 *   - Arena dorada en playas y orillas de río (/assets/shared/sand/color.jpg).
 *   - Hierba aérea natural en valles y llanuras (/assets/shared/aerial_grass_rock/Diffuse.jpg).
 *   - Risco rocoso gris en acantilados y pendientes pronunciadas (/assets/shared/Rock030/color.jpg).
 *   - Nieve en cumbres elevadas de la cordillera montañosa.
 * - Interpolación suave de normales y soporte de terraformación dinámica en tiempo real.
 */
export class DynamicTerrainMesh {
  public group: THREE.Group = new THREE.Group();
  public mesh: THREE.Mesh;
  public gridData: TerrainGridData;

  private posAttr: THREE.Float32BufferAttribute;
  private uvAttr: THREE.Float32BufferAttribute;

  constructor(gridData: TerrainGridData) {
    this.gridData = gridData;
    const assets = AssetManager.getInstance();

    const { width, height } = gridData;
    const vertexCount = width * height * 6;
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);

    this.posAttr = new THREE.Float32BufferAttribute(positions, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);

    this.uvAttr = new THREE.Float32BufferAttribute(uvs, 2);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.posAttr);
    geometry.setAttribute('uv', this.uvAttr);

    // Cargar texturas de la librería compartida
    const grassTex = assets.loadTexture('/assets/shared/aerial_grass_rock/Diffuse.jpg', 1, 1, true);
    const sandTex = assets.loadTexture('/assets/shared/sand/color.jpg', 1, 1, true);
    const rockTex = assets.loadTexture('/assets/shared/Rock030/color.jpg', 1, 1, true);

    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
    rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping;

    // Material PBR estándar con hook de splatting mediante onBeforeCompile
    const terrainMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.04,
      flatShading: false,
    });

    terrainMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTexGrass = { value: grassTex };
      shader.uniforms.uTexSand = { value: sandTex };
      shader.uniforms.uTexRock = { value: rockTex };
      shader.uniforms.uWaterLevel = { value: 1.5 };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vTerrainWorldPos;
          varying vec3 vTerrainNormal;`
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vTerrainNormal = normalize(mat3(modelMatrix) * objectNormal);`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D uTexGrass;
          uniform sampler2D uTexSand;
          uniform sampler2D uTexRock;
          uniform float uWaterLevel;
          varying vec3 vTerrainWorldPos;
          varying vec3 vTerrainNormal;`
        )
        .replace(
          '#include <map_fragment>',
          `
          float h = vTerrainWorldPos.y;
          // Pendiente: 0 = plano horizontal, 1 = acantilado vertical
          float slope = clamp(1.0 - vTerrainNormal.y, 0.0, 1.0);

          // Pesos de splatting
          // 1. Arena en cotas próximas al agua
          float sandWeight = 1.0 - smoothstep(uWaterLevel - 0.2, uWaterLevel + 1.3, h);

          // 2. Roca en pendientes pronunciadas (> 32°) o cotas de montaña
          float slopeRock = smoothstep(0.34, 0.62, slope);
          float heightRock = smoothstep(9.5, 16.0, h);
          float rockWeight = clamp(max(slopeRock, heightRock) * (1.0 - sandWeight * 0.85), 0.0, 1.0);

          // 3. Nieve en cimas de montañas altas
          float snowWeight = smoothstep(17.0, 24.0, h) * (1.0 - smoothstep(0.65, 0.95, slope));

          // 4. Hierba como cubierta vegetal de base
          float grassWeight = clamp(1.0 - sandWeight - rockWeight, 0.0, 1.0);

          // Muestreo con escalas métricas adaptadas para evitar tiling evidente
          vec2 uvGrass = vTerrainWorldPos.xz * 0.09;
          vec2 uvSand = vTerrainWorldPos.xz * 0.16;
          vec2 uvRock = vTerrainWorldPos.xz * 0.08;

          vec4 colGrass = texture2D(uTexGrass, uvGrass);
          vec4 colSand = texture2D(uTexSand, uvSand);
          vec4 colRock = texture2D(uTexRock, uvRock);

          vec3 blended = colGrass.rgb * grassWeight + colSand.rgb * sandWeight + colRock.rgb * rockWeight;

          if (snowWeight > 0.0) {
            blended = mix(blended, vec3(0.93, 0.95, 0.98), snowWeight * 0.95);
          }

          diffuseColor.rgb = blended;
          `
        );
    };

    this.mesh = new THREE.Mesh(geometry, terrainMaterial);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false; // El terreno es el receptor base; evita shadow acne
    this.group.add(this.mesh);

    this.rebuildAllVertices();
  }

  public updateRegion(minVX: number, maxVX: number, minVZ: number, maxVZ: number): void {
    const { width, height, cellSize, heights } = this.gridData;
    const offsetX = (width * cellSize) / 2;
    const offsetZ = (height * cellSize) / 2;

    const posArray = this.posAttr.array as Float32Array;
    const uvArray = this.uvAttr.array as Float32Array;

    const minZ = Math.max(0, minVZ - 1);
    const maxZ = Math.min(height - 1, maxVZ);
    const minX = Math.max(0, minVX - 1);
    const maxX = Math.min(width - 1, maxVX);

    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const cellIndex = z * width + x;
        const vOffset = cellIndex * 18;
        const uvOffset = cellIndex * 12;

        const x0 = x * cellSize - offsetX;
        const x1 = (x + 1) * cellSize - offsetX;
        const z0 = z * cellSize - offsetZ;
        const z1 = (z + 1) * cellSize - offsetZ;

        const h00 = heights[z * (width + 1) + x] ?? 0;
        const h10 = heights[z * (width + 1) + (x + 1)] ?? 0;
        const h01 = heights[(z + 1) * (width + 1) + x] ?? 0;
        const h11 = heights[(z + 1) * (width + 1) + (x + 1)] ?? 0;

        // Triángulo 1
        posArray[vOffset + 0] = x0;  posArray[vOffset + 1] = h00; posArray[vOffset + 2] = z0;
        posArray[vOffset + 3] = x0;  posArray[vOffset + 4] = h01; posArray[vOffset + 5] = z1;
        posArray[vOffset + 6] = x1;  posArray[vOffset + 7] = h10; posArray[vOffset + 8] = z0;

        // Triángulo 2
        posArray[vOffset + 9] = x1;  posArray[vOffset + 10] = h10; posArray[vOffset + 11] = z0;
        posArray[vOffset + 12] = x0; posArray[vOffset + 13] = h01; posArray[vOffset + 14] = z1;
        posArray[vOffset + 15] = x1; posArray[vOffset + 16] = h11; posArray[vOffset + 17] = z1;

        // UVs
        const u0 = x / width;
        const u1 = (x + 1) / width;
        const v0 = z / height;
        const v1 = (z + 1) / height;

        uvArray[uvOffset + 0] = u0; uvArray[uvOffset + 1] = v0;
        uvArray[uvOffset + 2] = u0; uvArray[uvOffset + 3] = v1;
        uvArray[uvOffset + 4] = u1; uvArray[uvOffset + 5] = v0;

        uvArray[uvOffset + 6] = u1; uvArray[uvOffset + 7] = v0;
        uvArray[uvOffset + 8] = u0; uvArray[uvOffset + 9] = v1;
        uvArray[uvOffset + 10] = u1; uvArray[uvOffset + 11] = v1;
      }
    }

    this.posAttr.needsUpdate = true;
    this.uvAttr.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  public rebuildAllVertices(): void {
    this.updateRegion(0, this.gridData.width, 0, this.gridData.height);
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
