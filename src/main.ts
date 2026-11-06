import * as THREE from 'three';
import { CameraController } from '@render/camera/camera_controller';
import { DynamicTerrainMesh } from '@render/terrain/dynamic_terrain_mesh';
import { DynamicWaterMesh } from '@render/terrain/dynamic_water_mesh';
import { RoadNetworkMesh } from '@render/terrain/road_network_mesh';
import { RoadPreviewMesh } from '@render/terrain/road_preview_mesh';
import { WorldGridHelper } from '@render/terrain/world_grid_helper';
import { DayNightCycle } from '@render/shaders/day_night_cycle';
import { GridCursor } from '@render/terrain/grid_cursor';
import { BrushCursor } from '@render/terrain/brush_cursor';
import { BuildingManager } from '@render/buildings/building_manager';
import { FoliageManager, FoliagePoint } from '@render/foliage/foliage_manager';
import { FoliageGenerator } from '@core/world/foliage_generator';
import { CityTileManager } from '@core/world/city_tile_manager';
import { CityBoundaryMesh } from '@render/terrain/city_boundary_mesh';
import { OuterLandscapeMesh } from '@render/terrain/outer_landscape_mesh';
import { NaturalLandscapeGenerator } from '@core/terrain/natural_landscape_generator';
import { LandscapeConfig, DEFAULT_LANDSCAPE_CONFIG } from '@core/terrain/landscape_config';
import { LandscapeGeneratorUI } from '@ui/landscape_generator_ui';
import { MainToolbarUI } from '@ui/main_toolbar_ui';
import { TerraformUI } from '@ui/terraform_ui';
import { RoadToolbarUI } from '@ui/road_toolbar_ui';
import { RoadConstructionHUD } from '@ui/road_construction_hud';
import { ZoningToolbarUI } from '@ui/zoning_toolbar_ui';
import { AreasUI } from '@ui/areas_ui';
import { ActiveTool } from '@core/tools';
import { RoadType, ROAD_CONFIGS } from '@core/graph/road_types';
import { RoadDrawMode } from '@core/graph/road_draw_mode';
import { SplineUtils } from '@core/graph/spline_utils';
import { Vec2 } from '@core/utils/math';
import { TerrainModifier, TerraformTool, BrushSettings } from '@core/terrain/terrain_modifier';
import { TerrainGenerator, TerrainGridData } from '@core/terrain_data';
import { RoadGraph, RoadNode, RoadEdge } from '@core/graph/road_graph';
import { ZoningManager, ZoneType } from '@core/zoning/zoning_manager';
import { ZoningMesh } from '@render/zoning/zoning_mesh';
import { TrafficManager } from '@core/traffic/traffic_manager';
import type { WorkerToMainMessage, MainToWorkerMessage, SimulationStats } from '@core/messages';

