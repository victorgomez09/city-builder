/**
 * DemographicsSim — statistical household income tiers, living costs,
 * balance sheets, and poverty metrics.
 *
 * Rules:
 * - [R-world-053] Demographics simulate three socio-economic income tiers (low,
 *   medium, high) statistically per residential building; household disposable
 *   income balances wages against living costs and taxes, driving tier-specific
 *   satisfaction and migration.
 * - [R-world-007] Population calculations remain aggregate statistical sums
 *   without per-citizen physical agents.
 * - [R-architecture-001] src/sim never imports src/render or src/ui.
 * - Deterministic: pure arithmetic and typed array reads; never Math.random or Date.now.
 */
import { tileIndex } from '../shared/constants';
import type { BuildingInstance, GridState } from '../shared/types';
import { BuildingState, FieldId } from '../shared/types';

export const WAGE_LOW_INCOME = 1200;
export const WAGE_MEDIUM_INCOME = 2800;
export const WAGE_HIGH_INCOME = 6500;

export const BASE_LIVING_COST_LOW = 900;
export const BASE_LIVING_COST_MEDIUM = 1800;
export const BASE_LIVING_COST_HIGH = 3800;

export type IncomeTier = 'low' | 'medium' | 'high';

export interface DemographicsStats {
  lowIncome: number;
  mediumIncome: number;
  highIncome: number;
  povertyRate: number; // 0..1 fraction of households in deficit
  avgDisposableIncome: number; // ¢/month
}

export interface HouseholdFinances {
  incomeTier: IncomeTier;
  monthlyWage: number;
  livingCosts: number;
  disposableIncome: number;
  inDeficit: boolean;
}

export class DemographicsSim {
  /**
   * Computes city-wide demographic distribution and household financial health.
   */
  computeDemographics(
    buildings: readonly BuildingInstance[],
    grid: GridState,
    taxRateRes: number,
  ): DemographicsStats {
    let lowCount = 0;
    let medCount = 0;
    let highCount = 0;

    let totalHouseholds = 0;
    let householdsInDeficit = 0;
    let totalDisposable = 0;

    const landValueField = grid.fields[FieldId.LandValue];

    for (const b of buildings) {
      if (b.state !== BuildingState.Active) continue;
      // Only residential buildings have household demographics
      if (!b.catalogId.startsWith('res-')) continue;

      const idx = tileIndex(b.x, b.z);
      const lv = landValueField ? (landValueField[idx] ?? 100) : 100;

      // Estimated households per building
      const households = b.level === 3 ? 12 : b.level === 2 ? 6 : 4;
      totalHouseholds += households;

      // Distribution weights by building level and land value
      let lowShare = 0.60;
      let medShare = 0.35;
      let highShare = 0.05;

      if (b.level === 3 || lv >= 180) {
        lowShare = 0.10;
        medShare = 0.40;
        highShare = 0.50;
      } else if (b.level === 2 || lv >= 130) {
        lowShare = 0.25;
        medShare = 0.55;
        highShare = 0.20;
      }

      const lowH = households * lowShare;
      const medH = households * medShare;
      const highH = households * highShare;

      lowCount += lowH;
      medCount += medH;
      highCount += highH;

      // Calculate disposable income for each tier in this building
      const lowLiving = BASE_LIVING_COST_LOW + (lv / 255) * 150;
      const lowTax = WAGE_LOW_INCOME * taxRateRes;
      const lowDisp = WAGE_LOW_INCOME - (lowLiving + lowTax);
      if (lowDisp < 0) householdsInDeficit += lowH;
      totalDisposable += lowDisp * lowH;

      const medLiving = BASE_LIVING_COST_MEDIUM + (lv / 255) * 350;
      const medTax = WAGE_MEDIUM_INCOME * taxRateRes;
      const medDisp = WAGE_MEDIUM_INCOME - (medLiving + medTax);
      if (medDisp < 0) householdsInDeficit += medH;
      totalDisposable += medDisp * medH;

      const highLiving = BASE_LIVING_COST_HIGH + (lv / 255) * 800;
      const highTax = WAGE_HIGH_INCOME * taxRateRes;
      const highDisp = WAGE_HIGH_INCOME - (highLiving + highTax);
      if (highDisp < 0) householdsInDeficit += highH;
      totalDisposable += highDisp * highH;
    }

    if (totalHouseholds === 0) {
      return {
        lowIncome: 0,
        mediumIncome: 0,
        highIncome: 0,
        povertyRate: 0,
        avgDisposableIncome: 0,
      };
    }

    return {
      lowIncome: Math.round(lowCount),
      mediumIncome: Math.round(medCount),
      highIncome: Math.round(highCount),
      povertyRate: Math.max(0, Math.min(1.0, householdsInDeficit / totalHouseholds)),
      avgDisposableIncome: Math.round(totalDisposable / totalHouseholds),
    };
  }

  /**
   * Computes the dominant household finances for an individual residential building.
   */
  computeBuildingFinances(
    b: BuildingInstance,
    grid: GridState,
    taxRateRes: number,
  ): HouseholdFinances | null {
    if (b.state !== BuildingState.Active || !b.catalogId.startsWith('res-')) {
      return null;
    }

    const idx = tileIndex(b.x, b.z);
    const landValueField = grid.fields[FieldId.LandValue];
    const lv = landValueField ? (landValueField[idx] ?? 100) : 100;

    let tier: IncomeTier = 'low';
    let wage = WAGE_LOW_INCOME;
    let baseLiving = BASE_LIVING_COST_LOW;

    if (b.level === 3 || lv >= 180) {
      tier = 'high';
      wage = WAGE_HIGH_INCOME;
      baseLiving = BASE_LIVING_COST_HIGH;
    } else if (b.level === 2 || lv >= 130) {
      tier = 'medium';
      wage = WAGE_MEDIUM_INCOME;
      baseLiving = BASE_LIVING_COST_MEDIUM;
    }

    const livingCosts = Math.round(baseLiving + (lv / 255) * (tier === 'high' ? 800 : tier === 'medium' ? 350 : 150));
    const tax = Math.round(wage * taxRateRes);
    const disposableIncome = wage - (livingCosts + tax);

    return {
      incomeTier: tier,
      monthlyWage: wage,
      livingCosts,
      disposableIncome,
      inDeficit: disposableIncome < 0,
    };
  }
}
