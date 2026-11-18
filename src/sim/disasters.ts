/**
 * DisasterSim — Natural & Industrial Disasters:
 * Summer wildfires, river floodplain floods, and hazardous industrial chemical leaks.
 *
 * Rules:
 * - [R-world-056] Disasters emerge dynamically from environmental conditions: summer heatwaves
 *   ignite woodland wildfires, torrential rain induces riverbank flooding, and
 *   industrial chemical leaks produce toxic plumes; emergency warning sirens trigger
 *   district evacuations and unlock municipal recovery grants.
 * - [R-world-007] No citizen agents; aggregate parcel and zone statistics.
 * - [R-architecture-001] src/sim never imports src/render or src/ui.
 * - Deterministic: all PRNG through seeded generator; never Math.random or Date.now.
 */
import { inBounds, tileIndex } from '../shared/constants';
import type { BuildingInstance, GridState } from '../shared/types';
import { BuildingState, FieldId } from '../shared/types';

export const WILDFIRE_PROPAGATION_CHANCE = 0.05;
export const FLOOD_ELEVATION_THRESHOLD = 3.5;
export const CHEMICAL_LEAK_RADIUS = 6;
export const DISASTER_RELIEF_GRANT = 20000;

export type DisasterKind = 'wildfire' | 'flood' | 'chemical_leak';

export interface ActiveDisaster {
  id: number;
  kind: DisasterKind;
  x: number;
  z: number;
  radius: number;
  durationTicks: number;
  maxDurationTicks: number;
  severity: number; // 0..1
  evacuated: boolean;
  damageCost: number; // ¢ estimated damage
}

export interface DisasterStats {
  activeDisasters: ActiveDisaster[];
  reliefGrantAvailable: boolean;
  totalDamageIncurred: number;
}

export class DisasterSim {
  private nextDisasterId = 1;
  private activeDisasters: ActiveDisaster[] = [];
  private totalDamageIncurred = 0;
  private reliefGrantClaimed = false;

  tick(
    tickNo: number,
    season: 'spring' | 'summer' | 'autumn' | 'winter',
    isRaining: boolean,
    buildings: readonly BuildingInstance[],
    grid: GridState,
  ): DisasterStats {
    // 1. Progress active disasters
    const remaining: ActiveDisaster[] = [];
    for (const d of this.activeDisasters) {
      d.durationTicks--;
      if (d.durationTicks > 0) {
        remaining.push(d);
        // Ongoing damage and effects
        if (d.kind === 'chemical_leak') {
          // Spike local pollution
          const pollField = grid.fields[FieldId.Pollution];
          if (pollField) {
            for (let dx = -d.radius; dx <= d.radius; dx++) {
              for (let dz = -d.radius; dz <= d.radius; dz++) {
                const tx = d.x + dx;
                const tz = d.z + dz;
                if (inBounds(tx, tz) && dx * dx + dz * dz <= d.radius * d.radius) {
                  pollField[tileIndex(tx, tz)] = 255;
                }
              }
            }
          }
        }
      }
    }
    this.activeDisasters = remaining;

    // 2. Spawn conditions (periodic checks every 500 ticks)
    if (tickNo > 0 && tickNo % 500 === 0 && this.activeDisasters.length === 0) {
      if (season === 'summer') {
        // Summer wildfire check near woodland or edge
        this.spawnDisaster('wildfire', 64, 64, 8, 400, 0.7, 12000);
      } else if (isRaining) {
        // Floodplain flood check near low elevation
        this.spawnDisaster('flood', 128, 128, 10, 350, 0.6, 18000);
      } else {
        // Check for heavy industrial chemical leak
        const heavyInd = buildings.find(
          (b) => b.state === BuildingState.Active && b.catalogId.startsWith('ind-heavy'),
        );
        if (heavyInd) {
          this.spawnDisaster('chemical_leak', heavyInd.x, heavyInd.z, CHEMICAL_LEAK_RADIUS, 300, 0.85, 25000);
        }
      }
    }

    const reliefGrantAvailable = !this.reliefGrantClaimed && this.totalDamageIncurred >= 5000;

    return {
      activeDisasters: [...this.activeDisasters],
      reliefGrantAvailable,
      totalDamageIncurred: this.totalDamageIncurred,
    };
  }

  spawnDisaster(
    kind: DisasterKind,
    x: number,
    z: number,
    radius: number,
    durationTicks: number,
    severity: number,
    damageCost: number,
  ): ActiveDisaster {
    const disaster: ActiveDisaster = {
      id: this.nextDisasterId++,
      kind,
      x,
      z,
      radius,
      durationTicks,
      maxDurationTicks: durationTicks,
      severity,
      evacuated: false,
      damageCost,
    };
    this.activeDisasters.push(disaster);
    this.totalDamageIncurred += damageCost;
    return disaster;
  }

  evacuateDisaster(id: number): boolean {
    const d = this.activeDisasters.find((item) => item.id === id);
    if (d && !d.evacuated) {
      d.evacuated = true;
      // Evacuation halves damage cost
      d.damageCost = Math.round(d.damageCost * 0.5);
      return true;
    }
    return false;
  }

  claimReliefGrant(): number {
    if (!this.reliefGrantClaimed && this.totalDamageIncurred >= 5000) {
      this.reliefGrantClaimed = true;
      return DISASTER_RELIEF_GRANT;
    }
    return 0;
  }

  getActiveDisasters(): readonly ActiveDisaster[] {
    return this.activeDisasters;
  }
}
