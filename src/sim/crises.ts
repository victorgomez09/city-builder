/**
 * SystemicCrisesSim — Municipal debt default, credit rating downgrades,
 * public sector strikes, and contagious health epidemics.
 *
 * Rules:
 * - [R-world-055] Systemic municipal crises emerge from structural neglect: debt near the cap
 *   under negative cash flow downgrades municipal bond ratings to penalty interest;
 *   service underfunding (<70%) provokes public worker strikes; and severe
 *   garbage backlogs ignite hospital-overloading health epidemics.
 * - [R-world-007] No citizen agents; aggregate statistics and indicators.
 * - [R-architecture-001] src/sim never imports src/render or src/ui.
 * - Deterministic: pure arithmetic; never Math.random or Date.now.
 */
import type { FundingKey } from '../shared/types';

export const BOND_INTEREST_AAA = 0.01;
export const BOND_INTEREST_A = 0.02;
export const BOND_INTEREST_BBB = 0.035;
export const BOND_INTEREST_DEFAULT = 0.05;

export const SERVICE_STRIKE_THRESHOLD = 0.70;
export const GARBAGE_EPIDEMIC_THRESHOLD = 500;
export const POLLUTION_EPIDEMIC_THRESHOLD = 140;

export type CreditRating = 'AAA' | 'A' | 'BBB' | 'Default';

export interface SystemicCrisesStats {
  creditRating: CreditRating;
  bondInterestRate: number;
  activeStrikes: FundingKey[];
  epidemicActive: boolean;
  epidemicSeverity: number; // 0..1
}

export class SystemicCrisesSim {
  computeCrises(
    loanBalance: number,
    monthlyIncome: number,
    monthlyExpenses: number,
    serviceFunding: Record<FundingKey, number>,
    garbageBacklog = 0,
    averagePollution = 0,
  ): SystemicCrisesStats {
    // 1. Municipal bond credit rating
    let creditRating: CreditRating = 'AAA';
    let bondInterestRate = BOND_INTEREST_AAA;

    const netCashFlow = monthlyIncome - monthlyExpenses;

    if (loanBalance >= 95000 && netCashFlow < 0) {
      creditRating = 'Default';
      bondInterestRate = BOND_INTEREST_DEFAULT;
    } else if (loanBalance >= 85000 && netCashFlow < 0) {
      creditRating = 'BBB';
      bondInterestRate = BOND_INTEREST_BBB;
    } else if (loanBalance >= 75000) {
      creditRating = 'A';
      bondInterestRate = BOND_INTEREST_A;
    }

    // 2. Public sector worker strikes
    const activeStrikes: FundingKey[] = [];
    const keys: FundingKey[] = ['police', 'fire', 'health', 'education', 'park'];
    for (const key of keys) {
      const funding = serviceFunding[key] ?? 1.0;
      if (funding < SERVICE_STRIKE_THRESHOLD) {
        activeStrikes.push(key);
      }
    }

    // 3. Contagious health epidemics
    let epidemicActive = false;
    let epidemicSeverity = 0;

    if (garbageBacklog > GARBAGE_EPIDEMIC_THRESHOLD || averagePollution > POLLUTION_EPIDEMIC_THRESHOLD) {
      epidemicActive = true;
      const garbageContrib =
        garbageBacklog > GARBAGE_EPIDEMIC_THRESHOLD
          ? Math.min(0.5, (garbageBacklog - GARBAGE_EPIDEMIC_THRESHOLD) / 500)
          : 0;
      const pollContrib =
        averagePollution > POLLUTION_EPIDEMIC_THRESHOLD
          ? Math.min(0.5, (averagePollution - POLLUTION_EPIDEMIC_THRESHOLD) / 100)
          : 0;
      epidemicSeverity = Math.min(1.0, Math.max(0.2, garbageContrib + pollContrib));
    }

    return {
      creditRating,
      bondInterestRate,
      activeStrikes,
      epidemicActive,
      epidemicSeverity,
    };
  }
}
