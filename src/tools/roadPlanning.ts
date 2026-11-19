/**
 * Vira City — Road Curve Geometry & Lattice Planning (`src/tools/roadPlanning.ts`)
 *
 * Implements octilinear lattice walks, Bresenham line paths, and quadratic Bézier
 * curve sampling for single and dual carriageway roads.
 */
import { C } from '@/core/constants';
import { U } from '@/core/utils';

const T = C.TILE;

export interface Point2D {
  x: number;
  y: number;
}

export interface WorldPoint {
  x: number;
  z: number;
}

export interface RoadStrip {
  tiles: number[];
  dirs: number[];
}

export interface PlannedRoad {
  strips: RoadStrip[];
  curved?: boolean;
  bad?: string;
}

export const isDual = (rt: number): boolean => C.ROADS[rt]?.w === 2;

export function snapPt(p: WorldPoint, dual: boolean): Point2D {
  if (dual) return { x: Math.round(p.x / T), y: Math.round(p.z / T) };
  return { x: Math.floor(p.x / T) + 0.5, y: Math.floor(p.z / T) + 0.5 };
}

export function snapWorld(p: WorldPoint, rt: number): WorldPoint {
  const s = snapPt(p, isDual(rt));
  return { x: s.x * T, z: s.y * T };
}

export function lPath(a: number, b: number, hf?: boolean): number[] {
  const ax = U.tx(a),
    ay = U.ty(a),
    bx = U.tx(b),
    by = U.ty(b);
  const out: number[] = [];
  const horizFirst = hf !== undefined ? hf : Math.abs(bx - ax) >= Math.abs(by - ay);
  let x = ax,
    y = ay;
  out.push(U.idx(x, y));
  const sx = Math.sign(bx - ax),
    sy = Math.sign(by - ay);
  if (horizFirst) {
    while (x !== bx) {
      x += sx;
      out.push(U.idx(x, y));
    }
    while (y !== by) {
      y += sy;
      out.push(U.idx(x, y));
    }
  } else {
    while (y !== by) {
      y += sy;
      out.push(U.idx(x, y));
    }
    while (x !== bx) {
      x += sx;
      out.push(U.idx(x, y));
    }
  }
  return out;
}

export const dirOf = (a: number, b: number): number => {
  const dx = U.tx(b) - U.tx(a),
    dy = U.ty(b) - U.ty(a);
  return dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3;
};

export const step = (i: number, d: number): number =>
  U.idx(U.tx(i) + C.DX[d], U.ty(i) + C.DY[d]);

export function cutLoops(pts: number[][]): number[][] {
  const out: number[][] = [];
  const seenAt = new Map<number, number>();
  for (const p of pts) {
    const k = p[0] * 4096 + p[1];
    if (seenAt.has(k)) {
      const j = seenAt.get(k)!;
      for (let q = j + 1; q < out.length; q++) {
        seenAt.delete(out[q][0] * 4096 + out[q][1]);
      }
      out.length = j + 1;
      continue;
    }
    seenAt.set(k, out.length);
    out.push(p);
  }
  return out;
}

export function latticeL(A: Point2D, B: Point2D, off: number): number[][] {
  const ax = Math.round(A.x - off),
    ay = Math.round(A.y - off),
    bx = Math.round(B.x - off),
    by = Math.round(B.y - off);
  const out: number[][] = [[ax, ay]];
  const hf = Math.abs(bx - ax) >= Math.abs(by - ay);
  let x = ax,
    y = ay;
  const sx = Math.sign(bx - ax),
    sy = Math.sign(by - ay);
  if (hf) {
    while (x !== bx) {
      x += sx;
      out.push([x, y]);
    }
    while (y !== by) {
      y += sy;
      out.push([x, y]);
    }
  } else {
    while (y !== by) {
      y += sy;
      out.push([x, y]);
    }
    while (x !== bx) {
      x += sx;
      out.push([x, y]);
    }
  }
  return out;
}

