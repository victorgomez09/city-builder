/**
 * Vira City — Social Unrest, Strikes, Protest & Union Dialogue Engine (`src/sim/unrest.ts`)
 *
 * Simulates civic unrest, fiscal discontent, protest marches with physical agents,
 * service strikes (garbage, transit, fire, police, health), street barricades,
 * and collective bargaining / union negotiation agreements.
 */

import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { World } from '@/world/world';
import {
  Building,
  TaxRates,
  UnrestState,
  UnrestLevel,
  UnrestFactors,
  StrikesState,
  UnionDemand,
  Barricade,
  ProtestCrowd,
} from '@/types';

const W = C.WORLD;
const N = W * W;

export class UnrestEngine {
  unrestGrid: Float32Array;
  state: UnrestState;
  nextBarricadeId: number = 1;
  nextCrowdId: number = 1;

  constructor() {
    this.unrestGrid = new Float32Array(N);
    this.state = this.createDefaultState();
  }

  createDefaultState(): UnrestState {
    return {
      score: 0,
      level: 'peaceful',
      factors: {
        taxPressure: 0,
        unemployment: 0,
        pollution: 0,
        serviceDeficit: 0,
        stockouts: 0,
        unattendedDead: 0,
      },
      strikes: {
        garbage: false,
        fire: false,
        police: false,
        transit: false,
        health: false,
      },
      pacts: this.generateDefaultPacts(),
      barricades: [],
      crowds: [],
      riotHours: 0,
      peaceTreatyMonths: 0,
    };
  }

  init(): void {
    this.unrestGrid.fill(0);
    this.state = this.createDefaultState();
  }

  generateDefaultPacts(): UnionDemand[] {
    return [
      {
        id: 'pact_civic',
        union: 'civic',
        unionName: 'Sindicato de Limpieza y Residuos',
        repName: 'Javier Morales',
        title: 'Convenio Colectivo de Servicios Urbanos',
        desc: 'Exige presupuesto garantizado de mantenimiento y subsidio de peligrosidad.',
        demands: 'Presupuesto de basura digno y fin del colapso en vertederos.',
        cost: 4500,
        durationMonths: 12,
        accepted: false,
        monthsRemaining: 0,
      },
      {
        id: 'pact_transit',
        union: 'transit',
        unionName: 'Federación de Conductores de Tránsito',
        repName: 'Marta Soler',
        title: 'Pacto de Mantenimiento de Flota y Seguridad',
        desc: 'Demanda revisión de líneas saturadas, descanso de turnos y seguridad en andenes.',
        demands: 'Subsidio a la flota y restablecimiento de frecuencias al 100%.',
        cost: 5500,
        durationMonths: 12,
        accepted: false,
        monthsRemaining: 0,
      },
      {
        id: 'pact_emergency',
        union: 'emergency',
        unionName: 'Cuerpo de Bomberos y Primeros Auxilios',
        repName: 'Capitán R. Méndez',
        title: 'Dotación de Equipos y Cobertura de Emergencias',
        desc: 'Exige modernización de vehículos de extinción y ambulancias medicalizadas.',
        demands: 'Fondos de protección y fin de las jornadas de servicio abusivas.',
        cost: 6500,
        durationMonths: 12,
        accepted: false,
        monthsRemaining: 0,
      },
      {
        id: 'pact_residents',
        union: 'residents',
        unionName: 'Coordinadora de Asociaciones Vecinales',
        repName: 'Elena Carrasco',
        title: 'Fondo de Emergencia Social y Alivio Fiscal',
        desc: 'Reclama un freno a la presión impositiva y solución a los cortes de agua y polución.',
        demands: 'Moratoria fiscal y reducción inmediata de la tensión social en barrios.',
        cost: 8000,
        durationMonths: 6,
        accepted: false,
        monthsRemaining: 0,
      },
    ];
  }