export class Engine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private cameraController: CameraController;
  private dayNightCycle: DayNightCycle;
  private terrain: DynamicTerrainMesh | null = null;
  private water: DynamicWaterMesh | null = null;
  private roadMesh: RoadNetworkMesh;
  private roadPreview: RoadPreviewMesh;
  public buildingManager: BuildingManager;
  public foliageManager: FoliageManager;
  private baseFoliagePoints: FoliagePoint[] = [];
  public cityTileManager: CityTileManager;
  public cityBoundaryMesh: CityBoundaryMesh;
  public outerLandscape: OuterLandscapeMesh;
  public currentLandscapeConfig: LandscapeConfig = { ...DEFAULT_LANDSCAPE_CONFIG };
  private worldGridHelper: WorldGridHelper;
  private gridCursor: GridCursor;
  private brushCursor: BrushCursor;
  private vehiclesGroup: THREE.Group = new THREE.Group();
  public readonly mainToolbarUI: MainToolbarUI;
  public readonly terraformUI: TerraformUI;
  public readonly roadToolbarUI: RoadToolbarUI;
  public readonly roadConstructionHUD: RoadConstructionHUD;
  public readonly zoningToolbarUI: ZoningToolbarUI;
  public readonly areasUI: AreasUI;
  public readonly landscapeUI: LandscapeGeneratorUI;
  public readonly zoningManager: ZoningManager = new ZoningManager();
  public readonly zoningMesh: ZoningMesh;
  public readonly trafficManager: TrafficManager;
  private worker: Worker;

  private isRunning: boolean = false;
  private lastTime: number = 0;
  private isMouseDown: boolean = false;
  private mouseButton: number = -1;

  public activeTool: ActiveTool = ActiveTool.INSPECT;
  public selectedRoadType: RoadType = RoadType.LOCAL_2L;
  public selectedDrawMode: RoadDrawMode = RoadDrawMode.STRAIGHT;
  public selectedElevationOffset: number = 0;
  public roadGraph: RoadGraph = new RoadGraph();

  private roadStartCell: { x: number; z: number } | null = null;
  private currentSnapNode: RoadNode | null = null;
  private currentSnapEdge: { edge: RoadEdge; projX: number; projZ: number; t: number } | null = null;
  private currentTargetGrid: { x: number; z: number } = { x: 0, z: 0 };
  private currentRoadCost: number = 0;
  private currentRoadLength: number = 0;
  private currentRoadAngle: number = 0;
  private isCurrentRoadValid: boolean = true;
  private roadInvalidReason: string = '';
  private buildingGrowthTimer: number = 0;

  private terrainData: TerrainGridData;
  private currentBrushSettings: BrushSettings = {
    tool: TerraformTool.NONE,
    radius: 8.0,
    strength: 3.5,
    targetHeight: 3.5,
  };

  private currentHitPoint: THREE.Vector3 = new THREE.Vector3();
  private hasHitPoint: boolean = false;

  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouseVec: THREE.Vector2 = new THREE.Vector2();
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  public currentStats: SimulationStats = {
    population: 0,
    money: 50000, // Presupuesto inicial estándar de partida nueva (Cities: Skylines / SimCity)
    rDemand: 50,
    cDemand: 30,
    iDemand: 20,
    currentTick: 0,
    totalWaterVolume: 0,
  };

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Escena Three.js con niebla atmosférica continua de horizonte infinito
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xb5dcfa, 1800, 52000);

    // 2. Cámara y Controller RTS de alta fidelidad con frustum extendido
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.5, 65000);
    this.cameraController = new CameraController(this.camera, this.container, {
      minPolarAngle: 0.28,
      maxPolarAngle: 1.42,
      smoothing: 12.0,
      panSpeed: 1.15,
      minDistance: 15.0,
      maxDistance: 6500.0,
      minHeightAboveGround: 2.0,
    });

    // 3. Renderer con WebGL y ToneMapping ACES Filmic calibrado
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.container.appendChild(this.renderer.domElement);

    // 4. Ciclo Solar e Iluminación (Hora dorada de la tarde)
    this.dayNightCycle = new DayNightCycle(this.scene, this.renderer);
    this.dayNightCycle.setTime(14.25 / 24);

    // 5. Cursors 3D & Cuadrícula (256x256 con celdas de 50.0m = 163.8 km²)
    this.gridCursor = new GridCursor(4.0);
    this.gridCursor.mesh.visible = false;
    this.scene.add(this.gridCursor.mesh);

    this.brushCursor = new BrushCursor(40.0);
    this.scene.add(this.brushCursor.group);

    this.worldGridHelper = new WorldGridHelper(256, 256, 50.0);
    this.worldGridHelper.setVisible(false);
    this.scene.add(this.worldGridHelper.group);

    this.scene.add(this.vehiclesGroup);

    // 6. Terreno dinámico con multi-textura PBR continuo (256x256 con celdas de 50.0m = 12.8km x 12.8km = 163.8 km²)
    this.terrainData = TerrainGenerator.generate(256, 256, 50.0, this.currentLandscapeConfig);
    this.terrain = new DynamicTerrainMesh(this.terrainData);
    this.scene.add(this.terrain.group);

    // 7. Malla física de agua SWE turquesa
    this.water = new DynamicWaterMesh(256, 256, 50.0);
    const initialWater = new Float32Array(256 * 256);
    this.water.updateWaterLevels(initialWater, this.terrainData.heights, this.currentLandscapeConfig.waterLevel);
    this.scene.add(this.water.mesh);

    // 8. Carreteras PBR
    this.roadMesh = new RoadNetworkMesh(256, 256, 50.0);
    this.scene.add(this.roadMesh.group);

    this.roadPreview = new RoadPreviewMesh(256, 256, 50.0);
    this.scene.add(this.roadPreview.group);

    // Casillas de Zonificación RCI (CityRT)
    this.zoningMesh = new ZoningMesh();
    this.scene.add(this.zoningMesh.group);

    // Gestor de Tráfico y Circulación de Vehículos PBR
    this.trafficManager = new TrafficManager(this.scene, this.roadGraph, 50.0, 6400.0, 6400.0);

    // HUD Flotante de Construcción de Carreteras
    this.roadConstructionHUD = new RoadConstructionHUD(this.container);

    // 9. Gestor de Edificios y Rascacielos
    this.buildingManager = new BuildingManager(this.scene);

    // 10. Gestor de Vegetación y Arbolado instanciado
    this.foliageManager = new FoliageManager(this.scene);

    // 11. Sistema de Macro-Parcelas de Ciudad y Límites Construibles (Cities: Skylines / CityRT)
    // 16 Macro-parcelas de 3.2km x 3.2km (10.24 km² / 1,024 ha cada una) que cubren el territorio regional de 163.8 km² (~160 km²).
    // Se comienza con la macro-parcela inicial en el valle fértil central (tx: 1, tz: 1)
    this.cityTileManager = new CityTileManager(256, 256, 50.0, 64, 1, 1);
    this.cityTileManager.analyzeTerrainResources(this.terrainData.heights, this.terrainData.biomes);
    this.cityBoundaryMesh = new CityBoundaryMesh();
    this.scene.add(this.cityBoundaryMesh.group);

    // 12. Malla de Paisaje Continuo Extendido (Outer Landscape Mesh hasta 36 km)
    // Ocupa la pantalla entera sin cortes ni vacíos, con el mismo sombreador PBR y textura que el terreno activo
    const landscapeGen = new NaturalLandscapeGenerator(this.currentLandscapeConfig);
    this.outerLandscape = new OuterLandscapeMesh({
      generator: landscapeGen,
      halfSize: (256 * 50.0) / 2, // 6400.0m
      outerRadius: 36000.0,
      radialRings: 18,
      angularSectors: 128,
    });
    this.scene.add(this.outerLandscape.group);

    // Restringir el movimiento de cámara a la macro-parcela inicial con margen suave elástico
    const initialBounds = this.cityTileManager.getUnlockedWorldBoundingBox();
    this.cameraController.setBounds({ ...initialBounds, margin: 40.0 });

    // 13. Generar Mundo Natural con Autovía Regional de Entrada (CityRT / Cities: Skylines)
    this.initStarterCity();

    // 14. Interfaces UI
    this.areasUI = new AreasUI(document.body, (tx, tz) => this.purchaseTile(tx, tz));
    this.zoningToolbarUI = new ZoningToolbarUI(document.body);

    this.landscapeUI = new LandscapeGeneratorUI(document.body, (config) => {
      this.regenerateWorld(config);
    });

    this.terraformUI = new TerraformUI(document.body, (settings) => {
      this.currentBrushSettings = { ...settings };
      this.brushCursor.setRadius(settings.radius);

      if (settings.tool === TerraformTool.RAISE) this.brushCursor.setColor(0x4caf50);
      else if (settings.tool === TerraformTool.LOWER) this.brushCursor.setColor(0xf44336);
      else if (settings.tool === TerraformTool.FLATTEN) this.brushCursor.setColor(0xff9800);
      else if (settings.tool === TerraformTool.SMOOTH) this.brushCursor.setColor(0x00e5ff);
    });

    this.roadToolbarUI = new RoadToolbarUI(
      document.body,
      (type) => {
        this.selectedRoadType = type;
      },
      (mode) => {
        this.selectedDrawMode = mode;
      },
      (elev) => {
        this.selectedElevationOffset = elev;
      }
    );

    this.mainToolbarUI = new MainToolbarUI(
      document.body,
      (tool) => {
        this.activeTool = tool;
        this.cameraController.enableQERotation = tool !== ActiveTool.ROAD;

        const showGrid = tool === ActiveTool.ROAD || tool === ActiveTool.TERRAFORM || tool === ActiveTool.ZONE;
        this.worldGridHelper.setVisible(showGrid);

        const tPanel = document.getElementById('terraform-panel');
        if (tPanel) {
          tPanel.style.display = tool === ActiveTool.TERRAFORM ? 'flex' : 'none';
        }

        this.roadToolbarUI.setVisible(tool === ActiveTool.ROAD);
        this.zoningToolbarUI.setVisible(tool === ActiveTool.ZONE);

        // Gestión de la vista de compra de áreas/parcelas
        const isAreas = tool === ActiveTool.AREAS;
        this.cityBoundaryMesh.setAreasViewVisible(isAreas);
        this.areasUI.setVisible(isAreas);

        // Malla de casillas de zonificación visible en herramientas de Carretera y Zonificación
        this.zoningMesh.setVisible(tool === ActiveTool.ZONE || tool === ActiveTool.ROAD);

        if (tool !== ActiveTool.TERRAFORM) {
          this.brushCursor.setVisible(false);
        }

        if (tool !== ActiveTool.ROAD) {
          this.roadPreview.hide();
          this.roadPreview.hideSnapRing();
          this.roadConstructionHUD.hide();
          this.roadStartCell = null;
          this.currentSnapNode = null;
          this.currentSnapEdge = null;
        }

        if (tool === ActiveTool.INSPECT || isAreas) {
          this.gridCursor.mesh.visible = false;
        }
      },
      () => {
        this.landscapeUI.toggle();
      }
    );

    const tp = document.getElementById('terraform-panel');
    if (tp) tp.style.display = 'none';
    this.roadToolbarUI.setVisible(false);

    // 15. Web Worker
    this.worker = new Worker(new URL('./worker/sim.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.setupWorkerListeners();
    this.setupSpeedControls();

    // 16. Eventos de entrada
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.container.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.container.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  private setupWorkerListeners(): void {
    this.worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
      const msg = event.data;
      if (msg.type === 'SIMULATION_UPDATE') {
        this.currentStats = msg.payload.stats;
        if (msg.payload.waterDepthBuffer && this.water && this.terrain) {
          this.water.updateWaterLevels(msg.payload.waterDepthBuffer, this.terrainData.heights);
        }
        this.updateHUD();
      }
    };
  }

  public sendToWorker(msg: MainToWorkerMessage): void {
    this.worker.postMessage(msg);
  }

  public initWorld(seed: number = 1337, width: number = 256, height: number = 256): void {
    this.sendToWorker({
      type: 'INIT_WORLD',
      payload: {
        seed,
        mapWidth: width,
        mapHeight: height,
        heights: this.terrainData.heights,
      },
    });
  }

  private getCellElevation = (gx: number, gz: number): number => {
    const w = this.terrainData.width;
    const h = this.terrainData.height;
    if (gx < 0 || gx > w || gz < 0 || gz > h) return 0;
    const x0 = Math.max(0, Math.min(w - 1, Math.floor(gx)));
    const z0 = Math.max(0, Math.min(h - 1, Math.floor(gz)));
    const x1 = Math.min(w, x0 + 1);
    const z1 = Math.min(h, z0 + 1);
    const tx = Math.max(0, Math.min(1, gx - x0));
    const tz = Math.max(0, Math.min(1, gz - z0));
    const stride = w + 1;
    const h00 = this.terrainData.heights[z0 * stride + x0] ?? 0;
    const h10 = this.terrainData.heights[z0 * stride + x1] ?? 0;
    const h01 = this.terrainData.heights[z1 * stride + x0] ?? 0;
    const h11 = this.terrainData.heights[z1 * stride + x1] ?? 0;
    const top = h00 * (1 - tx) + h10 * tx;
    const btm = h01 * (1 - tx) + h11 * tx;
    return top * (1 - tz) + btm * tz;
  };

  public purchaseTile(tx: number, tz: number): void {
    const res = this.cityTileManager.unlockTile(
      tx,
      tz,
      this.currentStats.money,
      this.currentStats.population
    );
    if (res.success) {
      this.currentStats.money = Math.max(0, this.currentStats.money - res.costDeducted);
      this.cityBoundaryMesh.rebuild(this.cityTileManager, this.getCellElevation);

      // Expandir dinámicamente los límites de paneo de la cámara al nuevo territorio adquirido
      const updatedBounds = this.cityTileManager.getUnlockedWorldBoundingBox();
      this.cameraController.setBounds({ ...updatedBounds, margin: 40.0 });

      const tile = this.cityTileManager.getTile(tx, tz);
      const check = this.cityTileManager.canUnlockTile(
        tx,
        tz,
        this.currentStats.money,
        this.currentStats.population
      );
      this.areasUI.setSelectedTile(tile, false, this.currentStats.money, check);
      this.updateHUD();
    } else {
      console.warn('[CityTileManager] Compra rechazada:', res.reason);
    }
  }

  private onMouseDown(event: MouseEvent): void {
    this.isMouseDown = true;
    this.mouseButton = event.button;

    if (event.button === 0 && this.hasHitPoint) {
      const gx = this.gridCursor.currentGridX;
      const gz = this.gridCursor.currentGridZ;

      if (this.activeTool === ActiveTool.ZONE) {
        if (this.cityTileManager.isCellBuildable(gx, gz)) {
          this.zoningManager.paintZone(
            this.currentHitPoint.x,
            this.currentHitPoint.z,
            this.zoningToolbarUI.brushRadius,
            this.zoningToolbarUI.selectedZone
          );
          this.zoningMesh.rebuild(this.zoningManager, false);
        }
      } else if (this.activeTool === ActiveTool.AREAS) {
        const tx = Math.floor(gx / this.cityTileManager.tileCellSize);
        const tz = Math.floor(gz / this.cityTileManager.tileCellSize);
        const tile = this.cityTileManager.getTile(tx, tz);
        const isAdj = this.cityTileManager.isTileAdjacentToUnlocked(tx, tz);
        const check = this.cityTileManager.canUnlockTile(
          tx,
          tz,
          this.currentStats.money,
          this.currentStats.population
        );
        this.areasUI.setSelectedTile(tile, isAdj, this.currentStats.money, check);
      } else if (this.activeTool === ActiveTool.ROAD) {
        // Restricción estricta: solo se puede iniciar carretera en territorio desbloqueado
        if (!this.cityTileManager.isCellBuildable(gx, gz)) {
          return;
        }

        if (this.selectedDrawMode === RoadDrawMode.ROUNDABOUT) {
          const roundaboutRadius = 3.5;
          const roundaboutNodes = SplineUtils.generateRoundaboutNodes(gx, gz, roundaboutRadius, 12);
          let allBuildable = true;
          for (const n of roundaboutNodes) {
            if (!this.cityTileManager.isCellBuildable(Math.round(n.x), Math.round(n.z))) {
              allBuildable = false;
              break;
            }
          }
          if (allBuildable) {
            for (let i = 0; i < roundaboutNodes.length; i++) {
              const nextIdx = (i + 1) % roundaboutNodes.length;
              const cur = roundaboutNodes[i]!;
              const nxt = roundaboutNodes[nextIdx]!;
              const elevA = this.getCellElevation(Math.round(cur.x), Math.round(cur.z)) + this.selectedElevationOffset;
              const elevB = this.getCellElevation(Math.round(nxt.x), Math.round(nxt.z)) + this.selectedElevationOffset;
              this.roadGraph.addRoadSegment(cur.x, cur.z, nxt.x, nxt.z, elevA, elevB, RoadType.ONE_WAY_2L);
            }
            this.currentStats.money = Math.max(0, this.currentStats.money - 300);
            this.roadMesh.rebuild(this.roadGraph);
            this.zoningManager.generateZoningCells(this.roadGraph, this.getCellElevation);
            this.zoningMesh.rebuild(this.zoningManager, false);
            this.updateFoliageInstances();
            this.updateHUD();
          }
        } else {
          // Iniciar trazado con snapping magnético si procede
          let startGx = gx;
          let startGz = gz;
          if (this.currentSnapNode) {
            startGx = this.currentSnapNode.x;
            startGz = this.currentSnapNode.z;
          } else if (this.currentSnapEdge) {
            startGx = Math.round(this.currentSnapEdge.projX * 10) / 10;
            startGz = Math.round(this.currentSnapEdge.projZ * 10) / 10;
          }

          this.roadStartCell = { x: startGx, z: startGz };
          this.currentTargetGrid = { x: startGx, z: startGz };
          this.roadPreview.updatePreview(
            startGx,
            startGz,
            startGx,
            startGz,
            this.selectedDrawMode,
            this.selectedRoadType,
            this.getCellElevation,
            true,
            this.selectedElevationOffset
          );
        }
      } else if (this.activeTool === ActiveTool.DEMOLISH) {
        if (!this.cityTileManager.isCellBuildable(gx, gz)) {
          return;
        }
        const targetNode = this.roadGraph.getNodeAt(gx, gz) ?? this.roadGraph.findClosestNode(gx, gz, 2.0);
        if (targetNode) {
          this.roadGraph.removeNode(targetNode.id);
          this.roadMesh.rebuild(this.roadGraph);
          this.zoningManager.generateZoningCells(this.roadGraph, this.getCellElevation);
          this.zoningMesh.rebuild(this.zoningManager, false);
          this.updateFoliageInstances();
        }
      }
    }
  }

  private onMouseUp(): void {
    if (this.mouseButton === 0 && this.activeTool === ActiveTool.ROAD && this.roadStartCell) {
      const startX = this.roadStartCell.x;
      const startZ = this.roadStartCell.z;
      const endX = this.currentTargetGrid.x;
      const endZ = this.currentTargetGrid.z;

      const dist = Math.hypot(endX - startX, endZ - startZ);
      const cs = this.terrainData.cellSize;

      if (this.isCurrentRoadValid && dist * cs > 2.0) {
        // 1. Si el punto final conecta en medio de una carretera existente, dividirla con un nuevo nodo
        if (this.currentSnapEdge) {
          const splitElev = this.getCellElevation(endX, endZ) + this.selectedElevationOffset;
          this.roadGraph.splitEdge(this.currentSnapEdge.edge.id, endX, endZ, splitElev);
        }

        const elevA = this.getCellElevation(startX, startZ) + this.selectedElevationOffset;
        const elevB = this.getCellElevation(endX, endZ) + this.selectedElevationOffset;

        if (this.selectedDrawMode === RoadDrawMode.CURVE) {
          const sampled = SplineUtils.sampleBezierCells(
            new Vec2(startX, startZ),
            new Vec2(startX, endZ),
            new Vec2(endX, endZ),
            12
          );

          for (let i = 0; i < sampled.length - 1; i++) {
            const cur = sampled[i]!;
            const nxt = sampled[i + 1]!;
            const e1 = this.getCellElevation(Math.round(cur.x), Math.round(cur.z)) + this.selectedElevationOffset;
            const e2 = this.getCellElevation(Math.round(nxt.x), Math.round(nxt.z)) + this.selectedElevationOffset;
            this.roadGraph.addRoadSegment(cur.x, cur.z, nxt.x, nxt.z, e1, e2, this.selectedRoadType);
          }
        } else {
          // Trazado recto a CUALQUIER ÁNGULO directo (CityRT clone)
          this.roadGraph.addRoadSegment(startX, startZ, endX, endZ, elevA, elevB, this.selectedRoadType);
        }

        // Deducir costes de obra
        this.currentStats.money = Math.max(0, this.currentStats.money - this.currentRoadCost);

        // Reconstrucción reactiva de mallas viales y casillas de zonificación
        this.roadMesh.rebuild(this.roadGraph);
        this.zoningManager.generateZoningCells(this.roadGraph, this.getCellElevation);
        this.zoningMesh.rebuild(this.zoningManager, false);
        this.updateFoliageInstances();
        this.updateHUD();
      }

      this.roadPreview.hide();
      this.roadPreview.hideSnapRing();
      this.roadConstructionHUD.hide();
      this.roadStartCell = null;
      this.currentSnapNode = null;
      this.currentSnapEdge = null;
    }

    this.isMouseDown = false;
    this.mouseButton = -1;
  }

  private onMouseMove(event: MouseEvent): void {
    this.mouseVec.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouseVec.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseVec, this.camera);

    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.currentHitPoint);
    if (hit) {
      this.hasHitPoint = true;
      const w = this.terrainData.width;
      const h = this.terrainData.height;
      const cs = this.terrainData.cellSize;
      const halfW = (w * cs) / 2;
      const halfH = (h * cs) / 2;

      // Snap métrico fino a múltiplos de 2 metros en coordenadas del mundo
      const worldSnap = 2.0;
      const snappedWorldX = Math.round(this.currentHitPoint.x / worldSnap) * worldSnap;
      const snappedWorldZ = Math.round(this.currentHitPoint.z / worldSnap) * worldSnap;

      const gx = Math.max(0, Math.min(w - 1, (snappedWorldX + halfW) / cs - 0.5));
      const gz = Math.max(0, Math.min(h - 1, (snappedWorldZ + halfH) / cs - 0.5));

      this.gridCursor.currentGridX = gx;
      this.gridCursor.currentGridZ = gz;

      const cx = (gx + 0.5) * cs - halfW;
      const cz = (gz + 0.5) * cs - halfH;
      const elev = this.getCellElevation(gx, gz);
      this.gridCursor.mesh.position.set(cx, elev + 0.05, cz);

      // Comprobar si la celda está dentro del territorio desbloqueado
      const isCellInBounds = this.cityTileManager.isCellBuildable(Math.round(gx), Math.round(gz));

      if (this.activeTool === ActiveTool.ROAD || this.activeTool === ActiveTool.TERRAFORM || this.activeTool === ActiveTool.ZONE) {
        this.worldGridHelper.highlightCell(Math.round(gx), Math.round(gz), elev);
      }

      const isTerraforming = this.activeTool === ActiveTool.TERRAFORM && this.currentBrushSettings.tool !== TerraformTool.NONE;
      const isRoadOrDemolish = this.activeTool === ActiveTool.ROAD || this.activeTool === ActiveTool.DEMOLISH || this.activeTool === ActiveTool.ZONE;

      this.gridCursor.mesh.visible = isRoadOrDemolish;
      this.brushCursor.setVisible(isTerraforming);
      this.brushCursor.setPosition(this.currentHitPoint.x, elev, this.currentHitPoint.z);

      if (this.activeTool === ActiveTool.ZONE && this.isMouseDown && this.mouseButton === 0) {
        // Pintura interactiva de zonas RCI mientras se arrastra
        if (isCellInBounds) {
          this.zoningManager.paintZone(
            this.currentHitPoint.x,
            this.currentHitPoint.z,
            this.zoningToolbarUI.brushRadius,
            this.zoningToolbarUI.selectedZone
          );
          this.zoningMesh.rebuild(this.zoningManager, false);
        }
      } else if (this.activeTool === ActiveTool.ROAD) {
        let targetGx = gx;
        let targetGz = gz;

        // Snapping magnético a nodos y aristas existentes
        this.currentSnapNode = this.roadGraph.findClosestNode(gx, gz, 3.0);
        if (this.currentSnapNode) {
          this.currentSnapEdge = null;
          targetGx = this.currentSnapNode.x;
          targetGz = this.currentSnapNode.z;
          const nwx = (targetGx + 0.5) * cs - halfW;
          const nwz = (targetGz + 0.5) * cs - halfH;
          this.roadPreview.showSnapRing(nwx, this.currentSnapNode.elevation, nwz);
        } else {
          this.currentSnapEdge = this.roadGraph.findClosestEdge(gx, gz, 2.2);
          if (this.currentSnapEdge) {
            targetGx = Math.round(this.currentSnapEdge.projX * 10) / 10;
            targetGz = Math.round(this.currentSnapEdge.projZ * 10) / 10;
            const ewx = (this.currentSnapEdge.projX + 0.5) * cs - halfW;
            const ewz = (this.currentSnapEdge.projZ + 0.5) * cs - halfH;
            const eElev = this.getCellElevation(Math.round(this.currentSnapEdge.projX), Math.round(this.currentSnapEdge.projZ));
            this.roadPreview.showSnapRing(ewx, eElev, ewz);
          } else {
            this.roadPreview.hideSnapRing();
          }
        }

        if (this.selectedDrawMode === RoadDrawMode.ROUNDABOUT) {
          this.roadPreview.updatePreview(
            gx,
            gz,
            gx,
            gz,
            RoadDrawMode.ROUNDABOUT,
            this.selectedRoadType,
            this.getCellElevation,
            isCellInBounds,
            this.selectedElevationOffset
          );
          this.roadConstructionHUD.update(
            event.clientX,
            event.clientY,
            22.0,
            0,
            300,
            isCellInBounds,
            isCellInBounds ? undefined : 'Fuera de parcela',
            this.selectedElevationOffset
          );
        } else if (this.isMouseDown && this.mouseButton === 0 && this.roadStartCell) {
          const startX = this.roadStartCell.x;
          const startZ = this.roadStartCell.z;

          // Snapping magnético angular (0°, 45°, 90°, 135°, 180°, etc. con tolerancia ±6.5°)
          if (this.selectedDrawMode === RoadDrawMode.STRAIGHT && !this.currentSnapNode && !this.currentSnapEdge) {
            const dX = targetGx - startX;
            const dZ = targetGz - startZ;
            const dist = Math.hypot(dX, dZ);
            if (dist > 1.2) {
              const angleRad = Math.atan2(dZ, dX);
              const angleDeg = ((angleRad * 180) / Math.PI + 360) % 360;

              const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
              for (const snapTarget of snapAngles) {
                if (Math.abs(angleDeg - snapTarget) <= 6.5) {
                  const rad = (snapTarget * Math.PI) / 180;
                  targetGx = startX + Math.round(dist * Math.cos(rad) * 10) / 10;
                  targetGz = startZ + Math.round(dist * Math.sin(rad) * 10) / 10;
                  break;
                }
              }
            }
          }

          this.currentTargetGrid = { x: targetGx, z: targetGz };

          const startInBounds = this.cityTileManager.isCellBuildable(Math.round(startX), Math.round(startZ));
          const endInBounds = this.cityTileManager.isCellBuildable(Math.round(targetGx), Math.round(targetGz));

          const dX_m = (targetGx - startX) * cs;
          const dZ_m = (targetGz - startZ) * cs;
          this.currentRoadLength = Math.hypot(dX_m, dZ_m);
          this.currentRoadAngle = Math.round(((Math.atan2(dZ_m, dX_m) * 180) / Math.PI + 360) % 360);

          const config = ROAD_CONFIGS[this.selectedRoadType];
          const cellSteps = Math.max(1, Math.round(this.currentRoadLength / cs));
          this.currentRoadCost = cellSteps * config.costPerCell;

          if (!startInBounds || !endInBounds) {
            this.isCurrentRoadValid = false;
            this.roadInvalidReason = 'Fuera de parcela';
          } else if (this.currentStats.money < this.currentRoadCost) {
            this.isCurrentRoadValid = false;
            this.roadInvalidReason = 'Fondos insuficientes';
          } else {
            this.isCurrentRoadValid = true;
            this.roadInvalidReason = '';
          }

          this.roadPreview.updatePreview(
            startX,
            startZ,
            targetGx,
            targetGz,
            this.selectedDrawMode,
            this.selectedRoadType,
            this.getCellElevation,
            this.isCurrentRoadValid,
            this.selectedElevationOffset
          );

          this.roadConstructionHUD.update(
            event.clientX,
            event.clientY,
            this.currentRoadLength,
            this.currentRoadAngle,
            this.currentRoadCost,
            this.isCurrentRoadValid,
            this.roadInvalidReason,
            this.selectedElevationOffset
          );
        } else {
          this.roadConstructionHUD.hide();
        }
      } else if (this.activeTool === ActiveTool.AREAS) {
        const tx = Math.floor(gx / this.cityTileManager.tileCellSize);
        const tz = Math.floor(gz / this.cityTileManager.tileCellSize);
        const tile = this.cityTileManager.getTile(tx, tz);
        const isAdj = this.cityTileManager.isTileAdjacentToUnlocked(tx, tz);
        const check = this.cityTileManager.canUnlockTile(
          tx,
          tz,
          this.currentStats.money,
          this.currentStats.population
        );
        this.areasUI.setSelectedTile(tile, isAdj, this.currentStats.money, check);
      }
    } else {
      this.hasHitPoint = false;
      this.gridCursor.mesh.visible = false;
      this.brushCursor.setVisible(false);
      this.roadPreview.hide();
      this.roadPreview.hideSnapRing();
      this.roadConstructionHUD.hide();
    }
  }

  private setupSpeedControls(): void {
    const btnPause = document.getElementById('btn-speed-pause');
    const btn1 = document.getElementById('btn-speed-1');
    const btn2 = document.getElementById('btn-speed-2');

    const setSpeed = (speed: number) => {
      this.sendToWorker({ type: 'SET_SIMULATION_SPEED', payload: { speed } });
      btnPause?.classList.toggle('active', speed === 0);
      btn1?.classList.toggle('active', speed === 1);
      btn2?.classList.toggle('active', speed === 2);
    };

    btnPause?.addEventListener('click', () => setSpeed(0));
    btn1?.addEventListener('click', () => setSpeed(1));
    btn2?.addEventListener('click', () => setSpeed(2));

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        const isPaused = btnPause?.classList.contains('active');
        setSpeed(isPaused ? 1 : 0);
      }
    });
  }

  private updateHUD(): void {
    const timeOfDay = Math.floor(this.dayNightCycle.getTime() * 24);
    const minutes = Math.floor((this.dayNightCycle.getTime() * 24 * 60) % 60);
    const timeStr = `${timeOfDay.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const unlockedTiles = this.cityTileManager.getUnlockedTileCount();
    const totalTiles = this.cityTileManager.tilesX * this.cityTileManager.tilesZ;
    const milestone = this.cityTileManager.getCurrentMilestone(this.currentStats.population);

    const elMilestone = document.getElementById('hud-milestone');
    if (elMilestone) elMilestone.textContent = milestone.name.toUpperCase();

    const elMoney = document.getElementById('hud-money');
    if (elMoney) elMoney.textContent = `$${this.currentStats.money.toLocaleString()}`;

    const elPop = document.getElementById('hud-pop');
    if (elPop) elPop.textContent = this.currentStats.population.toLocaleString();

    const elTiles = document.getElementById('hud-tiles');
    if (elTiles) elTiles.textContent = `${unlockedTiles}/${totalTiles}`;

    const elTime = document.getElementById('hud-time');
    if (elTime) elTime.textContent = `🕒 ${timeStr}`;
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Inicializa el mundo natural con autovía regional de entrada (CityRT / Cities: Skylines):
   * - Relieve continuo, montañas, ríos, lagunas, costa y bosques naturales.
   * - Autovía regional conectada desde el límite del mapa que entra en la macro-parcela inicial.
   * - Casillas de zonificación RCI 4x4m generadas a los lados de la calzada.
   */
  private async initStarterCity(): Promise<void> {
    // 1. Limpiar red vial, edificios y agentes de tráfico previos
    this.roadGraph.clear();
    this.buildingManager.clear();
    if (this.trafficManager) this.trafficManager.clear();
    this.zoningManager.cells.clear();

    // 2. Autovía regional de conexión exterior (Highway entrance / Dual carriageway)
    // Entra desde el límite oeste de la macro-parcela central [1, 1] hacia su interior
    const startX = 64;
    const endX = 82;
    const highwayGz = 96;
    const elevA = this.getCellElevation(startX, highwayGz);
    const elevB = this.getCellElevation(endX, highwayGz);
    this.roadGraph.addRoadSegment(startX, highwayGz, endX, highwayGz, elevA, elevB, RoadType.AVENUE_4L);
    this.roadMesh.rebuild(this.roadGraph);

    // 3. Generar casillas de zonificación de 4m x 4m a lo largo de la vía de entrada
    this.zoningManager.generateZoningCells(this.roadGraph, this.getCellElevation);
    this.zoningMesh.rebuild(this.zoningManager, false);

    // 4. Generar bosques y vegetación natural procedimental por TODO el mundo
    this.baseFoliagePoints = FoliageGenerator.generateWorldFoliage(this.terrainData, this.currentLandscapeConfig);
    this.updateFoliageInstances();

    // 5. Reconstruir los límites de la parcela inicial de la ciudad
    this.cityBoundaryMesh.rebuild(this.cityTileManager, this.getCellElevation);

    // 6. Enfocar la cámara hacia el final de la autovía donde el jugador conectará su primera carretera
    const cs = this.terrainData.cellSize;
    const halfW = (this.terrainData.width * cs) / 2;
    const halfH = (this.terrainData.height * cs) / 2;
    const terminusWorldX = (endX + 0.5) * cs - halfW;
    const terminusWorldZ = (highwayGz + 0.5) * cs - halfH;

    this.cameraController.setView(
      {
        target: { x: terminusWorldX + 22, y: elevB + 4.2, z: terminusWorldZ },
        distance: 380,
        yaw: 0.82,
        pitch: 0.40,
      },
      true
    );

    this.updateHUD();
  }

  /**
   * Regenera completamente el mundo y paisaje natural en base a la configuración paramétrica
   * seleccionada por el jugador (presets, cordilleras, extensión de costa, ríos, acantilados vs playas, semilla).
   */
  public regenerateWorld(config: LandscapeConfig): void {
    this.currentLandscapeConfig = { ...config };

    // 1. Regenerar topografía del terreno activo (163.8 km²)
    this.terrainData = TerrainGenerator.generate(256, 256, 50.0, this.currentLandscapeConfig);
    if (this.terrain) {
      this.terrain.setGridData(this.terrainData, this.currentLandscapeConfig.waterLevel);
    }

    // 2. Regenerar paisaje exterior continuo hasta 36 km (cero cortes ni vacíos)
    const gen = new NaturalLandscapeGenerator(this.currentLandscapeConfig);
    if (this.outerLandscape) {
      this.outerLandscape.rebuild(gen);
    }

    // 3. Sincronizar nivel del agua del océano y ríos
    if (this.water) {
      const initialWater = new Float32Array(256 * 256);
      this.water.updateWaterLevels(initialWater, this.terrainData.heights, this.currentLandscapeConfig.waterLevel);
    }

    // 4. Reinicializar macro-parcelas con la inicial en el valle fértil
    this.cityTileManager = new CityTileManager(256, 256, 50.0, 64, 1, 1);
    this.cityTileManager.analyzeTerrainResources(this.terrainData.heights, this.terrainData.biomes);
    this.cityBoundaryMesh.rebuild(this.cityTileManager, this.getCellElevation);

    // 5. Restablecer límites de cámara sobre la parcela inicial
    const initialBounds = this.cityTileManager.getUnlockedWorldBoundingBox();
    this.cameraController.setBounds({ ...initialBounds, margin: 40.0 });

    // 6. Regenerar autovía de entrada y vegetación
    this.initStarterCity();

    // 7. Sincronizar con el worker de simulación
    this.initWorld(this.currentLandscapeConfig.seed, 256, 256);

    // 8. Restablecer estadísticas de partida
    this.currentStats.money = 50000;
    this.currentStats.population = 0;
    this.updateHUD();
  }

  /**
   * Crecimiento procedimental de edificios en casillas zonificadas (CityRT / Cities: Skylines):
   * Spawnea viviendas suburbanas con tejados cerámicos (Residencial), comercios/oficinas (Comercial)
   * o naves de chapa y hormigón (Industrial).
   */
  private simulateBuildingGrowth(): void {
    const unbuiltCells = this.zoningManager.getUnbuiltZonedCells();
    if (unbuiltCells.length === 0) return;

    // Desarrollar 1 o 2 parcelas por ciclo
    const countToBuild = Math.min(unbuiltCells.length, 2);
    let newPop = 0;

    for (let i = 0; i < countToBuild; i++) {
      const idx = Math.floor(Math.random() * unbuiltCells.length);
      const cell = unbuiltCells.splice(idx, 1)[0]!;
      cell.hasBuilding = true;

      if (cell.zoneType === ZoneType.RESIDENTIAL) {
        // Vivienda suburbana / unifamiliar con paredes de revoco y tejado cerámico
        const w = 4.4 + (Math.random() * 1.2 - 0.6);
        const d = 4.2 + (Math.random() * 1.2 - 0.6);
        const h = 6.5 + Math.random() * 3.0;
        this.buildingManager.addBuilding({
          x: cell.x,
          y: cell.elevation,
          z: cell.z,
          yaw: cell.yaw,
          type: 'suburb',
          width: w,
          depth: d,
          height: h,
        });
        newPop += Math.floor(4 + Math.random() * 8);
      } else if (cell.zoneType === ZoneType.COMMERCIAL) {
        // Bloque comercial contemporáneo
        const w = 5.2 + (Math.random() * 1.4 - 0.7);
        const d = 5.0 + (Math.random() * 1.4 - 0.7);
        const h = 8.0 + Math.random() * 6.0;
        this.buildingManager.addBuilding({
          x: cell.x,
          y: cell.elevation,
          z: cell.z,
          yaw: cell.yaw,
          type: 'commercial',
          width: w,
          depth: d,
          height: h,
          colorTint: 0xd8d4cb,
        });
      } else if (cell.zoneType === ZoneType.INDUSTRIAL) {
        // Nave industrial / fábrica de chapa ondulada
        const w = 6.2 + (Math.random() * 1.6 - 0.8);
        const d = 5.8 + (Math.random() * 1.6 - 0.8);
        const h = 7.0 + Math.random() * 4.0;
        this.buildingManager.addBuilding({
          x: cell.x,
          y: cell.elevation,
          z: cell.z,
          yaw: cell.yaw,
          type: 'industrial',
          width: w,
          depth: d,
          height: h,
        });
      }
    }

    if (newPop > 0) {
      this.currentStats.population += newPop;
      this.updateHUD();
    }
  }

  /**
   * Actualiza las instancias de vegetación en el mundo, despejando automáticamente
   * los árboles y arbustos que coincidan con el trazado de carreteras construidas.
   */
  public updateFoliageInstances(): void {
    if (this.roadGraph.nodes.size === 0) {
      this.foliageManager.setFoliage(this.baseFoliagePoints);
      return;
    }

    const cs = this.terrainData.cellSize;
    const halfW = (this.terrainData.width * cs) / 2;
    const halfH = (this.terrainData.height * cs) / 2;
    const roadClearanceSq = 4.2 * 4.2;

    const filtered = this.baseFoliagePoints.filter((pt) => {
      for (const node of this.roadGraph.nodes.values()) {
        const nx = (node.x + 0.5) * cs - halfW;
        const nz = (node.z + 0.5) * cs - halfH;
        const distSq = (pt.x - nx) * (pt.x - nx) + (pt.z - nz) * (pt.z - nz);
        if (distSq < roadClearanceSq) return false;
      }
      return true;
    });

    this.foliageManager.setFoliage(filtered);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.initWorld(1337, 256, 256);
    this.lastTime = performance.now();

    const animate = (time: number) => {
      if (!this.isRunning) return;
      requestAnimationFrame(animate);

      const deltaTime = Math.min((time - this.lastTime) / 1000, 0.1);
      this.lastTime = time;

      if (
        this.activeTool === ActiveTool.TERRAFORM &&
        this.isMouseDown &&
        this.mouseButton === 0 &&
        this.hasHitPoint &&
        this.currentBrushSettings.tool !== TerraformTool.NONE &&
        this.terrain
      ) {
        // Restricción: la brocha solo modifica terreno dentro de parcelas desbloqueadas (Cities: Skylines)
        const bounds = TerrainModifier.applyBrush(
          this.terrainData.heights,
          this.terrainData.width,
          this.terrainData.height,
          this.terrainData.cellSize,
          this.currentHitPoint.x,
          this.currentHitPoint.z,
          this.currentBrushSettings,
          deltaTime,
          (gx, gz) => this.cityTileManager.isCellBuildable(gx, gz)
        );

        if (bounds) {
          const [minVX, maxVX, minVZ, maxVZ] = bounds;
          this.terrain.updateRegion(minVX, maxVX, minVZ, maxVZ);

          for (const node of this.roadGraph.nodes.values()) {
            node.elevation = this.getCellElevation(node.x, node.z);
          }
          this.roadMesh.rebuild(this.roadGraph);
          this.zoningManager.generateZoningCells(this.roadGraph, this.getCellElevation);
          this.zoningMesh.rebuild(this.zoningManager, false);
          this.cityBoundaryMesh.rebuild(this.cityTileManager, this.getCellElevation);

          // Sincronizar elevación de árboles afectados por la brocha de terraformación
          const cs = this.terrainData.cellSize;
          const halfW = (this.terrainData.width * cs) / 2;
          const halfH = (this.terrainData.height * cs) / 2;
          for (let i = 0; i < this.baseFoliagePoints.length; i++) {
            const pt = this.baseFoliagePoints[i]!;
            const gx = Math.floor((pt.x + halfW) / cs);
            const gz = Math.floor((pt.z + halfH) / cs);
            if (gx >= minVX && gx <= maxVX && gz >= minVZ && gz <= maxVZ) {
              pt.y = this.getCellElevation(gx, gz);
            }
          }
          this.updateFoliageInstances();

          this.sendToWorker({
            type: 'SYNC_TERRAIN',
            payload: { heights: this.terrainData.heights },
          });
        }
      }

      // 1. Simulación y circulación de vehículos por carretera
      this.trafficManager.update(deltaTime);

      // 2. Crecimiento periódico de edificios en casillas zonificadas
      this.buildingGrowthTimer += deltaTime;
      if (this.buildingGrowthTimer >= 2.5) {
        this.buildingGrowthTimer = 0;
        this.simulateBuildingGrowth();
      }

      this.cameraController.update(deltaTime);
      this.dayNightCycle.update(deltaTime);

      const nightFactor = this.dayNightCycle.nightFactor;
      if (this.terrain) this.terrain.setNightFactor(nightFactor);
      if (this.roadMesh) this.roadMesh.setNightFactor(nightFactor);
      if (this.buildingManager) this.buildingManager.setNightFactor(nightFactor);
      if (this.outerLandscape) this.outerLandscape.setNightFactor(nightFactor);
      if (this.water) {
        this.water.setTime(time * 0.001);
        this.water.setNightFactor(nightFactor);
        this.water.setSunDirection(this.dayNightCycle.sunDirection);
      }

      this.renderer.render(this.scene, this.camera);
    };

    requestAnimationFrame(animate);
  }

  public destroy(): void {
    this.isRunning = false;
    this.worker.terminate();
    this.cameraController.dispose();
    this.dayNightCycle.dispose();
    this.gridCursor.dispose();
    this.brushCursor.dispose();
    this.roadMesh.dispose();
    this.roadPreview.dispose();
    this.roadConstructionHUD.dispose();
    this.zoningMesh.dispose();
    this.trafficManager.dispose();
    this.buildingManager.dispose();
    this.foliageManager.dispose();
    this.cityBoundaryMesh.dispose();
    this.worldGridHelper.dispose();
    if (this.outerLandscape) this.outerLandscape.dispose();
    if (this.terrain) this.terrain.dispose();
    if (this.water) this.water.dispose();
    this.renderer.dispose();
  }
}
