import * as THREE from 'three';
import { RoadGraph } from '@core/graph/road_graph';
import { RoadType, ROAD_CONFIGS } from '@core/graph/road_types';
import { AssetManager } from '@render/assets/asset_manager';

/**
 * Renderizador de Carreteras PBR de Alta Fidelidad (estilo Fable Cities / Cities: Skylines II):
 * - Calzada de asfalto real PBR (/assets/shared/asphalt_light/albedo.jpg).
 * - Marcas viales analíticas anti-aliasing integradas en fragment shader (línea discontinua central y líneas continuas laterales).
 * - Aceras de losas de piedra PBR (/assets/shared/paving_slabs/albedo.jpg) elevadas con bordillos de hormigón.
 * - Pilares de puente automáticos al atravesar láminas de agua o vaguadas.
 * - Mobiliario urbano real (farolas, arbustos, bancos de madera y bocas de incendio).
 */
export class RoadNetworkMesh {
  public group: THREE.Group = new THREE.Group();
  private roadMesh: THREE.Mesh;
  private sidewalkMesh: THREE.Mesh;
  private bridgeMesh: THREE.Mesh;

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

  constructor(
    worldWidth: number = 64,
    worldHeight: number = 64,
    cellSize: number = 2.0
  ) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cellSize = cellSize;

    const assets = AssetManager.getInstance();

    // 1. Asfalto PBR con marcas viales analíticas
    this.roadGeometry = new THREE.BufferGeometry();
    const roadMat = assets.createPBRMaterial({
      colorMapUrl: '/assets/shared/asphalt_light/albedo.jpg',
      normalMapUrl: '/assets/shared/asphalt_light/normal.jpg',
      roughnessMapUrl: '/assets/shared/asphalt_light/roughness.jpg',
      repeat: 1, // El shader maneja la repetición métrica exacta
      roughness: 0.65,
      metalness: 0.05,
      colorTint: 0xb5b0a6,
    });

    roadMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec2 vRoadLaneUv;`
        )
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
          vRoadLaneUv = uv;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec2 vRoadLaneUv;`
        )
        .replace(
          '#include <map_fragment>',
          `
          // vRoadLaneUv.x: [0.0 .. 1.0] transversal a la calzada
          // vRoadLaneUv.y: distancia longitudinal acumulada en metros
          float lat = vRoadLaneUv.x;
          float longM = vRoadLaneUv.y;

          // Muestreo de textura de asfalto continuo a escala real (2.2m tile)
          vec2 asphaltUv = vec2(lat * 3.5, longM / 2.2);
          vec4 texColor = texture2D(map, asphaltUv);

          // Línea divisoria central discontinua (ciclo: 2.2m pintado, 2.3m hueco)
          float dash = step(2.3, mod(longM, 4.5));
          float centerDist = abs(lat - 0.5);
          float centerLine = (1.0 - smoothstep(0.012, 0.024, centerDist)) * dash;

          // Líneas continuas exteriores de borde de carril (en 0.07 y 0.93)
          float edgeDist = min(abs(lat - 0.07), abs(lat - 0.93));
          float edgeLine = 1.0 - smoothstep(0.012, 0.022, edgeDist);

          float markings = clamp(centerLine + edgeLine, 0.0, 1.0);

          vec3 baseAsphalt = texColor.rgb * diffuse;
          vec3 paintColor = vec3(0.93, 0.93, 0.90);

          diffuseColor = vec4(mix(baseAsphalt, paintColor, markings * 0.92), opacity);
          `
        );
    };

    this.roadMesh = new THREE.Mesh(this.roadGeometry, roadMat);
    this.roadMesh.receiveShadow = true;
    this.group.add(this.roadMesh);

    // 2. Aceras de losas de piedra PBR
    this.sidewalkGeometry = new THREE.BufferGeometry();
    const sidewalkMat = assets.createPBRMaterial({
      colorMapUrl: '/assets/shared/paving_slabs/albedo.jpg',
      normalMapUrl: '/assets/shared/paving_slabs/normal.jpg',
      roughnessMapUrl: '/assets/shared/paving_slabs/roughness.jpg',
      repeat: 4,
      roughness: 0.8,
      metalness: 0.02,
      colorTint: 0xd8d4cb,
    });
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
      colorTint: 0xbdb7ab,
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

  public rebuild(graph: RoadGraph): void {
    const roadPositions: number[] = [];
    const roadUvs: number[] = [];

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

    // 1. Renderizar segmentos de carretera
    for (const edge of graph.edges.values()) {
      const nodeA = graph.nodes.get(edge.fromNodeId);
      const nodeB = graph.nodes.get(edge.toNodeId);
      if (!nodeA || !nodeB) continue;

      const config = ROAD_CONFIGS[edge.roadType];
      const roadW = config.width;
      const halfRoadW = roadW / 2;
      const sidewalkW = edge.roadType === RoadType.AVENUE_4L ? 1.0 : 0.75;

      // Si cruza agua, elevar el puente para no quedar sumergido
      const isBridge = nodeA.elevation < waterLevel + 0.8 || nodeB.elevation < waterLevel + 0.8;
      const elevA = isBridge ? Math.max(nodeA.elevation, waterLevel + 1.2) : nodeA.elevation;
      const elevB = isBridge ? Math.max(nodeB.elevation, waterLevel + 1.2) : nodeB.elevation;

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

      const dir = new THREE.Vector3().subVectors(pB, pA).normalize();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x);

      const roadY = 0.05;
      const curbY = 0.14;

      // A. Asfalto de Calzada (con UVs métricos para el shader de marcas viales)
      const rA_L = pA.clone().addScaledVector(perp, -halfRoadW).setY(pA.y + roadY);
      const rA_R = pA.clone().addScaledVector(perp, halfRoadW).setY(pA.y + roadY);
      const rB_L = pB.clone().addScaledVector(perp, -halfRoadW).setY(pB.y + roadY);
      const rB_R = pB.clone().addScaledVector(perp, halfRoadW).setY(pB.y + roadY);

      this.addQuad(roadPositions, roadUvs, rA_L, rA_R, rB_L, rB_R, 1.0, edge.distance);

      // B. Aceras Elevadas con Losas de Pavimento
      const sA_L_inner = pA.clone().addScaledVector(perp, -halfRoadW).setY(pA.y + curbY);
      const sA_L_outer = pA.clone().addScaledVector(perp, -(halfRoadW + sidewalkW)).setY(pA.y + curbY);
      const sB_L_inner = pB.clone().addScaledVector(perp, -halfRoadW).setY(pB.y + curbY);
      const sB_L_outer = pB.clone().addScaledVector(perp, -(halfRoadW + sidewalkW)).setY(pB.y + curbY);

      const sA_R_inner = pA.clone().addScaledVector(perp, halfRoadW).setY(pA.y + curbY);
      const sA_R_outer = pA.clone().addScaledVector(perp, halfRoadW + sidewalkW).setY(pA.y + curbY);
      const sB_R_inner = pB.clone().addScaledVector(perp, halfRoadW).setY(pB.y + curbY);
      const sB_R_outer = pB.clone().addScaledVector(perp, halfRoadW + sidewalkW).setY(pB.y + curbY);

      this.addQuad(sidewalkPositions, sidewalkUvs, sA_L_outer, sA_L_inner, sB_L_outer, sB_L_inner, 1.0, edge.distance);
      this.addQuad(sidewalkPositions, sidewalkUvs, sA_R_inner, sA_R_outer, sB_R_inner, sB_R_outer, 1.0, edge.distance);

      // Bordillos verticales de hormigón
      this.addQuad(sidewalkPositions, sidewalkUvs, rA_L, sA_L_inner, rB_L, sB_L_inner, 0.2, edge.distance);
      this.addQuad(sidewalkPositions, sidewalkUvs, sA_R_inner, rA_R, sB_R_inner, rB_R, 0.2, edge.distance);

      // C. Si es puente, generar tablero inferior y pilares de apoyo
      if (isBridge) {
        const pMid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
        const pierH = pMid.y;
        const pierW = 0.8;

        // Pilar central de hormigón
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

      // D. Spawning de atrezzo urbano PBR (Farolas, Bancos, Arbustos)
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

    // 2. Cruces e intersecciones viales
    for (const node of graph.nodes.values()) {
      if (node.outNeighbors.length === 0 && node.inNeighbors.length === 0) continue;

      const cx = (node.x + 0.5) * this.cellSize - offsetX;
      const cz = (node.z + 0.5) * this.cellSize - offsetZ;
      const isBridge = node.elevation < waterLevel + 0.8;
      const cy = (isBridge ? Math.max(node.elevation, waterLevel + 1.2) : node.elevation) + 0.052;
      const halfW = 1.0;

      const x0 = cx - halfW;
      const x1 = cx + halfW;
      const z0 = cz - halfW;
      const z1 = cz + halfW;

      roadPositions.push(
        x0, cy, z0,
        x0, cy, z1,
        x1, cy, z0,

        x1, cy, z0,
        x0, cy, z1,
        x1, cy, z1
      );

      // En el cruce colocamos coordenadas neutras
      roadUvs.push(
        0.5, 0,
        0.5, 1,
        0.5, 0,

        0.5, 0,
        0.5, 1,
        0.5, 1
      );
    }

    this.roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
    this.roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
    this.roadGeometry.computeVertexNormals();

    this.sidewalkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sidewalkPositions, 3));
    this.sidewalkGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(sidewalkUvs, 2));
    this.sidewalkGeometry.computeVertexNormals();

    this.bridgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bridgePositions, 3));
    this.bridgeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(bridgeUvs, 2));
    this.bridgeGeometry.computeVertexNormals();
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
