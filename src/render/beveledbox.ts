/**
 * Beveled Box Geometry Generator.
 *
 * Produces a unit-scale box with chamfered edge bevels and corner facets
 * spanning [-0.5, 0.5] along X, Y, and Z.
 *
 * Outward-facing 45-degree edge normals catch crisp, razor-sharp specular highlights
 * along architectural silhouettes and roof eaves under directional sunlight and sky fill,
 * eliminating the flat, CG-sharp computer look without heavy triangle subdivisions.
 *
 * Rules:
 *  - [R-render-004] Shared instanced geometry under strict triangle budget (44 tris total).
 *  - [R-render-007] Transform variation only; identical topology shared across all instances.
 */

import * as THREE from 'three';

/**
 * Builds a unit box with edge bevels of width `bevel` (default 0.025, ~10-25cm in world space).
 * Maintains standard BoxGeometry UV conventions on the 6 primary faces.
 */
export function buildBeveledBoxGeometry(bevel = 0.025): THREE.BufferGeometry {
  const h = 0.5;
  const b = Math.min(0.2, Math.max(0.005, bevel));
  const i = h - b;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  function addQuad(
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    n: [number, number, number],
    uv0: [number, number],
    uv1: [number, number],
    uv2: [number, number],
    uv3: [number, number],
  ): void {
    const base = positions.length / 3;
    // Ensure outward winding relative to normal n
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    const dot = cx * n[0] + cy * n[1] + cz * n[2];

    if (dot >= 0) {
      positions.push(...p0, ...p1, ...p2, ...p3);
      normals.push(...n, ...n, ...n, ...n);
      uvs.push(...uv0, ...uv1, ...uv2, ...uv3);
    } else {
      positions.push(...p0, ...p3, ...p2, ...p1);
      normals.push(...n, ...n, ...n, ...n);
      uvs.push(...uv0, ...uv3, ...uv2, ...uv1);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  function addTriangle(
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    n: [number, number, number],
    uv0: [number, number],
    uv1: [number, number],
    uv2: [number, number],
  ): void {
    const base = positions.length / 3;
    // Ensure outward winding
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    const dot = cx * n[0] + cy * n[1] + cz * n[2];

    if (dot >= 0) {
      positions.push(...p0, ...p1, ...p2);
      normals.push(...n, ...n, ...n);
      uvs.push(...uv0, ...uv1, ...uv2);
    } else {
      positions.push(...p0, ...p2, ...p1);
      normals.push(...n, ...n, ...n);
      uvs.push(...uv0, ...uv2, ...uv1);
    }
    indices.push(base, base + 1, base + 2);
  }

  const uLo = b / (2 * h);
  const uHi = 1.0 - uLo;

  // 1. Front Face (+Z)
  addQuad(
    [-i, -i, h], [i, -i, h], [i, i, h], [-i, i, h],
    [0, 0, 1],
    [uLo, uLo], [uHi, uLo], [uHi, uHi], [uLo, uHi],
  );

  // 2. Back Face (-Z)
  addQuad(
    [i, -i, -h], [-i, -i, -h], [-i, i, -h], [i, i, -h],
    [0, 0, -1],
    [uLo, uLo], [uHi, uLo], [uHi, uHi], [uLo, uHi],
  );

  // 3. Right Face (+X)
  addQuad(
    [h, -i, i], [h, -i, -i], [h, i, -i], [h, i, i],
    [1, 0, 0],
    [uLo, uLo], [uHi, uLo], [uHi, uHi], [uLo, uHi],
  );

  // 4. Left Face (-X)
  addQuad(
    [-h, -i, -i], [-h, -i, i], [-h, i, i], [-h, i, -i],
    [-1, 0, 0],
    [uLo, uLo], [uHi, uLo], [uHi, uHi], [uLo, uHi],
  );

  // 5. Top Face (+Y)
  addQuad(
    [-i, h, -i], [i, h, -i], [i, h, i], [-i, h, i],
    [0, 1, 0],
    [uLo, uLo], [uHi, uLo], [uHi, uHi], [uLo, uHi],
  );

  // 6. Bottom Face (-Y)
  addQuad(
    [-i, -h, i], [i, -h, i], [i, -h, -i], [-i, -h, -i],
    [0, -1, 0],
    [uLo, uLo], [uHi, uLo], [uHi, uHi], [uLo, uHi],
  );

  const N45 = Math.SQRT1_2;

  // 12 Edge Bevels
  // Top edges
  addQuad([-i, h, i], [i, h, i], [i, i, h], [-i, i, h], [0, N45, N45], [0, 1], [1, 1], [1, 1], [0, 1]);
  addQuad([i, h, -i], [-i, h, -i], [-i, i, -h], [i, i, -h], [0, N45, -N45], [0, 1], [1, 1], [1, 1], [0, 1]);
  addQuad([i, h, i], [i, h, -i], [h, i, -i], [h, i, i], [N45, N45, 0], [1, 0], [1, 1], [1, 1], [1, 0]);
  addQuad([-i, h, -i], [-i, h, i], [-h, i, i], [-h, i, -i], [-N45, N45, 0], [0, 1], [0, 0], [0, 0], [0, 1]);

  // Bottom edges
  addQuad([i, -h, i], [-i, -h, i], [-i, -i, h], [i, -i, h], [0, -N45, N45], [1, 0], [0, 0], [0, 0], [1, 0]);
  addQuad([-i, -h, -i], [i, -h, -i], [i, -i, -h], [-i, -i, -h], [0, -N45, -N45], [0, 0], [1, 0], [1, 0], [0, 0]);
  addQuad([i, -h, -i], [i, -h, i], [h, -i, i], [h, -i, -i], [N45, -N45, 0], [1, 1], [1, 0], [1, 0], [1, 1]);
  addQuad([-i, -h, i], [-i, -h, -i], [-h, -i, -i], [-h, -i, i], [-N45, -N45, 0], [0, 0], [0, 1], [0, 1], [0, 0]);

  // Vertical corner edges
  addQuad([i, -i, h], [h, -i, i], [h, i, i], [i, i, h], [N45, 0, N45], [1, 0], [1, 0], [1, 1], [1, 1]);
  addQuad([h, -i, -i], [i, -i, -h], [i, i, -h], [h, i, -i], [N45, 0, -N45], [1, 0], [1, 0], [1, 1], [1, 1]);
  addQuad([-i, -i, -h], [-h, -i, -i], [-h, i, -i], [-i, i, -h], [-N45, 0, -N45], [0, 0], [0, 0], [0, 1], [0, 1]);
  addQuad([-h, -i, i], [-i, -i, h], [-i, i, h], [-h, i, i], [-N45, 0, N45], [0, 0], [0, 0], [0, 1], [0, 1]);

  const N3 = 1 / Math.sqrt(3);

  // 8 Corner Triangles
  addTriangle([i, h, i], [h, i, i], [i, i, h], [N3, N3, N3], [1, 1], [1, 1], [1, 1]);
  addTriangle([i, h, -i], [i, i, -h], [h, i, -i], [N3, N3, -N3], [1, 1], [1, 1], [1, 1]);
  addTriangle([-i, h, -i], [-h, i, -i], [-i, i, -h], [-N3, N3, -N3], [0, 1], [0, 1], [0, 1]);
  addTriangle([-i, h, i], [-i, i, h], [-h, i, i], [-N3, N3, N3], [0, 1], [0, 1], [0, 1]);

  addTriangle([i, -h, i], [i, -i, h], [h, -i, i], [N3, -N3, N3], [1, 0], [1, 0], [1, 0]);
  addTriangle([i, -h, -i], [h, -i, -i], [i, -i, -h], [N3, -N3, -N3], [1, 0], [1, 0], [1, 0]);
  addTriangle([-i, -h, -i], [-i, -i, -h], [-h, -i, -i], [-N3, -N3, -N3], [0, 0], [0, 0], [0, 0]);
  addTriangle([-i, -h, i], [-h, -i, i], [-i, -i, h], [-N3, -N3, N3], [0, 0], [0, 0], [0, 0]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  return geometry;
}
