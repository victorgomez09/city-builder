/**
 * Dynamic Weather & Atmospheric Lighting System (Phase 1).
 *
 * Deterministic weather state machine driven by game ticks and calendar months.
 * Modulates atmospheric lighting, scene fog distance & tint, cloud coverage,
 * and tracks surface wetness (puddles) and snow accumulation.
 *
 * Zero Math.random / Date.now — all randomness uses a local deterministic
 * mulberry32 PRNG keyed by (seed ^ weatherCycle).
 */

import { seasonForMonth, type Season } from '../ui/format';

export type WeatherType = 'clear' | 'overcast' | 'rain' | 'snow' | 'fog';

export const ALL_WEATHER_TYPES: readonly WeatherType[] = [
  'clear',
  'overcast',
  'rain',
  'snow',
  'fog',
];

// ---------------------------------------------------------------------------
// Tuning Parameters & Presets
// (All dials are centralized here for easy tuning and inspection)
// ---------------------------------------------------------------------------

export interface WeatherPreset {
  /** Human-readable display label. */
  name: string;
  /** Fog near distance as fraction of map size (0.35 default). Lower = fog creeps closer. */
  fogNearRatio: number;
  /** Fog far distance as fraction of map size (1.40 default). Lower = denser fog cutoff. */
  fogFarRatio: number;
  /** Fog color tint multiplier [r, g, b]. */
  fogColorTint: [number, number, number];
  /** Directional sun intensity multiplier (1 = full midday sun). */
  sunIntensityMultiplier: number;
  /** Sun shadow darkness multiplier (1 = crisp dark shadows, 0 = no shadow). */
  sunShadowMultiplier: number;
  /** Sun color tint multiplier [r, g, b]. */
  sunColorTint: [number, number, number];
  /** Ambient hemisphere light intensity multiplier. */
  hemiIntensityMultiplier: number;
  /** Ambient hemisphere color tint [r, g, b]. */
  hemiColorTint: [number, number, number];
  /** Added cloud coverage fraction [0..1] (pushes cumulus cloud count higher). */
  cloudCoverageBonus: number;
  /** Cloud color brightness multiplier (1 = white puffs, 0.45 = slate storm thunderheads). */
  cloudDarkness: number;
  /** Sun/moon disc sprite visibility multiplier (0 = hidden behind clouds/mist). */
  sunVisibility: number;
  /** Sky dome horizon & zenith tint multiplier [r, g, b]. */
  skyColorTint: [number, number, number];
  /** Rate of surface wetness change per second (positive = accumulates, negative = dries). */
  wetnessRatePerSecond: number;
  /** Rate of surface snow accumulation per second (positive = accumulates, negative = melts). */
  snowRatePerSecond: number;
}

