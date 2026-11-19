// ============================================================================
// Vira City — Procedural Terrain & Map Generation
// ============================================================================

import { C } from '../core/constants';
import { U } from '../core/utils';
import { World } from './world';

const W = C.W;

export interface LakeDesc {
  lx: number;
  ly: number;
  lr: number;
  rot: number;
  aspect: number;
  hasLobe: boolean;
  lobeD: number;
  lobeR: number;
  lobeAng: number;
  ph: number;
}

export function getLakeDist(x: number, y: number, lake: LakeDesc): number {
  const dx = x - lake.lx,
    dy = y - lake.ly;
  const cRot = Math.cos(lake.rot),
    sRot = Math.sin(lake.rot);
  const rx = dx * cRot + dy * sRot;
  const ry = (-dx * sRot + dy * cRot) * lake.aspect;
  const ang1 = Math.atan2(ry, rx);
  const dist1 = Math.hypot(rx, ry);
  const rr1 =
    lake.lr *
    (1.0 + 0.1 * Math.cos(2 * ang1 + lake.ph) + 0.05 * Math.sin(3 * ang1 + lake.ph * 1.3));
  const d1 = dist1 - rr1;

  if (!lake.hasLobe) return d1;

  const lx2 = lake.lx + Math.cos(lake.lobeAng) * lake.lobeD;
  const ly2 = lake.ly + Math.sin(lake.lobeAng) * lake.lobeD;
  const dx2 = x - lx2,
    dy2 = y - ly2;
  const ang2 = Math.atan2(dy2, dx2);
  const dist2 = Math.hypot(dx2, dy2);
  const rr2 = lake.lobeR * (1.0 + 0.08 * Math.cos(2 * ang2 + lake.ph * 0.7));
  const d2 = dist2 - rr2;

  const k = 3.2;
  const h = U.clamp(0.5 + (0.5 * (d2 - d1)) / k, 0, 1);
  return U.lerp(d2, d1, h) - k * h * (1.0 - h);
}

