/**
 * Dynamic Precipitation System (Phase 2): Rain & Snow.
 *
 * Renders rain streaks and drifting snowflakes using GPU-friendly InstancedMesh
 * volumes anchored around the camera target/focus point.
 *
 * Rules:
 *  - [R-render-001] InstancedMesh bucket per kind (one for rain, one for snow).
 *  - [R-render-005] No custom shaders; stock materials with transparency.
 *  - [R-render-009] frustumCulled = false (instances move every frame).
 *  - [R-render-011] Transforms written per frame; zero runtime particle engine allocations.
 *  - [R-render-012] Local mulberry32 PRNG — zero Math.random / Date.now.
 */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Tuning Parameters — Rain
// ---------------------------------------------------------------------------

/** Total instanced rain streaks in the pool. */
export const RAIN_INSTANCE_COUNT = 2400;
/** Half-width of the rain volume box (meters) centered on camera focus. */
export const RAIN_BOX_RADIUS = 95;
/** Vertical height of the rain volume box (meters). */
export const RAIN_BOX_HEIGHT = 50;
/** Downward terminal velocity of raindrops (meters per second). */
export const RAIN_FALL_SPEED = 32.0;
/** Horizontal wind drift speed for rain (meters per second). */
export const RAIN_WIND_SPEED = 4.8;
/** Shared wind direction angle in radians (aligned with clouds.ts). */
export const PRECIPITATION_WIND_DIRECTION = 0.62;
/** Maximum opacity of rain streaks at 100% rainIntensity. */
export const RAIN_MAX_OPACITY = 0.55;
/** Length of each individual rain streak (meters). */
export const RAIN_STREAK_LENGTH = 1.35;
/** Width/thickness of each rain streak (meters). */
export const RAIN_STREAK_WIDTH = 0.032;
/** Hex tint of the rain streaks. */
export const RAIN_COLOR = 0xb4d0eb;

// ---------------------------------------------------------------------------
// Tuning Parameters — Snow
// ---------------------------------------------------------------------------

/** Total instanced snowflakes in the pool. */
export const SNOW_INSTANCE_COUNT = 1600;
/** Half-width of the snow volume box (meters) centered on camera focus. */
export const SNOW_BOX_RADIUS = 85;
/** Vertical height of the snow volume box (meters). */
export const SNOW_BOX_HEIGHT = 45;
/** Gentle downward fall velocity of snowflakes (meters per second). */
export const SNOW_FALL_SPEED = 2.4;
/** Horizontal wind drift speed for snow (meters per second). */
export const SNOW_WIND_SPEED = 1.6;
/** Lateral flutter wobble speed (radians per second). */
export const SNOW_WOBBLE_FREQUENCY = 2.4;
/** Maximum lateral drift distance during snowflake flutter (meters). */
export const SNOW_WOBBLE_AMPLITUDE = 0.45;
/** Maximum opacity of snowflakes at 100% snowIntensity. */
export const SNOW_MAX_OPACITY = 0.85;
/** Geometric size/radius of each snowflake (meters). */
export const SNOW_FLAKE_SIZE = 0.18;
/** Hex tint of the snowflakes. */
export const SNOW_COLOR = 0xf5f8ff;

// Fixed PRNG seeds (Rule [R-render-012])
const RAIN_PRNG_SEED = 0x5241494e; // 'RAIN'
const SNOW_PRNG_SEED = 0x534e4f57; // 'SNOW'

// ---------------------------------------------------------------------------
// Math & PRNG
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Positive-only modulo wrapping for seamless toroidal volume wrapping. */
function modWrap(value: number, span: number): number {
  return ((value % span) + span) % span;
}

// Pre-allocated scratch objects to ensure zero per-frame allocation
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);

// ---------------------------------------------------------------------------
// Particle State Arrays
// ---------------------------------------------------------------------------

interface RainParticle {
  seedX: number;
  seedY: number;
  seedZ: number;
  speedMult: number;
}

interface SnowParticle {
  seedX: number;
  seedY: number;
  seedZ: number;
  speedMult: number;
  wobblePhase: number;
  wobbleSpeed: number;
  scaleMult: number;
}

// ---------------------------------------------------------------------------
// PrecipitationRenderer
// ---------------------------------------------------------------------------