  /**
   * Main simulation step for civic unrest, strikes, and protests.
   */
  step(
    buildings: Map<number, Building>,
    cv: Record<string, Float32Array>,
    tax: TaxRates,
    unemploymentRate: number,
    totalPop: number
  ): void {
    if (totalPop < 35) {
      this.state.score = 0;
      this.state.level = 'peaceful';
      this.state.barricades = [];
      this.state.crowds = [];
      this.resetStrikes();
      return;
    }

    // 1. Calculate Factor Pressures
    const factors = this.computeFactors(buildings, cv, tax, unemploymentRate, totalPop);
    this.state.factors = factors;

    // 2. Aggregate Unrest Score
    let rawScore =
      factors.taxPressure * 0.28 +
      factors.unemployment * 0.20 +
      factors.serviceDeficit * 0.24 +
      factors.pollution * 0.12 +
      factors.stockouts * 0.10 +
      factors.unattendedDead * 0.06;

    // Active peace treaties provide strong tension relief
    if (this.state.peaceTreatyMonths > 0) {
      rawScore = Math.max(5, rawScore * 0.62 - 20);
    }

    const finalScore = Math.round(U.clamp(rawScore, 0, 100));
    this.state.score = finalScore;

    // 3. Update Unrest Level
    let level: UnrestLevel = 'peaceful';
    if (finalScore >= 75) {
      level = this.state.barricades.length > 0 ? 'riot' : 'strike';
    } else if (finalScore >= 50) {
      level = 'protest';
    } else if (finalScore >= 25) {
      level = 'tense';
    }
    this.state.level = level;

    // 4. Update Continuous Spatial Unrest Grid
    this.updateUnrestGrid(buildings, cv, factors);

    // 5. Evaluate and Trigger Strikes
    this.evaluateStrikes(finalScore, factors);

    // 6. Manage Physical Protest Marches & Crowds
    this.manageProtests(finalScore, buildings);

    // 7. Manage Barricades & Urban Riots
    this.manageBarricades(finalScore, buildings);

    // 8. Apply Problem Flags to Buildings in Strike / Riot areas
    this.applyBuildingProblemFlags(buildings);
  }

  /**
   * Evaluates macro social factors and pressures.
   */
  computeFactors(
    buildings: Map<number, Building>,
    cv: Record<string, Float32Array>,
    tax: TaxRates,
    unemploymentRate: number,
    totalPop: number
  ): UnrestFactors {
    // A. Tax Pressure (neutral is 10%; taxes > 12% trigger exponential stress)
    const avgTax = (tax.res * 2.2 + tax.com * 1.0 + tax.ind * 0.8) / 4.0;
    let taxPressure = 0;
    if (avgTax > 10.0) {
      taxPressure += (avgTax - 10.0) * 5.5;
    }
    if (avgTax > 13.0) {
      taxPressure += (avgTax - 13.0) * 8.0;
    }
    taxPressure = U.clamp(taxPressure, 0, 100);

    // B. Unemployment
    let unempPressure = 0;
    if (unemploymentRate > 0.05) {
      unempPressure = (unemploymentRate - 0.05) * 260.0;
    }
    unempPressure = U.clamp(unempPressure, 0, 100);

    // C. Pollution & Noise in populated areas
    let totalPollution = 0;
    let resCount = 0;
    let serviceComplaints = 0;
    let stockoutCount = 0;
    let deadCount = 0;
    let comCount = 0;

    buildings.forEach((b: Building) => {
      if (b.kind === 'zone') {
        const z = b.zone ?? 1;
        const isRes = z <= 3 || z === 8;
        const isCom = z === 4 || z === 5;
        const tile = U.idx(Math.floor(b.x), Math.floor(b.y));

        if (isRes && b.state === 'live') {
          resCount++;
          const pol = cv.pollution ? cv.pollution[tile] || 0 : 0;
          const noise = cv.noise ? cv.noise[tile] || 0 : 0;
          totalPollution += pol * 1.2 + noise * 0.6;

          if (b.prob === 'nowater') serviceComplaints += 1.2;
          if (b.prob === 'sewage') serviceComplaints += 1.0;
          if (b.prob === 'water_polluted') serviceComplaints += 2.0;
          if (b.prob === 'garbage') serviceComplaints += 0.8;
          if (b.prob === 'sick') serviceComplaints += 0.7;
          if (b.prob === 'dead') deadCount += 1.5;
        }

        if (isCom) {
          comCount++;
          if (b.prob === 'stockout') stockoutCount++;
        }
      }
    });

    const avgPol = resCount > 0 ? (totalPollution / resCount) * 100 : 0;
    const pollutionPressure = U.clamp(avgPol, 0, 100);

    const normService = resCount > 0 ? (serviceComplaints / resCount) * 250 : 0;
    const serviceDeficit = U.clamp(normService, 0, 100);

    const normStockouts = comCount > 0 ? (stockoutCount / comCount) * 320 : 0;
    const stockoutPressure = U.clamp(normStockouts, 0, 100);

    const normDead = resCount > 0 ? (deadCount / resCount) * 400 : 0;
    const deadPressure = U.clamp(normDead, 0, 100);

    return {
      taxPressure: Math.round(taxPressure),
      unemployment: Math.round(unempPressure),
      pollution: Math.round(pollutionPressure),
      serviceDeficit: Math.round(serviceDeficit),
      stockouts: Math.round(stockoutPressure),
      unattendedDead: Math.round(deadPressure),
    };
  }