export function sampleCurve(
  A: Point2D,
  Cp: Point2D,
  B: Point2D,
  s: number
): number[][] {
  const n = 400;
  const cv: number[][] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n,
      u = 1 - t;
    let x = u * u * A.x + 2 * u * t * Cp.x + t * t * B.x,
      y = u * u * A.y + 2 * u * t * Cp.y + t * t * B.y;
    if (s) {
      let tx = 2 * u * (Cp.x - A.x) + 2 * t * (B.x - Cp.x),
        ty = 2 * u * (Cp.y - A.y) + 2 * t * (B.y - Cp.y);
      if (Math.abs(tx) + Math.abs(ty) < 1e-6) {
        tx = B.x - A.x;
        ty = B.y - A.y;
      }
      const l = Math.hypot(tx, ty) || 1,
        k2 = (Math.abs(tx) + Math.abs(ty)) / l;
      x += (-ty / l) * s * k2;
      y += (tx / l) * s * k2;
    }
    cv.push([x, y]);
  }
  if (s) {
    const cum = [0];
    for (let k = 1; k <= n; k++) {
      cum.push(cum[k - 1] + Math.hypot(cv[k][0] - cv[k - 1][0], cv[k][1] - cv[k - 1][1]));
    }
    let a = 0,
      b = n;
    while (a < n && cum[a] < 0.5) a++;
    while (b > a && cum[n] - cum[b] < 0.5) b--;
    return cv.slice(a, b + 1);
  }
  return cv;
}

export function latticeCurve(
  A: Point2D,
  Cp: Point2D,
  B: Point2D,
  off: number
): number[][] {
  return latticeFollow(sampleCurve(A, Cp, B, 0), off);
}

export function latticeFollow(cv: number[][], off: number): number[][] {
  const n = cv.length - 1,
    B = { x: cv[n][0], y: cv[n][1] },
    A = { x: cv[0][0], y: cv[0][1] };
  const end = [Math.round(B.x - off), Math.round(B.y - off)];
  let p = [Math.round(A.x - off), Math.round(A.y - off)];
  const out = [p.slice()];
  let k = 0,
    lastX: boolean | null = null;
  const D = (q: number[], x: number, y: number) => Math.hypot(q[0] - x, q[1] - y);

  for (let guard = 0; guard < 3000; guard++) {
    if (p[0] === end[0] && p[1] === end[1]) break;
    const px = p[0] + off,
      py = p[1] + off;
    while (k < n && D(cv[k + 1], px, py) <= D(cv[k], px, py) + 1e-9) k++;
    let j = k;
    while (j < n && D(cv[j], px, py) < 2.5) j++;
    let dx: number, dy: number;
    if (Math.abs(end[0] - p[0]) + Math.abs(end[1] - p[1]) <= 3 || j >= n) {
      dx = end[0] - p[0];
      dy = end[1] - p[1];
    } else {
      dx = cv[j][0] - px;
      dy = cv[j][1] - py;
    }
    const oct = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    const sx = Math.round(Math.cos((oct * Math.PI) / 4)),
      sy = Math.round(Math.sin((oct * Math.PI) / 4));
    if (dx === 0 && dy === 0) break;
    let stepVec: [number, number];
    if (!sx || !sy) stepVec = [sx, sy];
    else stepVec = lastX ? [0, sy] : [sx, 0];
    if (Math.abs(end[0] - p[0]) + Math.abs(end[1] - p[1]) <= 3) {
      if (stepVec[0] && Math.sign(stepVec[0]) !== Math.sign(end[0] - p[0])) {
        stepVec = [0, Math.sign(end[1] - p[1])];
      } else if (stepVec[1] && Math.sign(stepVec[1]) !== Math.sign(end[1] - p[1])) {
        stepVec = [Math.sign(end[0] - p[0]), 0];
      }
    }
    p = [p[0] + stepVec[0], p[1] + stepVec[1]];
    lastX = stepVec[0] !== 0;
    out.push(p.slice());
  }
  return cutLoops(out);
}

