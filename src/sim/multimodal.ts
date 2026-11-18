/**
 * MultimodalSim — Multimodal Commute Choice & Congestion Pricing.
 *
 * Rules:
 * - [R-roads-083] Multimodal commute modal splits allocate commuter trips across
 *   walking, cycling, private vehicles, and transit based on trip distance,
 *   road congestion, and transit fares; downtown cordon congestion pricing and
 *   low-emission zones charge commuter tolls to reduce personal vehicle volume
 *   and suppress traffic emissions.
 * - [R-world-007] No individual citizen agents; purely aggregate statistical modal assignment.
 * - [R-architecture-001] src/sim never imports src/render or src/ui.
 * - Deterministic: pure arithmetic; never Math.random or Date.now.
 */

export const MAX_WALK_COMMUTE_DISTANCE = 400;
export const MAX_CYCLE_COMMUTE_DISTANCE = 1500;
export const CONGESTION_CORDON_TOLL = 5;
export const LEZ_EMISSION_PENALTY = 0.4;

export interface ModalSplit {
  walking: number; // 0..1
  cycling: number; // 0..1
  transit: number; // 0..1
  vehicle: number; // 0..1
}

export interface MultimodalStats {
  modalSplit: ModalSplit;
  congestionTollRevenue: number; // ¢/month
  lezActive: boolean;
  averageCommuteDistance: number; // metres
}

export class MultimodalSim {
  computeModalSplit(
    population: number,
    jobs: number,
    transitRidership = 0,
    congestionRatio = 0.3,
    cordonActive = false,
    lezActive = false,
  ): MultimodalStats {
    if (population === 0 || jobs === 0) {
      return {
        modalSplit: { walking: 0.5, cycling: 0.3, transit: 0.0, vehicle: 0.2 },
        congestionTollRevenue: 0,
        lezActive: false,
        averageCommuteDistance: 300,
      };
    }

    // Average commute distance estimated from city scale
    const averageCommuteDistance = Math.min(
      4500,
      Math.max(400, Math.round(500 + Math.sqrt(population) * 20)),
    );

    // Baseline shares
    let walking = 0.15;
    let cycling = 0.12;
    let transit = 0.10;
    let vehicle = 0.63;

    if (averageCommuteDistance < 800) {
      walking = 0.35;
      cycling = 0.25;
      transit = 0.05;
      vehicle = 0.35;
    } else if (averageCommuteDistance < 1800) {
      walking = 0.20;
      cycling = 0.20;
      transit = 0.15;
      vehicle = 0.45;
    }

    // Active transit ridership pulls commuters out of personal vehicles
    if (transitRidership > 0) {
      const transitBoost = Math.min(0.25, (transitRidership / population) * 0.4);
      transit += transitBoost;
      vehicle -= transitBoost;
    }

    // Heavy road congestion pushes commuters towards cycling and transit
    if (congestionRatio > 0.6) {
      const congestionShift = (congestionRatio - 0.6) * 0.2;
      vehicle -= congestionShift;
      transit += congestionShift * 0.6;
      cycling += congestionShift * 0.4;
    }

    // Cordon congestion pricing: tolls charged to vehicles entering downtown
    let congestionTollRevenue = 0;
    if (cordonActive) {
      const tollShift = 0.12;
      vehicle = Math.max(0.15, vehicle - tollShift);
      transit += tollShift * 0.7;
      cycling += tollShift * 0.3;

      const dailyCommuters = Math.min(population * 0.45, jobs);
      congestionTollRevenue = Math.round(dailyCommuters * vehicle * CONGESTION_CORDON_TOLL * 30);
    }

    // Normalize to 1.0
    const total = walking + cycling + transit + vehicle;
    walking = Math.round((walking / total) * 100) / 100;
    cycling = Math.round((cycling / total) * 100) / 100;
    transit = Math.round((transit / total) * 100) / 100;
    vehicle = Math.max(0, 1.0 - (walking + cycling + transit));

    return {
      modalSplit: { walking, cycling, transit, vehicle },
      congestionTollRevenue,
      lezActive,
      averageCommuteDistance,
    };
  }
}
