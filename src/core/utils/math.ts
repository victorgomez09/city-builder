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
