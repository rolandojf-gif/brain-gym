# BRAIN.GYM

Web personal de un solo usuario para sostener un entrenamiento cognitivo ágil, diario y de baja fricción centrado en **Teoría de Juegos, Diseño de Incentivos, Paradojas de Decisión y Modelos Mentales**, apoyado en **Extracción Quirúrgica de Lecturas (3x1)** y **Repetición Espaciada (FSRS)**. El brief completo está en `docs/brief.md`; las decisiones, en `docs/decisiones.md`; la arquitectura y el modelo de datos, en `docs/arquitectura.md`. Léelos antes de cambiar algo de fondo.

## Principios (no negociables)

1. La herramienta sirve a la rutina (Sprint Diario de 10 min). Recorrido mínimo: abrir → ver el sprint de hoy → ejecutarlo → cerrar. Si algo añade fricción, sobra.
2. Sin gamificación: ni puntos, ni insignias, ni rachas como premio, ni notificaciones insistentes. La continuidad se muestra como dato. Sólo métricas que midan algo real.
3. Primero piensa el usuario, luego la resolución. En el ring de retos el usuario compromete su jugada antes de desbloquear la pista o ver el equilibrio/trampa.
4. No almacenar contenido externo innecesario: en lecturas sólo se guarda URL, metadatos y la extracción 3x1 propia.
5. Simplicidad: un usuario, cada dependencia justificada por una necesidad concreta.
6. Los datos son del usuario: exportación e importación completas siempre funcionando y retrocompatibles.
7. Interfaz en español impecable, directo y sin paja.

## Navegación (6 pestañas)

- `01 Hoy` (`#hoy`): Sprint Diario (10 min) en 3 bloques (1º Calentamiento FSRS, 2º Reto del Día o Lectura 3x1, 3º Cierre rápido de modelo mental).
- `02 Retos` (`#estudio`): Ring de sparring interactivo con el catálogo integrado de 16 retos en 4 bloques temáticos y acordeón de 3 pasos.
- `03 Lectura` (`#lectura`): Extracción Quirúrgica 3x1 (Tesis central, Mecanismo/Incentivo, Punto ciego/Objeción; máx. ~40 palabras por campo).
- `04 Repaso` (`#repaso`): Mazo FSRS (`ts-fsrs`) alimentado desde los retos fallados, lecturas y aprendizajes diarios.
- `05 Progreso` (`#progreso`): Continuidad real (12 semanas), tasa de resolución de retos por bloque (`sin_ayuda`, `con_pista`, `solucion`), madurez FSRS y síntesis 3x1.
- `06 Datos` (`#datos`): Sincronización entre dispositivos, exportación/importación JSON y plan semanal.

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
- Lógica de dominio con tests obligatorios: FSRS, catálogo de retos, estudio, sesión del día, migraciones, fusión de sincronización.
- Nombres de dominio en español (`sesionDeHoy`, `intentos`, `CATALOGO_RETOS`); el código de librerías externas, como venga.
- Modelo de datos versionado: se conserva el almacén `predicciones` por retrocompatibilidad con exportaciones y sincronizaciones existentes aunque el módulo de calibración no esté en la interfaz activa.
- Fechas en ISO 8601. El «día» de la rutina es el día lógico de `src/lib/dia.ts` (corte a las 04:00).
- Comentarios en español, breves, que expliquen el porqué.

## Git

- Una rama por funcionalidad (`feat/…`, `fix/…`, `chore/…`), commits pequeños, PR contra `main`. Nunca push directo a `main`.
- `npm run verify` en verde antes de abrir la PR. Codex revisa las PR automáticamente.
- El usuario trabaja en un Mac con zsh.

## Al trabajar con el usuario

Explicar brevemente las decisiones técnicas relevantes: quiere entender lo que se construye, no sólo tenerlo.
