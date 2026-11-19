/**
 * Open Skylines — Vehicle & Soft-Agent Trajectory Calculus (`src/traffic/trajectories.ts`)
 *
 * Implements Bezier spline generation, lane-boundary path tracking, turn evaluation,
 * and sidewalk/cycleway offset coordinates for vehicles and pedestrians.
 */

import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { World } from '@/world/world';
import { Vehicle, SoftAgent } from '@/types';

const T = C.TILE;
const HALF = T / 4;

export interface Bezier2D {
  ax: number;
  az: number;
  cx: number;
  cz: number;
  bx: number;
  bz: number;
  len: number;
}

export const dirOf = (dx: number, dz: number): number => (dz < 0 ? 0 : dx > 0 ? 1 : dz > 0 ? 2 : 3);
export const dirBetween = (a: number, b: number): number => dirOf(U.tx(b) - U.tx(a), U.ty(b) - U.ty(a));

export function at(v: Vehicle, k: number): number {
  const n = v.path.length;
  if (v.loop) return v.path[((k % n) + n) % n];
  return k >= 0 && k < n ? v.path[k] : -1;
}

export function boundaryLanes(a: number, b: number, d: number): number[] {
  const t = World.jcl[b] >= 0 && World.jcl[a] < 0 ? a : b;
  return World.lanesToward(t, d);
}

export function turnAt(v: Vehicle, k: number): number {
  const first = at(v, k);
  if (first < 0) return 0;
  const cl = World.jcl[first];
  const din = dirBetween(at(v, k - 1), first);
  let j = k;
  while (at(v, j + 1) >= 0 && World.jcl[at(v, j + 1)] === cl && j - k < 6) j++;
  const last = at(v, j),
    out = at(v, j + 1);
  if (out < 0) return 1;
  return World.relTurn(din, dirBetween(last, out));
}

