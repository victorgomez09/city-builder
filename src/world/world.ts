import { C } from '../core/constants';
import { U } from '../core/utils';
import {
  Building,
  District,
  DistrictPolicies,
  DistrictSpecialization,
  DistrictStats,
  JunctionCluster,
  JunctionConfig,
} from '../types';
import {
  createDistrict,
  deleteDistrict,
  paintDistrict,
  eraseDistrict,
  districtAt,
  updateDistrictCentroids,
  updateDistrictStats,
} from './districts';
import { generateTerrain } from './terrainGen';

const W = C.W;
const T = C.TILE;

export interface WorldState {
  seed: number;
  map: string;
  hc: Float32Array;
  road: Uint8Array;
  link: Uint8Array;
  pcell: Uint8Array;
  pmask: Uint8Array;
  rdir: Uint8Array;
  rpart: Uint8Array;
  curv: Uint8Array;
  jcl: Int32Array;
  clusters: JunctionCluster[];
  jcfg: Map<number, JunctionConfig>;
  rail: Uint8Array;
  zone: Uint8Array;
  bld: Int32Array;
  tree: Uint8Array;
  zonable: Uint8Array;
  conn: Uint8Array;
  outside: number[];
  hwRow: number;
  roadVer: number;
  railVer: number;
  outIn: number;
  outOut: number;
  hwEnd: number;
  hcEdits: Map<number, number>;
  district: Uint8Array;
  districts: Map<number, District>;
  nextDistrictId: number;
  riverAt?: (y: number) => number;
  BRIDGE_H: number;
  TURN: { S: number; R: number; L: number; U: number };

  init: (seed: number, map?: string) => void;
  createDistrict: (name?: string, color?: string) => District;
  deleteDistrict: (id: number) => void;
  paintDistrict: (cx: number, cy: number, radius: number, districtId: number) => void;
  eraseDistrict: (cx: number, cy: number, radius: number) => void;
  districtAt: (tile: number) => District | null;
  updateDistrictCentroids: () => void;
  updateDistrictStats: () => void;
  setCorner: (x: number, y: number, h: number) => void;
  levelLot: (b: Building) => boolean;
  frontAngle: (b: Building) => number;
  applyEdits: (list: number[]) => void;
  cornerH: (x: number, y: number) => number;
  tileCorners: (i: number) => [number, number, number, number];
  tileAvg: (i: number) => number;
  tileMin: (i: number) => number;
  tileMax: (i: number) => number;
  slope: (i: number) => number;
  isWater: (i: number) => boolean;
  groundH: (wx: number, wz: number) => number;
  roadH: (wx: number, wz: number) => number;
  deckH: (wx: number, wz: number) => number;
  buildable: (i: number) => boolean;
  roadOK: (i: number) => boolean;
  roadMask: (i: number) => number;
  linkTiles: (a: number, b: number) => void;
  unlinkAll: (i: number) => void;
  unlinkTiles: (a: number, b: number) => void;
  cornerLinks: (i: number) => [number, number] | null;
  links2: (i: number) => [number, number] | null;
  clearEdgeCache: () => void;
  edgeInfo: (i: number, d: number) => [number, number, number, number];
  isBent: (i: number) => boolean;
  bendSeg: (i: number, din: number, dout: number, offIn: number, offOut: number) => [number, number, number, number, number, number];
  isUturnLink: (a: number, d: number) => boolean;
  joinDeadEnds: () => void;
  fidx: (fx: number, fy: number) => number;
  cellOf: (i: number, q: number) => number;
  setPath: (f: number, k: number) => void;
  rebuildPmask: () => void;
  walkRoad: (i: number) => boolean;
  edgeCells: (i: number, d: number) => [[number, number], [number, number]];
  softPass: (i: number, d: number) => number;
  linked: (i: number, d: number) => boolean;
  isOneway: (i: number) => boolean;
  canDrive: (i: number, d: number) => boolean;
  railMask: (i: number) => number;
  degree: (i: number) => number;
  updateZonable: () => void;
  updateConn: () => void;
  relTurn: (din: number, dout: number) => number;
  updateJunctions: () => void;
  ctrlOf: (cl: JunctionCluster) => string;
  defaultLanes: (n: number, avail: number) => number[];
  lanesToward: (i: number, d: number) => number[];
  neighbor: (i: number, d: number) => number;
  center: (i: number) => [number, number];
}

