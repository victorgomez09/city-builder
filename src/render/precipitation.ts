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
export const RAIN_INSTANCE_COUNT = 4096;
/** Half-width of the rain volume box (meters) centered on camera focus. */
export const RAIN_BOX_RADIUS = 320;
/** Vertical height of the rain volume box (meters). */
export const RAIN_BOX_HEIGHT = 150;
/** Downward terminal velocity of raindrops (meters per second). */
export const RAIN_FALL_SPEED = 42.0;
/** Horizontal wind drift speed for rain (meters per second). */
export const RAIN_WIND_SPEED = 5.2;
/** Shared wind direction angle in radians (aligned with clouds.ts). */
export const PRECIPITATION_WIND_DIRECTION = 0.62;
/** Maximum opacity of rain streaks at 100% rainIntensity. */
export const RAIN_MAX_OPACITY = 0.65;
/** Length of each individual rain streak (meters). */
export const RAIN_STREAK_LENGTH = 3.2;
/** Width/thickness of each rain streak (meters). */
export const RAIN_STREAK_WIDTH = 0.14;
/** Hex tint of the rain streaks. */
export const RAIN_COLOR = 0xb4d0eb;

// ---------------------------------------------------------------------------
// Tuning Parameters — Snow
// ---------------------------------------------------------------------------

/** Total instanced snowflakes in the pool. */
export const SNOW_INSTANCE_COUNT = 3200;
/** Half-width of the snow volume box (meters) centered on camera focus. */
export const SNOW_BOX_RADIUS = 300;
/** Vertical height of the snow volume box (meters). */
export const SNOW_BOX_HEIGHT = 140;
/** Gentle downward fall velocity of snowflakes (meters per second). */
export const SNOW_FALL_SPEED = 3.6;
/** Horizontal wind drift speed for snow (meters per second). */
export const SNOW_WIND_SPEED = 2.2;
/** Lateral flutter wobble speed (radians per second). */
export const SNOW_WOBBLE_FREQUENCY = 2.4;
/** Maximum lateral drift distance during snowflake flutter (meters). */
export const SNOW_WOBBLE_AMPLITUDE = 0.7;
/** Maximum opacity of snowflakes at 100% snowIntensity. */
export const SNOW_MAX_OPACITY = 0.85;
/** Geometric size/radius of each snowflake (meters). */
export const SNOW_FLAKE_SIZE = 0.42;
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

        // Unbounded world-space trajectory
        const driftX = this.elapsedSeconds * windDx * p.speedMult;
        const driftZ = this.elapsedSeconds * windDz * p.speedMult;
        const fallY = this.elapsedSeconds * speed;

        const unboundedX = p.seedX + driftX;
        const unboundedZ = p.seedZ + driftZ;
        const unboundedY = p.seedY - fallY;

        // Toroidal wrap relative to focus: particles stay fixed in world space
        // while the toroidal bounds track the camera view
        const relX = unboundedX - focusX;
        const relZ = unboundedZ - focusZ;
        const relY = unboundedY - focusGroundY;

        const wrappedX = modWrap(relX + RAIN_BOX_RADIUS, boxSpanXZ) - RAIN_BOX_RADIUS;
        const wrappedZ = modWrap(relZ + RAIN_BOX_RADIUS, boxSpanXZ) - RAIN_BOX_RADIUS;
        const wrappedY = modWrap(relY + 20, RAIN_BOX_HEIGHT) - 20;

        _position.set(focusX + wrappedX, focusGroundY + wrappedY, focusZ + wrappedZ);
        _matrix.setPosition(_position);
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

        const driftX = this.elapsedSeconds * windDx;
        const driftZ = this.elapsedSeconds * windDz;
        const fallY = this.elapsedSeconds * speed;

        // Lateral flutter wobble
        const wobble = Math.sin(this.elapsedSeconds * p.wobbleSpeed + p.wobblePhase);
        const flutterX = wobble * SNOW_WOBBLE_AMPLITUDE;
        const flutterZ = Math.cos(this.elapsedSeconds * p.wobbleSpeed * 0.8) * SNOW_WOBBLE_AMPLITUDE;

        const unboundedX = p.seedX + driftX + flutterX;
        const unboundedZ = p.seedZ + driftZ + flutterZ;
        const unboundedY = p.seedY - fallY;

        const relX = unboundedX - focusX;
        const relZ = unboundedZ - focusZ;
        const relY = unboundedY - focusGroundY;

        const wrappedX = modWrap(relX + SNOW_BOX_RADIUS, boxSpanXZ) - SNOW_BOX_RADIUS;
        const wrappedZ = modWrap(relZ + SNOW_BOX_RADIUS, boxSpanXZ) - SNOW_BOX_RADIUS;
        const wrappedY = modWrap(relY + 20, SNOW_BOX_HEIGHT) - 20;

        _position.set(focusX + wrappedX, focusGroundY + wrappedY, focusZ + wrappedZ);
        _matrix.makeScale(p.scaleMult, p.scaleMult, p.scaleMult);
        _matrix.setPosition(_position);
        this.snowMesh.setMatrixAt(i, _matrix);
      }
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
