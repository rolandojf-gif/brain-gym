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

## D3. Feedback de IA (Fase 2) · propuesta

- Función de Netlify → OpenRouter, protegida con el mismo token. Clave de OpenRouter dedicada a esta app con límite de crédito propio, `max_tokens` fijo y tope de llamadas diarias en la función. Modelo por variable de entorno.
- **Gemini:** se puede usar un modelo Gemini a través de OpenRouter sin otra clave. Una API de Gemini directa sólo tendría sentido por su nivel gratuito, y en ese nivel Google puede usar el contenido para mejorar sus productos (según sus condiciones; comprobar la versión vigente antes de decidir). Con textos personales no lo recomiendo. Se decide al empezar la Fase 2.

## D4. Concepto del día · propuesta

Fuera de la Fase 1 según el brief. Propuesta: en Fase 1, sólo registro propio («qué aprendí hoy»: una línea y una fuente), convertible en tarjeta. Lista curada o sugerencias derivadas de lecturas y ejercicios fallados, más adelante. IA, al final y siempre con fuente verificable.

## D5. Frontend · decidida (24 oct 2026)

- **TypeScript + Vite + Vitest, sin framework**, con el aspecto de MOLOCH.SH (neo-brutalismo industrial: mismos tokens de color, tipografías Space Grotesk, Inter y JetBrains Mono, pestañas numeradas, tema claro/oscuro/auto).
- Vistas como funciones que devuelven HTML con `esc()` para todo dato del usuario, igual que MOLOCH.SH, pero tipadas.
- Dependencias de ejecución previstas: `ts-fsrs` (FSRS) e `idb` (envoltorio de IndexedDB). En las funciones, `@netlify/blobs`. En pruebas, `fake-indexeddb`.

## Otras decisiones · decididas (24 oct 2026)

1. **Sin importadores externos en Fase 1.** Se empieza limpio en IndexedDB con exportación/importación JSON propia.
2. **Catálogo integrado de Retos:** 16 retos autocontenidos distribuidos en 4 bloques temáticos (Teoría de Juegos, Incentivos y Sistemas, Paradojas de Decisión y Sesgos/Modelos Mentales), mapeados sobre `fuentes` e `intentos`.
3. **Corte del día a las 04:00** hora local, configurable (`src/lib/dia.ts`).
4. **Las sesiones no hechas no se arrastran**; los repasos y las predicciones vencidas sí se acumulan.
5. **«Escribir sin mirar» es un compromiso del usuario**: la app oculta el enlace, no puede impedir abrir otra pestaña.