export const WEATHER_PRESETS: Record<WeatherType, WeatherPreset> = {
  clear: {
    name: 'Clear',
    fogNearRatio: 0.65,
    fogFarRatio: 2.8,
    fogColorTint: [1.0, 1.0, 1.0],
    sunIntensityMultiplier: 1.0,
    sunShadowMultiplier: 1.0,
    sunColorTint: [1.0, 1.0, 1.0],
    hemiIntensityMultiplier: 1.0,
    hemiColorTint: [1.0, 1.0, 1.0],
    cloudCoverageBonus: 0.0,
    cloudDarkness: 1.0,
    sunVisibility: 1.0,
    skyColorTint: [1.0, 1.0, 1.0],
    wetnessRatePerSecond: -0.04, // Evaporates rapidly under clear skies
    snowRatePerSecond: -0.02, // Melts gradually under sunshine
  },
  overcast: {
    name: 'Overcast',
    fogNearRatio: 0.4,
    fogFarRatio: 2.2,
    fogColorTint: [0.85, 0.88, 0.92],
    sunIntensityMultiplier: 0.6,
    sunShadowMultiplier: 0.45,
    sunColorTint: [0.9, 0.92, 0.95],
    hemiIntensityMultiplier: 0.85,
    hemiColorTint: [0.88, 0.9, 0.95],
    cloudCoverageBonus: 0.55,
    cloudDarkness: 0.75,
    sunVisibility: 0.45,
    skyColorTint: [0.85, 0.88, 0.92],
    wetnessRatePerSecond: -0.01,
    snowRatePerSecond: -0.01,
  },
  rain: {
    name: 'Rain',
    fogNearRatio: 0.25,
    fogFarRatio: 1.7,
    fogColorTint: [0.65, 0.7, 0.78], // Moody slate-blue storm fog
    sunIntensityMultiplier: 0.35,
    sunShadowMultiplier: 0.2,
    sunColorTint: [0.75, 0.8, 0.88],
    hemiIntensityMultiplier: 0.7,
    hemiColorTint: [0.72, 0.77, 0.85],
    cloudCoverageBonus: 0.85,
    cloudDarkness: 0.45, // Heavy dark storm clouds
    sunVisibility: 0.15,
    skyColorTint: [0.65, 0.7, 0.78],
    wetnessRatePerSecond: 0.08, // Rapidly drenches ground and roads
    snowRatePerSecond: -0.08, // Rain washes snow away
  },
  snow: {
    name: 'Snow',
    fogNearRatio: 0.3,
    fogFarRatio: 1.9,
    fogColorTint: [0.92, 0.94, 0.98], // Frosty luminous white-blue haze
    sunIntensityMultiplier: 0.55,
    sunShadowMultiplier: 0.35,
    sunColorTint: [0.85, 0.9, 1.0],
    hemiIntensityMultiplier: 0.9, // High albedo bounce keeps the scene luminous
    hemiColorTint: [0.92, 0.95, 1.0],
    cloudCoverageBonus: 0.7,
    cloudDarkness: 0.8,
    sunVisibility: 0.3,
    skyColorTint: [0.88, 0.92, 0.96],
    wetnessRatePerSecond: -0.01,
    snowRatePerSecond: 0.05, // Steadily accumulates
  },
  fog: {
    name: 'Fog',
    fogNearRatio: 0.05, // Very close to camera
    fogFarRatio: 0.9, // Distant buildings disappear in thick mist
    fogColorTint: [0.86, 0.88, 0.9],
    sunIntensityMultiplier: 0.3,
    sunShadowMultiplier: 0.1,
    sunColorTint: [0.85, 0.87, 0.9],
    hemiIntensityMultiplier: 0.75,
    hemiColorTint: [0.85, 0.87, 0.9],
    cloudCoverageBonus: 0.3,
    cloudDarkness: 0.85,
    sunVisibility: 0.08,
    skyColorTint: [0.86, 0.88, 0.9],
    wetnessRatePerSecond: 0.01, // Damp mist
    snowRatePerSecond: -0.01,
  },
};

/** Probability matrix for weather per season. Sum across each row = 1.0. */
export const SEASON_WEATHER_WEIGHTS: Record<Season, Record<WeatherType, number>> = {
  Winter: {
    snow: 0.4,
    overcast: 0.3,
    fog: 0.18,
    clear: 0.12,
    rain: 0.0,
  },
  Spring: {
    clear: 0.4,
    rain: 0.35,
    overcast: 0.18,
    fog: 0.07,
    snow: 0.0,
  },
  Summer: {
    clear: 0.7,
    overcast: 0.18,
    rain: 0.12,
    fog: 0.0,
    snow: 0.0,
  },
  Fall: {
    rain: 0.38,
    overcast: 0.32,
    fog: 0.18,
    clear: 0.12,
    snow: 0.0,
  },
};

/** Minimum duration of a weather condition in simulation ticks (TICKS_PER_DAY = 200). */
export const WEATHER_MIN_DURATION_TICKS = 300; // ~1.5 game days
/** Maximum duration of a weather condition in simulation ticks. */
export const WEATHER_MAX_DURATION_TICKS = 800; // ~4.0 game days
/** Real-time crossfade transition duration in milliseconds. */
export const WEATHER_TRANSITION_MS = 12000; // 12 seconds smooth crossfade

