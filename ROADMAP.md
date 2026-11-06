# Roadmap: City Builder 3D (Web & Desktop) - v1.0 Completa

> Roadmap exhaustivo para el desarrollo y lanzamiento de un simulador y constructor de ciudades estilo *CityRT*, *SimCity* y *Cities: Skylines*, con estética visual de alta fidelidad (**Fable Cities** / *Cities: Skylines II*), renderizado 3D acelerado (WebGL/WebGPU) con Three.js, **física de fluidos e hidrodinámica realista (SWE)**, **terraformación completa**, arquitectura desacoplada en Web Workers y empaquetado híbrido Web + Desktop (Tauri v2 + TypeScript).

---

## 🏛️ 1. Visión Técnica y Arquitectura General

* **Lenguaje:** TypeScript (Strict mode en todo el stack).
* **Render Engine:** Three.js con soporte WebGL 2.0 y abstracción WebGPU (usando `WebGPURenderer` / TSL).
* **Simulación:** Arquitectura desacoplada basada en ECS (Entity Component System) + Solver Hidrodinámico 2.5D (Shallow Water Equations) ejecutado en un **Web Worker** dedicado con paso de mensajes vía buffers transferibles (`ArrayBuffer` / `Float32Array`) para garantizar 60+ FPS estables en el hilo de render.
* **Arquitectura de Terreno de Dos Niveles (Two-Tier World Generation):**
  1. **Nivel 1: Cuadrícula Activa y Jugable (Active Editable Grid):** Terreno continuo de alta precisión donde operan el solver de fluidos SWE, el trazado de carreteras, las brochas de terraformación y la zonificación urbana.
  2. **Nivel 2: Terreno Distante y Falda del Horizonte (Backdrop Horizon Skirt):** Malla periférica panorámica de baja resolución que se extiende desde los límites del área activa hasta 12km - 20km en todas direcciones, proyectando cordilleras lejanas, colinas y océano abierto continuo. Al alejar la cámara o mirar en cualquier ángulo, **el mundo nunca se corta en un vacío negro ni muestra aristas de fin de mapa**, fusionándose orgánicamente con la niebla atmosférica y el cielo HDRI.
* **Restricción Cinemática de Cámara (Camera Soft & Hard Bounds):**
  - Caja elástica de desplazamiento (*Pan Bounding Box*) que confina suavemente el punto focal (*target*) de la cámara dentro de las parcelas adquiridas y exploradas, impidiendo que el jugador se desplace hacia el vacío infinito.
  - Distancia focal máxima (*Max Distance*) y ángulo polar calibrados para mantener siempre el horizonte dentro del frustum de visión.
* **Sistema de Macro-Parcelas de Escala Real (Real-Scale City Tiles & Territory Expansion):**
  - **Superación de parcelas mínimas:** Una ciudad no puede constreñirse a pequeñas parcelas de prueba ($64\text{m} \times 64\text{m}$). Se adopta una escala métrica realista inspirada en *Cities: Skylines* ($1.92\text{km} \times 1.92\text{km}$ por tile) y *Cities: Skylines II* ($600\text{m} \times 600\text{m}$ por tile).
  - **Macro-Tiles de $512\text{m} \times 512\text{m}$ a $1\text{km} \times 1\text{km}$:** Una sola macro-parcela ofrece suficiente extensión territorial ($0.26\text{km}^2$ a $1.0\text{km}^2$) para albergar más de 100 manzanas urbanas, bulevares principales, distritos de rascacielos Downtown, zonas industriales y servicios públicos para decenas de miles de habitantes.
  - **Progresión Territorial por Hitos (*Milestones*):** Inicio con 1 macro-parcela inicial idónea (Start Tile) y expansión progresiva comprando sectores contiguos mediante regla de adyacencia estricta, coste basado en orografía y recursos, y tasa de mantenimiento de suelo (*Tile Upkeep*).
