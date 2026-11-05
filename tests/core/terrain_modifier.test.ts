import { describe, it, expect } from 'vitest';
import { TerrainModifier, TerraformTool, BrushSettings } from '@core/terrain/terrain_modifier';

describe('TerrainModifier (Procedural Heightfield Deformation)', () => {
  const width = 10;
  const height = 10;
  const cellSize = 2.0;

  it('debe elevar el terreno suavemente en el centro de la brocha', () => {
    const heights = new Float32Array((width + 1) * (height + 1));
    const settings: BrushSettings = {
      tool: TerraformTool.RAISE,
      radius: 4.0,
      strength: 2.0,
      targetHeight: 5.0,
    };

    // Aplicar brocha en el centro del mundo (0, 0)
    const bounds = TerrainModifier.applyBrush(
      heights,
      width,
      height,
      cellSize,
      0,
      0,
      settings,
      1.0
    );

    expect(bounds).not.toBeNull();
    const centerIdx = 5 * (width + 1) + 5;
    expect(heights[centerIdx]).toBeGreaterThan(1.5);
  });

  it('debe allanar el terreno hacia una altura objetivo (FLATTEN)', () => {
    const heights = new Float32Array((width + 1) * (height + 1));
    heights.fill(10.0); // Terreno inicialmente a 10m de altura

    const settings: BrushSettings = {
      tool: TerraformTool.FLATTEN,
      radius: 4.0,
      strength: 5.0,
      targetHeight: 3.0,
    };

    TerrainModifier.applyBrush(heights, width, height, cellSize, 0, 0, settings, 1.0);
    const centerIdx = 5 * (width + 1) + 5;
    expect(heights[centerIdx]).toBeCloseTo(3.0, 0.5);
  });

  it('no debe deformar si la herramienta es NONE', () => {
    const heights = new Float32Array((width + 1) * (height + 1));
    const settings: BrushSettings = {
      tool: TerraformTool.NONE,
      radius: 4.0,
      strength: 2.0,
      targetHeight: 0,
    };

    const res = TerrainModifier.applyBrush(heights, width, height, cellSize, 0, 0, settings, 1.0);
    expect(res).toBeNull();
  });
});
