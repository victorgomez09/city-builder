/**
 * Vira City — Spatial Coverage & Environmental Heatmaps (`src/sim/coverage.ts`)
 *
 * Computes city-wide influence fields using continuous inverse-square falloff
 * and radial convolution stamps written directly into flat Float32Arrays (Zero-GC).
 */
import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { World } from '@/world/world';
import { Traffic } from '@/traffic/traffic';
import { Transit } from '@/transit/transit';
import { Building } from '@/types';

const W = C.W;
const N = W * W;

export const COV_KEYS = [
  'police',
  'fire',
  'health',
  'edu',
  'garbage',
  'park',
  'landmark',
  'pollution',
  'noise',
  'lv',
  'transit',
] as const;

export type CovKey = (typeof COV_KEYS)[number];

let waterNear: Uint8Array | null = null;

export function getWaterNear(): Uint8Array | null {
  return waterNear;
}

export function computeWaterNear(): void {
  waterNear = new Uint8Array(N);
  for (let y = C.P0; y < C.P1; y++) {
    for (let x = C.P0; x < C.P1; x++) {
      let near = 0;
      for (let dy = -3; dy <= 3 && !near; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (U.inWorld(nx, ny) && World.isWater(U.idx(nx, ny))) {
            near = 1;
            break;
          }
        }
      }
      waterNear[U.idx(x, y)] = near;
    }
  }
}

export function stamp(
  arr: Float32Array,
  cx: number,
  cy: number,
  r: number,
  s: number,
  add: boolean
): void {
  const r2 = r * r;
  const minY = Math.max(0, Math.floor(cy - r));
  const maxY = Math.min(W - 1, Math.ceil(cy + r));
  const minX = Math.max(0, Math.floor(cx - r));
  const maxX = Math.min(W - 1, Math.ceil(cx + r));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      if (d2 > r2) continue;
      const f = s * (1 - (d2 / r2) * 0.75);
      const i = y * W + x;
      arr[i] = add ? Math.min(1.5, arr[i] + f) : Math.max(arr[i], f);
    }
  }
}

export function falloff(
  arr: Float32Array,
  cx: number,
  cy: number,
  r0: number,
  s: number
): void {
  const R = r0 * 4;
  const r02 = r0 * r0;
  const minY = Math.max(0, Math.floor(cy - R));
  const maxY = Math.min(W - 1, Math.ceil(cy + R));
  const minX = Math.max(0, Math.floor(cx - R));
  const maxX = Math.min(W - 1, Math.ceil(cx + R));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      const f = s / (1 + d2 / r02) - 0.06;
      if (f <= 0) continue;
      const i = y * W + x;
      arr[i] = Math.min(1.5, arr[i] + f);
    }
  }
}

/**
 * Recomputes all city-wide spatial influence and service coverage fields.
 */
export function computeCoverage(
  cv: Record<string, Float32Array>,
  buildings: Map<number, Building>
): void {
  for (const k of COV_KEYS) {
    if (cv[k]) cv[k].fill(0);
  }

  buildings.forEach((b: Building) => {
    const cx = b.x + b.fw / 2;
    const cy = b.y + b.fh / 2;

    if (b.kind === 'svc') {
      const sv = b.svc ? C.SERVICES[b.svc] : null;
      if (!sv || !b.road || !World.road[b.road]) return;
      if (sv.cov && cv[sv.cov]) {
        falloff(
          cv[sv.cov],
          cx,
          cy,
          sv.radius * 0.55,
          sv.cov === 'park' || sv.cov === 'landmark' ? 1 : 1.1
        );
      }
      if (sv.pollute && cv.pollution) {
        stamp(cv.pollution, cx, cy, 6, sv.pollute, true);
      }
    } else if (b.zone === 6 && b.state === 'live') {
      const lvl = b.level ?? b.lvl ?? 1;
      if (cv.pollution) {
        stamp(cv.pollution, cx, cy, 6 + lvl, 0.32 + lvl * 0.05, true);
      }
    }
  });

  for (const s of Transit.stops) {
    if (!Transit.lines.some(l => l.stops.includes(s.id))) continue;
    if (cv.transit) {
      stamp(
        cv.transit,
        U.tx(s.tile) + 0.5,
        U.ty(s.tile) + 0.5,
        C.WALK_R + (s.type === 'rail' ? 3 : 0),
        s.type === 'rail' ? 1 : 0.7,
        false
      );
    }
  }

  const L = Traffic.load;
  for (let i = 0; i < N; i++) {
    const rt = World.road[i];
    if (!rt) continue;
    const R = C.ROADS[rt];
    if (!R || !R.car) continue;
    const hw = R.grp === 'highway';
    const v =
      Math.min(1, L[i] / R.cap) * (hw ? 1 : 0.7) +
      (hw ? 0.35 : R.grp === 'large' ? 0.12 : 0);
    if (v < 0.08) continue;
    const x = U.tx(i);
    const y = U.ty(i);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (!U.inWorld(nx, ny)) continue;
        const j = ny * W + nx;
        const f = v * (1 - (Math.abs(dx) + Math.abs(dy)) * 0.2);
        if (cv.noise && f > cv.noise[j]) cv.noise[j] = f;
      }
    }
  }

  for (let i = 0; i < N; i++) {
    const rt = World.road[i];
    if (!rt || !C.ROADS[rt]?.trees) continue;
    if (cv.park) {
      stamp(cv.park, U.tx(i) + 0.5, U.ty(i) + 0.5, 3, 0.25, true);
    }
  }

  for (let y = C.P0; y < C.P1; y++) {
    for (let x = C.P0; x < C.P1; x++) {
      const i = y * W + x;
      const v =
        8 +
        16 * (cv.health ? cv.health[i] : 0) +
        12 * (cv.police ? cv.police[i] : 0) +
        14 * (cv.edu ? cv.edu[i] : 0) +
        20 * Math.min(1, cv.park ? cv.park[i] : 0) +
        24 * Math.min(1, cv.landmark ? cv.landmark[i] : 0) +
        6 * (cv.fire ? cv.fire[i] : 0) +
        12 * (waterNear ? waterNear[i] : 0) +
        10 * (cv.transit ? cv.transit[i] : 0) -
        40 * Math.min(1, cv.pollution ? cv.pollution[i] : 0) -
        10 * (cv.noise ? cv.noise[i] : 0);
      if (cv.lv) cv.lv[i] = U.clamp(v, 0, 100);
    }
  }
}
