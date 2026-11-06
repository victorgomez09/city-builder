# 06. Librería de Assets PBR, Modelos 3D, Skyline y Vegetación

Este documento describe la integración y el consumo de la librería de texturas PBR, HDRI, modelos 3D (`.glb`, `.gltf`) y sistemas de instanciación masiva, recreando con exactitud la estética visual de **Fable Cities** (`hero.jpg`).

---

## 🏛️ 1. Gestor Centralizado de Assets (`AssetManager`)

Ubicado en [`src/render/assets/asset_manager.ts`](../src/render/assets/asset_manager.ts):
* **Carga con Caché Inteligente:** Las texturas, modelos y mapas HDRI se cargan una única vez y se reutilizan mediante clonación eficiente sin duplicar uso de VRAM en la GPU.
* **Separación Estricta sRGB vs. Linear:**
  - Mapas de albedo / color: `texture.colorSpace = THREE.SRGBColorSpace`.
  - Mapas de normales, rugosidad, oclusión ambiental y desplazamiento: `texture.colorSpace = THREE.NoColorSpace` (lineales) para evitar distorsiones vectoriales en el cálculo del sombreado.
* **Carga de HDRI:** Integración de `RGBELoader` + `THREE.PMREMGenerator` para prefiltrar la radiancia del cielo e iluminar la escena mediante IBL.

---

## 🏙️ 2. Gestor de Edificios y Skyline Procedimental (`BuildingManager`)

Ubicado en [`src/render/buildings/building_manager.ts`](../src/render/buildings/building_manager.ts):
* **Rascacielos Downtown (40m - 98m):**
  - Fachadas continuas de vidrio de muro cortina (`/assets/shared/facade_glass/`).
  - Iluminación nocturna de oficinas mediante mapa de emisión PBR (`/assets/shared/facade_glass_night/emission.jpg`) controlado con `setNightFactor(nightFactor)`.
  - Casetones de maquinaria en cubierta de chapa ondulada (`/assets/shared/corrugatedsteel005/`).
  - Mástiles y antenas de telecomunicación en las torres insignia.
* **Bloques Urbanos de Media Altura (16m - 28m):**
  - Fachadas de ladrillo visto caravista (`/assets/shared/bricks_red/`) y revoco contemporáneo (`/assets/shared/plaster_modern/`).
* **Viviendas Suburbanas (6m - 8m):**
  - Muros de revoco y tejados a 4 aguas de tejas cerámicas (`/assets/shared/roof_tiles_clay/`).
* **Pabellones y Marinas Costeras:**
  - Estructuras arquitectónicas de hormigón (`/assets/shared/concrete/albedo.jpg`) a lo largo del paseo marítimo.
* **Zero-Allocation e InstancedMesh:** Todo el skyline urbano se renderiza en menos de 10 draw calls masivos en GPU.

---

## 🌲 3. Gestor de Vegetación y Arbolado (`FoliageManager`)

Ubicado en [`src/render/foliage/foliage_manager.ts`](../src/render/foliage/foliage_manager.ts):
* **Renderizado Masivo por InstancedMesh:** Más de 300 árboles y 150 arbustos distribuidos por bulevares, lagunas, parques y colinas en solo **2 draw calls**.
* **Troncos:** Geometría cilíndrica con material PBR de corteza (`/assets/shared/Bark012/`).
* **Copas:** Geometría dodecaédrica orgánica con material PBR de hojas vivas (`/assets/shared/Grass004/`).
* **Sombras Suaves:** Los árboles proyectan y reciben sombras `PCFShadowMap` sobre la calzada, edificios y terreno.

---

## 🛣️ 4. Red Vial PBR con Marcas Viales y Puentes (`road_network_mesh.ts`)

* **Asfalto Realista:** Textura PBR `/assets/shared/asphalt_light/albedo.jpg` con mapeado métrico a escala real (~2.2m).
* **Marcas Viales Analíticas en Fragment Shader con `fwidth`:**
  - Línea divisoria central blanca discontinua (ciclo 4.5m: 2.25m pintado, 2.25m espacio).
  - Líneas continuas blancas delimitadoras en los márgenes exteriores de los carriles.
  - Subdivisión en estaciones cada 1.5m a lo largo del trazado para adaptación suave al relieve.
* **Cruces e Intersecciones Radiales Circulares:** Fans circulares continuos que eliminan al 100% los cuadrados o facetas en esquinas.
* **Aceras y Bordillos:**
  - Aceras con losas de piedra PBR `/assets/shared/paving_slabs/albedo.jpg` elevadas a +0.17m.
  - Bordillos achaflanados que conectan suavemente calzada y acera.
* **Puentes y Pilares Automáticos:**
  - Al atravesar láminas de agua o vaguadas ($h \le 1.8\text{m}$), el tramo se eleva automáticamente y proyecta pilares estructurales de hormigón.
* **Mobiliario Urbano Real (Props):**
  - Farolas (`street_lamp_01_1k.gltf`) con charcos de luz cálida nocturna analítica.
  - Bancos de madera (`painted_wooden_bench_1k.gltf`).
  - Bocas de incendio (`fire_hydrant_1k.gltf`).
  - Arbustos naturales (`wild_rooibos_bush_1k.gltf`).

---

## 🚗 5. Modelos de Vehículos de Simulación

Ubicados en `assets/simulation/models/` y circulando por la red vial:
* `sedan.glb`, `suv.glb`, `police.glb`, `van.glb`, `delivery.glb`, `truck.glb`.
* Orientados continuamente siguiendo la dirección del vector de carril.
