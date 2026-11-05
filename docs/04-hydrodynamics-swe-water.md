# 04. Simulación Hidrodinámica (Shallow Water Equations - SWE 2.5D)

Este módulo detalla el funcionamiento del solver de física de fluidos en tiempo real, responsable de la propagación de ríos, inundaciones, acumulación en lagos y su interacción con las herramientas de terraformación.

---

## 🌊 Fundamento Matemático: Ecuaciones de Aguas Someras

En una simulación de escala municipal, calcular Navier-Stokes en 3D volumétrico es computacionalmente inviable para hardware doméstico. En su lugar, el motor adopta las **Ecuaciones de Aguas Someras (SWE 2.5D)** sobre una cuadrícula regular acoplada al lecho del terreno:

* $b(x, z)$: Altura del lecho del terreno.
* $d(x, z)$: Profundidad local de la columna de agua.
* $\eta(x, z) = b(x, z) + d(x, z)$: Cota de la superficie libre del agua.
* $u, v$: Componentes horizontales de velocidad/flujo en $X$ y $Z$.
* $g = 9.81 \, m/s^2$: Aceleración de la gravedad terrestre.

### 1. Ecuación de Momento (Flujo por Desnivel de Superficie)
La aceleración del agua entre celdas contiguas se rige por la pendiente de la superficie libre:

$$\frac{\partial Q_x}{\partial t} = -g \cdot d \cdot \frac{\partial \eta}{\partial x} - \gamma \cdot Q_x$$

Donde $\gamma$ representa el factor de amortiguación o fricción del lecho para garantizar estabilidad numérica incondicional.

### 2. Ecuación de Continuidad (Conservación de Masa)
La variación en la profundidad del agua dentro de una celda equivale a la divergencia neta de los flujos entrantes y salientes:

$$\frac{\partial d}{\partial t} + \frac{\partial Q_x}{\partial x} + \frac{\partial Q_z}{\partial z} = S$$

Donde $S$ es la tasa neta de fuentes (manantiales/lluvia) o sumideros (bombas/bordes de drenaje).

---

## 🛠️ Implementación en el Web Worker

El solver se encuentra en [`src/core/water/shallow_water_solver.ts`](../src/core/water/shallow_water_solver.ts) y opera exclusivamente en el Worker (`src/worker/sim.worker.ts`):
1. **Paso Físico Fijo (`Fixed Timestep`):** Se ejecuta a 20 Hz constante ($\Delta t = 50ms$).
2. **Transferencia de Buffers:** Cada tick, el Worker extrae el array `waterDepth` y lo transfiere al Main Thread como un `Float32Array`.
3. **Malla Dinámica en Render:** [`DynamicWaterMesh`](../src/render/terrain/dynamic_water_mesh.ts) lee este buffer y eleva los vértices de agua a $(b + d)$ sin alocar objetos en memoria.

---

## 🌋 Interacción con la Terraformación

* **Al excavar una zanja:** El lecho $b$ desciende, creando una pendiente hidrostática negativa. El agua circundante fluye hacia el cauce nuevo de forma inmediata.
* **Al elevar terreno sumergido:** El lecho $b$ asciende, forzando un gradiente positivo que expulsa el agua hacia las celdas adyacentes, simulando olas y desplazamientos de volumen reales.
