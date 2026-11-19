import { C } from '../core/constants';
import { U } from '../core/utils';
import { World } from '../world/world';
import { Traffic } from '../traffic/traffic';
import { TransitStop, TransitStopTarget, TransitLine, TransitLeg, TransitRoute, TransitWaitingPassenger, TransitTrain, Vehicle, SerializedTransit } from '../types';

type TransitGraphEdge = [number, number, 'b' | 'a' | 'r' | 'w', number];

interface TransitGraph {
  S: number;
  idx: Map<number, number>;
  adj: TransitGraphEdge[][];
  dist: Float32Array;
  preds: [Int32Array, Int32Array][];
  legCache: Map<number, TransitLeg[]>;
}

interface TransitPassengerCarrier {
  pass?: TransitWaitingPassenger[];
  load?: number;
}

const T = C.TILE;
const byId = new Map<number, TransitStop>();
const colCache: Record<string, [number, number, number]> = {};

function lcCol(hex: string): [number, number, number] {
  if (!colCache[hex]) {
    const a = U.hex(hex);
    colCache[hex] = [U.lin(a[0]), U.lin(a[1]), U.lin(a[2])];
  }
  return colCache[hex];
}

const STREETS = [
  'Maple', 'Harbour', 'Station', 'Elm', 'Union', 'King', 'Queen', 'Mill', 'Bridge', 'Park',
  'Market', 'Victoria', 'Cedar', 'Lake', 'Spring', 'Ridge', 'Granite', 'Willow', 'Beacon', 'Orchard',
  'Pine', 'Front', 'Church', 'College', 'Dundas', 'Bay', 'Albion', 'Linden',
];

function nameFor(type: string): string {
  const n = STREETS[(Transit.nextStop * 7) % STREETS.length];
  return type === 'bus' ? n + ' St' : type === 'tram' ? n + ' Stop' : n + ' Station';
}

function railY(i: number, wx: number, wz: number): number {
  return World.rail[i] === 1 ? World.deckH(wx, wz) + 0.32 : World.groundH(wx, wz) - 10;
}

function buildPoly(l: TransitLine) {
  const p = l.path!,
    n = p.length,
    pts: number[] = [];
  const off = 1.75;
  for (let k = 0; k < n; k++) {
    const cur = p[k],
      prev = p[(k - 1 + n) % n],
      next = p[(k + 1) % n];
    const cx = (U.tx(cur) + 0.5) * T,
      cz = (U.ty(cur) + 0.5) * T;
    let ix = Math.sign(U.tx(cur) - U.tx(prev)),
      iz = Math.sign(U.ty(cur) - U.ty(prev));
    let ox = Math.sign(U.tx(next) - U.tx(cur)),
      oz = Math.sign(U.ty(next) - U.ty(cur));
    if (n === 1) {
      ix = ox = 1;
      iz = oz = 0;
    }
    if (ix === 0 && iz === 0) {
      ix = ox;
      iz = oz;
    }
    if (ox === 0 && oz === 0) {
      ox = ix;
      oz = iz;
    }
    const rix = -iz,
      riz = ix,
      rox = -oz,
      roz = ox;
    const ex = cx - (ix * T) / 2 + rix * off,
      ez = cz - (iz * T) / 2 + riz * off;
    const xx = cx + (ox * T) / 2 + rox * off,
      xz = cz + (oz * T) / 2 + roz * off;
    let qx: number, qz: number;
    if (ix === ox && iz === oz) {
      qx = (ex + xx) / 2;
      qz = (ez + xz) / 2;
    } else if (ix === -ox && iz === -oz) {
      qx = cx + ix * T * 0.5;
      qz = cz + iz * T * 0.5;
    } else {
      qx = cx + rix * off + rox * off;
      qz = cz + riz * off + roz * off;
    }
    for (let s = 0; s < 4; s++) {
      const t = s / 4,
        u = 1 - t;
      const x = u * u * ex + 2 * u * t * qx + t * t * xx,
        z = u * u * ez + 2 * u * t * qz + t * t * xz;
      pts.push(x, railY(cur, x, z), z);
    }
  }
  const m = pts.length / 3,
    cum = new Float32Array(m + 1);
  for (let k = 0; k < m; k++) {
    const a = k * 3,
      b = ((k + 1) % m) * 3;
    cum[k + 1] = cum[k] + Math.hypot(pts[b] - pts[a], pts[b + 2] - pts[a + 2]);
  }
  l.poly = pts;
  l.cum = cum;
  l.plen = cum[m];
  l.stopS = l.sidx!.map(i => cum[i * 4 + 2]);
}

