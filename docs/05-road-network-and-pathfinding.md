# 05. Red Vial, Grafo Topológico y Pathfinding A*

Este documento describe la arquitectura de la red de transporte terrestre, el modelo de datos del grafo vial dirigido, las tipologías de carreteras, la plantilla de cuadrícula de construcción (*grid guide*) y el modelado low-poly continuo sin micro-segmentación.

---

## 📐 1. Plantilla de Cuadrícula de Construcción (`WorldGridHelper`)

Implementada en [`src/render/terrain/world_grid_helper.ts`](../src/render/terrain/world_grid_helper.ts):
* **Líneas Primarias de Celda:** Cuadrícula de celdas discretas delimitada con líneas finas semitransparentes a cota $+0.045m$.
* **Líneas Maestras de Manzana Urbana:** Cada 4 casillas (8 metros), se proyectan líneas cian brillantes (`#80deea`) con mayor grosor visual para planificar manzanas residenciales y comerciales homogéneas.
* **Resaltado de Plantilla Activa:** Un parche luminoso cian (`0x00e5ff` con opacidad calibrada) rellena la celda exacta bajo el ratón, indicando claramente la posición de anclaje de la carretera o brocha.

---

## 🎨 2. Modelado de Carreteras Continuo y Definido (Sin Micro-Segmentación)

En [`src/render/terrain/road_network_mesh.ts`](../src/render/terrain/road_network_mesh.ts):
* **Fusión de Tramos:** Los tramos ya no se dibujan como losas cortadas individuales, sino como cintas volumétricas continuas que suturan perfectamente entre nodo y nodo.
* **Cotas Volumétricas Definidas:**
  - **Calzada central:** Asfalto gris carbón (`#38414a`) a cota $+0.06m$ con línea divisoria blanca/amarilla central continua.
  - **Bordillo de piedra:** Escalón vertical biselado de $7\text{ cm}$ (`#8a929b`).
  - **Aceras Peatonales:** Plataforma elevada de adoquín arenisca clara (`#dad5cb`) a cota $+0.13m$.
* **Mobiliario Urbano en GPU (`InstancedMesh`):**
  - Árboles con tronco marrón y copa de dodecaedro facetado colocados rítmicamente en la acera derecha.
  - Farolas clásicas oscuras colocadas en la acera izquierda.
  - Cero penalización de draw calls (todo en 2 llamadas instanciadas a la GPU).
