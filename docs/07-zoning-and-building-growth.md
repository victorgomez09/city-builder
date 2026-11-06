# 07. Cuadrícula de Zonificación RCI y Crecimiento de Edificios (CityRT Clone)

Este documento detalla la arquitectura de zonificación urbana y el pipeline de crecimiento de edificios procedimentales en base a las mecánicas de **CityRT** y *Cities: Skylines*.

---

## 🏘️ 1. Cuadrícula de Zonificación RCI a lo Largo de Carreteras

Implementado en [`src/core/zoning/zoning_manager.ts`](../src/core/zoning/zoning_manager.ts) y [`src/render/zoning/zoning_mesh.ts`](../src/render/zoning/zoning_mesh.ts):

### A. Generación Automática de Casillas (4m x 4m)
- Inmediatamente después de colocar o modificar cualquier carretera en [`RoadGraph`](../src/core/graph/road_graph.ts), [`ZoningManager.generateZoningCells`](../src/core/zoning/zoning_manager.ts) calcula automáticamente las hileras de parcelas que flanquean la calzada:
  - **Profundidad:** 4 hileras de casillas hacia el interior a cada lado de la vía.
  - **Dimensiones métricas:** Casillas regulares de $4.0\text{m} \times 4.0\text{m}$.
  - **Orientación:** Tangente y perpendicular exacta ($\text{yaw}$) al vector de dirección de la calzada.
  - **Adaptación altimétrica:** Cada casilla lee su cota del terreno para reposar sobre el relieve sin solapes.

### B. Tipologías de Zona (Distritos RCI)
- **🟢 Residencial (`RESIDENTIAL`):** Viviendas unifamiliares con tejados inclinados de teja cerámica tradicional.
- **🟦 Comercial (`COMMERCIAL`):** Locales comerciales, cafeterías y oficinas de fachada contemporánea.
- **🟨 Industrial (`INDUSTRIAL`):** Naves fabriles, talleres y centros de almacenamiento con cubierta de chapa ondulada.
- **⬜ Deszonar (`NONE`):** Libera la casilla y retira la zonificación previa.

### C. Renderizado Visual 3D de Cuadrícula ([`ZoningMesh`](../src/render/zoning/zoning_mesh.ts))
- Malla semitranslúcida de alta visibilidad superpuesta al terreno activo:
  - Verde translúcido (`#4caf50`) para Residencial.
  - Azul translúcido (`#2196f3`) para Comercial.
  - Amarillo anaranjado (`#ff9800`) para Industrial.
  - Azul pálido translúcido (`#90caf9`) con baja opacidad para casillas disponibles aún no asignadas.
- La malla es visible exclusivamente mientras se utiliza la herramienta de Carreteras (`ActiveTool.ROAD`) o la herramienta de Zonas (`ActiveTool.ZONE`).

---

## 🎨 2. Interfaz y Pintura Interactiva de Zonas ([`ZoningToolbarUI`](../src/ui/zoning_toolbar_ui.ts))

- **Activación:** Mediante la tecla rápida `3` o el botón `🏘️ Zonas` de [`MainToolbarUI`](../src/ui/main_toolbar_ui.ts).
- **Atajos de Teclado RCI:**
  - `R`: Seleccionar zona Residencial.
  - `C`: Seleccionar zona Comercial.
  - `I`: Seleccionar zona Industrial.
  - `X`: Seleccionar Deszonar.
- **Pintura por Arrastre:** El jugador hace clic y arrastra con el ratón sobre las casillas adyacentes a las carreteras para pintar o deszonar distritos completos con fluidez.

---

## 🏗️ 3. Pipeline de Crecimiento y Población de Edificios

Implementado en [`Engine.simulateBuildingGrowth`](../src/main.ts) y [`BuildingManager`](../src/render/buildings/building_manager.ts):

### A. Ciclo de Desarrollo
- Un temporizador periódico (cada $2.5\text{s}$) consulta las casillas zonificadas que aún no cuentan con edificación ([`zoningManager.getUnbuiltZonedCells()`](../src/core/zoning/zoning_manager.ts)).
- Selecciona parcelas libres y genera dinámicamente la edificación correspondiente:
  - **Residencial:** Instancia viviendas unifamiliares con muros de revoco (`plaster_modern`) y tejados cerámicos inclinados (`roof_tiles_clay`), sumando entre 4 y 12 habitantes a la población municipal.
  - **Comercial:** Instancia edificios comerciales de hormigón y ventanales con zócalo a ras de calle.
  - **Industrial:** Instancia naves fabriles de chapa metálica ondulada (`corrugatedsteel005`).

### B. Renderizado por Instanciación Masiva (Zero Framerate Drop)
- Todos los edificios se generan mediante [`THREE.InstancedMesh`](../src/render/buildings/building_manager.ts) agrupados por material PBR, garantizando 60+ FPS estables con cientos de construcciones simultáneas en pantalla.
