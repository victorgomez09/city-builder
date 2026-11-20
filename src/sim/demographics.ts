/**
 * Vira City — Demographics, Labor Qualifications, Gentrification, Epidemics & Tourism (`src/sim/demographics.ts`)
 *
 * Implements:
 * 1. Population Pyramid and 4 Age Cohorts (Children, Students, Workforce, Seniors).
 * 2. Labor Qualification Matching & Brain Drain Emigration.
 * 3. Land Value Gentrification & Residential Housing Displacement.
 * 4. Epidemiological SIR Contagion Transmission & Healthcare Saturation.
 * 5. Tourism Economy, Hotel Hospitality & Convention Visitors.
 */

import { C } from '../core/constants';
import { U } from '../core/utils';
import { Sim } from './sim';
import { World } from '../world/world';
import { Water } from './waterNet';
import { Unrest } from './unrest';
import { Building, DemographicsState } from '../types';

export class DemographicsSystem {
  public static state: DemographicsState = {
    children: 0,
    students: 0,
    workforce: 0,
    seniors: 0,
    fertilityRate: 14.5,
    lifeExpectancy: 78.0,
    unskilledWorkers: 0,
    skilledWorkers: 0,
    unskilledJobs: 0,
    skilledJobs: 0,
    laborMismatchIndex: 0,
    brainDrainRate: 0,
    brainDrainActive: false,
    displacedCitizens: 0,
    gentrificationIndex: 0,
    infectedCitizens: 0,
    hospitalCapacity: 0,
    hospitalOccupancy: 0,
    quarantineActive: false,
    vaccinationActive: false,
    sanitationBlitzActive: false,
    quarantineTimer: 0,
    vaccinationTimer: 0,
    sanitationTimer: 0,
    touristCount: 0,
    touristSpendMonthly: 0,
    hotelCapacity: 0,
    hotelOccupancy: 0,
  };

  public static init(saved?: DemographicsState): void {
    if (saved) {
      this.state = {
        ...this.state,
        ...saved,
      };
    } else {
      this.state.children = 0;
      this.state.students = 0;
      this.state.workforce = 0;
      this.state.seniors = 0;
      this.state.fertilityRate = 14.5;
      this.state.lifeExpectancy = 78.0;
      this.state.unskilledWorkers = 0;
      this.state.skilledWorkers = 0;
      this.state.unskilledJobs = 0;
      this.state.skilledJobs = 0;
      this.state.laborMismatchIndex = 0;
      this.state.brainDrainRate = 0;
      this.state.brainDrainActive = false;
      this.state.displacedCitizens = 0;
      this.state.gentrificationIndex = 0;
      this.state.infectedCitizens = 0;
      this.state.hospitalCapacity = 0;
      this.state.hospitalOccupancy = 0;
      this.state.quarantineActive = false;
      this.state.vaccinationActive = false;
      this.state.sanitationBlitzActive = false;
      this.state.quarantineTimer = 0;
      this.state.vaccinationTimer = 0;
      this.state.sanitationTimer = 0;
      this.state.touristCount = 0;
      this.state.touristSpendMonthly = 0;
      this.state.hotelCapacity = 0;
      this.state.hotelOccupancy = 0;
    }
  }

  public static step(dtSec: number): void {
    const S = this.state;
    const dtH = dtSec / C.SIM_SEC;

    // Countdown active health directives (in hours)
    if (S.sanitationBlitzActive) {
      S.sanitationTimer -= dtH;
      if (S.sanitationTimer <= 0) {
        S.sanitationBlitzActive = false;
        S.sanitationTimer = 0;
        Sim.notify('Citywide Sanitation Blitz campaign has concluded.', 'info');
      }
    }

    if (S.vaccinationActive) {
      S.vaccinationTimer -= dtH;
      if (S.vaccinationTimer <= 0) {
        S.vaccinationActive = false;
        S.vaccinationTimer = 0;
        Sim.notify('Emergency Vaccination Drive period has concluded.', 'info');
      }
    }
  }