export class PrecipitationRenderer {
  private readonly rainMesh: THREE.InstancedMesh;
  private readonly rainMaterial: THREE.MeshBasicMaterial;
  private readonly rainParticles: RainParticle[];

  private readonly snowMesh: THREE.InstancedMesh;
  private readonly snowMaterial: THREE.MeshBasicMaterial;
  private readonly snowParticles: SnowParticle[];

  private elapsedSeconds = 0;

  constructor(scene: THREE.Scene) {
    // 1. Build Rain InstancedMesh
    // Slanted geometry oriented along falling trajectory + wind drift
    const windVecX = Math.cos(PRECIPITATION_WIND_DIRECTION) * RAIN_WIND_SPEED;
    const windVecZ = Math.sin(PRECIPITATION_WIND_DIRECTION) * RAIN_WIND_SPEED;
    const slantPitch = Math.atan2(Math.hypot(windVecX, windVecZ), RAIN_FALL_SPEED);
    const slantYaw = Math.atan2(windVecX, windVecZ);

    const rainGeo = new THREE.CylinderGeometry(
      RAIN_STREAK_WIDTH * 0.4,
      RAIN_STREAK_WIDTH,
      RAIN_STREAK_LENGTH,
      4,
    );
    // Rotate geometry so it tilts with wind direction natively
    rainGeo.rotateX(slantPitch);
    rainGeo.rotateY(slantYaw);

    this.rainMaterial = new THREE.MeshBasicMaterial({
      color: RAIN_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: true,
    });

    this.rainMesh = new THREE.InstancedMesh(rainGeo, this.rainMaterial, RAIN_INSTANCE_COUNT);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.matrixAutoUpdate = false;
    this.rainMesh.visible = false;
    this.rainMesh.userData['underground'] = 'keep';
    scene.add(this.rainMesh);

    // Initialize rain particle offsets
    const rainRng = mulberry32(RAIN_PRNG_SEED);
    this.rainParticles = new Array<RainParticle>(RAIN_INSTANCE_COUNT);
    for (let i = 0; i < RAIN_INSTANCE_COUNT; i++) {
      this.rainParticles[i] = {
        seedX: (rainRng() * 2 - 1) * RAIN_BOX_RADIUS,
        seedY: rainRng() * RAIN_BOX_HEIGHT,
        seedZ: (rainRng() * 2 - 1) * RAIN_BOX_RADIUS,
        speedMult: 0.85 + rainRng() * 0.3, // ±15% individual speed variation
      };
    }

    // 2. Build Snow InstancedMesh
    const snowGeo = new THREE.OctahedronGeometry(SNOW_FLAKE_SIZE, 0);

    this.snowMaterial = new THREE.MeshBasicMaterial({
      color: SNOW_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: true,
    });

    this.snowMesh = new THREE.InstancedMesh(snowGeo, this.snowMaterial, SNOW_INSTANCE_COUNT);
    this.snowMesh.frustumCulled = false;
    this.snowMesh.matrixAutoUpdate = false;
    this.snowMesh.visible = false;
    this.snowMesh.userData['underground'] = 'keep';
    scene.add(this.snowMesh);

    // Initialize snow particle offsets
    const snowRng = mulberry32(SNOW_PRNG_SEED);
    this.snowParticles = new Array<SnowParticle>(SNOW_INSTANCE_COUNT);
    for (let i = 0; i < SNOW_INSTANCE_COUNT; i++) {
      this.snowParticles[i] = {
        seedX: (snowRng() * 2 - 1) * SNOW_BOX_RADIUS,
        seedY: snowRng() * SNOW_BOX_HEIGHT,
        seedZ: (snowRng() * 2 - 1) * SNOW_BOX_RADIUS,
        speedMult: 0.8 + snowRng() * 0.4,
        wobblePhase: snowRng() * Math.PI * 2,
        wobbleSpeed: SNOW_WOBBLE_FREQUENCY * (0.8 + snowRng() * 0.4),
        scaleMult: 0.7 + snowRng() * 0.6,
      };
    }
  }

