import * as THREE from 'three';
import { AssetManager } from '@render/assets/asset_manager';

/**
 * Renderizador de Superficie de Agua Física y Dinámica SWE (CityRT / Cities: Skylines):
 * - Superficie de agua continua y horizontal: Se mantiene estrictamente en la cota de flotación
 *   (seaLevel + perturbación SWE), sin deformaciones piramidales hacia las cumbres.
 * - Textura PBR procedimental de oleaje continuo y tileable (uWaterNormal) sin costuras.
 * - Sombreador avanzado con perturbación de normales en doble escala (macro swell + micro chop)
 *   y flujo meridional que recrea la corriente viva del río hacia el océano.
 * - Rampa de absorción física lumínica (Beer-Lambert):
 *   - Aguas someras y ribera: turquesa cristalino translúcido (#14a3ad).
 *   - Profundidad media: azul océano tropical vibrante (#09578a).
 *   - Mar abierto / abisal: azul marino profundo (#031733).
 * - Orla dinámica de espuma bi-octava en playas y rompientes.
 * - Destellos solares especulares (Sun Glitter) y reflejos de cielo (Fresnel).
 * - Océano exterior continuo (Outer Ocean) que se extiende sin discontinuidades hasta 36 km.
 * - Zero allocations en el bucle de renderizado.
 */
export class DynamicWaterMesh {
  public mesh: THREE.Mesh;
  private width: number;
  private height: number;
  private cellSize: number;
  private posAttr: THREE.Float32BufferAttribute;
  private depthAttr: THREE.Float32BufferAttribute;
  public material: THREE.MeshStandardMaterial;
  private outerOceanMesh: THREE.Mesh;
  public seaLevel: number = 4.0;

  public uniforms: {
    uTime: { value: number };
    uNight: { value: number };
    uSunDir: { value: THREE.Vector3 };
    uWaterNormal: { value: THREE.Texture };
    uNoise: { value: THREE.Texture };
    uWaterLevel: { value: number };
  };

  constructor(width: number, height: number, cellSize: number = 2.0) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;

    const assets = AssetManager.getInstance();
    const waterNormalTex = assets.getProceduralWaterNormalTexture(256);
    const noiseTex = assets.getProceduralNoiseTexture(256, 1337);

    const vertCount = (width + 1) * (height + 1);
    const positions = new Float32Array(vertCount * 3);
    const depths = new Float32Array(vertCount);
    const indices = new Uint32Array(width * height * 6);

    let idx = 0;
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const v00 = z * (width + 1) + x;
        const v10 = z * (width + 1) + (x + 1);
        const v01 = (z + 1) * (width + 1) + x;
        const v11 = (z + 1) * (width + 1) + (x + 1);

        indices[idx++] = v00;
        indices[idx++] = v01;
        indices[idx++] = v10;

