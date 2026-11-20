/**
 * Vira City — Water Supply, Sanitation Network & Hydrological Simulation (`src/sim/waterNet.ts`)
 *
 * Implements clean drinking water distribution, sewage collector networks,
 * wastewater treatment plants, and surface/groundwater contamination tracking.
 * All computations use flat continuous TypedArrays (Zero-GC).
 */

import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { World } from '@/world/world';
import { Building } from '@/types';

const W = C.W;
const N = W * W;
const PIPE_RADIUS = C.PIPE_RADIUS ?? 4;

export class WaterNetwork {
  waterPollution: Float32Array = new Float32Array(N);
  groundWaterPollution: Float32Array = new Float32Array(N);
  waterServed: Uint8Array = new Uint8Array(N);
  sewageServed: Uint8Array = new Uint8Array(N);

  waterSupply = 0;
  waterDemand = 0;
  waterPurity = 1.0; // 0.0 (fully contaminated) to 1.0 (100% clean)
  sewageCap = 0;
  sewageLoad = 0;

  init(): void {
    this.waterPollution.fill(0);
    this.groundWaterPollution.fill(0);
    this.waterServed.fill(0);
    this.sewageServed.fill(0);
    this.waterSupply = 0;
    this.waterDemand = 0;
    this.waterPurity = 1.0;
    this.sewageCap = 0;
    this.sewageLoad = 0;
  }