  /**
   * Updates the continuous flat unrest grid for GPU overlays and local tension queries.
   */
  updateUnrestGrid(
    buildings: Map<number, Building>,
    cv: Record<string, Float32Array>,
    factors: UnrestFactors
  ): void {
    // Baseline global pressure
    const baseUnrest = (this.state.score / 100) * 0.35;
    this.unrestGrid.fill(baseUnrest);

    buildings.forEach((b: Building) => {
      const tile = U.idx(Math.floor(b.x), Math.floor(b.y));
      let localStress = baseUnrest;

      if (b.kind === 'zone') {
        const happy = b.happy ?? 50;
        localStress += (100 - happy) / 100 * 0.45;

        if (b.prob === 'nowater' || b.prob === 'sewage') localStress += 0.25;
        if (b.prob === 'water_polluted') localStress += 0.40;
        if (b.prob === 'dead') localStress += 0.35;
        if (b.prob === 'stockout') localStress += 0.25;
        if (b.prob === 'strike' || b.prob === 'riot') localStress += 0.45;
      }

      localStress = U.clamp(localStress, 0, 1.0);
      this.unrestGrid[tile] = Math.max(this.unrestGrid[tile], localStress);

      // Diffuse onto road access cell
      const rt = b.road ?? tile;
      if (rt >= 0 && rt < N) {
        this.unrestGrid[rt] = Math.max(this.unrestGrid[rt], localStress * 0.9);
      }
    });

    // Mark barricade tiles with maximum red alert
    for (const bar of this.state.barricades) {
      if (bar.tile >= 0 && bar.tile < N) {
        this.unrestGrid[bar.tile] = 1.0;
      }
    }
  }

  /**
   * Evaluates strike status for essential public services.
   */
  evaluateStrikes(score: number, factors: UnrestFactors): void {
    const pacts = this.state.pacts;
    const isPactActive = (unionKey: string) => {
      const p = pacts.find(it => it.union === unionKey);
      return p ? p.accepted && p.monthsRemaining > 0 : false;
    };

    // 1. Garbage strike: refuse piles up
    if (!isPactActive('civic')) {
      if (factors.serviceDeficit > 35 || score >= 62) {
        this.state.strikes.garbage = true;
      } else if (score < 42 && factors.serviceDeficit < 25) {
        this.state.strikes.garbage = false;
      }
    } else {
      this.state.strikes.garbage = false;
    }

    // 2. Transit strike: drivers walk off job
    if (!isPactActive('transit')) {
      if (score >= 66 || (factors.taxPressure > 40 && score >= 58)) {
        this.state.strikes.transit = true;
      } else if (score < 45) {
        this.state.strikes.transit = false;
      }
    } else {
      this.state.strikes.transit = false;
    }

    // 3. Emergency & Fire strike: response time delayed
    if (!isPactActive('emergency')) {
      if (score >= 76) {
        this.state.strikes.fire = true;
      } else if (score < 52) {
        this.state.strikes.fire = false;
      }

      if (score >= 82) {
        this.state.strikes.police = true;
      } else if (score < 56) {
        this.state.strikes.police = false;
      }
    } else {
      this.state.strikes.fire = false;
      this.state.strikes.police = false;
    }

    // 4. Health strike
    if (score >= 72 && factors.serviceDeficit > 45 && !isPactActive('civic')) {
      this.state.strikes.health = true;
    } else if (score < 48) {
      this.state.strikes.health = false;
    }
  }