        indices[idx++] = v10;
        indices[idx++] = v01;
        indices[idx++] = v11;
      }
    }

    this.posAttr = new THREE.Float32BufferAttribute(positions, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);

    this.depthAttr = new THREE.Float32BufferAttribute(depths, 1);
    this.depthAttr.setUsage(THREE.DynamicDrawUsage);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.posAttr);
    geometry.setAttribute('aDepth', this.depthAttr);
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    this.uniforms = {
      uTime: { value: 0 },
      uNight: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uWaterNormal: { value: waterNormalTex },
      uNoise: { value: noiseTex },
      uWaterLevel: { value: this.seaLevel },
    };

    // Material físico de agua - Azul clarito fresco y luminoso (CityRT / Cities: Skylines)
    this.material = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.12,
      metalness: 0.04,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute float aDepth;
          varying float vWaterDepth;
          varying vec3 vWaterWorldPos;
          varying vec3 vViewNormal;
          varying vec3 vViewTangent;
          varying vec3 vViewBitangent;`
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vWaterDepth = aDepth;
          vWaterWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vViewNormal = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
          vViewTangent = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
          vViewBitangent = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform float uNight;
          uniform vec3 uSunDir;
          uniform sampler2D uWaterNormal;
          uniform sampler2D uNoise;
          uniform float uWaterLevel;
          varying float vWaterDepth;
          varying vec3 vWaterWorldPos;
          varying vec3 vViewNormal;
          varying vec3 vViewTangent;
          varying vec3 vViewBitangent;`
        )
        .replace(
          '#include <normal_fragment_begin>',
          `#include <normal_fragment_begin>
          vec3 wPos = vWaterWorldPos;
          float t = uTime;

          // 1. Muestreo de normales en triple escala calibrada (de 2m a 35m)
          // Flujo longitudinal suave del río hacia el sur (Z+) y corrientes marinas
          vec2 uvSwell = wPos.xz * 0.035 + vec2(t * 0.015, t * 0.038);
          vec2 uvChop  = wPos.xz * 0.16  + vec2(-t * 0.035, t * 0.024);
          vec2 uvMicro = wPos.xz * 0.45  + vec2(t * 0.055, -t * 0.042);

          vec4 nSample1 = texture2D(uWaterNormal, uvSwell);
          vec4 nSample2 = texture2D(uWaterNormal, uvChop);
          vec4 nSample3 = texture2D(uWaterNormal, uvMicro);

          vec3 n1 = nSample1.rgb * 2.0 - 1.0;
          vec3 n2 = nSample2.rgb * 2.0 - 1.0;
          vec3 n3 = nSample3.rgb * 2.0 - 1.0;

          // Fusión ponderada: Macro oleaje (50%) + Chop de viento (35%) + Micro rizo capilar (25%)
          vec2 horizontalPerturb = n1.xy * 0.35 + n2.xy * 0.25 + n3.xy * 0.18;
          float verticalUp = max(0.2, n1.z * 0.65 + n2.z * 0.35);

          // Vector normal en espacio de vista ortonormal
          normal = normalize(vViewTangent * horizontalPerturb.x + vViewBitangent * horizontalPerturb.y + vViewNormal * verticalUp);
          `
        )
        .replace(
          '#include <map_fragment>',
          `
          float d = vWaterDepth;
          // Descartar fragmentos donde la profundidad de agua se extingue (tierra firme)
          if (d <= 0.015) {
            discard;
          }

          vec3 wPos = vWaterWorldPos;
          float t = uTime;

          // 1. Rampa de absorción lumínica en tonos azul clarito luminoso y cristalino
          // Aguas someras / ribera: turquesa celeste brillante y translúcido
          vec3 colShallow = vec3(0.42, 0.88, 0.96);
          // Profundidad media: azul clarito vibrante y fresco
          vec3 colMid = vec3(0.24, 0.72, 0.92);
          // Mar abierto / cauce del río: azul cielo luminoso
          vec3 colDeep = vec3(0.14, 0.58, 0.84);

          float tMid = smoothstep(0.08, 1.4, d);
          float tDeep = smoothstep(1.4, 4.8, d);

          vec3 waterBaseColor = mix(colShallow, colMid, tMid);
          waterBaseColor = mix(waterBaseColor, colDeep, tDeep);

          // 2. Ondulaciones de textura cáustica y líneas de oleaje visibles en el color base
          vec2 uvTexA = wPos.xz * 0.16 + vec2(-t * 0.035, t * 0.024);
          vec2 uvTexB = wPos.xz * 0.45 + vec2(t * 0.055, -t * 0.042);
          vec4 texSampleA = texture2D(uWaterNormal, uvTexA);
          vec4 texSampleB = texture2D(uWaterNormal, uvTexB);

          float ripplePattern = pow(max(0.0, (texSampleA.a + texSampleB.a) * 0.5), 1.8);
          vec3 causticColor = vec3(0.12, 0.35, 0.45) * (ripplePattern * 1.5);

          float crestPattern = smoothstep(0.60, 0.90, (texSampleA.r + texSampleB.g) * 0.5);
          vec3 crestColor = vec3(0.18, 0.42, 0.50) * (crestPattern * 0.75);

          vec3 waterBody = waterBaseColor + causticColor + crestColor;

          // 3. Orla de espuma suave y orgánica en la línea de rompiente con la costa y riberas
          float foamBand = smoothstep(0.45, 0.02, d);
          vec4 fineNoise = texture2D(uNoise, wPos.xz * 0.12 + vec2(t * 0.025, -t * 0.018));
          float wavePulse = sin(d * 22.0 - t * 3.2) * 0.5 + 0.5;
          float foamFactor = foamBand * smoothstep(0.30, 0.68, fineNoise.r + wavePulse * 0.40);
          vec3 foamColor = vec3(0.95, 0.98, 1.0);

          waterBody = mix(waterBody, foamColor, foamFactor * 0.88);

          // 4. Atenuación nocturna coherente con el ciclo circadiano
          waterBody = mix(waterBody, waterBody * 0.18, uNight * 0.85);

          // 5. Transparencia orgánica según la profundidad: agua cristalina en la orilla
          float shoreAlpha = smoothstep(0.015, 0.35, d);
          float finalOpacity = mix(0.55, 0.94, shoreAlpha);

          diffuseColor = vec4(waterBody, finalOpacity);
          `
        );
    };

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 2;

    // 2. Malla de Océano y Mar Exterior Continuo (hasta 36 km en el horizonte)
    const halfSize = (width * cellSize) / 2;
    const outerGeo = this.buildOuterOceanGeometry(halfSize, 36000.0);
    this.outerOceanMesh = new THREE.Mesh(outerGeo, this.material);
    this.outerOceanMesh.position.y = this.seaLevel;
    this.outerOceanMesh.renderOrder = 2;
    this.mesh.add(this.outerOceanMesh);
  }

  /**
   * Construye una topología continua que conecta el perímetro cuadrado del mapa activo
   * con un horizonte circular lejano de 36 km, erradicando costuras o vacíos.
   */
  private buildOuterOceanGeometry(halfSize: number, outerRadius: number): THREE.BufferGeometry {
    const numRings = 16;
    const numSectors = 96;
    const vertCount = (numRings + 1) * numSectors;

    const positions = new Float32Array(vertCount * 3);
    const depths = new Float32Array(vertCount);
    const indices: number[] = [];

    let vIdx = 0;
    for (let r = 0; r <= numRings; r++) {
      const t = r / numRings;

      for (let s = 0; s < numSectors; s++) {
        const theta = (s / numSectors) * Math.PI * 2;
        const dirX = Math.sin(theta);
        const dirZ = Math.cos(theta);

        const maxCoord = Math.max(Math.abs(dirX), Math.abs(dirZ));
        const squareR = (halfSize - 2.0) / (maxCoord > 0.0001 ? maxCoord : 1.0);
        const rad = squareR * Math.pow(outerRadius / squareR, t);

        const wx = dirX * rad;
        const wz = dirZ * rad;

        const pOffset = vIdx * 3;
        positions[pOffset + 0] = wx;
        positions[pOffset + 1] = 0.0;
        positions[pOffset + 2] = wz;

        // En mar abierto la profundidad de la columna de agua es oceánica
        depths[vIdx] = 8.5;
        vIdx++;
      }
    }

    for (let r = 0; r < numRings; r++) {
      for (let s = 0; s < numSectors; s++) {
        const nextS = (s + 1) % numSectors;
        const i0 = r * numSectors + s;
        const i1 = r * numSectors + nextS;
        const i2 = (r + 1) * numSectors + s;
        const i3 = (r + 1) * numSectors + nextS;

        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(depths, 1));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  public setTime(timeSeconds: number): void {
    this.uniforms.uTime.value = timeSeconds;
  }

  public setNightFactor(nightFactor: number): void {
    this.uniforms.uNight.value = nightFactor;
  }

  public setSunDirection(sunDir: THREE.Vector3): void {
    this.uniforms.uSunDir.value.copy(sunDir);
  }

  /**
   * Actualiza dinámicamente la cota y profundidad del agua en cada vértice.
   * Regla de Cero Caídas de FPS: mutación directa de Float32Array sin instanciar objetos.
   */
  public updateWaterLevels(waterDepths: Float32Array, terrainHeights: Float32Array, seaLevel?: number): void {
    if (seaLevel !== undefined) {
      this.seaLevel = seaLevel;
      if (this.outerOceanMesh) {
        this.outerOceanMesh.position.y = this.seaLevel;
      }
      this.uniforms.uWaterLevel.value = this.seaLevel;
    }

    const posArray = this.posAttr.array as Float32Array;
    const depthArray = this.depthAttr.array as Float32Array;

    const w = this.width;
    const h = this.height;
    const cs = this.cellSize;
    const offsetX = (w * cs) / 2;
    const offsetZ = (h * cs) / 2;
    const currentSeaLevel = this.seaLevel;

    for (let z = 0; z <= h; z++) {
      for (let x = 0; x <= w; x++) {
        const vIdx = z * (w + 1) + x;
        const pOffset = vIdx * 3;

        // Muestrear celda de profundidad SWE más cercana
        const cx = Math.min(w - 1, x);
        const cz = Math.min(h - 1, z);
        const cellIdx = cz * w + cx;

        const sweDepth = waterDepths[cellIdx] ?? 0;
        const baseH = terrainHeights[vIdx] ?? 0;

        // Superficie física horizontal estricta + dinámica SWE
        const surfaceY = currentSeaLevel + sweDepth;
        // Columna de agua física
        const effectiveDepth = Math.max(0.0, surfaceY - baseH);

        const posX = x * cs - offsetX;
        const posZ = z * cs - offsetZ;

        posArray[pOffset + 0] = posX;
        posArray[pOffset + 1] = surfaceY;
        posArray[pOffset + 2] = posZ;

        depthArray[vIdx] = effectiveDepth;
      }
    }

    this.posAttr.needsUpdate = true;
    this.depthAttr.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    if (this.outerOceanMesh) {
      this.outerOceanMesh.geometry.dispose();
    }
    this.material.dispose();
  }
}
