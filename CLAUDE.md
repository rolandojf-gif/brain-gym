# BRAIN.GYM

Web personal de un solo usuario para sostener una rutina de entrenamiento cognitivo: estudio de probabilidad y estadística, lectura con escritura, repetición espaciada y calibración. El brief completo está en `docs/brief.md`; las decisiones, en `docs/decisiones.md`; la arquitectura y el modelo de datos, en `docs/arquitectura.md`. Léelos antes de cambiar algo de fondo.

## Principios (no negociables)

1. La herramienta sirve a la rutina. Recorrido mínimo: abrir → ver la sesión de hoy → hacerla → cerrar. Si algo añade fricción, sobra.
2. Sin gamificación: ni puntos, ni insignias, ni rachas como premio, ni notificaciones insistentes. La continuidad se muestra como dato. Sólo métricas que midan algo real.
3. Primero piensa el usuario, luego la IA. La IA nunca da resumen, solución ni respuesta antes del intento; su feedback llega después y como crítica, nunca como reescritura.
4. No reconstruir contenido existente: se enlaza y se registra. No se guarda el texto de los artículos; sólo URL, metadatos y notas propias.
5. Simplicidad: un usuario, cada dependencia justificada por una necesidad concreta.
6. Los datos son del usuario: exportación e importación completas siempre funcionando.
7. Interfaz en español.

Fuera de alcance: ejercicios generados por IA, multiusuario, mecánicas de juego. No se empieza una fase sin una semana de uso real de la anterior.

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
- Lógica de dominio con tests obligatorios: FSRS, Brier, calibración, sesión del día, migraciones, fusión de sincronización.
- Nombres de dominio en español (`sesionDeHoy`, `intentos`, `predicciones`); el código de librerías externas, como venga.
- Modelo de datos versionado: cualquier cambio de forma lleva una migración pura nueva con su test (ver `docs/arquitectura.md`). Nunca editar una migración ya publicada.
- Fechas en ISO 8601. El «día» de la rutina es el día lógico de `src/lib/dia.ts` (corte a las 04:00).
- Comentarios en español, breves, que expliquen el porqué.

## Git

- Una rama por funcionalidad (`feat/…`, `fix/…`, `chore/…`), commits pequeños, PR contra `main`. Nunca push directo a `main`.
- `npm run verify` en verde antes de abrir la PR. Codex revisa las PR automáticamente.
- El usuario trabaja en un Mac con zsh.

## Al trabajar con el usuario

Explicar brevemente las decisiones técnicas relevantes: quiere entender lo que se construye, no sólo tenerlo.
