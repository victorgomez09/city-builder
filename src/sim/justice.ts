/**
 * JusticeSim — Dynamic Crime, Police Patrol Beats & Justice System.
 *
 * Rules:
 * - [R-services-041] Crime hot-spots concentrate dynamically around unlit streets, high
 *   unemployment, and abandoned lots; police precinct patrol beats, municipal
 *   court caseflow, and detention capacity directly suppress local criminal escalation.
 * - [R-world-007] No citizen agents; aggregate statistics and grid field metrics.
 * - [R-architecture-001] src/sim never imports src/render or src/ui.
 * - Deterministic: pure arithmetic and typed array reads; never Math.random or Date.now.
 */
import { tileIndex } from '../shared/constants';
import type { BuildingInstance, GridState } from '../shared/types';
import { BuildingState, FieldId } from '../shared/types';

export const CRIME_UNLIT_FACTOR = 1.4;
export const CRIME_BLIGHT_FACTOR = 1.6;
export const JAIL_CAPACITY_PER_PRECINCT = 50;
export const COURT_CASES_PER_DAY = 20;

export interface JusticeStats {
  crimeHotspotsCount: number;
  jailOccupancy: number; // 0..1 (occupied / total capacity)
  inmatesCount: number;
  jailCapacity: number;
  courtBacklog: number;
  recidivismRate: number; // 0..1
}

export class JusticeSim {
  private currentInmates = 0;
  private currentCourtBacklog = 0;

  computeJustice(
    buildings: readonly BuildingInstance[],
    grid: GridState,
    unemployedFraction = 0.05,
    policeFunding = 1.0,
  ): JusticeStats {
    let precincts = 0;
    let crimeHotspotsCount = 0;

    const crimeField = grid.fields[FieldId.Crime];

    for (const b of buildings) {
      if (b.catalogId.startsWith('police-')) {
        precincts++;
      }

      const idx = tileIndex(b.x, b.z);
      const crimeVal = crimeField ? (crimeField[idx] ?? 0) : 0;

      // Elevated crime hotspot criteria: high crime field or abandoned in high unemployment
      let crimeRisk = crimeVal;
      if (b.state === BuildingState.Abandoned) crimeRisk *= CRIME_BLIGHT_FACTOR;
      if (unemployedFraction > 0.2) crimeRisk *= CRIME_UNLIT_FACTOR;

      if (crimeRisk >= 150) {
        crimeHotspotsCount++;
      }
    }

    const jailCapacity = Math.max(25, precincts * JAIL_CAPACITY_PER_PRECINCT);

    // Daily arrest inflow based on active crime hotspots suppressed by police funding
    const newArrests = Math.round(
      crimeHotspotsCount * 1.5 * Math.min(1.5, Math.max(0.2, policeFunding)),
    );

    // Court adjudication pipeline
    const dailyCourtCapacity = Math.max(10, precincts * COURT_CASES_PER_DAY);
    const casesHandled = Math.min(newArrests + this.currentCourtBacklog, dailyCourtCapacity);
    this.currentCourtBacklog = Math.max(0, this.currentCourtBacklog + newArrests - casesHandled);

    // Detention inflow and release
    const convicted = Math.round(casesHandled * 0.75);
    const released = Math.round(this.currentInmates * 0.1);
    this.currentInmates = Math.min(jailCapacity, Math.max(0, this.currentInmates + convicted - released));

    const jailOccupancy = Math.min(1.0, this.currentInmates / jailCapacity);

    // When detention is over capacity (>85%) or courts backed up, recidivism escalates
    let recidivismRate = 0.12;
    if (jailOccupancy >= 0.85 || this.currentCourtBacklog > 40) {
      recidivismRate = 0.48;
    } else if (jailOccupancy >= 0.6) {
      recidivismRate = 0.25;
    }

    return {
      crimeHotspotsCount,
      jailOccupancy,
      inmatesCount: this.currentInmates,
      jailCapacity,
      courtBacklog: this.currentCourtBacklog,
      recidivismRate,
    };
  }
}
