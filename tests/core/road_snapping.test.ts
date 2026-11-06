import { describe, it, expect } from 'vitest';
import { RoadGraph } from '@core/graph/road_graph';
import { RoadType } from '@core/graph/road_types';

describe('RoadGraph Snapping & Edge Splitting (CityRT Mechanics)', () => {
  it('debe encontrar el nodo más cercano dentro de la distancia de tolerancia', () => {
    const graph = new RoadGraph();
    graph.addRoadSegment(10, 10, 20, 10, 0, 0, RoadType.LOCAL_2L);

    // Búsqueda cerca de (10, 10)
    const nodeNear = graph.findClosestNode(10.8, 10.5, 2.0);
    expect(nodeNear).not.toBeNull();
    expect(nodeNear?.x).toBe(10);
    expect(nodeNear?.z).toBe(10);

    // Búsqueda lejos
    const nodeFar = graph.findClosestNode(50, 50, 2.0);
    expect(nodeFar).toBeNull();
  });

  it('debe proyectar ortogonalmente sobre aristas para snapping a carreteras intermedias', () => {
    const graph = new RoadGraph();
    const edge = graph.addRoadSegment(0, 0, 20, 0, 0, 0, RoadType.LOCAL_2L)!;

    // Punto cercano a mitad de arista: (10, 1.2)
    const closest = graph.findClosestEdge(10, 1.2, 2.0);
    expect(closest).not.toBeNull();
    expect(closest?.edge.id).toBe(edge.id);
    expect(closest?.projX).toBeCloseTo(10, 1);
    expect(closest?.projZ).toBeCloseTo(0, 1);
  });

  it('debe dividir una arista existente insertando una nueva intersección (splitEdge)', () => {
    const graph = new RoadGraph();
    const originalEdge = graph.addRoadSegment(0, 0, 20, 0, 0, 0, RoadType.LOCAL_2L)!;
    expect(graph.edges.size).toBe(1);
    expect(graph.nodes.size).toBe(2);

    // Insertar cruce en (10, 0)
    const midNode = graph.splitEdge(originalEdge.id, 10, 0, 1.5);
    expect(midNode).not.toBeNull();
    expect(midNode?.x).toBe(10);
    expect(midNode?.z).toBe(0);
    expect(midNode?.elevation).toBe(1.5);

    // Ahora deben haber 2 aristas resultantes que conectan a través del midNode
    expect(graph.edges.size).toBe(2);
    expect(graph.nodes.size).toBe(3);

    const nodeA = graph.getNodeAt(0, 0)!;
    const nodeB = graph.getNodeAt(20, 0)!;

    expect(nodeA.outNeighbors).toContain(midNode?.id);
    expect(nodeB.outNeighbors).toContain(midNode?.id);
    expect(midNode?.outNeighbors).toContain(nodeA.id);
    expect(midNode?.outNeighbors).toContain(nodeB.id);
  });
});
