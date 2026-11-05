import { RoadGraph, RoadNode } from '@core/graph/road_graph';
import { ObjectPool } from '@core/utils/pool';

/**
 * Nodo de búsqueda A* reutilizable mediante ObjectPool.
 */
class AStarSearchNode {
  public nodeId: number = 0;
  public gCost: number = 0; // Tiempo acumulado estimado de viaje
  public hCost: number = 0; // Heurística hasta el destino
  public fCost: number = 0; // gCost + hCost
  public parent: AStarSearchNode | null = null;

  public reset(): void {
    this.nodeId = 0;
    this.gCost = 0;
    this.hCost = 0;
    this.fCost = 0;
    this.parent = null;
  }
}

/**
 * Buscador de Rutas A* para el Grafo Vial Dirigido.
 * Considera calles de sentido único y pondera por tiempo de viaje según límite de velocidad.
 */
export class AStarPathfinder {
  private pool: ObjectPool<AStarSearchNode>;
  private openSet: AStarSearchNode[] = [];
  private closedSet: Set<number> = new Set();
  private nodeMap: Map<number, AStarSearchNode> = new Map();
  private acquiredNodes: AStarSearchNode[] = [];

  constructor(initialPoolSize: number = 256) {
    this.pool = new ObjectPool<AStarSearchNode>(
      () => new AStarSearchNode(),
      (n) => n.reset(),
      initialPoolSize
    );
  }

  /**
   * Heurística admisible basada en distancia euclidiana dividida por la velocidad máxima global (100 km/h).
   */
  private heuristic(a: RoadNode, b: RoadNode): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    const dy = a.elevation - b.elevation;
    const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
    return dist / 100; // Tiempo estimado en horas
  }

  /**
   * Obtiene la velocidad límite de la arista que conecta dos nodos en la dirección válida.
   */
  private getEdgeSpeed(graph: RoadGraph, fromId: number, toId: number): number {
    for (const edge of graph.edges.values()) {
      if (edge.fromNodeId === fromId && edge.toNodeId === toId) {
        return edge.speedLimit;
      }
      if (!edge.isOneWay && edge.fromNodeId === toId && edge.toNodeId === fromId) {
        return edge.speedLimit;
      }
    }
    return 50;
  }

  /**
   * Encuentra el camino más rápido entre dos nodos en el RoadGraph.
   */
  public findPath(
    graph: RoadGraph,
    startNodeId: number,
    targetNodeId: number
  ): number[] | null {
    if (startNodeId === targetNodeId) {
      return [startNodeId];
    }

    const startNode = graph.nodes.get(startNodeId);
    const targetNode = graph.nodes.get(targetNodeId);
    if (!startNode || !targetNode) {
      return null;
    }

    this.openSet.length = 0;
    this.closedSet.clear();
    this.nodeMap.clear();
    this.acquiredNodes.length = 0;

    const startSearchNode = this.pool.acquire();
    this.acquiredNodes.push(startSearchNode);

    startSearchNode.nodeId = startNodeId;
    startSearchNode.gCost = 0;
    startSearchNode.hCost = this.heuristic(startNode, targetNode);
    startSearchNode.fCost = startSearchNode.hCost;

    this.openSet.push(startSearchNode);
    this.nodeMap.set(startNodeId, startSearchNode);

    let foundTargetNode: AStarSearchNode | null = null;

    while (this.openSet.length > 0) {
      let bestIdx = 0;
      let bestNode = this.openSet[0]!;
      for (let i = 1; i < this.openSet.length; i++) {
        const candidate = this.openSet[i]!;
        if (
          candidate.fCost < bestNode.fCost ||
          (candidate.fCost === bestNode.fCost && candidate.hCost < bestNode.hCost)
        ) {
          bestNode = candidate;
          bestIdx = i;
        }
      }

      this.openSet.splice(bestIdx, 1);
      this.closedSet.add(bestNode.nodeId);

      if (bestNode.nodeId === targetNodeId) {
        foundTargetNode = bestNode;
        break;
      }

      const currentRoadNode = graph.nodes.get(bestNode.nodeId);
      if (!currentRoadNode) continue;

      // Explorar solo vecinos salientes autorizados (respetando calles de un solo sentido)
      for (const neighborId of currentRoadNode.outNeighbors) {
        if (this.closedSet.has(neighborId)) {
          continue;
        }

        const neighborRoadNode = graph.nodes.get(neighborId);
        if (!neighborRoadNode) continue;

        const dx = currentRoadNode.x - neighborRoadNode.x;
        const dz = currentRoadNode.z - neighborRoadNode.z;
        const dy = currentRoadNode.elevation - neighborRoadNode.elevation;
        const distance = Math.sqrt(dx * dx + dz * dz + dy * dy);

        const speed = this.getEdgeSpeed(graph, currentRoadNode.id, neighborRoadNode.id);
        const traversalTime = distance / speed; // Tiempo = Distancia / Velocidad
        const tentativeGCost = bestNode.gCost + traversalTime;

        let neighborSearchNode = this.nodeMap.get(neighborId);

        if (!neighborSearchNode) {
          neighborSearchNode = this.pool.acquire();
          this.acquiredNodes.push(neighborSearchNode);

          neighborSearchNode.nodeId = neighborId;
          neighborSearchNode.gCost = tentativeGCost;
          neighborSearchNode.hCost = this.heuristic(neighborRoadNode, targetNode);
          neighborSearchNode.fCost = neighborSearchNode.gCost + neighborSearchNode.hCost;
          neighborSearchNode.parent = bestNode;

          this.openSet.push(neighborSearchNode);
          this.nodeMap.set(neighborId, neighborSearchNode);
        } else if (tentativeGCost < neighborSearchNode.gCost) {
          neighborSearchNode.gCost = tentativeGCost;
          neighborSearchNode.fCost = tentativeGCost + neighborSearchNode.hCost;
          neighborSearchNode.parent = bestNode;
        }
      }
    }

    let path: number[] | null = null;
    if (foundTargetNode) {
      path = [];
      let curr: AStarSearchNode | null = foundTargetNode;
      while (curr) {
        path.push(curr.nodeId);
        curr = curr.parent;
      }
      path.reverse();
    }

    for (let i = 0; i < this.acquiredNodes.length; i++) {
      this.pool.release(this.acquiredNodes[i]!);
    }

    return path;
  }
}
