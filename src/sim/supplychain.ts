/**
 * SupplyChainSim — Commercial freight deliveries, inventory stockouts,
 * business profit margins, and insolvency.
 *
 * Rules:
 * - [R-world-054] Commercial supply chains require physical road connectivity to
 *   industrial zones or highway edge connections; unsupplied shops suffer goods
 *   stockouts, compressing profit margins and triggering commercial insolvency and blight.
 * - [R-world-007] No individual citizen agents; purely aggregate and parcel metrics.
 * - [R-architecture-001] src/sim never imports src/render or src/ui.
 * - Deterministic: pure arithmetic and typed array operations; never Math.random or Date.now.
 */
import { DEFAULT_TAX_RATE, MAP_SIZE, MAP_TILES, inBounds, tileIndex } from '../shared/constants';
import type { BuildingInstance, GridState } from '../shared/types';
import { BuildingState, FieldId, RoadTier } from '../shared/types';

export const BASE_PROFIT_MARGIN = 0.22;
export const STOCKOUT_MARGIN_PENALTY = 0.30;
export const INSOLVENCY_MARGIN_THRESHOLD = -0.10;
export const INSOLVENCY_TAX_FACTOR = 0.25;

export type CommercialStatus = 'thriving' | 'profitable' | 'struggling' | 'insolvent';

export interface CommercialViability {
  profitMargin: number; // percentage (-100..100)
  stockLevel: number; // 0..1 (1 = fully stocked, 0 = stockout)
  status: CommercialStatus;
  monthlyRevenue: number;
}

export interface SupplyChainStats {
  deliveryRate: number; // 0..1 fraction of shops receiving goods
  commercialViability: number; // average profit margin %
  insolventCount: number;
}

const DX = [1, -1, 0, 0];
const DZ = [0, 0, 1, -1];

export class SupplyChainSim {
  /**
   * Tracks road tiles connected to freight supply sources (industrial or map edges).
   */
  private freightReachable = new Uint8Array(MAP_TILES);

