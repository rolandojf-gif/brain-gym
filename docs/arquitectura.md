# Arquitectura y modelo de datos

Aprobada el 24 oct 2026. Lo que cambie después se actualiza aquí.

## Visión general

```
Navegador (Mac o móvil, PWA)                         Netlify
┌──────────────────────────────────────┐        ┌──────────────────────────┐
│ Vistas (src/vistas/*)                │        │ Sitio estático (dist/)   │
│   ↓ llaman a                         │        │                          │
│ Dominio puro (src/dominio/*)         │        │ /api/sync  (función)     │
│   FSRS, Brier, calibración,          │  HTTPS │   token Bearer           │
│   sesión del día, migraciones        │ ─────▶ │   Netlify Blobs          │
│   ↓                                  │        │                          │
│ Almacén (src/datos/*): IndexedDB     │        │ /api/ia    (Fase 2)      │
│   cola de cambios para sincronizar   │        │   → OpenRouter           │
└──────────────────────────────────────┘        └──────────────────────────┘
```

Tres capas, en este orden de dependencia:

1. **Dominio** (`src/dominio`): funciones puras, sin DOM ni IndexedDB. Es lo que lleva tests: planificación FSRS, Brier, curva de calibración, generación de la sesión del día, migraciones y fusión de sincronización.
2. **Datos** (`src/datos`): IndexedDB vía `idb`, exportar/importar, cola de cambios y cliente de sincronización.
3. **Vistas** (`src/vistas`): una por pestaña. Pintan con plantillas y `esc()`, escuchan eventos y llaman al dominio y a los datos.

## Modelo de datos v1

Todas las colecciones comparten estos campos, que permiten sincronizar y migrar sin pérdidas:

| Campo | Tipo | Para qué |
| --- | --- | --- |
| `id` | `string` (UUID, `crypto.randomUUID()`) | Identidad estable entre dispositivos |
| `creado` | ISO 8601 | Auditoría |
| `actualizado` | ISO 8601 | Fusión «gana el último» al sincronizar |
| `borrado` | `boolean` | Borrado lógico: un borrado también se sincroniza |

Colecciones:

| Colección | Campos propios | Notas |
| --- | --- | --- |
| `ajustes` | `planSemanal: Record<0..6, Actividad[]>`, `horaCorte` | Un solo registro. `Actividad = 'estudio' \| 'lectura' \| 'repaso' \| 'calibracion' \| 'concepto'`. Plan por defecto: L-X-V retos (`estudio`), M-J lectura 3x1, repaso y modelo mental a diario. |
| `fuentes` | `titulo`, `tipo`, `url`, `capitulos: {id, titulo, ejercicios?: number}[]` | Catálogo integrado de retos (`catalogo-retos`, 4 bloques de 4 retos). |
| `intentos` | `fuenteId`, `capitulo`, `ejercicio`, `estado`, `segundos`, `notaError`, `dia`, `tarjetaId?`, `confianza?` | `estado = 'sin_ayuda' \| 'con_pista' \| 'solucion' \| 'no_resuelto'`. Un ejercicio puede tener varios intentos. `confianza` (0,3 / 0,6 / 0,9) se declara al fijar la jugada en el primer intento de un reto con respuesta correcta; con el acierto inicial (estado `sin_ayuda`) da el Brier de Progreso. Campo opcional y aditivo: no sube el esquema. |
| `lecturas` | `url`, `titulo`, `medio`, `tema`, `estado`, `leidaEl?` | `estado = 'pendiente' \| 'leida' \| 'escrita' \| 'descartada'`. No se guarda el texto del artículo. |
| `escritos` | `lecturaId`, `resumen`, `objecion`, `palabras`, `enviadoEl` | Fase 2 añade `feedbackIa?` y `revision30?`. |
| `tarjetas` | `tipo`, `anverso`, `reverso`, `origen?: {coleccion, id}`, `fsrs` | `tipo = 'basica'` (Fase 2: `'numerica'` con valor y unidad). `fsrs` es el estado de `ts-fsrs` serializado (fechas en ISO). |
| `repasos` | `tarjetaId`, `nota`, `repasadoEl`, `estadoPrevio` | Registro inmutable de cada repaso (el `ReviewLog` de FSRS). Nunca se edita. |
| `predicciones` | `enunciado`, `probabilidad` (0–1), `venceEl`, `categoria`, `resolucion?: {resultado, resueltaEl}` | `resultado = 'si' \| 'no' \| 'anulada'`. Las anuladas no entran en el Brier. |
| `sesiones` | `dia`, `actividad`, `inicio`, `fin?`, `segundos` | Una por actividad hecha. Alimenta el calendario de continuidad. |
| `aprendizajes` | `dia`, `texto`, `fuenteUrl?`, `tarjetaId?` | «Qué aprendí hoy». |

