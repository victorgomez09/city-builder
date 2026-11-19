/**
 * Vira City — Directed A* Pathfinding & Impedance Costs (`src/traffic/pathfinding.ts`)
 *
 * Implements directed graph search with zero-GC generation-tagged memory buffers
 * and min-heap priority queueing.
 */
import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { World } from '@/world/world';

const T = C.TILE;
const W = C.W;
const N = W * W;
const NS = N * 5;

const gS = new Float32Array(NS);
const from_ = new Int32Array(NS);
const seen = new Uint32Array(NS);
const closed = new Uint32Array(NS);
let gen = 1;
const heap = new U.Heap();

const res = { s: 4, c: 0 };

/**
 * Directed A* pathfinding algorithm over the road grid and junction graph.
 */
export function search(
  src: number,
  dst: number,
  step: (cur: number, cd: number, d: number) => { s: number; c: number } | null,
  vmax: number,
  sd?: number | null,
  dd?: number | null
): number[] | null {
  const anyD = dd === undefined || dd === null;
  if (src === dst && (anyD || sd === dd)) return [src];
  gen++;
  if (gen > 4e9) {
    gen = 1;
    seen.fill(0);
    closed.fill(0);
  }
  heap.clear();
  const dx0 = U.tx(dst);
  const dy0 = U.ty(dst);
  const hf = (i: number) => (Math.abs(U.tx(i) - dx0) + Math.abs(U.ty(i) - dy0)) * (T / vmax);
  const s0 = src * 5 + (sd === undefined || sd === null ? 4 : sd);
  gS[s0] = 0;
  seen[s0] = gen;
  from_[s0] = -1;
  heap.push(s0, hf(src));
  let found = -1;
  let it = 0;

  while (heap.size) {
    const cs = heap.pop();
    if (closed[cs] === gen) continue;
    closed[cs] = gen;
    const cur = (cs / 5) | 0;
    const cd = cs - cur * 5;
    if (cur === dst && (anyD || cd === dd) && cs !== s0) {
      found = cs;
      break;
    }
    if (++it > 120000) break;
    for (let d = 0; d < 4; d++) {
      const r = step(cur, cd, d);
      if (r === null) continue;
      const nb = World.neighbor(cur, d);
      const ns = nb * 5 + r.s;
      if (closed[ns] === gen) continue;
      const ng = gS[cs] + r.c;
      if (seen[ns] !== gen || ng < gS[ns]) {
        seen[ns] = gen;
        gS[ns] = ng;
        from_[ns] = cs;
        heap.push(ns, ng + hf(nb));
      }
    }
  }
  if (found < 0) return null;
  const out: number[] = [];
  for (let c = found; c !== -1; c = from_[c]) out.push((c / 5) | 0);
  out.reverse();
  return out;
}

export function carStep(costFn: (i: number) => number, onlyTram?: boolean) {
  return function (cur: number, cd: number, d: number) {
    if (!World.canDrive(cur, d)) return null;
    const nb = World.neighbor(cur, d);
    if (onlyTram && !C.ROADS[World.road[nb]]?.tram) return null;
    const cc = World.jcl[cur];
    const nc = World.jcl[nb];
    if (cc < 0 && cd < 4 && d === (cd + 2) % 4 && World.degree(cur) > 1) return null;
    let s = d;
    let extra = 0;
    if (cc >= 0 && nc === cc) s = cd;
    else if (nc >= 0) {
      s = d;
      const cl = World.clusters[nc];
      if (cl.ctrl === 'lights') extra = 4;
      else if (cl.ctrl === 'stop' || cl.ctrl === 'allstop') extra = 3;
      else if (cl.ctrl === 'round') extra = 1;
    }
    if (cc >= 0 && nc !== cc && cd < 4) {
      const cl = World.clusters[cc];
      const t = World.relTurn(cd, d);
      if (!(cl.mask[cd] & t)) return null;
      if (t === 4) extra += 0.6;
      else if (t === 8) extra += 8;
    }
    res.s = s;
    res.c = costFn(nb) + extra;
    return res;
  };
}

export function roadCostWithLoad(i: number, trafficLoad: Float32Array): number {
  const R = C.ROADS[World.road[i]];
  if (!R) return 1;
  const lanes = Math.max(1, R.fwd);
  const ratio = trafficLoad[i] / (R.cap * (R.w === 2 ? 1 : 1));
  const cong = 1 + 4 * Math.max(0, ratio - 0.35) * Math.max(0, ratio - 0.35);
  let c = (T / R.speed) * cong;
  if (lanes === 1 && R.grp === 'small') c *= 1.06;
  const did = World.district ? World.district[i] : 0;
  if (did) {
    const dist = World.districts.get(did);
    if (dist?.policies.heavyTrafficBan && R.grp === 'small') {
      c += 8;
    }
  }
  return c;
}

export function tileBikeScore(i: number): number {
  let best = 0;
  if (World.walkRoad(i)) best = C.bikeScore(C.ROADS[World.road[i]]!);
  for (let q = 0; q < 4; q++) {
    const k = World.pcell[World.cellOf(i, q)];
    if (k && C.PATHS[k]) best = Math.max(best, C.PATHS[k]!.bike);
  }
  const did = World.district ? World.district[i] : 0;
  if (did) {
    const dist = World.districts.get(did);
    if (dist?.policies.bikeCity) {
      best = Math.min(1.0, best + 0.45);
    }
  }
  return best;
}

export function softStep(bike: boolean) {
  return function (cur: number, _cd: number, d: number) {
    if (World.softPass(cur, d) < 0) return null;
    const nb = World.neighbor(cur, d);
    res.s = 4;
    res.c = bike ? (T / 5) * (1 + 2.2 * (1 - tileBikeScore(nb))) : T / 1.4;
    return res;
  };
}