  public static hourlyTick(): void {
    const S = this.state;
    const P = Sim.stats.pop;
    if (P <= 0) return;

    // 1. Contagious Epidemic Transmission
    let sickTotal = 0;
    let hospCap = 0;

    Sim.buildings.forEach((b: Building) => {
      if (b.kind === 'svc') {
        if (b.svc === 'clinic') hospCap += 25;
        else if (b.svc === 'hospital') hospCap += 90;
        else if (b.svc === 'field_hospital') hospCap += 45;
        return;
      }
      if (b.state !== 'live') return;

      const sick = b.sick || 0;
      if (sick > 0) sickTotal += sick;

      // Contagion jump to neighboring residential buildings
      if (sick > 0 && Sim.rng() < 0.12) {
        let transProb = 0.08 + (1.0 - (Water.waterPurity || 1.0)) * 0.35;
        if (b.garbage && b.garbage > 80) transProb += 0.15;
        if (b.waterPolluted) transProb += 0.25;
        if (S.quarantineActive) transProb *= 0.25;
        if (S.sanitationBlitzActive) transProb *= 0.40;
        if (S.vaccinationActive) transProb *= 0.30;

        if (Sim.rng() < transProb) {
          // Spread to a nearby building along road
          const cx = b.x + (b.fw >> 1), cy = b.y + (b.fh >> 1);
          for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx, ny = cy + dy;
              if (U.inWorld(nx, ny)) {
                const nTile = U.idx(nx, ny);
                const targetBId = World.bld ? World.bld[nTile] : 0;
                if (targetBId && targetBId !== b.id) {
                  const targetB = Sim.buildings.get(targetBId);
                  if (targetB && targetB.state === 'live' && targetB.kind === 'zone') {
                    const z = targetB.zone ? C.ZONES[targetB.zone] : null;
                    if (z?.cat === 'res' && (targetB.sick || 0) < Math.ceil((targetB.res || 4) * 0.6)) {
                      targetB.sick = (targetB.sick || 0) + 1;
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    S.infectedCitizens = sickTotal;
    S.hospitalCapacity = hospCap;
    S.hospitalOccupancy = Math.min(100, Math.round(sickTotal / (hospCap + 1) * 100));

    // Epidemic outbreak notification if hospital capacity saturates
    if (S.hospitalOccupancy > 95 && Sim.rng() < 0.05) {
      Sim.notify('🚨 HEALTHCARE SATURATION: Hospitals overwhelmed by epidemic outbreak! Vaccinate or sanitize.', 'bad');
    }
  }

  public static monthlyTick(): void {
    const S = this.state;
    const P = Sim.stats.pop;
    const happy = Sim.stats.happy || 60;
    const edu = Sim.stats.edu || 0;

    if (P <= 0) {
      S.children = 0;
      S.students = 0;
      S.workforce = 0;
      S.seniors = 0;
      S.unskilledWorkers = 0;
      S.skilledWorkers = 0;
      S.unskilledJobs = 0;
      S.skilledJobs = 0;
      S.touristCount = 0;
      return;
    }

    // 1. Cohorts & Population Pyramid
    const waterPurity = Water.waterPurity || 1.0;
    S.lifeExpectancy = 72.0 + Math.min(12.0, edu * 8.0) + (waterPurity * 5.0) - (S.infectedCitizens > 50 ? 4.0 : 0.0);
    S.fertilityRate = U.clamp(11.0 + (happy - 50) * 0.18 + (waterPurity > 0.85 ? 2.5 : -3.0), 6.0, 26.0);

    // Distribution shares based on demographic vitality
    const childShare = U.clamp(0.18 + (S.fertilityRate - 14) * 0.006, 0.12, 0.26);
    const studentShare = U.clamp(0.08 + edu * 0.06, 0.05, 0.16);
    const seniorShare = U.clamp(0.14 + (S.lifeExpectancy - 75) * 0.005, 0.08, 0.22);
    const workforceShare = Math.max(0.40, 1.0 - childShare - studentShare - seniorShare);

    S.children = Math.round(P * childShare);
    S.students = Math.round(P * studentShare);
    S.seniors = Math.round(P * seniorShare);
    S.workforce = Math.max(0, P - S.children - S.students - S.seniors);

    // 2. Labor Qualification Matching
    // University graduates form skilled workforce
    const skilledRatio = U.clamp(0.15 + edu * 0.70, 0.10, 0.85);
    S.skilledWorkers = Math.round(S.workforce * skilledRatio);
    S.unskilledWorkers = Math.max(0, S.workforce - S.skilledWorkers);

    // Compute skilled vs unskilled job positions available
    let sJobs = 0;
    let uJobs = 0;
    let hotelRooms = 0;
    let touristAttractions = 0;

    Sim.buildings.forEach((b: Building) => {
      if (b.kind === 'svc') {
        if (b.svc === 'hotel_grand') {
          hotelRooms += 240;
          touristAttractions += 4;
          sJobs += 15;
          uJobs += 25;
        } else if (b.svc === 'convention_center') {
          hotelRooms += 120;
          touristAttractions += 6;
          sJobs += 35;
          uJobs += 20;
        } else if (b.svc === 'resort_leisure') {
          hotelRooms += 320;
          touristAttractions += 6;
          sJobs += 12;
          uJobs += 30;
        } else if (b.svc === 'opera') {
          touristAttractions += 8;
          sJobs += 20;
        } else if (b.svc === 'stadium_arena') {
          touristAttractions += 8;
          sJobs += 15;
          uJobs += 35;
        } else if (b.svc === 'airport_intl') {
          touristAttractions += 10;
          sJobs += 45;
          uJobs += 55;
        } else if (b.svc === 'univ' || b.svc === 'hospital') {
          sJobs += 30;
          uJobs += 10;
        }
        return;
      }
      if (b.state !== 'live') return;

      const z = b.zone ? C.ZONES[b.zone] : null;
      if (!z || z.cat === 'res') return;

      const j = b.jobs || b.cap || 2;
      if (z.cat === 'off' || z.key === 'chigh') {
        sJobs += Math.round(j * 0.75);
        uJobs += Math.max(0, j - Math.round(j * 0.75));
      } else {
        uJobs += Math.round(j * 0.80);
        sJobs += Math.max(0, j - Math.round(j * 0.80));
      }
    });

    S.skilledJobs = sJobs;
    S.unskilledJobs = uJobs;
    S.hotelCapacity = hotelRooms;

    // 3. Labor Mismatch & Brain Drain
    const totalJobs = sJobs + uJobs;
    if (totalJobs > 0) {
      S.laborMismatchIndex = Math.round(
        (Math.abs(S.skilledWorkers - S.skilledJobs) + Math.abs(S.unskilledWorkers - S.unskilledJobs)) /
        (S.workforce + 1) * 50
      );
      S.laborMismatchIndex = U.clamp(S.laborMismatchIndex, 0, 100);
    } else {
      S.laborMismatchIndex = 0;
    }

    // Brain Drain: educated workers emigrate if skilled jobs deficit exceeds 25%
    if (S.skilledWorkers > S.skilledJobs * 1.25 && S.skilledWorkers > 30) {
      S.brainDrainActive = true;
      S.brainDrainRate = Math.round((S.skilledWorkers - S.skilledJobs) * 0.08);
      // Reduce population slightly as graduates leave for other cities
      Sim.stats.pop = Math.max(1, Sim.stats.pop - S.brainDrainRate);
      Sim.notify(`🎓 Brain Drain: ${S.brainDrainRate} educated graduates emigrated due to lack of skilled office/tech jobs.`, 'warn');
    } else {
      S.brainDrainActive = false;
      S.brainDrainRate = 0;
    }

    // 4. Gentrification & Residential Housing Displacement
    const cv = Sim.cov;
    let newlyGentrified = 0;

    Sim.buildings.forEach((b: Building) => {
      if (b.kind !== 'zone' || b.state !== 'live') return;
      const z = b.zone ? C.ZONES[b.zone] : null;
      if (z?.cat !== 'res') return;

      // Low-density cottage on high land value (lv > 65)
      const centerTile = Sim.centerTile(b);
      const lv = cv?.lv ? cv.lv[centerTile] : 0;

      if (z.key === 'rlow' && b.level <= 2 && lv > 66 && !b.gentrified) {
        // Check district rent control / historic preservation policy
        const did = World.district ? World.district[centerTile] : 0;
        const dist = did ? World.districts.get(did) : null;
        if (dist?.policies.rentControl) return; // Protected!

        // Citizen is displaced / priced out by property appreciation
        b.gentrified = true;
        newlyGentrified += b.res || 4;
        S.displacedCitizens += b.res || 4;

        // Forced upgrade: Cottage gets redeveloped into modern apartments
        b.zone = 5; // rapt (Medium Density Apartments)
        b.level = 1;
        b.name = 'Luxury Urban Lofts';
        const CB = (window as any).CB;
        if (CB?.Meshes) CB.Meshes.refreshBuilding(b);
      }
    });

    if (newlyGentrified > 0) {
      S.gentrificationIndex = Math.min(100, Math.round(S.displacedCitizens / (P + 10) * 100));
      Unrest.state.score = Math.min(100, Unrest.state.score + Math.min(12, newlyGentrified * 0.6));
      Sim.notify(`📈 Gentrification: ${newlyGentrified} low-income tenants displaced by rising land values. Lofts constructed.`, 'info');
    }

    // 5. Tourism Economy & Hotel Revenue
    const hasAirport = Array.from(Sim.buildings.values()).some(b => b.kind === 'svc' && b.svc === 'airport_intl');
    const parkCount = Array.from(Sim.buildings.values()).filter(b => b.kind === 'svc' && C.SERVICES[b.svc]?.cat === 'parks').length;

    const attractiveness = touristAttractions * 35 + parkCount * 8 + (happy > 70 ? 50 : 0);
    S.touristCount = Math.round(attractiveness * (hasAirport ? 1.45 : 1.0));

    if (S.hotelCapacity > 0) {
      S.hotelOccupancy = Math.min(100, Math.round((S.touristCount * 0.75) / S.hotelCapacity * 100));
    } else {
      S.hotelOccupancy = 0;
    }

    // Spending per tourist on commercial stores ($125/month)
    S.touristSpendMonthly = Math.round(S.touristCount * 125 * (S.hotelOccupancy / 100));
    if (S.touristSpendMonthly > 0) {
      Sim.money += S.touristSpendMonthly;
      Sim.budget.inc.com = (Sim.budget.inc.com || 0) + S.touristSpendMonthly;
    }
  }

  // --- Public Health Interventions ---
  public static citywideSanitationBlitz(): boolean {
    const COST = 3000;
    if (Sim.money < COST) {
      Sim.notify('Insufficient funds for Sanitation Blitz ($3,000 required).', 'bad');
      return false;
    }
    Sim.money -= COST;
    this.state.sanitationBlitzActive = true;
    this.state.sanitationTimer = 720; // 30 in-game days
    // Disinfect active sick buildings
    Sim.buildings.forEach((b: Building) => {
      if ((b.sick || 0) > 0) {
        b.sick = Math.max(0, (b.sick || 0) - 1);
      }
    });
    Sim.notify('🧹 Citywide Sanitation Blitz deployed! Deep chemical disinfection applied to roads and sewers.', 'good');
    return true;
  }

  public static emergencyVaccinationDrive(): boolean {
    const COST = 4500;
    if (Sim.money < COST) {
      Sim.notify('Insufficient funds for Vaccination Drive ($4,500 required).', 'bad');
      return false;
    }
    Sim.money -= COST;
    this.state.vaccinationActive = true;
    this.state.vaccinationTimer = 1440; // 60 in-game days
    this.state.infectedCitizens = Math.round(this.state.infectedCitizens * 0.4);
    Sim.buildings.forEach((b: Building) => {
      if ((b.sick || 0) > 0) {
        b.sick = Math.floor((b.sick || 0) * 0.4);
      }
    });
    Sim.notify('💉 Emergency Vaccination Drive enacted! Herd immunity coverage distributed to clinics and hospitals.', 'good');
    return true;
  }

  public static toggleQuarantine(): boolean {
    const COST = 1500;
    if (!this.state.quarantineActive) {
      if (Sim.money < COST) {
        Sim.notify('Insufficient funds for Quarantine Protocol ($1,500 required).', 'bad');
        return false;
      }
      Sim.money -= COST;
      this.state.quarantineActive = true;
      Sim.notify('🔒 Health Quarantine Protocol declared! Non-essential movement restricted to halt contagion.', 'warn');
    } else {
      this.state.quarantineActive = false;
      Sim.notify('Quarantine lifted. Free movement restored.', 'good');
    }
    return true;
  }

  public static serialize(): DemographicsState {
    return { ...this.state };
  }
}
