// ============================================================================
// Open Skylines — Macroeconomic RCI Demand Simulation
// ============================================================================

import { C } from '../core/constants';
import { U } from '../core/utils';
import { Building, DemandData } from '../types';
import { Sim } from './sim';

/**
 * Calculates current macroeconomic zoning demand (RCI) across all categories.
 *
 * Demand ranges from 0 to 100 and governs building spawning rates:
 * - Residential (rlow, rmed, rhigh): Driven by unfilled jobs, happiness, tax rates,
 *   unemployment penalties, and pending unbuilt lots. Scaled by city population size.
 * - Commercial: Driven by population consumption needs, landmark tourist attraction, and tax rates.
 * - Industrial: Driven by goods consumption, commercial business supply, and available labour.
 * - Office: High-tech knowledge sector driven by citizen education levels and tax policy.
 */
export function calculateDemand(): DemandData {
  const st = Sim.stats;
  let comJobs = 0,
    indJobs = 0,
    offJobs = 0,
    landmarks = 0;

  Sim.buildings.forEach((b: Building) => {
    if (b.kind === 'svc') {
      if (b.svc && C.SERVICES[b.svc]?.cat === 'landmarks') landmarks++;
      return;
    }
    const cat = b.zone ? C.ZONES[b.zone]?.cat : undefined;
    const cap = b.state === 'build' ? Sim.capOf(b) : b.jobs || 0;
    if (cat === 'com') comJobs += cap;
    else if (cat === 'ind') indJobs += cap;
    else if (cat === 'off') offJobs += cap;
  });

  let pending = 0;
  Sim.buildings.forEach((b: Building) => {
    if (Sim.isRes(b))
      pending += b.state === 'build' ? Sim.capOf(b) : Math.max(0, (b.cap || 0) - (b.res || 0));
  });

  const pop = st.pop;
  const workers = st.workers;
  const openJobs = Math.max(0, st.jobs - st.filled - st.outsideIn);

  let rd =
    46 +
    34 * U.clamp((openJobs - pending * 0.3) / Math.max(15, workers * 0.2), -1, 1) +
    (st.happy - 55) * 0.8 -
    (Sim.tax.res - 10) * 4.5 -
    Math.max(0, st.unemp - 0.08) * 160 -
    Math.max(0, pending - 30 - pop * 0.05) * 0.4;

  if (pop < 80) rd = Math.max(rd, 80 - pending * 0.5);
  rd = U.clamp(rd, 0, 100);
  Sim.resDemandBase = rd;

  const w = U.clamp(pop / 6000, 0, 1);
  const rlow = U.clamp(rd * (1.05 - 0.55 * w), 0, 100);
  const rmed = Sim.unlocked(1)
    ? U.clamp(rd * (0.6 + 0.5 * w) + (pop > 400 ? 8 : 0), 0, 100)
    : 0;
  const rhigh = Sim.unlocked(4) ? U.clamp(rd * (0.4 + 0.8 * w) + 10, 0, 100) : 0;

  const avail = U.clamp((st.unemp - 0.03) * 400, 0, 60);
  const comNeed = pop * 0.16 + landmarks * 25 + 6;
  const com = U.clamp(
    22 +
      60 * U.clamp((comNeed - comJobs) / Math.max(8, comNeed * 0.3), -1, 1) -
      (Sim.tax.com - 10) * 4.5 +
      avail,
    0,
    100
  );

  const indNeed = pop * 0.19 + comJobs * 0.2 + 10;
  const ind = U.clamp(
    22 +
      60 * U.clamp((indNeed - indJobs) / Math.max(8, indNeed * 0.3), -1, 1) -
      (Sim.tax.ind - 10) * 4.5 +
      avail,
    0,
    100
  );

  const offNeed = pop * 0.11 * (0.3 + st.edu);
  const off = Sim.unlocked(3)
    ? U.clamp(
        15 +
          65 * U.clamp((offNeed - offJobs) / Math.max(8, offNeed * 0.3), -1, 1) -
          (Sim.tax.off - 10) * 4.5 +
          avail * 0.6,
        0,
        100
      )
    : 0;

  return { rlow, rmed, rhigh, com, ind, off };
}
