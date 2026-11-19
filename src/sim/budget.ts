/**
 * Open Skylines — Municipal Budget, Taxation & Debt Management (`src/sim/budget.ts`)
 */
import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { World } from '@/world/world';
import { Transit } from '@/transit/transit';
import { Building, SimStats } from '@/types';

const N = C.W * C.W;

export interface LoanItem {
  amt?: number;
  amount?: number;
  payment: number;
  left: number;
  total?: number;
}

export interface BudgetReport {
  inc: Record<string, number>;
  exp: Record<string, number>;
}

export function blankBudget(): BudgetReport {
  return {
    inc: { res: 0, com: 0, ind: 0, off: 0, fares: 0, export: 0 },
    exp: { services: 0, roads: 0, transit: 0, utilities: 0, loans: 0, imports: 0 },
  };
}

export interface SimBudgetHost {
  money: number;
  budget: BudgetReport;
  last: BudgetReport;
  tax: { res: number; com: number; ind: number; off: number };
  loans: LoanItem[];
  stats: SimStats;
  buildings: Map<number, Building>;
  history: { pop: number; money: number }[];
  isWork(b: Building): boolean;
}

export function hourlyEconomy(sim: SimBudgetHost): void {
  const B = sim.budget;
  let res = 0;
  let com = 0;
  let ind = 0;
  let off = 0;
  let svc = 0;

  sim.buildings.forEach((b: Building) => {
    if (b.kind === 'svc') {
      svc += b.svc ? C.SERVICES[b.svc]?.upkeep || 0 : 0;
      return;
    }
    if (b.state !== 'live') return;
    const z = b.zone ? C.ZONES[b.zone] : null;
    if (!z) return;
    const L = (b.level ?? b.lvl ?? 1) - 1;
    const residents = b.pop ?? b.occ ?? 0;

    if (z.cat === 'res') {
      res += (b.res || residents) * (3.0 + 0.5 * L);
    } else {
      const wk = (b.filled ?? b.occ ?? 0) + (b.outside || 0);
      const custRatio = b.custRatio ?? 1.0;
      if (z.cat === 'com') {
        com += wk * (3.4 + 0.5 * L) * (0.55 + 0.45 * Math.min(1.2, custRatio));
      } else if (z.cat === 'ind') {
        ind += wk * (3.2 + 0.4 * L);
      } else {
        off += wk * (4.4 + 0.6 * L);
      }
    }
  });

  const inc: Record<string, number> = {
    res: (res * sim.tax.res) / 10 / 24,
    com: (com * sim.tax.com) / 10 / 24,
    ind: (ind * sim.tax.ind) / 10 / 24,
    off: (off * sim.tax.off) / 10 / 24,
  };

  let roads = 0;
  for (let i = 0; i < N; i++) {
    if (World.road[i] && U.inPlay(U.tx(i), U.ty(i))) {
      const R = C.ROADS[World.road[i]];
      if (R) roads += R.upkeep / R.w;
    }
    if (World.pmask[i]) {
      for (let q = 0; q < 4; q++) {
        const k = World.pcell[World.cellOf(i, q)];
        if (k && C.PATHS[k]) roads += C.PATHS[k]!.upkeep;
      }
    }
    if (World.rail[i] && C.RAIL[World.rail[i]]) roads += C.RAIL[World.rail[i]]!.upkeep;
  }

  let transit = 0;
  for (const l of Transit.lines) {
    transit += l.vehicles * (C.TRANSIT[l.type]?.upkeep || 0);
  }

  let loans = 0;
  for (const l of sim.loans) loans += l.payment;

  let policyCost = 0;
  if (World.districts) {
    for (const dist of World.districts.values()) {
      if (dist.stats.tiles <= 0) continue;
      const t = dist.stats.tiles;
      if (dist.policies.recycling) policyCost += t * 0.15;
      if (dist.policies.smokeDetectors) policyCost += t * 0.2;
      if (dist.policies.freeTransit) policyCost += t * 0.25;
      if (dist.policies.bikeCity) policyCost += t * 0.1;
    }
  }

  const exp: Record<string, number> = {
    services: (svc + policyCost) / 24,
    roads: roads / 24,
    transit: transit / 24,
    utilities: (sim.stats.pop * 0.35) / 24,
    loans: loans / 24,
  };

  for (const k in inc) {
    B.inc[k] = (B.inc[k] || 0) + inc[k];
    sim.money += inc[k];
  }
  for (const k in exp) {
    B.exp[k] = (B.exp[k] || 0) + exp[k];
    sim.money -= exp[k];
  }
}

export function monthlyBudget(sim: SimBudgetHost): void {
  sim.last = sim.budget;
  sim.budget = blankBudget();
  for (const l of sim.loans) l.left--;
  sim.loans = sim.loans.filter(l => l.left > 0);

  sim.buildings.forEach((b: Building) => {
    if (sim.isWork(b) && b.zone && C.ZONES[b.zone]?.cat === 'com') {
      const jobs = b.cap ?? 1;
      const need = Math.max(1, jobs * 5);
      const cust = b.cust ?? 0;
      const currentRatio = b.custRatio ?? 1.0;
      b.custRatio = U.clamp(currentRatio * 0.4 + (cust / need) * 0.6, 0, 1.5);
      b.cust = 0;
    }
  });

  Transit.monthly();
  World.updateDistrictStats();
  sim.history.push({ pop: sim.stats.pop, money: Math.round(sim.money) });
  if (sim.history.length > 120) sim.history.shift();

  const CB = typeof window !== 'undefined' ? (window as any).CB : null;
  if (CB?.Game?.autosave) CB.Game.autosave();
}

export function projectedBudget(last: BudgetReport): { inc: number; exp: number; net: number } {
  let inc = 0;
  let exp = 0;
  for (const k in last.inc) inc += last.inc[k];
  for (const k in last.exp) exp += last.exp[k];
  return { inc, exp, net: inc - exp };
}

export function takeLoan(sim: SimBudgetHost, amt: number): boolean {
  if (sim.loans.length >= 3) return false;
  const mo = 36;
  const rate = 0.05;
  const total = amt * (1 + rate * (mo / 12));
  sim.loans.push({ amt, payment: total / mo, left: mo, total });
  sim.money += amt;
  return true;
}

export function repayLoan(sim: SimBudgetHost, k: number): boolean {
  const l = sim.loans[k];
  if (!l) return false;
  const cost = l.payment * l.left;
  if (sim.money < cost) return false;
  sim.money -= cost;
  sim.loans.splice(k, 1);
  return true;
}

export function earn(sim: SimBudgetHost, cat: string, amt: number): void {
  sim.budget.inc[cat] = (sim.budget.inc[cat] || 0) + amt;
  sim.money += amt;
}