  /**
   * Manages physical protest crowds marching along city roads.
   */
  manageProtests(score: number, buildings: Map<number, Building>): void {
    if (score < 48) {
      this.state.crowds = [];
      return;
    }

    const maxCrowds = Math.min(5, Math.floor((score - 40) / 10));

    // Find landmarks, plazas, or town hall to march towards
    const rallyPoints: number[] = [];
    buildings.forEach((b: Building) => {
      if (b.kind === 'svc' && b.road && World.road[b.road]) {
        if (b.svc === 'plaza' || b.svc === 'grandplaza' || b.svc === 'octocat' || b.svc === 'policehq') {
          rallyPoints.push(b.road);
        }
      }
    });

    if (rallyPoints.length === 0) {
      // Pick any connected road in the city center
      for (let i = 0; i < N; i += 17) {
        if (World.road[i] && World.conn[i]) {
          rallyPoints.push(i);
          if (rallyPoints.length >= 3) break;
        }
      }
    }

    const slogans = [
      '¡Bajada de impuestos ya!',
      '¡Queremos servicios dignos!',
      '¡Basta de contaminación!',
      '¡Huelga general cívica!',
      '¡Empleo y salarios justos!',
      '¡Agua limpia en los grifos!',
    ];

    while (this.state.crowds.length < maxCrowds && rallyPoints.length > 0) {
      const target = rallyPoints[Math.floor(Math.random() * rallyPoints.length)];
      // Spawn crowd near high-unrest road tiles
      const tx = U.tx(target) + (Math.random() > 0.5 ? 5 : -5);
      const ty = U.ty(target) + (Math.random() > 0.5 ? 5 : -5);
      const spawnTile = U.inWorld(tx, ty) ? U.idx(tx, ty) : target;
      const roadTile = World.road[spawnTile] ? spawnTile : target;

      this.state.crowds.push({
        id: this.nextCrowdId++,
        tile: roadTile,
        targetTile: target,
        banner: slogans[Math.floor(Math.random() * slogans.length)],
        size: 15 + Math.floor(Math.random() * 25),
        anger: score,
        dir: Math.floor(Math.random() * 4),
      });
    }

    // Move crowds slowly along road connections
    for (const crowd of this.state.crowds) {
      crowd.anger = score;
      if (Math.random() < 0.25 && World.road[crowd.tile]) {
        const m = World.roadMask(crowd.tile);
        const options: number[] = [];
        for (let d = 0; d < 4; d++) {
          if (m & (1 << d)) {
            const j = World.neighbor(crowd.tile, d);
            if (j >= 0 && World.road[j]) options.push(j);
          }
        }
        if (options.length > 0) {
          crowd.tile = options[Math.floor(Math.random() * options.length)];
        }
      }
    }
  }