// ---------------------------------------------------------------------------
// Helpers & Math
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerp3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Quintic smoothstep: S-curve with zero 1st and 2nd derivatives at endpoints. */
function quinticSmooth(t: number): number {
  const c = clamp01(t);
  return c * c * c * (c * (c * 6 - 15) + 10);
}

/** Local mulberry32 PRNG (Rule [R-render-012]). Never Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// WeatherAtmosphere: active interpolated parameters consumed by renderers
// ---------------------------------------------------------------------------

export interface WeatherAtmosphere {
  currentWeather: WeatherType;
  targetWeather: WeatherType;
  transitionProgress: number; // 0..1
  fogNearRatio: number;
  fogFarRatio: number;
  fogColorTint: [number, number, number];
  sunIntensityMultiplier: number;
  sunShadowMultiplier: number;
  sunColorTint: [number, number, number];
  hemiIntensityMultiplier: number;
  hemiColorTint: [number, number, number];
  cloudCoverageBonus: number;
  cloudDarkness: number;
  sunVisibility: number;
  skyColorTint: [number, number, number];
  /** Current surface wetness (puddle sheen factor) in [0..1]. */
  wetness: number;
  /** Current surface snow accumulation factor in [0..1]. */
  snowCover: number;
  /** Rain particle intensity in [0..1] for Phase 2 precipitation. */
  rainIntensity: number;
  /** Snow particle intensity in [0..1] for Phase 2 precipitation. */
  snowIntensity: number;
}

// ---------------------------------------------------------------------------
// WeatherManager: state machine and atmospheric driver
// ---------------------------------------------------------------------------

export class WeatherManager {
  private readonly baseSeed: number;
  private current: WeatherType = 'clear';
  private target: WeatherType = 'clear';
  private transitionTimerMs = 0;
  private nextWeatherTick = 0;
  private weatherCycleCount = 0;

  private wetness = 0;
  private snowCover = 0;

  constructor(baseSeed: number = 0x57454154) {
    this.baseSeed = baseSeed;
    this.nextWeatherTick = WEATHER_MIN_DURATION_TICKS;
  }

  /**
   * Updates weather state, transitions, surface wetness, and snow accumulation.
   * Call once per frame in the animation loop.
   */
  update(dtMs: number, tick: number, month: number): void {
    const season = seasonForMonth(month);

    // Check if it is time to transition to a new weather condition
    if (tick >= this.nextWeatherTick && this.current === this.target) {
      this.weatherCycleCount++;
      const nextType = this.sampleNextWeather(season, this.weatherCycleCount);
      if (nextType !== this.current) {
        this.target = nextType;
        this.transitionTimerMs = 0;
      } else {
        // Roll next duration even if weather type repeats
        const rng = mulberry32(this.baseSeed ^ (this.weatherCycleCount * 0x9e3779b9));
        const duration =
          WEATHER_MIN_DURATION_TICKS +
          Math.floor(rng() * (WEATHER_MAX_DURATION_TICKS - WEATHER_MIN_DURATION_TICKS));
        this.nextWeatherTick = tick + duration;
      }
    }

    // Step transition crossfade
    if (this.current !== this.target) {
      this.transitionTimerMs += dtMs;
      if (this.transitionTimerMs >= WEATHER_TRANSITION_MS) {
        this.current = this.target;
        this.transitionTimerMs = 0;
        const rng = mulberry32(this.baseSeed ^ (this.weatherCycleCount * 0x9e3779b9));
        const duration =
          WEATHER_MIN_DURATION_TICKS +
          Math.floor(rng() * (WEATHER_MAX_DURATION_TICKS - WEATHER_MIN_DURATION_TICKS));
        this.nextWeatherTick = tick + duration;
      }
    }

    // Accumulate or dissipate surface wetness and snow
    const dtSeconds = dtMs / 1000;

    const currentPreset = WEATHER_PRESETS[this.current];
    const targetPreset = WEATHER_PRESETS[this.target];
    const smoothT = quinticSmooth(
      this.current === this.target ? 1 : this.transitionTimerMs / WEATHER_TRANSITION_MS,
    );

    const activeWetnessRate = lerp(
      currentPreset.wetnessRatePerSecond,
      targetPreset.wetnessRatePerSecond,
      smoothT,
    );
    this.wetness = clamp01(this.wetness + activeWetnessRate * dtSeconds);

    let activeSnowRate = lerp(
      currentPreset.snowRatePerSecond,
      targetPreset.snowRatePerSecond,
      smoothT,
    );
    // In winter cold, snow melts at a much slower rate
    if (season === 'Winter' && activeSnowRate < 0) {
      activeSnowRate *= 0.15;
    }
    // In summer heat, snow melts faster
    if (season === 'Summer' && activeSnowRate < 0) {
      activeSnowRate *= 2.0;
    }
    this.snowCover = clamp01(this.snowCover + activeSnowRate * dtSeconds);
  }

