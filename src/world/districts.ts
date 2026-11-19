// ============================================================================
// Vira City — Districts, Specializations & Policies
// ============================================================================

import { C } from '../core/constants';
import { U } from '../core/utils';
import { District, Building } from '../types';
import { World } from './world';

const W = C.W;

export const DISTRICT_PALETTE = [
  '#4a90e2', '#50e3c2', '#f5a623', '#e74c3c', '#9b59b6',
  '#1abc9c', '#f39c12', '#d35400', '#27ae60', '#2980b9',
  '#8e44ad', '#16a085', '#2c3e50', '#c0392b', '#7f8c8d',
];

export const DISTRICT_PREFIXES = [
  'North', 'South', 'East', 'West', 'Upper', 'Lower', 'Old', 'New',
  'Grand', 'Pine', 'Oak', 'Maple', 'Cedar', 'River', 'Lake', 'Hill',
  'Valley', 'Sun', 'Golden', 'Royal',
];

export const DISTRICT_SUFFIXES = [
  'Heights', 'Hills', 'Park', 'Meadow', 'Valley', 'Ridge', 'Point',
  'Gardens', 'District', 'Quarter', 'Ward', 'Plaza', 'Crossing',
  'Haven', 'Borough', 'Corner', 'End', 'Square', 'Woods', 'Grove',
];

export function createDistrict(name?: string, color?: string): District {
  let id = World.nextDistrictId;
  while (World.districts.has(id) || id === 0 || id > 254) {
    id = (id % 254) + 1;
  }
  World.nextDistrictId = (id % 254) + 1;

  let distName = name;
  if (!distName) {
    const p = DISTRICT_PREFIXES[Math.floor(Math.random() * DISTRICT_PREFIXES.length)];
    const s = DISTRICT_SUFFIXES[Math.floor(Math.random() * DISTRICT_SUFFIXES.length)];
    distName = `${p} ${s}`;
  }

  const distColor = color || DISTRICT_PALETTE[(id - 1) % DISTRICT_PALETTE.length];

  const dist: District = {
    id,
    name: distName,
    color: distColor,
    spec: 'none',
    policies: {},
    stats: {
      tiles: 0,
      pop: 0,
      buildings: 0,
      jobs: 0,
      workers: 0,
      avgLandValue: 0,
      avgHappy: 0,
      unemployment: 0,
      crime: 0,
      pollution: 0,
      garbage: 0,
      powerUsage: 0,
      waterUsage: 0,
      taxIncome: 0,
    },
    cx: 0,
    cy: 0,
  };

  World.districts.set(id, dist);
  return dist;
}

export function deleteDistrict(id: number) {
  if (!World.districts.has(id)) return;
  for (let i = 0; i < W * W; i++) {
    if (World.district[i] === id) World.district[i] = 0;
  }
  World.districts.delete(id);
  updateDistrictCentroids();
  updateDistrictStats();
  const CB = (window as any).CB;
  if (CB?.UI?.overlay === 'district' && CB?.Meshes && CB?.Sim) {
    CB.Meshes.writeOverlay(CB.Sim.overlayFn('district'));
  }
}

export function paintDistrict(cx: number, cy: number, radius: number, districtId: number) {
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= W) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const x = cx + dx;
      if (x < 0 || x >= W) continue;
      World.district[U.idx(x, y)] = districtId;
    }
  }
}

export function eraseDistrict(cx: number, cy: number, radius: number) {
  paintDistrict(cx, cy, radius, 0);
}

export function districtAt(tile: number): District | null {
  if (tile < 0 || tile >= W * W) return null;
  const did = World.district[tile];
  return did ? World.districts.get(did) || null : null;
}

