// ============================================================================
// Vira City — Building Placement, Lot Fitting & Growth Logic
// ============================================================================

import { C } from '../core/constants';
import { U } from '../core/utils';
import { World } from '../world/world';
import { Building, BuildingSpec } from '../types';
import { Sim } from './sim';

const W = C.W;
const N = W * W;

export function lotTiles(b: Building): number[] {
  const out: number[] = [];
  for (let y = b.y; y < b.y + b.fh; y++) {
    for (let x = b.x; x < b.x + b.fw; x++) out.push(U.idx(x, y));
  }
  return out;
}

const NM = {
  res: ['Residence', 'Homes', 'Place', 'Court', 'Terrace', 'Gardens', 'Cottage', 'House'],
  resHigh: ['Towers', 'Heights', 'Lofts', 'Residences', 'Tower', 'Point'],
  com: [
    'Market',
    'Goods',
    'Deli',
    'Outfitters',
    'Bistro',
    'Pharmacy',
    'Books',
    'Hardware',
    'Grocers',
    'Café',
  ],
  ind: ['Logistics', 'Fabrication', 'Foods', 'Works', 'Plastics', 'Freight', 'Textiles', 'Steel'],
  off: ['Partners', 'Analytics', 'Labs', 'Group', 'Capital', 'Systems', 'Media', 'Software'],
  pre: [
    'Maple',
    'Northwind',
    'Harbour',
    'Juniper',
    'Granite',
    'Blue Heron',
    'Cedar',
    'Lakeside',
    'Summit',
    'Willow',
    'Ironwood',
    'Beacon',
    'Sterling',
    'Riverside',
    'Oak',
    'Aurora',
  ],
};

export function nameFor(b: Building): string {
  if (b.kind === 'svc') return (b.svc ? C.SERVICES[b.svc]?.name : null) || 'Service';
  const r = U.rng(b.seed || 1234);
  const cat = (b.zone ? C.ZONES[b.zone]?.cat : 'res') as keyof typeof NM;
  const list = b.zone === 3 ? NM.resHigh : (NM[cat] as string[]) || NM.res;
  return U.pick(NM.pre, r) + ' ' + U.pick(list, r);
}

export function releaseWork(b: Building) {
  for (const w of b.work || []) {
    const o = Sim.buildings.get(w.id);
    if (o) o.filled = Math.max(0, (o.filled || 0) - w.n);
  }
  b.work = [];
}

export function employedOf(b: Building): number {
  let n = 0;
  for (const w of b.work || []) n += w.n;
  return n;
}

export function frontOK(i: number, d: number): number {
  const j = World.neighbor(i, d);
  return j >= 0 && World.road[j] && C.ROADS[World.road[j]]?.zonable ? j : -1;
}

export function tileFree(t: number, z: number): boolean {
  return (
    World.zone[t] === z &&
    !World.bld[t] &&
    !World.road[t] &&
    !World.pmask[t] &&
    World.rail[t] !== 1 &&
    World.buildable(t)
  );
}

export function rebuildLots() {
  Sim.lots = C.ZONES.map(() => []);
  for (let i = 0; i < N; i++) {
    const z = World.zone[i];
    if (!z || !tileFree(i, z)) continue;
    for (let d = 0; d < 4; d++) {
      const j = frontOK(i, d);
      if (j >= 0 && World.conn[j]) {
        Sim.lots[z].push(i);
        break;
      }
    }
  }
  Sim.lotsDirty = false;
}

export function fitLot(
  i: number,
  f: number,
  w: number,
  d: number,
  z: number
): BuildingSpec | null {
  const g = (f + 2) % 4,
    a = (f + 1) % 4;
  const x = U.tx(i),
    y = U.ty(i);
  const offs: number[] = [];
  for (let o = 0; o < w; o++) offs.push(o);
  if (Sim.rng() < 0.5) offs.reverse();
  for (const off of offs) {
    let ok = true,
      minx = 1e9,
      miny = 1e9,
      maxx = -1,
      maxy = -1,
      road = -1;
    for (let k = 0; k < w && ok; k++) {
      for (let j = 0; j < d; j++) {
        const tx = x + C.DX[a] * (k - off) + C.DX[g] * j,
          ty = y + C.DY[a] * (k - off) + C.DY[g] * j;
        if (!U.inPlay(tx, ty)) {
          ok = false;
          break;
        }
        const t = U.idx(tx, ty);
        if (!tileFree(t, z)) {
          ok = false;
          break;
        }
        if (j === 0) {
          const r = frontOK(t, f);
          if (r < 0) {
            ok = false;
            break;
          }
          if (road < 0) road = r;
        }
        minx = Math.min(minx, tx);
        maxx = Math.max(maxx, tx);
        miny = Math.min(miny, ty);
        maxy = Math.max(maxy, ty);
      }
    }
    if (ok)
      return {
        x: minx,
        y: miny,
        fw: maxx - minx + 1,
        fh: maxy - miny + 1,
        w,
        d,
        dir: f,
        road,
      };
  }
  return null;
}

export function tryGrow(z: number): boolean {
  const L = Sim.lots[z];
  if (!L || !L.length) return false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const k = Math.floor(Sim.rng() * L.length),
      i = L[k];
    if (!tileFree(i, z)) {
      L[k] = L[L.length - 1];
      L.pop();
      if (!L.length) return false;
      continue;
    }
    const dirs: number[] = [];
    for (let d = 0; d < 4; d++) {
      const j = frontOK(i, d);
      if (j >= 0 && World.conn[j]) dirs.push(d);
    }
    if (!dirs.length) continue;
    const f = U.pick(dirs, Sim.rng);
    const Z = C.ZONES[z]!;
    const g = (f + 2) % 4;
    let maxD = 0;
    for (let j = 0; j < 3; j++) {
      const tx = U.tx(i) + C.DX[g] * j,
        ty = U.ty(i) + C.DY[g] * j;
      if (!U.inPlay(tx, ty) || !tileFree(U.idx(tx, ty), z)) break;
      maxD++;
    }
    const depths = [...new Set(Z.lots.map(l => l[1]))]
      .filter(dd => dd <= maxD)
      .sort((p, q) => q - p);
    if (!depths.length) continue;
    const sizes: [number, number, number][] = [];
    for (const dd of depths) {
      const opts: [number, number, number][] = Z.lots
        .filter(l => l[1] === dd)
        .map(l => [
          l[0],
          l[1],
          (z === 1 && l[0] === 1 ? 2.2 : 1) * (l[2] || 1) * (z === 1 ? 1 : l[0]),
        ]);
      opts.forEach(o => {
        o[2] = Math.pow(Sim.rng(), 1 / o[2]);
      });
      opts.sort((p, q) => q[2] - p[2]);
      sizes.push(...opts);
    }
    for (const [w, d] of sizes) {
      const spec = fitLot(i, f, w, d, z);
      if (spec) {
        const b = Sim.makeBuilding(
          Object.assign(spec, {
            kind: 'zone',
            zone: z,
            state: 'build',
            buildT: 1 + w * d * 0.25,
          })
        );
        b.cap = Sim.capOf(b);
        if (!Sim.isRes(b)) b.jobs = b.cap;
        return true;
      }
    }
  }
  return false;
}

export function rehome(b: Building): boolean {
  for (const t of lotTiles(b)) {
    for (let d = 0; d < 4; d++) {
      const n = World.neighbor(t, d);
      if (n >= 0 && World.road[n] && World.bld[n] !== b.id) {
        b.road = n;
        return true;
      }
    }
  }
  return false;
}
