/**
 * UnrestSim — simulates civic discontent, citizen protests, demonstrations,
 * and economic/traffic disruption.
 *
 * Rules:
 * - [R-world-052] Protests emerge dynamically from civic discontent (happiness < 40
 *   or acute tax/service stressors), forming instanced crowds along street frontages
 *   that restrict road flow and issue ultimatums through the Advisor.
 * - [R-architecture-001] src/sim never imports src/render or src/ui.
 * - Deterministic: uses seeded integer hashing; never Math.random or Date.now.
 */
import {
  PROTEST_HAPPINESS_THRESHOLD,
  PROTEST_MIN_DURATION_TICKS,
  PROTEST_TAX_THRESHOLD,
  tileIndex,
} from '../shared/constants';
import type {
  ActiveProtest,
  BuildingCatalogEntry,
  BuildingInstance,
  CityStats,
  GridState,
} from '../shared/types';
import { BuildingState, isFrontageTier } from '../shared/types';

export interface UnrestContext {
  grid: GridState;
  stats: CityStats;
  buildings: readonly BuildingInstance[];
  catalog: readonly BuildingCatalogEntry[];
  tickNo: number;
}

export class UnrestSim {
  private activeProtests: ActiveProtest[] = [];
  private nextProtestId = 1;

  getActiveProtests(): readonly ActiveProtest[] {
    return this.activeProtests;
  }

  /**
   * Advances the unrest simulation by one tick.
   * Evaluates citizen grievances, spawns or updates active protests,
   * and removes remediated protests.
   */
  tick(ctx: UnrestContext): readonly ActiveProtest[] {
    const { stats, tickNo } = ctx;

    // 1. Update existing protests: check remediation and decrement duration
    const remaining: ActiveProtest[] = [];
    for (const protest of this.activeProtests) {
      let resolved = false;

      switch (protest.kind) {
        case 'tax':
          // Tax protest resolves if residential taxes are lowered below 12%
          if (stats.taxRates.res <= 0.12) resolved = true;
          break;
        case 'general':
          // General unhappiness protest resolves if happiness recovers to >= 48
          if (stats.happiness >= 48) resolved = true;
          break;
        case 'unemployment': {
          const workforce = Math.floor(stats.population * 0.45);
          const unemployed = Math.max(0, workforce - stats.employed);
          if (workforce > 0 && unemployed / workforce < 0.25) resolved = true;
          break;
        }
        case 'services': {
          let unservedCount = 0;
          for (const b of ctx.buildings) {
            if (b.state === BuildingState.Active) {
              const idx = tileIndex(b.x, b.z);
              if (ctx.grid.power[idx] === 0 || ctx.grid.watered[idx] === 0) {
                unservedCount++;
              }
            }
          }
          if (unservedCount === 0) resolved = true;
          break;
        }
      }

      if (!resolved) {
        const nextDuration = protest.durationTicks - 1;
        if (nextDuration > 0) {
          remaining.push({ ...protest, durationTicks: nextDuration });
        }
      }
    }

    this.activeProtests = remaining;

    // 2. Periodically scan for new protests (every 8 ticks, staggered)
    if (tickNo % 8 === 3 && stats.population >= 80) {
      this.evaluatePotentialProtests(ctx);
    }

    return this.activeProtests;
  }

