# Roadmap: City Builder 3D (Web & Desktop) - v1.0 Completa

> Roadmap exhaustivo para el desarrollo y lanzamiento de un simulador y constructor de ciudades estilo *CityRT*, *SimCity* y *Cities: Skylines*, con estética Low-Poly estilizada, renderizado 3D acelerado (WebGL/WebGPU) con Three.js, **física de fluidos e hidrodinámica realista (SWE)**, **terraformación completa**, arquitectura desacoplada en Web Workers y empaquetado híbrido Web + Desktop (Tauri v2 + TypeScript).

---

## 🏛️ 1. Visión Técnica y Arquitectura General

* **Lenguaje:** TypeScript (Strict mode en todo el stack).
* **Render Engine:** Three.js con soporte WebGL 2.0 y abstracción WebGPU (usando `WebGPURenderer` / TSL).
* **Simulación:** Arquitectura desacoplada basada en ECS (Entity Component System) + Solver Hidrodinámico 2.5D (Shallow Water Equations) ejecutado en un **Web Worker** dedicado con paso de mensajes vía buffers transferibles (`ArrayBuffer` / `Float32Array`) para garantizar 60+ FPS estables en el hilo de render.
* **Terreno Híbrido:** Terreno continuo editable en tiempo real (malla procedural dinámica con brochas de terraformación) combinado con assets modulares Low-Poly (`.glb`) para construcciones especiales, acantilados y rocas decorativas.
* **Física y Fluidos:** Simulación real de agua que fluye por gravedad, llena valles, inunda zonas bajas, interactúa con presas, bombas y terraformación dinámica.
* **Packaging:** 
  * **Web:** SPA optimizada (Vite + WebGL/WebGPU).
  * **Desktop:** Tauri v2 con backend ligero en Rust, soporte offline, guardado en `%APPDATA%` / `~/.config` y ventana de alto rendimiento.
* **Target v1.0:** Simulación fluida con hasta 50.000 ciudadanos, red vial multimodal con A*, terraformación en vivo, física de agua y drenaje, zonificación RCI, economía profunda, servicios públicos y desastres naturales.

