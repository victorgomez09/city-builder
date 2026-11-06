# 02. Motor Gráfico, Iluminación PBR Atmosférica y Estilo Fable Cities / Cities: Skylines II

Este documento detalla la arquitectura de renderizado PBR de alta fidelidad, la iluminación física basada en la bóveda celeste (Rayleigh/Mie) y HDRI, el controlador de cámara RTS de alta precisión, el filtrado de sombras suaves PCF y el splatting multi-textura procedimental continuo.

---

## ☀️ 1. Iluminación Basada en Imágenes (IBL) y Efemérides Atmosféricas

Implementado en [`src/render/shaders/day_night_cycle.ts`](../src/render/shaders/day_night_cycle.ts) y [`src/render/assets/asset_manager.ts`](../src/render/assets/asset_manager.ts):

* **HDRI Poly Haven Real:**
  - Archivo: `/assets/shared/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr`.
  - Carga asíncrona mediante `RGBELoader` y prefiltrado con `THREE.PMREMGenerator` para generar un mapa de radiancia y reflexión especular continuo.
  - Asignado a `scene.environment` y `scene.background`, dotando a todos los materiales PBR (`MeshStandardMaterial`) de radiancia difusa y reflejos especulares naturales de cielo y nubes.
* **Sol Direccional y Ciclo Solar Físico:**
  - Órbita solar continua con cálculo analítico de altitud y azimut.
  - Espectro solar dinámico: mediodía dorado natural (`#fff6ec`, intensidad 2.5), amanecer/atardecer ámbar cálido (`#ff9944`) y noche con luz de luna plateada (`#6080a8`).
  - Cálculo de `nightFactor` [0..1] que modula automáticamente el encendido de farolas urbanas, charcos de luz en el asfalto y atenuación de especular en la vegetación nocturna.
* **Sombras Suaves PCF Calibradas:**
  - Resolución de shadow map de $2048 \times 2048$.
  - Uso de `THREE.PCFShadowMap` (mapeo con disco de Vogel y radio de penumbra suave).
  - **`shadow.normalBias = 0.025` y `shadow.bias = -0.0001`:** Calibración óptima para eliminar por completo el "shadow acne" sobre la superficie continua del terreno sin despegar las sombras de contacto de vehículos, peatones ni bordillos.
* **ToneMapping ACES Filmic:**
  - `renderer.toneMapping = THREE.ACESFilmicToneMapping;`
  - `renderer.toneMappingExposure = 1.05;` para una imagen rica, equilibrada y con rango dinámico amplio.
* **Niebla Atmosférica Distante:**
  - `THREE.Fog(0xcbe2f2, 220, 850)` para mantener el plano de juego y la red vial nítidos, fundiendo el horizonte montañoso con la atmósfera.

---

## 📷 2. Controlador de Cámara RTS de Alta Precisión (`camera_controller.ts`)

Basado en la arquitectura de cámara orbital de *Cities: Skylines II* y *Fable Cities*:
* **Velocidad de Paneo Escalonada por Zoom:**
  La traslación horizontal escala linealmente con la distancia al suelo (`panSpeed * distance`), garantizando precisión milimétrica al inspeccionar calles y agilidad al desplazarse a vista satelital.
* **Amortiguación Exponencial Cinemática (`damp` / `dampAngle`):**
  Desplazamiento y rotación suaves independientes de los fotogramas por segundo, eliminando tirones y sobre-oscilaciones.
* **Controles Fluidos:**
  - `WASD` / Flechas: Desplazamiento en el plano horizontal (XZ).
  - `Q` / `E`: Rotación horizontal azimutal (Yaw).
  - `R` / `F`: Inclinación polar (Pitch).
  - Rueda del ratón: Zoom suave focalizado hacia el objetivo.
  - Clic secundario (Right Click): Rotación orbital y cabeceo simultáneos.
  - Clic central / Alt + Clic: Arrastre de terreno (*Grab-and-Pan*).
* **Cota Mínima de Seguridad (`minHeightAboveGround`):**
  Evita que la cámara colisione o descienda por debajo del terreno o plano de agua.

---

## 🌿 3. Splatting Multi-Textura PBR en Terreno (`dynamic_terrain_mesh.ts`)

Implementado mediante parche `onBeforeCompile` sobre `MeshStandardMaterial`:
* **Texturas PBR de la Librería Compartida:**
  - Hierba viva (`/assets/shared/Grass004/color.jpg`).
  - Suelo / tierra fértil (`/assets/shared/Ground048/color.jpg`).
  - Arena de playa (`/assets/shared/Ground033/color.jpg`).
  - Risco rocoso (`/assets/shared/Rock030/color.jpg`).
  - Cumbres alpinas con manto de nieve.
* **Muestreo Dual con Modulación por Ruido Procedimental (`AssetManager.getProceduralNoiseTexture`):**
  - Muestreo a dos escalas de repetición (macro + micro) mezcladas mediante un mapa de ruido continuo seamless fBm, suprimiendo cualquier patrón de cuadrícula repetitiva visible a distancia.
* **Proyección Triplanar en Riscos:**
  - Las pendientes superiores a 30° proyectan la textura de roca verticalmente para evitar estiramientos poligonales en acantilados.
* **Franja de Costa Húmeda (Shoreline Wet Band):**
  - Oscurecimiento físico del terreno en el punto exacto de contacto con la lámina de agua ($h \approx \text{waterLevel}$), produciendo el aspecto de arena empapada sin costuras de malla.
