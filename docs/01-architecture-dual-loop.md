# 01. Arquitectura General y Loop Dual

Este documento explica el desacoplamiento entre el hilo de renderizado (`Main Thread`) y el hilo de simulación (`Web Worker`), garantizando 60+ FPS sin importar la complejidad del mundo.

---

## 🏛️ Diagrama de Flujo del Dual Loop

```mermaid
sequenceDiagram
    autonumber
    participant UI as Capa UI (DOM)
    participant MT as Main Thread (Three.js Render)
    participant WW as Web Worker (Simulación & Física)

    Note over MT,WW: Inicialización
    MT->>WW: INIT_WORLD { seed: 1337, mapWidth: 64, mapHeight: 64 }
    WW-->>MT: WORLD_INITIALIZED { width, height, seed }

    Note over WW: Bucle Físico / Simulación (Tick Fijo: 20 Hz / 50ms)
    loop Cada 50ms (Fixed Timestep)
        WW->>WW: Integrar SWE (Agua)
        WW->>WW: Evaluar Demanda RCI & Economía
        WW-->>MT: SIMULATION_UPDATE { stats, waterBuffer }
    end

    Note over MT: Bucle de Render (requestAnimationFrame ~60-144 FPS)
    loop Cada Frame Gráfico
        MT->>MT: Interpolar CameraController
        MT->>MT: Actualizar Ciclo Día/Noche
        MT->>MT: Actualizar malla de agua con waterBuffer
        MT->>MT: Three.js renderer.render(scene, camera)
    end

    Note over UI,WW: Interacción del Jugador
    UI->>MT: Arrastre de Brocha de Terraformación
    MT->>MT: Deformar malla local (DynamicDrawUsage)
    MT->>WW: SYNC_TERRAIN { heightsBuffer }
```

---

## 📦 Estructuras de Datos y Mensajería Tipada

Todos los mensajes que viajan a través del canal de Worker están estrictamente tipados en [`src/core/messages.ts`](../src/core/messages.ts):

* **`MainToWorkerMessage`**: Contiene órdenes de control (`INIT_WORLD`, `SET_SIMULATION_SPEED`, `SYNC_TERRAIN`, `SET_WATER_SOURCE`).
* **`WorkerToMainMessage`**: Emite deltas de simulación (`WORLD_INITIALIZED`, `SIMULATION_UPDATE`) transfiriendo arrays binarios contiguos (`Float32Array`) sin serialización costosa de JSON.

---

## ⚡ Zero-Allocation Loops

Para evitar recolecciones de basura (*Garbage Collector pauses*):
- No se usa `new` en bucles continuos.
- [`ObjectPool`](../src/core/utils/pool.ts) se utiliza para objetos reciclables.
- Las operaciones matemáticas de simulación usan [`Vec2`](../src/core/utils/math.ts) y mutaciones sobre arrays planos de memoria contigua.