Lo que se calcula y no se guarda: Brier, curva de calibración, progreso por capítulo, calendario y la sesión del día.

## Migraciones

- `ESQUEMA_VERSION` es un entero que empieza en 1.
- Sube con cada cambio incompatible: quitar o renombrar un campo, cambiar su significado o añadir una colección. Un campo opcional nuevo no la sube: los registros sin él siguen siendo válidos y una app anterior lo conserva al sincronizar, porque guarda el registro entero.
- Una migración es una función pura `(datos v_n) → datos v_n+1` sobre la misma forma que la exportación JSON. Cada una lleva test con datos de ejemplo de la versión anterior.
- Se aplican en dos sitios con el mismo código: al abrir la base de datos (si la versión guardada es menor) y al importar un JSON antiguo. Así una exportación de hoy se podrá importar dentro de un año.
- Las migraciones de IndexedDB (`onupgradeneeded`) sólo crean o borran almacenes e índices; la transformación de datos la hacen las migraciones puras. Por eso no uso Dexie: su versionado sólo cubriría la mitad.
- Antes de migrar se guarda una copia automática (exportación JSON en IndexedDB) para poder volver atrás.

## Exportación e importación

```json
{ "app": "brain-gym", "esquema": 1, "exportadoEl": "2026-10-24T09:00:00Z",
  "datos": { "ajustes": [], "fuentes": [], "intentos": [], "...": [] } }
```

Importar ofrece dos modos: **sustituir** todo (con copia previa) o **fusionar** con la misma regla que la sincronización.

## Sincronización

Objetivo: lo más simple que sea correcto para un usuario con dos dispositivos.

- **Unidad:** el registro. Cada cambio local actualiza `actualizado` y se apunta en una cola de salida.
- **Regla de fusión:** gana el registro con `actualizado` mayor (empate exacto: un criterio determinista sobre el contenido, para que los dos dispositivos elijan igual). Los `repasos` son inmutables, así que nunca entran en conflicto: se unen.
- **Servidor:** `/api/sync` (`netlify/functions/sync.mts`) recibe `{ desde, cambios[] }` y aplica `aplicarCambios` (`src/dominio/sincronizacion.ts`). Cada registro guardado lleva el número de secuencia del servidor del momento en que cambió; la respuesta trae `{ seq, cambios[] }` con lo cambiado después de `desde`, más la versión ganadora de cualquier cambio enviado que haya perdido. `desde` es ese contador, no un reloj del dispositivo.
- **Almacén:** Netlify Blobs, un único blob `estado` en la tienda `brain-gym` con consistencia fuerte. Para que dos sincronizaciones simultáneas no se pisen, la escritura es condicional: `setJSON(clave, datos, { onlyIfMatch: etag })` (o `onlyIfNew` la primera vez), disponible en `@netlify/blobs` 11 (comprobado en sus tipos, oct 2026). Si devuelve `modified: false`, se vuelve a leer, fusionar y escribir (hasta 5 veces; después, 409).
- **Cliente:** `src/datos/sincronizar.ts` envía los pendientes, aplica lo recibido con la misma regla y sólo borra de pendientes lo que no se haya vuelto a editar durante el envío.
- **Cuándo:** al abrir la app, al volver a ella y tras cada sesión terminada, si hay conexión. Sin conexión, todo funciona y la cola espera.
- **Riesgo conocido:** si repasas la misma tarjeta en los dos dispositivos sin conexión, el estado FSRS de una de las dos se pierde (los dos registros de repaso se conservan). Es raro con un solo usuario; si pasa, se puede recalcular el estado desde los repasos con `ts-fsrs`.

## Sesión del día

`sesionDeHoy(ahora, ajustes, datos)` es pura y devuelve:

1. Las actividades del plan para el día de la semana del día lógico (corte a las 04:00 por defecto).
2. Lo pendiente: tarjetas vencidas, predicciones vencidas sin resolver y la calibración si hoy no toca pero no se ha hecho en los últimos 7 días.
3. Lo ya hecho hoy (sesiones registradas), para marcarlo.

Las sesiones no hechas de días anteriores no se arrastran.

## Móvil

- Diseño adaptable desde el principio; el repaso y «Hoy» se diseñan primero para el móvil.
- PWA: `manifest.webmanifest` y un service worker propio pequeño que guarda la app para funcionar sin conexión.

## Seguridad

- CSP estricta en `netlify.toml` (sin scripts en línea; el tema se aplica desde `public/theme-init.js`).
- Todo dato del usuario se escapa con `esc()` antes de pintarlo.
- El token de sincronización se guarda sólo en el dispositivo; nunca en el repositorio ni en la exportación JSON.
