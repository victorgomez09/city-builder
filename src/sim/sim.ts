import { C } from '../core/constants';
import { U } from '../core/utils';
import { World } from '../world/world';
import { Traffic } from '../traffic/traffic';
import { Transit } from '../transit/transit';
import { Building, Vehicle, Milestone, TaxRates, BuildingSpec, ServiceLotResult, SimIcon, SimNotice, SerializedCity, SupplyChainStats, SimStats, WindState, StrikesState } from '../types';
import { LoanItem } from './budget';
import { COV_KEYS, computeCoverage as runComputeCoverage, computeWaterNear } from './coverage';
import { Water } from './waterNet';
import { Unrest } from './unrest';
import {
  blankBudget,
  hourlyEconomy as runHourlyEconomy,
  monthlyBudget as runMonthlyBudget,
  projectedBudget,
  takeLoan as runTakeLoan,
  repayLoan as runRepayLoan,
  earn as runEarn,
} from './budget';
import { serializeCity, loadCity } from './serialization';
import { calculateDemand } from './demand';

import {
  lotTiles,
  nameFor,
  releaseWork,
  employedOf,
  frontOK,
  tileFree,
  rebuildLots,
  fitLot,
  tryGrow,
  rehome,
} from './buildings';
const T = C.TILE;
const W = C.W;
const N = W * W;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const zoneOf = (b: Building) => (b.kind === 'zone' ? C.ZONES[b.zone] : null);


function computeCoverage() {
  runComputeCoverage(Sim.cov, Sim.buildings, Sim.wind);
  Sim.covDirty = false;
}

const MOVE_COLS = ['#e8eaec', '#e07a22', '#d8d4c8', '#2f6fb0', '#c8392e'].map(h => {
  const a = U.hex(h);
  return [U.lin(a[0]), U.lin(a[1]), U.lin(a[2])];
});

let moveBudget = 0;
function moveIn(b: Building, n?: number) {
  const count = n || Math.ceil(b.cap * 0.5);
  b.inbound = (b.inbound || 0) + count;
  const land = () => {
    b.inbound = Math.max(0, (b.inbound || 0) - count);
    if (Sim.buildings.has(b.id) && b.state !== 'aband') {
      b.res = Math.min(b.cap, b.res + count);
    }
  };
  Traffic.request({
    from: World.outIn,
    to: b.road,
    fromB: null,
    toB: b,
    kind: 'van',
    col: U.pick(MOVE_COLS, Sim.rng),
    purpose: 'Moving in',
    onArrive: () => land(),
    onFail: () => land(),
  });
}

export const DEFAULT_WIND: WindState = {
  angle: 0.78,
  speed: 22,
  targetAngle: 0.78,
  targetSpeed: 22,
  gust: 1.0,
  name: 'Moderate Breeze',
  dirName: 'NE',
};

