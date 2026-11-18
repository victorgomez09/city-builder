/**
 * AquiferSim — Aquifer Depletion & Environmental Soil Bioremediation.
 *
 * Rules:
 * - [R-services-042] Groundwater aquifers deplete under excessive municipal well extraction,
 *   risking coastal saltwater intrusion; decommissioned heavy industrial brownfields
 *   retain persistent soil toxicity requiring active bioremediation before residential redevelopment.
 * - [R-world-007] Pure aggregate cohort and layer metrics; no citizen agents.
 * - [R-architecture-001] src/sim never imports src/render or src/ui.
 * - Deterministic: pure arithmetic; never Math.random or Date.now.
 */
import { tileIndex } from '../shared/constants';
import type { BuildingInstance } from '../shared/types';
import { BuildingState } from '../shared/types';

export const AQUIFER_RECHARGE_RATE_KL = 1500;
export const SALTWATER_INTRUSION_THRESHOLD = 0.2;
export const BIOREMEDIATION_COST_PER_TILE = 250;
export const MAX_AQUIFER_CAPACITY_KL = 50000;

export interface AquiferStats {
  aquiferLevelRatio: number; // 0..1
  waterExtractedKL: number;
  rechargeRateKL: number;
  saltwaterIntrusion: boolean;
  toxicBrownfieldTilesCount: number;
}

export class AquiferSim {
  private currentAquiferReserveKL = 42000;
  private toxicBrownfieldTiles = new Set<number>();

  tick(
    waterDemandKL: number,
    buildings: readonly BuildingInstance[],
    isCoastal = false,
  ): AquiferStats {
    // 1. Aquifer water table balance
    const monthlyExtraction = Math.round(waterDemandKL * 0.12);
    this.currentAquiferReserveKL = Math.max(
      0,
      Math.min(
        MAX_AQUIFER_CAPACITY_KL,
        this.currentAquiferReserveKL - monthlyExtraction + AQUIFER_RECHARGE_RATE_KL,
      ),
    );

    const levelRatio =
      Math.round((this.currentAquiferReserveKL / MAX_AQUIFER_CAPACITY_KL) * 100) / 100;
    const saltwaterIntrusion = isCoastal && levelRatio < SALTWATER_INTRUSION_THRESHOLD;

    // 2. Track heavy industrial soil contamination
    for (const b of buildings) {
      if (b.state === BuildingState.Active && b.catalogId.startsWith('ind-heavy')) {
        this.toxicBrownfieldTiles.add(tileIndex(b.x, b.z));
      }
    }

    return {
      aquiferLevelRatio: levelRatio,
      waterExtractedKL: monthlyExtraction,
      rechargeRateKL: AQUIFER_RECHARGE_RATE_KL,
      saltwaterIntrusion,
      toxicBrownfieldTilesCount: this.toxicBrownfieldTiles.size,
    };
  }

  bioremediateTile(x: number, z: number): boolean {
    const idx = tileIndex(x, z);
    if (this.toxicBrownfieldTiles.has(idx)) {
      this.toxicBrownfieldTiles.delete(idx);
      return true;
    }
    return false;
  }

  isSoilToxic(x: number, z: number): boolean {
    return this.toxicBrownfieldTiles.has(tileIndex(x, z));
  }
}