  /**
   * Manages street barricades when city unrest turns into urban riots.
   */
  manageBarricades(score: number, buildings: Map<number, Building>): void {
    // Barricades only form during riots (score >= 75)
    if (score < 72) {
      this.state.barricades = [];
      this.state.riotHours = 0;
      return;
    }

    this.state.riotHours++;

    // Age existing barricades
    this.state.barricades = this.state.barricades.filter(bar => {
      bar.duration -= 1;
      return bar.duration > 0 && bar.health > 0;
    });

    const maxBarricades = Math.min(6, Math.floor((score - 70) / 5));

    if (this.state.barricades.length < maxBarricades && Math.random() < 0.35) {
      // Find a road tile with high unrest that doesn't already have a barricade
      const candidates: number[] = [];
      for (let i = 0; i < N; i += 13) {
        if (World.road[i] && this.unrestGrid[i] > 0.65) {
          if (!this.state.barricades.some(b => b.tile === i)) {
            candidates.push(i);
          }
        }
      }

      if (candidates.length > 0) {
        const chosenTile = candidates[Math.floor(Math.random() * candidates.length)];
        const x = (U.tx(chosenTile) + 0.5) * C.TILE;
        const z = (U.ty(chosenTile) + 0.5) * C.TILE;
        this.state.barricades.push({
          id: this.nextBarricadeId++,
          tile: chosenTile,
          x,
          z,
          health: 100,
          duration: 48 + Math.floor(Math.random() * 36), // 48 to 84 hours
        });
      }
    }
  }

  /**
   * Updates problem sprite indicators on buildings suffering from strikes or riots.
   */
  applyBuildingProblemFlags(buildings: Map<number, Building>): void {
    buildings.forEach((b: Building) => {
      if (b.kind === 'svc') {
        const isStrike =
          (b.svc === 'garbage' || b.svc === 'recycle') && this.state.strikes.garbage
            ? true
            : (b.svc === 'fire' || b.svc === 'firehq') && this.state.strikes.fire
            ? true
            : (b.svc === 'police' || b.svc === 'policehq') && this.state.strikes.police
            ? true
            : (b.svc === 'clinic' || b.svc === 'hospital') && this.state.strikes.health
            ? true
            : false;

        if (isStrike) {
          b.prob = 'strike';
        } else if (b.prob === 'strike') {
          b.prob = null;
        }
      } else if (b.kind === 'zone' && b.state === 'live') {
        const tile = U.idx(Math.floor(b.x), Math.floor(b.y));
        const nearBarricade = this.state.barricades.some(bar => {
          const dx = U.tx(bar.tile) - Math.floor(b.x);
          const dy = U.ty(bar.tile) - Math.floor(b.y);
          return dx * dx + dy * dy <= 9;
        });

        if (nearBarricade && this.state.level === 'riot') {
          if (!b.prob || b.prob === 'strike') b.prob = 'riot';
        } else if (b.prob === 'riot') {
          b.prob = null;
        }
      }
    });
  }

  /**
   * Advances monthly countdowns for signed union pacts and social peace treaties.
   */
  monthlyTick(): void {
    if (this.state.peaceTreatyMonths > 0) {
      this.state.peaceTreatyMonths--;
    }

    for (const pact of this.state.pacts) {
      if (pact.accepted && pact.monthsRemaining > 0) {
        pact.monthsRemaining--;
        if (pact.monthsRemaining <= 0) {
          pact.accepted = false;
        }
      }
    }
  }

  /**
   * Accepts and signs a collective bargaining agreement with a union.
   */
  acceptPact(pactId: string, currentMoney: number): { success: boolean; cost: number; message: string } {
    const pact = this.state.pacts.find(p => p.id === pactId);
    if (!pact) return { success: false, cost: 0, message: 'Pacto no encontrado' };

    if (currentMoney < pact.cost) {
      return { success: false, cost: 0, message: 'Fondos insuficientes para financiar el acuerdo sindical' };
    }

    pact.accepted = true;
    pact.monthsRemaining = pact.durationMonths;

    // Immediately call off the related strike
    if (pact.union === 'civic') {
      this.state.strikes.garbage = false;
      this.state.strikes.health = false;
    } else if (pact.union === 'transit') {
      this.state.strikes.transit = false;
    } else if (pact.union === 'emergency') {
      this.state.strikes.fire = false;
      this.state.strikes.police = false;
    } else if (pact.union === 'residents') {
      this.state.peaceTreatyMonths = 6;
    }

    // Substantial immediate reduction in social tension
    this.state.score = Math.max(0, this.state.score - 30);
    this.state.crowds = [];

    return {
      success: true,
      cost: pact.cost,
      message: `¡Acuerdo firmado con ${pact.unionName}! Se garantiza la paz laboral durante ${pact.durationMonths} meses.`,
    };
  }