export function setupSeg(v: Vehicle): void {
  const cur = at(v, v.seg),
    prev = at(v, v.seg - 1),
    next = at(v, v.seg + 1);
  v.cur = cur;
  v.prev = prev;
  v.next = next;
  const cx = (U.tx(cur) + 0.5) * T,
    cz = (U.ty(cur) + 0.5) * T;
  let ix = 0,
    iz = 0,
    ox = 0,
    oz = 0;
  if (prev >= 0) {
    ix = Math.sign(U.tx(cur) - U.tx(prev));
    iz = Math.sign(U.ty(cur) - U.ty(prev));
  }
  if (next >= 0) {
    ox = Math.sign(U.tx(next) - U.tx(cur));
    oz = Math.sign(U.ty(next) - U.ty(cur));
  }
  if (prev < 0 && next < 0) {
    ix = ox = 1;
  } else if (prev < 0) {
    ix = ox;
    iz = oz;
  } else if (next < 0) {
    ox = ix;
    oz = iz;
  }
  v.din = dirOf(ix, iz);
  v.dout = dirOf(ox, oz);
  if (World.jcl[cur] >= 0 && (prev < 0 || World.jcl[prev] !== World.jcl[cur])) {
    v.entryDir = prev < 0 ? 4 : v.din;
  }
  const lin = prev >= 0 ? boundaryLanes(prev, cur, v.din) : World.lanesToward(cur, v.dout);
  const laneIn = Math.min(v.lane, lin.length - 1);

  let lout: number[], laneOut: number;
  if (next >= 0) {
    lout = boundaryLanes(cur, next, v.dout);
    const nOut = lout.length;
    const curJ = World.jcl[cur],
      nextJ = World.jcl[next],
      nnT = at(v, v.seg + 2);
    laneOut = Math.min(laneIn, nOut - 1);
    if (nextJ < 0 && nnT >= 0 && World.jcl[nnT] >= 0) {
      const cl = World.clusters[World.jcl[nnT]];
      const masks = cl?.cfg.lanes[next * 4 + dirBetween(next, nnT)];
      const turn = turnAt(v, v.seg + 2);
      v.nextTurn = turn;
      if (masks) {
        let best = -1,
          bd = 99;
        for (let k = 0; k < Math.min(masks.length, nOut); k++) {
          if (masks[k] & turn) {
            const dd = Math.abs(k - laneIn) + (k === v.pref ? -0.1 : 0);
            if (dd < bd) {
              bd = dd;
              best = k;
            }
          }
        }
        if (best >= 0) laneOut = best;
      } else if (nOut > 1) {
        laneOut = turn === 2 ? 0 : turn === 4 ? nOut - 1 : laneOut;
      }
    } else if (curJ >= 0 && nextJ < 0) {
      const t = World.relTurn(v.entryDir < 4 ? v.entryDir : v.din, v.dout);
      if (t === 2) laneOut = 0;
      else if (t === 4) laneOut = nOut - 1;
      else laneOut = Math.min(v.lane, nOut - 1);
    } else if (curJ < 0 && nextJ < 0 && nOut > 1 && Math.random() < 0.15) {
      laneOut = Math.min(v.pref, nOut - 1);
    }
  } else {
    lout = lin;
    laneOut = laneIn;
  }
  v.laneIn = laneIn;
  v.laneOut = laneOut;
  const offI = lin[laneIn],
    offO = lout[laneOut];
  v.lw = (C.ROADS[World.road[cur]] || C.ROADS[1])!.L!.lw;
  const rix = -iz,
    riz = ix,
    rox = -oz,
    roz = ox;
  if (prev >= 0) {
    v.ex = cx - (ix * T) / 2 + rix * offI;
    v.ez = cz - (iz * T) / 2 + riz * offI;
  } else {
    v.ex = cx + rix * offI;
    v.ez = cz + riz * offI;
  }
  if (next >= 0) {
    v.xx = cx + (ox * T) / 2 + rox * offO;
    v.xz = cz + (oz * T) / 2 + roz * offO;
  } else {
    v.xx = cx + rix * offO + ix * 2;
    v.xz = cz + riz * offO + iz * 2;
  }
  const cl = World.jcl[cur] >= 0 ? World.clusters[World.jcl[cur]] : null;
  const round = cl && cl.ctrl === 'round' && cl.tiles.length === 1;
  if (ix === ox && iz === oz) {
    v.cx = (v.ex + v.xx) / 2;
    v.cz = (v.ez + v.xz) / 2;
    v.turn = 0;
    if (round) {
      v.cx = cx + rix * 3.4;
      v.cz = cz + riz * 3.4;
      v.turn = 1;
    }
  } else if (ix === -ox && iz === -oz) {
    v.cx = cx + ix * T * 0.4;
    v.cz = cz + iz * T * 0.4;
    v.turn = 2;
  } else {
    v.cx = cx + rix * offI + rox * offO;
    v.cz = cz + riz * offI + roz * offO;
    v.turn = 1;
    if (round) {
      const right = (ox === -riz && oz === rix) || (rox === -ix && roz === -iz);
      if (!right) {
        v.cx = cx + (rix + ix) * 2.6;
        v.cz = cz + (riz + iz) * 2.6;
      }
    }
  }
  if (!cl && prev >= 0 && next >= 0 && v.turn !== 2 && World.isBent(cur)) {
    const q = World.bendSeg(cur, v.din, v.dout, offI, offO);
    v.ex = q[0];
    v.ez = q[1];
    v.cx = q[2];
    v.cz = q[3];
    v.xx = q[4];
    v.xz = q[5];
  }
  const a = Math.hypot(v.cx - v.ex, v.cz - v.ez),
    b = Math.hypot(v.xx - v.cx, v.xz - v.cz),
    c = Math.hypot(v.xx - v.ex, v.xz - v.ez);
  v.len = Math.max(0.5, (a + b + c) / 2);
  const R = C.ROADS[World.road[cur]] || C.ROADS[1]!;
  v.vmax =
    (v.kind === 'tram' ? Math.min(R.speed, 13) : R.speed) *
    C.VEH_SPEED *
    (v.turn ? 0.55 : 1) *
    v.drv *
    (round ? 0.75 : 1);
  v.deg = next >= 0 ? World.degree(next) : 0;
  v.jNext = next >= 0 && World.jcl[next] >= 0 && World.jcl[cur] !== World.jcl[next] ? World.jcl[next] : -1;
  v.apKey = v.jNext >= 0 ? cur * 4 + v.dout : -1;
  v.stopDone = v.jNext >= 0 ? (v.stopDone === v.jNext ? v.stopDone : -1) : v.stopDone;
}

export function evalPos(v: Vehicle, out: number[]): void {
  const t = v.t,
    u = 1 - t;
  out[0] = u * u * v.ex + 2 * u * t * v.cx + t * t * v.xx;
  out[1] = u * u * v.ez + 2 * u * t * v.cz + t * t * v.xz;
  const dx = 2 * u * (v.cx - v.ex) + 2 * t * (v.xx - v.cx);
  const dz = 2 * u * (v.cz - v.ez) + 2 * t * (v.xz - v.cz);
  const l = Math.hypot(dx, dz) || 1;
  out[2] = dx / l;
  out[3] = dz / l;
}

export function curve(ax: number, az: number, cx: number, cz: number, bx: number, bz: number): Bezier2D {
  return {
    ax,
    az,
    cx,
    cz,
    bx,
    bz,
    len: Math.max(0.5, Math.hypot(cx - ax, cz - az) + Math.hypot(bx - cx, bz - cz)),
  };
}