```mermaid
flowchart TD
    subgraph UI ["Capa de Interfaz (DOM / Canvas UI)"]
        HUD["HUD / Menú de Construcción & Herramientas"]
        TerraformUI["Panel de Terraformación & Brochas"]
        Stats["Paneles Estadísticos & RCI & Presupuesto"]
    end

    subgraph MainThread ["Hilo Principal (Render & Input)"]
        InputMgr["Input Manager (Mouse / Teclado / Hotkeys)"]
        CamCtrl["Camera Controller (Orbit / Pan / Tilt)"]
        RenderEng["Motor Gráfico (Three.js WebGL / WebGPU)"]
        TerrainMesh["Malla Dinámica de Terreno & Superficie de Agua"]
        Instancing["InstancedMesh & BatchedMesh Manager (Edificios/Coches)"]
    end

    subgraph SimWorker ["Web Worker (Simulación, ECS & Física)"]
        ECS["Motor ECS (BiteCS / Javelin)"]
        WaterSolver["Solver Físico SWE (Shallow Water Equations)"]
        GridState["Campos de Altura (Heightfield) & Biomas"]
        RoadGraph["Grafo Vial & Pathfinding (A* / Flowfields)"]
        SimSystems["Sistemas: RCI, Tráfico, Servicios, Finanzas, Desastres"]
    end

    UI <--> InputMgr
    InputMgr -->|Acciones de usuario (Zonar, Terraformar, Construir)| SimWorker
    SimWorker -->|Buffers transferibles: Alturas, Agua, Entidades| MainThread
    MainThread --> RenderEng
    RenderEng --> TerrainMesh
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
  - Matemáticas vectoriales desacopladas (`Vec2`).
  - Pool genérico de objetos (`ObjectPool`) para reutilización de memoria.

---

### Fase 1: Motor Gráfico, Terreno y Cámara (MVP Gráfico)
- [x] **Controlador de Cámara Isométrica / RTS:**
  - Pan con WASD / flechas y arrastre con rueda central / botón secundario.
  - Zoom suave focalizado hacia el objetivo y rotación azimutal (Q/E o clic derecho).
  - Ángulo polar acotado (evita colapso contra el suelo) y amortiguación (*damping*) suave.
  - Zero alocaciones en el bucle de render mediante reutilización de vectores prealocados.
- [x] **Generación y Render del Terreno Low-Poly:**
  - Terreno procedural determinista con armónicos semillados por PRNG en `TerrainGenerator`.
  - Cuantización de alturas para terrazas escalonadas al estilo *Townscaper* / *CityRT*.
  - Clasificación de celdas por biomas: Agua, Arena, Pradera, Bosque y Roca.
  - Malla optimizada de terreno en una sola llamada de render (1 Draw Call) con sombreado plano (`flatShading: true`) y plano de agua translúcido.
- [x] **Iluminación Dinámica y Ciclo Día/Noche:**
  - Ciclo solar continuo en `DayNightCycle` con cambio gradual de color de cielo, intensidad de sol y amaneceres/atardeceres cálidos.
  - Sombras suaves en tiempo real (`PCFSoftShadowMap`) con *bias* calibrado para sombreado facetado sin artefactos.
  - Niebla exponencial volumétrica suave (`FogExp2`) para profundidad atmosférica.
- [x] **Cursor de Cuadrícula 3D:**
  - Raycaster continuo sobre el plano horizontal para resaltar la celda activa en el mundo e informar al HUD sin consumo excesivo de CPU.

---

### Fase 1.5: Terraformación Completa y Física de Fluidos (Agua Realista)
*(Inspirado en Cities: Skylines, CityRT y From Dust)*

- [x] **Herramientas de Terraformación Dinámica en Vivo:**
  - **Brochas completas:** Elevar (`RAISE`), Hundir (`LOWER`), Allanar a cota fija (`FLATTEN`) y Suavizar desniveles (`SMOOTH`) en [`TerrainModifier`](file:///home/dev/projects/city-builder/src/core/terrain/terrain_modifier.ts).
  - Algoritmo con atenuación radial cosenoidal (*falloff* suave) para evitar bordes dentados.
  - Interfaz de usuario interactiva [`TerraformUI`](file:///home/dev/projects/city-builder/src/ui/terraform_ui.ts) con sliders para radio (2m a 18m), fuerza y altura objetivo.
  - Indicador 3D visual en tiempo real [`BrushCursor`](file:///home/dev/projects/city-builder/src/render/terrain/brush_cursor.ts) con feedback de color según la brocha.
  - Actualización reactiva sobre GPU con [`DynamicTerrainMesh`](file:///home/dev/projects/city-builder/src/render/terrain/dynamic_terrain_mesh.ts) recalculando normales e iluminación sin caídas de FPS.
- [x] **Simulación Física de Fluidos (Shallow Water Equations - SWE 2.5D):**
  - **Solver Hidrodinámico en Web Worker:**
    - Cuadrícula acoplada con conservación estricta de masa y momento vectorial en [`ShallowWaterSolver`](file:///home/dev/projects/city-builder/src/core/water/shallow_water_solver.ts).
    - Presión hidrostática continua ($g = 9.81 \, m/s^2$) que hace fluir el agua desde cotas altas a bajas buscando el equilibrio.
    - Amortiguación viscosa para prevenir inestabilidades numéricas.
  - **Fuentes y Manantiales:**
    - Generadores de agua ajustables con caudal dinámico ($m^3/s$) y sumideros en los bordes del mapa.
  - **Interacción Terreno <-> Agua en Vivo:**
    - Modificar el lecho mediante la brocha desplaza y redistribuye el caudal físico en tiempo real.
  - **Malla de Agua Dinámica:**
    - Malla reactiva [`DynamicWaterMesh`](file:///home/dev/projects/city-builder/src/render/terrain/dynamic_water_mesh.ts) con actualización continua de superficie libre $(b + d)$.
    - Métrica en HUD con el volumen total de agua en circulación.

---

### Fase 2: Red Vial y Conectividad (El Núcleo del City Builder)
- [x] **Diseño y Colocación de Carreteras:**
  - Herramienta de trazado continuo con el ratón tipo Manhattan (ortogonal X/Z).
  - Geometría procedural low-poly en [`RoadNetworkMesh`](file:///home/dev/projects/city-builder/src/render/terrain/road_network_mesh.ts) con adaptación automática al relieve.
  - Barra de herramientas principal [`MainToolbarUI`](file:///home/dev/projects/city-builder/src/ui/main_toolbar_ui.ts) y cuadrícula interactiva [`WorldGridHelper`](file:///home/dev/projects/city-builder/src/render/terrain/world_grid_helper.ts).
- [x] **Configuración Multitipo de Carreteras (Jerarquía Vial):**
  - Tipologías implementadas en [`road_types.ts`](file:///home/dev/projects/city-builder/src/core/graph/road_types.ts): Calle Local (2L, 40 km/h, doble sentido), Sentido Único (2L, 50 km/h), Avenida con Mediana (4L, 70 km/h) y Autopista rápida (4L, 100 km/h).
  - Subpanel de selección interactivo [`RoadToolbarUI`](file:///home/dev/projects/city-builder/src/ui/road_toolbar_ui.ts) con costes por celda y límites de velocidad.
  - Geometría visual específica por tipología: medianas ajardinadas, señalización amarilla en sentidos únicos y calzadas anchas.
- [x] **Grafo Vial Dirigido & Pathfinding A\* Ponderado por Velocidad:**
  - Soporte para calles de sentido único con listas separadas `outNeighbors` e `inNeighbors` en [`RoadGraph`](file:///home/dev/projects/city-builder/src/core/graph/road_graph.ts).
  - Algoritmo A\* en [`AStarPathfinder`](file:///home/dev/projects/city-builder/src/core/graph/astar_pathfinder.ts) calculando tiempo real de viaje ($t = d / v$).
  - Zero-Allocation con `ObjectPool` y 18 pruebas unitarias validadas.
- [x] **Herramienta de Demolición:**
  - Eliminación instantánea de nodos y tramos recuperando la conectividad del grafo.
- [x] **Modos de Trazado Avanzados (Inspirado en Cities: Skylines 2 y CityRT):**
  - **Modo Recto (Straight):** Trazado en línea recta y cuadrícula clásica Manhattan.
  - **Modo Curva Suave (Curved Bézier):** Trazado en arco mediante splines cuadráticos en [`SplineUtils`](file:///home/dev/projects/city-builder/src/core/graph/spline_utils.ts).
  - **Herramienta de Rotondas Automáticas (Roundabout Tool):**
    - Colocación de rotondas circulares con 1 solo clic en [`RoadToolbarUI`](file:///home/dev/projects/city-builder/src/ui/road_toolbar_ui.ts).
    - Anillo circulatorio de 12 vértices con flujo continuo de sentido único horario.
- [x] **Integración de Librería de Assets y Fidelidad Visual Fable Cities (hero.jpg):**
  - **Iluminación PBR Atmosférica y HDRI IBL:**
    - Carga de HDRI Poly Haven (`kloofendal_48d_partly_cloudy_puresky_1k.hdr`) mediante `RGBELoader` + `PMREMGenerator` para radiancia y reflejos especulares de cielo en toda la escena.
    - Sol direccional calibrado (`#fff6ec`, 2.2) con `PCFSoftShadowMap`, `shadow.normalBias = 0.025` y `shadow.bias = -0.0001` (eliminando cualquier rastro de shadow acne en el terreno).
    - Niebla atmosférica suave y lejana (`Fog(0xcbe2f2, 220, 850)`), manteniendo nítido el primer y plano medio.
    - Tone mapping ACES Filmic (`exposure = 1.05`).
  - **Topografía Costera y Splatting Multi-Textura PBR:**
    - Generación procedural con océano sureste, playa de arena curva, río meándrico, lagunas costeras, valle aluvial central y cordillera norte con picos nevados.
    - Splatting continuo mediante `MeshStandardMaterial.onBeforeCompile`: arena (`sand/color.jpg`), hierba aérea (`aerial_grass_rock/Diffuse.jpg`), risco rocoso (`Rock030/color.jpg`) y nieve en cotas superiores a 17m.
  - **Red Vial PBR con Marcas Viales y Puentes:**
    - Asfalto PBR `asphalt_light` con marcas viales analíticas anti-aliasing (línea discontinua central y líneas continuas de carril).
    - Aceras elevadas de losas de piedra `paving_slabs` y bordillos verticales de hormigón `concrete`.
    - Detección de láminas de agua con sobreelevación y pilares de puente de hormigón hacia el fondo.
    - Spawning de vehículos GLB (`sedan.glb`, `suv.glb`, `van.glb`, `police.glb`) y vegetación viva (`wild_rooibos_bush`).

