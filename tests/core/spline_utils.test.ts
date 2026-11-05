import { describe, it, expect } from 'vitest';
import { SplineUtils } from '@core/graph/spline_utils';
import { Vec2 } from '@core/utils/math';
import { RoadGraph } from '@core/graph/road_graph';
import { RoadType } from '@core/graph/road_types';

describe('SplineUtils (Curved Roads & Roundabouts)', () => {
  it('debe interpolar una curva Bézier cuadrática pasando por start y end', () => {
    const p0 = new Vec2(0, 0);
    const p1 = new Vec2(5, 5); // Punto de control intermedio
    const p2 = new Vec2(10, 0);

    const startPt = SplineUtils.evaluateQuadraticBezier(p0, p1, p2, 0);
    expect(startPt.x).toBeCloseTo(0);
    expect(startPt.y).toBeCloseTo(0);

    const endPt = SplineUtils.evaluateQuadraticBezier(p0, p1, p2, 1);
    expect(endPt.x).toBeCloseTo(10);
    expect(endPt.y).toBeCloseTo(0);

    const midPt = SplineUtils.evaluateQuadraticBezier(p0, p1, p2, 0.5);
    expect(midPt.x).toBeCloseTo(5);
    expect(midPt.y).toBeCloseTo(2.5); // Elevación por curvatura
  });

  it('debe generar un anillo de rotonda continuo y conectado', () => {
    const graph = new RoadGraph();
    const nodes = SplineUtils.generateRoundaboutNodes(10, 10, 3, 8);

    expect(nodes.length).toBe(8);

    // Conectar el anillo en sentido horario de sentido único
    for (let i = 0; i < nodes.length; i++) {
      const nextIdx = (i + 1) % nodes.length;
      const cur = nodes[i]!;
      const nxt = nodes[nextIdx]!;
      graph.addRoadSegment(cur.x, cur.z, nxt.x, nxt.z, 0, 0, RoadType.ONE_WAY_2L);
    }

    expect(graph.edges.size).toBe(8);
    // Cada nodo en la rotonda debe tener exactamente 1 salida y 1 entrada hacia sus vecinos del anillo
    for (const node of graph.nodes.values()) {
      expect(node.outNeighbors.length).toBe(1);
      expect(node.inNeighbors.length).toBe(1);
    }
  });
});
