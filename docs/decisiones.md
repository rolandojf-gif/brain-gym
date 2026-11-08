# Decisiones

Registro de las decisiones abiertas del brief (`docs/brief.md`). Cada una dice qué se decidió, por qué y qué queda pendiente.

## D1. Persistencia y dispositivos · decidida (24 oct 2026)

**Mac y móvil, con sincronización, desde la Fase 1.** Los repasos diarios se harán en el móvil.

- Cada dispositivo guarda todo en IndexedDB y funciona sin conexión (local-first). La app es instalable en el móvil (PWA: manifiesto + service worker propio, sin dependencia).
- La sincronización es una función de Netlify que guarda los registros en Netlify Blobs. Sin base de datos ni cuentas de terceros.
- Detalle en `docs/arquitectura.md` («Sincronización»).

## D2. Despliegue y acceso · decidida (24 oct 2026)

Con datos personales en la nube (sincronización), las funciones deben estar protegidas.

- Token secreto largo (256 bits, `openssl rand -base64 32`) en la variable de entorno `BG_TOKEN` de Netlify. La app lo pide una vez por dispositivo y lo guarda en él; cada función lo exige en la cabecera `Authorization: Bearer …` y lo compara en tiempo constante. HTTPS lo pone Netlify.
- El sitio estático no contiene datos personales: sin token, sólo se ve una app vacía.
- Descartado: la protección por contraseña de Netlify (de pago y no protege mejor las funciones).

## D3. IA vía OpenRouter · decidida (31 oct 2026)

- Funciones de Netlify → OpenRouter, protegidas con el mismo token: `/api/ia` (Abogado del Diablo) y `/api/retos` (retos generados). Una sola `OPENROUTER_API_KEY`, dedicada a esta app y con límite de crédito propio en OpenRouter. `max_tokens` fijo en cada llamada.
- **Tope de 40 llamadas al día** entre las dos funciones, contado en Netlify Blobs. Frena un bucle o un token filtrado; el límite de gasto lo pone la clave. Los retos generados sólo pueden usar 30; las otras 10 quedan para el Abogado del Diablo (añadido el 2026-10-31, después de que los fallos de los retos agotaran el día).
- **Modelos por variable de entorno:** `OPENROUTER_MODEL` genera; `OPENROUTER_MODEL_REVISOR`, opcional, revisa los retos. Conviene que el revisor sea de otra familia que el generador, porque comparten menos puntos ciegos.
- **Cada reto generado pasa tres filtros** antes de llegar a la app: forma válida, fuente que responde y aprobación del revisor. Detalle en `docs/arquitectura.md`.
- **Gemini:** se puede usar un modelo Gemini a través de OpenRouter sin otra clave. Una API de Gemini directa sólo tendría sentido por su nivel gratuito, y en ese nivel Google puede usar el contenido para mejorar sus productos (según sus condiciones; comprobar la versión vigente antes de decidir). Con textos personales no lo recomiendo.

## D4. Concepto del día · propuesta

Fuera de la Fase 1 según el brief. Propuesta: en Fase 1, sólo registro propio («qué aprendí hoy»: una línea y una fuente), convertible en tarjeta. Lista curada o sugerencias derivadas de lecturas y ejercicios fallados, más adelante. IA, al final y siempre con fuente verificable.

## D5. Frontend · decidida (24 oct 2026)

- **TypeScript + Vite + Vitest, sin framework**, con el aspecto de MOLOCH.SH (neo-brutalismo industrial: mismos tokens de color, tipografías Space Grotesk, Inter y JetBrains Mono, pestañas numeradas, tema claro/oscuro/auto).
- Vistas como funciones que devuelven HTML con `esc()` para todo dato del usuario, igual que MOLOCH.SH, pero tipadas.
- Dependencias de ejecución previstas: `ts-fsrs` (FSRS) e `idb` (envoltorio de IndexedDB). En las funciones, `@netlify/blobs`. En pruebas, `fake-indexeddb`.

## Otras decisiones · decididas (24 oct 2026)

1. **Sin importadores externos en Fase 1.** Se empieza limpio en IndexedDB con exportación/importación JSON propia.
2. **Catálogo integrado de Retos:** 32 retos autocontenidos distribuidos en 4 bloques temáticos (Teoría de Juegos, Incentivos y Sistemas, Paradojas de Decisión y Sesgos/Modelos Mentales), mapeados sobre `fuentes` e `intentos`.
3. **Corte del día a las 04:00** hora local, configurable (`src/lib/dia.ts`).
4. **Las sesiones no hechas no se arrastran**; los repasos y las predicciones vencidas sí se acumulan.
5. **«Escribir sin mirar» es un compromiso del usuario**: la app oculta el enlace, no puede impedir abrir otra pestaña.

