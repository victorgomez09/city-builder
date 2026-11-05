# 06. Librería de Assets PBR, Modelos 3D y Marcas Viales

Este documento describe la integración y el consumo de la librería de texturas PBR, HDRI y modelos 3D (`.glb`, `.gltf`) de `assets/` y `public/assets/`, adaptados a la estética visual de **Fable Cities** (`hero.jpg`).

---

## 🏛️ 1. Gestor Centralizado de Assets (`AssetManager`)

Ubicado en [`src/render/assets/asset_manager.ts`](../src/render/assets/asset_manager.ts):
* **Carga con Caché Inteligente:** Las texturas, modelos y mapas HDRI se cargan una única vez y se reutilizan mediante clonación eficiente sin duplicar uso de VRAM en la GPU.
* **Separación Estricta sRGB vs. Linear:**
  - Mapas de albedo / color: `texture.colorSpace = THREE.SRGBColorSpace`.
  - Mapas de normales, rugosidad, oclusión ambiental y desplazamiento: `texture.colorSpace = THREE.NoColorSpace` (lineales) para evitar distorsiones vectoriales en el cálculo del sombreado.
* **Carga de HDRI:** Integración de `RGBELoader` + `THREE.PMREMGenerator` para prefiltrar la radiancia del cielo e iluminar la escena mediante IBL.

---

## 🛣️ 2. Red Vial PBR con Marcas Viales y Puentes (`road_network_mesh.ts`)

* **Asfalto Realista:** Textura PBR `/assets/shared/asphalt_light/albedo.jpg` con mapeado métrico a escala real (~2.2m).
* **Marcas Viales Analíticas en Fragment Shader:**
  - Línea divisoria central blanca discontinua (ciclo 4.5m: 2.25m pintado, 2.25m espacio).
  - Líneas continuas blancas delimitadoras en los márgenes exteriores de los carriles.
  - Implementación con `onBeforeCompile` en `MeshStandardMaterial`: anti-aliasing analítico sin geometría adicional ni z-fighting.
* **Aceras y Bordillos:**
  - Aceras con losas de piedra PBR `/assets/shared/paving_slabs/albedo.jpg` elevadas a +0.14m.
  - Bordillos verticales de hormigón `/assets/shared/concrete/albedo.jpg`.
* **Puentes y Pilares Automáticos:**
  - Al atravesar láminas de agua o vaguadas ($h \le 1.6\text{m}$), el tramo se eleva automáticamente y proyecta pilares de hormigón hacia el fondo del cauce.
* **Mobiliario Urbano Real (Props):**
  - Farolas (`street_lamp_01_1k.gltf`).
  - Bancos de madera (`painted_wooden_bench_1k.gltf`).
  - Bocas de incendio (`fire_hydrant_1k.gltf`).
  - Arbustos naturales (`wild_rooibos_bush_1k.gltf`).

---

## 🚗 3. Modelos de Vehículos de Simulación

Ubicados en `assets/simulation/models/` y renderizados sobre la red vial:
* `sedan.glb`, `suv.glb`, `police.glb`, `van.glb`, `delivery.glb`, `truck.glb`.
* Proyectan y reciben sombras suaves con orientación alineada al sentido de circulación del carril.
