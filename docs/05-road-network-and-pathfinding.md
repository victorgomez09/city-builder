# 05. Red Vial, Grafo Topológico, Pathfinding A*, Mecánicas CityRT y Tráfico

Este documento describe la arquitectura de la red de transporte terrestre, el modelo de datos del grafo vial dirigido, las mecánicas de trazado vial estilo **CityRT** (trazado libre a cualquier ángulo, snapping magnético, división automática de aristas, HUD de obra), las tipologías de carreteras, el algoritmo de búsqueda de rutas A*, la circulación vehicular y el renderizado PBR fotorrealista.

---

## 🏗️ 1. Mecánicas de Construcción de Carreteras Estilo CityRT

El sistema vial replica fielmente la jugabilidad y experiencia de usuario de **CityRT**:

### A. Trazado Libre a Cualquier Ángulo Directo (Arbitrary Angle Roads)
- El trazado recto ya no está forzado a pasos ortogonales de Manhattan ($L$-steps).
- El jugador puede trazar una carretera continua en cualquier dirección angular arbitraria.
- La vía se subdivide internamente cada $1.5\text{m}$ para adaptarse suavemente al relieve del terreno sin generar huecos bajo el asfalto.

### B. Snapping Magnético Angular (Magnetic Angle Snapping)
- Durante el arrastre con el ratón en modo `STRAIGHT`, el ángulo del segmento se calcula como $\theta = \text{atan2}(\Delta z, \Delta x)$.
- Si el cursor se sitúa dentro de una tolerancia de $\pm 6.5^\circ$ respecto a los ángulos clave ($0^\circ, 45^\circ, 90^\circ, 135^\circ, 180^\circ, 225^\circ, 270^\circ, 315^\circ$), el trazado se acopla magnéticamente a ese ángulo exacto, permitiendo trazar cuadrículas y diagonales perfectas con naturalidad.

### C. Snapping a Nodos y Aristas con Anillo Visual (Snap Ring)
- **Atracción a Nodos:** Si el puntero se acerca a un nodo existente dentro de un radio de $6\text{m}$ (3 celdas), se acopla al nodo y muestra un anillo circular luminoso de color ámbar cálido ([`RoadPreviewMesh.showSnapRing`](../src/render/terrain/road_preview_mesh.ts)).
- **Atracción a Aristas:** Si el puntero está cerca de una calzada existente, se calcula la proyección ortogonal más próxima sobre el segmento y se proyecta el anillo de acople.

### D. División Automática de Aristas (Edge Splitting & T-Junctions)
- En [`RoadGraph.splitEdge`](../src/core/graph/road_graph.ts), al conectar una nueva vía en un punto intermedio de una arista existente, dicha arista se divide automáticamente en dos sub-segmentos y se inserta un nuevo nodo de cruce, creando instantáneamente una intersección en T o de 4 direcciones sin romper la continuidad del grafo.

### E. HUD Flotante de Construcción en Tiempo Real ([`RoadConstructionHUD`](../src/ui/road_construction_hud.ts))
- Un tooltip flotante acompaña al puntero durante la colocación de la vía mostrando:
  - **Longitud:** en metros exactos (ej. `📏 48 m`).
  - **Ángulo:** en grados con snapping (ej. `🧭 90°`).
  - **Coste de Obra:** en dólares (ej. `💵 $480`).
  - **Badge de Estado:** `✓ Válido` en verde o motivo de advertencia en rojo (`⚠️ Fuera de parcela`, `⚠️ Fondos insuficientes`).
  - **Nivel de Elevación:** Badge de cota elevada.

### F. Control de Elevación de Rasante (Teclas E / Q)
- Mediante las teclas rápidas `E` (subir) y `Q` (bajar) o botones dedicados en [`RoadToolbarUI`](../src/ui/road_toolbar_ui.ts), el jugador puede alternar entre:
  - **Suelo (0m):** Calzada a ras de terreno.
  - **Elevada (+6m):** Viaducto urbano sobre pilares de hormigón.
  - **Puente Alto (+12m):** Gran viaducto para salvar autovías, desniveles escarpados o cauces marítimos.

### G. Autovía Regional de Entrada (Starter Highway Connection)
- Al iniciar una partida en el mapa virgen, una calzada de 4 carriles (`AVENUE_4L`) entra desde el borde del mapa hacia la parcela inicial del jugador.
- Esta autovía sirve de punto de conexión inicial inmediato para el tráfico regional hacia la ciudad naciente.

---