* **Física y Fluidos:** Simulación real de agua SWE 2.5D que fluye por gravedad, llena valles, inunda zonas bajas, interactúa con presas, bombas y terraformación dinámica.
* **Packaging:** 
  * **Web:** SPA optimizada (Vite + WebGL/WebGPU).
  * **Desktop:** Tauri v2 con backend ligero en Rust, soporte offline, guardado en `%APPDATA%` / `~/.config` y ventana de alto rendimiento.
* **Target v1.0:** Simulación fluida con hasta 50.000 ciudadanos, red vial multimodal con A*, terraformación en vivo, física de agua y drenaje, zonificación RCI, economía profunda, servicios públicos y desastres naturales.

```mermaid
flowchart TD
    subgraph UI ["Capa de Interfaz (DOM / Canvas UI)"]
        HUD["HUD / Menú de Construcción & Herramientas"]
        TerraformUI["Panel de Terraformación & Brochas"]
        AreasUI["Panel Cartográfico de Áreas & Macro-Parcelas"]
        Stats["Paneles Estadísticos & RCI & Presupuesto"]
    end

    subgraph MainThread ["Hilo Principal (Render & Input)"]
        InputMgr["Input Manager (Mouse / Teclado / Hotkeys)"]
        CamCtrl["Camera Controller (Pan Bounds & Damping)"]
        RenderEng["Motor Gráfico (Three.js WebGL / WebGPU)"]
        TerrainMesh["Malla Activa de Terreno & Superficie de Agua"]
        HorizonSkirt["Falda de Terreno Distante (Horizon Backdrop Mesh)"]
        BoundaryMesh["Límites de Ciudad & Balizas de Término"]
        Instancing["InstancedMesh Manager (Edificios, Árboles, Coches)"]
    end

    subgraph SimWorker ["Web Worker (Simulación, ECS & Física)"]
        ECS["Motor ECS (BiteCS / Javelin)"]
        WaterSolver["Solver Físico SWE (Shallow Water Equations)"]
        TileMgr["CityTileManager (Macro-Tiles & Bounds)"]
        RoadGraph["Grafo Vial & Pathfinding (A* / Flowfields)"]
        SimSystems["Sistemas: RCI, Tráfico, Servicios, Finanzas, Desastres"]
    end

    UI <--> InputMgr
    InputMgr -->|Acciones de usuario (Zonar, Terraformar, Construir, Comprar Tiles)| SimWorker
    SimWorker -->|Buffers transferibles: Alturas, Agua, Entidades| MainThread
    MainThread --> RenderEng
    RenderEng --> TerrainMesh
    RenderEng --> HorizonSkirt
    RenderEng --> BoundaryMesh
    RenderEng --> Instancing
```

---

## 🗺️ 2. Fases de Desarrollo hacia la v1.0

### Fase 0: Setup, Infraestructura y Tooling Base
- [x] **Scaffolding inicial:**
  - Configuración de proyecto modular con `pnpm` y `vite`.
  - Configuración estricta de `tsconfig.json` (`strict`, `noImplicitAny`, paths limpios `@core`, `@render`, etc.).
  - Configuración de suite de pruebas y benchmarks con `vitest`.
- [x] **Arquitectura y Mantenibilidad:**
  - Inclusión de principios de Mantenibilidad, Modularidad y Zero-Allocation Loops en `AGENTS.md`.
  - Protocolo de mensajería tipada `MainToWorkerMessage` y `WorkerToMainMessage`.
- [x] **Arquitectura de Loop Dual:**
  - `Simulation Loop`: Tick rate fijo (20 Hz / 50ms) en Web Worker dedicado.
  - `Render Loop`: Desacoplado con Three.js en el Main Thread sin bloqueo de frames.
- [x] **Fundamentos de Rendimiento Core:**
  - PRNG determinista con semilla (Mulberry32).
  - Matemáticas vectoriales desacopladas (`Vec2`, `clamp`, `smoothstep`, `damp`, `wrapAngle`).
  - Módulo de ruido determinista `SimplexNoise` (2D/3D, `fbm2D`, `ridged2D`).
  - Pool genérico de objetos (`ObjectPool`) para reutilización de memoria.

---

