# 🚗 Tráfico, Navegación y Transporte Masivo

Los sistemas en [src/traffic/traffic.ts](file:///home/dev/projects/city-builder/src/traffic/traffic.ts) y [src/transit/transit.ts](file:///home/dev/projects/city-builder/src/transit/transit.ts) simulan el movimiento de miles de ciudadanos, mercancías, vehículos de emergencia y redes de transporte público.

---

## 1. El Grafo de Enrutamiento y Navegación A*

### 1.1 Función de Coste Vial (`roadCost`)
El coste de atravesar una casilla de carretera $i$ combina la longitud geométrica ($T=20\text{ m}$), la velocidad límite de la vía y el nivel de congestión en tiempo real:

$$\text{ratio} = \frac{\text{Traffic.load}[i]}{\text{R.cap}}$$
$$\text{cong} = 1 + 4 \cdot \max(0, \text{ratio} - 0.35)^2$$
$$\text{coste} = \left(\frac{T}{\text{R.speed}}\right) \cdot \text{cong}$$

- **Penalización por giros:** Girar a la izquierda añade $+0.6\text{ s}$ por cruzar tráfico contrario; cambios de sentido (*U-turns*) añaden $+8.0\text{ s}$.
- **Restricción ZBE (Distritos):** Si la casilla pertenece a un distrito con la política `heavyTrafficBan` activada y es una calle local (`R.grp === 'small'`), se añade un recargo de $+8.0\text{ s}$ para disuadir el tráfico pesado de atravesar el vecindario.

### 1.2 Caché de Rutas (`pathCache`)
Para maximizar los FPS, las rutas calculadas se guardan en una caché LRU indexada por `src * N + dst` que se invalida automáticamente cuando la red vial cambia (`World.roadVer++`).

---

## 2. Tipos de Vehículos y Ciclo de Vida

Los vehículos se registran en `Traffic.vehicles`:

| Tipo | Velocidad Base | Longitud ($L$) | Rol en la Ciudad |
| :--- | :--- | :--- | :--- |
| **`car`** | $13.8\text{ m/s}$ ($50\text{ km/h}$) | $4.5\text{ m}$ | Viajes pendulares de ciudadanos (casa $\leftrightarrow$ trabajo/ocio). |
| **`suv`** | $13.8\text{ m/s}$ | $4.8\text{ m}$ | Tráfico privado de familias de clase media/alta. |
| **`van`** | $12.5\text{ m/s}$ | $5.5\text{ m}$ | Mudanzas hacia nuevas viviendas construidas. |
| **`truck`** | $10.0\text{ m/s}$ | $7.4\text{ m}$ | Reparto de bienes industriales a comercios y envíos exteriores. |
| **`bus`** | $11.0\text{ m/s}$ | $11.5\text{ m}$ | Transporte colectivo en líneas municipales de autobús. |
| **`tram`** | $11.0\text{ m/s}$ | $15.0\text{ m}$ | Tranvías que circulan por vías acanaladas en calzada. |
| **`police`** | $16.5\text{ m/s}$ | $4.6\text{ m}$ | Patrulla preventiva y respuesta prioritaria a crímenes. |
| **`fire`** | $14.0\text{ m/s}$ | $8.0\text{ m}$ | Camión de bomberos con prioridad de paso para extinguir fuegos. |
| **`ambulance`** | $15.5\text{ m/s}$ | $5.8\text{ m}$ | Asistencia médica urgente hacia viviendas con baja salud. |
| **`garbage`** | $9.0\text{ m/s}$ | $7.5\text{ m}$ | Recogida sistemática de residuos acumulados en parcelas. |

---

## 3. Agentes Ligeros: Ciclistas y Peatones (`Soft Agents`)

A través de `Traffic.spawnSoft()`, los ciudadanos que optan por no usar vehículo privado se mueven por aceras y senderos peatonales (`pcell`):

- **Peatones (`ped`):** Caminan a $1.4\text{ m/s}$ por aceras y sendas verdes.
- **Ciclistas (`bike`):** Se desplazan a $5.2\text{ m/s}$. El algoritmo evalúa el índice de confort ciclista `tileBikeScore(i)`:
  - Las calles pacificadas, aceras anchas y carriles bici exclusivos disparan la puntuación.
  - La política de distrito `bikeCity` suma automáticamente $+0.45$ al confort de todas las vías del distrito, derivando viajes en automóvil hacia la bicicleta.

---

## 4. Redes de Transporte Público (`Transit`)

El gestor [src/transit/transit.ts](file:///home/dev/projects/city-builder/src/transit/transit.ts) coordina las líneas regulares:

```mermaid
flowchart LR
    ParadaA["Parada A (Andén / Marquesina)"] -->|Recorrido de Línea| ParadaB["Parada B"]
    ParadaB -->|Recorrido de Línea| ParadaC["Parada C"]
    ParadaC -->|Vuelta al Origen| ParadaA

    Pasajeros["Ciudadanos Esperando"] -->|Abordan en Dwell Time| Vehiculo["Vehículo (Capacidad Máxima)"]
    Vehiculo -->|Bajan en destino| Destino["Zona de Trabajo o Comercio"]
```

- **Líneas de Autobús (`bus`):** Flexibles, paradas sobre bordillo, bajo coste de infraestructura.
- **Tranvías en Calzada (`tram`):** Mayor capacidad ($60\text{ pasajeros}$), circulan por raíles integrados en calles de 4 carriles.
- **Trenes de Cercanías (`rail`):** Conectan barrios periféricos a gran velocidad sobre balasto elevado.
- **Metro Subterráneo (`metro`):** Estaciones soterradas de altísima capacidad ($200\text{ pasajeros}$) sin consumir espacio en superficie.

---

## 5. Arquitectura Modular del Motor de Tráfico (`src/traffic/`)

El subsistema de tráfico ha sido descompuesto en módulos especializados de alto rendimiento:

- **[src/traffic/traffic.ts](file:///home/dev/projects/city-builder/src/traffic/traffic.ts):** Orquestador central de vehículos, despacho de peticiones (`request`), gestión de flotas y renderizado de mallas instanciadas.
- **[src/traffic/pathfinding.ts](file:///home/dev/projects/city-builder/src/traffic/pathfinding.ts):** Algoritmo A* bidireccional sobre la cuadrícula vial, evaluación de giros prohibidos y coste dinámico por congestión.
- **[src/traffic/trajectories.ts](file:///home/dev/projects/city-builder/src/traffic/trajectories.ts):** Cálculo de curvas Bézier cuadráticas (`Bezier2D`), alineación de transiciones entre carriles (`boundaryLanes`) y desfases laterales de acera/calzada.
- **[src/traffic/signals.ts](file:///home/dev/projects/city-builder/src/traffic/signals.ts):** Máquina de estados de semáforos (fases verde/ámbar/todo-rojo), arbitraje de señales de stop y detección de bloqueos en puntos de spawn.
- **[src/traffic/visitorActivities.ts](file:///home/dev/projects/city-builder/src/traffic/visitorActivities.ts):** Simulación peatonal en parques y plazas: paseos procedimentales, sentarse en bancos, columpios, toboganes, skateparks y física de baloncesto.

---

## 6. Impedancia por Conflicto Social y Huelgas de Transporte (Fase 3.5)

El sistema de tráfico y transporte integra las consecuencias del malestar social:

### 6.1 Cortes por Manifestaciones y Barricadas
En `src/traffic/pathfinding.ts:roadCostWithLoad()`, las celdas afectadas por conflictividad modifican el coste de enrutamiento $A^*$:
- **Manifestaciones Vecinales (`Unrest.isProtestOnRoad`):** Multiplican el coste por **$4.5\times$**, forzando al tráfico privado y comercial a buscar vías secundarias.
- **Barricadas de Disturbios (`Unrest.isRoadBlocked`):** Multiplican el coste por **$15.0\times$**, bloqueando de facto la calle para turismos y transporte público hasta su retirada o intervención policial.

### 6.2 Estrangulamiento de Transporte Masivo por Huelga
En `src/transit/transit.ts:spawnVehicles()`, si la huelga de transporte está activa (`Unrest.state.strikes.transit`):
- El número máximo de convoyes y autobuses por línea se limita al **$25\%$** de la dotación nominal.
- Se producen saturaciones agudas en andenes y colas masivas de viajeros en espera.
- La firma del convenio con la *Federación Unitaria del Transporte* restaura de inmediato la frecuencia al $100\%$.