function polyAt(l: TransitLine, s: number, out: number[]) {
  const L = l.plen!;
  s = ((s % L) + L) % L;
  const cum = l.cum!,
    m = l.poly!.length / 3;
  let lo = 0,
    hi = m;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  const a = lo * 3,
    b = ((lo + 1) % m) * 3;
  const seg = cum[lo + 1] - cum[lo] || 1,
    t = (s - cum[lo]) / seg;
  const P = l.poly!;
  out[0] = P[a] + (P[b] - P[a]) * t;
  out[1] = P[a + 1] + (P[b + 1] - P[a + 1]) * t;
  out[2] = P[a + 2] + (P[b + 2] - P[a + 2]) * t;
  const dx = P[b] - P[a],
    dz = P[b + 2] - P[a + 2],
    dl = Math.hypot(dx, dz) || 1;
  out[3] = dx / dl;
  out[4] = dz / dl;
}

function lanePoly(l: TransitLine): number[] {
  const p = l.path!,
    n = p.length,
    pts: number[] = [];
  const stack = Transit.lines.filter(q => q.type !== 'rail' && q.path).indexOf(l) % 3;
  for (let k = 0; k < n; k++) {
    const cur = p[k],
      prev = p[(k - 1 + n) % n],
      next = p[(k + 1) % n];
    const cx = (U.tx(cur) + 0.5) * T,
      cz = (U.ty(cur) + 0.5) * T;
    let ix = Math.sign(U.tx(cur) - U.tx(prev)),
      iz = Math.sign(U.ty(cur) - U.ty(prev));
    let ox = Math.sign(U.tx(next) - U.tx(cur)),
      oz = Math.sign(U.ty(next) - U.ty(cur));
    if (n === 1 || (!ix && !iz)) {
      ix = ox || 1;
      iz = oz;
    }
    if (!ox && !oz) {
      ox = ix;
      oz = iz;
    }
    const din = iz < 0 ? 0 : ix > 0 ? 1 : iz > 0 ? 2 : 3,
      dout = oz < 0 ? 0 : ox > 0 ? 1 : oz > 0 ? 2 : 3;
    const ln = Traffic.boundaryLanes(prev, cur, din),
      lo = Traffic.boundaryLanes(cur, next, dout);
    const offI = ln[0] - 0.35 * stack,
      offO = lo[0] - 0.35 * stack;
    const rix = -iz,
      riz = ix,
      rox = -oz,
      roz = ox;
    let ex = cx - (ix * T) / 2 + rix * offI,
      ez = cz - (iz * T) / 2 + riz * offI,
      xx = cx + (ox * T) / 2 + rox * offO,
      xz = cz + (oz * T) / 2 + roz * offO;
    let qx: number, qz: number;
    if (ix === ox && iz === oz) {
      qx = (ex + xx) / 2;
      qz = (ez + xz) / 2;
    } else if (ix === -ox && iz === -oz) {
      qx = cx + ix * T * 0.4;
      qz = cz + iz * T * 0.4;
    } else {
      qx = cx + rix * offI + rox * offO;
      qz = cz + riz * offI + roz * offO;
    }
    if (World.jcl[cur] < 0 && ix !== -ox && World.isBent(cur)) {
      const q = World.bendSeg(cur, din, dout, offI, offO);
      [ex, ez, qx, qz, xx, xz] = q;
    }
    const m = ix === ox && iz === oz && !World.isBent(cur) ? 1 : 5;
    for (let s = 0; s < m; s++) {
      const t = s / m,
        u = 1 - t;
      const x = u * u * ex + 2 * u * t * qx + t * t * xx,
        z = u * u * ez + 2 * u * t * qz + t * t * xz;
      pts.push(x, World.roadH(x, z) + 0.32, z);
    }
  }
  return pts;
}

