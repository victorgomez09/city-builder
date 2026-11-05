# 02. Motor Gráfico, Iluminación PBR Atmosférica y Estilo Fable Cities / Cities: Skylines II

Este documento detalla la arquitectura de renderizado PBR de alta fidelidad, la iluminación basada en imágenes (IBL) con HDRI, el tone mapping, el filtrado de sombras suaves y la atmósfera que recrean el estándar visual de **Fable Cities** (`hero.jpg`).

---

## ☀️ 1. Iluminación Basada en Imágenes (IBL) y HDRI Dome

Implementado en [`src/render/shaders/day_night_cycle.ts`](../src/render/shaders/day_night_cycle.ts) y [`src/render/assets/asset_manager.ts`](../src/render/assets/asset_manager.ts):

* **HDRI Poly Haven Real:**
  - Archivo: `/assets/shared/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr`.
  - Carga mediante `RGBELoader` y filtrado con `THREE.PMREMGenerator` para generar un mapa de radiancia y reflexión de alta calidad.
  - Asignado a `scene.environment` y `scene.background`, dotando a todos los materiales PBR (`MeshStandardMaterial`) de radiancia difusa y reflejos especulares naturales de las nubes y el cielo.
* **Sol Direccional Cálido (Key Light):**
  - Color `#fff6ec`, intensidad 2.2.
  - Sombras suaves calculadas con `THREE.PCFSoftShadowMap` o PCF en resolución 2048x2048.
  - **`shadow.normalBias = 0.025` y `shadow.bias = -0.0001`:** Clave para eliminar por completo el "shadow acne" sobre la superficie continua del terreno sin despegar las sombras de los vehículos ni de los bordillos.
* **Luz de Relleno Suave:**
  - `THREE.AmbientLight` tenue (`#ffffff`, 0.2) y `THREE.HemisphereLight` (`#badcf2` / `#483e32`, 0.35) que equilibran los volúmenes en conjunción con el IBL.
* **ToneMapping ACES Filmic:**
  - `renderer.toneMapping = THREE.ACESFilmicToneMapping;`
  - `renderer.toneMappingExposure = 1.05;` para una imagen rica, equilibrada y sin áreas quemadas ni sombras aplastadas.
* **Niebla Atmosférica Distante:**
  - `THREE.Fog(0xcbe2f2, 220, 850)` para mantener el primer y plano medio perfectamente nítidos y fundir el horizonte montañoso con la bóveda celeste.

---

## 🌿 2. Splatting Multi-Textura PBR en Terreno (`dynamic_terrain_mesh.ts`)

* El material del terreno utiliza un hook sobre `MeshStandardMaterial.onBeforeCompile`:
  - **Playa y Ribera:** Textura de arena (`/assets/shared/sand/color.jpg`) en cotas $h \le \text{waterLevel} + 1.3\text{m}$.
  - **Llanuras y Valles:** Textura de hierba aérea (`/assets/shared/aerial_grass_rock/Diffuse.jpg`) en pendientes suaves.
  - **Riscos y Paredes Rocosas:** Textura de roca (`/assets/shared/Rock030/color.jpg`) en pendientes superiores a 32° y elevaciones medias.
  - **Cumbres Nevadas:** Nieve blanca en las cimas montañosas ($h > 17\text{m}$).
* Normales suaves calculadas con `computeVertexNormals()`.
* Soporte reactivo de terraformación en tiempo real actualizando dinámicamente los buffers de vértices.
