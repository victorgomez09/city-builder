# 🎨 Pipeline Gráfico, Shaders GLSL e Instanciación Three.js

Los módulos [src/render/gfx.ts](file:///home/dev/projects/city-builder/src/render/gfx.ts) y [src/render/meshes.ts](file:///home/dev/projects/city-builder/src/render/meshes.ts) implementan un motor de renderizado 3D de alto rendimiento sobre WebGL y Three.js.

---

## 1. Pipeline de Renderizado y Configuración

- **Renderer:** `THREE.WebGLRenderer` con `powerPreference: 'high-performance'`.
- **Espacio de Color:** `THREE.SRGBColorSpace`.
- **Mapeo Tonal:** `THREE.ACESFilmicToneMapping` (exposición 1.05) para alto rango dinámico y contraste cinematográfico.
- **Sombras Suaves:** `THREE.PCFSoftShadowMap` con tamaño de mapa de sombra configurable según preset gráfico ($1024^2$, $2048^2$ o $4096^2$).
- **Cámara Orbital:** Control total de traslación ($WASD$), ángulo azimutal (*yaw*), cabeceo (*pitch* de $0.12$ a $1.45\text{ rad}$) y distancia focal ($22\text{ m}$ a $1.900\text{ m}$) con prevención de colisión contra el terreno.

---

## 2. Shaders GLSL Personalizados

### 2.1 Shader de Terreno
El relieve se dibuja mediante un único mesh continuo cuyos vértices reciben alturas de `World.hc`. En el fragment shader:
- **Mezcla por pendiente y cota:** Interpola suavemente entre arena de playa ($h \approx 0$), hierba fértil, pradera seca, roca escarpada en pendientes pronunciadas y nieve en cumbres altas ($h > 35$).
- **Iluminación diurna y nocturna:** Se atenúa con `uNight` mientras la luz cenital ambiental cambia de tono.

### 2.2 Shader de Fachadas y Edificios (`City Shader`)
Los edificios utilizan una geometría en bloque instanciada. El fragment shader genera proceduralmente el detalle arquitectónico:
- **Ventanas proceduradas:** Cálculo de retícula con marcos, cristales reflectantes y cortinas aleatorias.
- **Iluminación nocturna:** En horario nocturno (`uNight > 0`), un hash pseudoaleatorio enciende luces en un subconjunto de ventanas con tonos cálidos ($1.0, 0.70, 0.36$).
- **Cubiertas y tejados:** Detección de normales cenitales para aplicar texturas de grava, teja cerámica o placas solares.

### 2.3 Shader de la Brocha de Construcción (`uBrush`)
El shader inyecta una caja delimitadora `vec4 uBrush` (`x0, y0, x1, y1`) en las coordenadas de mundo `vWP`:
```glsl
if (uBrushOn > 0.5 && vWP.x > uBrush.x && vWP.x < uBrush.z && vWP.z > uBrush.y && vWP.z < uBrush.w) {
  diffuseColor.rgb = mix(diffuseColor.rgb, uBrushCol, 0.45);
}
```
Permite proyectar instantáneamente el radio de acción del cursor sobre el terreno y edificios sin crear geometrías temporales.

---

## 3. Texturas de Datos GPU (`DataTextures`)

Para evitar enviar mallas pesadas a la tarjeta gráfica al cambiar zonificaciones o vistas de análisis:

1. **`Gfx.zoneTex` ($208 \times 208$ RGBA DataTexture):**
   - Almacena en los canales RGB los colores de zonificación de cada casilla (residencial, comercial, industrial).
   - El canal Alpha define si la cuadrícula de zonificación está visible (`uGrid = 1`).
2. **`Gfx.ovTex` ($208 \times 208$ RGBA DataTexture):**
   - Almacena los mapas de calor (*heatmaps*) de la ciudad generados por `Sim.overlayFn(key)`: tráfico en tiempo real, valor del suelo, polución, ruido, criminalidad, cobertura de bomberos y delimitación de distritos.

---

## 4. Mallas Instanciadas Masivas (`InstancedMesh`)

En [src/render/meshes.ts](file:///home/dev/projects/city-builder/src/render/meshes.ts), todos los elementos repetitivos se agrupan en `THREE.InstancedMesh`:
- **Vehículos y Transeúntes:** Un único búfer instanciado donde cada coche o peatón actualiza su matriz de transformación 3D ($X, Y, Z$, orientación de morro y cabeceo) y su color en cada fotograma.
- **Árboles y Vegetación:** Instanciados con ligeras variaciones de escala y rotación aleatoria para romper la monotonía visual.
- **Edificios Zonificados:** Módulos cúbicos instanciados con metadatos de nivel, estilo y altura.

---

## 5. Etiquetas 3D Flotantes en Perspectiva (`updateDistrictLabels`)

Las insignias de los distritos no son carteles 3D fijos en la escena, sino elementos DOM proyectados en tiempo real sobre la capa `<div id="districtLabels">`:

```typescript
const wx = (dist.cx + 0.5) * T;
const wz = (dist.cy + 0.5) * T;
const wy = Math.max(World.groundH(wx, wz), C.WATER) + 12;

_projV.set(wx, wy, wz);
_projV.project(Gfx.camera); // Transforma coordenadas 3D de mundo a NDC (-1 a +1)

const sx = (_projV.x * 0.5 + 0.5) * window.innerWidth;
const sy = (-_projV.y * 0.5 + 0.5) * window.innerHeight;
```

- **Oclusión:** Se ocultan automáticamente si están a la espalda de la cámara (`_projV.z >= 1.0`) o fuera del encuadre visual.
- **Interactividad nativa:** Soportan eventos de ratón (`hover`, escalado suave CSS, clic para enfocar cámara y abrir panel de políticas).

---

## 6. Malla Paramétrica Subterránea de Tuberías (`ch.pipe` y `Gfx.mats.pipe`)

En [src/render/meshes.ts](file:///home/dev/projects/city-builder/src/render/meshes.ts), cada chunk divide su infraestructura en `ch.infra` (calzadas, aceras y vías) y `ch.pipe` (conducciones subterráneas de agua y saneamiento):
- **Cilindros y Juntas de Acople:** Ensamblados proceduralmente con `GB.tube(P0, P1, r, seg, col)` que interpola la inclinación 3D exacta del terreno entre el centro de la casilla y las fronteras compartidas, eliminando cualquier discontinuidad entre tramos contiguos. Incluye collares de acople intermedios, bridas metálicas y manifolds de nudo central.
- **Material X-Ray (`Gfx.mats.pipe`):** Emplea `depthTest: false` y `renderOrder: 15`, lo que permite visualizar las conducciones a través de la calzada superior.
- **Gestión de Visibilidad Reactiva:** `Meshes.setPipeVisibility()` activa o desactiva las mallas de tuberías según el contexto de la interfaz (modo tubería, vistas de agua o alcantarillado), manteniendo la vista principal despejada para el tráfico urbano.