  /** Returns active interpolated atmospheric parameters for the current frame. */
  getAtmosphere(): WeatherAtmosphere {
    const from = WEATHER_PRESETS[this.current];
    const to = WEATHER_PRESETS[this.target];
    const rawT =
      this.current === this.target ? 1 : clamp01(this.transitionTimerMs / WEATHER_TRANSITION_MS);
    const t = quinticSmooth(rawT);

    const rainWeight =
      (this.current === 'rain' ? 1 - t : 0) + (this.target === 'rain' ? t : 0);
    const snowWeight =
      (this.current === 'snow' ? 1 - t : 0) + (this.target === 'snow' ? t : 0);

    return {
      currentWeather: this.current,
      targetWeather: this.target,
      transitionProgress: rawT,
      fogNearRatio: lerp(from.fogNearRatio, to.fogNearRatio, t),
      fogFarRatio: lerp(from.fogFarRatio, to.fogFarRatio, t),
      fogColorTint: lerp3(from.fogColorTint, to.fogColorTint, t),
      sunIntensityMultiplier: lerp(from.sunIntensityMultiplier, to.sunIntensityMultiplier, t),
      sunShadowMultiplier: lerp(from.sunShadowMultiplier, to.sunShadowMultiplier, t),
      sunColorTint: lerp3(from.sunColorTint, to.sunColorTint, t),
      hemiIntensityMultiplier: lerp(from.hemiIntensityMultiplier, to.hemiIntensityMultiplier, t),
      hemiColorTint: lerp3(from.hemiColorTint, to.hemiColorTint, t),
      cloudCoverageBonus: lerp(from.cloudCoverageBonus, to.cloudCoverageBonus, t),
      cloudDarkness: lerp(from.cloudDarkness, to.cloudDarkness, t),
      sunVisibility: lerp(from.sunVisibility, to.sunVisibility, t),
      skyColorTint: lerp3(from.skyColorTint, to.skyColorTint, t),
      wetness: this.wetness,
      snowCover: this.snowCover,
      rainIntensity: clamp01(rainWeight),
      snowIntensity: clamp01(snowWeight),
    };
  }

  /** Forces a specific weather type immediately or with a smooth crossfade. */
  setWeather(target: WeatherType, immediate = false): void {
    if (immediate) {
      this.current = target;
      this.target = target;
      this.transitionTimerMs = 0;
    } else {
      this.target = target;
      this.transitionTimerMs = 0;
    }
  }

  getCurrentWeather(): WeatherType {
    return this.current;
  }

  getTargetWeather(): WeatherType {
    return this.target;
  }

  getWetness(): number {
    return this.wetness;
  }

  getSnowCover(): number {
    return this.snowCover;
  }

  /**
   * Deterministically samples the next weather type according to seasonal weights.
   */
  private sampleNextWeather(season: Season, cycle: number): WeatherType {
    const rng = mulberry32(this.baseSeed ^ (cycle * 0x9e3779b9));
    const weights = SEASON_WEATHER_WEIGHTS[season];
    const roll = rng();

    let cumulative = 0;
    for (const type of ALL_WEATHER_TYPES) {
      cumulative += weights[type];
      if (roll < cumulative) {
        return type;
      }
    }
    return 'clear';
  }
}