export function offsetStrip(V: number[][], s: number): number[][] {
  const n = V.length,
    D: [number, number][] = [];
  for (let k = 0; k < n - 1; k++) {
    D.push([V[k + 1][0] - V[k][0], V[k + 1][1] - V[k][1]]);
  }
  const rt = (d: [number, number]): [number, number] => [-d[1], d[0]];
  const O: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const a = D[Math.max(0, k - 1)],
      b = D[Math.min(n - 2, k)];
    let o: [number, number];
    if (k === 0) o = rt(b);
    else if (k === n - 1) o = rt(a);
    else if (a[0] === b[0] && a[1] === b[1]) o = rt(a);
    else {
      const ra = rt(a),
        rb = rt(b);
      o = [ra[0] + rb[0], ra[1] + rb[1]];
    }
    O.push([V[k][0] + s * 0.5 * o[0], V[k][1] + s * 0.5 * o[1]]);
  }
  const tiles: number[][] = [];
  for (let k = 0; k < n - 1; k++) {
    const [ax, ay] = O[k],
      [bx, by] = O[k + 1],
      m = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) * 8));
    for (let q = 0; q < m; q++) {
      const t = (q + 0.5) / m,
        x = Math.floor(ax + (bx - ax) * t),
        y = Math.floor(ay + (by - ay) * t);
      const l = tiles[tiles.length - 1];
      if (!l || l[0] !== x || l[1] !== y) tiles.push([x, y]);
    }
  }
  return cutLoops(tiles);
}

export function toStrip(pts: number[][]): RoadStrip | null {
  const tiles: number[] = [];
  for (const [x, y] of pts) {
    if (!U.inWorld(x, y)) return null;
    tiles.push(U.idx(x, y));
  }
  for (let k = 1; k < tiles.length; k++) {
    if (U.dist(tiles[k - 1], tiles[k]) !== 1) return null;
  }
  const dirs = tiles.map((t, k) =>
    k + 1 < tiles.length ? dirOf(t, tiles[k + 1]) : k > 0 ? dirOf(tiles[k - 1], t) : 1
  );
  return { tiles, dirs };
}

export function planRoad(
  rt: number,
  a: WorldPoint,
  b: WorldPoint,
  c?: WorldPoint | null
): PlannedRoad {
  const dual = isDual(rt),
    off = dual ? 0 : 0.5;
  const A = snapPt(a, dual),
    B = snapPt(b, dual);
  let V: number[][];
  if (c) V = latticeCurve(A, { x: c.x / T, y: c.z / T }, B, off);
  else V = latticeL(A, B, off);
  const curved = !!c && V.length > 2;
  if (!dual) {
    const st = toStrip(V);
    return st ? { strips: [st], curved } : { strips: [], bad: 'Outside the map' };
  }
  if (V.length < 2) {
    V = [V[0], [V[0][0] + 1, V[0][1]]];
  }
  let fp: number[][], rp: number[][];
  if (c && V.length > 2) {
    const Cp = { x: c.x / T, y: c.z / T };
    for (const o of [0.5, 0.56, 0.62, 0.7]) {
      fp = latticeFollow(sampleCurve(A, Cp, B, o), 0.5);
      rp = latticeFollow(sampleCurve(A, Cp, B, -o), 0.5).reverse();
      const fs = new Set(fp.map(q => q[0] * 4096 + q[1]));
      if (!rp.some(q => fs.has(q[0] * 4096 + q[1]))) break;
    }
  } else {
    fp = offsetStrip(V, 1);
    rp = offsetStrip(V, -1).reverse();
  }
  const f = toStrip(fp!),
    r = toStrip(rp!);
  if (!f || !r) return { strips: [], bad: 'Outside the map' };
  const used = new Set(f.tiles);
  if (r.tiles.some(t => used.has(t))) {
    return { strips: [f, r], bad: 'Curve is too tight for a dual road' };
  }
  return { strips: [f, r], curved };
}

export function roadStrips(a: number, b: number, rt: number): RoadStrip[] {
  const P = (i: number): WorldPoint =>
    isDual(rt)
      ? { x: U.tx(i) * T, z: U.ty(i) * T }
      : { x: (U.tx(i) + 0.5) * T, z: (U.ty(i) + 0.5) * T };
  return planRoad(rt, P(a), P(b)).strips;
}
