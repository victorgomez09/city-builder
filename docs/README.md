# Documentación Técnica del Motor: City Builder 3D

> Bienvenido a la documentación viva del proyecto **City Builder 3D**. Este espacio recopila las especificaciones de arquitectura, fórmulas matemáticas, estructuras de datos y funcionamiento de cada uno de los subsistemas del motor para que cualquier desarrollador humano o agente de IA pueda comprender, mantener y extender el juego.

---

## 📚 Índice de Módulos

| Documento | Descripción | Fase |
|---|---|---|
| [**01. Arquitectura General & Dual Loop**](01-architecture-dual-loop.md) | Separación estricta Main Thread vs Web Worker, flujo de mensajes tipados y Zero-Allocation. | Fase 0 |
| [**02. Motor Gráfico, Cámara & Shaders**](02-graphics-camera-shaders.md) | Three.js, Flat Shading low-poly, controlador cinemático RTS y ciclo Día/Noche. | Fase 1 |
| [**03. Terreno Dinámico & Terraformación**](03-terrain-and-terraforming.md) | Generación procedural determinista, buffers `DynamicDrawUsage` y brochas en tiempo real. | Fase 1 & 1.5 |
| [**04. Solver Hidrodinámico (SWE 2.5D)**](04-hydrodynamics-swe-water.md) | Simulación física de fluidos mediante Ecuaciones de Aguas Someras, manantiales y olas. | Fase 1.5 |
| [**05. Red Vial, Grafo & Pathfinding A\***](05-road-network-and-pathfinding.md) | Topología vial, algoritmo A* con ObjectPool y render procedural de calzadas. | Fase 2 |
| [**06. Pipeline de Assets PBR & Modelos 3D**](06-asset-pipeline-and-pbr.md) | Gestor AssetManager, texturas PBR continuas y atrezzo urbano GLTF en calzadas. | Fase 2 & 3 |

---

## 🎯 Filosofía de Diseño

1. **Determinismo:** Cualquier partida iniciada con la misma semilla (`seed`) reproduce exactamente el mismo mundo gracias a nuestro generador Mulberry32 ([`PRNG`](../src/core/utils/prng.ts)).
2. **60+ FPS Rule:** El hilo principal jamás calcula simulaciones costosas ni física de fluidos; todo se delega al Worker (`sim.worker.ts`).
3. **Zero-Allocation Loop:** Ninguna función ejecutada en `requestAnimationFrame` o en el `tick` de simulación instanciará objetos temporales (`new Vector3`, arrays efímeros). Se emplean estructuras contiguas de memoria (`Float32Array`) y Object Pools.