const eiCache = new Map<number, [number, number, number, number]>();
let eiVer = -1;

const edgeMid = (i: number, d: number): [number, number] => [
  (U.tx(i) + 0.5 + C.DX[d] * 0.5) * T,
  (U.ty(i) + 0.5 + C.DY[d] * 0.5) * T,
];

function walkEdges(t: number, d: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  let cur = t;
  let side = d;
  for (let k = 0; k < n; k++) {
    const l = World.links2(cur);
    if (!l || !l.includes(side) || !World.curv[cur]) break;
    const nx = World.neighbor(cur, side);
    if (nx < 0 || !World.curv[nx]) break;
    out.push(edgeMid(cur, side));
    const ln = World.links2(nx);
    if (!ln) break;
    side = ln[0] === (side + 2) % 4 ? ln[1] : ln[0];
    cur = nx;
  }
  return out;
}

const DISTRICT_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#14b8a6', '#6366f1', '#e11d48'
];

const DISTRICT_PREFIXES = [
  'Oak', 'Pine', 'Maple', 'Cedar', 'Sun', 'Green', 'River', 'Lake',
  'Hill', 'Bay', 'Crown', 'Silver', 'Golden', 'Grand', 'North', 'South',
  'East', 'West', 'Central', 'Highland', 'Emerald', 'Sunset', 'Crystal'
];

const DISTRICT_SUFFIXES = [
  'Park', 'Heights', 'Hills', 'Valley', 'Plaza', 'Gardens', 'Quarter',
  'District', 'Point', 'Haven', 'Terrace', 'Ridge', 'Meadows', 'Commons',
  'Square', 'Harbor', 'Woods', 'Village'
];

