/**
 * Unit-ish vector from the map center toward the sun (or, below the horizon,
 * the moon) for t in [0,1) — the same `elevation`/direction math
 * timeOfDayColors uses internally, factored out so sky.ts's
 * SunBillboard and clouds.ts can place themselves without recomputing the
 * whole color ramp. Pure: no three.js, no globals.
 */
export function sunDirection(t: number): { x: number; y: number; z: number } {
  const angle = t * Math.PI * 2;
  const elev = -Math.cos(angle);
  // Cap noon elevation to ~58° (European latitude) so buildings cast clear diagonal shadows instead of collapsing underneath
  const elevation = elev > 0 ? elev * 0.82 : elev;
  const rawX = Math.sin(angle);
  // Dynamic southern sky arc: azimuth sweeps smoothly from East-South-East at sunrise,
  // reaches full South (+Z) at solar noon, and sets West-South-West at sunset.
  const dayFactor = Math.max(0, elev);
  const rawZ = 0.22 + 0.3 * dayFactor;
  const len = Math.hypot(rawX, elevation, rawZ) || 1;
  return { x: rawX / len, y: elevation / len, z: rawZ / len };
}
