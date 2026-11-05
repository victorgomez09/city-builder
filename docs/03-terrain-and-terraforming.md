# 03. Terreno Dinámico y Deformación (Terraformación)

Este módulo describe la arquitectura de la cuadrícula de alturas (*Heightfield*), la generación procedural determinista y las brochas de terraformación en tiempo real.

---

## 📐 Estructura del Heightfield y Generación Fable Cities

El mundo se discretiza en una cuadrícula de dimensiones $W \times H$ celdas con topografía costera natural:
* **Vértices:** $(W + 1) \times (H + 1)$.
* **Alturas:** Array lineal `Float32Array((W + 1) * (H + 1))`.
* **Coordenada de Vértice en Array:** 
  $$\text{index}(x, z) = z \cdot (W + 1) + x$$
* **Composición Geográfica (`terrain_data.ts`):**
  - **Sector Sureste:** Océano abierto con playa curva de arena natural.
  - **Sector Central:** Valle fértil y llanura aluvial con meandros de río y lagunas costeras.
  - **Sector Norte / Noroeste:** Gran cordillera montañosa con crestas abruptas, riscos rocosos y cumbres nevadas.
* **Biomas por Celda:** `Uint8Array(W * H)`. Se categoriza en:
  - `0`: Agua profunda / Océano / Río
  - `1`: Arena de playa y orilla
  - `2`: Pradera y césped aluvial
  - `3`: Vegetación densa / Bosque
  - `4`: Roca de montaña y nieve alpina

---

## 🛠️ Algoritmo de las Brochas de Terraformación

Implementado en [`src/core/terrain/terrain_modifier.ts`](../src/core/terrain/terrain_modifier.ts).

### 1. Falloff Cosenoidal Suave
Para que la brocha no produzca columnas cuadradas o escalones artificiales, aplicamos una atenuación radial suave basada en la función coseno en el intervalo $[0, \pi]$:

$$\text{dist} = \sqrt{(v_x - \text{gridX})^2 + (v_z - \text{gridZ})^2}$$

$$\text{falloff} = \frac{1}{2} \left(1 + \cos\left(\frac{\text{dist}}{\text{radius}} \cdot \pi\right)\right)$$

### 2. Modos de Brocha
1. **`RAISE`:** $h_{\text{nueva}} = h_{\text{actual}} + \text{fuerza} \cdot \Delta t \cdot \text{falloff}$
2. **`LOWER`:** $h_{\text{nueva}} = \max(0, h_{\text{actual}} - \text{fuerza} \cdot \Delta t \cdot \text{falloff})$
3. **`FLATTEN`:** Acerca $h_{\text{actual}}$ hacia $\text{targetHeight}$ proporcionalmente a $\text{falloff}$.
4. **`SMOOTH`:** Calcula el promedio aritmético local de alturas de los vértices dentro del radio y mueve cada vértice hacia ese promedio.

---

## 🎨 Render Dinámico en GPU

En lugar de reconstruir toda la malla `BufferGeometry` al deformar (lo que causaría pausas de 10-30ms), [`DynamicTerrainMesh`](../src/render/terrain/dynamic_terrain_mesh.ts) utiliza:
* `Float32BufferAttribute` con bandera `DynamicDrawUsage`.
* Actualización de posiciones y recálculo de normales flat-shading en caliente únicamente dentro de la sub-caja afectada $[minVX, maxVX, minVZ, maxVZ]$.
