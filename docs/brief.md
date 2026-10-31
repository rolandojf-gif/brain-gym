<contexto>
Web personal, de un solo usuario, para aprender por curiosidad sobre modelos de decisión de alta transferencia. No es una rutina que cumplir: es un sitio al que se vuelve porque apetece. Lo que atrae está en el contenido (retos con trampa, preguntas abiertas, lecturas exigentes y dudas propias), no en premios, rachas ni obligaciones.

Temas:
1. Teoría de juegos y dilemas estratégicos (dilema del prisionero con horizonte finito, nivel-K y concurso de Keynes, subasta del dólar de Shubik, compromiso creíble de Schelling).
2. Incentivos perversos y trampas de sistemas (efecto cobra, ley de Goodhart, paradoja de Braess, selección adversa y mercado de los limones).
3. Paradojas de decisión y lógica (paradoja de Abilene, paradoja de Jevons, dilema del viajero de Basu, paradoja de Newcomb).
4. Sesgos y modelos mentales (sesgo de supervivencia de Wald, falacia de costes hundidos, valla de Chesterton y efectos de segundo orden, sesgo de resultado).

Temas que entran con los retos generados por IA (Fase 2): la carrera por la AGI y la psicología.
</contexto>

<objetivo>
Al abrir la web veo un menú de tres cosas: un reto, una lectura y una idea (más adelante, una curiosidad mía). Elijo una, la hago y cierro. Si tengo tarjetas vencidas, una línea discreta me lo dice. Progreso me enseña lo que he aprendido y si acierto tanto como creo.
</objetivo>

<principios>
1. La herramienta sirve a la curiosidad, no a una rutina. Recorrido mínimo: abrir → elegir algo → hacerlo → cerrar.
2. Sin gamificación: nada de puntos, insignias, rachas, calendarios de continuidad ni notificaciones insistentes. Sólo métricas que midan algo real.
3. Primero piensas tú: en un reto escribes (si quieres) qué harías antes de ver las opciones, y fijas tu jugada y tu confianza antes de poder ver la pista o la resolución.
4. Baja fricción al registrar: cierre de retos en un clic y síntesis de lecturas en formato 3x1 comprimido (máx. ~40 palabras por campo).
5. Simplicidad arquitectónica: 3 capas (Dominio → Datos IndexedDB → Vistas HTML con `esc()`), sin frameworks.
6. Los datos son míos: exportación, importación y sincronización completas y retrocompatibles.
7. Interfaz y contenidos en español impecable, directo y sin paja.
</principios>

<modulos>
1. `01 Hoy` (`#hoy`). Menú de tres tarjetas: un reto (el tema rota; un selector permite cambiarlo), una lectura de la cola y una idea de una línea convertible en tarjeta de repaso. Si hay tarjetas vencidas, una línea discreta con cuántas son.
2. `02 Retos` (`#estudio`). Ring de sparring con cinco temas: el catálogo integrado de 32 retos en los cuatro primeros y retos generados por IA, con su fuente y un botón «esto está mal», en todos (la carrera por la AGI, sólo generados). En cada tema se alternan catálogo y generados. Cada reto: (1) qué harías, opcional y antes de ver las opciones; jugada y confianza (30/60/90 %); (2) pista opcional; (3) resolución, modelo mental y guardado en un clic. El estado (`sin_ayuda`, `con_pista`, `solucion`) lo deduce la app. Los problemas abiertos (Newcomb) son retos de debate y no cuentan en las estadísticas.
3. `03 Lectura` (`#lectura`). Cola de lecturas y «Extracción Quirúrgica 3x1» sin mirar el artículo: tesis central, mecanismo/incentivo y punto ciego/objeción, con el Abogado del Diablo de IA opcional.
4. `04 Repaso` (`#repaso`). Tarjetas propias con FSRS (`ts-fsrs`), creadas en un clic desde retos fallados, síntesis 3x1 o ideas.
5. `05 Progreso` (`#progreso`). Retos jugados por tema, tarjetas aprendidas y retención real, lecturas e ideas, y calibración en retos (Brier y sesgo de confianza).
6. `06 Datos` (`#datos`). Sincronización entre dispositivos (`/api/sync` con Netlify Blobs), exportación/importación JSON completa y hora de corte del día.
</modulos>

<fases>
Plan del 31 oct 2026 (detalle y decisiones en `docs/decisiones.md`, D6):
- Fase 0: arreglos de la revisión del giro. Hecha.
- Fase 1: Hoy como menú, fuera plan semanal, sprint y calendario; Progreso simplificado.
- Fase 2: retos generados por IA con fuente verificada, revisor y botón «esto está mal» (modelo de datos v2).
- Una semana de uso.
- Fase 3: curiosidades (hipótesis → exploración con IA → lo que me llevo → tarjeta).
</fases>