  /**
   * Propagates network connectivity through pipes using a high-performance breadth-first queue.
   */
  private propagateNetwork(
    pipeGrid: Uint8Array,
    sources: number[],
    servedGrid: Uint8Array
  ): void {
    servedGrid.fill(0);
    if (sources.length === 0) return;

    // Queue for BFS pipe flood fill
    const queue = new Int32Array(N);
    const inQueue = new Uint8Array(N);
    let head = 0;
    let tail = 0;

    for (const src of sources) {
      if (src >= 0 && src < N && !inQueue[src]) {
        inQueue[src] = 1;
        queue[tail++] = src;
      }
    }

    // BFS along contiguous pipe segments
    while (head < tail) {
      const curr = queue[head++];
      const cx = U.tx(curr);
      const cy = U.ty(curr);

      // Check 4 cardinal neighbors for connected pipes
      const neighbors = [
        cy > 0 ? curr - W : -1,
        cy < W - 1 ? curr + W : -1,
        cx > 0 ? curr - 1 : -1,
        cx < W - 1 ? curr + 1 : -1,
      ];

      for (const n of neighbors) {
        if (n >= 0 && pipeGrid[n] > 0 && !inQueue[n]) {
          inQueue[n] = 1;
          queue[tail++] = n;
        }
      }
    }

    // Expand coverage radius around pressurized/flowing pipes
    for (let k = 0; k < tail; k++) {
      const idx = queue[k];
      const cx = U.tx(idx);
      const cy = U.ty(idx);
      const minX = Math.max(0, cx - PIPE_RADIUS);
      const maxX = Math.min(W - 1, cx + PIPE_RADIUS);
      const minY = Math.max(0, cy - PIPE_RADIUS);
      const maxY = Math.min(W - 1, cy + PIPE_RADIUS);

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const d2 = (x - cx) ** 2 + (y - cy) ** 2;
          if (d2 <= PIPE_RADIUS * PIPE_RADIUS) {
            servedGrid[y * W + x] = 1;
          }
        }
      }
    }
  }

  /**
   * Executes a full simulation cycle of the urban water supply and sewage sanitation system.
   */
  step(buildings: Map<number, Building>, cv: Record<string, Float32Array>): void {
    const cleanSources: number[] = [];
    const sewageSinks: number[] = [];

    let totalWaterCapacity = 0;
    let cleanWaterCapacity = 0;
    let totalSewageCapacity = 0;

    // 1. Identify and evaluate water & sewage service facilities
    buildings.forEach((b: Building) => {
      if (b.kind !== 'svc' || !b.svc) return;

      const cx = Math.floor(b.x + b.fw / 2);
      const cy = Math.floor(b.y + b.fh / 2);
      const tile = U.idx(cx, cy);

      if (b.svc === 'water_pump') {
        // Pumping station on water's edge
        const cap = 140000;
        totalWaterCapacity += cap;

        // Check if drawn water is contaminated
        let waterPoll = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (U.inWorld(nx, ny)) {
              const ni = U.idx(nx, ny);
              if (World.isWater(ni) && this.waterPollution[ni] > waterPoll) {
                waterPoll = this.waterPollution[ni];
              }
            }
          }
        }

        const purity = Math.max(0, 1 - waterPoll * 1.5);
        cleanWaterCapacity += cap * purity;
        b.waterCap = cap;
        b.waterFlow = cap;

        cleanSources.push(tile);
        if (b.road && World.road[b.road]) cleanSources.push(b.road);
      } else if (b.svc === 'water_tower') {
        // Ground water tower
        const cap = 75000;
        totalWaterCapacity += cap;

        // Check subterranean groundwater pollution beneath lot
        const groundPoll = this.groundWaterPollution[tile];
        const purity = Math.max(0, 1 - groundPoll * 1.8);
        cleanWaterCapacity += cap * purity;
        b.waterCap = cap;
        b.waterFlow = cap;

        cleanSources.push(tile);
        if (b.road && World.road[b.road]) cleanSources.push(b.road);
      } else if (b.svc === 'water_treatment') {
        // Eco sewage treatment plant
        const cap = 160000;
        totalSewageCapacity += cap;
        b.sewageCap = cap;

        sewageSinks.push(tile);
        if (b.road && World.road[b.road]) sewageSinks.push(b.road);
      } else if (b.svc === 'sewage_drain') {
        // Raw sewage discharge flume
        const cap = 110000;
        totalSewageCapacity += cap;
        b.sewageCap = cap;

        sewageSinks.push(tile);
        if (b.road && World.road[b.road]) sewageSinks.push(b.road);

        // Discharges raw sewage into local waterway!
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (U.inWorld(nx, ny)) {
              const ni = U.idx(nx, ny);
              if (World.isWater(ni)) {
                this.waterPollution[ni] = Math.min(1.0, this.waterPollution[ni] + 0.35);
              }
            }
          }
        }
      }
    });

    this.waterSupply = totalWaterCapacity;
    this.waterPurity = totalWaterCapacity > 0 ? U.clamp(cleanWaterCapacity / totalWaterCapacity, 0, 1) : 1.0;
    this.sewageCap = totalSewageCapacity;

    // 2. Propagate network connectivity via pipes
    this.propagateNetwork(World.waterPipe, cleanSources, this.waterServed);
    this.propagateNetwork(World.sewagePipe, sewageSinks, this.sewageServed);

    // 3. Calculate consumption and apply water/sewage status to buildings
    let totalDemand = 0;

    buildings.forEach((b: Building) => {
      let usage = 0;
      if (b.kind === 'zone') {
        const pop = b.pop ?? b.occ ?? 0;
        const jobs = b.jobs ?? 0;
        const z = b.zone ?? 1;
        const isRes = z <= 3 || z === 8;
        const isCom = z === 4 || z === 5;
        const isInd = z === 6;

        if (isRes) usage = Math.max(10, Math.round(pop * 1.8));
        else if (isCom) usage = Math.max(15, Math.round(jobs * 2.2));
        else if (isInd) usage = Math.max(30, Math.round(jobs * 4.5));
        else usage = Math.max(15, Math.round(jobs * 2.0));
      } else {
        usage = 25;
      }

      totalDemand += usage;

      const cx = Math.floor(b.x + b.fw / 2);
      const cy = Math.floor(b.y + b.fh / 2);
      const tile = U.idx(cx, cy);
      const roadTile = b.road ?? tile;

      const hasWater = (this.waterServed[tile] > 0 || this.waterServed[roadTile] > 0) && this.waterSupply >= totalDemand;
      const hasSewage = (this.sewageServed[tile] > 0 || this.sewageServed[roadTile] > 0) && this.sewageCap >= totalDemand * 0.9;

      b.water = hasWater;
      b.sewage = hasSewage;

      if (b.kind === 'zone' && b.state === 'live') {
        if (!hasWater) {
          b.prob = 'nowater';
        } else if (!hasSewage) {
          b.prob = 'sewage';
        } else if (this.waterPurity < 0.85) {
          b.prob = 'water_polluted';
          b.waterPolluted = true;
          // Contaminated water induces severe sickness
          if (U.hash(b.id, cx, cy) % 100 < Math.round((1 - this.waterPurity) * 45)) {
            b.sick = (b.sick || 0) + 1;
          }
        } else {
          b.waterPolluted = false;
          if (b.prob === 'nowater' || b.prob === 'sewage' || b.prob === 'water_polluted') {
            b.prob = null;
          }
        }
      }
    });

    this.waterDemand = totalDemand;
    this.sewageLoad = Math.round(totalDemand * 0.92);

    // 4. Environmental diffusion and natural degradation of water pollution
    for (let i = 0; i < N; i++) {
      // Ground water absorbs surface pollution
      if (!World.isWater(i)) {
        const surfPoll = cv.pollution ? cv.pollution[i] : 0;
        if (surfPoll > 0.05) {
          this.groundWaterPollution[i] = Math.min(1.0, this.groundWaterPollution[i] + surfPoll * 0.03);
        } else {
          // Slow aquifer purification
          this.groundWaterPollution[i] *= 0.985;
        }
      } else {
        // Surface water natural flushing and dilution
        if (this.waterPollution[i] > 0.005) {
          this.waterPollution[i] *= 0.96;
        } else {
          this.waterPollution[i] = 0;
        }
      }
    }
  }
}

export const Water = new WaterNetwork();
