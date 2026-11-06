import { describe, it, expect } from 'vitest';
import { PRNG } from '@core/utils/prng';
import { Vec2, clamp, lerp, smoothstep, damp } from '@core/utils/math';
import { ObjectPool } from '@core/utils/pool';
import { SimplexNoise } from '@core/utils/noise';

describe('PRNG (Mulberry32)', () => {
  it('debe producir secuencias idénticas para una misma semilla', () => {
    const seed = 42;
    const rng1 = new PRNG(seed);
    const rng2 = new PRNG(seed);

    for (let i = 0; i < 100; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('debe restaurar y persistir el estado interno deterministamente', () => {
    const rng = new PRNG(12345);
    for (let i = 0; i < 10; i++) rng.next();

    const savedState = rng.getState();
    const val1 = rng.next();

    rng.setState(savedState);
    const val2 = rng.next();

    expect(val1).toBe(val2);
  });

  it('debe generar enteros dentro del rango exacto', () => {
    const rng = new PRNG(999);
    for (let i = 0; i < 50; i++) {
      const val = rng.rangeInt(5, 10);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(10);
    }
  });
});

describe('Vec2 Math', () => {
  it('debe realizar sumas, restas y distancias correctamente', () => {
    const v1 = new Vec2(3, 4);
    const v2 = new Vec2(0, 0);

    expect(v1.distance(v2)).toBe(5);
    expect(v1.distanceSquared(v2)).toBe(25);

    v1.add(new Vec2(1, 2));
    expect(v1.x).toBe(4);
    expect(v1.y).toBe(6);
  });
});

describe('ObjectPool', () => {
  it('debe reciclar objetos sin crear instancias nuevas una vez liberadas', () => {
    const pool = new ObjectPool<Vec2>(
      () => new Vec2(),
      (v) => v.set(0, 0),
      5
    );

    expect(pool.size).toBe(5);
    const obj1 = pool.acquire();
    expect(pool.size).toBe(4);

    obj1.set(10, 20);
    pool.release(obj1);

    expect(pool.size).toBe(5);
    const obj2 = pool.acquire();
    expect(obj2).toBe(obj1);
    expect(obj2.x).toBe(0);
    expect(obj2.y).toBe(0);
  });
});

describe('Scalar Math & Damping', () => {
  it('debe calcular clamp, lerp y smoothstep correctamente', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(5, 0, 10)).toBe(5);

    expect(lerp(10, 20, 0.5)).toBe(15);
    expect(smoothstep(0, 10, 5)).toBe(0.5);
  });

  it('debe amortiguar suavemente hacia el target con damp', () => {
    const cur = 0;
    const target = 100;
    const nextVal = damp(cur, target, 10, 0.05);
    expect(nextVal).toBeGreaterThan(0);
    expect(nextVal).toBeLessThan(100);
  });
});

describe('SimplexNoise', () => {
  it('debe ser determinista con la misma semilla', () => {
    const n1 = new SimplexNoise(1234);
    const n2 = new SimplexNoise(1234);

    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        expect(n1.noise2D(x * 0.1, y * 0.1)).toBeCloseTo(n2.noise2D(x * 0.1, y * 0.1), 6);
        expect(n1.fbm2D(x * 0.2, y * 0.2)).toBeCloseTo(n2.fbm2D(x * 0.2, y * 0.2), 6);
      }
    }
  });

  it('debe mantenerse dentro de los rangos acotados [-1, 1] y [0, 1]', () => {
    const noise = new SimplexNoise(999);
    for (let i = 0; i < 20; i++) {
      const val2D = noise.noise2D(i * 1.7, i * 2.3);
      expect(val2D).toBeGreaterThanOrEqual(-1.5);
      expect(val2D).toBeLessThanOrEqual(1.5);

      const ridged = noise.ridged2D(i * 0.5, i * 0.5);
      expect(ridged).toBeGreaterThanOrEqual(0);
      expect(ridged).toBeLessThanOrEqual(1.0);
    }
  });
});