---

### Fase 3: Zonificación y Construcción de Edificios (RCI + Assets Modulares)
- [ ] **Herramienta de Zonificación:**
  - Detección automática de casillas de profundidad (hasta 4 casillas desde la acera) generadas a lo largo de las carreteras.
  - Cuadrícula de parcelas alineadas al vector tangente de la vía.
  - Tipologías de zona:
    - 🟢 Residencial (Baja / Alta densidad).
    - 🔵 Comercial (Tiendas locales / Centros comerciales y ocio).
    - 🟡 Industrial (Talleres, Manufactura ligera, Almacenes).
    - 🟣 Oficinas y Alta Tecnología.
- [ ] **Pipeline de Assets y Generación de Edificios:**
  - Soporte de carga de modelos Low-Poly `.glb` modulares (fachadas, plantas bajas, techos, azoteas decoradas).
  - Sistema de crecimiento por niveles (Nivel 1 a Nivel 5 según valor del suelo, servicios y educación).
  - Renderizado mediante `InstancedMesh` / `BatchedMesh`: Cero caídas de FPS, renderizando barrios enteros en decenas de llamadas de render.
  - Animación de construcción (grúas low-poly, andamios y efecto de elevación por escalado).

---

### Fase 4: Simulación de Tráfico, Ciudadanos y Agentes (Micro-Simulación)
- [ ] **Ciclo de Vida de los Ciudadanos (Sims Individuales):**
  - Cada ciudadano posee hogar, trabajo o colegio, y actividades de ocio/compras.
  - Algoritmo de elección de transporte: Caminar, coche privado, o transporte público según tiempos estimados de llegada.
