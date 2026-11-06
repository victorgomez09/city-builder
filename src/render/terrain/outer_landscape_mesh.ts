import * as THREE from 'three';
import { NaturalLandscapeGenerator } from '@core/terrain/natural_landscape_generator';
import { AssetManager } from '@render/assets/asset_manager';

export interface OuterLandscapeOptions {
  generator: NaturalLandscapeGenerator;
  halfSize?: number;      // Mitad del ancho del terreno interior activo (ej. 128m)
  outerRadius?: number;   // Radio exterior del horizonte (ej. 14.000m = 14km)
  radialRings?: number;   // Cantidad de anillos concéntricos
  angularSectors?: number;// Cantidad de sectores angulares
}

/**
 * Malla de Paisaje Continuo Extendido (Outer Landscape Mesh):
 * - Erradica por completo la sensación de "caja de parcela" o "isla flotante".
 * - El paisaje se extiende de forma continua e ininterrumpida hasta 14 km en todas direcciones.
 * - Utiliza exactamente la misma función matemática de orografía H(x, z) que la cuadrícula activa,
 *   garantizando una transición 100% matemática, sin grietas, costuras ni desfases de altura.
 * - Comparte el mismo sombreador PBR con splatting multiescala que DynamicTerrainMesh:
 *   roca triplanar en acantilados verticales, arena dorada en playas suaves, franja húmeda y nieve alpina.
 */
export class OuterLandscapeMesh {
  public group: THREE.Group = new THREE.Group();
  public mesh: THREE.Mesh;

  private geometry: THREE.BufferGeometry;
  public material: THREE.MeshStandardMaterial;

  private generator: NaturalLandscapeGenerator;
  private halfSize: number;
  private outerRadius: number;
  private numRings: number;
  private numSectors: number;

  public uniforms: {
    uNoise: { value: THREE.Texture };
    uGrassCol: { value: THREE.Texture };
    uDirtCol: { value: THREE.Texture };
    uSandCol: { value: THREE.Texture };
    uRockCol: { value: THREE.Texture };
    uWaterLevel: { value: number };
    uNight: { value: number };
  };

  constructor(options: OuterLandscapeOptions) {
    this.generator = options.generator;
    this.halfSize = options.halfSize ?? 128.0;
    this.outerRadius = options.outerRadius ?? 14000.0;
    this.numRings = options.radialRings ?? 24;
    this.numSectors = options.angularSectors ?? 128;

    const assets = AssetManager.getInstance();

    // 1. Texturas PBR idénticas a las del terreno activo
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
      uWaterLevel: { value: this.generator.getConfig().waterLevel },
      uNight: { value: 0.0 },
    };

    // 2. Material PBR idéntico con sombreador de acantilados, playas y cumbres
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

          vec4 noise = texture2D(uNoise, wPos.xz * 0.012);
          vec4 fineNoise = texture2D(uNoise, wPos.xz * 0.065);

          // 1. Muestreo de textura en doble escala
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

          // Proyección triplanar para rocas en acantilados
          vec2 uvRockH = wPos.xz * 0.065;
          vec2 uvRockV = vec2(wPos.x + wPos.z, wPos.y) * 0.065;
          vec3 colRock = mix(
            texture2D(uRockCol, uvRockH).rgb,
            texture2D(uRockCol, uvRockV).rgb,
            smoothstep(0.26, 0.68, slope)
          );

          // 2. Splatting morfológico (Acantilados vs Playas de arena)
          float cliffFactor = smoothstep(0.24, 0.50, slope + (fineNoise.b - 0.5) * 0.18);
          float slopeRock = smoothstep(0.26, 0.52, slope + (fineNoise.b - 0.5) * 0.20);
          float mountRock = smoothstep(110.0, 220.0, h + (noise.r - 0.5) * 12.0);
          float coastalCliffRock = cliffFactor * smoothstep(uWaterLevel - 1.2, uWaterLevel + 14.0, h);
          float rockWeight = clamp(max(slopeRock, max(mountRock, coastalCliffRock * 1.35)), 0.0, 1.0);