  /**
   * Deploys riot police to disperse crowds and tear down barricades.
   */
  deployRiotPolice(currentMoney: number): { success: boolean; cost: number; message: string } {
    const cost = 2800;
    if (currentMoney < cost) {
      return { success: false, cost: 0, message: 'Fondos insuficientes para movilizar unidades antidisturbios' };
    }

    this.state.barricades = [];
    this.state.crowds = [];
    this.state.level = 'tense';
    this.state.score = Math.max(25, this.state.score - 20);

    return {
      success: true,
      cost,
      message: 'Unidades antidisturbios han disuelto las protestas y despejado las barricadas de la calzada.',
    };
  }

  /**
   * Declares an extraordinary municipal social relief fund.
   */
  declareSocialRelief(currentMoney: number): { success: boolean; cost: number; message: string } {
    const cost = 5000;
    if (currentMoney < cost) {
      return { success: false, cost: 0, message: 'Fondos insuficientes para el fondo de alivio social' };
    }

    this.state.peaceTreatyMonths = Math.max(this.state.peaceTreatyMonths, 5);
    this.state.score = Math.max(0, this.state.score - 35);
    this.state.barricades = [];
    this.state.crowds = [];

    return {
      success: true,
      cost,
      message: 'Fondo de Alivio Social aprobado: la satisfacción ciudadana aumenta y se suspenden las protestas.',
    };
  }

  /**
   * Resets all strikes.
   */
  resetStrikes(): void {
    this.state.strikes.garbage = false;
    this.state.strikes.fire = false;
    this.state.strikes.police = false;
    this.state.strikes.transit = false;
    this.state.strikes.health = false;
  }

  isRoadBlocked(tile: number): boolean {
    return this.state.barricades.some(b => b.tile === tile);
  }

  isProtestOnRoad(tile: number): boolean {
    return this.state.crowds.some(c => c.tile === tile);
  }

  isServiceStriking(svcKey: string): boolean {
    if (svcKey === 'garbage' || svcKey === 'recycle') return this.state.strikes.garbage;
    if (svcKey === 'fire' || svcKey === 'firehq') return this.state.strikes.fire;
    if (svcKey === 'police' || svcKey === 'policehq') return this.state.strikes.police;
    if (svcKey === 'clinic' || svcKey === 'hospital' || svcKey === 'field_hospital') return this.state.strikes.health;
    return false;
  }

  serialize(): any {
    return {
      score: this.state.score,
      level: this.state.level,
      factors: this.state.factors,
      strikes: this.state.strikes,
      pacts: this.state.pacts,
      barricades: this.state.barricades,
      crowds: this.state.crowds,
      riotHours: this.state.riotHours,
      peaceTreatyMonths: this.state.peaceTreatyMonths,
    };
  }

  deserialize(data: any): void {
    if (!data) return;
    this.state.score = data.score ?? 0;
    this.state.level = data.level ?? 'peaceful';
    if (data.factors) this.state.factors = data.factors;
    if (data.strikes) this.state.strikes = data.strikes;
    if (data.pacts && Array.isArray(data.pacts)) this.state.pacts = data.pacts;
    if (data.barricades && Array.isArray(data.barricades)) this.state.barricades = data.barricades;
    if (data.crowds && Array.isArray(data.crowds)) this.state.crowds = data.crowds;
    this.state.riotHours = data.riotHours ?? 0;
    this.state.peaceTreatyMonths = data.peaceTreatyMonths ?? 0;
  }
}

export const Unrest = new UnrestEngine();
