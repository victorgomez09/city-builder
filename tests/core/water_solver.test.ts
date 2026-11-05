import { describe, it, expect } from 'vitest';
import { ShallowWaterSolver } from '@core/water/shallow_water_solver';

describe('ShallowWaterSolver (SWE 2.5D Hydrodynamics)', () => {
  const width = 10;
  const height = 10;
  const cellSize = 2.0;

  it('debe fluir agua por gravedad desde una cota superior hacia una inferior', () => {
    const solver = new ShallowWaterSolver(width, height, cellSize);

    // Configurar pendiente: x=2 alto (terreno=4), x=3 bajo (terreno=1)
    solver.terrainHeight.fill(1.0);
    solver.terrainHeight[0 * width + 2] = 4.0;
    solver.terrainHeight[0 * width + 3] = 1.0;

    // Depositar agua en x=2
    solver.waterDepth[0 * width + 2] = 2.0;
    expect(solver.waterDepth[0 * width + 3]).toBe(0);

    // Ejecutar varios pasos de integración
    for (let i = 0; i < 15; i++) {
      solver.step(0.05);
    }

    // El agua debe haber fluido hacia la celda contigua más baja (x=3)
    expect(solver.waterDepth[0 * width + 3]).toBeGreaterThan(0.1);
  });

  it('debe respetar la conservación de masa (sin generación espontánea de agua)', () => {
    const solver = new ShallowWaterSolver(width, height, cellSize);
    solver.terrainHeight.fill(0.0);

    // Colocar agua en el centro lejos de los bordes sumidero
    solver.waterDepth[5 * width + 5] = 10.0;
    const initialTotalWater = 10.0;

    // Ejecutar pasos cortos
    for (let i = 0; i < 5; i++) {
      solver.step(0.02);
    }

    let currentTotalWater = 0;
    for (let i = 0; i < solver.waterDepth.length; i++) {
      currentTotalWater += solver.waterDepth[i] ?? 0;
    }

    // La suma de masa debe permanecer prácticamente idéntica (diferencia mínima por amortiguación)
    expect(currentTotalWater).toBeCloseTo(initialTotalWater, 0.2);
  });

  it('debe inyectar agua de un manantial continuo (WaterSource)', () => {
    const solver = new ShallowWaterSolver(width, height, cellSize);
    solver.terrainHeight.fill(0);

    solver.addSource({
      x: 4,
      z: 4,
      targetDepth: 3.0,
      flowRate: 2.0,
    });

    expect(solver.waterDepth[4 * width + 4]).toBe(0);
    for (let i = 0; i < 10; i++) {
      solver.step(0.05);
    }
    expect(solver.waterDepth[4 * width + 4]).toBeGreaterThan(0.5);
  });
});