### Fase 1: Motor Gráfico, Terreno y Cámara (MVP Gráfico)
- [x] **Controlador de Cámara Isométrica / RTS:**
  - Pan con WASD / flechas con velocidad adaptada a la distancia focal (`panSpeed * distance`).
  - Zoom suave focalizado hacia el cursor y rotación azimutal (Q/E o botón derecho).
  - Amortiguación exponencial suave (*damping* independiente de la tasa de refresco).
  - Restricción de colisión con el suelo (`minHeightAboveGround`).
  - Zero alocaciones en el bucle de render mediante vectores prealocados.
- [x] **Generación y Render del Terreno Continuo (Zero Cuadrados / Zero Facetas):**
  - Malla indexada compartida `DynamicTerrainMesh` que elimina facetas triangulares y aspecto de cuadrícula.
  - Normales analíticas suaves calculadas por diferencias centrales: $n_x = -(h_{R} - h_{L})/(2 \cdot \Delta x)$, $n_z = -(h_{U} - h_{D})/(2 \cdot \Delta z)$.
  - Splatting multiescala PBR con textura de ruido orgánico continuo (hierba viva, tierra fértil, arena de playa, roca triplanar y nieve alpina).
  - Franja húmeda oscurecida en la orilla que se funde con el nivel del mar.
- [x] **Iluminación Dinámica y Ciclo Día/Noche:**
  - Efemérides solares y lunares continuas en `DayNightCycle`.
  - Carga de HDRI Poly Haven (`kloofendal_48d_partly_cloudy_puresky_1k.hdr`) con prefiltrado PMREM.
  - Sombras suaves en tiempo real (`PCFShadowMap`) calibradas con `normalBias = 0.025` y `bias = -0.0001` (cero shadow acne).
  - Tone mapping ACES Filmic (`exposure = 1.08`) y niebla atmosférica lejana (`Fog`).
- [x] **Cursor de Cuadrícula 3D:**
  - Indicador 3D invisible en modo inspección; solo se proyecta al activar herramientas de construcción o demolición.