- [ ] **Simulación Vehicular Inteligente:**
  - Cinemática sobre curvas splines dentro de su carril asignado.
  - Comportamiento de tráfico: Distancia de seguridad, aceleración/frenado suave, semáforos temporizados en cruces principales y rotondas con prioridad interior.
  - Renderizado masivo de cientos de vehículos instanciados en GPU con ruedas animadas y luces nocturnas.
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

### Fase 6: Economía, Demanda RCI, Políticas Municipales y HUD
- [ ] **Motor Económico y Fiscal:**
  - Ajuste granular de tipos impositivos para R, C e I.
  - Presupuesto por departamento (Financiación de bomberos, sanidad, mantenimiento de carreteras y alumbrado).
  - Emisión de bonos y préstamos bancarios a tipos de interés variable.
  - Mapa de Valor del Suelo (Land Value) afectado por vistas al agua, árboles, parques, distancia al trabajo y alejamiento de zonas industriales contaminadas.
- [ ] **Ecuaciones de Demanda RCI Dinámicas:**
  - Cálculo de ratios de empleo, demanda de bienes de consumo en tiendas y necesidad de materias primas.
- [ ] **HUD & Sistema de Capas de Datos (Data Overlays / Heatmaps):**
  - Panel superior: Hora del día, velocidad del tiempo (Pausa, 1x, 2x, 3x), población, tesorería municipal y balance mensual.
  - Menú de construcción inferior intuitivo con selector de categorías y herramientas.
  - Capas de datos térmicas con shaders de color sobre el terreno: Polución acústica, Contaminación de suelo, Flujo de tráfico, Cobertura de agua/luz y Riesgo de inundación.

---

