import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { computeEffectivePixelRatio, createWorldScene } from './scene';
import { DEFAULT_SETTINGS } from '../app/session';

describe('Graphics Settings and Resolution Scaling', () => {
  it('has consistent default graphics settings', () => {
    expect(DEFAULT_SETTINGS.graphicsPreset).toBe('high');
    expect(DEFAULT_SETTINGS.resolutionScale).toBe('native');
    expect(DEFAULT_SETTINGS.shadowQuality).toBe('high');
    expect(DEFAULT_SETTINGS.antiAliasing).toBe('msaa4x');
    expect(DEFAULT_SETTINGS.anisotropicFiltering).toBe('16x');
    expect(DEFAULT_SETTINGS.clouds).toBe('high');
    expect(DEFAULT_SETTINGS.vehicleLights).toBe(true);
    expect(DEFAULT_SETTINGS.weatherEffects).toBe(true);
    expect(DEFAULT_SETTINGS.terrainQuality).toBe('high');
    expect(DEFAULT_SETTINGS.bloom).toBe(true);
  });

  it('computes native pixel ratio clamped to device Dpr or 2.0', () => {
    // 1080p display at 1.0 DPR
    const dpr1 = computeEffectivePixelRatio('native', 'msaa4x', 1920, 1080, 1.0);
    expect(dpr1).toBe(1.0);

    // Retina display at 2.0 DPR
    const dpr2 = computeEffectivePixelRatio('native', 'msaa4x', 1920, 1080, 2.0);
    expect(dpr2).toBe(2.0);

    // High-DPI display at 3.0 DPR (capped at 2.0 for standard performance)
    const dpr3 = computeEffectivePixelRatio('native', 'msaa4x', 1920, 1080, 3.0);
    expect(dpr3).toBe(2.0);
  });

  it('computes pixel ratios across all anti-aliasing modes', () => {
    // Off: 1.0
    expect(computeEffectivePixelRatio('native', 'off', 1920, 1080, 2.0)).toBe(1.0);

    // MSAA 2x: capped at 1.5
    expect(computeEffectivePixelRatio('native', 'msaa2x', 1920, 1080, 2.0)).toBe(1.5);

    // MSAA 4x: capped at 2.0
    expect(computeEffectivePixelRatio('native', 'msaa4x', 1920, 1080, 2.0)).toBe(2.0);

    // MSAA 8x: permits up to 2.5
    expect(computeEffectivePixelRatio('native', 'msaa8x', 1920, 1080, 2.5)).toBe(2.5);
  });

  it('computes 4K SSAA supersampling ratio accurately', () => {
    // On a 1080p container (1920x1080), targeting 3840x2160 requires 2.0x DPR
    const ssaa1080p = computeEffectivePixelRatio('native', 'ssaa4k', 1920, 1080, 1.0);
    expect(ssaa1080p).toBe(2.0);

    // On a 720p container (1280x720), targeting 3840x2160 requires 3.0x DPR
    const ssaa720p = computeEffectivePixelRatio('native', 'ssaa4k', 1280, 720, 1.0);
    expect(ssaa720p).toBe(3.0);

    // When resolutionScale is explicitly '4k'
    const res4k = computeEffectivePixelRatio('4k', 'msaa4x', 1920, 1080, 1.0);
    expect(res4k).toBe(2.0);
  });

  it('computes target ratios for 1440p and 1080p resolution scales', () => {
    // Container at 1080p requesting 1440p
    const qhd = computeEffectivePixelRatio('1440p', 'msaa4x', 1920, 1080, 1.0);
    expect(qhd).toBeCloseTo(1440 / 1080, 2);

    // Container at 1440p requesting 1080p (downscale for performance)
    const fhd = computeEffectivePixelRatio('1080p', 'msaa4x', 2560, 1440, 1.0);
    expect(fhd).toBeCloseTo(1080 / 1440, 2);
  });

  it('updates shadow quality and map resolution on WorldScene', () => {
    const world = createWorldScene();
    const sun = world.scene.children.find((c) => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight;
    expect(sun).toBeDefined();

    // Default is 4096 high quality
    expect(sun.castShadow).toBe(true);
    expect(sun.shadow.mapSize.x).toBe(4096);

    // Switch to low quality (1024)
    world.setShadowQuality('low');
    expect(sun.castShadow).toBe(true);
    expect(sun.shadow.mapSize.x).toBe(1024);
    expect(sun.shadow.mapSize.y).toBe(1024);

    // Switch to medium quality (2048)
    world.setShadowQuality('medium');
    expect(sun.castShadow).toBe(true);
    expect(sun.shadow.mapSize.x).toBe(2048);

    // Switch to off (disables castShadow)
    world.setShadowQuality('off');
    expect(sun.castShadow).toBe(false);

    // Switch back to ultra (4096)
    world.setShadowQuality('ultra');
    expect(sun.castShadow).toBe(true);
    expect(sun.shadow.mapSize.x).toBe(4096);
  });
});
