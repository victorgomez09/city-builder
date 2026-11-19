# 🏙️ Open Skylines — Roadmap & Master Management Blueprint (ROADME.md)

Este documento define la visión y hoja de ruta para evolucionar **Open Skylines** hacia un simulador de gestión urbana profundo, modular y de alto rendimiento en el navegador (en la línea de *Cities: Skylines*, *SimCity 4* y *Workers & Resources*), aprovechando al máximo la arquitectura TypeScript, la simulación determinista por cuadrículas (*flat typed arrays*) y el motor de renderizado Three.js.

---

## 📊 1. Diagnóstico del Estado Actual del Motor

| Módulo | Implementación Actual | Oportunidad de Expansión de Gestión |
| :--- | :--- | :--- |
| **Simulación (`src/sim/`)** | Ciclo RCI básico, presupuestos globales, felicidad estática, servicios esenciales (policía, bomberos, salud, colegios, vertederos). | Distritos con políticas locales, demografía por cohortes, cadenas de suministro industriales y elasticidad fiscal. |
| **Mundo (`src/world/`)** | Cuadrícula de $208 \times 208$, mapas procedurales con lagos orgánicos, red vial alineada y alturas en Float32Array. | Yacimientos de recursos naturales, mapas de viento y corrientes de agua, cotas de inundación. |
| **Tráfico (`src/traffic/`)** | Generación estadística de viajes con agentes cosméticos y cálculo de congestión por arista. | Camiones de mercancías físicos, peajes, vehículos de emergencia con prioridad y restricciones de paso (ZBE). |
| **Tránsito (`src/transit/`)** | Redes de autobuses y trenes urbanos con paradas fijas y conteo de pasajeros. | Red de metro subterráneo, tranvías, líneas de cercanías interurbanas y billetes/tarifas dinámicas. |
| **Render (`src/render/`)** | InstancedMesh para edificios, vehículos y vegetación; shader PBR, ciclo día/noche y agua procedural. | Vistas térmicas/infoviews GPU avanzadas, partículas de polución, renderizado subterráneo y efectos climáticos. |
| **UI (`src/ui/`)** | Barra cívica, dock inferior de herramientas, panel de hitos y panel de presupuestos general. | Inspector de ciudadanos/edificios detallado, panel de distritos, gráficos macroeconómicos y avisador de crisis. |

---

## 🎯 2. Pilares de Nuevas Funcionalidades de Gestión

### 🏛️ Pilar A: Distritos y Políticas Municipales Específicas
Permitirá subdividir la metrópoli en barrios o polígonos autónomos con normativas diferenciadas:
1. **Herramienta de Pincel de Distritos (`DistrictBrush`):**
   - Buffer tipificado `World.district: Uint8Array(W * W)` con soporte para hasta 255 distritos nombrables.
   - Estadísticas independientes por distrito: población, renta media, valor del suelo, tasa de desempleo, índice de criminalidad y demanda de servicios.
2. **Políticas Municipales Activables:**
   - **Zona de Bajas Emisiones (ZBE):** Prohíbe el tráfico de vehículos pesados en zonas residenciales densas, reduciendo la polución acústica y atmosférica a costa de aumentar el recorrido de mercancías.
   - **Incentivos Fiscales de Alta Tecnología:** Reduce impuestos al sector terciario (+Oficinas), pero exige mano de obra con educación universitaria.
   - **Plan Ciudad Ciclable & Callejeros Verdes:** Reduce en un 35% el uso del coche privado en viajes cortos y aumenta la salud general.
   - **Campaña de Reciclaje Domiciliario:** Reduce la generación de basura un 25%, con un coste de mantenimiento mensual por habitante.
   - **Tolerancia Cero / Toque de Queda Comercial:** Despliega patrullas intensivas que bajan el crimen al mínimo pero limitan el ocio nocturno y los ingresos comerciales.

---