### Fase 7: Desastres Naturales, Clima y Audio 3D
- [ ] **Sistema de Desastres y Eventos Emergentes:**
  - **Inundaciones y Rotura de Presas:** Desbordamientos reales del agua calculados por el solver físico que arrasan carreteras y sumergen barrios.
  - **Incendios Forestales:** Propagación de fuego en bosques cercanos a zonas urbanas.
  - **Terremotos:** Agrietamiento del terreno con desplazamiento vertical de vértices y derrumbe de edificios.
  - **Tornados y Tormentas:** Vientos huracanados que arrancan árboles y lluvia que incrementa temporalmente el caudal de los ríos.
- [ ] **Audio 3D Espacial e Inmersivo:**
  - Web Audio API posicional acoplada a la posición y zoom de la cámara.
  - Efectos según altura: A nivel de calle se escucha rumor de motores, sirenas y bullicio de peatones; en vista satélite se escucha el viento y aves.
  - Banda sonora ambiental procedural relajante (estilo Lo-Fi / SimCity jazz).
- [ ] **Herramienta de Inspección Profunda:**
  - Clic en cualquier edificio para ver moradores, quejas, nivel de felicidad y consumo de servicios.
  - Clic en ciudadanos o vehículos con modo "Cámara en persecución" (Follow Cam).

---

### Fase 8: Guardado, Optimización Extrema y Empaquetado Desktop (v1.0)
- [ ] **Persistencia y Serialización Determinista:**
  - Serialización binaria rápida de arrays de alturas, mallas de agua, entidades ECS y grafos viales.
  - Guardado en navegador: `IndexedDB` con guardado automático configurable cada X minutos.
  - Guardado en Desktop: Acceso al sistema de archivos mediante Tauri v2 API (`save_game` / `load_game`) en formatos `.city`.
- [ ] **Optimizaciones Avanzadas de Motor:**
  - Frustum Culling y Dynamic Level of Detail (LOD) para edificios y coches lejanos.
  - Paginación del terreno en chunks espaciales con octree o BVH para mapas masivos (ej. 256x256 o 512x512).
- [ ] **Empaquetado Multiplataforma Nativo (Tauri v2):**
  - Configuración del binario Rust de Tauri para Windows (`.exe` / `.msi`), Linux (`.AppImage` / `.deb`) y macOS (`.dmg`).
  - Integración nativa de menús de ventana, modo pantalla completa exclusivo, selector de resolución y salida limpia.
  - Pipeline de CI en GitHub Actions para compilar ejecutables en cada release de Git.
- [ ] **Soporte de Modding y Mapas Personalizados:**
  - Importación de mapas de altura desde imágenes en escala de grises (Heightmaps PNG de 16 bits).
  - Carga dinámica de modelos `.glb` de la comunidad para nuevos edificios y vehículos.

---

## 📈 Matriz de Hitos (Milestones hacia v1.0)

| Hito | Alcance Principal | Criterio de Aceptación |
|---|---|---|
| **M1: Sandbox Gráfico** | Terreno + Cámara + Luces + Ciclo Día/Noche | Cámara fluida a 60 FPS navegando un mundo 3D low-poly estilizado. *(Completado)* |
| **M2: Terraformación & Agua Física** | Brochas en vivo + Solver SWE de fluidos | Modificar elevación en tiempo real y ver agua fluyendo por gravedad y llenando cuencas. |
| **M3: Red Vial y Puentes** | Carreteras Bézier, Cruces y Puentes sobre agua | Conectar carreteras con trazado continuo y generación de puentes automáticos. |
| **M4: Zonificación RCI** | Crecimiento de edificios instanciados en GPU | Zonas RCI colindantes a calles donde crecen edificios low-poly modulares. |
| **M5: Micro-Tráfico & Agentes** | Tráfico de coches y peatones con A* | Cientos de coches navegando rutas de hogar a trabajo respetando normas viales. |
| **M6: Servicios y Redes** | Electricidad, Agua de río/bombas, Emergencias | Centrales eléctricas y tuberías conectadas a la red con impacto visual y funcional. |
| **M7: Simulación Viva & HUD** | Finanzas, Impuestos, Heatmaps y Desastres | Gestión de una metrópolis de más de 10.000 habitantes con balance económico y riesgos. |
| **v1.0 Final** | Tauri Desktop + Web + Audio 3D + Guardados | Juego empaquetado, 50k habitantes a >60 FPS, sin leaks de memoria y guardados estables. |
