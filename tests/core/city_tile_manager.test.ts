import { describe, it, expect } from 'vitest';
import { CityTileManager } from '@core/world/city_tile_manager';

describe('CityTileManager (Macro-Tiles & Realistic City Expansion)', () => {
  it('debe inicializar la cuadrícula de macro-parcelas con tamaño métrico realista y superficie en hectáreas', () => {
    // 128x128 celdas, cellSize=2.0m, tileCellSize=64 celdas => 2x2 macro-tiles de 128m x 128m (1.64 ha cada una)
    const mgr = new CityTileManager(128, 128, 2.0, 64, 0, 1);

    expect(mgr.tilesX).toBe(2);
    expect(mgr.tilesZ).toBe(2);
    expect(mgr.tileMetricSize).toBe(128.0);
    expect(mgr.getUnlockedTileCount()).toBe(1);

    const startTile = mgr.getTile(0, 1);
    expect(startTile).not.toBeNull();
    expect(startTile?.unlocked).toBe(true);
    expect(startTile?.areaHectares).toBeCloseTo(1.6384, 2);
  });

  it('debe validar si una celda es construible según la macro-parcela a la que pertenece', () => {
    const mgr = new CityTileManager(128, 128, 2.0, 64, 0, 1);

    // Celda dentro de la macro-parcela inicial (tx: 0 => gx: [0..63], tz: 1 => gz: [64..127])
    expect(mgr.isCellBuildable(30, 80)).toBe(true);
    expect(mgr.isCellBuildable(63, 127)).toBe(true);

    // Celda fuera de la macro-parcela inicial
    expect(mgr.isCellBuildable(80, 80)).toBe(false);
    expect(mgr.isCellBuildable(10, 10)).toBe(false);
  });

  it('debe calcular la caja envolvente de cámara (Bounding Box) en coordenadas del mundo', () => {
    const mgr = new CityTileManager(128, 128, 2.0, 64, 0, 1);
    const bounds = mgr.getUnlockedWorldBoundingBox();

    // Map offset: 128 * 2 / 2 = 128.
    // tx: 0 => minX: 0 - 128 = -128, maxX: 128 - 128 = 0.
    // tz: 1 => minZ: 128 - 128 = 0, maxZ: 256 - 128 = 128.
    expect(bounds.minX).toBe(-128);
    expect(bounds.maxX).toBe(0);
    expect(bounds.minZ).toBe(0);
    expect(bounds.maxZ).toBe(128);
  });

  it('debe gestionar hitos de población (Milestones) para autorizar la expansión territorial', () => {
    const mgr = new CityTileManager(128, 128, 2.0, 64, 0, 1);

    // Con población 0 (Pionero), el límite es 1 tile (el ya desbloqueado)
    const checkPioneer = mgr.canUnlockTile(1, 1, 100000, 0);
    expect(checkPioneer.allowed).toBe(false);
    expect(checkPioneer.reason).toContain('Límite de parcelas alcanzado');

    // Al alcanzar 500 habitantes (Aldea), se permite desbloquear una 2ª parcela
    const checkVillage = mgr.canUnlockTile(1, 1, 100000, 500);
    expect(checkVillage.allowed).toBe(true);

    const unlockRes = mgr.unlockTile(1, 1, 100000, 500);
    expect(unlockRes.success).toBe(true);
    expect(mgr.getUnlockedTileCount()).toBe(2);
  });

  it('debe analizar recursos orográficos e hídricos por parcela', () => {
    const mgr = new CityTileManager(128, 128, 2.0, 64, 0, 1);
    const heights = new Float32Array(129 * 129);
    const biomes = new Uint8Array(128 * 128);

    // Simular agua en la parcela (0, 1)
    for (let i = 0; i < biomes.length; i++) biomes[i] = 2; // Hierba
    heights.fill(4.0);

    mgr.analyzeTerrainResources(heights, biomes);
    const tile = mgr.getTile(0, 1)!;
    expect(tile.flatBuildablePct).toBeGreaterThan(50);
  });
});