          float sandDist = (h - uWaterLevel) + (noise.g - 0.5) * 0.85;
          float nearWater = 1.0 - smoothstep(0.02, 3.2, sandDist);
          float gentleShore = 1.0 - smoothstep(0.18, 0.35, slope);
          float sandWeight = clamp(nearWater * gentleShore * (1.0 - rockWeight * 0.92), 0.0, 1.0);

          float dirtWeight = smoothstep(0.14, 0.34, slope) * (1.0 - sandWeight) * (1.0 - rockWeight * 0.7);
          float snowWeight = smoothstep(220.0, 340.0, h + (noise.g - 0.5) * 14.0) * (1.0 - smoothstep(0.55, 0.90, slope));
          float grassWeight = clamp(1.0 - sandWeight - rockWeight - dirtWeight * 0.55 - snowWeight, 0.0, 1.0);

          vec3 albedo = colGrass * grassWeight +
                        colDirt * (dirtWeight * 0.55) +
                        colSand * sandWeight +
                        colRock * rockWeight;

          // Franja húmeda
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

    // 3. Construir topología radial concéntrica logarítmica
    this.geometry = this.buildGeometry();
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.group.add(this.mesh);
  }

  private buildGeometry(): THREE.BufferGeometry {
    const vertCount = (this.numRings + 1) * this.numSectors;
    const positions = new Float32Array(vertCount * 3);
    const normals = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices: number[] = [];

    const delta = 1.5;

    let vIdx = 0;
    for (let r = 0; r <= this.numRings; r++) {
      const t = r / this.numRings; // 0 = borde de la ciudad activa, 1 = horizonte lejano (14 km)

      for (let s = 0; s < this.numSectors; s++) {
        const theta = (s / this.numSectors) * Math.PI * 2;
        const dirX = Math.sin(theta);
        const dirZ = Math.cos(theta);

        // Distancia exacta al borde cuadrado del terreno activo (con 0.4m de solape para eliminar rendijas)
        const maxCoord = Math.max(Math.abs(dirX), Math.abs(dirZ));
        const squareR = (this.halfSize - 0.4) / (maxCoord > 0.0001 ? maxCoord : 1.0);

        // Expansión radial logarítmica: de cuadrado en t=0 a círculo perfecto en t=1
        const rad = squareR * Math.pow(this.outerRadius / squareR, t);
        const wx = dirX * rad;
        const wz = dirZ * rad;

        // Muestrear altitud matemática exacta del paisaje
        const hCenter = this.generator.getHeight(wx, wz);

        // Calcular normal analítica por diferencias centrales
        const hL = this.generator.getHeight(wx - delta, wz);
        const hR = this.generator.getHeight(wx + delta, wz);
        const hD = this.generator.getHeight(wx, wz - delta);
        const hU = this.generator.getHeight(wx, wz + delta);

        const nx = -(hR - hL) / (2 * delta);
        const nz = -(hU - hD) / (2 * delta);
        const len = Math.hypot(nx, 1.0, nz);

        const pOffset = vIdx * 3;
        positions[pOffset + 0] = wx;
        positions[pOffset + 1] = hCenter;
        positions[pOffset + 2] = wz;

        normals[pOffset + 0] = nx / len;
        normals[pOffset + 1] = 1.0 / len;
        normals[pOffset + 2] = nz / len;

        uvs[vIdx * 2 + 0] = wx * 0.05;
        uvs[vIdx * 2 + 1] = wz * 0.05;

        vIdx++;
      }
    }

    for (let r = 0; r < this.numRings; r++) {
      for (let s = 0; s < this.numSectors; s++) {
        const nextS = (s + 1) % this.numSectors;

        const i0 = r * this.numSectors + s;
        const i1 = r * this.numSectors + nextS;
        const i2 = (r + 1) * this.numSectors + s;
        const i3 = (r + 1) * this.numSectors + nextS;

        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }

  /**
   * Regenera la geometría de todo el paisaje cuando cambian los parámetros geomorfológicos.
   */
  public rebuild(generator: NaturalLandscapeGenerator): void {
    this.generator = generator;
    this.uniforms.uWaterLevel.value = generator.getConfig().waterLevel;

    this.geometry.dispose();
    this.geometry = this.buildGeometry();
    this.mesh.geometry = this.geometry;
  }

  public setNightFactor(nightFactor: number): void {
    this.uniforms.uNight.value = nightFactor;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.group.clear();
  }
}
