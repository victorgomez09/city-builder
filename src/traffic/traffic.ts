/**
 * Open Skylines — Vehicle & Traffic Simulation Engine (`src/traffic/traffic.ts`)
 *
 * Simulates cars, public transit buses, streetcars, freight trucks, bikes, and pedestrians.
 * Manages pathfinding requests, road speed limits, vehicle following, and congestion dynamics.
 */

import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { World } from '@/world/world';
import {
  JunctionCluster,
  Vehicle,
  SoftAgent,
  Building,
  VehicleSpawnRequest,
  ParkSpot,
} from '@/types';
import {
  search,
  carStep,
  roadCostWithLoad,
  tileBikeScore,
  softStep,
} from './pathfinding';
import {
  setupSeg,
  evalPos,
  boundaryLanes,
  setupSoft,
  curve,
  evalCurve,
  dirBetween,
  at,
} from './trajectories';
import {
  updateSignals,
  clusterCount,
  isStopFor,
  signalState,
  spawnBusy,
  resetSpawnBusyCache,
} from './signals';
import {
  startVisit,
  nextWander,
  beginActivity,
  stepActivity,
  BALL_COL,
} from './visitorActivities';

const T = C.TILE;
const W = C.W;
const N = W * W;

const pathCache = new Map<string, { p: number[] | null; t: number }>();
let cacheVer = -1;

const roadCost = (i: number): number => roadCostWithLoad(i, Traffic.load);
const staticCost = (i: number) => T / (C.ROADS[World.road[i]]?.speed || 12);
const stepLive = carStep(roadCost);
const stepStatic = carStep(staticCost);
const stepTram = carStep(staticCost, true);
const stepBike = softStep(true);
const stepWalk = softStep(false);

const LEN: Record<string, number> = {
  car: 4.4,
  suv: 4.8,
  van: 5.8,
  truck: 7.4,
  bus: 10.6,
  tram: 14,
  police: 4.4,
  ambulance: 5.8,
  fire: 7.4,
  garbage: 7.4,
};

const head = new Int32Array(N).fill(-1);
const touched: number[] = [];
const tmp = [0, 0, 0, 0];

let BIKE_COLS: number[][] = [[1, 1, 1]];
let PED_COLS: number[][] = [[1, 1, 1]];
const ballPos: number[] = [];

