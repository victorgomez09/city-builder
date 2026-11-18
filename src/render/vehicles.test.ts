import { describe, expect, it } from 'vitest';
import {
  buildVehicleRoadLightGeometry,
  LANE_OFFSET_METERS,
  laneOffset,
  lerpVehicle,
  snapshotAlpha,
  VEHICLE_NIGHT_LIGHT_THRESHOLD,
} from './vehicles';

describe('vehicle night lights and kinematics', () => {
  it('buildVehicleRoadLightGeometry generates valid headlight and taillight quads', () => {
    const geo = buildVehicleRoadLightGeometry();
    const pos = geo.getAttribute('position');
    const col = geo.getAttribute('color');
    const index = geo.getIndex();

    expect(pos).toBeDefined();
    expect(col).toBeDefined();
    expect(index).toBeDefined();
    expect(pos.count).toBe(24);
    expect(index!.count).toBe(72); // 24 triangles * 3 indices

    // Positions should be positioned near ground (y ≈ -0.478)
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getY(i)).toBeCloseTo(-0.478, 3);
    }

    // Headlight front should project forward past z=3.5
    let maxZ = -Infinity;
    let minZ = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      if (z > maxZ) maxZ = z;
      if (z < minZ) minZ = z;
    }
    expect(maxZ).toBeGreaterThan(3.5);
    expect(minZ).toBeLessThan(-1.2);

    // Tip of headlight and tail of taillight should fade to black
    expect(col.getX(12)).toBe(0); // far tip of headlight
    expect(col.getY(12)).toBe(0);
    expect(col.getZ(12)).toBe(0);
  });

  it('laneOffset shifts vehicles to the right of travel heading', () => {
    // Heading 0 faces +Z (south) -> right is -X (west)
    const south = laneOffset(0);
    expect(south.dx).toBeCloseTo(-LANE_OFFSET_METERS, 3);
    expect(south.dz).toBeCloseTo(0, 3);

    // Heading PI faces -Z (north) -> right is +X (east)
    const north = laneOffset(Math.PI);
    expect(north.dx).toBeCloseTo(LANE_OFFSET_METERS, 3);
    expect(north.dz).toBeCloseTo(0, 3);
  });

  it('lerpVehicle interpolates position and shortest heading arc', () => {
    const prev = [10, 20, 0.1, 10, 0];
    const curr = [14, 28, 0.5, 10, 0];
    const mid = lerpVehicle(prev, curr, 0.5);

    expect(mid.x).toBeCloseTo(12, 3);
    expect(mid.z).toBeCloseTo(24, 3);
    expect(mid.heading).toBeCloseTo(0.3, 3);
  });

  it('snapshotAlpha clamps to [0, 1]', () => {
    expect(snapshotAlpha(0, 100)).toBe(0);
    expect(snapshotAlpha(50, 100)).toBe(0.5);
    expect(snapshotAlpha(150, 100)).toBe(1.0);
    expect(snapshotAlpha(-10, 100)).toBe(0);
  });

  it('night light threshold is configured for dusk transition', () => {
    expect(VEHICLE_NIGHT_LIGHT_THRESHOLD).toBe(0.4);
  });
});
