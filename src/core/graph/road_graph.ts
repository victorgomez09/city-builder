import { RoadType, ROAD_CONFIGS } from '@core/graph/road_types';

/**
 * Representación de un nodo (intersección, cruce o terminal) en el grafo vial.
 */
export interface RoadNode {
  id: number;
  x: number; // Coordenada X de la cuadrícula
  z: number; // Coordenada Z de la cuadrícula
  elevation: number; // Altura sobre el terreno
  outNeighbors: number[]; // IDs de nodos adyacentes a los que se puede viajar saliendo de aquí
  inNeighbors: number[];  // IDs de nodos desde los que se puede llegar aquí
}

/**
 * Representación de un segmento de carretera entre dos nodos.
 */
export interface RoadEdge {
  id: number;
  fromNodeId: number;
  toNodeId: number;
  roadType: RoadType;
  distance: number;
  speedLimit: number;
  lanes: number;
  isOneWay: boolean;
}

/**
 * Grafo Topológico Vial Dirigido.
 * Soporta calles de sentido único, doble sentido y jerarquía de velocidades.
 */
export class RoadGraph {
  public nodes: Map<number, RoadNode> = new Map();
  public edges: Map<number, RoadEdge> = new Map();
  private nextNodeId: number = 1;
  private nextEdgeId: number = 1;

  // Mapa espacial de búsqueda rápida: clave "x,z" -> nodeId
  private gridCoordToNodeId: Map<string, number> = new Map();

  private getCoordKey(x: number, z: number): string {
    return `${x},${z}`;
  }

  /**
   * Obtiene o crea un nodo en las coordenadas de cuadrícula dadas.
   */
  public getOrCreateNode(x: number, z: number, elevation: number = 0): RoadNode {
    const key = this.getCoordKey(x, z);
    const existingId = this.gridCoordToNodeId.get(key);

    if (existingId !== undefined) {
      const node = this.nodes.get(existingId);
      if (node) {
        node.elevation = elevation;
        return node;
      }
    }

    const newNode: RoadNode = {
      id: this.nextNodeId++,
      x,
      z,
      elevation,
      outNeighbors: [],
      inNeighbors: [],
    };

    this.nodes.set(newNode.id, newNode);
    this.gridCoordToNodeId.set(key, newNode.id);
    return newNode;
  }

  /**
   * Obtiene el nodo en las coordenadas dadas, si existe.
   */
  public getNodeAt(x: number, z: number): RoadNode | undefined {
    const id = this.gridCoordToNodeId.get(this.getCoordKey(x, z));
    return id !== undefined ? this.nodes.get(id) : undefined;
  }

  /**
   * Conecta dos nodos con un tramo de carretera del tipo especificado.
   */
  public addRoadSegment(
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
    elevationFrom: number = 0,
    elevationTo: number = 0,
    roadType: RoadType = RoadType.LOCAL_2L
  ): RoadEdge | null {
    if (fromX === toX && fromZ === toZ) return null;

    const nodeA = this.getOrCreateNode(fromX, fromZ, elevationFrom);
    const nodeB = this.getOrCreateNode(toX, toZ, elevationTo);
    const config = ROAD_CONFIGS[roadType];

    // Verificar si ya existe arista de A -> B
    let existingEdge: RoadEdge | null = null;
    for (const edge of this.edges.values()) {
      if (
        (edge.fromNodeId === nodeA.id && edge.toNodeId === nodeB.id) ||
        (!edge.isOneWay && edge.fromNodeId === nodeB.id && edge.toNodeId === nodeA.id)
      ) {
        existingEdge = edge;
        break;
      }
    }

    if (existingEdge) {
      // Actualizar tipo de vía existente (upgrade)
      existingEdge.roadType = roadType;
      existingEdge.speedLimit = config.speedLimit;
      existingEdge.lanes = config.lanes;
      existingEdge.isOneWay = config.isOneWay;

      if (!config.isOneWay) {
        if (!nodeB.outNeighbors.includes(nodeA.id)) nodeB.outNeighbors.push(nodeA.id);
        if (!nodeA.inNeighbors.includes(nodeB.id)) nodeA.inNeighbors.push(nodeB.id);
      } else {
        // Si ahora es sentido único, remover dirección contraria
        nodeB.outNeighbors = nodeB.outNeighbors.filter((id) => id !== nodeA.id);
        nodeA.inNeighbors = nodeA.inNeighbors.filter((id) => id !== nodeB.id);
      }
      return existingEdge;
    }

    // Registrar conexión direccional A -> B
    if (!nodeA.outNeighbors.includes(nodeB.id)) nodeA.outNeighbors.push(nodeB.id);
    if (!nodeB.inNeighbors.includes(nodeA.id)) nodeB.inNeighbors.push(nodeA.id);

    // Si es bidireccional, registrar también B -> A
    if (!config.isOneWay) {
      if (!nodeB.outNeighbors.includes(nodeA.id)) nodeB.outNeighbors.push(nodeA.id);
      if (!nodeA.inNeighbors.includes(nodeB.id)) nodeA.inNeighbors.push(nodeB.id);
    }

    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const distance = Math.sqrt(dx * dx + dz * dz);

    const edge: RoadEdge = {
      id: this.nextEdgeId++,
      fromNodeId: nodeA.id,
      toNodeId: nodeB.id,
      roadType,
      distance,
      speedLimit: config.speedLimit,
      lanes: config.lanes,
      isOneWay: config.isOneWay,
    };

    this.edges.set(edge.id, edge);
    return edge;
  }

  /**
   * Elimina un nodo y todas las aristas conectadas a él.
   */
  public removeNode(id: number): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Desconectar de vecinos salientes y entrantes
    for (const neighborId of node.outNeighbors) {
      const neighbor = this.nodes.get(neighborId);
      if (neighbor) {
        neighbor.inNeighbors = neighbor.inNeighbors.filter((nId) => nId !== id);
        neighbor.outNeighbors = neighbor.outNeighbors.filter((nId) => nId !== id);
      }
    }
    for (const neighborId of node.inNeighbors) {
      const neighbor = this.nodes.get(neighborId);
      if (neighbor) {
        neighbor.outNeighbors = neighbor.outNeighbors.filter((nId) => nId !== id);
        neighbor.inNeighbors = neighbor.inNeighbors.filter((nId) => nId !== id);
      }
    }

    const edgesToDelete: number[] = [];
    for (const [edgeId, edge] of this.edges.entries()) {
      if (edge.fromNodeId === id || edge.toNodeId === id) {
        edgesToDelete.push(edgeId);
      }
    }
    for (const edgeId of edgesToDelete) {
      this.edges.delete(edgeId);
    }

    this.gridCoordToNodeId.delete(this.getCoordKey(node.x, node.z));
    this.nodes.delete(id);
    return true;
  }

  public clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.gridCoordToNodeId.clear();
    this.nextNodeId = 1;
    this.nextEdgeId = 1;
  }
}