  computeSupplyChain(
    buildings: readonly BuildingInstance[],
    grid: GridState,
    taxRateCom: number,
    laborRatio = 1.0,
  ): SupplyChainStats {
    this.freightReachable.fill(0);

    const queue: number[] = [];

    // 1. Identify freight sources:
    // A) External road connections (highways or roads on map borders)
    for (let x = 0; x < MAP_SIZE; x++) {
      const topIdx = tileIndex(x, 0);
      const bottomIdx = tileIndex(x, MAP_SIZE - 1);
      if (grid.roadTier[topIdx] !== RoadTier.None) {
        this.freightReachable[topIdx] = 1;
        queue.push(topIdx);
      }
      if (grid.roadTier[bottomIdx] !== RoadTier.None) {
        this.freightReachable[bottomIdx] = 1;
        queue.push(bottomIdx);
      }
    }
    for (let z = 1; z < MAP_SIZE - 1; z++) {
      const leftIdx = tileIndex(0, z);
      const rightIdx = tileIndex(MAP_SIZE - 1, z);
      if (grid.roadTier[leftIdx] !== RoadTier.None) {
        this.freightReachable[leftIdx] = 1;
        queue.push(leftIdx);
      }
      if (grid.roadTier[rightIdx] !== RoadTier.None) {
        this.freightReachable[rightIdx] = 1;
        queue.push(rightIdx);
      }
    }

    // B) Industrial buildings adjacent road tiles
    for (const b of buildings) {
      if (b.state !== BuildingState.Active) continue;
      if (!b.catalogId.startsWith('ind-')) continue;

      // Seed all adjacent road tiles
      for (let d = 0; d < 4; d++) {
        const nx = b.x + DX[d]!;
        const nz = b.z + DZ[d]!;
        if (!inBounds(nx, nz)) continue;
        const nIdx = tileIndex(nx, nz);
        if (grid.roadTier[nIdx] !== RoadTier.None && this.freightReachable[nIdx] === 0) {
          this.freightReachable[nIdx] = 1;
          queue.push(nIdx);
        }
      }
    }

    // BFS along the road network to propagate freight delivery reach
    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++]!;
      const cx = curr % MAP_SIZE;
      const cz = Math.floor(curr / MAP_SIZE);

      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d]!;
        const nz = cz + DZ[d]!;
        if (!inBounds(nx, nz)) continue;
        const nIdx = tileIndex(nx, nz);
        if (grid.roadTier[nIdx] !== RoadTier.None && this.freightReachable[nIdx] === 0) {
          this.freightReachable[nIdx] = 1;
          queue.push(nIdx);
        }
      }
    }

    // 2. Evaluate each commercial building
    let totalCom = 0;
    let suppliedCom = 0;
    let totalMargin = 0;
    let insolventCount = 0;

    const landValueField = grid.fields[FieldId.LandValue];

    for (const b of buildings) {
      if (b.state !== BuildingState.Active) continue;
      if (!b.catalogId.startsWith('com-')) continue;

      totalCom++;

      // Check if building is adjacent to a freight-reachable road tile
      let hasFreightAccess = false;
      for (let d = 0; d < 4; d++) {
        const nx = b.x + DX[d]!;
        const nz = b.z + DZ[d]!;
        if (!inBounds(nx, nz)) continue;
        const nIdx = tileIndex(nx, nz);
        if (this.freightReachable[nIdx] === 1) {
          hasFreightAccess = true;
          break;
        }
      }

      let stockLevel = 0.0;
      if (hasFreightAccess) {
        suppliedCom++;
        // If active industries exist or external connection, stock level is full
        stockLevel = 1.0;
      }

      const viability = this.calculateViability(b, grid, taxRateCom, stockLevel, laborRatio);
      totalMargin += viability.profitMargin;

      if (viability.status === 'insolvent') {
        insolventCount++;
        // Commercial blight: slightly depress local land value
        if (landValueField) {
          const bIdx = tileIndex(b.x, b.z);
          landValueField[bIdx] = Math.max(0, (landValueField[bIdx] ?? 100) - 15);
        }
      }
    }

    if (totalCom === 0) {
      return {
        deliveryRate: 1.0,
        commercialViability: Math.round(BASE_PROFIT_MARGIN * 100),
        insolventCount: 0,
      };
    }

    return {
      deliveryRate: suppliedCom / totalCom,
      commercialViability: Math.round(totalMargin / totalCom),
      insolventCount,
    };
  }

  /**
   * Calculates individual commercial building viability.
   */
  calculateViability(
    b: BuildingInstance,
    grid: GridState,
    taxRateCom: number,
    stockLevel: number,
    laborRatio = 1.0,
  ): CommercialViability {
    const idx = tileIndex(b.x, b.z);
    const landValueField = grid.fields[FieldId.LandValue];
    const lv = landValueField ? (landValueField[idx] ?? 100) : 100;

    let margin = BASE_PROFIT_MARGIN;

    // Foot traffic / location value
    const footTraffic = ((lv - 100) / 255) * 0.12;
    margin += footTraffic;

    // Corporate tax elasticity: higher taxes compress operating margin
    const taxDelta = (DEFAULT_TAX_RATE - taxRateCom) * 1.2;
    margin += taxDelta;

    // Labor availability
    if (laborRatio < 0.8) {
      margin -= (0.8 - laborRatio) * 0.15;
    }

    // Goods stock status
    if (stockLevel >= 0.8) {
      margin += 0.02;
    } else if (stockLevel >= 0.3) {
      margin -= 0.12;
    } else {
      margin -= STOCKOUT_MARGIN_PENALTY;
    }

    const marginPct = Math.round(margin * 100);
    let status: CommercialStatus;
    if (margin >= 0.15) {
      status = 'thriving';
    } else if (margin >= 0.02) {
      status = 'profitable';
    } else if (margin >= INSOLVENCY_MARGIN_THRESHOLD) {
      status = 'struggling';
    } else {
      status = 'insolvent';
    }

    const baseRevenue = b.level === 3 ? 12000 : b.level === 2 ? 5500 : 2400;
    const monthlyRevenue =
      status === 'insolvent'
        ? Math.round(baseRevenue * INSOLVENCY_TAX_FACTOR)
        : Math.round(baseRevenue * (1 + margin));

    return {
      profitMargin: marginPct,
      stockLevel,
      status,
      monthlyRevenue,
    };
  }

  isFreightReachable(x: number, z: number): boolean {
    if (!inBounds(x, z)) return false;
    return this.freightReachable[tileIndex(x, z)] === 1;
  }
}