function drawRibbon(l: TransitLine) {
  const CB = (window as any).CB;
  const Mx = CB?.Meshes;
  if (!Mx) return;
  if (l.ribbon) {
    Mx.lineGroup.remove(l.ribbon);
    l.ribbon.geometry.dispose();
    l.ribbon = undefined;
  }
  if (!l.path) return;
  let pts: number[] = [];
  if (l.type !== 'rail') pts = lanePoly(l);
  else {
    for (const i of l.path) {
      const x = (U.tx(i) + 0.5) * T,
        z = (U.ty(i) + 0.5) * T;
      pts.push(
        x,
        World.rail[i] === 1 ? World.deckH(x, z) + 1.6 : Math.max(World.groundH(x, z), C.WATER) + 2.2,
        z
      );
    }
  }
  l.ribbon = Mx.ribbon(pts, l.type !== 'rail' ? 1.1 : 2.4, l.color, true);
  if (l.ribbon) {
    l.ribbon.visible = Transit.ribbonsOn;
    Mx.lineGroup.add(l.ribbon);
  }
}

function removeVehicles(l: TransitLine) {
  Traffic.vehicles = Traffic.vehicles.filter((v: Vehicle) => v.line !== l);
  Transit.trains = Transit.trains.filter(t => t.line !== l);
}

function spawnVehicles(l: TransitLine) {
  removeVehicles(l);
  if (!l.path || l.broken) return;
  const n = l.vehicles;
  if (l.type !== 'rail') {
    for (let k = 0; k < n; k++) {
      const startK = Math.floor((k * l.stops.length) / n) % l.stops.length;
      const CB = (window as any).CB;
      const v = Traffic.spawn({
        kind: l.type,
        path: l.path,
        loop: true,
        col: CB?.Meshes?.CAR_COLORS && lcCol(l.color),
      });
      if (!v) continue;
      v.line = l;
      v.pass = [];
      v.load = 0;
      v.seg = l.sidx![startK];
      v.t = 0;
      v.stopK = (startK + 1) % l.stops.length;
      v.stopAt = l.sidx![v.stopK];
      v.onStop = busAtStop;
      v.onBroken = () => {};
      resetSeg(v);
    }
  } else {
    for (let k = 0; k < n; k++) {
      const s = (l.plen! * k) / n;
      let nk = 0;
      while (nk < l.stopS!.length && l.stopS![nk] <= s + 0.1) nk++;
      Transit.trains.push({
        line: l,
        s,
        v: 0,
        dwell: 0,
        pass: [],
        load: 0,
        nextK: nk % l.stopS!.length,
      });
    }
  }
}

function resetSeg(v: Vehicle) {
  v.t = 0;
  v.seg = (v.seg || 0) % (v.path?.length || 1);
  Traffic._setup(v);
}

function serveStop(veh: TransitPassengerCarrier, l: TransitLine, stop: TransitStop, cap: number): number {
  let boarded = 0;
  veh.pass = veh.pass || [];
  veh.load = veh.load || 0;
  const stay: TransitWaitingPassenger[] = [];
  const CB = (window as any).CB;
  for (const p of veh.pass) {
    const leg = p.legs[p.li];
    if (leg.to === stop.id) {
      veh.load -= p.n;
      p.li++;
      if (p.li >= p.legs.length) {
        Transit.stats.riders += p.n;
        if (p.onDone) p.onDone(p);
      } else {
        p.t0 = Traffic.time;
        stop.waiting.push(p);
      }
    } else stay.push(p);
  }
  veh.pass = stay;
  const left: TransitWaitingPassenger[] = [];
  const fare = Transit.fareOf(l) * C.TRIP_K;
  for (const p of stop.waiting) {
    const leg = p.legs[p.li];
    if (leg.line === l.id && veh.load + p.n <= cap) {
      veh.pass.push(p);
      veh.load += p.n;
      boarded += p.n;
      l.ridersMonth += p.n;
      if (CB?.Sim) CB.Sim.earn('fares', fare * p.n);
    } else left.push(p);
  }
  stop.waiting = left;
  return boarded;
}

function busAtStop(v: Vehicle) {
  const l = v.line;
  if (!l || !l.path) return;
  const stop = byId.get(l.stops[v.stopK]);
  let b = 0;
  if (stop) b = serveStop(v, l, stop, C.TRANSIT[l.type]?.cap || 30);
  v.dwell = 1.4 + b * 0.04;
  v.stopK = (v.stopK + 1) % l.stops.length;
  v.stopAt = l.sidx![v.stopK];
  if (l.stops.length === 1) v.stopAt = -99;
}