export function generateTerrain(seed: number, map: string) {
  const n1 = U.makeNoise(seed),
    n2 = U.makeNoise(seed + 17),
    n3 = U.makeNoise(seed + 91);
  const rnd = U.rng(seed * 7 + 3);
  const riverX0 = W * (0.6 + rnd() * 0.08);
  const rp1 = rnd() * 6;
  const rp2 = rnd() * 6;
  const hwRow = (World.hwRow = Math.round(W * 0.5 + (rnd() - 0.5) * 20));
  const riverAt = (y: number) =>
    riverX0 + Math.sin(y * 0.034 + rp1) * 13 + Math.sin(y * 0.012 + rp2) * 9;
  World.riverAt = riverAt;
  const P0 = C.P0,
    P1 = C.P1,
    mid = (P0 + P1) / 2;

  const lakes: LakeDesc[] = [];
  if (map === 'lakes') {
    for (let k = 0; k < 200 && lakes.length < 5; k++) {
      const lr = 9.5 + rnd() * 6.5;
      const lx = P0 + 20 + rnd() * (136 - (P0 + 20));
      const ly = P0 + 16 + rnd() * (P1 - P0 - 36);
      if (Math.abs(ly - hwRow) < lr + 8 && lx < P0 + 44) continue;
      if (lakes.some(l => Math.hypot(l.lx - lx, l.ly - ly) < l.lr + lr + 14)) continue;
      const rot = rnd() * Math.PI;
      const aspect = 1.0 + rnd() * 0.45;
      const hasLobe = rnd() < 0.65;
      const lobeD = lr * (0.8 + rnd() * 0.35);
      const lobeR = lr * (0.55 + rnd() * 0.25);
      const lobeAng = rot + (0.8 + rnd() * 1.5) * (rnd() < 0.5 ? 1 : -1);
      const ph = rnd() * 6.0;
      lakes.push({ lx, ly, lr, rot, aspect, hasLobe, lobeD, lobeR, lobeAng, ph });
    }
  }
  const gorgeAt = (y: number) =>
    mid + 18 + Math.sin(y * 0.05 + rp1) * 16 + Math.sin(y * 0.021 + rp2) * 10;
  const straitAt = (y: number) =>
    W * 0.6 + Math.sin(y * 0.03 + rp1) * 8 + Math.sin(y * 0.011 + rp2) * 5;

  for (let y = 0; y <= W; y++) {
    for (let x = 0; x <= W; x++) {
      let h = 2.6 + U.fbm(n1, x * 0.018, y * 0.018, 4) * 4.2;
      h += Math.max(0, U.fbm(n2, x * 0.03 + 50, y * 0.03, 3)) * 6;
      const ridge = () => {
        const r = 1 - Math.abs(U.fbm(n3, x * 0.035, y * 0.035, 4));
        return r * r;
      };
      if (map === 'coast') {
        const north = U.smooth(P0 + 14, P0 - 24, y);
        if (north > 0) h += north * (ridge() * 70 + 8);
        const shore = P1 - 52 + Math.sin(y * 0.045 + rp1) * 10 + U.fbm(n2, 7, y * 0.06, 2) * 8;
        const bayD = Math.hypot(x - (P1 - 10), (y - (mid + 26)) * 0.8) - 46;
        const sea = Math.max(
          U.smooth(shore - 4, shore + 10, x),
          U.smooth(6, -10, bayD),
          U.smooth(P1 - 2, P1 + 14, y)
        );
        h = U.lerp(h, Math.min(h, 1.2), U.smooth(16, 4, Math.min(x - shore + 4, bayD + 6)) * 0.7);
        h = U.lerp(h, -9, sea);
      } else if (map === 'lakes') {
        h = Math.max(h, 2.0);
        h += Math.max(0, U.fbm(n3, x * 0.04, y * 0.04, 3)) * 5;
        const east = U.smooth(P1 - 10, P1 + 24, x);
        if (east > 0) h += east * (ridge() * 50 + 8);
        let minLakeD = 999;
        for (const l of lakes) {
          const ld = getLakeDist(x, y, l);
          if (ld < minLakeD) minLakeD = ld;
        }
        if (minLakeD < 8.5) {
          h = U.lerp(h, Math.min(h, 1.2), U.smooth(8.0, 2.0, minLakeD));
          h = U.lerp(h, -3.5, U.smooth(2.0, -2.5, minLakeD));
        }
      } else if (map === 'highlands') {
        h +=
          Math.max(0, U.fbm(n3, x * 0.02 + 9, y * 0.02, 4)) * 26 +
          Math.abs(U.fbm(n2, x * 0.05, y * 0.05, 2)) * 4;
        const m = Math.max(
          U.smooth(P0 + 10, P0 - 22, y),
          U.smooth(P1 - 10, P1 + 22, x),
          U.smooth(P1 - 4, P1 + 20, y)
        );
        if (m > 0) h += m * (ridge() * 110 + 14);
        if (y > P0 - 20) {
          const d = Math.abs(x - gorgeAt(y));
          h = U.lerp(h, Math.min(h, 3 + d * 1.1), U.smooth(14, 4, d));
          h = U.lerp(h, -4.5, U.smooth(4.5, 1.8, d));
        }
      } else if (map === 'islands') {
        const north = U.smooth(P0 + 14, P0 - 22, y);
        if (north > 0 && x > W * 0.62) h += north * (ridge() * 80 + 8);
        const ds = Math.abs(x - straitAt(y));
        h = U.lerp(h, Math.min(h, 1.4), U.smooth(9, 5, ds) * 0.6);
        h = U.lerp(h, -6.5, U.smooth(6, 3, ds));
        const sea = U.smooth(P1 - 6, P1 + 14, y + U.fbm(n2, x * 0.05, 9, 2) * 10);
        h = U.lerp(h, -9, sea);
        const islet = U.fbm(n3, x * 0.06 + 3, y * 0.06, 2);
        if (sea > 0.5 && islet > 0.32)
          h = U.lerp(h, 2.2 + (islet - 0.32) * 18, U.smooth(0.32, 0.42, islet));
      } else {
        const north = U.smooth(P0 + 18, P0 - 22, y);
        const east = U.smooth(P1 - 16, P1 + 24, x);
        const m = Math.max(north, east * 0.9);
        if (m > 0) h += m * (ridge() * 95 + 10);
        const sea = U.smooth(P1 - 6, P1 + 14, y + U.fbm(n2, x * 0.05, 9, 2) * 10);
        h = U.lerp(h, -9, sea);
        const d = Math.abs(x - riverAt(y));
        if (y > P0 - 30) {
          const rv = U.smooth(6.5, 2.2, d) * U.smooth(P0 - 30, P0 - 10, y);
          h = U.lerp(h, -4.5, rv);
          h = U.lerp(h, Math.min(h, 1.6), U.smooth(9, 6, d) * 0.6);
        }
      }

      if (x <= P0 + 26 && Math.abs(y - hwRow - 0.5) < 5) {
        const f = U.smooth(5, 2, Math.abs(y - hwRow - 0.5));
        h = U.lerp(h, Math.max(2.4, Math.min(h, 4)), f);
      }
      const e = Math.min(x, y, W - x, W - y);
      h = U.lerp(h, -7, U.smooth(12, 1, e));
      if (h >= -0.06 && h <= 0.06) {
        h = h >= 0 ? 0.12 : -0.16;
      }
      World.hc[y * (W + 1) + x] = Math.max(-10, h);
    }
  }

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const i = U.idx(x, y);
      if (World.isWater(i) || World.slope(i) > 9) continue;
      const f = U.fbm(n2, x * 0.045 + 200, y * 0.045 + 200, 3);
      const play = U.inPlay(x, y);
      const thr = (play ? 0.18 : 0.02) - (map === 'lakes' ? 0.1 : map === 'highlands' ? 0.04 : 0);
      if (f > thr) {
        const r = U.hash(x, y, seed);
        World.tree[i] = f > thr + 0.15 ? 3 : r < 0.6 ? 2 : 1;
      } else if (U.hash(x, y, seed + 5) < 0.03) {
        World.tree[i] = 1;
      }
      const avg = World.tileAvg(i);
      if (avg > 45) World.tree[i] = 0;
    }
  }

  const nFertile = U.makeNoise(seed + 314);
  const nOre = U.makeNoise(seed + 628);
  const nOil = U.makeNoise(seed + 942);

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const i = U.idx(x, y);
      if (World.isWater(i)) {
        World.resource[i] = C.RES_NONE;
        continue;
      }
      const avg = World.tileAvg(i);
      const slope = World.slope(i);

      // Ore: concentrated on higher rocky ground and mountains
      const fOre = U.fbm(nOre, x * 0.038, y * 0.038, 3);
      if (avg >= 12 && fOre > 0.18) {
        World.resource[i] = C.RES_ORE;
        continue;
      }

      // Oil: concentrated in underground coastal and lowland basins
      const fOil = U.fbm(nOil, x * 0.032, y * 0.032, 3);
      if (avg >= 0.4 && avg <= 9 && slope <= 3.5 && fOil > 0.24) {
        World.resource[i] = C.RES_OIL;
        continue;
      }

      // Fertile Land: flat river valleys, meadow plains, and lakeshores
      const fFertile = U.fbm(nFertile, x * 0.03, y * 0.03, 3);
      if (avg >= 0.4 && avg <= 15 && slope <= 2.8 && fFertile > 0.16) {
        World.resource[i] = C.RES_FERTILE;
        continue;
      }

      // Forest: dense tree stands and woodlands
      if (World.tree[i] >= 2 || (World.tree[i] >= 1 && slope < 6)) {
        World.resource[i] = C.RES_FOREST;
        continue;
      }

      World.resource[i] = C.RES_NONE;
    }
  }

  World.outside = [];
  const HW = C.START_HW;
  const xe = C.P0 + 15;
  for (let x = 0; x <= xe; x++) {
    for (const [yy, dir] of [
      [hwRow, 3],
      [hwRow + 1, 1],
    ]) {
      const i = U.idx(x, yy);
      World.road[i] = HW;
      World.rdir[i] = dir;
      World.rpart[i] = (yy === hwRow ? 2 : 0) + 1;
      if (x > 0) World.linkTiles(i, U.idx(x - 1, yy));
    }
    for (let k = -1; k <= 2; k++) World.tree[U.idx(x, hwRow + k)] = 0;
  }

  const a = U.idx(xe + 1, hwRow);
  const b = U.idx(xe + 1, hwRow + 1);
  for (const t of [a, b]) {
    World.road[t] = C.ROAD_BASIC;
    World.rdir[t] = 2;
    World.tree[t] = 0;
  }
  World.linkTiles(a, b);
  World.linkTiles(a, U.idx(xe, hwRow));
  World.linkTiles(b, U.idx(xe, hwRow + 1));
  World.outIn = U.idx(0, hwRow + 1);
  World.outOut = U.idx(0, hwRow);
  World.outside.push(World.outIn, World.outOut);
  World.hwEnd = b;
  World.updateZonable();
  World.updateConn();
  World.updateJunctions();
}