export function updateDistrictCentroids() {
  const sums = new Map<number, { count: number; sumX: number; sumY: number }>();
  for (const [id] of World.districts) {
    sums.set(id, { count: 0, sumX: 0, sumY: 0 });
  }

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const id = World.district[U.idx(x, y)];
      if (id && sums.has(id)) {
        const entry = sums.get(id)!;
        entry.count++;
        entry.sumX += x;
        entry.sumY += y;
      }
    }
  }

  for (const [id, entry] of sums) {
    const dist = World.districts.get(id);
    if (dist) {
      dist.stats.tiles = entry.count;
      if (entry.count > 0) {
        dist.cx = entry.sumX / entry.count;
        dist.cy = entry.sumY / entry.count;
      }
    }
  }
}

export function updateDistrictStats() {
  updateDistrictCentroids();
  const CB = (window as any).CB;
  const Sim = CB?.Sim;
  if (!Sim || !Sim.buildings) return;

  for (const dist of World.districts.values()) {
    dist.stats.pop = 0;
    dist.stats.buildings = 0;
    dist.stats.jobs = 0;
    dist.stats.workers = 0;
    dist.stats.pollution = 0;
    dist.stats.garbage = 0;
    dist.stats.powerUsage = 0;
    dist.stats.waterUsage = 0;
    dist.stats.taxIncome = 0;
  }

  const happySums = new Map<number, { sum: number; weight: number }>();
  const landValueSums = new Map<number, { sum: number; count: number }>();
  for (const [id] of World.districts) {
    happySums.set(id, { sum: 0, weight: 0 });
    landValueSums.set(id, { sum: 0, count: 0 });
  }

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const i = U.idx(x, y);
      const did = World.district[i];
      if (!did || !World.districts.has(did)) continue;

      if (Sim.cov && Sim.cov.land) {
        const lvEntry = landValueSums.get(did);
        if (lvEntry) {
          lvEntry.sum += Sim.cov.land[i] || 0;
          lvEntry.count++;
        }
      }
    }
  }

  for (const [id, entry] of landValueSums) {
    const dist = World.districts.get(id);
    if (dist && entry.count > 0) {
      dist.stats.avgLandValue = Math.round(entry.sum / entry.count);
    }
  }

  Sim.buildings.forEach((b: Building) => {
    if (b.state === 'aband' || b.state === 'burn') return;
    const tile = Sim.centerTile ? Sim.centerTile(b) : U.idx(b.x, b.y);
    const did = World.district[tile];
    if (!did || !World.districts.has(did)) return;

    const dist = World.districts.get(did)!;
    dist.stats.buildings++;

    const isResidential = b.kind === 'zone' && b.zone && C.ZONES[b.zone]?.cat === 'res';
    if (isResidential) {
      const resCount = b.res || 0;
      dist.stats.pop += resCount;

      const workersFromRes = Math.round(resCount * 0.55);
      dist.stats.workers += workersFromRes;

      if (b.happy !== undefined && resCount > 0) {
        const he = happySums.get(did);
        if (he) {
          he.sum += b.happy * resCount;
          he.weight += resCount;
        }
      }
    }

    if (b.jobs) {
      dist.stats.jobs += b.jobs;
    }

    if (b.garbage) dist.stats.garbage += b.garbage;

    const bCap = b.cap || b.jobs || 1;
    dist.stats.powerUsage += Math.ceil(bCap * 0.8);
    dist.stats.waterUsage += Math.ceil(bCap * 0.6);

    const bTax = (b.level || 1) * 8;
    dist.stats.taxIncome += bTax;
  });

  for (const [id, dist] of World.districts) {
    const he = happySums.get(id);
    if (he && he.weight > 0) {
      dist.stats.avgHappy = Math.round(he.sum / he.weight);
    } else {
      dist.stats.avgHappy = 50;
    }
    if (dist.stats.workers > 0) {
      const unemp = Math.max(0, 1 - dist.stats.jobs / dist.stats.workers);
      dist.stats.unemployment = Math.round(unemp * 100);
    } else {
      dist.stats.unemployment = 0;
    }
  }
}
