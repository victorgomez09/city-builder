import { describe, it, expect } from 'vitest';
import { RoadGraph } from '@core/graph/road_graph';
import { AStarPathfinder } from '@core/graph/astar_pathfinder';

describe('RoadGraph & AStarPathfinder', () => {
  it('debe crear nodos e interconectar aristas correctamente', () => {
    const graph = new RoadGraph();

    // Crear un tramo de (0,0) a (0,5)
    const edge = graph.addRoadSegment(0, 0, 0, 5);
    expect(edge).not.toBeNull();
    expect(graph.nodes.size).toBe(2);
    expect(graph.edges.size).toBe(1);

    const nodeA = graph.getNodeAt(0, 0);
    const nodeB = graph.getNodeAt(0, 5);
    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();
    expect(nodeA?.outNeighbors).toContain(nodeB?.id);
    expect(nodeB?.outNeighbors).toContain(nodeA?.id);
  });

  it('debe encontrar el camino más corto en una cuadrícula vial con bifurcaciones', () => {
    const graph = new RoadGraph();
    const pathfinder = new AStarPathfinder();

    // Grafo en diamante:
    //      (0,1)
    //     /     \
    // (0,0)      (0,2)
    //     \     /
    //      (1,1) [más largo]
    graph.addRoadSegment(0, 0, 0, 1);
    graph.addRoadSegment(0, 1, 0, 2);
    graph.addRoadSegment(0, 0, 2, 1); // Camino desviado más largo
    graph.addRoadSegment(2, 1, 0, 2);

    const startNode = graph.getNodeAt(0, 0)!;
    const targetNode = graph.getNodeAt(0, 2)!;

    const path = pathfinder.findPath(graph, startNode.id, targetNode.id);

    expect(path).not.toBeNull();
    expect(path?.length).toBe(3); // (0,0) -> (0,1) -> (0,2)

    const intermediateNode = graph.nodes.get(path![1]!)!;
    expect(intermediateNode.x).toBe(0);
    expect(intermediateNode.z).toBe(1);
  });

  it('debe devolver null si dos componentes del grafo están aisladas', () => {
    const graph = new RoadGraph();
    const pathfinder = new AStarPathfinder();

    graph.addRoadSegment(0, 0, 1, 0);
    graph.addRoadSegment(5, 5, 6, 5);

    const startNode = graph.getNodeAt(0, 0)!;
    const targetNode = graph.getNodeAt(6, 5)!;

    const path = pathfinder.findPath(graph, startNode.id, targetNode.id);
    expect(path).toBeNull();
  });
});