## D6. De rutina a curiosidad · decidida (31 oct 2026)

La versión del sprint diario se sentía como una obligación. El objetivo pasa de sostener una rutina a ser un sitio al que se vuelve por curiosidad. Plan completo en el Claude Doc «Plan Brain Gym: curiosidad».

- **Hoy es un menú, no una agenda:** un reto, una lectura y una idea; repaso como línea discreta. Fuera el plan semanal, el «Sprint diario» y el calendario de continuidad. `ajustes.planSemanal` y la colección `sesiones` se conservan en los datos por compatibilidad.
- **Confianza en cada reto:** sí. Niveles 30/60/90 % (con cuatro opciones el azar da un 25 %; un mínimo del 60 % forzaría a declarar exceso de confianza al dudar). Obligatoria sólo en el primer intento de un reto con respuesta correcta. Progreso calcula Brier, sesgo y margen de ruido.
- **Escribir antes de ver las opciones:** opcional. Sustituye al campo «¿Cuál es tu lógica?».
- **Tema del siguiente reto:** rota a partir del último jugado, saltando temas sin retos por estrenar, con un selector en Hoy para cambiarlo.
- **Retos generados por IA:** entran (Fase 2), con fuente verificada, revisor y botón «esto está mal». Temas nuevos: carrera por la AGI (tema 5, sólo generados) y psicología (el tema 4 pasa a «Psicología, Sesgos y Modelos Mentales»).
- **Mezcla de catálogo y generados:** alternar. En cada tema, uno del catálogo y uno generado mientras queden del catálogo; después, sólo generados.

## D7. Portada con vida · decidida (1 nov 2026)

Hoy se sentía «sosa, de Windows 95». Se vieron tres maquetas (misma estética con vida, rediseño oscuro moderno, un solo dilema a pantalla completa) y Rolando eligió la primera: se mantiene la estética de MOLOCH.SH.

- **Logo:** una matriz de pagos 2×2 (lima coopera, naranja traiciona) cuya jugada va rotando. Sustituye al `>_` en la cabecera, el favicon y los iconos de la app.
- **Animación con contenido:** una rejilla viva del dilema del prisionero espacial (Nowak y May, 1992), con la tentación ajustable y un botón para sembrar un traidor. Enseña algo (la cooperación sobrevive en grupos) en vez de decorar, y no puntúa nada.
- **Invitar a participar:** el reto va primero y grande, con su pregunta destacada y «¿Qué harías tú?» ya en la portada; lo escrito allí abre el reto con las opciones visibles.
- **Cabecera y franja alineadas con el contenido** en pantallas anchas (`main` pasa de 1080 a 1200 px), para que el logo no quede perdido en una esquina.

## D8. Secuencias, un juego de atención · propuesta (8 nov 2026)

Rolando pidió una tarea tipo RVP (Rapid Visual Information Processing, Cambridge): dígitos del 2 al 9 a 100 por minuto, tres secuencias objetivo (2-4-6, 3-5-7, 4-6-8), respuesta con la barra espaciadora y ritmo adaptativo. Es un juego propio, sin nombre, arte ni aspecto de otras apps.

- **Dónde:** dirección propia (`#secuencias`) con un enlace discreto en Hoy, sin pestaña: una opción del menú, no un deber.
- **Fallo:** cuentan el falso positivo y la omisión (si no, no pulsar nunca saldría gratis).
- **Ritmo:** empieza en 600 ms; cada 5 aciertos seguidos −50 ms; cada fallo +50 ms; entre 350 y 900 ms.
- **Ventana de respuesta:** 1,5 s desde el último dígito de la secuencia, porque una respuesta suele llegar con el dígito siguiente ya en pantalla.
- **Objetivos:** se insertan unos 8 por cada 100 dígitos (al azar saldrían menos de 2). Partidas de 2 minutos.
- **Datos:** no se guarda nada; al acabar, un resumen (aciertos, omisiones, falsas alarmas, reacción mediana, ritmo). Guardar un historial exigiría una colección nueva y subir el esquema.
- **Móvil:** botón táctil grande que responde al tocar (`pointerdown`), no al levantar el dedo.

