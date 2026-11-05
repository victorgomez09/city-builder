import { Vec2 } from '@core/utils/math';

/**
 * Utilidades matemáticas para la generación de curvas Bézier y rotondas.
 */
export class SplineUtils {
  /**
   * Evalúa un punto sobre una curva Bézier cuadrática en el plano horizontal XZ.
   * P(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2,  t ∈ [0, 1]
   */
  public static evaluateQuadraticBezier(
    p0: Vec2,
    p1: Vec2,
    p2: Vec2,
    t: number
  ): Vec2 {
    const oneMinusT = 1 - t;
    const x =
      oneMinusT * oneMinusT * p0.x +
      2 * oneMinusT * t * p1.x +
      t * t * p2.x;
    const y =
      oneMinusT * oneMinusT * p0.y +
      2 * oneMinusT * t * p1.y +
      t * t * p2.y;
    return new Vec2(x, y);
  }

  /**
   * Muestra celdas discretas a lo largo de una curva cuadrática.
   */
  public static sampleBezierCells(
    start: Vec2,
    control: Vec2,
    end: Vec2,
    samples: number = 10
  ): Array<{ x: number; z: number }> {
    const cells: Array<{ x: number; z: number }> = [];
    const visited = new Set<string>();

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const pt = this.evaluateQuadraticBezier(start, control, end, t);
      const gx = Math.round(pt.x);
      const gz = Math.round(pt.y);
      const key = `${gx},${gz}`;

      if (!visited.has(key)) {
        visited.add(key);
        cells.push({ x: gx, z: gz });
      }
    }

    return cells;
  }

  /**
   * Genera los vértices y conexiones de una rotonda circular perfecta alrededor de un centro.
   * 
   * @param center Centro de la rotonda en celdas de cuadrícula
   * @param radiusCells Radio en celdas (ej. 2 o 3)
   * @param segments Cantidad de vértices poligonales (ej. 8 o 12)
   */
  public static generateRoundaboutNodes(
    centerX: number,
    centerZ: number,
    radiusCells: number = 2.5,
    segments: number = 8
  ): Array<{ x: number; z: number }> {
    const nodes: Array<{ x: number; z: number }> = [];

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const gx = Math.round(centerX + Math.cos(angle) * radiusCells);
      const gz = Math.round(centerZ + Math.sin(angle) * radiusCells);
      nodes.push({ x: gx, z: gz });
    }

    return nodes;
  }
}