## 🚗 2. Simulación de Tráfico y Vehículos ([`TrafficManager`](../src/core/traffic/traffic_manager.ts))

- **Agentes Vehiculares Reales:** Spawneo periódico de coches que circulan por las calzadas de la ciudad respetando el sentido de circulación y manteniéndose en su carril derecho (`laneOffset = 0.45m`).
- **Modelos 3D PBR de Alta Fidelidad:**
  - `sedan.glb`, `suv.glb`, `van.glb`, `police.glb`, `delivery.glb` cargados desde `assets/simulation/models/`.
- **Cinemática y Orientación:** Los vehículos se orientan tangencialmente al vector de la carretera con rotación en el eje $Y$ (`yaw`) y velocidad ajustada al límite de velocidad de cada tipología vial.

---

## 🛣️ 3. Tipologías y Jerarquía Vial (`road_types.ts`)

Implementado en [`src/core/graph/road_types.ts`](../src/core/graph/road_types.ts):

| Tipología | Carriles | Ancho | Velocidad | Sentido | Uso Principal |
|---|---|---|---|---|---|
| **`LOCAL_2L`** | 2 | 1.4m | 40 km/h | Doble | Calles de barrio, acceso residencial |
| **`ONE_WAY_2L`** | 2 | 1.4m | 50 km/h | Único | Descongestión céntrica, circunvalaciones |
| **`AVENUE_4L`** | 4 | 2.2m | 70 km/h | Doble | Ejes comerciales con mediana arbolada |
| **`HIGHWAY_4L`** | 4 | 2.2m | 100 km/h | Único | Conectores interurbanos de alta velocidad |

---

## 🎨 4. Renderizado PBR de Calzada y Marcas Viales (`RoadNetworkMesh`)

En [`src/render/terrain/road_network_mesh.ts`](../src/render/terrain/road_network_mesh.ts):
* **Asfalto PBR Continuo:**
  - Textura base: `/assets/shared/asphalt_light/albedo.jpg` con mapas de normales y rugosidad a escala métrica real (2.2m de repetición).
  - Efecto de rodadura con oscurecimiento suave en las zonas de paso de los neumáticos.
* **Marcas Viales Analíticas Anti-Aliasing (`fwidth`):**
  - Todas las líneas se pintan en el fragment shader sin crear mallas de calcomanía (decals) adicionales ni provocar *z-fighting*.
  - El filtrado analítico con `fwidth` asegura un borde nítido e invariable a cualquier resolución y ángulo de cámara.
  - **Línea discontinua central:** Ciclo de 2.2m pintados y 2.3m de separación.
  - **Líneas de borde continuo:** Delimitan los arcenes y la separación con los bordillos.
  - **Marcas amarillas:** Identifican visualmente las vías de sentido único.
* **Bordillos y Aceras Elevadas:**
  - Bordillo de 17 cm de altura con chaflán superior y oclusión ambiental horneada en la junta con la calzada.
  - Aceras de losas de piedra PBR (`/assets/shared/paving_slabs/albedo.jpg`).
* **Charcos Cálidos de Luz Nocturna (Night Light Pools):**
  - Durante la noche (`uNight > 0`), las farolas proyectan conos de luz analítica en asfalto y aceras con caída cuadrática inversa, perfectamente sincronizados con la posición de las farolas instanciadas.
* **Viaductos y Puentes Automáticos:**
  - Cuando una carretera atraviesa una lámina de agua o una hondonada, la calzada se sobreeleva automáticamente y se generan pilares verticales de hormigón (`/assets/shared/concrete/`).
* **Mobiliario Urbano PBR:**
  - Instanciación de farolas clásicas (`street_lamp_01`), bancos de madera (`painted_wooden_bench`), arbustos (`wild_rooibos_bush`) y bocas de incendios (`fire_hydrant`).

---

## 🧭 5. Grafo Vial Dirigido y Pathfinding A*

Implementado en [`src/core/graph/road_graph.ts`](../src/core/graph/road_graph.ts) y [`src/core/graph/astar_pathfinder.ts`](../src/core/graph/astar_pathfinder.ts):
* **Nodos y Aristas Dirigidas:** Soporte estricto para calles de sentido único separando `outNeighbors` e `inNeighbors`.
* **Coste Ponderado por Tiempo de Viaje ($t = d / v$):** Los agentes prefieren avenidas o autopistas rápidas aunque impliquen un recorrido en distancia algo mayor.
* **Zero-Allocation con `ObjectPool`:** Los nodos de búsqueda A* se reciclan en memoria para no saturar el recolector de basura.
