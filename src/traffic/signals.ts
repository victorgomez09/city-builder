/**
 * Open Skylines — Junction Traffic Signals & Stop Rule Arbitration (`src/traffic/signals.ts`)
 *
 * Implements traffic light phases (green, yellow, all-red), stop-sign priorities,
 * approach queue evaluation, and spawn point congestion blocking.
 */

import { C } from '@/core/constants';
import { World } from '@/world/world';
import { JunctionCluster, Vehicle } from '@/types';

const G = 12,
  Y = 2.6,
  AR = 1.2;

export function updateSignals(dt: number): void {
  for (const cl of World.clusters) {
    if (cl.ctrl !== 'lights') continue;
    const clAny = cl as JunctionCluster & { wait?: [number, number]; waitNext?: [number, number] };
    if (!clAny.wait) clAny.wait = [0, 0];
    cl.pt += dt;
    const ph = cl.phase;
    if (ph === 0 || ph === 3) {
      const ax = ph === 0 ? 0 : 1,
        other = 1 - ax;
      const gmax = (cl.cfg.green && cl.cfg.green[ax]) || G;
      const done =
        cl.pt > gmax * 1.6 ||
        (cl.pt > gmax && clAny.wait[other] > 0) ||
        (cl.pt > 5 && clAny.wait[ax] === 0 && clAny.wait[other] > 0);
      if (done) {
        cl.phase++;
        cl.pt = 0;
      }
    } else if (ph === 1 || ph === 4) {
      if (cl.pt > Y) {
        cl.phase++;
        cl.pt = 0;
      }
    } else if (cl.pt > AR) {
      cl.phase = (ph + 1) % 6;
      cl.pt = 0;
    }
    clAny.waitNext = clAny.wait;
    clAny.wait = [0, 0];
  }
}

export function clusterCount(cl: JunctionCluster, head: Int32Array, vehicles: Vehicle[]): number {
  let c = 0;
  for (const t of cl.tiles) {
    for (let k = head[t]; k !== -1; k = (vehicles[k] as Vehicle & { nx: number }).nx) c++;
  }
  return c;
}

export function isStopFor(cl: JunctionCluster, key: number): boolean {
  if (cl.ctrl === 'allstop') return true;
  if (cl.ctrl !== 'stop') return false;
  const s = cl.cfg.stops[key];
  if (s !== undefined) return s;
  let min = 9,
    max = 0;
  for (const ap of cl.aps) {
    const r = C.GRP_RANK[C.ROADS[World.road[ap.tile]]?.grp || 'small'];
    min = Math.min(min, r);
    max = Math.max(max, r);
  }
  const mine = C.GRP_RANK[C.ROADS[World.road[(key / 4) | 0]]?.grp || 'small'];
  return min === max ? true : mine === min;
}

export function signalState(cl: JunctionCluster, d: number): number {
  const ax = d % 2,
    ph = cl.phase;
  if (ph === (ax === 0 ? 0 : 3)) return 2;
  if (ph === (ax === 0 ? 1 : 4)) return 1;
  return 0;
}

let occ: Map<number, number> | null = null;

export function resetSpawnBusyCache(): void {
  occ = null;
}

export function spawnBusy(tile: number, vehicles: Vehicle[]): boolean {
  if (!occ) {
    occ = new Map();
    for (const v of vehicles) {
      const o = occ.get(v.cur) || 0;
      occ.set(v.cur, o + (v.t < 0.45 ? 10 : 1));
    }
  }
  return (occ.get(tile) || 0) >= 3;
}