function updateWind() {
  const S = Sim;
  if (!S.wind) S.wind = { ...DEFAULT_WIND };

  if (S.simHours % 6 === 0) {
    const h = U.hash(S.simHours, S.month, 42);
    S.wind.targetAngle = (h % 628) / 100;
    S.wind.targetSpeed = 10 + (U.hash(S.simHours, S.month, 101) % 45);
  }

  let diff = S.wind.targetAngle - S.wind.angle;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  S.wind.angle += diff * 0.08;
  S.wind.speed += (S.wind.targetSpeed - S.wind.speed) * 0.08;

  const dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  const a = ((S.wind.angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const idx = Math.round(a / (Math.PI / 4)) % 8;
  S.wind.dirName = dirs[idx];

  const spd = S.wind.speed;
  if (spd < 12) S.wind.name = 'Light Air';
  else if (spd < 24) S.wind.name = 'Gentle Breeze';
  else if (spd < 36) S.wind.name = 'Moderate Breeze';
  else if (spd < 48) S.wind.name = 'Fresh Wind';
  else S.wind.name = 'Strong Gale';

  S.covDirty = true;
}

function moveOut(b: Building) {
  if (moveBudget-- <= 0) return;
  Traffic.request({
    from: b.road,
    to: World.outOut,
    fromB: b,
    toB: null,
    kind: 'van',
    col: U.pick(MOVE_COLS, Sim.rng),
    purpose: 'Moving out',
    onArrive: () => {},
    onFail: () => {},
  });
}

function iconFor(b: Building, type?: string) {
  const cx = (b.x + b.fw / 2) * T,
    cz = (b.y + b.fh / 2) * T;
  const CB = (window as any).CB;
  const h = b._h || (b._h = CB?.Meshes?.buildingHeight(b) || 5);
  return { x: cx, y: b.baseY + h + 4, z: cz, type: type || b.prob };
}

function startFire(b: Building) {
  b.state = 'fire';
  b.fire = 0;
  let best: Building | null = null,
    bd = 1e9;
  Sim.buildings.forEach((s: Building) => {
    if (s.kind !== 'svc') return;
    const sv = C.SERVICES[s.svc];
    if (sv?.cov !== 'fire' || s.vehOut >= (sv.vehCount || 0)) return;
    const d = Math.hypot(s.x + s.fw / 2 - b.x - b.fw / 2, s.y + s.fh / 2 - b.y - b.fh / 2);
    if (d < bd && World.road[s.road] && World.conn[s.road]) {
      bd = d;
      best = s;
    }
  });
  if (!best) return;
  const st = best;
  st.vehOut++;
  const back = () => {
    Traffic.request({
      from: b.road,
      to: st.road,
      kind: 'fire',
      onArrive: () => {
        st.vehOut = Math.max(0, st.vehOut - 1);
      },
      onFail: () => {
        st.vehOut = Math.max(0, st.vehOut - 1);
      },
    });
  };
  Traffic.request({
    from: st.road,
    to: b.road,
    kind: 'fire',
    purpose: 'Responding to a fire',
    onArrive: (_v, ok) => {
      const CB = (window as any).CB;
      if (Sim.buildings.has(b.id) && b.state === 'fire') {
        b.state = 'live';
        b.fire = 0;
        if (CB?.Meshes) CB.Meshes.refreshBuilding(b);
      }
      back();
    },
    onFail: () => {
      st.vehOut = Math.max(0, st.vehOut - 1);
      if (b.state === 'fire') b.state = 'live';
    },
  });
}

function blankSupply(): SupplyChainStats {
  return {
    rawFood: 0,
    rawTimber: 0,
    rawOre: 0,
    rawOil: 0,
    processedGoods: 0,
    consumerGoods: 0,
    localProduction: 0,
    cityDemand: 0,
    importedGoods: 0,
    exportedGoods: 0,
    importCost: 0,
    exportRevenue: 0,
    stockoutStores: 0,
    commercialStockRate: 1,
  };
}

function dispatchFreightDelivery(comStore: Building) {
  if (!comStore.road || !World.road[comStore.road] || !World.conn[comStore.road] || comStore.vehOut) return;

  const cargoWant = Math.min(
    (comStore.stockMax || 50) - (comStore.stock || 0),
    25
  );
  if (cargoWant <= 0) return;

  // 1. Look for nearest local industrial factory with goods
  let supplier: Building | null = null;
  let bestDist = 1e9;
  for (const b of Sim.buildings.values()) {
    if (b.kind !== 'zone' || b.state !== 'live') continue;
    const z = C.ZONES[b.zone];
    if (z?.cat !== 'ind') continue;
    if ((b.stock || 0) < 15 || b.vehOut) continue;
    if (!b.road || !World.road[b.road] || !World.conn[b.road]) continue;
    const d = Math.hypot(b.x - comStore.x, b.y - comStore.y);
    if (d < bestDist) {
      bestDist = d;
      supplier = b;
    }
  }

  if (supplier) {
    const factory = supplier as Building;
    factory.vehOut = (factory.vehOut || 0) + 1;
    factory.stock = Math.max(0, (factory.stock || 0) - cargoWant);
    comStore.vehOut = (comStore.vehOut || 0) + 1;

    Traffic.request({
      from: factory.road!,
      to: comStore.road!,
      kind: 'truck',
      purpose: 'Delivering goods',
      cargo: 'Consumer goods',
      onArrive: (_v, ok) => {
        if (ok && Sim.buildings.has(comStore.id)) {
          comStore.stock = Math.min(comStore.stockMax || 50, (comStore.stock || 0) + cargoWant);
          if (comStore.prob === 'stockout') {
            comStore.prob = null;
            comStore.stockoutHours = 0;
          }
        }
        comStore.vehOut = Math.max(0, (comStore.vehOut || 0) - 1);
        Traffic.request({
          from: comStore.road!,
          to: factory.road!,
          kind: 'truck',
          purpose: 'Returning to factory',
          onArrive: () => {
            factory.vehOut = Math.max(0, (factory.vehOut || 0) - 1);
          },
          onFail: () => {
            factory.vehOut = Math.max(0, (factory.vehOut || 0) - 1);
          },
        });
      },
      onFail: () => {
        factory.vehOut = Math.max(0, (factory.vehOut || 0) - 1);
        comStore.vehOut = Math.max(0, (comStore.vehOut || 0) - 1);
        factory.stock = (factory.stock || 0) + cargoWant;
      },
    });
  } else if (World.outIn && World.road[World.outIn]) {
    // 2. Import from highway outside connection
    comStore.vehOut = (comStore.vehOut || 0) + 1;
    Sim.supply.importedGoods += cargoWant;
    const importFee = cargoWant * 3;
    Sim.supply.importCost += importFee;
    Sim.budget.exp.imports = (Sim.budget.exp.imports || 0) + importFee;

    Traffic.request({
      from: World.outIn,
      to: comStore.road!,
      kind: 'truck',
      purpose: 'Imported freight',
      cargo: 'Imported goods',
      onArrive: (_v, ok) => {
        if (ok && Sim.buildings.has(comStore.id)) {
          comStore.stock = Math.min(comStore.stockMax || 50, (comStore.stock || 0) + cargoWant);
          if (comStore.prob === 'stockout') {
            comStore.prob = null;
            comStore.stockoutHours = 0;
          }
        }
        comStore.vehOut = Math.max(0, (comStore.vehOut || 0) - 1);
        if (World.outOut && World.road[World.outOut]) {
          Traffic.request({
            from: comStore.road!,
            to: World.outOut,
            kind: 'truck',
            purpose: 'Leaving city',
            onArrive: () => {},
            onFail: () => {},
          });
        }
      },
      onFail: () => {
        comStore.vehOut = Math.max(0, (comStore.vehOut || 0) - 1);
      },
    });
  }
}

function dispatchFreightExport(factory: Building) {
  if (!World.outOut || !World.road[World.outOut] || !World.conn[World.outOut] || factory.vehOut || !factory.road) return;
  const cargoAmount = 20;
  factory.stock = Math.max(0, (factory.stock || 0) - cargoAmount);
  factory.vehOut = (factory.vehOut || 0) + 1;

  Traffic.request({
    from: factory.road,
    to: World.outOut,
    kind: 'truck',
    purpose: 'Exporting goods',
    cargo: 'Export freight',
    onArrive: (_v, ok) => {
      factory.vehOut = Math.max(0, (factory.vehOut || 0) - 1);
      if (ok) {
        const revenue = cargoAmount * 8;
        Sim.money += revenue;
        Sim.supply.exportedGoods += cargoAmount;
        Sim.supply.exportRevenue += revenue;
        Sim.budget.inc.export = (Sim.budget.inc.export || 0) + revenue;
      }
    },
    onFail: () => {
      factory.vehOut = Math.max(0, (factory.vehOut || 0) - 1);
      factory.stock = (factory.stock || 0) + cargoAmount;
    },
  });
}

function hourlyBuildings() {
  moveBudget = 24;
  const cv = Sim.cov;
  let pop = 0,
    happySum = 0,
    happyW = 0,
    workers = 0,
    employed = 0,
    jobs = 0,
    filled = 0,
    eduSum = 0,
    outsideIn = 0,
    comm = 0,
    commN = 0,
    rawFood = 0,
    rawTimber = 0,
    rawOre = 0,
    rawOil = 0,
    processedGoods = 0,
    consumerGoods = 0,
    localProduction = 0,
    cityDemand = 0,
    stockoutStores = 0,
    totalComStores = 0,
    stockedComStores = 0,
    totalSick = 0,
    totalDead = 0;
  const icons: SimIcon[] = [];
  const toRemove: Building[] = [];
  const resDemand = Math.max(Sim.demand.rlow, Sim.demand.rmed, Sim.demand.rhigh);
  const CB = (window as any).CB;

  Sim.buildings.forEach((b: Building) => {
    b.age++;
    const i = Sim.centerTile(b);
    const noRoad = !World.road[b.road] && !rehome(b);
    const noConn = noRoad || !World.conn[b.road];
    b.prob = null;
    if (b.kind === 'svc') {
      if (noRoad) b.prob = 'noroad';
      if (b.prob) icons.push(iconFor(b));
      return;
    }
    if (b.state === 'build') return;
    const z = C.ZONES[b.zone]!;
    const res = z.cat === 'res';
    if (b.state === 'fire') {
      b.fire += 1;
      if (b.fire > 7) {
        toRemove.push(b);
        Sim.notify(b.name + ' burned down. Build a Fire Station nearby.', 'bad');
        return;
      }
      icons.push(iconFor(b, 'fire'));
      return;
    }
    const did = World.district ? World.district[i] : 0;
    const dist = did ? World.districts.get(did) : null;

    let fireProb =
      (0.00002 + 0.00014 * Math.max(0, 1 - cv.fire[i] * 1.5)) * Math.min(1, b.age / 96);
    if (dist?.policies.smokeDetectors) fireProb *= 0.2;
    if (dist?.spec === 'farming' && z.cat === 'ind') fireProb *= 0.4;

    if (b.state === 'live' && Sim.rng() < fireProb) {
      startFire(b);
    }
    const occ = res ? b.res : b.filled + b.outside;
    if (b.state === 'live') {
      let garbRate = (occ * (res ? 0.07 : 0.09) + 0.5) / (0.85 + b.level * 0.15);
      if (dist?.policies.recycling) garbRate *= 0.7;
      if (dist?.spec === 'eco_res' && res) garbRate *= 0.8;
      b.garbage += garbRate;
    }
    let h: number;
    let tax = Sim.tax[z.cat];
    if (z.cat === 'com' && dist?.policies.localBusinessTaxRelief) tax = Math.max(0, tax - 2.5);
    if (res) {
      const wk = Math.round(b.res * 0.55),
        emp = employedOf(b);
      h =
        42 +
        14 * cv.health[i] +
        12 * cv.police[i] +
        9 * cv.edu[i] +
        15 * Math.min(1, cv.park[i]) +
        6 * cv.fire[i] +
        10 * Math.min(1, cv.landmark[i]) -
        38 * Math.min(1, cv.pollution[i]) -
        12 * cv.noise[i] -
        (tax - 10) * 2.2 +
        (wk ? (emp / wk - 0.75) * 24 : 0) +
        4 * cv.transit[i];
      if (b.commute > 0) h += U.clamp((70 - b.commute) / 6, -14, 6);
      if (b.water === false) h -= 28;
      if (b.sewage === false) h -= 22;
      if (b.waterPolluted) h -= 30;
      if ((b.sick || 0) > 0) h -= Math.min(28, (b.sick || 0) * 12);
      if ((b.dead || 0) > 0) h -= Math.min(35, (b.dead || 0) * 16);

      // Sickness & mortality dynamics
      if (b.state === 'live') {
        const airPoll = cv.pollution ? Math.min(1, cv.pollution[i]) : 0;
        const waterP = b.waterPolluted ? 0.35 : 0;
        const hCov = cv.health ? cv.health[i] : 0.5;
        const sickRisk = (0.012 + airPoll * 0.15 + waterP + (b.garbage > 100 ? 0.12 : 0)) * Math.max(0.2, 1.2 - hCov);
        if (Sim.rng() < sickRisk && (b.sick || 0) < Math.ceil(b.res * 0.5)) {
          b.sick = (b.sick || 0) + 1;
        }

        const deathRisk = 0.003 + (b.sick || 0) * 0.04;
        if (Sim.rng() < deathRisk && (b.dead || 0) < 4) {
          b.dead = (b.dead || 0) + 1;
          if ((b.sick || 0) > 0) b.sick--;
        }
      }

      if (dist?.policies.smokingBan) h += 4;
      if (dist?.policies.bikeCity) h += 5;
      if (dist?.policies.freeTransit) h += 4;
      if (dist?.policies.waterMetering) h -= 2;
      if (dist?.spec === 'eco_res') h += 6;
      workers += wk;
      employed += emp;
      pop += b.res;
      eduSum += cv.edu[i] * b.res;
    } else {
      const fr = b.jobs ? (b.filled + b.outside) / b.jobs : 0;
      h =
        42 +
        10 * cv.police[i] +
        6 * cv.fire[i] +
        6 * cv.health[i] +
        fr * 22 -
        (tax - 10) * 2.2;
      if (b.water === false) h -= 22;
      if (b.sewage === false) h -= 18;
      if (z.cat === 'com') {
        totalComStores++;
        const sMax = b.stockMax || (b.stockMax = 50 * (b.level || 1));
        if (b.stock === undefined) b.stock = Math.round(sMax * 0.6);
        const demand = Math.max(0.4, (b.cap * 0.12 + (b.cust || 5) * 0.06) * (b.custRatio || 0.7));
        cityDemand += demand;
        b.stock = Math.max(0, b.stock - demand);

        if (b.stock <= 0) {
          stockoutStores++;
          b.stockoutHours = (b.stockoutHours || 0) + 1;
          h -= 26;
          if (b.stockoutHours > 48) {
            b.state = 'aband';
            b.abandT = 0;
            Sim.notify(b.name + ' shut down (No goods to sell).', 'bad');
          }
        } else {
          stockedComStores++;
          b.stockoutHours = Math.max(0, (b.stockoutHours || 0) - 2);
        }

        if (b.stock < sMax * 0.4 && !b.vehOut && !noConn) {
          dispatchFreightDelivery(b);
        }

        h += (b.custRatio - 0.6) * 30;
        if (dist?.spec === 'nightlife') {
          b.custRatio = Math.min(2.0, b.custRatio * 1.25);
          h += 6;
        }
        if (dist?.spec === 'organic') h += 7;
        if (dist?.policies.smokingBan) h -= 2;
      }
      if (z.cat === 'ind') {
        const tileRes = World.resource ? World.resource[i] : 0;
        if (dist?.spec === 'farming' || dist?.spec === 'forestry' || dist?.spec === 'mining' || dist?.spec === 'oil') {
          b.industryType = dist.spec;
        } else if (tileRes === C.RES_FERTILE) {
          b.industryType = 'farming';
        } else if (tileRes === C.RES_FOREST) {
          b.industryType = 'forestry';
        } else if (tileRes === C.RES_ORE) {
          b.industryType = 'mining';
        } else if (tileRes === C.RES_OIL) {
          b.industryType = 'oil';
        } else {
          b.industryType = 'generic';
        }

        let eff = 1.0;
        if (b.industryType === 'farming') {
          eff = tileRes === C.RES_FERTILE ? 1.6 : 0.8;
          h += 6;
        } else if (b.industryType === 'forestry') {
          eff = tileRes === C.RES_FOREST ? 1.6 : 0.8;
          h += 5;
        } else if (b.industryType === 'mining') {
          eff = tileRes === C.RES_ORE ? 1.7 : 0.7;
          h += 6;
        } else if (b.industryType === 'oil') {
          eff = tileRes === C.RES_OIL ? 1.8 : 0.7;
          h += 8;
        }

        const rate = Math.round((b.level * 5 + 4) * (0.35 + fr * 0.65) * eff);
        b.outputRate = rate;
        localProduction += rate;

        if (b.industryType === 'farming') rawFood += rate;
        else if (b.industryType === 'forestry') rawTimber += rate;
        else if (b.industryType === 'mining') rawOre += rate;
        else if (b.industryType === 'oil') rawOil += rate;
        else {
          processedGoods += Math.round(rate * 0.4);
          consumerGoods += Math.round(rate * 0.6);
        }

        const indMax = b.stockMax || (b.stockMax = 120 + b.level * 30);
        b.stock = Math.min(indMax, (b.stock || 0) + rate);

        if (b.stock >= indMax * 0.75 && !b.vehOut && !noConn) {
          dispatchFreightExport(b);
        }
      }
      if (z.cat === 'off') {
        h += 10 * cv.edu[i] - 12 * Math.min(1, cv.pollution[i]);
        if (dist?.spec === 'tech') h += 5;
      }
      jobs += b.jobs;
      filled += b.filled;
      outsideIn += b.outside;
    }
    if (b.garbage > 100) h -= b.garbage > 200 ? 26 : 14;
    if (noConn) h -= 35;
    b.happy = U.clamp(b.happy + (U.clamp(h, 0, 100) - b.happy) * 0.25, 0, 100);
    if (res && b.res > 0) {
      happySum += b.happy * b.res;
      happyW += b.res;
      if (b.commute) {
        comm += b.commute;
        commN++;
      }
    }
    if (b.state === 'aband') {
      b.abandT++;
      if (b.abandT > 120) {
        toRemove.push(b);
        return;
      }
      if (b.happy > 45 && !noConn) {
        b.state = 'live';
        b.abandT = 0;
        b.low = 0;
        if (CB?.Meshes) CB.Meshes.refreshBuilding(b);
      }
      icons.push(iconFor(b, 'aband'));
      return;
    }
    if (res) {
      const room = b.cap - b.res - (b.inbound || 0);
      if (!noConn && room > 0 && resDemand > 3 && b.happy > 25 && moveBudget > 0) {
        let want = Math.max(1, Math.ceil(room * 0.4));
        for (let k = 0; k < 3 && want > 0 && moveBudget > 0; k++) {
          const n = Math.min(want, 2 + (Sim.rng() < 0.5 ? 1 : 0));
          moveIn(b, n);
          want -= n;
          moveBudget--;
        }
      }
      if (b.happy < 28 && b.res > 0 && Sim.rng() < 0.35) {
        b.res = Math.max(0, b.res - Math.max(1, Math.ceil(b.res * 0.12)));
        moveOut(b);
      }
      const wk = Math.round(b.res * 0.55);
      let e = employedOf(b);
      while (e > wk && b.work.length) {
        const w = b.work[b.work.length - 1];
        const o = Sim.buildings.get(w.id);
        const k = Math.min(w.n, e - wk);
        w.n -= k;
        e -= k;
        if (o) o.filled = Math.max(0, (o.filled || 0) - k);
        if (w.n <= 0) b.work.pop();
      }
    } else {
      if (b.outside > 0 && b.filled + b.outside > b.jobs) {
        b.outside = Math.max(0, b.jobs - b.filled);
      }
    }
    const lvReq = C.LV_REQ[b.level] || 999;
    const full = res ? b.res >= b.cap * 0.85 : b.filled + b.outside >= b.jobs * 0.7;
    if (b.level < 5 && b.happy > 55 && cv.lv[i] >= lvReq && full && !noConn) {
      b.prog += ((b.happy - 45) / 100) * 0.12;
      if (b.prog >= 1) {
        b.prog = 0;
        b.level++;
        b.cap = Sim.capOf(b);
        if (!res) b.jobs = b.cap;
        if (CB?.Meshes) {
          CB.Meshes.refreshBuilding(b);
          CB.Meshes.upgradeSite(b);
        }
        if (CB?.UI && CB.UI.selected === b && CB.Meshes) CB.Meshes.setSelection(b);
      }
    }
    const failing =
      b.happy < 22 || (!res && b.age > 60 && b.filled + b.outside < b.jobs * 0.12);
    if (failing) b.low++;
    else b.low = Math.max(0, b.low - 2);
    if (b.low > 60) {
      b.state = 'aband';
      b.abandT = 0;
      if (res) {
        releaseWork(b);
        b.res = 0;
      } else {
        Sim.buildings.forEach((o: Building) => {
          if (o.work?.length) o.work = o.work.filter((w: { id: number; n: number }) => w.id !== b.id);
        });
        b.filled = 0;
        b.outside = 0;
      }
      if (CB?.Meshes) CB.Meshes.refreshBuilding(b);
      return;
    }
    if ((b.sick || 0) > 0) totalSick += b.sick!;
    if ((b.dead || 0) > 0) totalDead += b.dead!;

    if (noRoad) b.prob = 'noroad';
    else if (noConn) b.prob = 'noconn';
    else if (b.water === false) b.prob = 'nowater';
    else if (b.sewage === false) b.prob = 'sewage';
    else if (b.waterPolluted) b.prob = 'water_polluted';
    else if ((b.dead || 0) > 0) b.prob = 'dead';
    else if ((b.sick || 0) > 0) b.prob = 'sick';
    else if (b.garbage > 100) b.prob = 'garbage';
    else if (z.cat === 'com' && (b.stock || 0) <= 0) b.prob = 'stockout';
    else if (!res && b.age > 36 && b.filled + b.outside < b.jobs * 0.3) b.prob = 'workers';
    else if (z.cat === 'com' && b.age > 48 && b.custRatio < 0.25) b.prob = 'customers';
    else b.prob = null;
    if (b.prob) icons.push(iconFor(b));
  });

  for (const b of toRemove) Sim.removeBuilding(b);
  const st = Sim.stats;
  st.pop = pop;
  st.workers = workers;
  st.employed = employed;
  st.jobs = jobs;
  st.filled = filled;
  st.outsideIn = outsideIn;
  st.happy = happyW ? happySum / happyW : 60;
  st.unemp = workers ? Math.max(0, 1 - employed / workers) : 0;
  st.edu = pop ? eduSum / pop : 0;
  st.commute = commN ? comm / commN : 0;
  st.buildingCount = Sim.buildings.size;
  st.sickCount = totalSick;
  st.deadCount = totalDead;
  Sim.supply.rawFood = rawFood;
  Sim.supply.rawTimber = rawTimber;
  Sim.supply.rawOre = rawOre;
  Sim.supply.rawOil = rawOil;
  Sim.supply.processedGoods = processedGoods;
  Sim.supply.consumerGoods = consumerGoods;
  Sim.supply.localProduction = localProduction;
  Sim.supply.cityDemand = Math.round(cityDemand);
  Sim.supply.stockoutStores = stockoutStores;
  Sim.supply.commercialStockRate = totalComStores > 0 ? stockedComStores / totalComStores : 1.0;
  st.supply = Sim.supply;
  // Social unrest icons: barricades, protests and public service strikes
  for (const b of Unrest.state.barricades) {
    icons.push({
      type: 'barricade',
      x: (b.x + 0.5) * T,
      y: World.groundH((b.x + 0.5) * T, (b.z + 0.5) * T) + 2.5,
      z: (b.z + 0.5) * T,
    });
  }
  for (const p of Unrest.state.crowds) {
    const px = U.tx(p.tile), py = U.ty(p.tile);
    icons.push({
      type: 'protest',
      x: (px + 0.5) * T,
      y: World.groundH((px + 0.5) * T, (py + 0.5) * T) + 2.8,
      z: (py + 0.5) * T,
    });
  }
  Sim.buildings.forEach((b: Building) => {
    if (b.kind === 'svc' && b.state === 'live' && Unrest.isServiceStriking(b.svc)) {
      icons.push(iconFor(b, 'strike'));
    }
  });
  Sim.icons = icons;
}

function matchJobs() {
  const open: Building[] = [];
  Sim.buildings.forEach((b: Building) => {
    if (Sim.isWork(b) && b.state === 'live' && b.filled < b.jobs) open.push(b);
  });
  const res: Building[] = [];
  Sim.buildings.forEach((b: Building) => {
    if (Sim.isRes(b) && b.state === 'live' && b.res > 0) res.push(b);
  });
  if (!res.length) return;
  const n = Math.min(res.length, 60);
  for (let k = 0; k < n && open.length; k++) {
    const b = res[Sim.resRot++ % res.length];
    const wk = Math.round(b.res * 0.55);
    const emp = employedOf(b);
    if (emp >= wk || !World.conn[b.road]) continue;
    let best: Building | null = null,
      bd = 1e9;
    for (let t = 0; t < 6; t++) {
      const o = open[Math.floor(Sim.rng() * open.length)];
      if (!World.conn[o.road]) continue;
      if (
        (o.zone === 7 || o.zone === 9) &&
        Sim.rng() > Sim.cov.edu[Sim.centerTile(b)] * 0.85 + 0.15
      )
        continue;
      const d = U.dist(o.road, b.road) + Sim.rng() * 6;
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    if (!best) continue;
    const free = best.jobs - best.filled - best.outside + best.outside;
    const take = Math.min(wk - emp, free, 4);
    if (take <= 0) continue;
    const fromOutside = Math.max(0, best.filled + best.outside + take - best.jobs);
    best.outside = Math.max(0, best.outside - fromOutside);
    best.filled += take;
    const e = b.work.find((w: { id: number; n: number }) => w.id === best!.id);
    if (e) e.n += take;
    else b.work.push({ id: best.id, n: take });
    if (best.filled >= best.jobs) open.splice(open.indexOf(best), 1);
  }
  if (Sim.stats.unemp < 0.06) {
    for (const o of open.slice(0, 10)) {
      if (o.filled + o.outside >= o.jobs || !World.conn[o.road]) continue;
      const maxOut = Math.ceil(o.jobs * 0.45);
      const add = Math.min(2, maxOut - o.outside, o.jobs - o.filled - o.outside);
      if (add > 0) o.outside += add;
    }
  }
}

/**
 * Calculates current macroeconomic zoning demand (RCI) across all categories.
 *
 * Demand ranges from 0 to 100 and governs building spawning rates:
 * - Residential (rlow, rmed, rhigh): Driven by unfilled jobs, happiness, tax rates,
 *   unemployment penalties, and pending unbuilt lots. Scaled by city population size.
 * - Commercial: Driven by population consumption needs, landmark tourist attraction, and tax rates.
 * - Industrial: Driven by goods consumption, commercial business supply, and available labour.
 * - Office: High-tech knowledge sector driven by citizen education levels and tax policy.
 */
function computeDemand() {
  Sim.demand = calculateDemand();
}

function growth() {
  if (Sim.lotsDirty) rebuildLots();
  let constructing = 0;
  Sim.buildings.forEach((b: Building) => {
    if (b.state === 'build') constructing++;
  });
  const maxCons = 10 + Math.floor(Sim.stats.pop / 25);
  for (let z = 1; z < C.ZONES.length; z++) {
    if (!Sim.unlocked(C.ZONES[z]?.unlock || 0)) continue;
    const d = Sim.zoneDemand(z);
    if (d < 6 || !Sim.lots[z] || !Sim.lots[z].length) continue;
    const tries = (1 + Math.floor(d / 20)) * (C.ZONES[z]?.cat === 'res' ? 2 : 1);
    for (let t = 0; t < tries && constructing < maxCons; t++) {
      if (Sim.rng() < (d / 100) * 0.95) {
        if (tryGrow(z)) constructing++;
      }
    }
  }
}

function dispatchServices() {
  const all: Building[] = [];
  Sim.buildings.forEach((b: Building) => all.push(b));
  for (const s of all) {
    if (s.kind !== 'svc' || !World.road[s.road] || !World.conn[s.road]) continue;
    if (Unrest.isServiceStriking(s.svc)) continue; // Workers on strike! No vehicles dispatched
    const sv = C.SERVICES[s.svc];
    if (!sv || !sv.veh || s.vehOut >= (sv.vehCount || 0)) continue;
    const cx = s.x + s.fw / 2,
      cy = s.y + s.fh / 2;
    if (sv.cov === 'garbage') {
      let target: Building | null = null,
        best = 0;
      for (let k = 0; k < 50; k++) {
        const b = all[Math.floor(Sim.rng() * all.length)];
        if (b.kind !== 'zone' || b.gTarget || b.garbage < 30 || !World.conn[b.road]) continue;
        const sc = b.garbage / (1 + Math.hypot(b.x - cx, b.y - cy) / 14);
        if (sc > best) {
          best = sc;
          target = b;
        }
      }
      if (!target) continue;
      target.gTarget = true;
      s.vehOut++;
      const collect = () => {
        const tx = target.x,
          ty = target.y;
        for (const o of all) {
          if (o.kind === 'zone' && Math.abs(o.x - tx) <= 6 && Math.abs(o.y - ty) <= 6) {
            o.garbage = 0;
          }
        }
        target.gTarget = false;
      };
      const done = () => {
        s.vehOut = Math.max(0, s.vehOut - 1);
      };
      Traffic.request({
        from: s.road,
        to: target.road,
        kind: 'garbage',
        purpose: 'Collecting garbage',
        onArrive: (_v: Vehicle | null, ok: boolean) => {
          if (ok) collect();
          else target.gTarget = false;
          Traffic.request({
            from: target.road,
            to: s.road,
            kind: 'garbage',
            purpose: 'Returning to depot',
            onArrive: done,
            onFail: done,
          });
        },
        onFail: (why: string) => {
          if (why === 'cap') collect();
          target.gTarget = false;
          done();
        },
      });
    } else if (sv.cov === 'health') {
      // Prioritize responding to sick citizens
      let target: Building | null = null;
      let bd = 1e9;
      for (const b of all) {
        if (b.kind === 'zone' && (b.sick || 0) > 0 && !(b as any).medTarget && World.conn[b.road]) {
          const d = Math.hypot(b.x - cx, b.y - cy);
          if (d < bd) {
            bd = d;
            target = b;
          }
        }
      }
      // If no sick citizens, occasional preventive healthcare patrol
      if (!target && Sim.rng() < 0.2) {
        for (let k = 0; k < 6; k++) {
          const b = all[Math.floor(Sim.rng() * all.length)];
          if (b.kind !== 'zone' || b.state !== 'live') continue;
          const d = Math.hypot(b.x - cx, b.y - cy);
          if (d < bd) {
            bd = d;
            target = b;
          }
        }
      }
      if (!target) continue;
      if ((target.sick || 0) > 0) (target as any).medTarget = true;
      s.vehOut++;
      const done = () => {
        s.vehOut = Math.max(0, s.vehOut - 1);
      };
      const curTarget = target;
      Traffic.request({
        from: s.road,
        to: curTarget.road,
        kind: 'ambulance',
        purpose: (curTarget.sick || 0) > 0 ? 'Medical emergency' : 'Routine health call',
        onArrive: (_v: Vehicle | null, ok: boolean) => {
          if (ok && (curTarget.sick || 0) > 0) {
            curTarget.sick = 0;
            if (curTarget.prob === 'sick' || curTarget.prob === 'water_polluted') curTarget.prob = null;
            curTarget.happy = Math.min(100, (curTarget.happy || 50) + 14);
          }
          (curTarget as any).medTarget = false;
          Traffic.request({
            from: curTarget.road,
            to: s.road,
            kind: 'ambulance',
            purpose: 'Returning to hospital',
            onArrive: done,
            onFail: done,
          });
        },
        onFail: () => {
          (curTarget as any).medTarget = false;
          done();
        },
      });
    } else if (sv.veh === 'hearse') {
      // Deathcare: dispatch hearse to collect deceased citizens
      if (s.svc === 'cemetery' && (s.graves || 0) >= (s.maxGraves || 800)) continue;
      let target: Building | null = null;
      let bd = 1e9;
      for (const b of all) {
        if (b.kind === 'zone' && (b.dead || 0) > 0 && !(b as any).hearseTarget && World.conn[b.road]) {
          const d = Math.hypot(b.x - cx, b.y - cy);
          if (d < bd) {
            bd = d;
            target = b;
          }
        }
      }
      if (!target) continue;
      (target as any).hearseTarget = true;
      s.vehOut++;
      const done = () => {
        s.vehOut = Math.max(0, s.vehOut - 1);
      };
      const curTarget = target;
      Traffic.request({
        from: s.road,
        to: curTarget.road,
        kind: 'hearse',
        purpose: 'Collecting deceased',
        onArrive: (_v: Vehicle | null, ok: boolean) => {
          if (ok && (curTarget.dead || 0) > 0) {
            curTarget.dead = Math.max(0, (curTarget.dead || 1) - 1);
            if (curTarget.dead === 0 && curTarget.prob === 'dead') curTarget.prob = null;
            if (s.svc === 'cemetery') s.graves = (s.graves || 0) + 1;
          }
          (curTarget as any).hearseTarget = false;
          Traffic.request({
            from: curTarget.road,
            to: s.road,
            kind: 'hearse',
            purpose: 'Returning to cemetery',
            onArrive: done,
            onFail: done,
          });
        },
        onFail: () => {
          (curTarget as any).hearseTarget = false;
          done();
        },
      });
    } else if (sv.cov === 'police' && Sim.rng() < 0.55) {
      let target: Building | null = null,
        bd = 1e9;
      for (let k = 0; k < 6; k++) {
        const b = all[Math.floor(Sim.rng() * all.length)];
        if (b.kind !== 'zone' || b.state !== 'live') continue;
        const d = Math.hypot(b.x - cx, b.y - cy) * (0.6 + Sim.rng());
        if (d < bd) {
          bd = d;
          target = b;
        }
      }
      if (!target) continue;
      s.vehOut++;
      const done = () => {
        s.vehOut = Math.max(0, s.vehOut - 1);
      };
      Traffic.request({
        from: s.road,
        to: target.road,
        kind: 'police',
        purpose: 'On patrol',
        onArrive: () =>
          Traffic.request({
            from: target.road,
            to: s.road,
            kind: 'police',
            purpose: 'Returning to station',
            onArrive: done,
            onFail: done,
          }),
        onFail: done,
      });
    }
  }
}

const gauss = (h: number, mu: number, s: number) =>
  Math.exp(-0.5 * ((h - mu) / s) ** 2) / (s * 2.5066);
const dayCurve = (h: number) =>
  h < 6 || h > 22 ? 0.01 : h < 9 || h > 19 ? 0.05 : 0.075;
const randomOf = (list: Building[]) =>
  list.length ? list[Math.floor(Sim.rng() * list.length)] : null;

let resList: Building[] = [],
  comList: Building[] = [],
  indList: Building[] = [],
  workList: Building[] = [],
  visitList: Building[] = [],
  parkList: Building[] = [];
let resCum: number[] = [];

function refreshLists() {
  resList = [];
  comList = [];
  indList = [];
  workList = [];
  visitList = [];
  parkList = [];
  Sim.buildings.forEach((b: Building) => {
    if (b.state !== 'live' || !World.conn[b.road]) return;
    if (b.kind === 'svc') {
      const c = C.SERVICES[b.svc]?.cat;
      if (c === 'landmarks' || (c === 'parks' && b.w > 1)) visitList.push(b);
      if (c === 'parks' || c === 'landmarks') parkList.push(b);
      return;
    }
    const cat = C.ZONES[b.zone]?.cat;
    if (cat === 'res') {
      if (b.res > 0) resList.push(b);
    } else {
      workList.push(b);
      if (cat === 'com') {
        comList.push(b);
        visitList.push(b);
      }
      if (cat === 'ind') indList.push(b);
    }
  });
  resCum = [];
  let acc = 0;
  for (const b of resList) {
    acc += Math.max(1, b.res);
    resCum.push(acc);
  }
}

function randomRes(): Building | null {
  if (!resList.length) return null;
  const t = Sim.rng() * resCum[resCum.length - 1];
  let lo = 0,
    hi = resCum.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (resCum[m] < t) lo = m + 1;
    else hi = m;
  }
  return resList[lo];
}

const CAR_OWN = [0.9, 0.95, 0.85, 0.7, 0.9, 0.9, 0.9, 0.9, 0.8];
const BIKE_OWN = 0.45;

function recordMode(m: string) {
  const M = Traffic.mode as any;
  for (const k in M) M[k] += ((k === m ? 1 : 0) - M[k]) * 0.01;
}

function softTrip(kind: string, path: number[], done?: ((t: number, ok: boolean) => void) | null, fb?: Building | null, tb?: Building | null) {
  const est = (path.length * T) / (kind === 'bike' ? 11 : 4.5);
  const a = Traffic.spawnSoft(kind, path, (t: number) => done && done(t, true), fb, tb);
  if (!a && done) done(est, true);
}

function carTrip(
  from: number,
  to: number,
  purpose: string,
  _n: number,
  onArrive?: ((t: number, ok: boolean) => void) | null,
  kind?: string,
  fb?: Building | null,
  tb?: Building | null
) {
  const pub = Traffic.isPublic(tb);
  const CB = (window as any).CB;
  Traffic.request({
    from,
    to,
    fromB: fb || null,
    toB: tb || null,
    kind: kind || (Sim.rng() < 0.3 ? 'suv' : 'car'),
    col: kind === 'truck' || kind === 'van' ? null : U.pick(CB?.Meshes?.CAR_COLORS || [[1, 1, 1]], Sim.rng),
    purpose,
    onArrive: (v: Vehicle | null, ok: boolean) => {
      if (ok && pub) Traffic.spawnVisitors(tb, 1 + (Sim.rng() < 0.5 ? 1 : 0), 40);
      if (onArrive) onArrive(ok && v ? Traffic.time - (v.born || 0) : 120, ok);
    },
    onFail: (why: string) => {
      if (why === 'cap' && onArrive) onArrive((U.dist(from, to) * T) / 16 + 10, true);
    },
  });
}

function personTrip(
  fromTile: number,
  toTile: number,
  purpose: string,
  n: number,
  done: ((t: number, ok: boolean) => void) | null,
  zone: number,
  fb?: Building | null,
  tb?: Building | null
) {
  const dist = U.dist(fromTile, toTile);
  const hasCar = Sim.rng() < (CAR_OWN[zone] || 0.85);
  let bikePath: number[] | null = null,
    safety = -1;
  if (dist > 4 && dist <= 90) {
    bikePath = Traffic.findSoftPath(fromTile, toTile, true);
    if (bikePath) safety = Traffic.bikeSafety(bikePath);
  }
  const carT = ((dist * T) / (13 * C.VEH_SPEED)) * (1 + 1.8 * (1 - Traffic.stats.flow)) + 14;
  const r = dist > 6 ? Transit.route(fromTile, toTile) : null;
  const mode = Sim.chooseMode(dist, hasCar, safety, r ? r.time : null, carT);
  recordMode(mode);
  if (mode === 'walk') {
    const p = dist <= 40 ? Traffic.findSoftPath(fromTile, toTile, false) : null;
    if (p) {
      softTrip('ped', p, done, fb, tb);
      return;
    }
  } else if (mode === 'bike' && bikePath) {
    softTrip('bike', bikePath, done, fb, tb);
    return;
  } else if (mode === 'transit' && r) {
    Sim.stats.transitShare += (1 - Sim.stats.transitShare) * 0.01;
    r._t0 = Traffic.time;
    Transit.addPassenger(r, n, () => done && done(Traffic.time - r._t0, true));
    return;
  }
  Sim.stats.transitShare *= 0.99;
  carTrip(fromTile, toTile, purpose, n, done, undefined, fb, tb);
}

function recordCommute(b: Building) {
  return (t: number, ok: boolean) => {
    if (!Sim.buildings.has(b.id)) return;
    const v = ok ? t : 150;
    b.commute = b.commute ? b.commute * 0.8 + v * 0.2 : v;
  };
}

const toWorkCurve = (h: number) =>
  0.5 * gauss(h, 7.2, 0.7) +
  0.28 * gauss(h, 8.5, 0.8) +
  0.12 * gauss(h, 11.5, 1.4) +
  0.1 * gauss(h, 15.5, 1.6);
const toHomeCurve = (h: number) =>
  0.5 * gauss(h, 16.2, 0.9) +
  0.28 * gauss(h, 17.6, 1.0) +
  0.12 * gauss(h, 20.5, 1.4) +
  0.1 * (gauss(h, 23.6, 1.4) + gauss(h, -0.4, 1.4));

function generateTrips(dtH: number) {
  if (!resList.length && !workList.length) return;
  const h = Sim.hour,
    st = Sim.stats,
    A = Sim.acc;
  const CB = (window as any).CB;
  const cars = CB?.Gfx?.settings?.cars || 500;
  const ppc = Math.max(1, st.employed / (cars * 0.6));
  const toWork = toWorkCurve(h),
    toHome = toHomeCurve(h);
  A.work += (st.employed * toWork * dtH) / ppc;
  A.home += (st.employed * toHome * dtH) / ppc;
  A.shop += (st.pop * 0.34 * dayCurve(h) * dtH) / ppc;
  let indF = 0;
  for (const b of indList) indF += b.filled + b.outside;
  A.freight +=
    (indF * 0.14 * dayCurve(h) * dtH) / Math.max(1, ppc * 1.2) +
    (comList.length * 0.05 * dayCurve(h) * dtH) / Math.max(1, ppc * 0.5);
  A.visit += ((st.pop * 0.015 + visitList.length * 2) * dayCurve(h) * dtH) / ppc;
  A.cin += (st.outsideIn * toWork * dtH) / ppc;
  A.cout += (st.outsideIn * toHome * dtH) / ppc;
  const inT = World.outIn,
    outT = World.outOut;
  let guard = 0;
  while (A.work >= 1 && guard++ < 30) {
    A.work--;
    const b = randomRes();
    if (!b || !b.work.length) continue;
    const w = Sim.buildings.get((U.pick(b.work, Sim.rng) as any).id); if (!w) continue;
    personTrip(b.road, (w as any).road, 'Commuting to work', ppc, recordCommute(b), b.zone, b, w);
  }
  while (A.home >= 1 && guard++ < 60) {
    A.home--;
    const b = randomRes();
    if (!b || !b.work.length) continue;
    const w = Sim.buildings.get((U.pick(b.work, Sim.rng) as any).id);
    if (!w) continue;
    personTrip((w as any).road, b.road, 'Heading home', ppc, recordCommute(b), b.zone, w, b);
  }
  while (A.shop >= 1 && guard++ < 90) {
    A.shop--;
    const b = randomRes();
    if (!b || !comList.length) continue;
    let best: Building | null = null,
      bd = 1e9;
    for (let k = 0; k < 5; k++) {
      const c = randomOf(comList);
      const d = U.dist(c.road, b.road) + Sim.rng() * 8;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    if (!best) continue;
    const shop = best;
    personTrip(
      b.road,
      shop.road,
      'Going shopping',
      ppc,
      () => {
        if (Sim.buildings.has(shop.id)) shop.cust += ppc * C.TRIP_K;
      },
      b.zone,
      b,
      shop
    );
  }
  while (A.freight >= 1 && guard++ < 110) {
    A.freight--;
    const src = indList.length && Sim.rng() < 0.7 ? randomOf(indList) : null;
    if (src) {
      const dst = comList.length && Sim.rng() < 0.65 ? randomOf(comList) : null;
      if (dst) {
        carTrip(src.road, dst.road, 'Delivering goods', 1, () => {
          if (Sim.buildings.has(dst.id)) {
            dst.stock = Math.min(dst.stockMax || 50, (dst.stock || 0) + 12);
            if (dst.prob === 'stockout') {
              dst.prob = null;
              dst.stockoutHours = 0;
            }
          }
        }, 'truck', src, dst);
      } else {
        carTrip(src.road, outT, 'Exporting goods', 1, () => {
          Sim.supply.exportedGoods += 10;
          Sim.supply.exportRevenue += 80;
          Sim.money += 80;
        }, 'truck', src, null);
      }
    } else if (comList.length) {
      const dst = randomOf(comList);
      carTrip(inT, dst.road, 'Importing goods', 1, () => {
        if (Sim.buildings.has(dst.id)) {
          dst.stock = Math.min(dst.stockMax || 50, (dst.stock || 0) + 12);
          if (dst.prob === 'stockout') {
            dst.prob = null;
            dst.stockoutHours = 0;
          }
          Sim.supply.importedGoods += 12;
          Sim.supply.importCost += 36;
        }
      }, 'truck', null, dst);
    }
  }
  while (A.visit >= 1 && guard++ < 130) {
    A.visit--;
    const tgt = randomOf(visitList);
    if (!tgt) continue;
    carTrip(
      inT,
      tgt.road,
      'Visiting the city',
      ppc,
      () => {
        if (Sim.buildings.has(tgt.id) && tgt.kind === 'zone') tgt.cust += ppc * C.TRIP_K;
      },
      undefined,
      null,
      tgt
    );
  }
  while (A.cin >= 1 && guard++ < 150) {
    A.cin--;
    const w = randomOf(workList);
    if (!w || !w.outside) continue;
    carTrip(inT, w.road, 'Commuting from out of town', ppc, null, undefined, null, w);
  }
  while (A.cout >= 1 && guard++ < 170) {
    A.cout--;
    const w = randomOf(workList);
    if (!w || !w.outside) continue;
    carTrip(w.road, outT, 'Leaving town', ppc, null, undefined, w, null);
  }
  A.park = (A.park || 0) + (st.pop * 0.03 * dayCurve(h) * dtH) / ppc;
  while (A.park >= 1 && guard++ < 190) {
    A.park--;
    const b = randomRes();
    if (!b || !parkList.length) continue;
    let best: Building | null = null,
      bd = 1e9;
    for (let k = 0; k < 4; k++) {
      const p = randomOf(parkList);
      const d = U.dist(p.road, b.road);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (best && bd < 60)
      personTrip(b.road, best.road, 'Going to the park', ppc, null, b.zone, b, best);
  }
  for (const k in A) if ((A as any)[k] > 40) (A as any)[k] = 40;
}

function hourlyEconomy() {
  runHourlyEconomy(Sim);
}

function monthly() {
  runMonthlyBudget(Sim);
  Unrest.monthlyTick();
}

const FIRST = [
  'Maya', 'Theo', 'Priya', 'Jonas', 'Aiko', 'Luis', 'Noor', 'Sam',
  'Ines', 'Kofi', 'Elena', 'Ravi', 'Hana', 'Oscar', 'Lena', 'Marco',
];
function chirp() {
  const st = Sim.stats;
  if (st.pop < 40) return;
  const opts: string[] = [];
  if (Traffic.stats.flow < 0.55) {
    opts.push(
      'Stuck in traffic again. Somebody please build another road or a bus line.',
      'Traffic is crawling. My commute takes forever.'
    );
  }
  if (st.unemp > 0.12) {
    opts.push('Still looking for work. We need more shops and factories around here.');
  }
  if (st.happy > 70) {
    opts.push(
      'Honestly, ' + Sim.name + ' is a lovely place to live.',
      'Great services in this town. Feeling lucky.'
    );
  }
  if (Sim.stats.transitShare > 0.15) {
    opts.push(
      'Took the ' +
        (Transit.lines.some(l => l.type === 'rail') ? 'metro' : 'bus') +
        ' today. Fast and cheap!'
    );
  }
  if (Sim.icons.some(i => i.type === 'garbage')) {
    opts.push('The garbage on my street is starting to smell.');
  }
  if (
    Sim.cov.health &&
    st.pop > 150 &&
    ![...Sim.buildings.values()].some(
      (b: Building) => b.svc === 'clinic' || b.svc === 'hospital'
    )
  ) {
    opts.push('Is there a doctor anywhere in this city?');
  }
  if (Sim.tax.res > 13) opts.push('Taxes went up again? Thinking about moving.');
  if (Unrest.state.strikes.garbage) opts.push('¡Huelga de basureros! La basura se acumula en las esquinas y huele fatal.');
  if (Unrest.state.strikes.transit) opts.push('¡Los conductores de autobús están en huelga! Llego tardísimo al trabajo.');
  if (Unrest.state.level === 'protest') opts.push('Hay manifestaciones en el centro con pancartas. ¡El ayuntamiento debe escucharnos!');
  if (Unrest.state.level === 'riot') opts.push('¡Disturbios en las avenidas principales! Hay barricadas ardiendo en el asfalto.');
  if (Sim.demand.rlow > 60 && st.pop < 600) opts.push('Everyone wants to move here. Zone more homes!');
  if (!opts.length) return;
  Sim.notify(U.pick(FIRST, Sim.rng) + ': "' + U.pick(opts, Sim.rng) + '"', 'chirp');
}

function checkMilestones() {
  while (
    Sim.milestone < C.MILESTONES.length - 1 &&
    Sim.stats.pop >= C.MILESTONES[Sim.milestone + 1].pop
  ) {
    Sim.milestone++;
    const m = C.MILESTONES[Sim.milestone];
    Sim.money += m.reward;
    const CB = (window as any).CB;
    if (CB?.UI) CB.UI.milestone(m);
  }
}

const ramp = (v: number) => {
  v = U.clamp(v, 0, 1);
  return v < 0.5 ? [0.9, 0.2 + v * 1.3, 0.15, 0.85] : [0.9 - (v - 0.5) * 1.5, 0.85, 0.2, 0.85];
};

export const Sim = {
  buildings: new Map<number, Building>(),
  nextId: 1,
  money: C.START_MONEY,
  month: 0,
  hour: 7.0,
  speed: 1,
  name: 'New City',
  milestone: 0,
  tax: { res: 10, com: 10, ind: 10, off: 10 } as TaxRates,
  loans: [] as LoanItem[],
  demand: { rlow: 80, rmed: 0, rhigh: 0, com: 30, ind: 40, off: 0 },
  stats: {
    pop: 0,
    workers: 0,
    employed: 0,
    jobs: 0,
    filled: 0,
    happy: 60,
    unemp: 0,
    edu: 0,
    outsideIn: 0,
    transitShare: 0,
    commute: 0,
    buildingCount: 0,
  } as SimStats,
  supply: blankSupply(),
  budget: blankBudget(),
  last: blankBudget(),
  history: [] as { pop: number; money: number }[],
  cov: {} as Record<string, Float32Array>,
  covDirty: true,
  lotsDirty: true,
  zoneTexDirty: true,
  lots: [] as number[][],
  acc: { work: 0, home: 0, shop: 0, freight: 0, visit: 0, cin: 0, cout: 0, park: 0 },
  tickAcc: 0,
  hourAcc: 0,
  dayAcc: 0,
  resRot: 0,
  simHours: 0,
  resDemandBase: 50,
  wind: { ...DEFAULT_WIND } as WindState,
  icons: [] as SimIcon[],
  notices: [] as SimNotice[],
  unseen: [] as string[],
  rng: Math.random as () => number,

  init(opts: { name?: string; seed?: number; map?: string }) {
    Sim.buildings = new Map();
    Sim.nextId = 1;
    Sim.money = C.START_MONEY;
    Sim.month = 0;
    Sim.hour = 7.0;
    Sim.speed = 1;
    Sim.name = opts.name || 'New City';
    Sim.milestone = 0;
    Sim.tax = { res: 10, com: 10, ind: 10, off: 10 };
    Sim.loans = [];
    Sim.demand = { rlow: 80, rmed: 0, rhigh: 0, com: 30, ind: 40, off: 0 };
    Sim.stats = {
      pop: 0,
      workers: 0,
      employed: 0,
      jobs: 0,
      filled: 0,
      happy: 60,
      unemp: 0,
      edu: 0,
      outsideIn: 0,
      transitShare: 0,
      commute: 0,
      buildingCount: 0,
    } as SimStats;
    Sim.supply = blankSupply();
    Sim.budget = blankBudget();
    Sim.last = blankBudget();
    Sim.history = [];
    Sim.cov = {};
    for (const k of COV_KEYS) Sim.cov[k] = new Float32Array(N);
    Sim.covDirty = true;
    Sim.lotsDirty = true;
    Sim.zoneTexDirty = true;
    Sim.lots = [];
    Sim.acc = { work: 0, home: 0, shop: 0, freight: 0, visit: 0, cin: 0, cout: 0, park: 0 };
    Sim.tickAcc = 0;
    Sim.hourAcc = 0;
    Sim.dayAcc = 0;
    Sim.resRot = 0;
    Sim.simHours = 0;
    Sim.icons = [];
    Sim.notices = [];
    Sim.unseen = [];
    Sim.wind = { ...DEFAULT_WIND };
    Water.init();
    Unrest.init();
    Sim.rng = U.rng((opts.seed || 1) * 31 + 7);
    computeWaterNear();
  },

  dateStr: (): string => MONTHS[Sim.month % 12] + ' ' + (2026 + Math.floor(Sim.month / 12)),
  notify: (text: string, kind?: string) => Sim.notices.push({ text, kind: kind || 'info' }),
  earn: (k: string, v: number) => {
    Sim.money += v;
    Sim.budget.inc[k] = (Sim.budget.inc[k] || 0) + v;
  },
  unlocked: (lvl: number): boolean => Sim.milestone >= lvl,

  isRes: (b: Building): boolean => b.kind === 'zone' && C.ZONES[b.zone]?.cat === 'res',
  isWork: (b: Building): boolean => b.kind === 'zone' && C.ZONES[b.zone]?.cat !== 'res',

  capOf(b: Building): number {
    const z = zoneOf(b);
    if (!z) return 0;
    const c = z.cap[b.level - 1];
    if (z.rows) {
      const units = Math.max(2, Math.round((b.w * T) / 4.6));
      return Math.round(units * c);
    }
    if (z.perBuilding) {
      const a = b.w * b.d;
      return Math.max(
        2,
        Math.round(c * (a <= 1 ? 0.7 : a <= 2 ? 1 : a <= 3 ? 1.25 : a <= 4 ? 1.5 : 2))
      );
    }
    return c * b.w * b.d;
  },

  centerTile: (b: Building): number => U.idx(b.x + (b.fw >> 1), b.y + (b.fh >> 1)),
  lotTiles,
  employedOf,

  makeBuilding(spec: BuildingSpec): Building {
    const b: Building = Object.assign(
      {
        id: Sim.nextId++,
        level: 1,
        state: 'live',
        st: 0,
        buildT: 2.5,
        seed: Math.floor(Sim.rng() * 1e9),
        res: 0,
        jobs: 0,
        filled: 0,
        outside: 0,
        work: [],
        happy: 60,
        garbage: 0,
        prog: 0,
        low: 0,
        abandT: 0,
        cust: 0,
        custRatio: 0.7,
        commute: 0,
        gTarget: false,
        vehOut: 0,
        fire: 0,
        prob: null,
        age: 0,
        stock: spec.zone && C.ZONES[spec.zone]?.cat === 'com' ? 30 : spec.zone && C.ZONES[spec.zone]?.cat === 'ind' ? 20 : 0,
        stockMax: spec.zone && C.ZONES[spec.zone]?.cat === 'com' ? 50 : spec.zone && C.ZONES[spec.zone]?.cat === 'ind' ? 120 : 0,
        stockoutHours: 0,
        industryType: (spec.zone && C.ZONES[spec.zone]?.cat === 'ind' ? 'generic' : undefined) as 'generic' | undefined,
        outputRate: 0,
      },
      spec
    );
    if (!spec.noLevel) World.levelLot(b);
    delete b.noLevel;
    let mx = -1e9,
      mn = 1e9;
    for (let y = b.y; y <= b.y + b.fh; y++) {
      for (let x = b.x; x <= b.x + b.fw; x++) {
        const h = World.cornerH(x, y);
        mx = Math.max(mx, h);
        mn = Math.min(mn, h);
      }
    }
    b.baseY = Math.max(mx, C.WATER + 0.3) + 0.05;
    b.minY = mn;
    b.ang = World.frontAngle(b);
    for (const t of lotTiles(b)) {
      World.bld[t] = b.id;
      World.tree[t] = 0;
    }
    Sim.buildings.set(b.id, b);
    b.name = nameFor(b);
    const CB = (window as any).CB;
    if (CB?.Meshes) {
      CB.Meshes.addBuilding(b);
      CB.Meshes.treesDirty = true;
    }
    Sim.zoneTexDirty = true;
    Sim.lotsDirty = true;
    return b;
  },

  removeBuilding(b: Building, _quiet?: boolean) {
    if (!Sim.buildings.has(b.id)) return;
    for (const t of lotTiles(b)) {
      if (World.bld[t] === b.id) World.bld[t] = 0;
    }
    if (Sim.isRes(b)) releaseWork(b);
    if (Sim.isWork(b)) {
      Sim.buildings.forEach((o: Building) => {
        if (o.work?.length) o.work = o.work.filter((w: { id: number; n: number }) => w.id !== b.id);
      });
    }
    Sim.buildings.delete(b.id);
    const CB = (window as any).CB;
    if (CB?.Meshes) {
      CB.Meshes.removeBuilding(b);
      CB.Meshes.treesDirty = true;
    }
    Sim.zoneTexDirty = true;
    Sim.lotsDirty = true;
    if (b.kind === 'svc') Sim.covDirty = true;
    if (CB?.UI && CB.UI.selected === b) CB.UI.select(null);
  },

  setZone(i: number, z: number): boolean {
    if (World.zone[i] === z) return false;
    if (z && !World.zonable[i]) return false;
    const bid = World.bld[i];
    if (bid) {
      const b = Sim.buildings.get(bid);
      if (b && b.kind === 'svc') return false;
      if (b && b.zone !== z) Sim.removeBuilding(b);
    }
    World.zone[i] = z;
    Sim.lotsDirty = true;
    Sim.zoneTexDirty = true;
    return true;
  },

  serviceLot(key: string, cx: number, cy: number, dir?: number, ignore?: number): ServiceLotResult {
    const sv = C.SERVICES[key];
    if (!sv) return { ok: false, reason: 'Invalid service' };
    const [w, d] = sv.size;
    const tryDir = (f: number) => {
      const fw = f % 2 === 0 ? w : d,
        fh = f % 2 === 0 ? d : w;
      const x = cx - Math.floor((fw - 1) / 2),
        y = cy - Math.floor((fh - 1) / 2);
      let ok = true,
        road = -1,
        reason = '';
      for (let yy = y; yy < y + fh; yy++) {
        for (let xx = x; xx < x + fw; xx++) {
          if (!U.inPlay(xx, yy)) {
            ok = false;
            reason = 'Outside the city limits';
            continue;
          }
          const t = U.idx(xx, yy);
          if (!World.buildable(t)) {
            ok = false;
            reason = 'Ground is too steep or wet';
          } else if (World.road[t]) {
            ok = false;
            reason = 'Blocked by a road';
          } else if (World.pmask[t]) {
            ok = false;
            reason = 'Blocked by a path';
          } else if (World.rail[t] === 1) {
            ok = false;
            reason = 'Blocked by elevated track';
          } else if (World.bld[t] && World.bld[t] !== ignore) {
            const b = Sim.buildings.get(World.bld[t]);
            if (!b || b.kind === 'svc') {
              ok = false;
              reason = 'Blocked by a building';
            }
          }
        }
      }
      for (let yy = y; yy < y + fh; yy++) {
        for (let xx = x; xx < x + fw; xx++) {
          const t = U.idx(xx, yy);
          const n = World.neighbor(t, f);
          if (n < 0) continue;
          const nx = U.tx(n),
            ny = U.ty(n);
          const inside = nx >= x && nx < x + fw && ny >= y && ny < y + fh;
          if (!inside && World.road[n] && road < 0) road = n;
        }
      }
      if (road < 0 && ok) {
        ok = false;
        reason = 'Needs a road along the front';
      }
      return { x, y, fw, fh, w, d, dir: f, road, ok, reason };
    };
    const first = tryDir(dir || 0);
    if (first.ok || dir === undefined) return first;
    for (let k = 1; k < 4; k++) {
      const r = tryDir(((dir || 0) + k) % 4);
      if (r.ok) return r;
    }
    const offs: [number, number][] = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) if (dx || dy) offs.push([dx, dy]);
    }
    offs.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - (Math.abs(b[0]) + Math.abs(b[1])));
    const ocx = cx,
      ocy = cy;
    for (const [dx, dy] of offs) {
      cx = ocx + dx;
      cy = ocy + dy;
      for (let k = 0; k < 4; k++) {
        const r = tryDir(((dir || 0) + k) % 4);
        if (r.ok) return r;
      }
    }
    return first;
  },

  placeService(key: string, lot: ServiceLotResult): Building {
    for (let yy = lot.y; yy < lot.y + lot.fh; yy++) {
      for (let xx = lot.x; xx < lot.x + lot.fw; xx++) {
        const t = U.idx(xx, yy);
        if (World.bld[t]) {
          const b = Sim.buildings.get(World.bld[t]);
          if (b) Sim.removeBuilding(b);
        }
        World.zone[t] = 0;
      }
    }
    const b = Sim.makeBuilding({
      kind: 'svc',
      svc: key,
      x: lot.x,
      y: lot.y,
      fw: lot.fw,
      fh: lot.fh,
      w: lot.w,
      d: lot.d,
      dir: lot.dir,
      road: lot.road,
      state: 'live',
    });
    Sim.covDirty = true;
    return b;
  },

  moveCost: (b: Building) =>
    Math.max(200, Math.round(((C.SERVICES[b.svc]?.cost || 1000) * 0.1) / 50) * 50),

  relocateService(b: Building, lot: ServiceLotResult) {
    for (const t of lotTiles(b)) if (World.bld[t] === b.id) World.bld[t] = 0;
    for (let yy = lot.y; yy < lot.y + lot.fh; yy++) {
      for (let xx = lot.x; xx < lot.x + lot.fw; xx++) {
        const t = U.idx(xx, yy);
        if (World.bld[t]) {
          const o = Sim.buildings.get(World.bld[t]);
          if (o && o !== b) Sim.removeBuilding(o);
        }
        World.zone[t] = 0;
      }
    }
    const CB = (window as any).CB;
    if (CB?.Meshes) CB.Meshes.removeBuilding(b);
    Object.assign(b, {
      x: lot.x,
      y: lot.y,
      fw: lot.fw,
      fh: lot.fh,
      dir: lot.dir,
      road: lot.road,
    });
    World.levelLot(b);
    let mx = -1e9,
      mn = 1e9;
    for (let y = b.y; y <= b.y + b.fh; y++) {
      for (let x = b.x; x <= b.x + b.fw; x++) {
        const h = World.cornerH(x, y);
        mx = Math.max(mx, h);
        mn = Math.min(mn, h);
      }
    }
    b.baseY = Math.max(mx, C.WATER + 0.3) + 0.05;
    b.minY = mn;
    for (const t of lotTiles(b)) {
      World.bld[t] = b.id;
      World.tree[t] = 0;
    }
    if (CB?.Meshes) {
      CB.Meshes.addBuilding(b);
      CB.Meshes.treesDirty = true;
    }
    Sim.covDirty = true;
    Sim.zoneTexDirty = true;
    Sim.lotsDirty = true;
  },

  setRoad(i: number, type: number) {
    World.road[i] = type;
    World.tree[i] = 0;
    if (type) World.zone[i] = 0;
    const CB = (window as any).CB;
    if (CB?.Meshes) {
      CB.Meshes.markInfra(i);
      CB.Meshes.treesDirty = true;
    }
  },

  setRail(i: number, type: number) {
    World.rail[i] = type;
    if (type === 1) {
      World.tree[i] = 0;
      if (!World.road[i]) World.zone[i] = 0;
    }
    const CB = (window as any).CB;
    if (CB?.Meshes) {
      CB.Meshes.markInfra(i);
      CB.Meshes.treesDirty = true;
    }
  },

  networkChanged() {
    World.updateZonable();
    World.updateConn();
    World.updateJunctions();
    World.roadVer++;
    const CB = (window as any).CB;
    if (CB?.Meshes) CB.Meshes.junctionsChanged();
    for (let i = 0; i < N; i++) {
      if (World.zone[i] && !World.zonable[i] && !World.bld[i]) World.zone[i] = 0;
    }
    Sim.lotsDirty = true;
    Sim.zoneTexDirty = true;
    Traffic.validate();
    Transit.validate();
    Sim.buildings.forEach((b: Building) => {
      if (!World.road[b.road]) rehome(b);
    });
  },

  computeCoverage,

  zoneDemand(z: number): number {
    const k = C.ZONES[z]?.key;
    if (k === 'rlow') return Sim.demand.rlow;
    if (k === 'rmed' || k === 'rapt') return Sim.demand.rmed;
    if (k === 'rhigh') return Sim.demand.rhigh;
    if (k === 'clow' || k === 'chigh') return Sim.demand.com;
    if (k === 'ind') return Sim.demand.ind;
    return Sim.demand.off;
  },

  chooseMode(
    dist: number,
    hasCar: boolean,
    safety: number,
    transit: number | null,
    carT: number
  ): string {
    const r = Sim.rng;
    const pWalk = dist <= 4 ? 0.7 : dist <= 14 ? (0.7 * (14 - dist)) / 10 : 0;
    if (r() < pWalk) return 'walk';
    if (safety >= 0 && dist <= 70) {
      const fd = dist <= 30 ? 1 : (70 - dist) / 40;
      const pBike = BIKE_OWN * fd * (0.08 + 0.92 * Math.pow(safety, 1.5));
      if (r() < pBike) return 'bike';
    }
    if (transit) {
      const p = hasCar ? 1 / (1 + Math.exp((transit - carT * 1.3) / 10)) : 1;
      if (r() < p * 0.92 + 0.04) return 'transit';
    }
    if (hasCar) return 'car';
    if (safety >= 0 && dist <= 90) return 'bike';
    if (dist <= 40) return 'walk';
    return 'car';
  },

  projected(): { inc: number; exp: number; net: number } {
    const src = Sim.month > 0 ? Sim.last : Sim.budget;
    let inc = 0,
      exp = 0;
    for (const k in src.inc) inc += src.inc[k];
    for (const k in src.exp) exp += src.exp[k];
    if (Sim.month === 0) {
      const f = 24 / Math.max(1, Sim.dayAcc || 0);
      inc *= f;
      exp *= f;
    }
    return { inc, exp, net: inc - exp };
  },

  takeLoan(amt: number): boolean {
    if (Sim.loans.length >= 3) return false;
    const months = 24;
    Sim.loans.push({
      amount: amt,
      payment: Math.round((amt * 1.12) / months),
      left: months,
    });
    Sim.money += amt;
    Sim.notify('Loan of ' + U.money(amt) + ' approved.', 'good');
    return true;
  },

  repayLoan(k: number): boolean {
    const l = Sim.loans[k];
    if (!l) return false;
    const owed = l.payment * l.left;
    if (Sim.money < owed) return false;
    Sim.money -= owed;
    Sim.loans.splice(k, 1);
    return true;
  },

  step(dt: number) {
    const dtH = dt / C.HOUR_SEC;
    const dtS = dt / C.SIM_SEC;
    Sim.hour += dtH;
    if (Sim.hour >= 24) Sim.hour -= 24;
    const CB = (window as any).CB;

    Sim.buildings.forEach((b: Building) => {
      if (b.state === 'build') {
        b.st += dtS;
        if (b.st >= b.buildT) {
          b.state = 'live';
          b.st = 0;
          if (CB?.Meshes) CB.Meshes.refreshBuilding(b);
          b._h = 0;
          if (Sim.isRes(b)) moveIn(b);
          Sim.zoneTexDirty = true;
        }
      }
    });

    generateTrips(dtH);
    Sim.tickAcc += dtS;
    if (Sim.tickAcc >= 0.25) {
      Sim.tickAcc = 0;
      if (Sim.covDirty) computeCoverage();
      refreshLists();
      matchJobs();
      computeDemand();
      growth();
      checkMilestones();
    }
    Sim.hourAcc += dtS;
    if (Sim.hourAcc >= 1) {
      Sim.hourAcc -= 1;
      Sim.simHours = (Sim.simHours || 0) + 1;
      updateWind();
      Water.step(Sim.buildings, Sim.cov);
      Sim.stats.waterSupply = Water.waterSupply;
      Sim.stats.waterDemand = Water.waterDemand;
      Sim.stats.waterPurity = Math.round(Water.waterPurity * 100);
      Sim.stats.sewageCap = Water.sewageCap;
      Sim.stats.sewageLoad = Water.sewageLoad;
      hourlyBuildings();
      hourlyEconomy();
      Unrest.step(Sim.buildings, Sim.cov, Sim.tax, Sim.stats.unemployment || 0, Sim.stats.pop);
      Sim.stats.unrest = Unrest.state.score;
      Sim.stats.unrestLevel = Unrest.state.level;
      Sim.stats.activeStrikes = (Object.keys(Unrest.state.strikes) as (keyof StrikesState)[]).filter(k => Unrest.state.strikes[k]);
      dispatchServices();
      computeCoverage();
      if (Sim.rng() < 0.06 && Sim.hour > 7 && Sim.hour < 22) chirp();
    }
    Sim.dayAcc = (Sim.dayAcc || 0) + dtS;
    if (Sim.dayAcc >= 24) {
      Sim.dayAcc -= 24;
      Sim.month++;
      monthly();
    }
  },

  overlayFn(key: string): (i: number) => number[] | null {
    const cv = Sim.cov;
    const play = (i: number) => U.inPlay(U.tx(i), U.ty(i));
    switch (key) {
      case 'traffic':
        return i => {
          const rt = World.road[i];
          if (!rt) return null;
          const r = U.clamp(Traffic.load[i] / C.ROADS[rt]!.cap, 0, 1);
          return ramp(1 - r);
        };
      case 'lv':
        return i => (play(i) ? ramp(cv.lv[i] / 70) : null);
      case 'pollution':
        return i => {
          const v = Math.min(1, cv.pollution[i]);
          return v > 0.03
            ? [0.55 + v * 0.3, 0.42 - v * 0.2, 0.15, U.clamp(v * 1.4, 0, 0.9)]
            : play(i)
            ? [0.3, 0.75, 0.35, 0.35]
            : null;
        };
      case 'noise':
        return i => {
          const v = cv.noise[i];
          return v > 0.05
            ? [0.9, 0.5 - v * 0.3, 0.9 - v * 0.6, U.clamp(v, 0, 0.9)]
            : null;
        };
      case 'happy':
        return i => {
          const b = World.bld[i] && (Sim.buildings.get(World.bld[i]) as any);
          return b && b.kind === 'zone' ? ramp(b.happy / 100) : null;
        };
      case 'transit':
        return i => (play(i) ? [0.2, 0.6, 1, cv.transit[i] * 0.75] : null);
      case 'garbage':
        return i => {
          const b = World.bld[i] && (Sim.buildings.get(World.bld[i]) as any);
          if (b && b.kind === 'zone') return ramp(1 - b.garbage / 150);
          return play(i) && cv.garbage[i] > 0
            ? [0.3, 0.7, 0.4, cv.garbage[i] * 0.35]
            : null;
        };
      case 'district': {
        const hexToRgb = (hex: string): [number, number, number] => {
          const num = parseInt(hex.replace('#', ''), 16);
          return [(num >> 16) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
        };
        const colMap = new Map<number, [number, number, number]>();
        return i => {
          const did = World.district ? World.district[i] : 0;
          if (!did) return null;
          const dist = World.districts.get(did);
          if (!dist) return null;
          let rgb = colMap.get(did);
          if (!rgb) {
            rgb = hexToRgb(dist.color);
            colMap.set(did, rgb);
          }
          const x = U.tx(i),
            y = U.ty(i);
          const isBorder =
            (x > 0 && World.district[U.idx(x - 1, y)] !== did) ||
            (x < W - 1 && World.district[U.idx(x + 1, y)] !== did) ||
            (y > 0 && World.district[U.idx(x, y - 1)] !== did) ||
            (y < W - 1 && World.district[U.idx(x, y + 1)] !== did);
          return [rgb[0], rgb[1], rgb[2], isBorder ? 0.78 : 0.35];
        };
      }
      case 'resources':
        return i => {
          if (!play(i)) return null;
          const r = World.resource ? World.resource[i] : 0;
          if (r === C.RES_FERTILE) return [0.92, 0.75, 0.12, 0.7];
          if (r === C.RES_FOREST) return [0.12, 0.68, 0.22, 0.7];
          if (r === C.RES_ORE) return [0.45, 0.55, 0.72, 0.75];
          if (r === C.RES_OIL) return [0.22, 0.12, 0.32, 0.8];
          return null;
        };
      case 'water':
        return i => {
          if (!play(i)) return null;
          if (World.waterPipe && World.waterPipe[i] > 0) return [0.08, 0.72, 1.0, 0.95];
          if (Water.waterServed && Water.waterServed[i] > 0) return [0.15, 0.55, 0.95, 0.38];
          return [0.18, 0.22, 0.28, 0.18];
        };
      case 'sewage':
        return i => {
          if (!play(i)) return null;
          if (World.sewagePipe && World.sewagePipe[i] > 0) return [0.95, 0.55, 0.1, 0.95];
          if (Water.sewageServed && Water.sewageServed[i] > 0) return [0.85, 0.45, 0.15, 0.38];
          return [0.26, 0.2, 0.16, 0.18];
        };
      case 'water_pollution':
        return i => {
          if (World.isWater(i)) {
            const p = Water.waterPollution[i];
            return p > 0.02 ? [0.65 + p * 0.3, 0.1, 0.75, U.clamp(p * 1.5, 0.25, 0.95)] : null;
          }
          if (play(i)) {
            const gp = Water.groundWaterPollution[i];
            return gp > 0.02 ? [0.75, 0.45, 0.1, U.clamp(gp * 1.3, 0.2, 0.85)] : null;
          }
          return null;
        };
      case 'health':
        return i => {
          if (!play(i)) return null;
          const b = World.bld[i] && (Sim.buildings.get(World.bld[i]) as any);
          if (b && (b.sick || 0) > 0) return [0.95, 0.15, 0.15, 0.9];
          return cv.health[i] > 0 ? [0.2, 0.8, 0.4, cv.health[i] * 0.4] : null;
        };
      case 'death':
        return i => {
          if (!play(i)) return null;
          const b = World.bld[i] && (Sim.buildings.get(World.bld[i]) as any);
          if (b && (b.dead || 0) > 0) return [0.4, 0.2, 0.6, 0.9];
          return null;
        };
      case 'unrest':
        return i => {
          if (!play(i)) return null;
          const u = Unrest.unrestGrid[i] || 0;
          if (u < 0.20) return [0.15, 0.72, 0.35, 0.22];
          if (u < 0.45) return [0.92, 0.76, 0.15, 0.45];
          if (u < 0.70) return [0.92, 0.45, 0.10, 0.68];
          return [0.88, 0.15, 0.15, 0.88];
        };
      default:
        return i => (play(i) && cv[key] ? ramp(Math.min(1, cv[key][i])) : null);
    }
  },

  serialize(): SerializedCity {
    return serializeCity(Sim);
  },

  load(d: SerializedCity) {
    loadCity(Sim, d, lotTiles, nameFor, () => {
      computeCoverage();
      hourlyBuildings();
      computeDemand();
    });
  },
};
