<contexto>
Web personal, de un solo usuario, para sostener un entrenamiento cognitivo ágil, adictivo y de baja fricción (Sprints diarios de 10 minutos) centrado exclusivamente en modelos de decisión de alta transferencia:
1. Teoría de Juegos y Dilemas Estratégicos (Dilema del prisionero con horizonte finito, Nivel-K / Concurso de Keynes, Subasta del dólar de Shubik, Compromiso creíble de Schelling).
2. Diseño de Incentivos y Trampas de Sistemas (Efecto Cobra, Ley de Goodhart, Paradoja de Braess, Selección adversa / Mercado de los limones).
3. Paradojas Lógicas y de Decisión (Paradoja de Abilene, Paradoja de Jevons, Dilema del viajero de Basu, Paradoja de Newcomb).
4. Sesgos Cognitivos y Modelos Mentales (Sesgo de supervivencia de Wald, Falacia de costes hundidos, Valla de Chesterton / Segundo orden, Sesgo de resultado).

La rutina diaria («Sprint Diario de 10 min»):
- 1º Calentamiento (2–3 min): repaso espaciado FSRS de las tarjetas vencidas hoy.
- 2º Plato principal (5–7 min):
  - Lunes, miércoles y viernes: resolver 1 reto interactivo del Catálogo Integrado de Retos en 3 pasos (compromiso de jugada → pista opcional → choque con la realidad y creación de tarjeta FSRS en 1 clic si se cae en la trampa).
  - Martes y jueves: Lectura exigente con «Extracción Quirúrgica 3x1» sin mirar el texto (1. Tesis central, 2. Mecanismo/Incentivo, 3. Punto ciego/Objeción; máx. ~40 palabras por campo).
- 3º Cierre rápido (1 min): registrar en 1 línea el modelo mental o idea aprendida hoy, con opción de convertirla en tarjeta FSRS al vuelo.
</contexto>

<objetivo>
Una sola web autocontenida y sin fricción. Al abrirla ejecuto mi sprint de 10 minutos: repaso mis tarjetas vencidas, me enfrento a un dilema estratégico o comprimo una lectura en formato 3x1, cierro con el aprendizaje del día y veo mi continuidad y dominio real por bloque.
</objetivo>

<principios>
1. La herramienta sirve a la rutina, no al revés. Recorrido mínimo: abrir → ejecutar el sprint de 10 min → cerrar.
2. Sin gamificación: nada de puntos, insignias, rachas como premio ni notificaciones insistentes. La continuidad se muestra como dato (calendario de sesiones hechas). Solo métricas que midan algo real.
3. Compromiso previo a la solución: el usuario debe fijar su jugada antes de poder desbloquear la pista o ver la resolución del reto.
4. Baja fricción cognitiva al registrar: cierre de retos en 1 clic y síntesis de lecturas en formato 3x1 comprimido (máx. 40 palabras por campo).
5. Simplicidad arquitectónica: 3 capas puras (Dominio → Datos IndexedDB → Vistas HTML con `esc()`), cero frameworks adicionales.
6. Los datos son míos: exportación, importación y sincronización completas y retrocompatibles.
7. Interfaz y contenidos en español impecable, directo y sin paja.
</principios>

<modulos>
1. `01 Hoy` (`#hoy`). Panel de ejecución inmediata «Sprint Diario (10 min)» en 3 bloques: Calentamiento FSRS, Plato principal (Reto del Día o Lectura 3x1) y Cierre rápido de 1 línea con conversión directa a tarjeta FSRS.
2. `02 Retos` (`#estudio`). Ring de sparring interactivo con el Catálogo Integrado de 16 retos distribuidos en 4 bloques temáticos. Acordeón de 3 pasos: (1) Compromiso / Jugada inicial con cronómetro silencioso, (2) Andamiaje opcional con pista, (3) Choque con la realidad, modelo mental accionable y guardado en 1 clic (`sin_ayuda`, `con_pista`, `solucion` + tarjeta FSRS).
3. `03 Lectura` (`#lectura`). Cola de lecturas y modo «Extracción Quirúrgica 3x1» sin mirar el artículo: Tesis central, Mecanismo/Incentivo y Punto ciego/Objeción, con contador orientativo de 40 palabras por campo.
4. `04 Repaso` (`#repaso`). Tarjetas propias con algoritmo FSRS (`ts-fsrs`), creadas en 1 clic desde retos fallados, síntesis 3x1 o cierres diarios.
5. `05 Progreso` (`#progreso`). Continuidad real (calendario de 12 semanas), tasa de resolución de retos (`sin_ayuda` vs `con_pista` vs `solucion`), desglose por los 4 bloques temáticos, madurez del mazo FSRS y lecturas sintetizadas.
6. `06 Datos` (`#datos`). Sincronización entre dispositivos (`/api/sync` con Netlify Blobs), exportación/importación JSON completa y configuración del plan semanal.
</modulos>
