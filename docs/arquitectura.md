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
│   rotación de temas, migraciones     │ ─────▶ │   Netlify Blobs          │
│   ↓                                  │        │                          │
│ Almacén (src/datos/*): IndexedDB     │        │ /api/ia, /api/retos      │
│   cola de cambios para sincronizar   │        │   → OpenRouter           │
└──────────────────────────────────────┘        └──────────────────────────┘
```

Tres capas, en este orden de dependencia:

1. **Dominio** (`src/dominio`): funciones puras, sin DOM ni IndexedDB. Es lo que lleva tests: planificación FSRS, Brier y calibración, catálogo y rotación de retos, migraciones y fusión de sincronización.
2. **Datos** (`src/datos`): IndexedDB vía `idb`, exportar/importar, cola de cambios y cliente de sincronización.
3. **Vistas** (`src/vistas`): una por pestaña. Pintan con plantillas y `esc()`, escuchan eventos y llaman al dominio y a los datos.

## Modelo de datos v2

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
| `ajustes` | `planSemanal: Record<0..6, Actividad[]>`, `horaCorte` | Un solo registro. `Actividad = 'estudio' \| 'lectura' \| 'repaso' \| 'calibracion' \| 'concepto'`. `planSemanal` no se usa en la interfaz desde el 31 oct 2026 (Hoy es un menú); se conserva por compatibilidad. |
| `fuentes` | `titulo`, `tipo`, `url`, `capitulos: {id, titulo, ejercicios?: number}[]` | Catálogo integrado de retos (`catalogo-retos`, 4 bloques, 32 retos). El contenido de los retos vive en el código, no en los datos: una corrección llega a los dos dispositivos sin migrar nada. |
| `intentos` | `fuenteId`, `capitulo`, `ejercicio`, `estado`, `segundos`, `notaError`, `dia`, `tarjetaId?`, `confianza?` | `estado = 'sin_ayuda' \| 'con_pista' \| 'solucion' \| 'no_resuelto'`. Un ejercicio puede tener varios intentos. `confianza` (0,3 / 0,6 / 0,9) se declara al fijar la jugada en el primer intento de un reto con respuesta correcta; con el acierto inicial (estado `sin_ayuda`) da el Brier de Progreso. Campo opcional y aditivo: no sube el esquema. |
| `lecturas` | `url`, `titulo`, `medio`, `tema`, `estado`, `leidaEl?` | `estado = 'pendiente' \| 'leida' \| 'escrita' \| 'descartada'`. No se guarda el texto del artículo. |
| `escritos` | `lecturaId`, `resumen`, `objecion`, `palabras`, `enviadoEl` | Fase 2 añade `feedbackIa?` y `revision30?`. |
| `tarjetas` | `tipo`, `anverso`, `reverso`, `origen?: {coleccion, id}`, `fsrs` | `tipo = 'basica'` (Fase 2: `'numerica'` con valor y unidad). `fsrs` es el estado de `ts-fsrs` serializado (fechas en ISO). |
| `repasos` | `tarjetaId`, `nota`, `repasadoEl`, `estadoPrevio` | Registro inmutable de cada repaso (el `ReviewLog` de FSRS). Nunca se edita. |
| `predicciones` | `enunciado`, `probabilidad` (0–1), `venceEl`, `categoria`, `resolucion?: {resultado, resueltaEl}` | `resultado = 'si' \| 'no' \| 'anulada'`. Las anuladas no entran en el Brier. |
| `sesiones` | `dia`, `actividad`, `inicio`, `fin?`, `segundos` | Una por actividad hecha, con el tiempo dedicado. Ya no la muestra ninguna vista (salió el calendario), pero se sigue guardando y exportando. |
| `aprendizajes` | `dia`, `texto`, `fuenteUrl?`, `tarjetaId?` | «Qué aprendí hoy». |
| `retos` (v2) | `tema` (`'1'…'5'`), `titulo`, `escenario`, `opciones: {id, texto, porQue}[]`, `opcionCorrecta` (`null` en debates), `pista`, `solucion`, `modeloMental`, `fuente: {titulo, url}`, `modelo`, `revision`, `reporte?: {nota, el}` | Retos generados por IA. Se guardan enteros porque son contenido de la app, no externo. Sus intentos van a `intentos` con `ejercicio = id`. Si está «listo» (sin intentos) o jugado se deduce de los intentos, no se guarda. `reporte` es el «esto está mal». |

Lo que se calcula y no se guarda: Brier y calibración (de predicciones y de retos), progreso por capítulo y el tema que toca en la rotación de retos.

## Migraciones

- `ESQUEMA_VERSION` es un entero que empieza en 1. Va por la 2: la v2 añade la colección `retos` (31 oct 2026).
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
- **Dos versiones a la vez:** el dispositivo envía su `esquema` y el servidor sólo le devuelve las colecciones de esa versión (`coleccionesDeEsquema`); una app v1 no lo envía y no recibe `retos`, que en ella no tienen tienda en IndexedDB. Como su cursor sí avanza, al migrar a un esquema nuevo el dispositivo pone el cursor a 0 y vuelve a pedirlo todo (la fusión es idempotente).
- **Almacén:** Netlify Blobs, un único blob `estado` en la tienda `brain-gym` con consistencia fuerte. Para que dos sincronizaciones simultáneas no se pisen, la escritura es condicional: `setJSON(clave, datos, { onlyIfMatch: etag })` (o `onlyIfNew` la primera vez), disponible en `@netlify/blobs` 11 (comprobado en sus tipos, oct 2026). Si devuelve `modified: false`, se vuelve a leer, fusionar y escribir (hasta 5 veces; después, 409).
- **Cliente:** `src/datos/sincronizar.ts` envía los pendientes, aplica lo recibido con la misma regla y sólo borra de pendientes lo que no se haya vuelto a editar durante el envío.
- **Cuándo:** al abrir la app, al volver a ella y tras cada sesión terminada, si hay conexión. Sin conexión, todo funciona y la cola espera.
- **Riesgo conocido:** si repasas la misma tarjeta en los dos dispositivos sin conexión, el estado FSRS de una de las dos se pierde (los dos registros de repaso se conservan). Es raro con un solo usuario; si pasa, se puede recalcular el estado desde los repasos con `ts-fsrs`.

## Hoy

Un menú, no una agenda: un reto, una lectura y una idea, más una línea discreta si hay tarjetas vencidas. El tema del reto lo da `temaSiguiente(intentos)` (`src/dominio/catalogo-retos.ts`): el bloque siguiente al del último reto jugado, en orden circular, saltando los que no tienen retos por estrenar. El selector de Hoy lo cambia hasta que se juega otro reto.

## Funciones de IA

Las dos funciones comparten `netlify/servidor.ts` (token, variables de entorno, llamada a OpenRouter y cupo) y la misma `OPENROUTER_API_KEY`.

- **`/api/ia`:** el Abogado del Diablo de las lecturas. Una llamada por petición.
- **`/api/retos`:** genera un reto sobre un tema (`{ tema, vistos }`). Un solo intento por petición, porque una función síncrona de Netlify tiene 60 s:
  1. **Generar** con `OPENROUTER_MODEL` (temperatura 0,8). El prompt pide cuatro opciones de longitud parecida, un «por qué» en cada una, una sola defendible (o `null` en un debate) y una fuente real con URL pública.
  2. **Validar** la forma (`validarRetoPropuesto`): letras A–D, sin opciones repetidas, la correcta no más de 1,3 veces más larga que el distractor más largo (para que no se delate) y URL `https` de un dominio con nombre.
  3. **Comprobar la fuente:** una petición GET de 6 s. Vale si responde por debajo de 400 o con 401/403/429 (existe, pero bloquea a robots); sólo se mira el código, no el contenido.
  4. **Revisar** con `OPENROUTER_MODEL_REVISOR` (por defecto, el mismo modelo; uno de otra familia detecta mejor los errores), temperatura 0. Si hay más de una opción defendible o la fuente no respalda la solución, se descarta.
  Un fallo en 2, 3 o 4 responde 422 con `motivo` (`formato`, `fuente`, `revisor`); la app vuelve a pedir más tarde, en segundo plano.
- **Cupo diario:** 40 llamadas a OpenRouter por día UTC entre las dos funciones (`MAX_LLAMADAS_IA_DIA`), en el blob `cupo-ia` con la misma escritura condicional que la sincronización. Un reto gasta una llamada si se descarta antes del revisor y dos si llega a él. Agotado, responde 429. Es un freno ante un bucle o un token filtrado; el límite de gasto real es el de la clave en OpenRouter.

## Móvil

- Diseño adaptable desde el principio; el repaso y «Hoy» se diseñan primero para el móvil.
- PWA: `manifest.webmanifest` y un service worker propio pequeño que guarda la app para funcionar sin conexión.

## Seguridad

- CSP estricta en `netlify.toml` (sin scripts en línea; el tema se aplica desde `public/theme-init.js`).
- Todo dato del usuario se escapa con `esc()` antes de pintarlo.
- El token de sincronización se guarda sólo en el dispositivo; nunca en el repositorio ni en la exportación JSON.
