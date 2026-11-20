import { C } from '../core/constants';
import { U } from '../core/utils';
import { Sim } from './sim';
import { World } from '../world/world';
import {
  WeatherState,
  WeatherType,
  WeatherForecastDay,
  DisasterIncident,
} from '../types';

export class WeatherSystem {
  public static state: WeatherState = {
    type: 'clear',
    temp: 20.0,
    humidity: 50,
    pressure: 1013,
    precipitation: 0.0,
    clouds: 0.1,
    targetClouds: 0.1,
    fogDensity: 0.0,
    lightningTimer: 0,
    forecast: [],
    season: 'summer',
    heatwave: false,
    coldSnap: false,
    emergencySirensActive: false,
    brigadesMobilized: false,
    brigadesTimer: 0,
  };

  public static incidents: DisasterIncident[] = [];
  private static nextIncidentId: number = 1;
  private static weatherChangeTimer: number = 0;
  private static forecastCacheDay: number = -1;

  public static init(saved?: WeatherState, savedIncidents?: DisasterIncident[]): void {
    if (saved) {
      this.state = {
        ...this.state,
        ...saved,
      };
    } else {
      this.state.type = 'clear';
      this.state.temp = 21.0;
      this.state.humidity = 48;
      this.state.pressure = 1014;
      this.state.precipitation = 0;
      this.state.clouds = 0.15;
      this.state.targetClouds = 0.15;
      this.state.fogDensity = 0.0;
      this.state.heatwave = false;
      this.state.coldSnap = false;
      this.state.emergencySirensActive = false;
      this.state.brigadesMobilized = false;
      this.state.brigadesTimer = 0;
    }

    if (savedIncidents && Array.isArray(savedIncidents)) {
      this.incidents = savedIncidents.slice();
      this.nextIncidentId = this.incidents.reduce((m, inc) => {
        const idNum = parseInt(inc.id.replace(/\D/g, ''), 10) || 0;
        return Math.max(m, idNum + 1);
      }, 1);
    } else {
      this.incidents = [];
    }

    this.updateSeason();
    this.refreshForecast();
  }

  public static updateSeason(): void {
    const m = Sim.month; // 1..12
    if (m === 12 || m <= 2) {
      this.state.season = 'winter';
    } else if (m >= 3 && m <= 5) {
      this.state.season = 'spring';
    } else if (m >= 6 && m <= 8) {
      this.state.season = 'summer';
    } else {
      this.state.season = 'autumn';
    }
  }

  public static step(dtSec: number): void {
    const S = this.state;
    this.updateSeason();

    // 1. Seasonal baseline temperatures
    let baseTemp = 16.0;
    if (S.season === 'summer') baseTemp = 25.0;
    else if (S.season === 'winter') baseTemp = 2.0;
    else if (S.season === 'spring') baseTemp = 15.0;
    else baseTemp = 13.0;

    // Check heatwave / cold snap triggers every 24 hours
    if (Sim.hour < 0.2 && Math.floor(Sim.day) % 7 === 0) {
      const hHash = U.hash(Sim.day, Sim.month, 777) % 100;
      if (S.season === 'summer' && hHash < 20) {
        S.heatwave = true;
        S.coldSnap = false;
      } else if (S.season === 'winter' && hHash < 20) {
        S.coldSnap = true;
        S.heatwave = false;
      } else {
        S.heatwave = false;
        S.coldSnap = false;
      }
    }

    if (S.heatwave) baseTemp += 9.0;
    if (S.coldSnap) baseTemp -= 9.0;

    // Diurnal temperature swing: peak at 14:00, coldest at 05:00
    const diurnal = Math.sin(((Sim.hour - 8) / 24) * Math.PI * 2) * 5.0;
    const targetTemp = baseTemp + diurnal;
    S.temp += (targetTemp - S.temp) * 0.05;

    // 2. Weather transition state machine
    this.weatherChangeTimer -= dtSec;
    if (this.weatherChangeTimer <= 0) {
      this.weatherChangeTimer = 45 + (U.hash(Sim.simHours, Sim.day, 123) % 40);
      this.evaluateWeatherTransition();
    }

    // Smooth cloud and fog interpolation
    S.clouds += (S.targetClouds - S.clouds) * 0.03;
    if (S.type === 'fog') {
      S.fogDensity += (0.9 - S.fogDensity) * 0.04;
    } else {
      S.fogDensity += (0.0 - S.fogDensity) * 0.04;
    }

    // 3. Lightning in storm
    if (S.type === 'storm') {
      S.lightningTimer -= dtSec;
      if (S.lightningTimer <= 0) {
        S.lightningTimer = 6 + (U.hash(Sim.simHours, Math.floor(S.lightningTimer), 888) % 18);
        this.triggerLightningStrike();
      }
    }

    // 4. Brigade mobilization timer countdown (in hours)
    if (S.brigadesMobilized) {
      S.brigadesTimer -= dtSec / C.SIM_SEC;
      if (S.brigadesTimer <= 0) {
        S.brigadesMobilized = false;
        S.brigadesTimer = 0;
        Sim.notify('Emergency Fire Brigade mobilization ended.', 'bad');
      }
    }

    // 5. Daily forecast refresh
    if (Math.floor(Sim.day) !== this.forecastCacheDay) {
      this.forecastCacheDay = Math.floor(Sim.day);
      this.refreshForecast();
    }
  }

