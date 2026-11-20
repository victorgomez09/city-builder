# 🌐 Arquitectura de Internacionalización (i18n) y Localización Multilingüe (`docs/internationalization-and-localization.md`)

Este documento describe la arquitectura técnica del sistema de internacionalización (**i18n**) y localización multilingüe implementado en la **Fase 3.9** de Vira City.

---

## 🏛️ 1. Principios de Diseño

1. **Rendimiento Zero-Dependency & Zero-GC:**
   - Motor ligero nativo desarrollado en TypeScript sin librerías externas pesadas.
   - Diccionarios modulares desacoplados en `src/i18n/locales/` empaquetados estáticamente en la compilación de Vite sin latencias de red por peticiones `fetch`.
2. **Conmutación Dinámica en Caliente (*Hot Locale Switch*):**
   - El cambio de idioma se produce de forma inmediata en tiempo real sin requerir recargar la página, reiniciar el contexto WebGL ni interrumpir la simulación o la partida en curso.
3. **Respaldo Automático con Fallback Transparente:**
   - Si una clave o token no existe en el idioma activo, el motor recurre automáticamente a la versión en inglés (`en`), y si tampoco existiera, devuelve el texto de respaldo (*fallback*) o la clave literal.
4. **Formateo Regional Nativo con APIs `Intl`:**
   - Monedas, números y fechas se formatean respetando las normas y separadores decimales/millares de cada idioma mediante `Intl.NumberFormat`.

---

## 🧩 2. Estructura de Módulos

```
src/i18n/
├── index.ts          # Motor reactivo, funciones t(), formatMoney(), formatNumber(), formatDate()
├── types.ts          # Definición de tipos LocaleKey, LocaleInfo, TranslationDictionary
└── locales/          # Diccionarios de traducción
    ├── en.ts         # English (Predeterminado)
    ├── es.ts         # Español
    ├── de.ts         # Deutsch
    ├── fr.ts         # Français
    ├── zh.ts         # 简体中文
    └── ja.ts         # 日本語
```

---

## 🌍 3. Idiomas Soportados

| Código | Idioma | Nombre Nativo | Bandera |
| :---: | :--- | :--- | :---: |
| `en` | English | English | 🇬🇧 |
| `es` | Spanish | Español | 🇪🇸 |
| `de` | German | Deutsch | 🇩🇪 |
| `fr` | French | Français | 🇫🇷 |
| `zh` | Chinese | 简体中文 | 🇨🇳 |
| `ja` | Japanese | 日本語 | 🇯🇵 |

---

## ⚙️ 4. API Técnica

### 4.1 Traducción de Cadenas: `t(key, paramsOrFallback?, fallback?)`
Resuelve claves anidadas mediante notación por puntos (`topbar.funds`, `settings.title`) con interpolación de parámetros `{var}`:

```typescript
import { t } from '@/i18n';

// Clave simple
const title = t('settings.title');

// Con parámetros interpolados
const text = t('unrest.alert', { service: 'Transport' });

// Con valor de fallback opcional
const label = t('cats.custom', 'Default Label');
```

### 4.2 Formateo Regional

```typescript
import { I18n } from '@/i18n';

// Moneda ($1,250 en EN, $1.250 en ES/DE)
I18n.formatMoney(1250); // "$1,250"

// Números con separador de miles
I18n.formatNumber(43264); // "43,264" (EN) o "43.264" (ES)

// Fechas dinámicas
I18n.formatDate(2, 2026); // "Mar Year 2026" (EN) o "Mar Año 2026" (ES)
```

### 4.3 Sistema de Suscripción Reactiva: `onLocaleChange(callback)`

Los componentes de la interfaz de usuario se suscriben al conmutador de idioma:

```typescript
import { I18n } from '@/i18n';

const unsubscribe = I18n.onLocaleChange((newLocale) => {
  // Actualizar textos dinámicos
  applyI18n();
});
```

---

## 🖥️ 5. Integración Exhaustiva en la Interfaz (UI)

1. **Atributos Declarativos `data-i18n` y `data-i18n-title`:**
   En [index.html](file:///home/dev/projects/city-builder/index.html), los elementos de la pantalla de inicio `#start`, la barra superior `#topbar`, los menús de navegación `#menu` y la leyenda de controles contienen atributos declarativos que se actualizan automáticamente al conmutar el idioma.
2. **Selector de Idioma en Pantalla Completa:**
   En la ventana de [Settings](file:///home/dev/projects/city-builder/src/ui/panels/settings.ts), la primera tarjeta de configuración permite conmutar el idioma con previsualización de banderas y nombres nativos.
3. **Persistencia Automática:**
   La preferencia del jugador se almacena en `localStorage.getItem('viracity_locale')` y se detecta automáticamente la configuración del navegador (`navigator.language`) en el primer inicio.
4. **Cobertura Completa de Paneles y Vistas:**
   - [src/ui/panels/budget.ts](file:///home/dev/projects/city-builder/src/ui/panels/budget.ts): Presupuesto, impuestos residenciales, comerciales, industriales, oficinas, préstamos y amortización.
   - [src/ui/panels/districts.ts](file:///home/dev/projects/city-builder/src/ui/panels/districts.ts): Pintura de distritos, estadísticas de zona, las 9 especializaciones y las 8 ordenanzas municipales.
   - [src/ui/panels/views.ts](file:///home/dev/projects/city-builder/src/ui/panels/views.ts): Las 18 capas térmicas, acordeón contextual, desgloses cromáticos y consejos de planificación.
   - [src/ui/panels/stats.ts](file:///home/dev/projects/city-builder/src/ui/panels/stats.ts): Demografía, desempleo, desplazamientos, aforos de tráfico y edificios.
   - [src/ui/panels/transit.ts](file:///home/dev/projects/city-builder/src/ui/panels/transit.ts): Creación de líneas, asignación de flota, frecuencias, tarifas y paradas.
   - [src/ui/panels/unrest.ts](file:///home/dev/projects/city-builder/src/ui/panels/unrest.ts): Termómetro de tensión urbana, 5 niveles de conflicto, 6 factores de fricción, convenios sindicales y medidas de emergencia.
   - [src/ui/panels/supply.ts](file:///home/dev/projects/city-builder/src/ui/panels/supply.ts): Cadena logística, tasa de desabastecimiento, extracción de materias primas y balanza de comercio.
   - [src/ui/panels/junction.ts](file:///home/dev/projects/city-builder/src/ui/panels/junction.ts): Tipos de control de intersección, tiempos de verde, prioridades de rotonda y flechas de giro por carril.
   - [src/ui/panels/inspector.ts](file:///home/dev/projects/city-builder/src/ui/panels/inspector.ts): Inspección de edificios (12 problemas y diagnósticos, niveles, suministros), vehículos (velocidad, carril, seguimiento con cinta 3D) y paradas de transporte.
   - [src/ui/panels/saveHub.ts](file:///home/dev/projects/city-builder/src/ui/panels/saveHub.ts): Gestor de partidas guardadas, autoguardados cíclicos, importación y exportación de archivos `.viracity`.
   - [src/ui/goals.ts](file:///home/dev/projects/city-builder/src/ui/goals.ts): Objetivos de desarrollo urbano y ventana modal de celebración de hitos con recompensas.
   - [src/ui/ui.ts](file:///home/dev/projects/city-builder/src/ui/ui.ts): Pestañas de subcategorías en la paleta inferior, modos de carretera (Recta, Curva, S-Bend, Grilla), medidores de demanda (R/C/I/O) e indicadores de felicidad ciudadana.

