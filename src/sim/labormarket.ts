/**
 * LaborMarketSim — Labor Market & Education Skill Matching.
 *
 * Rules:
 * - [R-world-058] The labor market segments workforce capacity across educational tiers:
 *   elementary, secondary, and college degrees; advanced commercial and office towers
 *   mandate skilled labor, generating vacancies during education shortages while
 *   unskilled labor experiences structural unemployment.
 * - [R-world-007] No citizen agents; aggregate cohort distribution.
 * - [R-architecture-001] src/sim never imports src/render or src/ui.
 * - Deterministic: pure arithmetic; never Math.random or Date.now.
 */

export const COLLEGE_OFFICE_JOB_SHARE = 0.6;
export const UNSKILLED_MANUAL_SHARE = 0.7;
export const STRUCTURAL_UNEMPLOYMENT_CAP = 0.35;

export interface LaborTiers {
  uneducated: number;
  elementary: number;
  secondary: number;
  college: number;
}

export interface LaborMarketStats {
  laborSupply: LaborTiers;
  jobDemand: LaborTiers;
  skilledShortage: number; // vacant skilled jobs
  unskilledSurplus: number; // unemployed unskilled workers
  mismatchIndex: number; // 0..1
}

export class LaborMarketSim {
  computeLaborMarket(
    population: number,
    comJobs: number,
    indJobs: number,
    educationCoverage = 0.5,
  ): LaborMarketStats {
    const workforce = Math.round(population * 0.45);
    const totalJobs = comJobs + indJobs;

    if (workforce === 0 || totalJobs === 0) {
      return {
        laborSupply: { uneducated: 0, elementary: 0, secondary: 0, college: 0 },
        jobDemand: { uneducated: 0, elementary: 0, secondary: 0, college: 0 },
        skilledShortage: 0,
        unskilledSurplus: 0,
        mismatchIndex: 0,
      };
    }

    // Workforce educational breakdown derived from municipal schooling ladder access
    const collegeShare = Math.min(0.35, Math.max(0.02, educationCoverage * 0.35));
    const secondaryShare = Math.min(0.40, Math.max(0.10, educationCoverage * 0.40));
    const elementaryShare = Math.min(0.30, Math.max(0.15, 0.20 + educationCoverage * 0.10));

    const collegeWorkers = Math.round(workforce * collegeShare);
    const secondaryWorkers = Math.round(workforce * secondaryShare);
    const elementaryWorkers = Math.round(workforce * elementaryShare);
    const uneducatedWorkers = Math.max(
      0,
      workforce - (collegeWorkers + secondaryWorkers + elementaryWorkers),
    );

    // Job requirements: offices demand college grads; heavy industry employs manual laborers
    const collegeJobs = Math.round(comJobs * COLLEGE_OFFICE_JOB_SHARE);
    const secondaryJobs = Math.round(comJobs * (1 - COLLEGE_OFFICE_JOB_SHARE) * 0.7);
    const uneducatedJobs = Math.round(indJobs * UNSKILLED_MANUAL_SHARE);
    const elementaryJobs = Math.max(0, totalJobs - (collegeJobs + secondaryJobs + uneducatedJobs));

    const skilledShortage = Math.max(0, collegeJobs - collegeWorkers);
    const unskilledSurplus = Math.max(0, uneducatedWorkers - uneducatedJobs);

    const mismatchIndex = Math.min(
      1.0,
      Math.round(((skilledShortage + unskilledSurplus) / workforce) * 100) / 100,
    );

    return {
      laborSupply: {
        uneducated: uneducatedWorkers,
        elementary: elementaryWorkers,
        secondary: secondaryWorkers,
        college: collegeWorkers,
      },
      jobDemand: {
        uneducated: uneducatedJobs,
        elementary: elementaryJobs,
        secondary: secondaryJobs,
        college: collegeJobs,
      },
      skilledShortage,
      unskilledSurplus,
      mismatchIndex,
    };
  }
}