- [x] **Mundo sin Cortes / Paisaje Continuo Extendido hasta 14 km (*Outer Landscape & Geomorphological Model*):**
  - **Generador Geomorfológico Unificado:** En [`NaturalLandscapeGenerator`](file:///home/dev/projects/city-builder/src/core/terrain/natural_landscape_generator.ts), el relieve se calcula mediante una función matemática analítica unificada $H(wx, wz)$ continua que gobierna tanto la cuadrícula activa como el horizonte exterior hasta $14\text{ km}$, con cordilleras alpinas en el cuadrante norte/noroeste, valle central fértil, cuenca fluvial continua, lagunas y litoral.
  - **Malla de Paisaje Panorámica (`OuterLandscapeMesh`):** En [`OuterLandscapeMesh`](file:///home/dev/projects/city-builder/src/render/terrain/outer_landscape_mesh.ts), malla radial concéntrica logarítmica (16 anillos $\times$ 96 sectores = 1.632 vértices) que transiciona suavemente de una silueta cuadrada en el borde del terreno activo a un círculo exterior de $14\text{km}$.
  - **Shader PBR Idéntico:** Comparte exactamente el mismo shader PBR con splatting multiescala, texturas y proyección triplanar en roca que el terreno activo. Cero cortes, costuras o diferencias cromáticas entre la zona activa y el horizonte.
  - **Océano y Superficie Acuática Continua:** Disco de mar exterior en [`DynamicWaterMesh`](file:///home/dev/projects/city-builder/src/render/terrain/dynamic_water_mesh.ts) que se extiende hasta 14 km con las mismas ondas animadas y reflejos celestes.
  - **Fusión Atmosférica Suave:** Configuración de niebla volumétrica lejana (`THREE.Fog(0xb5dcfa, 320, 11000)`) sincronizada con el ciclo solar en `DayNightCycle`, desvaneciendo suavemente la geometría lejana en el color del cielo y el HDRI sin artefactos de recorte (*clipping*).
- [x] **Límites Dinámicos de Cámara (*Camera Frustum & Bounding Volume*):**
  - **Pan Bounding Box:** Restricción elástica del punto de enfoque de la cámara (`target.x`, `target.z`) en [`CameraController`](file:///home/dev/projects/city-builder/src/render/camera/camera_controller.ts) dentro de la caja de límites acotada al territorio explorado y adquirido (con margen suave elástico para encuadrar la periferia).
  - **Techo y Distancia de Cámara:** Límite de alejamiento de zoom (*maxDistance* = 1200m) y frustum far (14.000m) calibrados para que el jugador pueda contemplar panorámicamente el vasto paisaje mientras su movimiento horizontal permanece anclado a la ciudad.
- [x] **Configuración Paramétrica Pre-Partida y Panel Interactivo (`LandscapeConfig` & `LandscapeGeneratorUI`):**
  - Panel interactivo en [`LandscapeGeneratorUI`](file:///home/dev/projects/city-builder/src/ui/landscape_generator_ui.ts) accesible mediante la tecla `P` o el botón en [`MainToolbarUI`](file:///home/dev/projects/city-builder/src/ui/main_toolbar_ui.ts).
  - Ajuste de cordilleras (`mountainIntensity`), extensión litoral (`coastExtent`), balance de acantilados vs playas (`cliffIntensity`), anchura de ríos (`riverWidth`) y semilla determinista (`seed`).
  - Presets predefinidos: *Valle Costero Alpino* (`COASTAL_VALLEY`), *Tierras Altas y Cañones* (`MOUNTAIN_HIGHLANDS`), *Llanuras y Praderas Suaves* (`ROLLING_PLAINS`) y *Costa de Acantilados* (`RUGGED_COAST`).
  - Regeneración en caliente (`Engine.regenerateWorld(config)`) que reconstruye relieve, mar, vegetación mundial y parcelas en tiempo real.
- [x] **Morfología Costera Realista: Playas de Arena Dorada vs. Acantilados Rocosos:**
  - Donde el terreno se encuentra con el agua en pendiente suave ($\text{slope} \le 0.18$), la orilla genera extensas playas de arena dorada con franja húmeda intermareal.
  - En salientes, promontorios y gargantas escarpadas ($\text{slope} \ge 0.26$), el agua choca directamente contra acantilados verticales de roca viva con texturizado triplanar y zócalo batido por olas.
- [x] **Generación de Vegetación y Arbolado del Mundo Entero (`FoliageGenerator`):**
  - Generación bioclimática en [`FoliageGenerator`](file:///home/dev/projects/city-builder/src/core/world/foliage_generator.ts) con más de 2.000 árboles y 800 arbustos distribuidos por todos los cuadrantes del mapa.
  - Exclusiones ecológicas: ningún árbol en agua, playas de arena, acantilados escarpados o cumbres de nieve.
  - Despeje y tala automática en un radio de 4.2m alrededor del trazado vial al construir carreteras.

---

### Fase 1.5: Terraformación Completa y Física de Fluidos (Agua Realista)
*(Inspirado en Cities: Skylines, CityRT y From Dust)*

- [x] **Herramientas de Terraformación Dinámica en Vivo:**
  - **Brochas completas:** Elevar (`RAISE`), Hundir (`LOWER`), Allanar a cota fija (`FLATTEN`) y Suavizar desniveles (`SMOOTH`) en [`TerrainModifier`](file:///home/dev/projects/city-builder/src/core/terrain/terrain_modifier.ts).
  - Algoritmo con atenuación radial cosenoidal (*falloff* suave) para evitar bordes dentados.
  - Interfaz de usuario interactiva [`TerraformUI`](file:///home/dev/projects/city-builder/src/ui/terraform_ui.ts) con sliders para radio (2m a 18m), fuerza y altura objetivo.
  - Indicador 3D visual en tiempo real [`BrushCursor`](file:///home/dev/projects/city-builder/src/render/terrain/brush_cursor.ts) con feedback de color según la brocha.
  - Actualización reactiva sobre GPU con [`DynamicTerrainMesh`](file:///home/dev/projects/city-builder/src/render/terrain/dynamic_terrain_mesh.ts) recalculando normales e iluminación sin caídas de FPS.
  - **Restricción de Terraformación por Límites Municipales:** La brocha solo modifica celdas pertenecientes a parcelas desbloqueadas, impidiendo alterar el relieve fuera del territorio municipal.
- [x] **Simulación Física de Fluidos (Shallow Water Equations - SWE 2.5D):**
  - **Solver Hidrodinámico en Web Worker:**
    - Cuadrícula acoplada con conservación estricta de masa y momento vectorial en [`ShallowWaterSolver`](file:///home/dev/projects/city-builder/src/core/water/shallow_water_solver.ts).
    - Presión hidrostática continua ($g = 9.81 \, m/s^2$) que hace fluir el agua desde cotas altas a bajas buscando el equilibrio.
    - Amortiguación viscosa para prevenir inestabilidades numéricas.
  - **Fuentes y Manantiales:**
    - Generadores de agua ajustables con caudal dinámico ($m^3/s$) y sumideros en los bordes del mapa.
  - **Interacción Terreno <-> Agua en Vivo:**
    - Modificar el lecho mediante la brocha desplaza y redistribuye el caudal físico en tiempo real.
  - **Malla de Agua Dinámica Suave (`DynamicWaterMesh`):**
    - Malla indexada continua con IOR 1.333, rugosidad 0.04 y normales animadas de oleaje (`uTime`).
    - Rampa de absorción física por profundidad (turquesa esmeralda $\to$ azul profundo $\to$ marino abisal).
    - Orla de espuma suave anti-aliasing sobre la línea de rompiente de la playa.
    - Métrica en HUD con el volumen total de agua en circulación.

---

### Fase 2: Red Vial, Infraestructura y Sistema de Parcelas de Ciudad
- [x] **Diseño y Colocación de Carreteras (Clon de Mecánicas CityRT):**
  - **Trazado recto a CUALQUIER ÁNGULO directo:** Desacoplado de la cuadrícula rígida de Manhattan; libre ángulo continuo con subdivisión adaptativa de estaciones al relieve cada 1.5m.
  - **Snapping Magnético Angular:** Atracción magnética a 0°, 45°, 90°, 135°, 180°, etc. con margen de $\pm 6.5^\circ$, facilitando trazados en retícula u ortogonales sin esfuerzo.
  - **Snapping Magnético a Nodos y Aristas:** Detección de proximidad con anillo indicador luminoso ámbar (*Snap Ring*) proyectado sobre el nodo o arista más cercana.
  - **División Automática de Aristas (*Edge Splitting*):** Al entroncar una nueva calle en medio de un tramo existente, el segmento se divide automáticamente creando una intersección en T o cruz de 4 vías.
  - **HUD Flotante de Construcción en Tiempo Real ([`RoadConstructionHUD`](file:///home/dev/projects/city-builder/src/ui/road_construction_hud.ts)):** Posicionado dinámicamente junto al cursor, muestra longitud métrica, ángulo con snapping, coste en dólares, nivel de elevación y badge de validez o motivo de bloqueo.
  - **Control de Elevación de Rasante:** Teclas `E` (subir) y `Q` (bajar) o botones UI para alternar entre Suelo (0m), Viaducto (+6m) y Puente (+12m).
  - **Autovía Regional de Entrada (*Starter Highway Connection*):** Conexión inicial de 4 carriles (Avenida/Autovía) que ingresa desde el límite del mapa hacia la parcela inicial para conectar la primera vía urbana del jugador.
  - Cruces e intersecciones con **fans radiales circulares** (cero facetas cuadradas en intersecciones).
  - Aceras elevadas de losas de piedra PBR `paving_slabs` con bordillos achaflanados de 17cm.
  - Marcas viales analíticas en fragment shader con anti-aliasing por `fwidth` (líneas discontinuas centrales y de borde).
  - Charcos cálidos de luz nocturna proyectados por las farolas en la calzada.
- [x] **Jerarquía Vial Multitipo:**
  - Calle Local (2L, 40 km/h), Sentido Único (2L, 50 km/h, marcas amarillas), Avenida 4 Carriles (4L, 70 km/h, doble línea central) y Autopista rápida (4L, 100 km/h).
  - Panel interactivo [`RoadToolbarUI`](file:///home/dev/projects/city-builder/src/ui/road_toolbar_ui.ts) con modos Recto, Curva Bézier y Rotondas automáticas.
- [x] **Grafo Vial Dirigido & Pathfinding A\* Ponderado por Velocidad:**
  - Algoritmo A\* con pooling de memoria en [`AStarPathfinder`](file:///home/dev/projects/city-builder/src/core/graph/astar_pathfinder.ts).
- [x] **Puentes y Pilares Automáticos:**
  - Al cruzar agua o vaguadas ($h \le 1.8\text{m}$), la calzada se sobreeleva y proyecta pilares de hormigón.
- [x] **Sistema Inicial de Parcelas y Límites de Ciudad ([`CityTileManager`](file:///home/dev/projects/city-builder/src/core/world/city_tile_manager.ts)):**
  - Malla de parcelas con parcela inicial desbloqueada (Start Tile).
  - Cinta de límites de ciudad y balizas esquinadas en [`CityBoundaryMesh`](file:///home/dev/projects/city-builder/src/render/terrain/city_boundary_mesh.ts).
  - Restricción estricta de colocación de carreteras: el previsualizador [`RoadPreviewMesh`](file:///home/dev/projects/city-builder/src/render/terrain/road_preview_mesh.ts) se ilumina en rojo (`#ff3333`) y bloquea la construcción si se intenta edificar fuera de suelo adquirido.
  - Panel interactivo [`AreasUI`](file:///home/dev/projects/city-builder/src/ui/areas_ui.ts) para inspeccionar y comprar parcelas adyacentes.
  - Botón de acceso directo `🗺️ Áreas (6)` en [`MainToolbarUI`](file:///home/dev/projects/city-builder/src/ui/main_toolbar_ui.ts).
- [x] **Evolución a Macro-Parcelas de Escala Real (Real-Scale City Expansion):**
  - **Escala de Macro-Tile Realista:** Macro-parcelas a escala de **$128\text{m} \times 128\text{m}$ ($1.64\text{ ha}$) hasta $256\text{m} \times 256\text{m}$ ($6.55\text{ ha}$)** en [`CityTileManager`](file:///home/dev/projects/city-builder/src/core/world/city_tile_manager.ts), proporcionando superficie holgada para asentar una ciudad entera con distritos, barrios, avenidas y servicios en una sola macro-parcela inicial.
  - **Matriz de Expansión Territorial:** Rejilla activa de macro-tiles con sector inicial en el valle fértil costero, ampliable progresivamente mediante compra de sectores contiguos con comprobación de adyacencia estricta.
  - **Progresión por Hitos Demográficos (*City Milestones*):**
    - Desbloqueo de licencias de compra de parcelas conforme la ciudad alcanza metas poblacionales (`CITY_MILESTONES`): *Pionero* (1 parcela), *Aldea* (2 parcelas), *Pueblo* (4 parcelas), *Villa Próspera* (6 parcelas), *Ciudad* (9 parcelas) y *Gran Metrópolis* (hasta 16 parcelas).
  - **Economía de Adquisición y Mantenimiento Territorial:**
    - Coste de compra dinámico basado en la orografía y presencia de recursos naturales clave (caudales fluviales, costa marítima, llanuras construibles, masa forestal).
    - Tasa de mantenimiento de suelo (*Tile Upkeep Cost*): coste administrativo semanal por parcela adquirida (`upkeepWeekly` y `getTotalWeeklyUpkeep()`).
  - **Capa Cartográfica de Información de Parcelas (*Tile Resource Overlay*):**
    - Panel temático interactivo [`AreasUI`](file:///home/dev/projects/city-builder/src/ui/areas_ui.ts) mostrando dimensiones métricas y hectáreas, suelo edificable plano vs montañoso, masa de agua, cobertura forestal y coste de mantenimiento.

---

### Fase 3: Zonificación y Construcción de Edificios (RCI + Assets Modulares)
- [x] **Herramienta y Cuadrícula de Zonificación RCI (Estilo CityRT / Cities: Skylines):**
  - **Generación Automática de Casillas:** En [`ZoningManager`](file:///home/dev/projects/city-builder/src/core/zoning/zoning_manager.ts), casillas de 4m x 4m alineadas perpendicularmente a cada calle trazada (hasta 4 casillas de profundidad a ambos lados).
  - **Renderizado 3D de Cuadrícula ([`ZoningMesh`](file:///home/dev/projects/city-builder/src/render/zoning/zoning_mesh.ts)):** Malla translúcida sobre el relieve proyectando los colores RCI (Verde Residencial, Azul Comercial, Naranja Industrial, Blanco disponible).
  - **Panel de Zonificación Interactivo ([`ZoningToolbarUI`](file:///home/dev/projects/city-builder/src/ui/zoning_toolbar_ui.ts)):** Accesible con botón `🏘️ Zonas (3)` y atajos rápidos `R` (Residencial), `C` (Comercial), `I` (Industrial) y `X` (Deszonar), con pintura interactiva por arrastre de ratón.
- [x] **Pipeline de Crecimiento de Edificios:**
  - Desarrollo procedimental en tiempo real: viviendas suburbanas con tejados cerámicos inclinados (`suburb`), locales y oficinas comerciales (`commercial`) y naves industriales de chapa ondulada (`industrial`).
  - Incremento demográfico progresivo reflejado en el HUD conforme crecen nuevas viviendas.
- [x] **Skyline Downtown e Instanciación Masiva ([`BuildingManager`](file:///home/dev/projects/city-builder/src/render/buildings/building_manager.ts)):**
  - Rascacielos acristalados Downtown (40m - 98m) con vidrio reflectante (`facade_glass`), casetones técnicos y antenas.
  - Iluminación nocturna de oficinas mediante mapa de emisión PBR (`facade_glass_night/emission.jpg`).
  - Bloques de media altura de ladrillo visto (`bricks_red`) y revoco (`plaster_modern`).
  - Viviendas unifamiliares con tejados inclinados de teja cerámica tradicional (`roof_tiles_clay`).
  - Cero caídas de FPS mediante renderizado agrupado por `THREE.InstancedMesh`.

---

### Fase 4: Simulación de Tráfico, Ciudadanos y Agentes (Micro-Simulación)
- [x] **Gestor de Tráfico y Circulación Vehicular ([`TrafficManager`](file:///home/dev/projects/city-builder/src/core/traffic/traffic_manager.ts)):**
  - Vehículos reales navegando por el carril derecho de las calzadas a velocidades reguladas.
  - Modelos GLB PBR integrados desde `assets/simulation/models/`: `sedan.glb`, `suv.glb`, `van.glb`, `police.glb`, `delivery.glb`.
  - Spawner dinámico desde los extremos de la autovía regional hacia las zonas urbanizadas de la ciudad.
- [ ] **Ciclo de Vida de los Ciudadanos (Sims Individuales):**
  - Cada ciudadano posee hogar, trabajo o colegio, y actividades de ocio/compras.
  - Algoritmo de elección de transporte: Caminar, coche privado, o transporte público según tiempos estimados de llegada.
- [ ] **Comportamiento Vehicular Inteligente Avanzado:**
  - Distancia de seguridad, semáforos temporizados en cruces principales y rotondas con prioridad interior.
- [ ] **Peatones y Aceras:**
  - Cruces peatonales funcionales; los coches ceden el paso a peatones en pasos de cebra.
  - Estaciones de metro, paradas de autobús y tranvías integrados en la calzada.

---

### Fase 5: Redes de Servicios Públicos y Redes de Distribución
- [ ] **Red Eléctrica:**
  - Tipos de centrales: Eólica (según altitud del terreno), Solar, Carbón, Gas y Nuclear.
  - Propagación de electricidad por proximidad entre edificios contiguos y postes de alta tensión para salvar distancias en el campo.
  - Capacidad de red, caídas de tensión y apagones si la demanda excede la generación.
- [ ] **Red de Agua Potable, Drenaje y Alcantarillado:**
  - Conexión física con el solver de fluidos:
    - Bombas de agua dulce que extraen caudal directamente de los ríos o lagos simulados (¡si el río se seca por una presa, la bomba falla!).
    - Tuberías de vertido de aguas residuales: Expulsan agua contaminada de vuelta a los cauces de agua física, tiñendo el agua de color parduzco río abajo.
    - Plantas potabilizadoras y depuradoras biológicas.
- [ ] **Servicios Municipales de Emergencia:**
  - Bomberos: Los incendios se propagan según el viento y la proximidad entre edificios secos.
  - Policía: Zonas de baja cobertura aumentan el índice de criminalidad y devalúan los comercios.
  - Sanidad: Clínicas y hospitales con flotas de ambulancias que navegan el grafo vial en código de emergencia.
  - Residuos y Cementerios: Camiones de basura recogiendo contenedores periódicamente; vertederos e incineradoras con impacto de polución acústica y del aire.

---

### Fase 6: Sistema de Capas Visuales y Vistas de Datos (Info Views & Utility Overlays)
*(Inspirado en las Vistas de Información de Cities: Skylines y CityRT)*

- [ ] **Capa de Viento y Dirección Atmosférica:**
  - Campo vectorial 2D continuo de velocidad y dirección del viento en tiempo real, modulado por la orografía y relieve (efecto Venturi en valles y gargantas, brisas costeras marinas y cumbres expuestas).
  - Renderizado dinámico mediante partículas orientadas o líneas de flujo (*streamlines*) animadas que recorren el paisaje.
  - Impacto directo en la eficiencia de turbinas eólicas y en la orientación de las plumas de dispersión de humo y contaminantes.
- [ ] **Capa de Contaminación Ambiental (Polución del Aire y Suelo):**
  - Mapa de calor continuo (*heatmap overlay*) que proyecta la concentración de partículas y polución generada por polígonos industriales pesados, arterias de tráfico denso y vertederos.
  - Modelo de dispersión y advección atmosférica: la polución del aire se desplaza en la dirección del viento local hacia zonas residenciales a sotavento.
  - Efectos en la simulación: reducción de salud ciudadana, incremento de ingresos hospitalarios y degradación estética del entorno.
- [ ] **Capa de Contaminación Acústica (Ruido Urbano):**
  - Mapeo de decibelios ($dB$) generado por autopistas de alta velocidad, avenidas principales con congestión, aeropuertos e instalaciones industriales.
  - Amortiguación acústica por distancia y barreras verdes (árboles y parques urbanos reducen la propagación del ruido).
  - Impacto en la felicidad ciudadana y devaluación del suelo residencial afectado.
- [ ] **Capa de Valor del Suelo y Atractivo Urbano:**
  - Gradiente cromático (verde/azul a rojo) que refleja el valor del suelo y la deseabilidad por metro cuadrado.
  - Factores positivos: proximidad a masas de agua (ríos, lagunas, costa marina), parques, servicios de alta calidad y transporte público.
  - Factores negativos: proximidad a zonas industriales, polución acústica o del aire y falta de cobertura policial o sanitaria.
- [ ] **Capa de Cobertura de Servicios Municipales:**
  - Visualización por isócronas y alcance sobre la red vial para cada dotación pública (comisarías, parques de bomberos, hospitales, escuelas y rutas de recogida de residuos).
  - Detección inmediata de puntos ciegos o barrios desatendidos con alertas visuales de tiempo de respuesta excesivo.
- [ ] **Capa de Recursos Naturales y Fertilidad:**
  - Cartografía de recursos del subsuelo: acuíferos subterráneos para pozos de agua dulce, reservas minerales, petróleo y tierras aluviales de alta fertilidad agrícola.
- [ ] **Pipeline Gráfico y Shaders de Visualización de Capas:**
  - Sombreador de sobreimpresión unificado (*Data Overlay Shader*) sobre `DynamicTerrainMesh` y `RoadNetworkMesh` mediante texturas flotantes de gradiente cromático con mezcla multiplicativa o aditiva suave.
  - Panel selector de Vistas de Información (*Info Views Toolbar*) en el HUD con leyendas métricas, unidades de medida y paletas de color accesibles.
