import { describe, expect, it } from 'vitest';
import {
  DEEP_WATER_COLOR,
  depthColor,
  foamStrength,
  fouledColor,
  foulMix,
  glancingOpacity,
  glintScale,
  glintSpecular,
  reflectedColor,
  SHALLOW_WATER_COLOR,
  SHORELINE_FOAM_DEPTH_M,
  swellHeight,
  SWELL_AMPLITUDE_BUDGET_M,
  waveNormalTilt,
} from './water';

describe('water pure calculations', () => {
  it('depthColor interpolates between shallow turquoise and deep navy', () => {
    const shallow = depthColor(0);
    expect(shallow[0]).toBeCloseTo(SHALLOW_WATER_COLOR[0], 2);
    expect(shallow[1]).toBeCloseTo(SHALLOW_WATER_COLOR[1], 2);
    expect(shallow[2]).toBeCloseTo(SHALLOW_WATER_COLOR[2], 2);

    const deep = depthColor(12); // MAX_WATER_DEPTH_VIS
    expect(deep[0]).toBeCloseTo(DEEP_WATER_COLOR[0], 2);
    expect(deep[1]).toBeCloseTo(DEEP_WATER_COLOR[1], 2);
    expect(deep[2]).toBeCloseTo(DEEP_WATER_COLOR[2], 2);

    const mid = depthColor(6);
    expect(mid[0]).toBeGreaterThan(deep[0]);
    expect(mid[0]).toBeLessThan(shallow[0]);
  });

  it('fouledColor mixes toward murky brown based on square root of foul', () => {
    const clean = fouledColor(5, 0);
    const expectedClean = depthColor(5);
    expect(clean).toEqual(expectedClean);

    expect(foulMix(0.25)).toBeCloseTo(0.5, 4);
    const fouled = fouledColor(5, 1);
    expect(fouled[0]).toBeCloseTo(0.36, 2);
    expect(fouled[1]).toBeCloseTo(0.28, 2);
    expect(fouled[2]).toBeCloseTo(0.14, 2);
  });

  it('swellHeight remains bounded within amplitude budget', () => {
    for (let t = 0; t < 10; t += 1.5) {
      for (let x = -100; x <= 100; x += 50) {
        for (let z = -100; z <= 100; z += 50) {
          const h = swellHeight(x, z, t);
          expect(Math.abs(h)).toBeLessThanOrEqual(SWELL_AMPLITUDE_BUDGET_M + 1e-4);
        }
      }
    }
  });

  it('waveNormalTilt returns non-zero bounded vectors', () => {
    const [tx, tz] = waveNormalTilt(10, 20, 1.0);
    expect(Number.isFinite(tx)).toBe(true);
    expect(Number.isFinite(tz)).toBe(true);
    expect(Math.hypot(tx, tz)).toBeLessThan(0.5);
  });

  it('glancingOpacity transitions from grazing to normal incidence', () => {
    const grazing = glancingOpacity(0);
    const normal = glancingOpacity(1);
    expect(grazing).toBeCloseTo(0.95, 2);
    expect(normal).toBeCloseTo(0.62, 2);
    expect(grazing).toBeGreaterThan(normal);
  });

  it('reflectedColor blends sky horizon and zenith according to fresnel curve', () => {
    const zenith: [number, number, number] = [0.2, 0.4, 0.8];
    const horizon: [number, number, number] = [0.8, 0.9, 1.0];
    const waterBase = depthColor(5);

    const straightDown = reflectedColor(1, waterBase, zenith, horizon);
    expect(straightDown[0]).toBeCloseTo(waterBase[0], 2);
    expect(straightDown[1]).toBeCloseTo(waterBase[1], 2);
    expect(straightDown[2]).toBeCloseTo(waterBase[2], 2);

    const grazing = reflectedColor(0, waterBase, zenith, horizon);
    expect(grazing[0]).toBeCloseTo(horizon[0], 2);
  });

  it('foamStrength handles shoreline depth limit, tidal surge and crest pulsing', () => {
    // Deep water has zero foam
    expect(foamStrength(SHORELINE_FOAM_DEPTH_M + 2.0, 0, 0, 0)).toBe(0);

    // Shallow shoreline has positive foam
    const shallowFoam = foamStrength(0.1, 50, 50, 2.0);
    expect(shallowFoam).toBeGreaterThanOrEqual(0);
    expect(shallowFoam).toBeLessThanOrEqual(0.65);
  });

  it('glintScale scales from full day to night moon fraction', () => {
    expect(glintScale(0)).toBeCloseTo(1.0, 3);
    expect(glintScale(1)).toBeCloseTo(0.2, 3);
  });

  it('glintSpecular creates distinct highlights for direct specular alignment', () => {
    const directHit = glintSpecular(1.0);
    const glancingHit = glintSpecular(0.5);
    const away = glintSpecular(0.0);

    expect(directHit).toBeGreaterThan(glancingHit);
    expect(glancingHit).toBeGreaterThan(away);
    expect(away).toBe(0);
  });
});
