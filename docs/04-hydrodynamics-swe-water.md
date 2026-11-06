# 04. Simulación Hidrodinámica (SWE 2.5D) y Malla de Agua Física

Este módulo detalla el funcionamiento del solver de física de fluidos en tiempo real y el renderizado óptico del agua basado en físicas (PBR) acoplado a la simulación SWE a escala regional (~160 km²).

---

## 🌊 1. Fundamento Matemático: Ecuaciones de Aguas Someras (SWE 2.5D)

En una simulación de escala municipal y regional ($12.8\text{ km} \times 12.8\text{ km}$), calcular Navier-Stokes en 3D volumétrico es inviable para hardware doméstico a 60 FPS. El motor adopta las **Ecuaciones de Aguas Someras (SWE 2.5D)** sobre una cuadrícula regular acoplada al lecho del terreno:

* $b(x, z)$: Altura del lecho del terreno.
* $d(x, z)$: Profundidad local de la columna de agua.
* $\eta(x, z) = b(x, z) + d(x, z)$: Cota de la superficie libre del agua.
* $Q_x, Q_z$: Caudales horizontales de flujo en $X$ y $Z$.
* $g = 9.81 \, m/s^2$: Aceleración de la gravedad terrestre.

### Ecuación de Momento
$$\frac{\partial Q_x}{\partial t} = -g \cdot d \cdot \frac{\partial \eta}{\partial x} - \gamma \cdot Q_x$$

Donde $\gamma$ representa el factor de fricción y disipación viscosa para garantizar estabilidad numérica incondicional.

### Ecuación de Continuidad
$$\frac{\partial d}{\partial t} + \frac{\partial Q_x}{\partial x} + \frac{\partial Q_z}{\partial z} = S$$

Donde $S$ es la tasa neta de fuentes (lluvia / manantiales) y sumideros (bombas / drenaje periférico).

---

## 💎 2. Modelo Óptico de Superficie de Agua (`DynamicWaterMesh`)

Implementado en [`src/render/terrain/dynamic_water_mesh.ts`](../src/render/terrain/dynamic_water_mesh.ts) y [`src/render/assets/asset_manager.ts`](../src/render/assets/asset_manager.ts):

### A. Superficie Física Horizontal Estricta
- **Cero Deformaciones Piramidales:** A diferencia de enfoques ingenuos donde los vértices de agua se elevan con el terreno seco provocando muros oblicuos y z-fighting, la superficie de agua se sitúa de forma físicamente rigurosa en su cota de flotación horizontal:
  $$y_{\text{agua}} = y_{\text{seaLevel}} + d_{\text{SWE}}$$
- **Intersección Sub-Píxel con el Terreno:** Al ser una superficie horizontal y el terreno una malla opaca con `depthWrite: true`, la prueba de profundidad de la GPU (Z-Buffer) recorta la línea de costa con precisión analítica sub-píxel.
- **Profundidad de Columna de Agua Real ($aDepth$):**
  $$d_{\text{efectiva}} = \max\left(0, y_{\text{agua}} - b(x, z)\right)$$
  Bajo tierra firme ($d \le 0.015\text{m}$), los fragmentos se descartan inmediatamente (`discard`), eliminando sombreado redundante bajo las montañas.

### B. Texturas PBR de Normales y Oleaje Procedimental (`AssetManager`)
- Textura de normales de 256×256 generada proceduralmente y empaquetada en `RGBA`:
  - **Canales R, G, B:** Vectores normales unitarios en espacio tangente $\vec{N} = \text{normalize}(-\partial h/\partial u, -\partial h/\partial v, 1.0)$ resultantes de 8 armónicos periódicos cerrados:
    $$h(u, v) = \sum_{i=1}^8 A_i \sin\left(2\pi (k_{x,i} u + k_{y,i} v) + \phi_i\right) \quad \text{con } k_{x,i}, k_{y,i} \in \mathbb{Z}$$
    Garantiza una tileabilidad matemática 100% continua, sin costuras visibles ni discontinuidades periódicas.
  - **Canal A:** Máscara de crestas de oleaje y cáusticas.
  - **Mipmapping Anisotrópico:** Generación automática de mipmaps (`LinearMipmapLinearFilter`) para erradicar cualquier artefacto de aliasing o efecto muaré a cualquier distancia de cámara.

### C. Sombreador Dinámico en Doble Escala y Corriente Fluvial
- **Flujo Longitudinal del Río (Macro Swell):**
  $$uv_1 = (x, z) \cdot 0.0055 + t \cdot (0.012, 0.032)$$
  Simula la corriente viva del río desplazándose de norte a sur hacia la bahía marítima.
- **Chop Fino y Oleaje de Viento (Micro Ripples):**
  $$uv_2 = (x, z) \cdot 0.022 + t \cdot (-0.024, 0.018)$$
- **Fusión Ponderada de Normales:**
  $$\vec{N}_{\text{blended}} = \text{normalize}\left(0.65 \vec{n}_1^{xy} + 0.40 \vec{n}_2^{xy}, \, 0.75 \vec{n}_1^z + 0.25 \vec{n}_2^z\right)$$

### D. Rampa de Absorción Lumínica según Profundidad (Ley de Beer-Lambert)
La luz incidente se absorbe de forma continua según la columna de agua $d$:
- **Aguas Someras / Ribera ($d < 0.8\text{m}$):** Turquesa esmeralda cristalino y luminoso (`#14a3ad`).
- **Profundidad Media ($0.8\text{m} \le d \le 4.0\text{m}$):** Azul ultramar oceánico vibrante (`#09578a`).
- **Gran Profundidad / Mar Abierto ($d > 4.0\text{m}$):** Azul marino profundo y solemne (`#031733`).
- **Transparencia en Orilla:** Opacidad suavemente graduada ($\alpha = 0.55 \to 0.94$), permitiendo divisar el lecho arenoso y cantos rodados en la orilla del río y playas.

### E. Espuma Dinámica en Rompientes y Playas (Animated Foam)
- Orla de espuma suave en la banda $d < 0.42\text{m}$ modulada por ruido fractal de `uNoise` y pulsación periódica de marea $\sin(22 d - 3.2 t)$.
- Color blanco espuma (`#f2faff`) mezclado orgánicamente sobre la superficie del agua.

### F. Destellos Solares Especulares (Sun Glitter) y Fresnel
- Cálculo directo de destello especular según el vector solar incidente $\vec{L}_{\text{sun}}$ y el vector de vista $\vec{V}$:
  $$\vec{H} = \text{normalize}(\vec{L}_{\text{sun}} + \vec{V})$$
  $$I_{\text{glitter}} = 1.8 \cdot (\vec{N} \cdot \vec{H})^{110} + 0.30 \cdot (\vec{N} \cdot \vec{H})^{22}$$
- Atenuación automática con el ciclo día/noche mediante `uNight`.

### G. Océano Exterior Continuo hasta 36 km (`outerOceanMesh`)
- Topología geométrica híbrida que transforma el contorno cuadrado del mapa interior ($12.8\text{ km} \times 12.8\text{ km}$) en un disco oceánico infinito de radio exterior $36.000\text{ m}$.
- Cero discontinuidades visuales, compartiendo el mismo sombreador, normales y reflejos solares que el agua interior.
