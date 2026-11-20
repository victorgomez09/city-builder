/**
 * Vira City — City Serialization, RLE Compression & Save/Load (`src/sim/serialization.ts`)
 */
import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { World } from '@/world/world';
import { Transit } from '@/transit/transit';
import { Building, SerializedCity, BudgetLedger, BudgetState, BudgetReport } from '@/types';
import { blankBudget, LoanItem } from './budget';
import { Unrest } from './unrest';

const N = C.W * C.W;

export interface SimSerializationHost {
  name: string;
  money: number;
  month: number;
  hour: number;
  dayAcc: number;
  milestone: number;
  tax: { res: number; com: number; ind: number; off: number };
  loans: LoanItem[];
  nextId: number;
  history: { pop: number; money: number }[];
  last: BudgetReport;
  budget: BudgetReport;
  unseen: string[];
  buildings: Map<number, Building>;
  covDirty: boolean;
  lotsDirty: boolean;
  zoneTexDirty: boolean;
  init(opts: { name?: string; seed?: number; map?: string }): void;
}

export function serializeCity(sim: SimSerializationHost): SerializedCity {
  const bl: Partial<Building>[] = [];
  sim.buildings.forEach((b: Building) =>
    bl.push({
      id: b.id,
      kind: b.kind,
      zone: b.zone,
      svc: b.svc,
      x: b.x,
      y: b.y,
      fw: b.fw,
      fh: b.fh,
      w: b.fw,
      d: b.fh,
      dir: b.dir,
      road: b.road,
      level: b.level ?? b.lvl ?? 1,
      state: b.state === 'burn' ? 'live' : b.state,
      st: b.st,
      buildT: b.buildT,
      seed: b.seed,
      res: b.pop ?? b.occ ?? 0,
      cap: b.cap,
      jobs: b.jobs,
      filled: b.filled ?? 0,
      outside: b.outside,
      work: b.work,
      happy: Math.round(b.happy ?? 60),
      garbage: Math.round(b.garbage ?? 0),
      prog: b.fireProg ?? 0,
      low: b.minY,
      abandT: b.abandT,
      custRatio: b.custRatio,
      commute: Math.round(b.commute ?? 0),
      age: b.age,
      stock: b.stock,
      stockMax: b.stockMax,
      stockoutHours: b.stockoutHours,
      industryType: b.industryType,
      outputRate: b.outputRate,
      sick: b.sick || 0,
      dead: b.dead || 0,
      water: b.water,
      sewage: b.sewage,
      graves: b.graves || 0,
    })
  );

  return {
    v: 2,
    seed: World.seed,
    map: World.map,
    name: sim.name,
    money: sim.money,
    month: sim.month,
    hour: sim.hour,
    dayAcc: sim.dayAcc || 0,
    milestone: sim.milestone,
    tax: sim.tax,
    loans: sim.loans,
    nextId: sim.nextId,
    history: sim.history,
    last: sim.last,
    budget: sim.budget,
    road: U.encodeRLE(World.road),
    pcell: U.encodeRLE(World.pcell),
    unseen: sim.unseen || [],
    link: U.encodeRLE(World.link),
    rdir: U.encodeRLE(World.rdir),
    rpart: U.encodeRLE(World.rpart),
    curv: U.encodeRLE(World.curv),
    hce: [...World.hcEdits].flatMap(([k, h]) => [k, Math.round(h * 100) / 100]),
    jcfg: World.clusters.map(cl => ({ t: cl.tiles[0], c: cl.cfg })),
    rail: U.encodeRLE(World.rail),
    zone: U.encodeRLE(World.zone),
    tree: U.encodeRLE(World.tree),
    resource: U.encodeRLE(World.resource),
    waterPipe: U.encodeRLE(World.waterPipe),
    sewagePipe: U.encodeRLE(World.sewagePipe),
    wind: (sim as any).wind,
    unrest: Unrest.serialize(),
    district: U.encodeRLE(World.district),
    districts: Array.from(World.districts.values()),
    nextDistrictId: World.nextDistrictId,
    buildings: bl,
    transit: Transit.serialize(),
  } as any;
}

