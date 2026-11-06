/**
 * Utilidades matemáticas y vectoriales desacopladas para simulación y render.
 * Zero-allocation en bucles continuos.
 */

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const TAU = Math.PI * 2;

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const clamp01 = (v: number): number =>
  v < 0 ? 0 : v > 1 ? 1 : v;

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

export const inverseLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : (v - a) / (b - a);

export const remap = (v: number, a: number, b: number, c: number, d: number): number =>
  lerp(c, d, clamp01(inverseLerp(a, b, v)));

export const smoothstep = (min: number, max: number, v: number): number => {
  const t = clamp01((v - min) / (max - min));
  return t * t * (3 - 2 * t);
};

export const smootherstep = (min: number, max: number, v: number): number => {
  const t = clamp01((v - min) / (max - min));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Amortiguación exponencial independiente del framerate. */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Amortiguación angular sin problemas de discontinuidad en 2*PI. */
export const dampAngle = (current: number, target: number, lambda: number, dt: number): number => {
  let delta = ((target - current + Math.PI) % TAU) - Math.PI;
  if (delta < -Math.PI) delta += TAU;
  return current + delta * (1 - Math.exp(-lambda * dt));
};

export const wrapAngle = (a: number): number => {
  let res = a % TAU;
  if (res > Math.PI) res -= TAU;
  if (res < -Math.PI) res += TAU;
  return res;
};

export const fract = (v: number): number => v - Math.floor(v);
export const mod = (a: number, n: number): number => ((a % n) + n) % n;

/**
 * Vector 2D inmutable/operacional de alto rendimiento para lógica de simulación desacoplada.
 * Evita dependencias de Three.js en la capa core.
 */
export class Vec2 {
  constructor(public x: number = 0, public y: number = 0) {}

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(other: Vec2): this {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  add(other: Vec2): this {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  sub(other: Vec2): this {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  scale(factor: number): this {
    this.x *= factor;
    this.y *= factor;
    return this;
  }

  distanceSquared(other: Vec2): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return dx * dx + dy * dy;
  }

  distance(other: Vec2): number {
    return Math.sqrt(this.distanceSquared(other));
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }
}