export const World: WorldState = {
  seed: 1,
  map: 'valley',
  hc: null as unknown as Float32Array,
  road: null as unknown as Uint8Array,
  link: null as unknown as Uint8Array,
  pcell: null as unknown as Uint8Array,
  pmask: null as unknown as Uint8Array,
  rdir: null as unknown as Uint8Array,
  rpart: null as unknown as Uint8Array,
  curv: null as unknown as Uint8Array,
  jcl: null as unknown as Int32Array,
  clusters: [],
  jcfg: new Map(),
  rail: null as unknown as Uint8Array,
  zone: null as unknown as Uint8Array,
  bld: null as unknown as Int32Array,
  tree: null as unknown as Uint8Array,
  zonable: null as unknown as Uint8Array,
  conn: null as unknown as Uint8Array,
  outside: [],
  hwRow: 0,
  roadVer: 0,
  railVer: 0,
  outIn: 0,
  outOut: 0,
  hwEnd: 0,
  hcEdits: new Map(),
  district: null as unknown as Uint8Array,
  districts: new Map<number, District>(),
  nextDistrictId: 1,
  BRIDGE_H: C.WATER + 1.7,
  TURN: { S: 1, R: 2, L: 4, U: 8 },

  init(seed: number, map?: string) {
    World.seed = seed;
    World.map = C.MAPS.some(m => m.key === map) ? map! : 'valley';
    World.hc = new Float32Array((W + 1) * (W + 1));
    World.road = new Uint8Array(W * W);
    World.link = new Uint8Array(W * W);
    World.pcell = new Uint8Array(C.FW * C.FW);
    World.pmask = new Uint8Array(W * W);
    World.rdir = new Uint8Array(W * W);
    World.rpart = new Uint8Array(W * W);
    World.curv = new Uint8Array(W * W);
    World.jcl = new Int32Array(W * W).fill(-1);
    World.clusters = [];
    World.jcfg = new Map();
    World.rail = new Uint8Array(W * W);
    World.zone = new Uint8Array(W * W);
    World.bld = new Int32Array(W * W);
    World.tree = new Uint8Array(W * W);
    World.zonable = new Uint8Array(W * W);
    World.conn = new Uint8Array(W * W);
    World.hcEdits = new Map();
    World.district = new Uint8Array(W * W);
    World.districts = new Map();
    World.nextDistrictId = 1;
    generateTerrain(seed, World.map);
  },

  setCorner(x: number, y: number, h: number) {
    const k = y * (W + 1) + x;
    World.hc[k] = h;
    World.hcEdits.set(k, h);
  },

  levelLot(b: Building): boolean {
    const CB = (window as any).CB;
    const S = CB ? CB.Sim : null;
    const tilesAt = (x: number, y: number): number[] => {
      const out: number[] = [];
      for (const [tx, ty] of [
        [x - 1, y - 1],
        [x, y - 1],
        [x - 1, y],
        [x, y],
      ]) {
        if (U.inWorld(tx, ty)) out.push(U.idx(tx, ty));
      }
      return out;
    };
    const fixed = (x: number, y: number): boolean =>
      tilesAt(x, y).some(i => World.road[i] || World.pmask[i] || World.rail[i]);
    const x0 = b.x,
      y0 = b.y,
      x1 = b.x + b.fw,
      y1 = b.y + b.fh;
    let sum = 0,
      n = 0,
      all = 0,
      na = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const h = World.cornerH(x, y);
        all += h;
        na++;
        if (tilesAt(x, y).some(i => World.road[i] && C.ROADS[World.road[i]]?.car)) {
          sum += h;
          n++;
        }
      }
    }
    const target = Math.max(n ? sum / n : all / na, C.WATER + 0.35);
    const touched = new Set<Building>();
    let changed = false;
    const setTo = (x: number, y: number, h: number) => {
      if (Math.abs(World.cornerH(x, y) - h) < 0.01) return;
      for (const i of tilesAt(x, y)) {
        const o = World.bld[i] && World.bld[i] !== b.id && S ? S.buildings.get(World.bld[i]) : null;
        if (o) {
          h = Math.min(h, o.baseY - 0.05);
          touched.add(o);
        }
      }
      if (Math.abs(World.cornerH(x, y) - h) < 0.01) return;
      World.setCorner(x, y, h);
      changed = true;
    };

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!fixed(x, y)) setTo(x, y, target);
      }
    }
    for (let y = y0 - 1; y <= y1 + 1; y++) {
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
        if (x < 0 || y < 0 || x > W || y > W || fixed(x, y)) continue;
        if (tilesAt(x, y).some(i => World.bld[i] && World.bld[i] !== b.id)) continue;
        setTo(x, y, (World.cornerH(x, y) + target) / 2);
      }
    }
    for (const o of touched) {
      let mn = o.minY;
      for (let y = o.y; y <= o.y + o.fh; y++) {
        for (let x = o.x; x <= o.x + o.fw; x++) mn = Math.min(mn, World.cornerH(x, y));
      }
      if (mn < o.minY - 0.01) {
        o.minY = mn;
        if (CB && CB.Meshes) CB.Meshes.refreshBuilding(o);
      }
    }
    if (changed && CB) {
      if (CB.Gfx) CB.Gfx.terrainDirty = true;
      if (CB.Meshes) CB.Meshes.treesDirty = true;
    }
    return changed;
  },

  frontAngle(b: Building): number {
    if (b.kind !== 'zone') return 0;
    const f = b.dir;
    const FRm = [
      [1, 0, 0, 1],
      [0, -1, 1, 0],
      [-1, 0, 0, -1],
      [0, 1, -1, 0],
    ][f];
    let sx = 0,
      sz = 0,
      n = 0;
    for (let y = b.y; y < b.y + b.fh; y++) {
      for (let x = b.x; x < b.x + b.fw; x++) {
        const i = U.idx(x, y),
          j = World.neighbor(i, f);
        if (
          j < 0 ||
          !World.road[j] ||
          (b.x <= U.tx(j) && U.tx(j) < b.x + b.fw && b.y <= U.ty(j) && U.ty(j) < b.y + b.fh)
        )
          continue;
        if (!World.isBent(j)) {
          n++;
          sx += C.DX[(f + 1) % 4];
          sz += C.DY[(f + 1) % 4];
          continue;
        }
        const l2 = World.links2(j);
        if (!l2) continue;
        const dout = l2.includes(World.rdir[j]) ? World.rdir[j] : l2[1];
        const din = ((l2[0] === dout ? l2[1] : l2[0]) + 2) % 4;
        const q = World.bendSeg(j, din, dout, 0, 0);
        let tx = q[4] - q[0],
          tz = q[5] - q[1];
        const l = Math.hypot(tx, tz) || 1;
        tx /= l;
        tz /= l;
        if (n && tx * sx + tz * sz < 0) {
          tx = -tx;
          tz = -tz;
        }
        sx += tx;
        sz += tz;
        n++;
      }
    }
    if (!n) return 0;
    const lx = FRm[0] * sx + FRm[2] * sz;
    const lz = FRm[1] * sx + FRm[3] * sz;
    let a = Math.atan2(lz, lx);
    if (a > Math.PI / 2) a -= Math.PI;
    if (a < -Math.PI / 2) a += Math.PI;
    if (Math.abs(a) < 0.07) return 0;
    return U.clamp(a, -0.7, 0.7);
  },

  applyEdits(list: number[]) {
    World.hcEdits = new Map();
    for (let k = 0; k + 1 < list.length; k += 2) {
      World.hc[list[k]] = list[k + 1];
      World.hcEdits.set(list[k], list[k + 1]);
    }
  },

  cornerH(x: number, y: number): number {
    return World.hc[y * (W + 1) + x];
  },

  tileCorners(i: number): [number, number, number, number] {
    const x = U.tx(i),
      y = U.ty(i);
    return [
      World.cornerH(x, y),
      World.cornerH(x + 1, y),
      World.cornerH(x + 1, y + 1),
      World.cornerH(x, y + 1),
    ];
  },

  tileAvg(i: number): number {
    const c = World.tileCorners(i);
    return (c[0] + c[1] + c[2] + c[3]) / 4;
  },

  tileMin(i: number): number {
    const c = World.tileCorners(i);
    return Math.min(c[0], c[1], c[2], c[3]);
  },

  tileMax(i: number): number {
    const c = World.tileCorners(i);
    return Math.max(c[0], c[1], c[2], c[3]);
  },

  slope(i: number): number {
    const c = World.tileCorners(i);
    return Math.max(c[0], c[1], c[2], c[3]) - Math.min(c[0], c[1], c[2], c[3]);
  },

  isWater(i: number): boolean {
    return World.tileAvg(i) < C.WATER + 0.25;
  },

  groundH(wx: number, wz: number): number {
    let fx = wx / T,
      fy = wz / T;
    fx = U.clamp(fx, 0, W - 0.0001);
    fy = U.clamp(fy, 0, W - 0.0001);
    const x = Math.floor(fx),
      y = Math.floor(fy),
      u = fx - x,
      v = fy - y;
    const a = World.cornerH(x, y),
      b = World.cornerH(x + 1, y),
      c = World.cornerH(x, y + 1),
      d = World.cornerH(x + 1, y + 1);
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  },

  roadH(wx: number, wz: number): number {
    const x = Math.floor(wx / T),
      y = Math.floor(wz / T);
    if (!U.inWorld(x, y)) return World.groundH(wx, wz);
    const i = U.idx(x, y);
    const g = World.groundH(wx, wz);
    if (World.road[i] && World.isWater(i)) return Math.max(g, World.BRIDGE_H) + 0.12;
    return Math.max(g, World.road[i] ? C.WATER + 0.3 : -99) + 0.12;
  },

  deckH(wx: number, wz: number): number {
    return Math.max(World.groundH(wx, wz), C.WATER + 0.5) + 7.5;
  },

  buildable(i: number): boolean {
    const x = U.tx(i),
      y = U.ty(i);
    return U.inPlay(x, y) && !World.isWater(i) && World.slope(i) <= 3.6;
  },

  roadOK(i: number): boolean {
    const x = U.tx(i),
      y = U.ty(i);
    if (!U.inPlay(x, y)) return false;
    if (World.isWater(i)) return World.tileMin(i) > -7;
    return World.slope(i) <= 6;
  },

  roadMask(i: number): number {
    let m = World.link[i];
    if (i === World.outIn || i === World.outOut) m |= 8;
    return m;
  },

  linkTiles(a: number, b: number) {
    const dx = U.tx(b) - U.tx(a),
      dy = U.ty(b) - U.ty(a);
    const d = dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    World.link[a] |= 1 << d;
    World.link[b] |= 1 << ((d + 2) % 4);
  },

  unlinkAll(i: number) {
    for (let d = 0; d < 4; d++) {
      if (!(World.link[i] & (1 << d))) continue;
      const j = World.neighbor(i, d);
      if (j >= 0) World.link[j] &= ~(1 << ((d + 2) % 4));
    }
    World.link[i] = 0;
  },

  unlinkTiles(a: number, b: number) {
    const dx = U.tx(b) - U.tx(a),
      dy = U.ty(b) - U.ty(a);
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    const d = dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3;
    World.link[a] &= ~(1 << d);
    World.link[b] &= ~(1 << ((d + 2) % 4));
  },

  cornerLinks(i: number): [number, number] | null {
    if (!World.road[i] || World.jcl[i] >= 0) return null;
    const m = World.roadMask(i);
    let a = -1,
      b = -1,
      n = 0;
    for (let d = 0; d < 4; d++) {
      if (m & (1 << d)) {
        n++;
        if (a < 0) a = d;
        else b = d;
      }
    }
    if (n !== 2 || (a + b) % 2 === 0) return null;
    return [a, b];
  },

  links2(i: number): [number, number] | null {
    if (!World.road[i] || World.jcl[i] >= 0) return null;
    const m = World.roadMask(i);
    let a = -1,
      b = -1,
      n = 0;
    for (let d = 0; d < 4; d++) {
      if (m & (1 << d)) {
        n++;
        if (a < 0) a = d;
        else b = d;
      }
    }
    return n === 2 ? [a, b] : null;
  },

  clearEdgeCache() {
    eiCache.clear();
    eiVer = World.roadVer;
  },

  edgeInfo(i: number, d: number): [number, number, number, number] {
    if (eiVer !== World.roadVer) {
      eiCache.clear();
      eiVer = World.roadVer;
    }
    const key = i * 4 + d;
    const hit = eiCache.get(key);
    if (hit) return hit;
    const m = edgeMid(i, d);
    let res: [number, number, number, number] = [m[0], m[1], C.DX[d], C.DY[d]];
    const j = World.neighbor(i, d);
    const li = World.links2(i);
    const lj = j >= 0 && World.links2(j);
    if (li && lj && li.includes(d) && World.curv[i] && World.curv[j]) {
      const other = li[0] === d ? li[1] : li[0];
      const jo = lj[0] === (d + 2) % 4 ? lj[1] : lj[0];
      const back = walkEdges(i, other, 3);
      const fwd = walkEdges(j, jo, 3);
      const r = Math.min(back.length, fwd.length, 2);
      if (r > 0) {
        let sx = m[0] * 3,
          sz = m[1] * 3,
          sw = 3;
        for (let k = 0; k < r; k++) {
          const w = 2 - k;
          sx += (back[k][0] + fwd[k][0]) * w;
          sz += (back[k][1] + fwd[k][1]) * w;
          sw += 2 * w;
        }
        const rb = Math.min(back.length, 2);
        const rf = Math.min(fwd.length, 2);
        const a = back[rb - 1];
        const b = fwd[rf - 1];
        let tx = b[0] - a[0],
          tz = b[1] - a[1];
        const l = Math.hypot(tx, tz) || 1;
        res = [sx / sw, sz / sw, tx / l, tz / l];
      }
    }
    eiCache.set(key, res);
    return res;
  },

  isBent(i: number): boolean {
    if (!World.curv[i]) return false;
    const l = World.links2(i);
    if (!l) return false;
    if ((l[0] + l[1]) % 2 === 1) return true;
    for (const d of l) {
      const e = World.edgeInfo(i, d),
        m = edgeMid(i, d);
      if (
        Math.abs(e[2] - C.DX[d]) + Math.abs(e[3] - C.DY[d]) > 0.02 ||
        Math.abs(e[0] - m[0]) + Math.abs(e[1] - m[1]) > 0.05
      )
        return true;
    }
    return false;
  },

  bendSeg(
    i: number,
    din: number,
    dout: number,
    offIn: number,
    offOut: number
  ): [number, number, number, number, number, number] {
    const a = World.edgeInfo(i, (din + 2) % 4),
      b = World.edgeInfo(i, dout);
    const ax = -a[2],
      az = -a[3],
      bx = b[2],
      bz = b[3];
    const ex = a[0] - az * offIn,
      ez = a[1] + ax * offIn,
      xx = b[0] - bz * offOut,
      xz = b[1] + bx * offOut;
    const L = Math.hypot(xx - ex, xz - ez) / 3;
    const p1x = ex + ax * L,
      p1z = ez + az * L,
      p2x = xx - bx * L,
      p2z = xz - bz * L;
    return [ex, ez, (3 * (p1x + p2x) - (ex + xx)) / 4, (3 * (p1z + p2z) - (ez + xz)) / 4, xx, xz];
  },

  isUturnLink(a: number, d: number): boolean {
    const b = World.neighbor(a, d);
    if (b < 0) return false;
    const Ra = C.ROADS[World.road[a]];
    const Rb = C.ROADS[World.road[b]];
    if (!Ra || !Rb || Ra.w !== 2 || Rb.w !== 2) return false;
    if (World.linked(a, (d + 2) % 4) || World.linked(b, d)) return false;
    return World.rdir[a] % 2 !== d % 2 && World.rdir[b] === (World.rdir[a] + 2) % 4;
  },

  joinDeadEnds() {
    for (let i = 0; i < W * W; i++) {
      if (!World.road[i] || !C.ROADS[World.road[i]]?.car) continue;
      const m = World.link[i];
      let n = 0,
        d0 = -1;
      for (let d = 0; d < 4; d++) {
        if (m & (1 << d)) {
          n++;
          d0 = d;
        }
      }
      if (n > 1) continue;
      const dirs = n === 1 ? [(d0 + 2) % 4] : [0, 1, 2, 3];
      for (const d of dirs) {
        const o = World.neighbor(i, d);
        if (
          o >= 0 &&
          World.road[o] &&
          C.ROADS[World.road[o]]?.car &&
          !(World.rpart[i] && World.rpart[i] - 1 === d)
        ) {
          World.linkTiles(i, o);
          break;
        }
      }
    }
  },

  fidx: (fx: number, fy: number): number => fy * C.FW + fx,
  cellOf: (i: number, q: number): number => World.fidx(U.tx(i) * 2 + (q & 1), U.ty(i) * 2 + (q >> 1)),

  setPath(f: number, k: number) {
    World.pcell[f] = k;
    const fx = f % C.FW,
      fy = (f / C.FW) | 0,
      i = U.idx(fx >> 1, fy >> 1),
      q = (fy & 1) * 2 + (fx & 1);
    if (k) World.pmask[i] |= 1 << q;
    else World.pmask[i] &= ~(1 << q);
  },

  rebuildPmask() {
    World.pmask.fill(0);
    for (let f = 0; f < C.FW * C.FW; f++) {
      if (World.pcell[f]) {
        const fx = f % C.FW,
          fy = (f / C.FW) | 0;
        World.pmask[U.idx(fx >> 1, fy >> 1)] |= 1 << ((fy & 1) * 2 + (fx & 1));
      }
    }
  },

  walkRoad: (i: number): boolean => {
    const R = C.ROADS[World.road[i]];
    return !!R && R.grp !== 'highway' && R.grp !== 'legacy';
  },

  edgeCells(i: number, d: number): [[number, number], [number, number]] {
    const x = U.tx(i) * 2,
      y = U.ty(i) * 2;
    if (d === 1)
      return [
        [World.fidx(x + 1, y), World.fidx(x + 2, y)],
        [World.fidx(x + 1, y + 1), World.fidx(x + 2, y + 1)],
      ];
    if (d === 3)
      return [
        [World.fidx(x, y), World.fidx(x - 1, y)],
        [World.fidx(x, y + 1), World.fidx(x - 1, y + 1)],
      ];
    if (d === 2)
      return [
        [World.fidx(x, y + 1), World.fidx(x, y + 2)],
        [World.fidx(x + 1, y + 1), World.fidx(x + 1, y + 2)],
      ];
    return [
      [World.fidx(x, y), World.fidx(x, y - 1)],
      [World.fidx(x + 1, y), World.fidx(x + 1, y - 1)],
    ];
  },

  softPass(i: number, d: number): number {
    const j = World.neighbor(i, d);
    if (j < 0) return -1;
    const ri = World.walkRoad(i),
      rj = World.walkRoad(j);
    if (ri && rj) return 0;
    if (!World.pmask[i] && !World.pmask[j]) return -1;
    for (const [a, b] of World.edgeCells(i, d)) {
      const ok =
        (World.pcell[a] || ri) &&
        (World.pcell[b] || rj) &&
        (World.pcell[a] || World.pcell[b]);
      if (ok) return 1;
    }
    return -1;
  },

  linked: (i: number, d: number): boolean => (World.link[i] & (1 << d)) !== 0,

  isOneway(i: number): boolean {
    const R = C.ROADS[World.road[i]];
    return !!R && (R.oneway || R.w === 2);
  },

  canDrive(i: number, d: number): boolean {
    if (!(World.roadMask(i) & (1 << d))) return false;
    const j = World.neighbor(i, d);
    if (j < 0) return false;
    const Rj = C.ROADS[World.road[j]];
    if (!Rj || !Rj.car) return false;
    const op = (d + 2) % 4;
    if (World.isOneway(i) && World.jcl[i] < 0 && World.rdir[i] === op) return false;
    if (World.isOneway(j) && World.jcl[j] < 0 && World.rdir[j] === op) return false;
    return true;
  },

  railMask(i: number): number {
    const x = U.tx(i),
      y = U.ty(i);
    let m = 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + C.DX[d],
        ny = y + C.DY[d];
      if (U.inWorld(nx, ny) && World.rail[U.idx(nx, ny)]) m |= 1 << d;
    }
    return m;
  },

  degree(i: number): number {
    const m = World.roadMask(i);
    let c = 0;
    for (let d = 0; d < 4; d++) if (m & (1 << d)) c++;
    return c;
  },

  updateZonable() {
    const z = World.zonable;
    z.fill(0);
    for (let i = 0; i < W * W; i++) {
      const r = World.road[i];
      if (!r || !C.ROADS[r]?.zonable) continue;
      const x = U.tx(i),
        y = U.ty(i);
      for (let d = 0; d < 4; d++) {
        for (let k = 1; k <= 3; k++) {
          const nx = x + C.DX[d] * k,
            ny = y + C.DY[d] * k;
          if (!U.inPlay(nx, ny)) break;
          const j = U.idx(nx, ny);
          if (World.road[j] || World.pmask[j]) break;
          if (!World.buildable(j) || World.rail[j] === 1) break;
          z[j] = 1;
        }
      }
    }
  },

  updateConn() {
    const c = World.conn;
    c.fill(0);
    const q: number[] = [];
    for (const o of World.outside) {
      if (World.road[o]) {
        c[o] = 1;
        q.push(o);
      }
    }
    while (q.length) {
      const i = q.pop()!;
      for (let d = 0; d < 4; d++) {
        if (!World.linked(i, d)) continue;
        const j = World.neighbor(i, d);
        if (j >= 0 && World.road[j] && !c[j]) {
          c[j] = 1;
          q.push(j);
        }
      }
    }
  },

  relTurn: (din: number, dout: number): number => [1, 2, 8, 4][(dout - din + 4) % 4],

  updateJunctions() {
    const N = W * W;
    const jcl = World.jcl;
    jcl.fill(-1);
    const old = World.jcfg;
    World.jcfg = new Map();
    World.clusters = [];
    for (let i = 0; i < N; i++) {
      if (!World.road[i] || jcl[i] >= 0 || World.degree(i) < 3) continue;
      const id = World.clusters.length;
      const tiles = [i];
      const q = [i];
      jcl[i] = id;
      while (q.length) {
        const t = q.pop()!;
        for (let d = 0; d < 4; d++) {
          if (!World.linked(t, d)) continue;
          const j = World.neighbor(t, d);
          if (j >= 0 && jcl[j] < 0 && World.road[j] && World.degree(j) >= 3) {
            jcl[j] = id;
            tiles.push(j);
            q.push(j);
          }
        }
      }
      World.clusters.push({
        id,
        tiles,
        aps: [],
        exits: [],
        cx: 0,
        cy: 0,
        rank: 0,
        cars: false,
        cfg: { ctrl: 'auto', stops: {}, lanes: {} },
        avail: [0, 0, 0, 0],
        mask: [0, 0, 0, 0],
        ctrl: 'none',
        phase: 0,
        pt: Math.random() * 8,
      });
    }

    for (const cl of World.clusters) {
      cl.aps = [];
      cl.exits = [];
      let rank = 0;
      let cars = false;
      let cx = 0;
      let cy = 0;
      for (const t of cl.tiles) {
        cx += U.tx(t);
        cy += U.ty(t);
        for (let d = 0; d < 4; d++) {
          if (!World.linked(t, d)) continue;
          const o = World.neighbor(t, d);
          if (o < 0 || jcl[o] === cl.id) continue;
          const Ro = C.ROADS[World.road[o]];
          if (Ro) {
            rank = Math.max(rank, C.GRP_RANK[Ro.grp]);
            if (Ro.car) cars = true;
          }
          const din = (d + 2) % 4;
          if (Ro && Ro.car && World.canDrive(o, din)) {
            cl.aps.push({
              tile: o,
              into: t,
              d: din,
              key: o * 4 + din,
              lanes: World.lanesToward(o, din).length,
            });
          }
          if (Ro && Ro.car && World.canDrive(t, d)) {
            cl.exits.push({ tile: o, from: t, d });
          }
        }
      }
      cl.cx = cx / cl.tiles.length + 0.5;
      cl.cy = cy / cl.tiles.length + 0.5;
      cl.rank = rank;
      cl.cars = cars;
      let cfg: JunctionConfig | null = null;
      for (const t of cl.tiles) {
        if (old.has(t)) {
          cfg = old.get(t)!;
          break;
        }
      }
      if (!cfg) cfg = { ctrl: 'auto', stops: {}, lanes: {} };
      cl.cfg = cfg;
      for (const t of cl.tiles) World.jcfg.set(t, cfg);

      cl.avail = [0, 0, 0, 0];
      for (const ap of cl.aps) {
        for (const ex of cl.exits) cl.avail[ap.d] |= World.relTurn(ap.d, ex.d);
      }
      for (const ap of cl.aps) {
        const cur = cfg.lanes[ap.key];
        if (!cur || cur.length !== ap.lanes || cur.some(m => !(m & cl.avail[ap.d]))) {
          cfg.lanes[ap.key] = World.defaultLanes(ap.lanes, cl.avail[ap.d]);
        }
      }
      cl.mask = [0, 0, 0, 0];
      for (const ap of cl.aps) {
        for (const m of cfg.lanes[ap.key]) cl.mask[ap.d] |= m;
      }
      cl.ctrl = World.ctrlOf(cl);
      cl.phase = 0;
      cl.pt = Math.random() * 8;
    }
  },

  ctrlOf(cl: JunctionCluster): string {
    const c = cl.cfg.ctrl;
    if (c !== 'auto') return c;
    if (!cl.cars || cl.aps.length < 3) return 'none';
    return cl.rank >= 2 ? 'lights' : 'none';
  },

  defaultLanes(n: number, avail: number): number[] {
    const { S, R, L, U: UT } = World.TURN;
    const out: number[] = [];
    if (n <= 1) out.push(S | R | L);
    else if (n === 2) out.push(S | R, L | S);
    else {
      out.push(R | S);
      for (let k = 1; k < n - 1; k++) out.push(S);
      out.push(L);
    }
    for (let k = 0; k < out.length; k++) {
      out[k] &= avail;
      if (!out[k]) out[k] = (avail & (S | R | L)) || avail;
    }
    for (const t of [S, R, L]) {
      if (avail & t && !out.some(m => m & t)) {
        if (t === R) out[0] |= t;
        else out[out.length - 1] |= t;
      }
    }
    if (!(avail & (S | R | L)) && avail & UT) out[out.length - 1] |= UT;
    return out;
  },

  lanesToward(i: number, d: number): number[] {
    const R = C.ROADS[World.road[i]];
    if (!R) return [1.6];
    const L = R.L!;
    if (!R.car) return [0];
    if (R.oneway || R.w === 2 || !L.back.length) return L.fwd;
    const f = World.rdir[i];
    if (d === (f + 2) % 4) return L.back;
    if (d === f) return L.fwd;
    return R.back > R.fwd ? L.back : L.fwd;
  },

  createDistrict,
  deleteDistrict,
  paintDistrict,
  eraseDistrict,
  districtAt,
  updateDistrictCentroids,
  updateDistrictStats,

  neighbor: (i: number, d: number): number => {
    const x = U.tx(i) + C.DX[d],
      y = U.ty(i) + C.DY[d];
    return U.inWorld(x, y) ? U.idx(x, y) : -1;
  },

  center: (i: number): [number, number] => [(U.tx(i) + 0.5) * T, (U.ty(i) + 0.5) * T],
};