export function loadCity(
  sim: SimSerializationHost,
  d: SerializedCity,
  lotTilesFn: (b: Building) => number[],
  nameForFn: (b: Building) => string,
  onLoaded: () => void
): void {
  sim.init({ name: d.name, seed: d.seed, map: d.map });
  const CB = typeof window !== 'undefined' ? (window as any).CB : null;

  if (d.hce && d.hce.length) {
    World.applyEdits(d.hce);
    if (CB?.Gfx) CB.Gfx.terrainDirty = true;
  }

  Object.assign(sim, {
    dayAcc: d.dayAcc || 0,
    money: d.money,
    month: d.month,
    hour: d.hour,
    milestone: d.milestone,
    tax: d.tax,
    loans: d.loans || [],
    nextId: d.nextId,
    history: d.history || [],
    last: d.last || blankBudget(),
    budget: d.budget || blankBudget(),
  });

  World.road.set(U.decodeRLE(d.road, Uint8Array, N));
  World.link.set(U.decodeRLE(d.link, Uint8Array, N));
  World.rdir.set(U.decodeRLE(d.rdir, Uint8Array, N));
  World.rpart.set(U.decodeRLE(d.rpart, Uint8Array, N));

  if (d.curv) World.curv.set(U.decodeRLE(d.curv, Uint8Array, N));
  else World.curv.fill(0);

  World.jcfg = new Map();
  for (const j of d.jcfg || []) {
    const ja = j as any;
    const tile = ja.tile ?? ja.t ?? ja[0];
    const cfg = ja.ctrl ? ja : (ja.c ?? ja[1]);
    if (tile !== undefined && cfg !== undefined) World.jcfg.set(tile, cfg);
  }

  if (d.pcell) World.pcell.set(U.decodeRLE(d.pcell, Uint8Array, C.FW * C.FW));
  else World.pcell.fill(0);

  sim.unseen = d.unseen || [];

  for (let i = 0; i < N; i++) {
    const R = C.ROADS[World.road[i]];
    if (!R || R.grp !== 'legacy') continue;
    const k = R.key === 'bikepath' ? 2 : 1;
    for (let q = 0; q < 4; q++) World.pcell[World.cellOf(i, q)] = k;
    World.unlinkAll(i);
    World.road[i] = 0;
  }

  World.rebuildPmask();
  World.rail.set(U.decodeRLE(d.rail, Uint8Array, N));
  World.zone.set(U.decodeRLE(d.zone, Uint8Array, N));
  World.tree.set(U.decodeRLE(d.tree, Uint8Array, N));

  if (d.resource) {
    World.resource.set(U.decodeRLE(d.resource, Uint8Array, N));
  }

  if (d.waterPipe) {
    World.waterPipe.set(U.decodeRLE(d.waterPipe, Uint8Array, N));
  } else {
    World.waterPipe.fill(0);
  }

  if (d.sewagePipe) {
    World.sewagePipe.set(U.decodeRLE(d.sewagePipe, Uint8Array, N));
  } else {
    World.sewagePipe.fill(0);
  }

  // Strict invariant: pipes can only exist where roads exist
  for (let i = 0; i < N; i++) {
    if (!World.road[i]) {
      World.waterPipe[i] = 0;
      World.sewagePipe[i] = 0;
    }
  }

  if (d.wind) {
    (sim as any).wind = d.wind;
  }

  if (d.unrest) {
    Unrest.deserialize(d.unrest);
  } else {
    Unrest.init();
  }

  if (d.district) {
    World.district.set(U.decodeRLE(d.district, Uint8Array, N));
  } else {
    World.district.fill(0);
  }

  World.districts = new Map();
  if (d.districts && Array.isArray(d.districts)) {
    for (const dist of d.districts) {
      const da = dist as any;
      World.districts.set(dist.id, {
        id: dist.id,
        name: dist.name,
        color: dist.color,
        policies: dist.policies || {},
        spec: dist.spec || 'none',
        stats: da.stats || { pop: 0, res: 0, com: 0, ind: 0, off: 0 },
        cx: da.cx || 0,
        cy: da.cy || 0,
      });
    }
  }

  World.nextDistrictId =
    d.nextDistrictId || (World.districts.size > 0 ? Math.max(...World.districts.keys()) + 1 : 1);
  World.updateDistrictCentroids();
  World.updateDistrictStats();
  World.joinDeadEnds();
  World.updateZonable();
  World.updateConn();
  World.updateJunctions();
  World.roadVer++;

  for (const o of d.buildings) {
    const isCom = o.zone && C.ZONES[o.zone]?.cat === 'com';
    const isInd = o.zone && C.ZONES[o.zone]?.cat === 'ind';
    const b: Building = Object.assign(
      {
        cust: 0,
        gTarget: false,
        vehOut: 0,
        fire: 0,
        prob: null,
        sick: o.sick || 0,
        dead: o.dead || 0,
        water: o.water ?? true,
        sewage: o.sewage ?? true,
        graves: o.graves || 0,
        stock: isCom ? 25 * (o.level || 1) : 0,
        stockMax: isCom ? 50 * (o.level || 1) : 0,
        stockoutHours: 0,
        industryType: isInd ? 'generic' : undefined,
        outputRate: 0,
      },
      o
    ) as Building;
    let mx = -1e9;
    let mn = 1e9;
    for (let y = b.y; y <= b.y + b.fh; y++) {
      for (let x = b.x; x <= b.x + b.fw; x++) {
        const h = World.cornerH(x, y);
        mx = Math.max(mx, h);
        mn = Math.min(mn, h);
      }
    }
    b.baseY = Math.max(mx, C.WATER + 0.3) + 0.05;
    b.minY = mn;
    (b as any).ang = World.frontAngle(b);
    for (const t of lotTilesFn(b)) World.bld[t] = b.id;
    b.name = nameForFn(b);
    sim.buildings.set(b.id, b);
    if (CB?.Meshes) CB.Meshes.addBuilding(b);
  }

  Transit.load(d.transit);
  sim.covDirty = true;
  sim.lotsDirty = true;
  sim.zoneTexDirty = true;

  onLoaded();
}