  private evaluatePotentialProtests(ctx: UnrestContext): void {
    const { stats, grid, buildings } = ctx;

    // A. Check for Tax Revolt
    const hasTaxProtest = this.activeProtests.some((p) => p.kind === 'tax');
    if (!hasTaxProtest && stats.taxRates.res >= PROTEST_TAX_THRESHOLD) {
      const location = this.findProtestFocalPoint(grid, buildings, 'civic_or_residential');
      const ratePercent = Math.round(stats.taxRates.res * 100);
      const severity = Math.min(1.0, Math.max(0.3, (stats.taxRates.res - 0.12) * 5));

      this.activeProtests.push({
        id: this.nextProtestId++,
        kind: 'tax',
        x: location.x,
        z: location.z,
        severity,
        grievance: `Punitive residential tax (${ratePercent}%) — citizens demand rates below 12% to restore peace.`,
        durationTicks: PROTEST_MIN_DURATION_TICKS * 2,
        targetBuildingId: location.buildingId,
      });
      return;
    }

    // B. Check for General Unrest (Misery / Low Happiness)
    const hasGeneralProtest = this.activeProtests.some((p) => p.kind === 'general');
    if (!hasGeneralProtest && stats.happiness < PROTEST_HAPPINESS_THRESHOLD && stats.population >= 150) {
      const location = this.findProtestFocalPoint(grid, buildings, 'residential');
      const severity = Math.min(1.0, Math.max(0.3, (PROTEST_HAPPINESS_THRESHOLD - stats.happiness) / 30));

      this.activeProtests.push({
        id: this.nextProtestId++,
        kind: 'general',
        x: location.x,
        z: location.z,
        severity,
        grievance: `Severe civic discontent (${stats.happiness}% happiness) — improve parks, clinics, and living conditions.`,
        durationTicks: PROTEST_MIN_DURATION_TICKS * 2,
        targetBuildingId: location.buildingId,
      });
      return;
    }

    // C. Check for Unemployment Demonstration
    const hasUnemploymentProtest = this.activeProtests.some((p) => p.kind === 'unemployment');
    if (!hasUnemploymentProtest && stats.population >= 200) {
      const workforce = Math.floor(stats.population * 0.45);
      const unemployed = Math.max(0, workforce - stats.employed);
      const unemploymentRate = workforce > 0 ? unemployed / workforce : 0;

      if (workforce >= 50 && unemploymentRate >= 0.35) {
        const location = this.findProtestFocalPoint(grid, buildings, 'commercial_or_industrial');
        const ratePercent = Math.round(unemploymentRate * 100);
        const severity = Math.min(1.0, Math.max(0.3, (unemploymentRate - 0.30) * 4));

        this.activeProtests.push({
          id: this.nextProtestId++,
          kind: 'unemployment',
          x: location.x,
          z: location.z,
          severity,
          grievance: `Mass unemployment (${ratePercent}% without work) — zone commercial or industrial lots to create jobs.`,
          durationTicks: PROTEST_MIN_DURATION_TICKS * 2,
          targetBuildingId: location.buildingId,
        });
        return;
      }
    }

    // D. Check for Utility Outage Outcry
    const hasServicesProtest = this.activeProtests.some((p) => p.kind === 'services');
    if (!hasServicesProtest && stats.population >= 120) {
      let unpoweredOrUnwatered = 0;
      let worstBuilding: BuildingInstance | null = null;
      for (const b of buildings) {
        if (b.state === BuildingState.Active) {
          const idx = tileIndex(b.x, b.z);
          if (grid.power[idx] === 0 || grid.watered[idx] === 0) {
            unpoweredOrUnwatered++;
            if (!worstBuilding) worstBuilding = b;
          }
        }
      }

      if (unpoweredOrUnwatered >= 6 && worstBuilding) {
        this.activeProtests.push({
          id: this.nextProtestId++,
          kind: 'services',
          x: worstBuilding.x,
          z: worstBuilding.z,
          severity: 0.6,
          grievance: 'Prolonged utility outage — restore electricity and municipal water to homes.',
          durationTicks: PROTEST_MIN_DURATION_TICKS * 2,
          targetBuildingId: worstBuilding.id,
        });
      }
    }
  }

  /**
   * Identifies an appropriate urban street location for a crowd demonstration.
   */
  private findProtestFocalPoint(
    grid: GridState,
    buildings: readonly BuildingInstance[],
    _preference: 'civic_or_residential' | 'residential' | 'commercial_or_industrial',
  ): { x: number; z: number; buildingId?: number } {
    const active = buildings.filter((b) => b.state === BuildingState.Active);
    if (active.length === 0) {
      return { x: Math.floor(grid.size / 2), z: Math.floor(grid.size / 2) };
    }

    // Find candidate by preference
    for (const b of active) {
      // Find adjacent road tile for street demonstration frontage
      const roadCoord = this.findAdjacentRoadTile(grid, b.x, b.z);
      if (roadCoord) {
        return { x: roadCoord.x, z: roadCoord.z, buildingId: b.id };
      }
    }

    const fallback = active[0]!;
    return { x: fallback.x, z: fallback.z, buildingId: fallback.id };
  }

  private findAdjacentRoadTile(
    grid: GridState,
    x: number,
    z: number,
  ): { x: number; z: number } | null {
    const offsets = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ] as const;

    for (const [dx, dz] of offsets) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx >= 0 && nx < grid.size && nz >= 0 && nz < grid.size) {
        const idx = tileIndex(nx, nz);
        if (isFrontageTier(grid.roadTier[idx]!)) {
          return { x: nx, z: nz };
        }
      }
    }

    return null;
  }
}
