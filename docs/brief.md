<contexto>
Vamos a construir una web personal, de un solo usuario (yo), para sostener una rutina de entrenamiento cognitivo basada en evidencia. No es una app de "brain training": esos juegos no transfieren a nada fuera de la propia tarea entrenada, y no quiero nada parecido.

La rutina que la web debe soportar:
- Lunes, miércoles y viernes, 45-60 min: estudio activo de probabilidad y estadística. Fuente inicial: Stat 110 de Harvard (Blitzstein y Hwang); alternativa: Think Bayes (Allen Downey). Resuelvo cada ejercicio antes de mirar la solución, sin IA durante el ejercicio.
- Martes y jueves, 45 min: lectura exigente (Aeon, Quanta Magazine, Stanford Encyclopedia of Philosophy, etc.). Al terminar, sin mirar el texto, escribo 200-300 palabras con el argumento central y la objeción más fuerte.
- Diario, 10 min: repetición espaciada de lo aprendido.
- Semanal, 20 min: calibración. Registro 3-5 predicciones con probabilidad y puntúo las ya vencidas (Brier).
- Aprender algo nuevo cada día.
- Evaluación a las 12 semanas con tres métricas: porcentaje de ejercicios resueltos sin ayuda, evolución del Brier, y capacidad de explicar por escrito, sin consultar, lo leído hace un mes.
</contexto>

<objetivo>
Una sola web que sustituya la dispersión entre varias herramientas (registro de Stat 110, Anki, Fatebook, notas sueltas). Al abrirla debo saber qué toca hoy, hacerlo, dejarlo registrado y ver mi progreso y continuidad. Si la herramienta añade fricción a la rutina, ha fracasado.
</objetivo>

<principios>
1. La herramienta sirve a la rutina, no al revés. Recorrido mínimo: abrir → ver la sesión de hoy → hacerla → cerrar.
2. Sin gamificación: nada de puntos, insignias, rachas como premio ni notificaciones insistentes. La continuidad se muestra como dato (calendario de sesiones hechas), no como recompensa. Solo se muestran métricas que midan algo real.
3. Primero pienso yo, luego la IA. La IA nunca genera un resumen, una solución ni una respuesta antes de que yo lo intente. Su feedback llega solo después de que envío mi texto o respuesta, y como crítica (fidelidad al original, calidad del argumento, objeciones no consideradas), nunca como reescritura.
4. No reconstruir contenido que ya existe bien hecho. No copiar Stat 110 ni artículos: se enlaza y se registra. No almacenar el texto completo de los artículos; solo URL, metadatos y mis notas.
5. Simplicidad arquitectónica. Un usuario, sin backend si no hace falta. Cada dependencia debe justificarse por una necesidad concreta.
6. Los datos son míos: exportación e importación completas desde el primer día.
7. Interfaz en español.
</principios>

<modulos>
1. Hoy. Muestra la sesión del día según una planificación semanal configurable (no fija en el código), más lo pendiente: repasos vencidos y predicciones por resolver. Temporizador opcional.
2. Estudio. Registro por fuente, capítulo y ejercicio, con estado (sin ayuda / con pista / mirando la solución / no resuelto), tiempo y una nota breve sobre el error. Desde un ejercicio fallado se puede crear una tarjeta de repaso. Progreso por capítulo.
3. Lectura y escritura. Cola de lecturas (URL, título, fuente, tema). Tras leer, un editor para el resumen sin mirar (el artículo no es accesible en ese paso), la objeción más fuerte y un contador de palabras. Feedback de IA opcional, solo después de enviar. Revisión a 30 días: la app me pide reexplicar una lectura de hace un mes sin mirar y luego me muestra mi resumen original para comparar.
4. Repetición espaciada. Tarjetas propias con algoritmo FSRS (valora ts-fsrs u otra implementación sólida), creación rápida desde cualquier módulo. Tarjetas numéricas con modo calibración: pide un intervalo de confianza a un nivel aleatorio entre el 50 % y el 95 % y lleva la puntuación de calibración.
5. Calibración. Predicciones con enunciado, probabilidad, fecha de resolución y categoría. Resolución, Brier y curva de calibración por tramos.
6. Concepto del día. Una cosa nueva cada día (ver decisión abierta sobre su fuente).
7. Progreso. Las tres métricas de evaluación, el calendario de continuidad y una vista de revisión a 12 semanas.
8. Exportación. JSON completo (exportar e importar) y Markdown compatible con Obsidian para las entradas de lectura y escritura.
</modulos>

<decisiones_abiertas>
Plantéame estas decisiones antes de escribir código, con tu recomendación razonada. Pregunta también por cualquier otra ambigüedad que detectes; no asumas nada en silencio.
1. Persistencia y dispositivos: ¿solo en el Mac (local-first, por ejemplo IndexedDB más exportación) o también en el móvil con sincronización? Si hace falta sincronizar, propón la opción más simple para un solo usuario.
2. Despliegue y acceso: si se despliega en Netlify con datos personales o con una función de IA, el acceso debe estar protegido. Propón el mecanismo más simple que sea realmente seguro.
3. Feedback de IA: vía OpenRouter (ya lo uso), con una función serverless que no exponga la clave, invocable solo por mí y con un límite de gasto. Modelo configurable.
4. Fuente del concepto del día: lista curada por mí, derivada de la cola de lecturas, o generada por IA. Si es generada, debe llevar una fuente verificable, porque una IA puede introducir errores.
5. Frontend: lo discutimos aquí. Referencia: mis otros proyectos usan TypeScript, Vite y Vitest sin framework, con despliegue en Netlify y `npm run verify`. Si propones un framework, justifica qué aporta para esta app en concreto.
</decisiones_abiertas>

<fases>
Fase 1, el mínimo usable en la rutina real (objetivo: usarla desde la primera semana): Hoy, registro de estudio, lectura y escritura sin IA, repetición espaciada básica, calibración y exportación JSON.
Fase 2: feedback de IA, revisión a 30 días, tarjetas de calibración, panel de progreso completo y exportación Markdown.
Fase 3: solo lo que el uso real demuestre necesario.
Regla: no se empieza una fase sin que yo haya usado la anterior en mi rutina durante al menos una semana.
Fuera de alcance por ahora: ejercicios generados por IA, multiusuario y cualquier mecánica de juego.
</fases>

<forma_de_trabajo>
- Trabajo en un Mac con zsh.
- Primer paso: guarda este brief como docs/brief.md y crea un CLAUDE.md con los principios, el stack que decidamos, los comandos y las convenciones, para que se mantengan entre sesiones.
- Antes de programar, propón la arquitectura y el modelo de datos. El modelo de datos va versionado con migraciones desde el principio, para no perder datos cuando evolucione.
- Git: una rama por funcionalidad, commits pequeños y PR contra main; nunca push directo a main. Codex revisa mis PR automáticamente.
- `npm run verify` (lint, typecheck, tests y build) debe pasar antes de cada PR. La lógica de dominio lleva tests: planificación FSRS, Brier, calibración y generación de la sesión del día.
- Explícame brevemente las decisiones técnicas relevantes: quiero entender lo que construimos, no solo tenerlo.
</forma_de_trabajo>