### 📦 Pilar B: Cadenas de Suministro y Especialización Industrial
Transformar la industria genérica en un ecosistema productivo interconectado:
1. **Yacimientos de Recursos Procedurales (`World.resources`):**
   - **Tierra Fértil:** Localizada en vegas de ríos y cuencas lacustres (ideal para agricultura/granjas).
   - **Masa Forestal Maderera:** En áreas de alta densidad de coníferas.
   - **Depósitos Minerales y Petrolíferos:** En estribaciones montañosas y fallas del relieve.
2. **Flujo de Cadena de Producción (3 Niveles):**
   ```mermaid
   flowchart LR
     A["Recurso Primario (Granja / Mina)"] --> B["Planta Procesadora (Harina / Acero)"]
     B --> C["Bienes Comerciales (Tiendas Locales)"]
     B --> D["Exportación Externa (Autopista / Puerto)"]
     A -.->|"Si hay escasez"| E["Importación Cara"]
   ```
3. **Mecánica de Desabastecimiento Comercial (*Stockouts*):**
   - Si los comercios no reciben mercancías mediante camiones de reparto en un plazo de tiempo, entran en estado de desabastecimiento, despiden empleados y finalmente cierran por quiebra (*Blight*).

---

### 🎓 Pilar C: Demografía Profunda, Educación y Salud
Sustituir el conteo simple de población por un modelo de vida dinámico:
1. **Pirámide Poblacional y Cohortes:**
   - **Infancia (0-14 años):** Demandan guarderías y colegios primarios; dependen de ingresos familiares.
   - **Juventud / Estudiantes (15-24 años):** Acceden a institutos y universidades; determinan el nivel de cualificación laboral.
   - **Fuerza Laboral (25-64 años):** Generan ingresos fiscales, consumen en comercios y se desplazan al trabajo.
   - **Tercera Edad (65+ años):** Demandan atención médica intensiva, residencias y servicios funerarios.
2. **Escalafón Educativo Estructurado:**
   - Colegios de Primaria $\rightarrow$ Institutos de Secundaria $\rightarrow$ Universidades / Campus Tecnológico.
   - La educación desbloquea la evolución de los edificios a Nivel 4 y 5 (rascacielos ecológicos y laboratorios).
3. **Ciclo Funerario y Sanidad Pública:**
   - La falta de hospitales provoca brotes epidémicos que reducen la productividad.
   - Sistema de morgues, cementerios y crematorios con coches fúnebres que recogen fallecidos para evitar el abandono de manzanas completas.

---

### 💰 Pilar D: Motor Financiero y Deuda Municipal
Profundizar en la microgestión económica para evitar que el dinero sea infinito a mitad de partida:
1. **Impuestos Segmentados por Densidad y Categoría:**
   - Residencial de Baja Densidad vs Alta Densidad (desincentivar la especulación o el hacinamiento).
   - Pequeño Comercio Local vs Grandes Almacenes.
   - Oficinas Corporativas vs Industria Pesada.
2. **Mercado de Bonos y Calificación Crediticia (*Credit Rating*):**
   - Emisión de Bonos Municipales a 5, 10 y 20 años con amortizaciones programadas.
   - Calificación de riesgo (AAA $\rightarrow$ B $\rightarrow$ Basura): una ciudad endeudada con flujo de caja negativo paga primas de riesgo severas que pueden forzar la bancarrota municipal (*Default*).
3. **Financiación de Servicios y Paros Laborales:**
   - Si el presupuesto de policía, bomberos o basuras baja del 70%, el personal entra en huelga y la efectividad operativa cae drásticamente.

---

### 🚆 Pilar E: Movilidad Multimodal y Redes de Transporte Avanzadas
1. **Red de Metro Subterráneo (*Subway*):**
   - Modo de vista subterránea con toggle (`PageDown / PageUp`).
   - Trazado libre de túneles bajo las calles sin ocupar espacio en superficie, conectando estaciones de transbordo en áreas de alta densidad.
2. **Tranvías sobre Medianas Urbanas:**
   - Nuevos tipos de avenidas con raíles empotrados en la mediana.
   - Capacidad intermedia entre autobús y metro, ideal para unir suburbios con el distrito financiero.