export const Traffic = {
  load: new Float32Array(N),
  vehicles: [] as Vehicle[],
  soft: [] as SoftAgent[],
  queue: [] as (VehicleSpawnRequest & { tries?: number })[],
  stats: { active: 0, stuck: 0, flow: 1, trips: 0, bikes: 0, peds: 0 },
  mode: { car: 0, transit: 0, bike: 0, walk: 0 },
  time: 0,
  nextId: 0,
  _setup: setupSeg,
  evalPos,
  boundaryLanes,
  isStopFor,
  signalState,

  findPath(src: number, dst: number, isStatic?: boolean): number[] | null {
    if (!World.road[src] || !World.road[dst]) return null;
    if (cacheVer !== World.roadVer) {
      pathCache.clear();
      cacheVer = World.roadVer;
    }
    const key = 'c' + (src * N + dst);
    const hit = pathCache.get(key);
    if (hit && (isStatic || Traffic.time - hit.t < 25)) return hit.p;
    const p = search(src, dst, isStatic ? stepStatic : stepLive, 30);
    if (pathCache.size > 5000) pathCache.clear();
    pathCache.set(key, { p, t: Traffic.time });
    return p;
  },

  findPathDir(
    src: number,
    sd: number | null,
    dst: number,
    dd: number | null,
    tram?: boolean
  ): number[] | null {
    if (!World.road[src] || !World.road[dst]) return null;
    if (cacheVer !== World.roadVer) {
      pathCache.clear();
      cacheVer = World.roadVer;
    }
    const key = (tram ? 't' : 'd') + (src * N + dst) + ':' + sd + ':' + dd;
    if (pathCache.has(key)) return pathCache.get(key)!.p;
    const p = search(src, dst, tram ? stepTram : stepStatic, tram ? 12 : 30, sd, dd);
    if (pathCache.size > 5000) pathCache.clear();
    pathCache.set(key, { p, t: Traffic.time });
    return p;
  },

  findTramPath(src: number, dst: number): number[] | null {
    if (!World.road[src] || !World.road[dst]) return null;
    return search(src, dst, stepTram, 12);
  },

  findSoftPath(src: number, dst: number, bike: boolean): number[] | null {
    if (!World.road[src] || !World.road[dst]) return null;
    if (cacheVer !== World.roadVer) {
      pathCache.clear();
      cacheVer = World.roadVer;
    }
    const key = (bike ? 'b' : 'w') + (src * N + dst);
    const hit = pathCache.get(key);
    if (hit) return hit.p;
    const p = search(src, dst, bike ? stepBike : stepWalk, bike ? 5 : 1.4);
    if (pathCache.size > 5000) pathCache.clear();
    pathCache.set(key, { p, t: Traffic.time });
    return p;
  },

  bikeSafety(path: number[]): number {
    if (!path || !path.length) return 0;
    let s = 0;
    for (const i of path) s += tileBikeScore(i);
    return s / path.length;
  },

  findRailPath(src: number, dst: number): number[] | null {
    return search(
      src,
      dst,
      (_cur, _cd, d) => {
        const nb = World.neighbor(_cur, d);
        if (nb < 0 || !World.rail[nb]) return null;
        return { s: 4, c: 1 };
      },
      1e9
    );
  },

  doorOf(b: Building): { road: number; door: [number, number]; curb: [number, number]; ux: number; uz: number } {
    if (b._door && b._door.road === b.road && b._door.door && b._door.curb) {
      return b._door as { road: number; door: [number, number]; curb: [number, number]; ux: number; uz: number };
    }
    const CB = (window as any).CB;
    let adj = -1;
    if (CB && CB.Sim) {
      for (const t of CB.Sim.lotTiles(b)) {
        for (let d = 0; d < 4; d++) {
          if (World.neighbor(t, d) === b.road) {
            adj = t;
            break;
          }
        }
      }
    }
    const rx = (U.tx(b.road) + 0.5) * T,
      rz = (U.ty(b.road) + 0.5) * T;
    let ux = 0,
      uz = 1;
    if (adj >= 0) {
      ux = Math.sign(U.tx(adj) - U.tx(b.road));
      uz = Math.sign(U.ty(adj) - U.ty(b.road));
    }
    const ex = rx + (ux * T) / 2,
      ez = rz + (uz * T) / 2;
    b._door = {
      road: b.road,
      door: [ex + ux * 3.2, ez + uz * 3.2],
      curb: [ex - ux * 1.6, ez - uz * 1.6],
      ux,
      uz,
    };
    return b._door as { road: number; door: [number, number]; curb: [number, number]; ux: number; uz: number };
  },

  spawn(o: Partial<Vehicle>): Vehicle | null {
    if (!o.path || o.path.length < 1) return null;
    const CB = (window as any).CB;
    if (o.kind === 'car' || o.kind === 'suv') {
      const maxCars = CB?.Gfx?.settings?.cars || 500;
      if (Traffic.carCount() >= maxCars) return null;
    }
    const v: Vehicle = {
      kind: o.kind || 'car',
      path: o.path,
      seg: 0,
      t: 0,
      speed: 0,
      loop: !!o.loop,
      lane: 0,
      pref: Math.random() < 0.5 ? 0 : 1,
      drv: 0.88 + Math.random() * 0.24,
      col: o.col || null,
      purpose: o.purpose || '',
      data: o.data || null,
      onArrive: o.onArrive || null,
      L: LEN[o.kind || 'car'] || 4.5,
      stuck: 0,
      wait: 0,
      dwell: 0,
      born: Traffic.time,
      x: 0,
      z: 0,
      hx: 1,
      hz: 0,
      id: ++Traffic.nextId,
      entryDir: 4,
      stopDone: -1,
      waitStop: 0,
      lw: 3,
      toB: o.toB || null,
    };
    setupSeg(v);
    v.t = 0;
    if (o.fromB && CB?.Sim?.buildings.has(o.fromB.id)) {
      const D = Traffic.doorOf(o.fromB);
      v.ph = {
        c: curve(D.door[0], D.door[1], D.curb[0], D.curb[1], v.ex, v.ez),
        t: 0,
        out: true,
      };
      evalCurve(v.ph.c, 0, tmp);
      v.x = tmp[0];
      v.z = tmp[1];
      v.hx = tmp[2];
      v.hz = tmp[3];
    }
    Traffic.vehicles.push(v);
    return v;
  },

  carCount(): number {
    let carN = 0;
    for (const v of Traffic.vehicles) {
      if (v.kind === 'car' || v.kind === 'suv') carN++;
    }
    return carN;
  },

  request(spec: VehicleSpawnRequest): void {
    if (Traffic.queue.length < 400) Traffic.queue.push(spec);
    else if (spec.onFail) spec.onFail('queue');
  },

  spawnSoft(
    kind: string,
    path: number[],
    onArrive?: ((time: number, ok: boolean) => void) | null,
    fromB?: Building | null,
    toB?: Building | null
  ): SoftAgent | null {
    if (!path || path.length < 1) return null;
    const CB = (window as any).CB;
    const maxCars = CB?.Gfx?.settings?.cars || 500;
    if (Traffic.soft.length >= Math.round(maxCars * 0.7)) return null;
    const a: SoftAgent = {
      id: ++Traffic.nextId,
      kind,
      path,
      seg: 0,
      pIdx: 0,
      t: 0,
      heading: 0,
      speed: 0,
      vmax: 2.5,
      bike: kind === 'bike',
      wait: 0,
      born: Traffic.time,
      onArrive: onArrive || null,
      sp:
        (kind === 'bike' ? 5.2 : 1.6) *
        (0.85 + Math.random() * 0.3) *
        (kind === 'bike' ? 2.2 : 2.8),
      side: Math.random() < 0.5 ? 1 : -1,
      x: 0,
      y: 0,
      z: 0,
      hx: 1,
      hz: 0,
      color: kind === 'bike' ? U.pick(BIKE_COLS) : U.pick(PED_COLS),
      toB: toB || null,
    };
    if (path.length < 2) a.path = [path[0], path[0]];
    setupSoft(a);
    if (fromB && CB?.Sim?.buildings.has(fromB.id)) {
      const D = Traffic.doorOf(fromB);
      a.ph = {
        c: curve(
          D.door[0],
          D.door[1],
          D.door[0] - D.ux * 1.6,
          D.door[1] - D.uz * 1.6,
          a.ex,
          a.ez
        ),
        t: 0,
        out: true,
      };
    }
    Traffic.soft.push(a);
    return a;
  },

  isPublic(b: Building): boolean {
    return (
      b &&
      b.kind === 'svc' &&
      (C.SERVICES[b.svc]?.cat === 'parks' || C.SERVICES[b.svc]?.cat === 'landmarks')
    );
  },

  releaseSpot(a: SoftAgent): void {
    if (a.doing && a.doing.spot && a.doing.spot.busy === a) a.doing.spot.busy = null;
    const tgt = a.target as ParkSpot | null;
    if (tgt && typeof tgt === 'object' && 'busy' in tgt && tgt.busy === a) tgt.busy = null;
    a.doing = undefined;
    a.target = null;
  },

  spawnVisitors(b: Building, n: number, secs: number): void {
    const CB = (window as any).CB;
    if (!CB?.Sim?.buildings.has(b.id)) return;
    const D = Traffic.doorOf(b);
    for (let k = 0; k < n; k++) {
      const maxCars = CB?.Gfx?.settings?.cars || 500;
      if (Traffic.soft.length >= Math.round(maxCars * 0.7)) return;
      const a: SoftAgent = {
        id: ++Traffic.nextId,
        kind: 'ped',
        bike: false,
        path: [b.road, b.road],
        pIdx: 0,
        seg: 0,
        t: 0,
        heading: 0,
        speed: 0,
        vmax: 2.4,
        born: Traffic.time,
        onArrive: null,
        sp: 2.4,
        side: 1,
        x: D.door[0] + (Math.random() - 0.5) * 2,
        y: 0,
        z: D.door[1] + (Math.random() - 0.5) * 2,
        hx: 1,
        hz: 0,
        color: U.pick(PED_COLS),
      };
      startVisit(a, b, secs * (0.6 + Math.random() * 0.8), Traffic.time);
      Traffic.soft.push(a);
    }
  },

  setColors(b: number[][], p: number[][]): void {
    BIKE_COLS = b;
    PED_COLS = p;
  },

  update(dt: number): void {
    Traffic.time += dt;
    const CB = (window as any).CB;
    let budget = 40;
    const blocked = new Set<number>();
    resetSpawnBusyCache();
    while (Traffic.queue.length && budget-- > 0) {
      const s = Traffic.queue.shift();
      if (!s) break;
      if (blocked.has(s.from) || spawnBusy(s.from, Traffic.vehicles)) {
        blocked.add(s.from);
        s.tries = (s.tries || 0) + 1;
        if (s.tries < 400) Traffic.queue.push(s);
        else if (s.onFail) s.onFail('cap');
        continue;
      }
      const p = Traffic.findPath(s.from, s.to);
      if (!p) {
        if (s.onFail) s.onFail('nopath');
        continue;
      }
      const v = Traffic.spawn({
        kind: s.kind || 'car',
        path: p,
        col: s.col || null,
        purpose: s.purpose,
        data: s.data,
        onArrive: s.onArrive,
        fromB: s.fromB,
        toB: s.toB,
      });
      if (!v && s.onFail) s.onFail('cap');
    }
    updateSignals(dt);
    const vs = Traffic.vehicles;
    for (const t of touched) head[t] = -1;
    touched.length = 0;

    for (let k = 0; k < vs.length; k++) {
      const v = vs[k] as Vehicle;
      if (head[v.cur] === -1) touched.push(v.cur);
      v.nx = head[v.cur];
      head[v.cur] = k;
    }
    const decay = Math.min(1, dt * 0.6);
    for (const t of touched) {
      let c = 0;
      for (let k = head[t]; k !== -1; k = vs[k].nx || -1) c++;
      Traffic.load[t] += (c - Traffic.load[t]) * decay;
    }
    if (((Traffic as any)._fade = ((Traffic as any)._fade || 0) + dt) > 1) {
      (Traffic as any)._fade = 0;
      for (let i = 0; i < N; i++) {
        if (Traffic.load[i] > 0.01 && head[i] === -1) Traffic.load[i] *= 0.6;
        else if (head[i] === -1) Traffic.load[i] = 0;
      }
    }
    let flowSum = 0,
      flowN = 0;
    const done: Vehicle[] = [];
    for (let k = 0; k < vs.length; k++) {
      const v = vs[k] as Vehicle;
      if (v.dwell > 0) {
        v.dwell -= dt;
        v.speed = 0;
        if (v.dwell <= 0 && v.onDwellEnd) v.onDwellEnd();
        evalPos(v, tmp);
        v.x = tmp[0];
        v.z = tmp[1];
        continue;
      }
      if (v.ph) {
        v.ph.t = Math.min(1, v.ph.t + (v.vmax * 0.5 * dt) / v.ph.c.len);
        evalCurve(v.ph.c, v.ph.t, tmp);
        v.x = tmp[0];
        v.z = tmp[1];
        v.hx = tmp[2];
        v.hz = tmp[3];
        if (v.ph.t >= 1) {
          if (v.ph.out) {
            v.ph = null;
            v.t = 0;
          } else {
            done.push(v);
            continue;
          }
        } else continue;
      }
      let leadDist = 999,
        leadSpd = v.vmax;
      const myT = v.t;

      const scanTile = (tile: number, myEffectiveT: number) => {
        for (let j = head[tile]; j !== -1; j = vs[j].nx || -1) {
          if (j === k) continue;
          const o = vs[j];
          if (o.ph || o.cur !== tile) continue;
          const sameLane =
            tile === v.cur
              ? (o.laneOut === v.laneOut && o.t > 0.4) || (o.laneIn === v.laneIn && o.t <= 0.4)
              : o.laneIn === v.laneOut;
          if (!sameLane) continue;
          let dtile = 0;
          if (tile === v.cur) {
            if (o.t <= myEffectiveT) continue;
            dtile = (o.t - myEffectiveT) * v.len;
          } else {
            dtile = (1 - myEffectiveT) * v.len + o.t * (o.len || 14);
          }
          const net = dtile - (o.L || 4.5);
          if (net < leadDist) {
            leadDist = net;
            leadSpd = o.speed;
          }
        }
      };

      scanTile(v.cur, myT);
      if (leadDist > 30 && v.next >= 0) scanTile(v.next, myT);

      let waitTurn = false;
      const cl = World.jcl[v.cur] >= 0 ? World.clusters[World.jcl[v.cur]] : null;
      if (cl && v.turn === 2 && v.t > 0.25 && v.t < 0.65) {
        const oppD = (v.entryDir + 2) % 4;
        for (let j = head[v.cur]; j !== -1; j = vs[j].nx || -1) {
          if (j === k) continue;
          const o = vs[j];
          if (o.entryDir === oppD && (o.turn === 0 || o.turn === 1) && o.t < 0.7) {
            waitTurn = true;
            break;
          }
        }
      }

      let stopHold = false;
      if (v.apKey >= 0 && v.stopDone !== v.jNext && v.t > 0.72) {
        const ncl = World.clusters[v.jNext];
        const isStop = isStopFor(ncl, v.apKey);
        if (isStop) {
          if (v.waitStop < 1.2) {
            stopHold = true;
            v.waitStop += dt;
          } else if (ncl.ctrl === 'allstop' || ncl.ctrl === 'stop') {
            if (clusterCount(ncl, head, vs) > 0) stopHold = true;
            else v.stopDone = v.jNext;
          } else {
            v.stopDone = v.jNext;
          }
        } else if (ncl.ctrl === 'lights') {
          const sig = signalState(ncl, v.dout);
          if (sig === 0 || sig === 1) stopHold = true;
          const clAny = ncl as any;
          if (stopHold && clAny.wait) clAny.wait[v.dout % 2] += dt;
        } else if (ncl.ctrl === 'round') {
          let roundBlocked = false;
          const rLane = v.laneOut;
          for (const rt of ncl.tiles) {
            for (let j = head[rt]; j !== -1; j = vs[j].nx || -1) {
              if (j === k) continue;
              const o = vs[j];
              if (o.laneIn === rLane || o.laneOut === rLane) {
                roundBlocked = true;
                break;
              }
            }
            if (roundBlocked) break;
          }
          if (roundBlocked) stopHold = true;
        }
      }

      if (v.jNext >= 0 && v.t > 0.75) {
        const nn = at(v, v.seg + 2);
        if (nn >= 0 && Traffic.load[nn] > 3.8 && World.jcl[nn] < 0) {
          let nnCars = 0;
          for (let j = head[nn]; j !== -1; j = vs[j].nx || -1) nnCars++;
          if (nnCars >= 3) stopHold = true;
        }
      }

      let targetSpeed = v.vmax;
      if (waitTurn || stopHold) targetSpeed = 0;
      else if (leadDist < 2.5) targetSpeed = 0;
      else if (leadDist < 12) {
        const desired = Math.max(0, (leadDist - 2.5) * 1.6);
        targetSpeed = Math.min(targetSpeed, desired, leadSpd);
      }
      const accel = targetSpeed > v.speed ? 4.5 * dt : -7.5 * dt;
      v.speed = U.clamp(v.speed + accel, 0, targetSpeed);
      if (targetSpeed === 0 && v.speed < 0.25) v.speed = 0;

      v.t += (v.speed * dt) / v.len;

      if (v.speed < 0.5) {
        v.wait += dt;
        if (v.wait > 40 && !v.gaveUp && !v.loop) {
          v.gaveUp = true;
          v.stuck++;
          Traffic.stats.stuck++;
          v.onBroken?.(v);
        }
      } else {
        v.wait = Math.max(0, v.wait - dt * 2);
      }

      flowSum += v.vmax > 0 ? v.speed / v.vmax : 1;
      flowN++;

      while (v.t >= 1) {
        const over = (v.t - 1) * v.len;
        if (v.seg === v.stopAt && v.onStop) {
          v.onStop(v);
          v.t = 1;
          break;
        }
        if (v.seg + 1 >= v.path.length) {
          if (v.loop) {
            v.seg = 0;
            setupSeg(v);
            v.t = over / v.len;
          } else {
            v.t = 1;
            const b = v.toB;
            if (b && CB?.Sim?.buildings.has(b.id) && b.road === v.path[v.seg]) {
              evalPos(v, tmp);
              v.x = tmp[0];
              v.z = tmp[1];
              const D = Traffic.doorOf(b);
              v.ph = {
                c: curve(v.x, v.z, D.curb[0], D.curb[1], D.door[0], D.door[1]),
                t: 0,
                out: false,
              };
            } else {
              done.push(v);
            }
            break;
          }
        } else {
          v.seg++;
          if (!World.road[v.path[v.seg]]) {
            v.gaveUp = true;
            done.push(v);
            break;
          }
          v.lane = v.laneOut;
          setupSeg(v);
          v.t = over / v.len;
        }
      }

      evalPos(v, tmp);
      v.x = tmp[0];
      v.z = tmp[1];
      v.hx = tmp[2];
      v.hz = tmp[3];
    }

    if (done.length) {
      const set = new Set(done);
      Traffic.vehicles = Traffic.vehicles.filter(v => !set.has(v));
      for (const v of done) {
        Traffic.stats.trips++;
        if (v.onArrive) v.onArrive(v, !v.gaveUp);
      }
    }

    const sdone: SoftAgent[] = [];
    let nb = 0,
      np = 0;
    ballPos.length = 0;
    for (const a of Traffic.soft) {
      if (a.kind === 'bike') nb++;
      else np++;
      if (a.doing) {
        if (
          Traffic.time > a.doing.until ||
          (a.visit && Traffic.time > a.visit.until) ||
          (a.visit && !CB?.Sim?.buildings.has(a.visit.b.id))
        ) {
          Traffic.releaseSpot(a);
          a.pose = null;
          a.yo = 0;
          if (a.visit && Traffic.time > a.visit.until) {
            sdone.push(a);
            continue;
          }
          nextWander(a, Traffic.time);
        } else {
          stepActivity(a, dt, Traffic.time, ballPos);
          continue;
        }
      }
      if (a.ph) {
        if (a.ph.pause > 0 && a.ph.t >= 1) {
          a.ph.pause -= dt;
          continue;
        }
        a.ph.t = Math.min(1, a.ph.t + ((a.ph.wander ? 1.6 : (a.sp || 2) * 0.6) * dt) / a.ph.c.len);
        if (a.ph.t < 1) {
          evalCurve(a.ph.c, a.ph.t, tmp);
          a.x = tmp[0];
          a.z = tmp[1];
          a.hx = tmp[2];
          a.hz = tmp[3];
          continue;
        }
        if (a.ph.wander) {
          if (a.visit && Traffic.time > a.visit.until) {
            Traffic.releaseSpot(a);
            sdone.push(a);
            continue;
          }
          if (a.target) {
            beginActivity(a, a.target as ParkSpot, Traffic.time);
            a.ph = null;
            continue;
          }
          if (!a.ph.pause || a.ph.pause <= 0) nextWander(a, Traffic.time);
          continue;
        }
        if (a.ph.out) {
          a.ph = null;
          a.t = 0;
        } else {
          sdone.push(a);
          continue;
        }
      }
      a.t += ((a.sp || 2) * dt) / (a.len || 14);
      while (a.t >= 1) {
        const over = (a.t - 1) * (a.len || 14);
        if (a.seg + 1 >= a.path.length) {
          a.t = 1;
          const b = a.toB as Building | null;
          if (b && CB?.Sim?.buildings.has(b.id) && b.road === a.path[a.seg]) {
            evalPos(a as unknown as Vehicle, tmp);
            a.x = tmp[0];
            a.z = tmp[1];
            const D = Traffic.doorOf(b);
            if (Traffic.isPublic(b)) {
              if (a.onArrive) {
                a.onArrive(Traffic.time - (a.born || 0), true);
                a.onArrive = null;
              }
              a.kind = 'ped';
              startVisit(a, b, 25 + Math.random() * 35, Traffic.time);
            } else {
              a.ph = {
                c: curve(
                  a.x,
                  a.z,
                  D.door[0] - D.ux * 1.6,
                  D.door[1] - D.uz * 1.6,
                  D.door[0],
                  D.door[1]
                ),
                t: 0,
                out: false,
              };
            }
          } else sdone.push(a);
          break;
        }
        a.seg++;
        if (!World.road[a.path[a.seg]] && !World.pmask[a.path[a.seg]]) {
          sdone.push(a);
          break;
        }
        setupSoft(a);
        a.t = over / (a.len || 14);
      }
      evalPos(a as unknown as Vehicle, tmp);
      a.x = tmp[0];
      a.z = tmp[1];
      a.hx = tmp[2];
      a.hz = tmp[3];
    }
    if (sdone.length) {
      const set = new Set(sdone);
      for (const a of sdone) Traffic.releaseSpot(a);
      Traffic.soft = Traffic.soft.filter(a => !set.has(a));
      for (const a of sdone) if (a.onArrive) a.onArrive(Traffic.time - (a.born || 0), true);
    }
    Traffic.stats.bikes = nb;
    Traffic.stats.peds = np;
    Traffic.stats.active = vs.length;
    Traffic.stats.flow = flowN ? flowSum / flowN : 1;
  },

  validate(): void {
    const valid: Vehicle[] = [];
    for (const v of Traffic.vehicles) {
      let ok = true;
      for (let k = v.seg; k < v.path.length; k++) {
        if (!World.road[v.path[k]]) {
          ok = false;
          break;
        }
      }
      if (ok) valid.push(v);
      else {
        v.onBroken?.(v);
      }
    }
    Traffic.vehicles = valid;

    const svalid: SoftAgent[] = [];
    for (const a of Traffic.soft) {
      if (a.visit) {
        svalid.push(a);
        continue;
      }
      let ok = true;
      for (let k = a.seg; k < a.path.length; k++) {
        const i = a.path[k];
        if (!World.road[i] && !World.pmask[i]) {
          ok = false;
          break;
        }
      }
      if (ok) svalid.push(a);
      else {
        Traffic.releaseSpot(a);
        if (a.onArrive) a.onArrive(0, false);
      }
    }
    Traffic.soft = svalid;
  },

  clearAll(): void {
    Traffic.vehicles = [];
    Traffic.soft = [];
    Traffic.queue = [];
    Traffic.load.fill(0);
  },

  render(): void {
    const CB = (window as any).CB;
    const Mx = CB?.Meshes;
    if (!Mx) return;
    const VW: Record<string, number> = {
      car: 0.88,
      suv: 0.86,
      van: 0.84,
      truck: 0.8,
      bus: 0.82,
      tram: 0.88,
      police: 0.88,
      ambulance: 0.84,
      fire: 0.8,
      garbage: 0.8,
    };
    for (const v of Traffic.vehicles) {
      const y = World.roadH(v.x, v.z);
      const ya = World.roadH(v.x + v.hx * 2, v.z + v.hz * 2),
        yb = World.roadH(v.x - v.hx * 2, v.z - v.hz * 2);
      const pitch = Math.atan2(ya - yb, 4);
      Mx.pushVehicle(v.kind, v.x, y + 0.05, v.z, v.hx, v.hz, v.col, pitch, VW[v.kind] || 0.9);
    }
    for (const a of Traffic.soft) {
      const inPark = !!a.visit;
      const y = inPark && a.visit ? a.visit.b.baseY + 0.1 : World.roadH(a.x, a.z) + 0.2;
      const sc = a.kid ? 0.62 : 1;
      if (a.pose) {
        Mx.pushVehicle(a.pose, a.x, y + (a.yo || 0), a.z, a.hx, a.hz, a.color, 0, 1, sc);
        continue;
      }
      const moving = !a.ph || a.ph.t < 1;
      const step = moving
        ? (((a.ph ? a.ph.t * a.ph.c.len * 3 : a.seg * T + a.t * (a.len || 14)) /
            (a.kind === 'ped' ? 0.55 * sc : 0.9)) |
          0)
        : 0;
      Mx.pushVehicle(step % 2 ? a.kind + '2' : a.kind, a.x, y, a.z, a.hx, a.hz, a.color, 0, 1, sc);
    }
    for (let k = 0; k < ballPos.length; k += 4) {
      Mx.pushVehicle('ball', ballPos[k], ballPos[k + 3] + ballPos[k + 1], ballPos[k + 2], 1, 0, BALL_COL, 0, 1);
    }
    for (const cl of World.clusters) {
      if (cl.ctrl !== 'lights') continue;
      for (const ap of cl.aps) {
        const st = Traffic.signalState(cl, ap.d);
        const p = Mx.signalLampPos(ap);
        Mx.pushSignal(p[0], p[1], p[2], st);
      }
    }
  },

  pick(x: number, z: number, r: number): Vehicle | null {
    let best: Vehicle | null = null,
      bd = r * r;
    for (const v of Traffic.vehicles) {
      const d = (v.x - x) ** 2 + (v.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  },
};

export { boundaryLanes };
export default Traffic;
