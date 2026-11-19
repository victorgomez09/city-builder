# 🌍 Generación del Mundo, Terreno y Topología Vial

## 1. Generación Procedural del Terreno

La orografía se genera en la función `generate(seed, map)` en [src/world/world.ts](file:///home/dev/projects/city-builder/src/world/world.ts).

### 1.1 Mapas Base Disponibles
- **Valley (`valley`):** Valle amplio entre dos cordilleras montañosas laterales con un río central sinuoso.
- **Plains (`plains`):** Llanura abierta con suaves ondulaciones y bajo gradiente de pendiente.
- **Highlands (`highlands`):** Terreno escarpado con colinas rocosas y terrazas naturales.
- **Lakes (`lakes`):** Cuenca lacustre con lagos orgánicos profundos y bosques densos.

### 1.2 Algoritmo de Lagos Orgánicos Suavizados
Para evitar lagos con cortes bruscos, bordes en temblor (*jittering*) o ángulos de 90 grados, el generador utiliza un campo de distancias continuo con unión polinómica suave (`smin`):

```typescript
function smin(a: number, b: number, k = 14): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * h * (k / 6);
}
```

- **Múltiples lóbulos orgánicos:** Cada lago se compone de un cuerpo elíptico principal y lóbulos secundarios con rotación arbitraria y modulación armónica suave.
- **Límites de seguridad:** Las coordenadas de los lagos se restringen a $x \in [52, 136]$ e $y \in [48, 156]$ para garantizar que no toquen los bordes del mapa ni colisionen con la autopista inicial ($hwRow \approx 104$).
- **Suelo de elevación base:** Se impone un suelo `Math.max(h, 2.0)` en las casillas adyacentes para que el ruido procedural no cree charcos accidentales ni fluctuaciones de vértices en el shader de agua.
- **Cota del Agua:** Definida en `C.WATER = 0.0`. Cualquier vértice con $h \le 0.0$ queda sumergido.

---

## 2. Consulta y Nivelación de Alturas

### 2.1 Métodos de Vértices y Pendientes
- `World.cornerH(x, y)`: Devuelve la altura del vértice en $(x, y)$.
- `World.tileCorners(i)`: Devuelve las 4 esquinas de la casilla `[c0, c1, c2, c3]` en sentido horario desde la superior izquierda.
- `World.tileAvg(i)`: Media aritmética de las 4 esquinas de la casilla.
- `World.tileMin(i)` / `World.tileMax(i)`: Mínimo y máximo de elevación de la casilla.
- `World.slope(i)`: Diferencia de cota máxima entre esquinas (`tileMax - tileMin`).
- `World.isWater(i)`: Devuelve `true` si `tileMin(i) <= C.WATER` o si el río pasa por la casilla.

### 2.2 Nivelación de Terrazas para Edificios (`levelLot`)
Los edificios de servicios y zonas requieren una base nivelada para no flotar ni quedar enterrados:
1. Se calcula la altura máxima de las esquinas del solar: $mx = \max(h_{x, y})$.
2. Se allanan los vértices interiores del solar a $mx$.
3. Se calcula un talud suave en las casillas adyacentes de 1 celda de distancia para evitar paredes verticales.
4. Los cambios se persisten en `World.hcEdits` para su inclusión en la partida guardada.

---

## 3. Red Vial y Conectividad

### 3.1 Topología de Carreteras y Enlaces
Cada casilla con carretera almacena:
- `World.road[i]`: ID del tipo de vía según `C.ROADS` (calle de 2 carriles, avenida de 4 carriles, vía de un sentido, etc.).
- `World.link[i]`: Máscara binaria de 4 bits que define a qué vecinos cardinales está conectada la casilla:
  - Bit 0: Norte ($dy = -1$)
  - Bit 1: Este ($dx = +1$)
  - Bit 2: Sur ($dy = +1$)
  - Bit 3: Oeste ($dx = -1$)
- `World.rdir[i]`: Dirección de avance del tráfico (0 = Norte, 1 = Este, 2 = Sur, 3 = Oeste).
- `World.rpart[i]`: Subtipo para dobles calzadas (1 = carril derecho, 3 = carril izquierdo).
- `World.curv[i]`: Bandera booleana que indica si el tramo forma parte de una curva suave Bezier.

### 3.2 Clústeres de Intersecciones (`Junction Clusters`)
Cuando 3 o más enlaces confluyen o se cruzan vías multicarril, `World.updateJunctions()` agrupa las casillas en un `JunctionCluster`:

```typescript
export interface JunctionCluster {
  id: number;
  tiles: number[];        // Casillas que forman el cruce
  ctrl: string;           // 'auto' | 'lights' | 'stop' | 'allstop' | 'round' | 'none'
  aps: JunctionApproach[];// Vías de aproximación entrantes
  exits: JunctionExit[];  // Vías de salida
  mask: Uint8Array;       // Giros permitidos por dirección
  cfg: JunctionConfig;    // Flechas de carril y configuración del usuario
}
```

- **Semaforización (`lights`):** Alterna fases de paso verde/rojo para evitar colisiones.
- **Rotondas (`round`):** Prioridad a los vehículos ya incorporados al anillo.
- **Flechas de carril configurables:** Flecha izquierda ($\leftarrow$), de frente ($\uparrow$), derecha ($\rightarrow$) y cambio de sentido ($\circlearrowleft$).

---

## 4. Zonabilidad y Conexión Exterior

1. **`World.updateZonable()`:**
   - Realiza una búsqueda en anchura (BFS) de hasta 3 casillas de distancia desde cualquier tramo de carretera habilitado para edificación (`R.zoneable !== false`).
   - Marca `World.zonable[i] = 1`, permitiendo que la herramienta de zonificación asigne parcelas RCI.
2. **`World.updateConn()`:**
   - Inicia un flood-fill desde las casillas de borde de la autopista externa (`World.outside = [outIn, outOut]`).
   - Marca `World.conn[i] = 1` en todas las carreteras que tienen un camino físico continuo hacia el exterior de la región.
   - Las casillas sin conexión sufren un fuerte penalizador de felicidad (-35) y no reciben nuevos habitantes ni mercancías.