3. **Aparcamientos Disuasorios (*Park & Ride*) y Peajes:**
   - Estaciones de aparcamiento en las entradas de la ciudad para forzar el trasvase del coche particular al transporte público.
   - Cabinas de peaje en autovías para monetizar los accesos y regular la hora punta.

---

### 🌪️ Pilar F: Impacto Ambiental, Clima Dinámico y Desastres
1. **Contaminación Hidrológica y Red de Saneamiento:**
   - Separación estricta entre **agua potable** y **aguas residuales**.
   - Si los colectores de desagüe vierten residuos cerca o aguas arriba de las bombas de captación de agua dulce, la red se contamina, provocando intoxicaciones masivas.
2. **Dirección de Viento y Dispersión Atmosférica:**
   - Vector dinámico de viento global: el penacho de humo de fábricas y centrales térmicas se desplaza a sotavento, reduciendo drásticamente el valor del suelo en las áreas afectadas.
3. **Gestión de Emergencias y Catástrofes:**
   - Incendios forestales que se propagan con el viento hacia zonas periurbanas.
   - Olas de calor (aumento del 60% en consumo de agua/electricidad).
   - Inundaciones costeras y fluviales durante temporales de lluvia.

---

## 🗺️ 3. Plan de Implementación por Fases

```mermaid
flowchart TD
    P1["Fase 1: Distritos, Políticas y Elasticidad Fiscal ✅"] --> P15["Fase 1.5: Refactorización Arquitectónica y Código Limpio ✅"]
    P15 --> P2["Fase 2: Redes de Agua/Desagüe y Ciclo Sanitario ⏳"]
    P2 --> P3["Fase 3: Cadenas de Suministro y Recursos Naturales"]
    P3 --> P4["Fase 4: Movilidad Multimodal (Metro y Tranvía)"]
    P4 --> P5["Fase 5: Clima Dinámico, Desastres y Macro-Monumentos"]
```

