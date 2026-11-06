import * as THREE from 'three';
import { RoadGraph, RoadNode } from '@core/graph/road_graph';
import { AssetManager } from '@render/assets/asset_manager';

export interface VehicleAgent {
  id: number;
  mesh: THREE.Group;
  currentNodeId: number;
  targetNodeId: number;
  t: number; // Progreso 0..1 en el tramo
  speed: number;
  laneOffset: number; // Desplazamiento lateral para carril derecho
}

/**
 * Gestor de Tráfico y Vehículos en Carretera (Estilo CityRT):
 * - Hace circular vehículos reales (sedán, SUV, furgoneta, policía, reparto) por las calzadas.
 * - Los coches se desplazan por su carril derecho respectivo y se orientan tangencialmente al eje de la vía.
 * - Genera tráfico dinámico entrando por la autovía regional hacia las zonas residenciales, comerciales e industriales.
 */
export class TrafficManager {
  public group: THREE.Group = new THREE.Group();
  private scene: THREE.Scene;
  private vehicles: VehicleAgent[] = [];
  private nextVehicleId: number = 1;
  private roadGraph: RoadGraph;

  private vehicleTemplates: THREE.Group[] = [];
  private isLoaded: boolean = false;
  private spawnTimer: number = 0;
  private maxVehicles: number = 24;

  private cellSizeMeters: number;
  private halfMapWidth: number;
  private halfMapHeight: number;

  constructor(
    scene: THREE.Scene,
    roadGraph: RoadGraph,
    cellSizeMeters: number = 2.0,
    halfMapWidth: number = 128.0,
    halfMapHeight: number = 128.0
  ) {
    this.scene = scene;
    this.roadGraph = roadGraph;
    this.cellSizeMeters = cellSizeMeters;
    this.halfMapWidth = halfMapWidth;
    this.halfMapHeight = halfMapHeight;

    this.scene.add(this.group);
    this.loadVehicleModels();
  }

  private async loadVehicleModels(): Promise<void> {
    const assets = AssetManager.getInstance();
    const modelPaths = [
      '/assets/simulation/models/sedan.glb',
      '/assets/simulation/models/suv.glb',
      '/assets/simulation/models/van.glb',
      '/assets/simulation/models/police.glb',
      '/assets/simulation/models/delivery.glb',
    ];

    for (const path of modelPaths) {
      try {
        const model = await assets.loadGLTF(path);
        model.scale.set(0.65, 0.65, 0.65);
        model.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        this.vehicleTemplates.push(model);
      } catch (e) {
        console.warn(`[TrafficManager] No se pudo cargar modelo ${path}:`, e);
      }
    }

    this.isLoaded = this.vehicleTemplates.length > 0;
  }

  public update(deltaTime: number): void {
    if (!this.isLoaded || this.roadGraph.edges.size === 0) return;

    // 1. Spawner periódico de coches desde nodos de entrada
    this.spawnTimer += deltaTime;
    if (this.spawnTimer >= 2.0 && this.vehicles.length < this.maxVehicles) {
      this.spawnTimer = 0;
      this.spawnRandomVehicle();
    }

    // 2. Actualizar posición cinemática de los vehículos
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i]!;
      const nodeA = this.roadGraph.nodes.get(v.currentNodeId);
      const nodeB = this.roadGraph.nodes.get(v.targetNodeId);

      if (!nodeA || !nodeB) {
        this.group.remove(v.mesh);
        this.vehicles.splice(i, 1);
        continue;
      }

      const pA = this.getNodeWorldPos(nodeA);
      const pB = this.getNodeWorldPos(nodeB);

      const dx = pB.x - pA.x;
      const dz = pB.z - pA.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.1) {
        this.chooseNextTarget(v, nodeB);
        continue;
      }

      v.t += (v.speed * deltaTime) / dist;

      if (v.t >= 1.0) {
        v.t = 0;
        v.currentNodeId = v.targetNodeId;
        const reached = this.chooseNextTarget(v, nodeB);
        if (!reached) {
          this.group.remove(v.mesh);
          this.vehicles.splice(i, 1);
          continue;
        }
      }

      // Posición interpolada a lo largo del segmento con offset de carril derecho
      const curX = pA.x + (pB.x - pA.x) * v.t;
      const curY = pA.y + (pB.y - pA.y) * v.t + 0.08;
      const curZ = pA.z + (pB.z - pA.z) * v.t;

      const dirX = dx / dist;
      const dirZ = dz / dist;
      const perpX = -dirZ;
      const perpZ = dirX;

      const laneX = curX + perpX * v.laneOffset;
      const laneZ = curZ + perpZ * v.laneOffset;

      v.mesh.position.set(laneX, curY, laneZ);
      v.mesh.rotation.y = Math.atan2(dirX, dirZ);
    }
  }

  private getNodeWorldPos(node: RoadNode): THREE.Vector3 {
    return new THREE.Vector3(
      (node.x + 0.5) * this.cellSizeMeters - this.halfMapWidth,
      node.elevation,
      (node.z + 0.5) * this.cellSizeMeters - this.halfMapHeight
    );
  }

  private chooseNextTarget(vehicle: VehicleAgent, currentNode: RoadNode): boolean {
    const validNeighbors = currentNode.outNeighbors.filter((id) => id !== vehicle.currentNodeId);
    const pool = validNeighbors.length > 0 ? validNeighbors : currentNode.outNeighbors;

    if (pool.length === 0) return false;

    const nextId = pool[Math.floor(Math.random() * pool.length)]!;
    vehicle.targetNodeId = nextId;
    return true;
  }

  private spawnRandomVehicle(): void {
    if (this.vehicleTemplates.length === 0 || this.roadGraph.edges.size === 0) return;

    // Buscar una arista activa donde iniciar
    const edgeList = Array.from(this.roadGraph.edges.values());
    const randomEdge = edgeList[Math.floor(Math.random() * edgeList.length)]!;

    const nodeA = this.roadGraph.nodes.get(randomEdge.fromNodeId);
    const nodeB = this.roadGraph.nodes.get(randomEdge.toNodeId);
    if (!nodeA || !nodeB) return;

    const template = this.vehicleTemplates[Math.floor(Math.random() * this.vehicleTemplates.length)]!;
    const mesh = template.clone(true);

    const vehicle: VehicleAgent = {
      id: this.nextVehicleId++,
      mesh,
      currentNodeId: nodeA.id,
      targetNodeId: nodeB.id,
      t: 0.05,
      speed: 12.0 + Math.random() * 8.0, // 12m/s ~ 45 km/h
      laneOffset: 0.45, // Carril derecho
    };

    const pA = this.getNodeWorldPos(nodeA);
    mesh.position.set(pA.x, pA.y, pA.z);
    this.group.add(mesh);
    this.vehicles.push(vehicle);
  }

  public clear(): void {
    for (const v of this.vehicles) {
      this.group.remove(v.mesh);
    }
    this.vehicles = [];
  }

  public dispose(): void {
    this.clear();
    this.scene.remove(this.group);
  }
}
