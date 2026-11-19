# 🏛️ Distritos Municipales, Políticas y Especializaciones (Fase 1)

El sistema de distritos permite a los alcaldes descentralizar la gobernanza de la metrópoli, aplicar normativas sectoriales, definir zonas de bajas emisiones y orientar la economía de cada barrio hacia sectores específicos.

---

## 1. Modelo de Datos y Búferes

En [src/types/index.ts](file:///home/dev/projects/city-builder/src/types/index.ts) y [src/world/world.ts](file:///home/dev/projects/city-builder/src/world/world.ts):

```typescript
export interface District {
  id: number;                            // ID único entre 1 y 254 (0 = sin distrito)
  name: string;                          // Nombre del barrio (ej: "Pine Hills", "Oak Park")
  color: string;                         // Color hexadecimal temático de la paleta
  spec: DistrictSpecialization;          // Especialización económica asignada
  policies: DistrictPolicies;            // Diccionario booleano de políticas activas
  stats: DistrictStats;                  // Estadísticas demográficas y de consumo en vivo
  cx: number;                            // Coordenada X del centroide (en casillas)
  cy: number;                            // Coordenada Y del centroide (en casillas)
}
```

- **Almacenamiento en cuadrícula:** `World.district = new Uint8Array(208 * 208)` asigna instantáneamente cada casilla del mapa a un distrito con coste cero de recolección de basura.
- **Centroides Dinámicos:** `World.updateDistrictCentroids()` calcula la media geométrica $(\bar{x}, \bar{y})$ de todas las casillas del distrito para posicionar etiquetas 3D y centrar la cámara.

---

## 2. Las 7 Especializaciones de Distrito

| Clave | Especialización | Efecto en la Simulación y Economía |
| :--- | :--- | :--- |
| **`none`** | **Estándar / Mixto** | Parámetros municipales generales sin sesgo sectorial. |
| **`eco_res`** | **Residencial Ecológico** | Edificios de bajo consumo: $-30\%$ electricidad y agua, $-20\%$ generación de basura, $+6$ felicidad vecinal. |
| **`nightlife`** | **Ocio Nocturno y Hostelería** | Comercios con horario extendido: $+25\%$ afluencia de clientes y mayor recaudación fiscal comercial, a costa de mayor ruido nocturno ($+15$) y leve incremento de criminalidad. |
| **`organic`** | **Comercio Orgánico Local** | Tiendas y supermercados abastecidos con productos locales: $+7$ satisfacción residencial y mejora de la salud pública. |
| **`farming`** | **Agricultura y Granjas** | Las industrias zonificadas no emiten polución pesada ($0\text{ polución}$) y reducen a la mitad el riesgo de incendio industrial. |
| **`forestry`** | **Silvicultura y Maderas** | Aprovechamiento maderero renovable: reduce un $50\%$ la contaminación industrial sin penalizar el empleo. |
| **`tech`** | **Alta Tecnología e Innovación** | Parques empresariales de oficinas limpias: $+25\%$ ingresos por impuesto de sociedades, sin polución, pero exige trabajadores con estudios superiores. |

---

## 3. Las 8 Políticas Municipales

| Política | Clave | Coste Mensual | Efectos Mecánicos Directos |
| :--- | :--- | :--- | :--- |
| **Zona de Bajas Emisiones** | `heavyTrafficBan` | Gratuita | Penaliza fuertemente el coste de ruta ($+8\text{ s}$) para camiones pesados y tráfico pasante en calles locales, desviándolos hacia avenidas y circunvalaciones. |
| **Contadores de Agua** | `waterMetering` | Gratuita | Obliga a instalar contadores de consumo: reduce el gasto de agua del distrito un $20\%$, con una leve penalización de felicidad ($-2$). |
| **Prohibición de Fumar** | `smokingBan` | Gratuita | Prohíbe fumar en espacios cerrados: $+4$ felicidad vecinal, $+5$ salud pública, con una pequeña reducción en recaudación de ocio ($-2$). |
| **Reciclaje Domiciliario** | `recycling` | $\$15\text{ / 100 tiles}$ | Campaña intensiva de recogida selectiva que reduce un $30\%$ la basura generada por las viviendas y comercios. |
| **Detectores de Humo** | `smokeDetectors` | $\$20\text{ / 100 tiles}$ | Distribución subvencionada de alarmas contra incendios: reduce el riesgo de inicio de fuego un $80\%$. |
| **Transporte Gratuito** | `freeTransit` | $\$25\text{ / 100 tiles}$ | Líneas de autobús, tranvía y tren sin coste de billete dentro del distrito: dispara la afluencia de viajeros y reduce el tráfico en coche. |
| **Plan Ciudad Ciclable** | `bikeCity` | $\$10\text{ / 100 tiles}$ | Suma $+0.45$ al confort de todas las vías para bicicletas del distrito, incentivando desplazamientos en dos ruedas y reduciendo la polución acústica. |
| **Alivio Fiscal a Pymes** | `localBusinessTaxRelief` | Menor ingreso | Rebaja un $25\%$ el tipo impositivo comercial local: estimula la supervivencia de tiendas de barrio y añade $+8$ de felicidad comercial. |

---

## 4. Visualización e Interacción

### 4.1 Capa GPU de Distritos (`overlayFn('district')`)
Al pintar distritos o seleccionar la vista de información correspondiente:
- Cada casilla del distrito se tiñe con su color asignado (`dist.color`).
- El shader detecta casillas perimetrales (cuyos vecinos pertenecen a otro distrito o a ninguno) y eleva la opacidad a $0.78$, creando un borde delimitador nítido e iluminado. El interior se renderiza con una transparencia suave del $0.35$.

### 4.2 Insignias 3D Flotantes en Pantalla
El método `Gfx.updateDistrictLabels()` proyecta el centroide de cada distrito habitado hacia la pantalla:
- Insignia con cápsula traslúcida (*glassmorphism*), punto de color identificativo, título y subtítulo dinámico (*Especialización · Población*).
- Al hacer clic sobre cualquier insignia en el espacio 3D, la cámara enfoca suavemente el centro del barrio y despliega el panel de gestión en el menú lateral.