### Fase 1: Distritos y Políticas Locales (¡Completada! ✅)
- [x] Implementar `World.district` y gestión de distritos en [src/world/world.ts](file:///home/dev/projects/city-builder/src/world/world.ts).
- [x] Crear herramienta interactiva de pincel/borrador `DistrictBrush` en [src/tools/tools.ts](file:///home/dev/projects/city-builder/src/tools/tools.ts) con vista previa de shader en tiempo real.
- [x] Desarrollar panel de gestión de distritos, métricas en vivo, 7 especializaciones y 8 políticas municipales en [src/ui/ui.ts](file:///home/dev/projects/city-builder/src/ui/ui.ts).
- [x] Añadir etiquetas 3D flotantes en perspectiva (*badges proyectados*) sobre los centroides de los distritos en [src/render/gfx.ts](file:///home/dev/projects/city-builder/src/render/gfx.ts).
- [x] Ajustar el motor de simulación [src/sim/sim.ts](file:///home/dev/projects/city-builder/src/sim/sim.ts) para computar bonificadores de políticas (basura, incendios, consumo, felicidad, impuestos) y persistencia en save/load.
- [x] Integrar restricción de tráfico pesado (ZBE) y estímulo de ciclismo urbano en el cálculo de costes de ruta en [src/traffic/traffic.ts](file:///home/dev/projects/city-builder/src/traffic/traffic.ts).

### Fase 1.5: Refactorización Arquitectónica, Modularización y Código Limpio (¡Completada! ✅)
> [!IMPORTANT]
> **Objetivo Cumplido:** Reorganización y desacoplamiento de la base de código para elevar la mantenibilidad y escalabilidad, eliminando deuda técnica y aplicando tipado TypeScript estricto **sin alterar la lógica de negocio ni degradar el rendimiento**.

- [x] **Eliminación Total de `// @ts-nocheck`, `@ts-ignore` y erradicación sistemática de `any`:** Tipado estricto en el 100% de los módulos ([src/game.ts](file:///home/dev/projects/city-builder/src/game.ts), [src/sim/sim.ts](file:///home/dev/projects/city-builder/src/sim/sim.ts), [src/traffic/traffic.ts](file:///home/dev/projects/city-builder/src/traffic/traffic.ts), [src/transit/transit.ts](file:///home/dev/projects/city-builder/src/transit/transit.ts), [src/render/meshes.ts](file:///home/dev/projects/city-builder/src/render/meshes.ts), [src/tools/tools.ts](file:///home/dev/projects/city-builder/src/tools/tools.ts) y [src/ui/ui.ts](file:///home/dev/projects/city-builder/src/ui/ui.ts)). Modelos de dominio tipados rigurosamente en [src/types/index.ts](file:///home/dev/projects/city-builder/src/types/index.ts) (`Vehicle`, `SoftAgent`, `SerializedCity`, `Bezier2D`, `VehicleSpawnRequest`, `TransitGraph`, `ToolState`).
- [x] **Descomposición Modular de Archivos Monolíticos:**
  - **Mallas y Renderizado:** [src/render/meshes.ts](file:///home/dev/projects/city-builder/src/render/meshes.ts) reducido de 3.432 a 1.256 líneas mediante generadores especializados en [src/render/generators/](file:///home/dev/projects/city-builder/src/render/generators/) (`buildingGenerators.ts`, `vehicleGenerators.ts`, `parkSpots.ts`).
  - **Interfaz de Usuario:** [src/ui/ui.ts](file:///home/dev/projects/city-builder/src/ui/ui.ts) reducido de 1.620 a 569 líneas extrayendo [src/ui/catalog.ts](file:///home/dev/projects/city-builder/src/ui/catalog.ts), [src/ui/goals.ts](file:///home/dev/projects/city-builder/src/ui/goals.ts), [src/ui/panels/junction.ts](file:///home/dev/projects/city-builder/src/ui/panels/junction.ts) y [src/ui/panels/inspector.ts](file:///home/dev/projects/city-builder/src/ui/panels/inspector.ts).
  - **Simulación y Tráfico:** [src/traffic/traffic.ts](file:///home/dev/projects/city-builder/src/traffic/traffic.ts) reducido de 1.482 a 901 líneas extrayendo [src/traffic/trajectories.ts](file:///home/dev/projects/city-builder/src/traffic/trajectories.ts), [src/traffic/signals.ts](file:///home/dev/projects/city-builder/src/traffic/signals.ts) y [src/traffic/visitorActivities.ts](file:///home/dev/projects/city-builder/src/traffic/visitorActivities.ts).
  - **Mundo y Terreno:** [src/world/world.ts](file:///home/dev/projects/city-builder/src/world/world.ts) reducido de 1.405 a 983 líneas extrayendo [src/world/terrainGen.ts](file:///home/dev/projects/city-builder/src/world/terrainGen.ts) y [src/world/districts.ts](file:///home/dev/projects/city-builder/src/world/districts.ts).
  - **Simulación Económica:** [src/sim/sim.ts](file:///home/dev/projects/city-builder/src/sim/sim.ts) reducido de 1.849 a 1.584 líneas extrayendo [src/sim/demand.ts](file:///home/dev/projects/city-builder/src/sim/demand.ts) y [src/sim/buildings.ts](file:///home/dev/projects/city-builder/src/sim/buildings.ts).
- [x] **Desacoplamiento del Puente Global `window.CB`:** Reemplazado el acceso interno a través del objeto global `CB` por importaciones ES6 nativas directas, manteniendo `window.CB` exclusivamente como interfaz de depuración interactiva en consola.
- [x] **Documentación Algorítmica JSDoc:** Comentarios matemáticos exhaustivos explicando la convolución de amortiguación inversa de coberturas (`computeCoverage`), balance de demanda RCI (`computeDemand`), A* en grafo dirigido (`search`), cálculo de splines Bézier y funciones de coste vial (`roadCost`).
- [x] **Rediseño Ergonómico de Interfaz (Estilo Cities: Skylines & Cero Solapamientos):**
  - **HUD Consolidado No-Rompible:** Barra cívica unificada (`.topbar`) en una sola línea que nunca colapsa verticalmente sobre los paneles.
  - **Constantes Vitales con Drill-Down Directo:** Clic en Fondos abre Presupuesto, clic en Población abre Estadísticas, clic en Felicidad abre Infovistas y clic en Demanda abre Zonificación.
  - **Eliminación Total de Solapamientos:** El cajón de metas (`#goals`) se ancla limpiamente bajo el hito cívico y se retira automáticamente cuando el jugador abre el inspector (`#infoPanel`), evitando cualquier conflicto espacial en el cuadrante izquierdo.
  - **Estante de Construcción Contextual (`#palette`):** Acoplado de forma fluida sobre el dock de categorías con barra de título (`.phead-bar`), pestañas de subcategorías, selector de modos viales (`straight`, `curve`, `sbend`, `grid`), botón de cierre directo `✕` y atajo de teclado `Escape`.
  - **Dock de Construcción Inferior (`#toolbar`):** Centrado en la base con indicadores luminosos de estado activo, señalización de peligro en demolición y exclusión mutua frente a paneles laterales para máxima visibilidad de obra.
- [x] **Limpieza Integral de Código Legado JavaScript:** Eliminado por completo el directorio legado `js/` (más de 550 KB de archivos `.js` obsoletos: `core.js`, `gfx.js`, `main.js`, `meshes.js`, `sim.js`, `tools.js`, `traffic.js`, `transit.js`, `ui.js`, `world.js`) y los scripts residuales de concatenación `build.sh` y `build.ps1`. El proyecto es ahora 100% TypeScript moderno gobernado por Vite.
- [x] **Blindaje de Regresiones:** El proyecto supera `npm run typecheck` (`tsc --noEmit`) y compila limpiamente con `pnpm run build` con 0 errores y 0 avisos críticos.

### Fase 2: Ciclo de Agua Completo, Contaminación y Sanidad
- [ ] Separar tuberías de agua limpia y colectores fecales con plantas depuradoras.
- [ ] Simulación de contaminación de aguas subterráneas y costeras.
- [ ] Sistema de hospitales de campaña y ambulancias dirigidas a emergencias locales.
- [ ] Cementerios y coches fúnebres con cobertura de radio de influencia.

### Fase 3: Recursos Naturales e Industria Especializada
- [ ] Generación procedural de capas de fertilidad, mineral y bosque en la inicialización del mapa.
- [ ] Especialización de zonas industriales (Granjas, Silvicultura, Minería, Manufactura).
- [ ] Generación de agentes de transporte de carga pesada (*Freight Trucks*).
- [ ] Panel logístico de importación/exportación de mercancías.

### Fase 4: Infraestructuras de Metro y Tránsito Masivo
- [ ] Modo de cámara subterránea con renderizado de túneles en [src/render/gfx.ts](file:///home/dev/projects/city-builder/src/render/gfx.ts).
- [ ] Trazado de vías de metro y estaciones bajo tierra.
- [ ] Avenidas con carril tranvía dedicado y postes de catenaria instanciados.
- [ ] Panel de rentabilidad por línea de transporte público (billetes cobrados vs coste de mantenimiento).

### Fase 5: Eventos de Emergencia, Clima y Mega-Edificios
- [ ] Viento dinámico afectando a la dispersión de humo de partículas.
- [ ] Propagación de incendios estructurales y forestales.
- [ ] Edificios emblemáticos desbloqueables por hitos (Ópera, Estadio, Aeropuerto Internacional).
- [ ] Atracción turística, hoteles y economía de visitantes.

---

## 💡 4. Buenas Prácticas Arquitectónicas para la Expansión
1. **Memoria Tipificada Zero-GC:** Mantener todas las capas masivas del mundo en `TypedArrays` continuos (`Uint8Array`, `Float32Array`, `Int32Array`) para que el recolector de basura de JavaScript no introduzca tirones de fotogramas (*frame drops*).
2. **Simulación en Pasos Discretos:** Mantener la simulación económica y de agentes a $4\text{ Hz}$ o $10\text{ Hz}$ desacoplada de la tasa de refresco del renderizado (60 FPS), garantizando determinismo.
3. **InstancedMesh y Shaders Compuestos:** Toda nueva infraestructura (estaciones, postes, tranvías, ambulancias) debe reutilizar geometrías instanciadas con paletas de color y transformaciones matriciales compactas.
