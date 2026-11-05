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
import { MainToolbarUI } from '@ui/main_toolbar_ui';
import { TerraformUI } from '@ui/terraform_ui';
import { RoadToolbarUI } from '@ui/road_toolbar_ui';
import { ActiveTool } from '@core/tools';
import { RoadType, ROAD_CONFIGS } from '@core/graph/road_types';
import { RoadDrawMode } from '@core/graph/road_draw_mode';
import { SplineUtils } from '@core/graph/spline_utils';
import { Vec2 } from '@core/utils/math';
import { TerrainModifier, TerraformTool, BrushSettings } from '@core/terrain/terrain_modifier';
import { TerrainGenerator, TerrainGridData } from '@core/terrain_data';
import { RoadGraph } from '@core/graph/road_graph';
import { AssetManager } from '@render/assets/asset_manager';
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
  private worldGridHelper: WorldGridHelper;
  private gridCursor: GridCursor;
  private brushCursor: BrushCursor;
  private vehiclesGroup: THREE.Group = new THREE.Group();
  private foliageGroup: THREE.Group = new THREE.Group();
  public readonly mainToolbarUI: MainToolbarUI;
  public readonly terraformUI: TerraformUI;
  public readonly roadToolbarUI: RoadToolbarUI;
  private worker: Worker;

  private isRunning: boolean = false;
  private lastTime: number = 0;
  private isMouseDown: boolean = false;
  private mouseButton: number = -1;

  public activeTool: ActiveTool = ActiveTool.INSPECT;
  public selectedRoadType: RoadType = RoadType.LOCAL_2L;
  public selectedDrawMode: RoadDrawMode = RoadDrawMode.STRAIGHT;
  public roadGraph: RoadGraph = new RoadGraph();

  private roadStartCell: { x: number; z: number } | null = null;

  private terrainData: TerrainGridData;
  private currentBrushSettings: BrushSettings = {
    tool: TerraformTool.NONE,
    radius: 6.0,
    strength: 3.5,
    targetHeight: 3.0,
  };

  private currentHitPoint: THREE.Vector3 = new THREE.Vector3();
  private hasHitPoint: boolean = false;

  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouseVec: THREE.Vector2 = new THREE.Vector2();
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  public currentStats: SimulationStats = {
    population: 0,
    money: 50000,
    rDemand: 50,
    cDemand: 30,
    iDemand: 20,
    currentTick: 0,
    totalWaterVolume: 0,
  };

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Escena Three.js
    this.scene = new THREE.Scene();

    // Niebla atmosférica suave y lejana que se funde con el horizonte del HDRI
    this.scene.fog = new THREE.Fog(0xcbe2f2, 220, 850);

    // 2. Cámara y Controller RTS (Ángulo isométrica-perspectiva clásico)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 1000);
    this.cameraController = new CameraController(this.camera, this.container, {
      minPolarAngle: 0.45,
      maxPolarAngle: 1.25,
      dampingFactor: 0.1,
    });

    // 3. Renderer con WebGL optimizado y ToneMapping ACES Filmic calibrado
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05; // Calibrado con el HDRI
    this.container.appendChild(this.renderer.domElement);

    // 4. Ciclo Solar e Iluminación Basada en Imagen (HDRI Poly Haven)
    this.dayNightCycle = new DayNightCycle(this.scene, this.renderer);

    // 5. Cursors 3D & Cuadrícula
    this.gridCursor = new GridCursor(2.0);
    this.scene.add(this.gridCursor.mesh);

    this.brushCursor = new BrushCursor(6.0);
    this.scene.add(this.brushCursor.group);

    this.worldGridHelper = new WorldGridHelper(64, 64, 2.0);
    this.scene.add(this.worldGridHelper.group);

    // Grupos para vehículos y vegetación viva
    this.scene.add(this.vehiclesGroup);
    this.scene.add(this.foliageGroup);

    // 6. Terreno dinámico con multi-textura PBR
    this.terrainData = TerrainGenerator.generate(64, 64, 2.0, 1337);
    this.terrain = new DynamicTerrainMesh(this.terrainData);
    this.scene.add(this.terrain.group);

    // 7. Malla física de agua SWE turquesa
    this.water = new DynamicWaterMesh(64, 64, 2.0);
    this.scene.add(this.water.mesh);

    // 8. Carreteras PBR con bordillos, marcas viales, farolas y árboles
    this.roadMesh = new RoadNetworkMesh(64, 64, 2.0);
    this.scene.add(this.roadMesh.group);

    this.roadPreview = new RoadPreviewMesh(64, 64, 2.0);
    this.scene.add(this.roadPreview.group);

    // Cargar ciudad inicial con red vial y coches
    this.initStarterCity();

    // 9. Interfaces UI
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
      }
    );

    this.mainToolbarUI = new MainToolbarUI(document.body, (tool) => {
      this.activeTool = tool;

      const showGrid = tool === ActiveTool.ROAD || tool === ActiveTool.TERRAFORM;
      this.worldGridHelper.setVisible(showGrid);

      const tPanel = document.getElementById('terraform-panel');
      if (tPanel) {
        tPanel.style.display = tool === ActiveTool.TERRAFORM ? 'flex' : 'none';
      }

      this.roadToolbarUI.setVisible(tool === ActiveTool.ROAD);

      if (tool !== ActiveTool.TERRAFORM) {
        this.brushCursor.setVisible(false);
      }

      if (tool !== ActiveTool.ROAD) {
        this.roadPreview.hide();
        this.roadStartCell = null;
      }
    });

    const tp = document.getElementById('terraform-panel');
    if (tp) tp.style.display = 'none';
    this.roadToolbarUI.setVisible(false);

    // 10. Web Worker
    this.worker = new Worker(new URL('./worker/sim.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.setupWorkerListeners();

    // 11. Eventos de entrada
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

  public initWorld(seed: number = 1337, width: number = 64, height: number = 64): void {
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
    if (gx < 0 || gx >= w || gz < 0 || gz >= h) return 0;
    return this.terrainData.heights[gz * (w + 1) + gx] ?? 0;
  };

  private onMouseDown(event: MouseEvent): void {
    this.isMouseDown = true;
    this.mouseButton = event.button;

    if (event.button === 0 && this.hasHitPoint) {
      const gx = this.gridCursor.currentGridX;
      const gz = this.gridCursor.currentGridZ;

      if (this.activeTool === ActiveTool.ROAD) {
        if (this.selectedDrawMode === RoadDrawMode.ROUNDABOUT) {
          const roundaboutNodes = SplineUtils.generateRoundaboutNodes(gx, gz, 2.5, 12);
          for (let i = 0; i < roundaboutNodes.length; i++) {
            const nextIdx = (i + 1) % roundaboutNodes.length;
            const cur = roundaboutNodes[i]!;
            const nxt = roundaboutNodes[nextIdx]!;
            const elevA = this.getCellElevation(cur.x, cur.z);
            const elevB = this.getCellElevation(nxt.x, nxt.z);
            this.roadGraph.addRoadSegment(cur.x, cur.z, nxt.x, nxt.z, elevA, elevB, RoadType.ONE_WAY_2L);
          }
          this.roadMesh.rebuild(this.roadGraph);
        } else {
          this.roadStartCell = { x: gx, z: gz };
          this.roadPreview.updatePreview(
            gx,
            gz,
            gx,
            gz,
            this.selectedDrawMode,
            this.selectedRoadType,
            this.getCellElevation
          );
        }
      } else if (this.activeTool === ActiveTool.DEMOLISH) {
        const targetNode = this.roadGraph.getNodeAt(gx, gz);
        if (targetNode) {
          this.roadGraph.removeNode(targetNode.id);
          this.roadMesh.rebuild(this.roadGraph);
        }
      }
    }
  }

  private onMouseUp(): void {
    if (this.mouseButton === 0 && this.activeTool === ActiveTool.ROAD && this.roadStartCell) {
      const endX = this.gridCursor.currentGridX;
      const endZ = this.gridCursor.currentGridZ;
      const startX = this.roadStartCell.x;
      const startZ = this.roadStartCell.z;

      const config = ROAD_CONFIGS[this.selectedRoadType];
      let cellsBuilt = 0;

      if (this.selectedDrawMode === RoadDrawMode.CURVE) {
        const sampled = SplineUtils.sampleBezierCells(
          new Vec2(startX, startZ),
          new Vec2(startX, endZ),
          new Vec2(endX, endZ),
          10
        );

        for (let i = 0; i < sampled.length - 1; i++) {
          const cur = sampled[i]!;
          const nxt = sampled[i + 1]!;
          const elevA = this.getCellElevation(cur.x, cur.z);
          const elevB = this.getCellElevation(nxt.x, nxt.z);
          this.roadGraph.addRoadSegment(cur.x, cur.z, nxt.x, nxt.z, elevA, elevB, this.selectedRoadType);
          cellsBuilt++;
        }
      } else {
        const stepX = Math.sign(endX - startX);
        if (stepX !== 0) {
          for (let x = startX; x !== endX; x += stepX) {
            const elevA = this.getCellElevation(x, startZ);
            const elevB = this.getCellElevation(x + stepX, startZ);
            this.roadGraph.addRoadSegment(x, startZ, x + stepX, startZ, elevA, elevB, this.selectedRoadType);
            cellsBuilt++;
          }
        }

        const stepZ = Math.sign(endZ - startZ);
        if (stepZ !== 0) {
          for (let z = startZ; z !== endZ; z += stepZ) {
            const elevA = this.getCellElevation(endX, z);
            const elevB = this.getCellElevation(endX, z + stepZ);
            this.roadGraph.addRoadSegment(endX, z, endX, z + stepZ, elevA, elevB, this.selectedRoadType);
            cellsBuilt++;
          }
        }

        if (startX === endX && startZ === endZ) {
          const elev = this.getCellElevation(startX, startZ);
          this.roadGraph.getOrCreateNode(startX, startZ, elev);
          cellsBuilt++;
        }
      }

      const totalCost = cellsBuilt * config.costPerCell;
      this.currentStats.money = Math.max(0, this.currentStats.money - totalCost);

      this.roadMesh.rebuild(this.roadGraph);
      this.roadPreview.hide();
      this.roadStartCell = null;
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

      const gx = Math.max(0, Math.min(w - 1, Math.floor((this.currentHitPoint.x + halfW) / cs)));
      const gz = Math.max(0, Math.min(h - 1, Math.floor((this.currentHitPoint.z + halfH) / cs)));

      this.gridCursor.currentGridX = gx;
      this.gridCursor.currentGridZ = gz;

      const cx = (gx + 0.5) * cs - halfW;
      const cz = (gz + 0.5) * cs - halfH;
      const elev = this.getCellElevation(gx, gz);
      this.gridCursor.mesh.position.set(cx, elev + 0.05, cz);

      // Resaltar plantilla de celda activa en el grid helper
      if (this.activeTool === ActiveTool.ROAD || this.activeTool === ActiveTool.TERRAFORM) {
        this.worldGridHelper.highlightCell(gx, gz, elev);
      }

      const isTerraforming = this.activeTool === ActiveTool.TERRAFORM && this.currentBrushSettings.tool !== TerraformTool.NONE;
      this.gridCursor.mesh.visible = !isTerraforming;
      this.brushCursor.setVisible(isTerraforming);
      this.brushCursor.setPosition(this.currentHitPoint.x, elev, this.currentHitPoint.z);

      if (this.activeTool === ActiveTool.ROAD) {
        if (this.selectedDrawMode === RoadDrawMode.ROUNDABOUT) {
          this.roadPreview.updatePreview(
            gx,
            gz,
            gx,
            gz,
            RoadDrawMode.ROUNDABOUT,
            this.selectedRoadType,
            this.getCellElevation
          );
        } else if (this.isMouseDown && this.mouseButton === 0 && this.roadStartCell) {
          this.roadPreview.updatePreview(
            this.roadStartCell.x,
            this.roadStartCell.z,
            gx,
            gz,
            this.selectedDrawMode,
            this.selectedRoadType,
            this.getCellElevation
          );
        }
      }
    } else {
      this.hasHitPoint = false;
      this.gridCursor.mesh.visible = false;
      this.brushCursor.setVisible(false);
      this.roadPreview.hide();
    }
  }

  private updateHUD(): void {
    const hudElem = document.getElementById('hud-stats');
    if (hudElem) {
      const timeOfDay = Math.floor(this.dayNightCycle.getTime() * 24);
      const minutes = Math.floor((this.dayNightCycle.getTime() * 24 * 60) % 60);
      const timeStr = `${timeOfDay.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      const roadCount = this.roadGraph.edges.size;
      const config = ROAD_CONFIGS[this.selectedRoadType];
      const roadInfo = this.activeTool === ActiveTool.ROAD ? ` | 🛣️ [${this.selectedDrawMode}] ${config.name}` : '';

      hudElem.innerText = `🕒 ${timeStr} | 🛣️ Tramos: ${roadCount} | 🌊 Agua: ${this.currentStats.totalWaterVolume.toLocaleString()}m³ | 💵 $${this.currentStats.money.toLocaleString()} | 🔄 Tick: ${this.currentStats.currentTick} | 🛠️ [${this.activeTool}]${roadInfo}`;
    }
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private async initStarterCity(): Promise<void> {
    // 1. Trazado vial inicial inspirado en la composición costera de Fable Cities
    const coastalWay = [
      { x: 18, z: 38 },
      { x: 24, z: 38 },
      { x: 30, z: 40 },
      { x: 36, z: 44 },
      { x: 42, z: 48 },
    ];
    for (let i = 0; i < coastalWay.length - 1; i++) {
      const a = coastalWay[i]!;
      const b = coastalWay[i + 1]!;
      const elA = this.getCellElevation(a.x, a.z);
      const elB = this.getCellElevation(b.x, b.z);
      this.roadGraph.addRoadSegment(a.x, a.z, b.x, b.z, elA, elB, RoadType.AVENUE_4L);
    }

    // Puente escénico que cruza la laguna hacia la avenida costera
    const bridgeWay = [
      { x: 10, z: 34 },
      { x: 14, z: 36 },
      { x: 18, z: 38 },
    ];
    for (let i = 0; i < bridgeWay.length - 1; i++) {
      const a = bridgeWay[i]!;
      const b = bridgeWay[i + 1]!;
      const elA = this.getCellElevation(a.x, a.z);
      const elB = this.getCellElevation(b.x, b.z);
      this.roadGraph.addRoadSegment(a.x, a.z, b.x, b.z, elA, elB, RoadType.LOCAL_2L);
    }

    // Cuadrícula central de calles urbanas conectando con el interior
    const crossGrid = [
      { x1: 30, z1: 40, x2: 30, z2: 32 },
      { x1: 30, z1: 32, x2: 30, z2: 24 },
      { x1: 36, z1: 44, x2: 36, z2: 32 },
      { x1: 36, z1: 32, x2: 36, z2: 24 },
      { x1: 22, z1: 32, x2: 30, z2: 32 },
      { x1: 30, z1: 32, x2: 36, z2: 32 },
      { x1: 36, z1: 32, x2: 44, z2: 32 },
      { x1: 22, z1: 24, x2: 30, z2: 24 },
      { x1: 30, z1: 24, x2: 36, z2: 24 },
      { x1: 36, z1: 24, x2: 44, z2: 24 },
    ];

    for (const seg of crossGrid) {
      const elA = this.getCellElevation(seg.x1, seg.z1);
      const elB = this.getCellElevation(seg.x2, seg.z2);
      this.roadGraph.addRoadSegment(seg.x1, seg.z1, seg.x2, seg.z2, elA, elB, RoadType.LOCAL_2L);
    }

    this.roadMesh.rebuild(this.roadGraph);

    // 2. Colocación de vehículos GLB de la librería
    const assets = AssetManager.getInstance();
    const vehicleUrls = [
      '/assets/simulation/models/sedan.glb',
      '/assets/simulation/models/suv.glb',
      '/assets/simulation/models/police.glb',
      '/assets/simulation/models/van.glb',
      '/assets/simulation/models/delivery.glb',
      '/assets/simulation/models/truck.glb',
    ];

    const w = this.terrainData.width;
    const h = this.terrainData.height;
    const cs = this.terrainData.cellSize;
    const offsetX = (w * cs) / 2;
    const offsetZ = (h * cs) / 2;

    let vIdx = 0;
    for (const edge of this.roadGraph.edges.values()) {
      if (vIdx >= 12) break;
      const nA = this.roadGraph.nodes.get(edge.fromNodeId);
      const nB = this.roadGraph.nodes.get(edge.toNodeId);
      if (!nA || !nB) continue;

      const url = vehicleUrls[vIdx % vehicleUrls.length]!;
      try {
        const model = await assets.loadGLTF(url);
        const px = ((nA.x + nB.x) * 0.5 + 0.5) * cs - offsetX;
        const pz = ((nA.z + nB.z) * 0.5 + 0.5) * cs - offsetZ;
        const py = Math.max(1.5, (nA.elevation + nB.elevation) * 0.5) + 0.08;

        const dx = nB.x - nA.x;
        const dz = nB.z - nA.z;
        const angle = Math.atan2(dz, dx);

        model.position.set(px, py, pz);
        model.rotation.y = -angle + Math.PI / 2;
        model.scale.set(0.65, 0.65, 0.65);
        this.vehiclesGroup.add(model);
      } catch (e) {
        console.warn('Error loading vehicle:', e);
      }
      vIdx++;
    }

    // 3. Arbolado y vegetación adicional
    try {
      const bushModel = await assets.loadGLTF('/assets/shared/models/wild_rooibos_bush/wild_rooibos_bush_1k.gltf');
      const plantSpots = [
        { x: 19, z: 39 }, { x: 23, z: 39 }, { x: 29, z: 41 }, { x: 35, z: 45 },
        { x: 41, z: 49 }, { x: 25, z: 31 }, { x: 27, z: 33 }, { x: 35, z: 31 },
        { x: 37, z: 33 }, { x: 29, z: 23 }, { x: 37, z: 23 }, { x: 13, z: 35 },
      ];
      for (const spot of plantSpots) {
        const b = bushModel.clone(true);
        const bx = (spot.x + 0.5) * cs - offsetX;
        const bz = (spot.z + 0.5) * cs - offsetZ;
        const by = this.getCellElevation(spot.x, spot.z);
        b.position.set(bx, by, bz);
        b.scale.set(0.55, 0.55, 0.55);
        this.foliageGroup.add(b);
      }
    } catch (e) {
      console.warn('Error placing foliage:', e);
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.initWorld();
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
        const bounds = TerrainModifier.applyBrush(
          this.terrainData.heights,
          this.terrainData.width,
          this.terrainData.height,
          this.terrainData.cellSize,
          this.currentHitPoint.x,
          this.currentHitPoint.z,
          this.currentBrushSettings,
          deltaTime
        );

        if (bounds) {
          const [minVX, maxVX, minVZ, maxVZ] = bounds;
          this.terrain.updateRegion(minVX, maxVX, minVZ, maxVZ);

          for (const node of this.roadGraph.nodes.values()) {
            node.elevation = this.getCellElevation(node.x, node.z);
          }
          this.roadMesh.rebuild(this.roadGraph);

          this.sendToWorker({
            type: 'SYNC_TERRAIN',
            payload: { heights: this.terrainData.heights },
          });
        }
      }

      this.cameraController.update(deltaTime);
      this.dayNightCycle.update(deltaTime);
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
    this.worldGridHelper.dispose();
    if (this.terrain) this.terrain.dispose();
    if (this.water) this.water.dispose();
    this.renderer.dispose();
  }
}