  private static evaluateWeatherTransition(): void {
    const S = this.state;
    const r = (U.hash(Sim.simHours, Sim.month, Math.floor(Sim.hour)) % 100) / 100;

    // Pressure fluctuations
    const pressureDelta = (r - 0.5) * 4;
    S.pressure = U.clamp(S.pressure + pressureDelta, 980, 1035);

    // Weather type transitions based on pressure and season
    if (S.pressure < 995) {
      // Deep low pressure -> storm or heavy snow
      if (S.temp <= 1.0) {
        S.type = 'snow';
        S.precipitation = 0.85;
        S.targetClouds = 0.95;
      } else {
        S.type = 'storm';
        S.precipitation = 0.9;
        S.targetClouds = 1.0;
      }
      S.humidity = Math.min(100, S.humidity + 8);
    } else if (S.pressure < 1008) {
      // Moderate low pressure -> rain or overcast
      if (S.temp <= 1.0) {
        S.type = 'snow';
        S.precipitation = 0.55;
        S.targetClouds = 0.85;
      } else if (r < 0.65) {
        S.type = 'rain';
        S.precipitation = 0.6;
        S.targetClouds = 0.85;
      } else {
        S.type = 'overcast';
        S.precipitation = 0.0;
        S.targetClouds = 0.7;
      }
      S.humidity = Math.min(95, S.humidity + 4);
    } else if (S.pressure < 1018) {
      // Normal atmospheric pressure
      if (S.humidity > 82 && S.temp < 12 && Sim.hour < 9 && Sim.wind.speed < 14) {
        S.type = 'fog';
        S.precipitation = 0.0;
        S.targetClouds = 0.45;
      } else if (r < 0.4) {
        S.type = 'overcast';
        S.precipitation = 0.0;
        S.targetClouds = 0.65;
      } else {
        S.type = 'clear';
        S.precipitation = 0.0;
        S.targetClouds = 0.15;
      }
    } else {
      // High pressure system -> clear sunny skies
      S.type = 'clear';
      S.precipitation = 0.0;
      S.targetClouds = 0.08;
      S.humidity = Math.max(30, S.humidity - 5);
    }
  }

  public static triggerLightningStrike(): void {
    // Notify render engine to flash screen & play thunder
    const Gfx = (window as any).CB?.Gfx;
    if (Gfx && typeof Gfx.flashLightning === 'function') {
      Gfx.flashLightning();
    }
    const UI = (window as any).CB?.UI;
    if (UI && typeof UI.sfx === 'function') {
      UI.sfx('thunder');
    }

    // Occasional lightning strike impact on a tile (15% chance during a strike)
    if (Sim.rng() < 0.15) {
      const sx = Math.floor(C.P0 + Sim.rng() * (C.P1 - C.P0));
      const sy = Math.floor(C.P0 + Sim.rng() * (C.P1 - C.P0));
      const i = U.idx(sx, sy);

      // Check if it strikes a building or forest
      const bid = World.bld ? World.bld[i] : 0;
      if (bid) {
        const b = Sim.buildings.get(bid);
        if (b && b.state === 'live') {
          this.recordIncident('lightning_strike', i, sx, sy, 3, `Lightning struck ${b.name}!`);
          if (this.state.precipitation < 0.4) {
            // Ignites fire if not damp
            (Sim as any).startFire(b);
          }
        }
      } else if (World.tree && World.tree[i] > 0) {
        World.tree[i] = Math.max(0, World.tree[i] - 1);
        const CB = (window as any).CB;
        if (CB?.Meshes) CB.Meshes.treesDirty = true;
        this.recordIncident('wildfire', i, sx, sy, 2, 'Lightning sparked a forest fire!');
      }
    }
  }

