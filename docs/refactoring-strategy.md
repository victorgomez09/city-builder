# 🧹 Estrategia de Refactorización y Buenas Prácticas (Fase 1.5)

Este documento detalla el plan de acción, los principios rectores y la metodología para la **refactorización arquitectónica de Open Skylines**, garantizando que el código sea modular, limpio y estrictamente tipado sin alterar la lógica de negocio ni degradar el rendimiento.

---

## 🎯 1. Objetivos de la Refactorización

1. **Eliminación Total de Directivas Laxas:** Suprimir `// @ts-nocheck` en [src/game.ts](file:///home/dev/projects/city-builder/src/game.ts), [src/render/meshes.ts](file:///home/dev/projects/city-builder/src/render/meshes.ts), [src/tools/tools.ts](file:///home/dev/projects/city-builder/src/tools/tools.ts) y [src/ui/ui.ts](file:///home/dev/projects/city-builder/src/ui/ui.ts), reemplazando los tipos implícitos por contratos estrictos en [src/types/index.ts](file:///home/dev/projects/city-builder/src/types/index.ts).
2. **Desacoplamiento del Espacio Global (`window.CB`):** Eliminar la dependencia del objeto global `window.CB` mediante importaciones de módulos ES6 nativas y servicios bien definidos.
3. **Modularización de Archivos Monolíticos:** Descomponer módulos con más de $1.000$ líneas en submódulos cohesivos y testeables con una única responsabilidad.
4. **Claridad de Nomenclatura:** Reemplazar nombres de variables crípticos y abreviaciones de una sola letra heredadas del prototipo original (`h`, `S`, `Wd`, `R`, `Mx`, `p`, `G`, `b`) por identificadores autodocumentados (`building`, `district`, `coverage`, `roadType`).
5. **Cero Regresiones Funcionales (*Zero-Regression Guarantee*):** Cada paso de refactorización debe preservar exactamente el comportamiento de simulación, la tasa de fotogramas (60 FPS) y la compatibilidad de guardado.

---

## 🏛️ 2. Invariantes de Refactorización (Líneas Rojas)

Durante cualquier tarea de refactorización, **QUEDA ESTRICTAMENTE PROHIBIDO**:
- **Alterar el Modelo Zero-GC:** Mantener los arrays tipificados continuos (`Uint8Array`, `Float32Array`, `Int32Array`) indexados por `i = y * W + x`. Nunca sustituir arrays planos por mapas u objetos dinámicos por casilla.
- **Modificar Fórmulas de Negocio:** Las ecuaciones de demanda RCI, felicidad, coberturas BFS, costes de tráfico o amortización de préstamos deben mantenerse idénticas.
- **Romper Compatibilidad de Partidas Guardadas:** La estructura serializada en `Sim.serialize()` y `Sim.load(d)` debe mantener su formato RLE.
- **Degradar Rendimiento de Render:** No fragmentar `InstancedMesh` en llamadas de dibujado individuales.

---

## 📐 3. Plan de Modularización Propuesto

### 3.1 Descomposición de `src/sim/sim.ts` (+2.200 líneas)
```
src/sim/
├── sim.ts              # Orquestador del ciclo de simulación y bucle horario/mensual
├── buildings.ts        # Ciclo de vida (build, live, aband, fire), andamios y felicidad
├── demand.ts           # Algoritmo de balance y demanda RCI (residencial, comercial, industrial)
├── coverage.ts         # Propagación BFS de servicios (policía, bomberos, salud, basuras, etc.)
├── budget.ts           # Balanza fiscal, ingresos por impuestos, gastos de servicios y créditos
└── serialization.ts    # Guardado y carga con compresión RLE (serialize / load)
```

### 3.2 Descomposición de `src/render/meshes.ts` (+3.600 líneas)
```
src/render/
├── meshes.ts           # Gestor central de InstancedMesh y actualización de matrices de escena
├── builders/
│   ├── residential.ts  # Constructores de geometría paramétrica para viviendas unifamiliares y bloques
│   ├── commercial.ts   # Tiendas, centros comerciales y edificios de oficinas
│   ├── industrial.ts   # Naves fabriles, chimeneas, silos y explotaciones primarias
│   ├── civic.ts        # Comisarías, parques de bomberos, hospitales, escuelas y monumentos
│   └── vehicles.ts     # Mallas instanciadas para coches, camiones, tranvías, trenes y peatones
```

### 3.3 Descomposición de la Capa de Interfaz (`src/ui/`)
La capa de interfaz de usuario ha sido completamente modularizada y tipada, eliminando toda directiva `ts-nocheck`:
```
src/ui/
├── ui.ts               # Controlador principal del ciclo de vida UI, selección y cinta de inspección
├── dom.ts              # Utilidades de selección DOM segura, data-binding reactivo y gráficos Sparkline
├── icons.ts            # Registro tipado de iconos SVG e identidades cromáticas de servicios
├── roadSvg.ts          # Generadores procedimentales de vistas transversales SVG para carreteras y sendas
└── panels/             # Controladores especializados por panel lateral
    ├── views.ts        # Capas térmicas de información (tráfico, valor de suelo, polución, etc.)
    ├── budget.ts       # Control fiscal, tipos impositivos y amortización de créditos
    ├── transit.ts      # Inspección y creación de líneas de autobús, tranvía y tren
    ├── stats.ts        # Gráficos Sparkline históricos y reparto modal de movilidad
    ├── settings.ts     # Ajustes de calidad gráfica, sombras y límites de simulación
    └── districts.ts    # Gestión municipal de distritos, políticas y especializaciones
```

---

## 🏆 5. Estado de Ejecución y Logros de la Fase 1.5

- [x] **0 Directivas `// @ts-nocheck` y `@ts-ignore`:** Todo el repositorio (incluyendo [src/render/meshes.ts](file:///home/dev/projects/city-builder/src/render/meshes.ts) con sus más de 3.600 líneas de constructores geométricos) compila en modo estricto de TypeScript.
- [x] **Desacoplamiento Interno de `window.CB`:** Los módulos [src/tools/tools.ts](file:///home/dev/projects/city-builder/src/tools/tools.ts), [src/render/meshes.ts](file:///home/dev/projects/city-builder/src/render/meshes.ts) y [src/game.ts](file:///home/dev/projects/city-builder/src/game.ts) ya no dependen internamente de llamadas `CB.*`, utilizando imports directos de ES6. `window.CB` se preserva exclusivamente como puente de depuración interactivo en consola.
- [x] **Modularización del Subsistema UI:** División limpia de `ui.ts` en `src/ui/panels/` (`views`, `budget`, `transit`, `stats`, `settings`, `districts`) y utilidades (`dom.ts`, `icons.ts`, `roadSvg.ts`).
- [x] **Documentación Algorítmica JSDoc:** Documentadas formalmente las fórmulas matemáticas de amortiguación cuadrática inversa de coberturas (`computeCoverage`), balance de demanda macroeconómica RCI (`computeDemand`), búsqueda en grafo A* dirigida con penalizaciones no lineales (`search`) y coste de impedancia de vías (`roadCost`).
- [x] **Verificación Continua Satisfactoria:** `npm run typecheck` (`tsc --noEmit`) y `pnpm run build` (`vite build`) superados con 0 errores y 0 advertencias críticas.

---

## 🔄 4. Protocolo de Verificación Continua

Antes de dar por completado cualquier paso de refactorización:
1. `npm run typecheck` (`tsc --noEmit`): Debe finalizar con 0 errores de tipado.
2. `pnpm run build` (`vite build`): Debe generar el paquete de producción sin avisos críticos.
3. Comprobación funcional en navegador: Interacción de herramientas, estabilidad del bucle de juego y persistencia de guardado/carga.
