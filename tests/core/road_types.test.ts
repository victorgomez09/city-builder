import { describe, it, expect } from 'vitest';
import { RoadGraph } from '@core/graph/road_graph';
import { AStarPathfinder } from '@core/graph/astar_pathfinder';
import { RoadType } from '@core/graph/road_types';

describe('RoadGraph & RoadTypes', () => {
  it('debe respetar calles de sentido único (ONE_WAY)', () => {
    const graph = new RoadGraph();
    const pathfinder = new AStarPathfinder();

    // Crear tramo de sentido único de (0,0) a (0,2)
    graph.addRoadSegment(0, 0, 0, 2, 0, 0, RoadType.ONE_WAY_2L);

    const nodeA = graph.getNodeAt(0, 0)!;
    const nodeB = graph.getNodeAt(0, 2)!;

    // Ruta de A -> B permitida
    const pathForward = pathfinder.findPath(graph, nodeA.id, nodeB.id);
    expect(pathForward).not.toBeNull();
    expect(pathForward?.length).toBe(2);

    // Ruta en contra dirección B -> A prohibida
    const pathBackward = pathfinder.findPath(graph, nodeB.id, nodeA.id);
    expect(pathBackward).toBeNull();
  });

  it('debe elegir una autopista rápida frente a una calle lenta aunque sea más larga', () => {
    const graph = new RoadGraph();
    const pathfinder = new AStarPathfinder();

    // Camino A: Calle local directa (0,0) -> (0,10), v = 40 km/h, dist = 10
    graph.addRoadSegment(0, 0, 0, 10, 0, 0, RoadType.LOCAL_2L);

    // Camino B: Autopista con desvío (0,0) -> (3,5) -> (0,10), v = 100 km/h
    // Distancia ~11.6, pero velocidad 100 km/h produce menor tiempo de viaje
    graph.addRoadSegment(0, 0, 3, 5, 0, 0, RoadType.HIGHWAY_4L);
    graph.addRoadSegment(3, 5, 0, 10, 0, 0, RoadType.HIGHWAY_4L);

    const startNode = graph.getNodeAt(0, 0)!;
    const targetNode = graph.getNodeAt(0, 10)!;

    const path = pathfinder.findPath(graph, startNode.id, targetNode.id);
    expect(path).not.toBeNull();
    // Debe seleccionar el nodo intermedio de la autopista (3, 5)
    expect(path?.length).toBe(3);
    const highwayNode = graph.nodes.get(path![1]!)!;
    expect(highwayNode.x).toBe(3);
    expect(highwayNode.z).toBe(5);
  });
});