  public static refreshForecast(): void {
    const days: WeatherForecastDay[] = [];
    const types: WeatherType[] = ['clear', 'overcast', 'rain', 'clear', 'storm', 'fog', 'clear', 'rain'];

    for (let d = 0; d < 5; d++) {
      const seed = Sim.day + d * 13 + Sim.month * 100;
      const tIdx = Math.abs(U.hash(seed, d, 555)) % types.length;
      let weatherType = types[tIdx];

      let tMin = 12, tMax = 22;
      if (this.state.season === 'summer') {
        tMin = 18 + (U.hash(seed, 1, 10) % 5);
        tMax = 28 + (U.hash(seed, 2, 10) % 7);
      } else if (this.state.season === 'winter') {
        tMin = -4 + (U.hash(seed, 1, 10) % 5);
        tMax = 4 + (U.hash(seed, 2, 10) % 5);
        if (weatherType === 'rain') weatherType = 'snow';
      } else {
        tMin = 8 + (U.hash(seed, 1, 10) % 4);
        tMax = 18 + (U.hash(seed, 2, 10) % 6);
      }

      const precip = weatherType === 'rain' ? 65 : weatherType === 'storm' ? 90 : weatherType === 'snow' ? 75 : 10;
      const wspd = 12 + (Math.abs(U.hash(seed, 3, 20)) % 32);

      days.push({
        dayOffset: d,
        type: weatherType,
        tempMin: tMin,
        tempMax: tMax,
        precipitationChance: precip,
        windSpeed: wspd,
      });
    }

    this.state.forecast = days;
  }

  // --- Incident Tracking ---
  public static recordIncident(
    type: DisasterIncident['type'],
    tile: number,
    x: number,
    y: number,
    severity: number,
    description: string
  ): DisasterIncident {
    const inc: DisasterIncident = {
      id: 'inc_' + this.nextIncidentId++,
      type,
      tile,
      x,
      y,
      severity,
      startTime: Sim.simHours,
      description,
      active: true,
    };
    this.incidents.unshift(inc);
    if (this.incidents.length > 25) this.incidents.pop();

    Sim.notify(`🚨 Incident: ${description}`, severity >= 3 ? 'bad' : 'warn');
    return inc;
  }

  public static resolveIncident(id: string): void {
    const inc = this.incidents.find(q => q.id === id);
    if (inc) {
      inc.active = false;
    }
  }

  public static getActiveIncidents(): DisasterIncident[] {
    return this.incidents.filter(q => q.active);
  }

  // --- Emergency Operations ---
  public static cloudSeeding(): boolean {
    const COST = 3500;
    if (Sim.money < COST) {
      Sim.notify('Insufficient treasury funds for Cloud Seeding ($3,500 required).', 'bad');
      return false;
    }
    Sim.money -= COST;
    this.state.pressure = 998;
    this.state.targetClouds = 0.95;
    this.state.humidity = Math.min(100, this.state.humidity + 35);
    this.weatherChangeTimer = 2; // Trigger immediate rain transition
    Sim.notify('✈️ Cloud seeding operation initiated! Rainfall incoming.', 'good');
    return true;
  }

  public static mobilizeBrigades(): boolean {
    const COST = 4000;
    if (Sim.money < COST) {
      Sim.notify('Insufficient treasury funds for Brigade Mobilization ($4,000 required).', 'bad');
      return false;
    }
    Sim.money -= COST;
    this.state.brigadesMobilized = true;
    this.state.brigadesTimer = 72; // 72 in-game hours
    Sim.notify('🚒 Emergency Fire Brigades mobilized! Fire response doubled for 3 days.', 'good');
    return true;
  }

  public static toggleEmergencySirens(): boolean {
    const COST = 1000;
    if (!this.state.emergencySirensActive) {
      if (Sim.money < COST) {
        Sim.notify('Insufficient funds to sound Emergency Sirens ($1,000 required).', 'bad');
        return false;
      }
      Sim.money -= COST;
      this.state.emergencySirensActive = true;
      const UI = (window as any).CB?.UI;
      if (UI && typeof UI.sfx === 'function') UI.sfx('siren');
      Sim.notify('📢 Severe Weather Sirens sounding! Citizens directed to shelter.', 'warn');
    } else {
      this.state.emergencySirensActive = false;
      Sim.notify('Sirens deactivated. All-clear issued.', 'good');
    }
    return true;
  }

  // Threat score calculations for UI gauges
  public static getWildfireRisk(): number {
    let score = 20;
    if (this.state.temp > 28) score += (this.state.temp - 28) * 3;
    if (this.state.humidity < 40) score += (40 - this.state.humidity) * 1.2;
    if (Sim.wind.speed > 25) score += (Sim.wind.speed - 25) * 1.5;
    if (this.state.precipitation > 0.1) score *= 0.1;
    return Math.round(U.clamp(score, 5, 100));
  }

  public static getStructuralFireRisk(): number {
    let score = 25;
    if (this.state.temp > 30) score += 15;
    if (Sim.wind.speed > 35) score += 20;
    if (this.state.precipitation > 0.2) score *= 0.2;
    if (this.state.brigadesMobilized) score *= 0.5;
    return Math.round(U.clamp(score, 5, 100));
  }

  public static getStormSurgeRisk(): number {
    if (this.state.type !== 'storm' && this.state.type !== 'rain') return 10;
    let score = 30 + this.state.precipitation * 45 + (Sim.wind.speed > 30 ? 25 : 0);
    return Math.round(U.clamp(score, 10, 100));
  }

  public static serialize(): WeatherState {
    return { ...this.state };
  }
}
