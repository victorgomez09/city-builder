import { describe, it, expect } from 'vitest';
import { RoadGraph } from '@core/graph/road_graph';
import { RoadType } from '@core/graph/road_types';
import { ZoningManager, ZoneType } from '@core/zoning/zoning_manager';

describe('ZoningManager (CityRT RCI Grid along Roads)', () => {
  it('debe generar casillas de zonificación 4x4m a ambos flancos de una carretera', () => {
    const graph = new RoadGraph();
    // Carretera recta de 30m: (0, 0) a (15, 0) con celdas de 2m
    graph.addRoadSegment(0, 0, 15, 0, 0, 0, RoadType.LOCAL_2L);

    const zoning = new ZoningManager();
    zoning.generateZoningCells(graph, () => 3.0, 2.0, 64.0, 64.0);

    expect(zoning.cells.size).toBeGreaterThan(0);

    // Todas las casillas iniciales deben ser NONE y sin edificio
    for (const cell of zoning.cells.values()) {
      expect(cell.zoneType).toBe(ZoneType.NONE);
      expect(cell.hasBuilding).toBe(false);
      expect(cell.elevation).toBe(3.0);
    }
  });

  it('debe permitir pintar zonas Residencial, Comercial e Industrial por radio', () => {
    const graph = new RoadGraph();
    graph.addRoadSegment(10, 10, 25, 10, 0, 0, RoadType.LOCAL_2L);

    const zoning = new ZoningManager();
    zoning.generateZoningCells(graph, () => 2.5, 2.0, 64.0, 64.0);

    const sampleCell = Array.from(zoning.cells.values())[0]!;
    const affected = zoning.paintZone(sampleCell.x, sampleCell.z, 6.0, ZoneType.RESIDENTIAL);

    expect(affected.length).toBeGreaterThan(0);
    expect(sampleCell.zoneType).toBe(ZoneType.RESIDENTIAL);

    // Pintar comercial sobre las mismas casillas
    zoning.paintZone(sampleCell.x, sampleCell.z, 6.0, ZoneType.COMMERCIAL);
    expect(sampleCell.zoneType).toBe(ZoneType.COMMERCIAL);

    // Deszonar (NONE)
    zoning.paintZone(sampleCell.x, sampleCell.z, 6.0, ZoneType.NONE);
    expect(sampleCell.zoneType).toBe(ZoneType.NONE);
  });

  it('debe listar correctamente casillas zonificadas sin construir', () => {
    const graph = new RoadGraph();
    graph.addRoadSegment(0, 0, 20, 0, 0, 0, RoadType.LOCAL_2L);

    const zoning = new ZoningManager();
    zoning.generateZoningCells(graph, () => 1.0, 2.0, 64.0, 64.0);

    expect(zoning.getUnbuiltZonedCells().length).toBe(0);

    const firstCell = Array.from(zoning.cells.values())[0]!;
    firstCell.zoneType = ZoneType.RESIDENTIAL;

    const unbuilt = zoning.getUnbuiltZonedCells();
    expect(unbuilt.length).toBe(1);
    expect(unbuilt[0]?.id).toBe(firstCell.id);

    // Marcar como construida
    firstCell.hasBuilding = true;
    expect(zoning.getUnbuiltZonedCells().length).toBe(0);
  });
});