  /**
   * Updates precipitation positions and opacities centered on the camera focus point.
   * Call every frame in the main animation loop.
   */
  update(
    dtMs: number,
    focusX: number,
    focusGroundY: number,
    focusZ: number,
    rainIntensity: number,
    snowIntensity: number,
  ): void {
    const dtSeconds = Math.max(0, dtMs) / 1000;
    this.elapsedSeconds += dtSeconds;

    // --- Rain Update ---
    if (rainIntensity > 0.001) {
      this.rainMesh.visible = true;
      this.rainMaterial.opacity = rainIntensity * RAIN_MAX_OPACITY;

      const windDx = Math.cos(PRECIPITATION_WIND_DIRECTION) * RAIN_WIND_SPEED;
      const windDz = Math.sin(PRECIPITATION_WIND_DIRECTION) * RAIN_WIND_SPEED;
      const boxSpanXZ = RAIN_BOX_RADIUS * 2;

      for (let i = 0; i < RAIN_INSTANCE_COUNT; i++) {
        const p = this.rainParticles[i]!;
        const speed = RAIN_FALL_SPEED * p.speedMult;

        // Fall downward and drift with wind
        const localY = modWrap(p.seedY - this.elapsedSeconds * speed, RAIN_BOX_HEIGHT);
        const driftX = this.elapsedSeconds * windDx * p.speedMult;
        const driftZ = this.elapsedSeconds * windDz * p.speedMult;

        const localX = modWrap(p.seedX + driftX + RAIN_BOX_RADIUS, boxSpanXZ) - RAIN_BOX_RADIUS;
        const localZ = modWrap(p.seedZ + driftZ + RAIN_BOX_RADIUS, boxSpanXZ) - RAIN_BOX_RADIUS;

        _position.set(focusX + localX, focusGroundY + localY, focusZ + localZ);
        _matrix.compose(_position, _quaternion, _scale);
        this.rainMesh.setMatrixAt(i, _matrix);
      }
      this.rainMesh.instanceMatrix.needsUpdate = true;
    } else {
      this.rainMesh.visible = false;
    }

    // --- Snow Update ---
    if (snowIntensity > 0.001) {
      this.snowMesh.visible = true;
      this.snowMaterial.opacity = snowIntensity * SNOW_MAX_OPACITY;

      const windDx = Math.cos(PRECIPITATION_WIND_DIRECTION) * SNOW_WIND_SPEED;
      const windDz = Math.sin(PRECIPITATION_WIND_DIRECTION) * SNOW_WIND_SPEED;
      const boxSpanXZ = SNOW_BOX_RADIUS * 2;

      for (let i = 0; i < SNOW_INSTANCE_COUNT; i++) {
        const p = this.snowParticles[i]!;
        const speed = SNOW_FALL_SPEED * p.speedMult;

        const localY = modWrap(p.seedY - this.elapsedSeconds * speed, SNOW_BOX_HEIGHT);
        const driftX = this.elapsedSeconds * windDx;
        const driftZ = this.elapsedSeconds * windDz;

        // Lateral flutter wobble
        const wobble = Math.sin(this.elapsedSeconds * p.wobbleSpeed + p.wobblePhase);
        const flutterX = wobble * SNOW_WOBBLE_AMPLITUDE;
        const flutterZ = Math.cos(this.elapsedSeconds * p.wobbleSpeed * 0.8) * SNOW_WOBBLE_AMPLITUDE;

        const localX =
          modWrap(p.seedX + driftX + flutterX + SNOW_BOX_RADIUS, boxSpanXZ) - SNOW_BOX_RADIUS;
        const localZ =
          modWrap(p.seedZ + driftZ + flutterZ + SNOW_BOX_RADIUS, boxSpanXZ) - SNOW_BOX_RADIUS;

        _position.set(focusX + localX, focusGroundY + localY, focusZ + localZ);
        _scale.setScalar(p.scaleMult);
        _matrix.compose(_position, _quaternion, _scale);
        this.snowMesh.setMatrixAt(i, _matrix);
      }
      _scale.set(1, 1, 1); // Reset scratch scale
      this.snowMesh.instanceMatrix.needsUpdate = true;
    } else {
      this.snowMesh.visible = false;
    }
  }

  /** Current visibility of the rain mesh. */
  isRaining(): boolean {
    return this.rainMesh.visible;
  }

  /** Current visibility of the snow mesh. */
  isSnowing(): boolean {
    return this.snowMesh.visible;
  }
}
