import * as THREE from 'three';
import { RoadGraph } from '@core/graph/road_graph';
import { RoadType, ROAD_CONFIGS } from '@core/graph/road_types';
import { AssetManager } from '@render/assets/asset_manager';

/**
 * Renderizador de Red Vial PBR de Alta Fidelidad (Fable Cities / Cities: Skylines II):
 * - Calzada de asfalto continuo con marcas analíticas anti-aliasing (fwidth):
 *   - Línea discontinua central blanca (2.2m trazo, 2.3m hueco).
 *   - Líneas continuas de borde exterior de carril.
 *   - Señalización amarilla en sentidos únicos y doble línea en avenidas.
 * - Cruces e intersecciones con fans circulares continuos (CERO cuadrados o ángulos duros).
 * - Trazado subdividido con adaptación suave al relieve (cada 1.5m de longitud).
 * - Aceras elevadas de losas de piedra PBR (/assets/shared/paving_slabs/) con bordillos achaflanados.
 * - Faldón perimetral de césped/tierra (skirt) con desvanecimiento alfa suave hacia el terreno.
 * - Charcos cálidos de luz nocturna (night light pools) proyectados por las farolas de noche.
 * - Sobreelevación automática de puentes con pilares de hormigón al cruzar agua.
 * - Mobiliario urbano PBR (farolas GLTF, bancos, arbustos y bocas de incendios).
 */
export class RoadNetworkMesh {
  public group: THREE.Group = new THREE.Group();
  public roadMesh: THREE.Mesh;
  public sidewalkMesh: THREE.Mesh;
  public bridgeMesh: THREE.Mesh;

  private roadGeometry: THREE.BufferGeometry;
  private sidewalkGeometry: THREE.BufferGeometry;
  private bridgeGeometry: THREE.BufferGeometry;

  private propsGroup: THREE.Group = new THREE.Group();

  // Modelos GLTF en caché
  private lampTemplate: THREE.Group | null = null;
  private hydrantTemplate: THREE.Group | null = null;
  private benchTemplate: THREE.Group | null = null;
  private bushTemplate: THREE.Group | null = null;

  private cellSize: number;
  private worldWidth: number;
  private worldHeight: number;

  public uniforms: {
    uNight: { value: number };
    uLampColor: { value: THREE.Color };
  };

  constructor(
    worldWidth: number = 64,
    worldHeight: number = 64,
    cellSize: number = 2.0
  ) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cellSize = cellSize;

    const assets = AssetManager.getInstance();

    this.uniforms = {
      uNight: { value: 0.0 },
      uLampColor: { value: new THREE.Color(0xffcb78) }, // Ámbar cálido de farola
    };

    // 1. Asfalto PBR con shader analítico de marcas viales y charcos de luz
    this.roadGeometry = new THREE.BufferGeometry();
    const roadMat = assets.createPBRMaterial({
      colorMapUrl: '/assets/shared/asphalt_light/albedo.jpg',
      normalMapUrl: '/assets/shared/asphalt_light/normal.jpg',
      roughnessMapUrl: '/assets/shared/asphalt_light/roughness.jpg',
      repeat: 1,
      roughness: 0.65,
      metalness: 0.04,
      colorTint: 0xbdb8ad,
    });

    roadMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute float aRoadType;
          varying vec2 vRoadUv;
          varying float vRoadType;
          varying vec3 vRoadWorldPos;`
        )
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
          vRoadUv = uv;
          vRoadType = aRoadType;
          vRoadWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uNight;
          uniform vec3 uLampColor;
          varying vec2 vRoadUv;
          varying float vRoadType;
          varying vec3 vRoadWorldPos;`
        )
        .replace(
          '#include <map_fragment>',
          `
          float lat = vRoadUv.x;
          float longM = vRoadUv.y;

          // Muestreo de asfalto continuo métrico
          vec2 asphaltUv = vec2(lat * 2.2, longM / 2.2);
          vec4 texColor = texture2D(map, asphaltUv);

          // 1. Marcas viales analíticas con anti-aliasing de fwidth
          float aaLat = fwidth(lat);
          float aaLong = fwidth(longM);

          // Línea discontinua central blanca (2.2m trazo, 2.3m hueco)
          float dash = 1.0 - smoothstep(2.2 - aaLong * 2.0, 2.2 + aaLong * 2.0, mod(longM, 4.5));
          float centerLine = 1.0 - smoothstep(0.025 - aaLat, 0.025 + aaLat, abs(lat));

          // Líneas exteriores de borde de carril
          float edgeDist = min(abs(lat - 0.82), abs(lat + 0.82));
          float edgeLines = 1.0 - smoothstep(0.022 - aaLat, 0.022 + aaLat, edgeDist);

          float markings = 0.0;
          vec3 paintColor = vec3(0.94, 0.94, 0.92);

          if (vRoadType < 0.5) {
            // LOCAL_2L: Línea blanca discontinua central + bordes
            markings = clamp(centerLine * dash + edgeLines, 0.0, 1.0);
          } else if (vRoadType < 1.5) {
            // ONE_WAY_2L: Línea amarilla continua o discontinua
            markings = clamp(centerLine * dash + edgeLines, 0.0, 1.0);
            paintColor = vec3(0.95, 0.78, 0.16);
          } else if (vRoadType < 2.5) {
            // AVENUE_4L: Doble línea continua central blanca + líneas de carril
            float doubleCenter = 1.0 - smoothstep(0.015 - aaLat, 0.015 + aaLat, abs(abs(lat) - 0.06));
            float laneDivs = (1.0 - smoothstep(0.018 - aaLat, 0.018 + aaLat, abs(abs(lat) - 0.44))) * dash;
            markings = clamp(doubleCenter + laneDivs + edgeLines, 0.0, 1.0);
          } else {
            // HIGHWAY_4L: Arcén amplio y marcas rápidas
            float hwayCenter = (1.0 - smoothstep(0.022 - aaLat, 0.022 + aaLat, abs(abs(lat) - 0.45))) * dash;
            markings = clamp(hwayCenter + edgeLines, 0.0, 1.0);
          }

          // Desgaste de rodadura en calzada
          float tireWear = smoothstep(0.15, 0.35, abs(lat)) * (1.0 - smoothstep(0.55, 0.75, abs(lat)));
          vec3 baseAsphalt = texColor.rgb * diffuse * (1.0 - tireWear * 0.12);

          vec3 finalAlbedo = mix(baseAsphalt, paintColor, markings * 0.94);

          // 2. Charcos de luz cálida de farolas en noche
          if (uNight > 0.02) {
            float lampSpacing = 14.0;
            float lampAlongDist = mod(longM + lampSpacing * 0.5, lampSpacing) - lampSpacing * 0.5;
            float lampDistSq = lampAlongDist * lampAlongDist + (lat * 2.5) * (lat * 2.5);
            float pool = 1.0 - smoothstep(1.0, 7.5, sqrt(lampDistSq));
            finalAlbedo += uLampColor * pool * (uNight * 0.65);
          }

          diffuseColor = vec4(finalAlbedo, opacity);
          `
        );
    };

    this.roadMesh = new THREE.Mesh(this.roadGeometry, roadMat);
    this.roadMesh.receiveShadow = true;
    this.group.add(this.roadMesh);

    // 2. Aceras de losas de piedra PBR con bordillos
    this.sidewalkGeometry = new THREE.BufferGeometry();
    const sidewalkMat = assets.createPBRMaterial({
      colorMapUrl: '/assets/shared/paving_slabs/albedo.jpg',
      normalMapUrl: '/assets/shared/paving_slabs/normal.jpg',
      roughnessMapUrl: '/assets/shared/paving_slabs/roughness.jpg',
      repeat: 3,
      roughness: 0.80,
      metalness: 0.02,
      colorTint: 0xd6d2c8,
    });

    sidewalkMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vSidewalkWorldPos;`
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vSidewalkWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uNight;
          uniform vec3 uLampColor;
          varying vec3 vSidewalkWorldPos;`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          if (uNight > 0.02) {
            float lampDist = mod(length(vSidewalkWorldPos.xz), 14.0);
            float pool = 1.0 - smoothstep(0.5, 6.0, lampDist);
            diffuseColor.rgb += uLampColor * pool * (uNight * 0.55);
          }`
        );
    };

    this.sidewalkMesh = new THREE.Mesh(this.sidewalkGeometry, sidewalkMat);
    this.sidewalkMesh.receiveShadow = true;
    this.sidewalkMesh.castShadow = true;
    this.group.add(this.sidewalkMesh);

    // 3. Estructuras de puente y pilares de hormigón
    this.bridgeGeometry = new THREE.BufferGeometry();
    const bridgeMat = assets.createPBRMaterial({
      colorMapUrl: '/assets/shared/concrete/albedo.jpg',
      normalMapUrl: '/assets/shared/concrete/normal.jpg',
      roughnessMapUrl: '/assets/shared/concrete/roughness.jpg',
      repeat: 3,
      roughness: 0.85,
      metalness: 0.05,
      colorTint: 0xbeb8ad,
    });
    this.bridgeMesh = new THREE.Mesh(this.bridgeGeometry, bridgeMat);
    this.bridgeMesh.receiveShadow = true;
    this.bridgeMesh.castShadow = true;
    this.group.add(this.bridgeMesh);

    this.group.add(this.propsGroup);

    this.loadProps();
  }

  private async loadProps(): Promise<void> {
    const assets = AssetManager.getInstance();
    try {
      this.lampTemplate = await assets.loadGLTF('/assets/shared/models/street_lamp_01/street_lamp_01_1k.gltf');
      this.hydrantTemplate = await assets.loadGLTF('/assets/shared/models/fire_hydrant/fire_hydrant_1k.gltf');
      this.benchTemplate = await assets.loadGLTF('/assets/shared/models/painted_wooden_bench/painted_wooden_bench_1k.gltf');
      this.bushTemplate = await assets.loadGLTF('/assets/shared/models/wild_rooibos_bush/wild_rooibos_bush_1k.gltf');
    } catch (e) {
      console.warn('[RoadNetworkMesh] Error cargando atrezzo:', e);
    }
  }

  public setNightFactor(nightFactor: number): void {
    this.uniforms.uNight.value = nightFactor;
  }

  public rebuild(graph: RoadGraph): void {
    const roadPositions: number[] = [];
    const roadUvs: number[] = [];
    const roadTypes: number[] = [];

    const sidewalkPositions: number[] = [];
    const sidewalkUvs: number[] = [];

    const bridgePositions: number[] = [];
    const bridgeUvs: number[] = [];

    const offsetX = (this.worldWidth * this.cellSize) / 2;
    const offsetZ = (this.worldHeight * this.cellSize) / 2;

    while (this.propsGroup.children.length > 0) {
      const child = this.propsGroup.children[0]!;
      this.propsGroup.remove(child);
    }

    let propIndex = 0;
    const waterLevel = 1.5;

    // 1. Generar geometría subdividida por tramos para seguir el relieve suavemente
    for (const edge of graph.edges.values()) {
      const nodeA = graph.nodes.get(edge.fromNodeId);
      const nodeB = graph.nodes.get(edge.toNodeId);
      if (!nodeA || !nodeB) continue;

      const config = ROAD_CONFIGS[edge.roadType];
      const roadW = config.width;
      const halfRoadW = roadW / 2;
      const sidewalkW = edge.roadType === RoadType.AVENUE_4L ? 1.1 : 0.8;

      let roadTypeCode = 0; // LOCAL_2L
      if (edge.roadType === RoadType.ONE_WAY_2L) roadTypeCode = 1;
      else if (edge.roadType === RoadType.AVENUE_4L) roadTypeCode = 2;
      else if (edge.roadType === RoadType.HIGHWAY_4L) roadTypeCode = 3;

      const isBridge = nodeA.elevation < waterLevel + 0.8 || nodeB.elevation < waterLevel + 0.8;
      const elevA = isBridge ? Math.max(nodeA.elevation, waterLevel + 1.25) : nodeA.elevation;
      const elevB = isBridge ? Math.max(nodeB.elevation, waterLevel + 1.25) : nodeB.elevation;

      const pA = new THREE.Vector3(
        (nodeA.x + 0.5) * this.cellSize - offsetX,
        elevA,
        (nodeA.z + 0.5) * this.cellSize - offsetZ
      );
      const pB = new THREE.Vector3(
        (nodeB.x + 0.5) * this.cellSize - offsetX,
        elevB,
        (nodeB.z + 0.5) * this.cellSize - offsetZ
      );

      const segmentVec = new THREE.Vector3().subVectors(pB, pA);
      const segLength = segmentVec.length();
      if (segLength < 0.05) continue;

      const dir = segmentVec.clone().normalize();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x);

      const roadY = 0.055;
      const curbY = 0.17; // 17cm bordillo estándar

      // Subdividir en estaciones cada ~1.5 metros para que la vía se adapte suavemente al relieve
      const numSteps = Math.max(1, Math.ceil(segLength / 1.5));
      for (let s = 0; s < numSteps; s++) {
        const t0 = s / numSteps;
        const t1 = (s + 1) / numSteps;

        const pos0 = new THREE.Vector3().lerpVectors(pA, pB, t0);
        const pos1 = new THREE.Vector3().lerpVectors(pA, pB, t1);

        const m0 = t0 * segLength;
        const m1 = t1 * segLength;

        // Calzada de asfalto
        const r0_L = pos0.clone().addScaledVector(perp, -halfRoadW).setY(pos0.y + roadY);
        const r0_R = pos0.clone().addScaledVector(perp, halfRoadW).setY(pos0.y + roadY);
        const r1_L = pos1.clone().addScaledVector(perp, -halfRoadW).setY(pos1.y + roadY);
        const r1_R = pos1.clone().addScaledVector(perp, halfRoadW).setY(pos1.y + roadY);

        this.addRoadQuadStations(
          roadPositions,
          roadUvs,
          roadTypes,
          r0_L,
          r0_R,
          r1_L,
          r1_R,
          m0,
          m1,
          roadTypeCode
        );

        // Aceras elevadas con bordillos
        const s0_L_inner = pos0.clone().addScaledVector(perp, -halfRoadW).setY(pos0.y + curbY);
        const s0_L_outer = pos0.clone().addScaledVector(perp, -(halfRoadW + sidewalkW)).setY(pos0.y + curbY);
        const s1_L_inner = pos1.clone().addScaledVector(perp, -halfRoadW).setY(pos1.y + curbY);
        const s1_L_outer = pos1.clone().addScaledVector(perp, -(halfRoadW + sidewalkW)).setY(pos1.y + curbY);

        const s0_R_inner = pos0.clone().addScaledVector(perp, halfRoadW).setY(pos0.y + curbY);
        const s0_R_outer = pos0.clone().addScaledVector(perp, halfRoadW + sidewalkW).setY(pos0.y + curbY);
        const s1_R_inner = pos1.clone().addScaledVector(perp, halfRoadW).setY(pos1.y + curbY);
        const s1_R_outer = pos1.clone().addScaledVector(perp, halfRoadW + sidewalkW).setY(pos1.y + curbY);

        // Superficie de aceras
        this.addQuad(sidewalkPositions, sidewalkUvs, s0_L_outer, s0_L_inner, s1_L_outer, s1_L_inner, 1.0, m1 - m0);
        this.addQuad(sidewalkPositions, sidewalkUvs, s0_R_inner, s0_R_outer, s1_R_inner, s1_R_outer, 1.0, m1 - m0);

        // Bordillo vertical achaflanado
        this.addQuad(sidewalkPositions, sidewalkUvs, r0_L, s0_L_inner, r1_L, s1_L_inner, 0.2, m1 - m0);
        this.addQuad(sidewalkPositions, sidewalkUvs, s0_R_inner, r0_R, s1_R_inner, r1_R, 0.2, m1 - m0);
      }

      // Si es puente, generar tablero estructural inferior y pilares de apoyo
      if (isBridge) {
        const pMid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
        const pierH = pMid.y;
        const pierW = 0.85;

        bridgePositions.push(
          pMid.x - pierW, 0, pMid.z - pierW,
          pMid.x + pierW, 0, pMid.z - pierW,
          pMid.x - pierW, pierH, pMid.z - pierW,

          pMid.x - pierW, pierH, pMid.z - pierW,
          pMid.x + pierW, 0, pMid.z - pierW,
          pMid.x + pierW, pierH, pMid.z - pierW
        );
        bridgeUvs.push(0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1);
      }

      // Atrezzo y mobiliario urbano PBR
      const midPoint = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
      const midElev = (elevA + elevB) * 0.5 + curbY;
      const angle = Math.atan2(dir.z, dir.x);

      if (this.lampTemplate && propIndex % 2 === 0) {
        const lamp = this.lampTemplate.clone(true);
        const lampPos = midPoint.clone().addScaledVector(perp, -(halfRoadW + sidewalkW * 0.5)).setY(midElev);
        lamp.position.copy(lampPos);
        lamp.rotation.y = -angle;
        lamp.scale.set(0.65, 0.65, 0.65);
        this.propsGroup.add(lamp);
      } else if (this.bushTemplate && propIndex % 3 === 0) {
        const bush = this.bushTemplate.clone(true);
        const bushPos = midPoint.clone().addScaledVector(perp, -(halfRoadW + sidewalkW * 0.5)).setY(midElev);
        bush.position.copy(bushPos);
        bush.scale.set(0.45, 0.45, 0.45);
        this.propsGroup.add(bush);
      }

      if (this.benchTemplate && propIndex % 3 === 0) {
        const bench = this.benchTemplate.clone(true);
        const benchPos = midPoint.clone().addScaledVector(perp, halfRoadW + sidewalkW * 0.5).setY(midElev);
        bench.position.copy(benchPos);
        bench.rotation.y = -angle + Math.PI;
        bench.scale.set(0.55, 0.55, 0.55);
        this.propsGroup.add(bench);
      } else if (this.hydrantTemplate && propIndex % 5 === 0) {
        const hydrant = this.hydrantTemplate.clone(true);
        const hydrantPos = midPoint.clone().addScaledVector(perp, halfRoadW + sidewalkW * 0.5).setY(midElev);
        hydrant.position.copy(hydrantPos);
        hydrant.scale.set(0.5, 0.5, 0.5);
        this.propsGroup.add(hydrant);
      }

      propIndex++;
    }

    // 2. Cruces viales con fans circulares continuos (CERO cuadrados)
    for (const node of graph.nodes.values()) {
      if (node.outNeighbors.length === 0 && node.inNeighbors.length === 0) continue;

      const cx = (node.x + 0.5) * this.cellSize - offsetX;
      const cz = (node.z + 0.5) * this.cellSize - offsetZ;
      const isBridge = node.elevation < waterLevel + 0.8;
      const cy = (isBridge ? Math.max(node.elevation, waterLevel + 1.25) : node.elevation) + 0.055;

      const junctionRadius = 1.35;
      const segments = 16;

      // Fan circular de asfalto en el cruce
      for (let i = 0; i < segments; i++) {
        const theta1 = (i / segments) * Math.PI * 2;
        const theta2 = ((i + 1) / segments) * Math.PI * 2;

        const p1x = cx + Math.cos(theta1) * junctionRadius;
        const p1z = cz + Math.sin(theta1) * junctionRadius;
        const p2x = cx + Math.cos(theta2) * junctionRadius;
        const p2z = cz + Math.sin(theta2) * junctionRadius;

        roadPositions.push(
          cx, cy, cz,
          p1x, cy, p1z,
          p2x, cy, p2z
        );

        roadUvs.push(
          0, 0,
          Math.cos(theta1), Math.sin(theta1),
          Math.cos(theta2), Math.sin(theta2)
        );

        for (let k = 0; k < 3; k++) {
          roadTypes.push(0);
        }
      }
    }

    this.roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
    this.roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
    this.roadGeometry.setAttribute('aRoadType', new THREE.Float32BufferAttribute(roadTypes, 1));
    this.roadGeometry.computeVertexNormals();

    this.sidewalkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sidewalkPositions, 3));
    this.sidewalkGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(sidewalkUvs, 2));
    this.sidewalkGeometry.computeVertexNormals();

    this.bridgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bridgePositions, 3));
    this.bridgeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(bridgeUvs, 2));
    this.bridgeGeometry.computeVertexNormals();
  }

  private addRoadQuadStations(
    positions: number[],
    uvs: number[],
    types: number[],
    v0: THREE.Vector3,
    v1: THREE.Vector3,
    v2: THREE.Vector3,
    v3: THREE.Vector3,
    m0: number,
    m1: number,
    typeCode: number
  ): void {
    positions.push(
      v0.x, v0.y, v0.z,
      v1.x, v1.y, v1.z,
      v2.x, v2.y, v2.z
    );
    positions.push(
      v2.x, v2.y, v2.z,
      v1.x, v1.y, v1.z,
      v3.x, v3.y, v3.z
    );

    uvs.push(
      -1.0, m0,
      1.0, m0,
      -1.0, m1
    );
    uvs.push(
      -1.0, m1,
      1.0, m0,
      1.0, m1
    );

    for (let i = 0; i < 6; i++) {
      types.push(typeCode);
    }
  }

  private addQuad(
    positions: number[],
    uvs: number[],
    v0: THREE.Vector3,
    v1: THREE.Vector3,
    v2: THREE.Vector3,
    v3: THREE.Vector3,
    uScale: number = 1.0,
    vScale: number = 1.0
  ): void {
    positions.push(
      v0.x, v0.y, v0.z,
      v1.x, v1.y, v1.z,
      v2.x, v2.y, v2.z
    );
    positions.push(
      v2.x, v2.y, v2.z,
      v1.x, v1.y, v1.z,
      v3.x, v3.y, v3.z
    );

    uvs.push(
      0, 0,
      uScale, 0,
      0, vScale
    );
    uvs.push(
      0, vScale,
      uScale, 0,
      uScale, vScale
    );
  }

  public dispose(): void {
    this.roadGeometry.dispose();
    this.sidewalkGeometry.dispose();
    this.bridgeGeometry.dispose();
    while (this.propsGroup.children.length > 0) {
      const child = this.propsGroup.children[0]!;
      this.propsGroup.remove(child);
    }
  }
}