export function evalCurve(c: Bezier2D, t: number, out: number[]): void {
  const u = 1 - t;
  out[0] = u * u * c.ax + 2 * u * t * c.cx + t * t * c.bx;
  out[1] = u * u * c.az + 2 * u * t * c.cz + t * t * c.bz;
  const dx = 2 * u * (c.cx - c.ax) + 2 * t * (c.bx - c.cx),
    dz = 2 * u * (c.cz - c.az) + 2 * t * (c.bz - c.cz),
    l = Math.hypot(dx, dz) || 1;
  out[2] = dx / l;
  out[3] = dz / l;
}

export function softOff(a: SoftAgent, i: number, d: number): number {
  const R = C.ROADS[World.road[i]];
  if (!R) return 2;
  if (a.kind === 'ped') return R.L!.walkOff! * (R.L!.pair ? 1 : a.side);
  if (R.bike) return R.L!.bikeOff!;
  const ln = World.lanesToward(i, d);
  return ln[0] + 0.9;
}

export function edgePoint(a: SoftAgent, A: number, B: number, out: number[]): void {
  const d = dirBetween(A, B),
    fx = C.DX[d],
    fz = C.DY[d];
  const bx = (U.tx(A) + 0.5) * T + (fx * T) / 2,
    bz = (U.ty(A) + 0.5) * T + (fz * T) / 2;
  const rA = World.walkRoad(A),
    rB = World.walkRoad(B);
  if (rA && rB) {
    const o = softOff(a, B, d);
    out[0] = bx - fz * o;
    out[1] = bz + fx * o;
    return;
  }
  let best: number | null = null,
    bs = -1;
  const cells = World.edgeCells(A, d);
  for (let k = 0; k < 2; k++) {
    const [ca, cb] = cells[k];
    const pa = World.pcell[ca],
      pb = World.pcell[cb];
    if (!((pa || rA) && (pb || rB))) continue;
    const sc = (pa ? 1 : 0) + (pb ? 1 : 0);
    if (sc > bs) {
      bs = sc;
      best = k;
    }
  }
  if (best === null) best = 0;
  const lat = (best === 0 ? -1 : 1) * HALF;
  if (fx !== 0) {
    out[0] = bx;
    out[1] = (U.ty(A) + 0.5) * T + lat;
  } else {
    out[0] = (U.tx(A) + 0.5) * T + lat;
    out[1] = bz;
  }
}

export function tilePoint(a: SoftAgent, i: number, d: number, out: number[]): void {
  const cx = (U.tx(i) + 0.5) * T,
    cz = (U.ty(i) + 0.5) * T;
  if (World.walkRoad(i)) {
    const o = softOff(a, i, d);
    out[0] = cx - C.DY[d] * o;
    out[1] = cz + C.DX[d] * o;
    return;
  }
  for (let q = 0; q < 4; q++) {
    if (World.pcell[World.cellOf(i, q)]) {
      out[0] = cx + (q & 1 ? HALF : -HALF);
      out[1] = cz + (q >> 1 ? HALF : -HALF);
      return;
    }
  }
  out[0] = cx;
  out[1] = cz;
}

const ep = [0, 0];
export function setupSoft(a: SoftAgent): void {
  const n = a.path.length,
    cur = a.path[a.seg],
    prev = a.seg > 0 ? a.path[a.seg - 1] : -1,
    next = a.seg + 1 < n ? a.path[a.seg + 1] : -1;
  const din = prev >= 0 ? dirBetween(prev, cur) : next >= 0 ? dirBetween(cur, next) : 1;
  const dout = next >= 0 ? dirBetween(cur, next) : din;
  if (prev >= 0) edgePoint(a, prev, cur, ep);
  else tilePoint(a, cur, dout, ep);
  a.ex = ep[0];
  a.ez = ep[1];
  if (next >= 0) edgePoint(a, cur, next, ep);
  else tilePoint(a, cur, din, ep);
  a.xx = ep[0];
  a.xz = ep[1];
  if (din === dout || din === (dout + 2) % 4) {
    a.cx = (a.ex + a.xx) / 2;
    a.cz = (a.ez + a.xz) / 2;
  } else if (din % 2 === 1) {
    a.cx = a.xx;
    a.cz = a.ez;
  } else {
    a.cx = a.ex;
    a.cz = a.xz;
  }
  a.len = Math.max(0.5, Math.hypot(a.cx - a.ex, a.cz - a.ez) + Math.hypot(a.xx - a.cx, a.xz - a.cz));
}
