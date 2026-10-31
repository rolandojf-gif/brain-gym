# BRAIN.GYM

Web personal de un solo usuario para aprender por curiosidad sobre **Teoría de Juegos, Incentivos Perversos, Paradojas de Decisión y Sesgos/Modelos Mentales** (y, con los retos de IA, la carrera por la AGI y la psicología), apoyada en **Extracción Quirúrgica de Lecturas (3x1)** y **Repetición Espaciada (FSRS)**. No es una rutina que cumplir: lo que atrae está en el contenido. El brief completo está en `docs/brief.md`; las decisiones, en `docs/decisiones.md`; la arquitectura y el modelo de datos, en `docs/arquitectura.md`. Léelos antes de cambiar algo de fondo.

## Principios (no negociables)

1. La herramienta sirve a la curiosidad, no a una rutina. Recorrido mínimo: abrir → elegir algo → hacerlo → cerrar. Nada se marca como pendiente ni como deber. Si algo añade fricción, sobra.
2. Sin gamificación: ni puntos, ni insignias, ni rachas, ni calendarios de continuidad, ni notificaciones insistentes. Sólo métricas que midan algo real (retención FSRS, calibración).
3. Primero piensa el usuario, luego la resolución. En el ring de retos escribe (si quiere) qué haría antes de ver las opciones y compromete su jugada y su confianza antes de desbloquear la pista o ver el equilibrio/trampa.
4. No almacenar contenido externo innecesario: en lecturas sólo se guarda URL, metadatos y la extracción 3x1 propia.
5. Simplicidad: un usuario, cada dependencia justificada por una necesidad concreta.
6. Los datos son del usuario: exportación e importación completas siempre funcionando y retrocompatibles.
7. Interfaz en español impecable, directo y sin paja.

## Navegación (6 pestañas)

- `01 Hoy` (`#hoy`): menú de tres tarjetas (un reto con tema rotativo y selector, una lectura, una idea convertible en tarjeta) y una línea discreta si hay tarjetas vencidas.
- `02 Retos` (`#estudio`): Ring de sparring con el catálogo integrado de 32 retos en 4 bloques temáticos y acordeón de 3 pasos. El estado lo deduce la app; los retos de debate no cuentan en las estadísticas.
- `03 Lectura` (`#lectura`): Extracción Quirúrgica 3x1 (Tesis central, Mecanismo/Incentivo, Punto ciego/Objeción; máx. ~40 palabras por campo).
- `04 Repaso` (`#repaso`): Mazo FSRS (`ts-fsrs`) alimentado desde los retos fallados, lecturas y aprendizajes diarios.
- `05 Progreso` (`#progreso`): retos jugados por tema, tarjetas aprendidas y retención, lecturas e ideas, y calibración en retos (Brier, sesgo y margen de ruido). Sin calendario ni tasas de acierto.
- `06 Datos` (`#datos`): Sincronización entre dispositivos, exportación/importación JSON y hora de corte del día.

## Stack

- TypeScript estricto + Vite + Vitest, **sin framework**. Vistas como funciones que devuelven HTML; todo dato del usuario pasa por `esc()` (`src/lib/html.ts`).
- Estilo visual de MOLOCH.SH: tokens en `src/styles/base.css`, tema claro/oscuro/auto. No introducir otra estética.
- Persistencia local en IndexedDB (`idb`), sincronización Mac ↔ móvil con una función de Netlify y Netlify Blobs, protegida con token (`BG_TOKEN`).
- FSRS con `ts-fsrs`. PWA con service worker propio.
- Despliegue en Netlify (`netlify.toml`).

## Comandos

```sh
npm install
npm run dev        # servidor de desarrollo
npm run verify     # lint + typecheck + tests + build; debe pasar antes de cada PR
npm run test:watch # tests en modo vigilancia
```

Variable de entorno en Netlify: `BG_TOKEN` (mínimo 32 caracteres; generar con `openssl rand -base64 32`). Cada dispositivo la introduce una vez en la pestaña Datos.

## Convenciones

- Capas: `src/dominio` (puro, con tests) ← `src/datos` (IndexedDB, exportación, sincronización) ← `src/vistas`. El dominio no importa nada del DOM ni de IndexedDB.
- Funciones de Netlify en `netlify/functions/*.mts`; sus tests en `netlify/*.test.ts`, **nunca** dentro de `netlify/functions` (Netlify publicaría cualquier archivo de esa carpeta como función). La lógica va en `src/dominio` para probarla sin Netlify.
- Tests de IndexedDB con `fake-indexeddb`.
- PWA: `public/manifest.webmanifest` y `public/sw.js` (escrito a mano, sin dependencias). Si cambia la lista de archivos base o la estrategia del service worker, subir `CACHE` (`bg-vN`). El service worker sólo se registra en producción.
- Lógica de dominio con tests obligatorios: FSRS, catálogo de retos (incluida la rotación de temas), estudio, calibración, migraciones, fusión de sincronización.
- Nombres de dominio en español (`temaSiguiente`, `intentos`, `CATALOGO_RETOS`); el código de librerías externas, como venga.
- Modelo de datos versionado: se conservan el almacén `predicciones`, la colección `sesiones` y `ajustes.planSemanal` por retrocompatibilidad con exportaciones y sincronizaciones existentes aunque ya no estén en la interfaz. Un campo opcional nuevo no sube el esquema; un cambio incompatible o una colección nueva, sí (ver `docs/arquitectura.md`).
- Fechas en ISO 8601. El «día» de la rutina es el día lógico de `src/lib/dia.ts` (corte a las 04:00).
- Comentarios en español, breves, que expliquen el porqué.

## Git

- Una rama por funcionalidad (`feat/…`, `fix/…`, `chore/…`), commits pequeños, PR contra `main`. Nunca push directo a `main`.
- `npm run verify` en verde antes de abrir la PR. Codex revisa las PR automáticamente.
- El usuario trabaja en un Mac con zsh.

## Al trabajar con el usuario

Explicar brevemente las decisiones técnicas relevantes: quiere entender lo que se construye, no sólo tenerlo.
