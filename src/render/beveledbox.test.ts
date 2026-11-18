import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildBeveledBoxGeometry } from './beveledbox';

describe('buildBeveledBoxGeometry', () => {
  it('creates geometry with unit bounds [-0.5, 0.5]', () => {
    const geom = buildBeveledBoxGeometry(0.025);
    geom.computeBoundingBox();
    const box = geom.boundingBox!;

    expect(box.min.x).toBeCloseTo(-0.5, 4);
    expect(box.min.y).toBeCloseTo(-0.5, 4);
    expect(box.min.z).toBeCloseTo(-0.5, 4);
    expect(box.max.x).toBeCloseTo(0.5, 4);
    expect(box.max.y).toBeCloseTo(0.5, 4);
    expect(box.max.z).toBeCloseTo(0.5, 4);
  });

  it('contains expected vertex count (96) and triangle index count (132)', () => {
    const geom = buildBeveledBoxGeometry(0.025);
    const pos = geom.getAttribute('position');
    const index = geom.getIndex();

    // 6 faces * 4 + 12 bevels * 4 + 8 corners * 3 = 24 + 48 + 24 = 96 vertices
    expect(pos.count).toBe(96);
    // 6 faces * 2 + 12 bevels * 2 + 8 corners * 1 = 12 + 24 + 8 = 44 triangles = 132 indices
    expect(index).not.toBeNull();
    expect(index!.count).toBe(132);
  });

  it('has outward facing normals on all vertices and triangles', () => {
    const geom = buildBeveledBoxGeometry(0.025);
    const pos = geom.getAttribute('position');
    const norm = geom.getAttribute('normal');
    const index = geom.getIndex()!;

    // Check vertex normals point outwards
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      const nx = norm.getX(i);
      const ny = norm.getY(i);
      const nz = norm.getZ(i);

      // Normal length should be 1
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      expect(len).toBeCloseTo(1.0, 3);

      // Dot product with position from center should be positive (points outward)
      const dot = px * nx + py * ny + pz * nz;
      expect(dot).toBeGreaterThan(0);
    }

    // Check triangle winding: (p1 - p0) x (p2 - p0) dots positively with vertex normals
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const triNorm = new THREE.Vector3();
    const vNorm = new THREE.Vector3();

    for (let i = 0; i < index.count; i += 3) {
      const i0 = index.getX(i);
      const i1 = index.getX(i + 1);
      const i2 = index.getX(i + 2);

      p0.fromBufferAttribute(pos, i0);
      p1.fromBufferAttribute(pos, i1);
      p2.fromBufferAttribute(pos, i2);
      vNorm.fromBufferAttribute(norm, i0);

      e1.subVectors(p1, p0);
      e2.subVectors(p2, p0);
      triNorm.crossVectors(e1, e2);

      expect(triNorm.dot(vNorm)).toBeGreaterThan(0);
    }
  });

  it('clamps bevel values within a safe range', () => {
    const tiny = buildBeveledBoxGeometry(0.0001);
    const huge = buildBeveledBoxGeometry(0.99);

    expect(tiny.getAttribute('position').count).toBe(96);
    expect(huge.getAttribute('position').count).toBe(96);
  });
});