let graph: TransitGraph | null = null;

function legs(o: number, d: number): TransitLeg[] {
  if (!graph) return [];
  const key = o * 100000 + d;
  if (graph.legCache.has(key)) return graph.legCache.get(key)!;
  const [P, PE] = graph.preds[o];
  const nodes: number[] = [],
    edges: TransitGraphEdge[] = [];
  for (let v = d; v !== o && v !== -1; v = P[v]) {
    nodes.push(v);
    edges.push(graph.adj[P[v]][PE[v]]);
  }
  nodes.reverse();
  edges.reverse();
  const out: TransitLeg[] = [];
  let cur: TransitLeg | null = null;
  let prevStop = o;
  for (let k = 0; k < edges.length; k++) {
    const e = edges[k];
    if (e[2] === 'b') {
      cur = { line: e[3], from: Transit.stops[prevStop].id, to: -1 };
    } else if (e[2] === 'a') {
      if (cur) {
        cur.to = Transit.stops[nodes[k]].id;
        out.push(cur);
        cur = null;
      }
      prevStop = nodes[k];
    } else if (e[2] === 'w') {
      prevStop = nodes[k];
    }
  }
  graph.legCache.set(key, out);
  return out;
}

const tmp = [0, 0, 0, 0, 0];

export const Transit = {
  stops: [] as TransitStop[],
  lines: [] as TransitLine[],
  trains: [] as TransitTrain[],
  nextStop: 1,
  nextLine: 1,
  dirty: true,
  COLORS: [
    '#e8443a', '#2f86e0', '#2fb35a', '#f2a31b', '#9b4fd8',
    '#16b5b0', '#e0569b', '#8a6a3a', '#5b6bd8', '#c8c43a',
  ],
  WALK_V: 6,
  stats: { riders: 0, waiting: 0 },
  ribbonsOn: false,

  stopById: (id: number): TransitStop | undefined => byId.get(id),
  lineById: (id: number): TransitLine | undefined => Transit.lines.find(l => l.id === id),

  stopAtTile(tile: number, type?: string, side?: number): TransitStop | undefined {
    return Transit.stops.find(
      s =>
        s.tile === tile &&
        (!type || s.type === type) &&
        (side === undefined || s.type === 'rail' || s.side === side)
    );
  },

  roadAxis(tile: number): number {
    const m = World.roadMask(tile);
    if (m & 5) return 0;
    if (m & 10) return 1;
    return World.rdir[tile] % 2;
  },

  sideAt(tile: number, wx: number, wz: number): number {
    const R = C.ROADS[World.road[tile]];
    const cx = (U.tx(tile) + 0.5) * T,
      cz = (U.ty(tile) + 0.5) * T;
    if (R && World.isOneway(tile)) return (World.rdir[tile] + 1) % 4;
    return Transit.roadAxis(tile) === 0 ? (wx > cx ? 1 : 3) : wz > cz ? 2 : 0;
  },

  defaultSide(tile: number): number {
    return World.road[tile]
      ? Transit.sideAt(tile, (U.tx(tile) + 0.6) * T, (U.ty(tile) + 0.6) * T)
      : 2;
  },

  stopHeading: (s: TransitStopTarget): number => (s.side != null ? (s.side + 3) % 4 : 0),

  canPlaceStop(type: 'bus' | 'tram' | 'rail', tile: number, side?: number): string | null {
    if (type === 'rail') {
      if (Transit.stopAtTile(tile, 'rail')) return 'A station already exists here';
      return World.rail[tile] ? null : 'Stations go on rail track';
    }
    const R = C.ROADS[World.road[tile]];
    if (type === 'bus') {
      if (!R || !R.car) return 'Bus stops go on roads';
      if (R.grp === 'highway') return 'Buses cannot stop on highways';
    } else if (!R || !R.tram) return 'Streetcar stops go on roads with tram tracks';
    if (World.jcl[tile] >= 0) return 'Stops cannot go inside an intersection';
    const l2 = World.links2(tile);
    if (l2 && (l2[0] + l2[1]) % 2) return 'Stops need a straight piece of road';
    if (side === undefined) side = Transit.defaultSide(tile);
    if (World.linked(tile, side)) return 'Stops need a straight piece of road';
    if (World.isOneway(tile) && side !== (World.rdir[tile] + 1) % 4)
      return 'On a one-way road the stop goes on the right';
    if (Transit.stopAtTile(tile, type, side)) return 'A stop already exists on this side';
    return null;
  },

  addStop(type: 'bus' | 'tram' | 'rail', tile: number, name?: string, side?: number): TransitStop {
    const s: TransitStop = {
      id: Transit.nextStop++,
      type,
      tile,
      side: type === 'rail' ? 0 : side === undefined ? Transit.defaultSide(tile) : side,
      name: name || nameFor(type),
      waiting: [],
      color: null,
    };
    Transit.stops.push(s);
    byId.set(s.id, s);
    const CB = (window as any).CB;
    if (CB?.Meshes) CB.Meshes.markInfra(tile);
    Transit.dirty = true;
    return s;
  },

  removeStop(s: TransitStop) {
    Transit.stops = Transit.stops.filter(q => q !== s);
    byId.delete(s.id);
    for (const l of Transit.lines.slice()) {
      if (l.stops.includes(s.id)) {
        l.stops = l.stops.filter(id => id !== s.id);
        if (l.stops.length < 2) Transit.deleteLine(l);
        else Transit.buildLine(l);
      }
    }
    const CB = (window as any).CB;
    if (CB?.Meshes) CB.Meshes.markInfra(s.tile);
    Transit.dirty = true;
  },

  createLine(type: 'bus' | 'tram' | 'rail', stopIds: number[]): TransitLine {
    const n = Transit.lines.filter(l => l.type === type).length + 1;
    const color = Transit.COLORS[(Transit.nextLine - 1) % Transit.COLORS.length];
    const l: TransitLine = {
      id: Transit.nextLine++,
      type,
      name: ({ bus: 'Bus ', tram: 'Streetcar ', rail: 'Metro ' } as any)[type] + n,
      color,
      stops: stopIds.slice(),
      vehicles: type === 'rail' ? 1 : 2,
      fare: C.TRANSIT[type].fare,
      ridersMonth: 0,
      ridersLast: 0,
      broken: false,
    };
    Transit.lines.push(l);
    Transit.buildLine(l);
    for (const id of l.stops) {
      const s = byId.get(id);
      if (s && !s.color) {
        s.color = color;
        const CB = (window as any).CB;
        if (CB?.Meshes) CB.Meshes.markInfra(s.tile);
      }
    }
    Transit.dirty = true;
    return l;
  },

  deleteLine(l: TransitLine) {
    removeVehicles(l);
    const CB = (window as any).CB;
    if (l.ribbon && CB?.Meshes) {
      CB.Meshes.lineGroup.remove(l.ribbon);
      l.ribbon.geometry.dispose();
    }
    Transit.lines = Transit.lines.filter(q => q !== l);
    for (const s of Transit.stops) {
      s.waiting = s.waiting.filter(p => !p.legs.some((g: TransitLeg) => g.line === l.id));
    }
    Transit.dirty = true;
  },

  setVehicles(l: TransitLine, n: number) {
    l.vehicles = U.clamp(n, 1, l.type === 'rail' ? 8 : 12);
    spawnVehicles(l);
    Transit.dirty = true;
  },

  segPath(type: string, a: TransitStopTarget | number, b: TransitStopTarget | number): number[] | null {
    if (type === 'rail') {
      return Traffic.findRailPath(
        typeof a === 'object' ? a.tile : a,
        typeof b === 'object' ? b.tile : b
      );
    }
    const at = typeof a === 'object' ? a.tile : a,
      bt = typeof b === 'object' ? b.tile : b;
    const sd = typeof a === 'object' ? Transit.stopHeading(a) : null,
      dd = typeof b === 'object' ? Transit.stopHeading(b) : null;
    return Traffic.findPathDir(at, sd, bt, dd, type === 'tram');
  },

  isRoadLine: (type: string) => type === 'bus' || type === 'tram',
  fareOf: (l: TransitLine) => (l.fare !== undefined ? l.fare : C.TRANSIT[l.type]?.fare || 2),

  buildLine(l: TransitLine): boolean {
    const st = l.stops.map(id => byId.get(id)!),
      tiles = st.map(s => s.tile);
    const path: number[] = [],
      sidx: number[] = [];
    l.broken = false;
    for (let k = 0; k < tiles.length; k++) {
      const a = st[k],
        b = st[(k + 1) % st.length];
      const p = Transit.segPath(l.type, a, b);
      if (!p) {
        l.broken = true;
        break;
      }
      sidx.push(path.length);
      const s = p.slice(0, p.length - 1);
      if (!s.length) s.push(a.tile);
      path.push(...s);
    }
    if (l.broken) {
      removeVehicles(l);
      l.path = undefined;
      drawRibbon(l);
      return false;
    }
    l.path = path;
    l.sidx = sidx;
    l.length = path.length * T;
    const sp = (C.TRANSIT[l.type]?.speed || 10) * C.VEH_SPEED;
    l.loopTime =
      l.length / (sp * (l.type !== 'rail' ? 0.7 : 0.85)) +
      l.stops.length * (l.type !== 'rail' ? 2 : 3);
    if (l.type === 'rail') buildPoly(l);
    drawRibbon(l);
    spawnVehicles(l);
    return true;
  },

  showRibbons(on: boolean, only?: TransitLine | null) {
    Transit.ribbonsOn = on;
    for (const l of Transit.lines) {
      if (l.ribbon) l.ribbon.visible = on || l === only;
    }
  },

  rebuildGraph() {
    Transit.dirty = false;
    const S = Transit.stops.length;
    const idx = new Map<number, number>();
    Transit.stops.forEach((s, k) => idx.set(s.id, k));
    const adj: TransitGraphEdge[][] = [];
    for (let k = 0; k < S; k++) adj.push([]);
    for (const l of Transit.lines) {
      if (!l.path || l.broken) continue;
      const base = adj.length;
      const sp = (C.TRANSIT[l.type]?.speed || 10) * C.VEH_SPEED * (l.type !== 'rail' ? 0.65 : 0.85);
      const wait =
        Math.min(25, (l.loopTime || 30) / (2 * Math.max(1, l.vehicles))) +
        Math.max(-4, (Transit.fareOf(l) - (C.TRANSIT[l.type]?.fare || 2)) * 9);
      const n = l.stops.length;
      for (let k = 0; k < n; k++) adj.push([]);
      for (let k = 0; k < n; k++) {
        const si = idx.get(l.stops[k])!;
        const node = base + k;
        adj[si].push([node, wait, 'b', l.id]);
        adj[node].push([si, 2, 'a', l.id]);
        const a = l.sidx![k],
          b = k + 1 < n ? l.sidx![k + 1] : l.path.length;
        const dist = (b - a) * T;
        adj[node].push([
          base + ((k + 1) % n),
          dist / sp + (l.type !== 'rail' ? 2 : 3),
          'r',
          l.id,
        ]);
      }
    }
    for (let a = 0; a < S; a++) {
      for (let b = 0; b < S; b++) {
        if (a === b) continue;
        const d = U.dist(Transit.stops[a].tile, Transit.stops[b].tile);
        if (d <= 4) adj[a].push([b, (d * T) / Transit.WALK_V + 4, 'w', 0]);
      }
    }
    const V = adj.length;
    const dist = new Float32Array(S * S).fill(Infinity);
    const preds: [Int32Array, Int32Array][] = [];
    const h = new U.Heap();
    for (let s = 0; s < S; s++) {
      const D = new Float32Array(V).fill(Infinity),
        P = new Int32Array(V).fill(-1),
        PE = new Int32Array(V).fill(-1);
      D[s] = 0;
      h.clear();
      h.push(s, 0);
      while (h.size) {
        const u = h.pop();
        for (let e = 0; e < adj[u].length; e++) {
          const [v, w] = adj[u][e];
          const nd = D[u] + w;
          if (nd < D[v]) {
            D[v] = nd;
            P[v] = u;
            PE[v] = e;
            h.push(v, nd);
          }
        }
      }
      for (let t = 0; t < S; t++) dist[s * S + t] = D[t];
      preds.push([P, PE]);
    }
    graph = { S, idx, adj, dist, preds, legCache: new Map() };
  },

  route(fromTile: number, toTile: number): TransitRoute | null {
    if (!Transit.lines.length || !Transit.stops.length) return null;
    if (Transit.dirty || !graph) Transit.rebuildGraph();
    const R = C.WALK_R,
      S = graph.S;
    const O: [number, number][] = [],
      D: [number, number][] = [];
    for (let k = 0; k < S; k++) {
      const s = Transit.stops[k];
      const a = U.dist(s.tile, fromTile),
        b = U.dist(s.tile, toTile);
      if (a <= R) O.push([k, a]);
      if (b <= R) D.push([k, b]);
    }
    if (!O.length || !D.length) return null;
    let best = Infinity,
      bo = -1,
      bd = -1;
    for (const [o, wa] of O) {
      for (const [d, wb] of D) {
        if (o === d) continue;
        const t = graph.dist[o * S + d];
        if (t === Infinity) continue;
        const tot = t + ((wa + wb) * T) / Transit.WALK_V;
        if (tot < best) {
          best = tot;
          bo = o;
          bd = d;
        }
      }
    }
    if (bo < 0) return null;
    const lg = legs(bo, bd);
    if (!lg.length) return null;
    return { time: best, o: Transit.stops[bo], d: Transit.stops[bd], legs: lg };
  },

  hasStopNear(tile: number): boolean {
    for (const s of Transit.stops) {
      if (U.dist(s.tile, tile) <= C.WALK_R) return true;
    }
    return false;
  },

  addPassenger(route: TransitRoute, n: number, onDone?: ((p?: TransitWaitingPassenger) => void) | null) {
    const p: TransitWaitingPassenger = { legs: route.legs, li: 0, n, t0: Traffic.time, onDone };
    route.o.waiting.push(p);
  },

  update(dt: number) {
    const cap = C.TRANSIT.rail.cap,
      vmax = C.TRANSIT.rail.speed * C.VEH_SPEED;
    for (const tr of Transit.trains) {
      const l = tr.line;
      if (!l.poly) continue;
      if (tr.dwell > 0) {
        tr.dwell -= dt;
        continue;
      }
      const L = l.plen;
      const target = l.stopS[tr.nextK];
      const dist = (((target - tr.s) % L) + L) % L;
      const want = Math.min(vmax, Math.sqrt(2 * 5 * dist) + 1);
      tr.v = want > tr.v ? Math.min(want, tr.v + 6 * dt) : want;
      const step = tr.v * dt;
      if (step >= dist || dist < 0.3) {
        tr.s = target;
        tr.v = 0;
        const stop = byId.get(l.stops[tr.nextK]);
        const b = stop ? serveStop(tr, l, stop, cap) : 0;
        tr.dwell = 2.5 + b * 0.01;
        tr.nextK = (tr.nextK + 1) % l.stopS.length;
      } else tr.s = (tr.s + step) % L;
    }
    if (((Transit as any)._t = ((Transit as any)._t || 0) + dt) > 2) {
      (Transit as any)._t = 0;
      const now = Traffic.time;
      let w = 0;
      for (const s of Transit.stops) {
        if (s.waiting.length) s.waiting = s.waiting.filter((p: TransitWaitingPassenger) => now - (p.t0 || 0) < 90);
        if (s.waiting.length > 120) s.waiting.splice(0, s.waiting.length - 120);
        for (const p of s.waiting) w += p.n;
      }
      Transit.stats.waiting = w;
    }
  },

  render() {
    const CB = (window as any).CB;
    const Mx = CB?.Meshes;
    if (!Mx) return;
    for (const tr of Transit.trains) {
      const l = tr.line;
      if (!l.poly) continue;
      const col = lcCol(l.color);
      for (let c = 0; c < 3; c++) {
        polyAt(l, tr.s - c * 14.6, tmp);
        if (tmp[1] < World.groundH(tmp[0], tmp[2]) - 1) continue;
        Mx.pushVehicle('train', tmp[0], tmp[1], tmp[2], tmp[3], tmp[4], col, 0);
      }
    }
  },

  validate() {
    for (const l of Transit.lines) Transit.buildLine(l);
    for (const s of Transit.stops.slice()) {
      if (Transit.canPlaceStopIgnoringSelf(s)) Transit.removeStop(s);
    }
    Transit.dirty = true;
  },

  canPlaceStopIgnoringSelf(s: TransitStop): boolean {
    const R = C.ROADS[World.road[s.tile]];
    if (s.type === 'rail') return !World.rail[s.tile];
    if (s.type === 'bus' ? !R || !R.car : !R || !R.tram) return true;
    return World.jcl[s.tile] >= 0 || World.linked(s.tile, s.side);
  },

  insertStop(l: TransitLine, s: TransitStop): boolean {
    if (l.stops.includes(s.id)) return false;
    let best = -1,
      bc = Infinity;
    const st = l.stops.map(id => byId.get(id)!);
    for (let k = 0; k < st.length; k++) {
      const a = st[k],
        b = st[(k + 1) % st.length];
      const p1 = Transit.segPath(l.type, a, s),
        p2 = Transit.segPath(l.type, s, b),
        p0 = Transit.segPath(l.type, a, b);
      if (!p1 || !p2) continue;
      const c = p1.length + p2.length - (p0 ? p0.length : 0);
      if (c < bc) {
        bc = c;
        best = k + 1;
      }
    }
    if (best < 0) return false;
    l.stops.splice(best, 0, s.id);
    if (!s.color) {
      s.color = l.color;
      const CB = (window as any).CB;
      if (CB?.Meshes) CB.Meshes.markInfra(s.tile);
    }
    Transit.buildLine(l);
    Transit.dirty = true;
    return true;
  },

  removeFromLine(l: TransitLine, s: TransitStop): boolean {
    if (!l.stops.includes(s.id) || l.stops.length <= 2) return false;
    l.stops = l.stops.filter(id => id !== s.id);
    Transit.buildLine(l);
    Transit.dirty = true;
    return true;
  },

  setColor(l: TransitLine, col: string) {
    l.color = col;
    drawRibbon(l);
    for (const v of Traffic.vehicles) {
      if ((v as any).line === l) (v as any).col = lcCol(col);
    }
    for (const id of l.stops) {
      const s = byId.get(id);
      if (s) {
        s.color = col;
        const CB = (window as any).CB;
        if (CB?.Meshes) CB.Meshes.markInfra(s.tile);
      }
    }
  },

  setFare(l: TransitLine, f: number) {
    l.fare = Math.round(U.clamp(f, 0, 10) * 2) / 2;
    Transit.dirty = true;
  },

  vehiclesOf(l: TransitLine): (Vehicle | TransitTrain)[] {
    if (l.type !== 'rail') return Traffic.vehicles.filter((v: Vehicle) => v.line === l);
    return Transit.trains.filter(t => t.line === l);
  },

  clearAll() {
    const CB = (window as any).CB;
    for (const l of Transit.lines) {
      if (l.ribbon && CB?.Meshes) CB.Meshes.lineGroup.remove(l.ribbon);
    }
    Transit.stops = [];
    Transit.lines = [];
    Transit.trains = [];
    byId.clear();
    Transit.nextStop = 1;
    Transit.nextLine = 1;
    Transit.dirty = true;
  },

  monthly() {
    for (const l of Transit.lines) {
      l.ridersLast = l.ridersMonth;
      l.ridersMonth = 0;
    }
  },

  serialize(): SerializedTransit {
    return {
      stops: Transit.stops.map(s => ({
        id: s.id,
        type: s.type,
        tile: s.tile,
        side: s.side,
        name: s.name,
        color: s.color,
      })),
      lines: Transit.lines.map(l => ({
        id: l.id,
        type: l.type,
        name: l.name,
        color: l.color,
        stops: l.stops,
        vehicles: l.vehicles,
        fare: l.fare,
        ridersLast: l.ridersLast,
      })),
      nextStop: Transit.nextStop,
      nextLine: Transit.nextLine,
    };
  },

  load(d: SerializedTransit) {
    Transit.clearAll();
    for (const s of d.stops) {
      const st: TransitStop = { ...s, waiting: [] };
      if (st.side === undefined) st.side = st.type === 'rail' ? 0 : Transit.defaultSide(st.tile);
      Transit.stops.push(st);
      byId.set(st.id, st);
    }
    Transit.nextStop = d.nextStop;
    Transit.nextLine = d.nextLine;
    for (const l of d.lines) {
      const ln: TransitLine = {
        ...l,
        fare: l.fare ?? C.TRANSIT[l.type]?.fare ?? 2,
        ridersMonth: 0,
        broken: false,
      };
      Transit.lines.push(ln);
    }
    Transit.dirty = true;
  },

  buildAll() {
    for (const l of Transit.lines) Transit.buildLine(l);
  },
};
