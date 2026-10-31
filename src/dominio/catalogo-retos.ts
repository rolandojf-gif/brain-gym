/* Catálogo integrado de retos estratégicos, incentivos, paradojas y modelos mentales.
   Se mapea sobre las colecciones `fuentes` (1 fuente con 4 capítulos = bloques) e `intentos` (ejercicio = reto.id)
   para mantener intacto el esquema v1 de IndexedDB y la sincronización. */
import { ultimosIntentos } from './estudio';
import { nuevo } from './registro';
import type { EstadoIntento, Fuente, Intento } from './tipos';

export const ID_FUENTE_RETOS = 'catalogo-retos';

export interface OpcionReto {
  id: 'A' | 'B' | 'C' | 'D';
  texto: string;
}

export interface Reto {
  id: string;
  bloque: '1' | '2' | '3' | '4';
  titulo: string;
  /** Problema abierto (Newcomb…): se elige postura, no hay acierto ni fallo y no cuenta en las estadísticas. */
  debate?: boolean;
  escenario: string;
  opciones: readonly OpcionReto[];
  /** `null` sólo en los retos de debate. */
  opcionCorrecta: OpcionReto['id'] | null;
  pista: string;
  solucion: string;
  modeloMental: string;
}

export interface BloqueRetos {
  id: '1' | '2' | '3' | '4';
  titulo: string;
  descripcion: string;
}

export const BLOQUES_RETOS: readonly BloqueRetos[] = [
  {
    id: '1',
    titulo: 'Teoría de Juegos y Estrategia',
    descripcion: 'Dilemas estratégicos, equilibrios ocultos, nivel-K y asimetrías de compromiso.',
  },
  {
    id: '2',
    titulo: 'Incentivos Perversos y Sistemas',
    descripcion: 'Ley de Goodhart, efecto Cobra, cuellos de botella en redes y selección adversa.',
  },
  {
    id: '3',
    titulo: 'Paradojas de Decisión y Lógica',
    descripcion: 'Consensos falsos, rebotes de eficiencia, equilibrios extremos y precompromiso.',
  },
  {
    id: '4',
    titulo: 'Sesgos y Modelos Mentales',
    descripcion: 'Datos ausentes, costes hundidos, pensamiento de segundo orden y sesgo de resultado.',
  },
];

export const CATALOGO_RETOS: readonly [Reto, ...Reto[]] = [
  // ── BLOQUE 1: Teoría de Juegos y Estrategia ──────────────────────────────
  {
    id: '1.1',
    bloque: '1',
    titulo: 'El proveedor saliente (Dilema del Prisionero con horizonte finito)',
    escenario:
      'Llevas dos años colaborando con una agencia externa bajo un contrato que se renueva mes a mes: ambos cumplís plazos y compartís márgenes sin fricción. Hoy anuncias que dentro de exactamente 3 meses tu empresa internalizará el servicio y el contrato terminará de forma definitiva. Aún quedan tres entregas mensuales críticas. ¿Qué estrategia adoptas para proteger la calidad de estas tres últimas entregas?',
    opciones: [
      { id: 'A', texto: 'Confiar en la buena relación acumulada durante dos años y mantener las condiciones intactas.' },
      { id: 'B', texto: 'Ofrecer un bonus generoso en el mes 1 para reforzar la motivación y la lealtad del equipo externo hasta el final.' },
      { id: 'C', texto: 'Retener una parte del pago hasta auditar la última entrega, o dejar abierta una colaboración futura real.' },
      { id: 'D', texto: 'Amenazar con penalizaciones verbales si baja el ritmo en el primer mes.' },
    ],
    opcionCorrecta: 'C',
    pista: 'En un juego repetido, ¿qué sostiene realmente la cooperación hoy: el agradecimiento por el pasado o el valor de las rondas futuras? Piensa qué pasa en el mes 3 cuando ya no hay mañana.',
    solucion:
      'Al fijar una fecha exacta de finalización, eliminas la «sombra del futuro». Por inducción hacia atrás, en el mes 3 la agencia no pierde nada escatimando esfuerzo (su mejor jugada egoísta es desertar). Sabiendo que el mes 3 está perdido, el incentivo para cooperar en el mes 2 también se evapora, y lo mismo ocurre en el mes 1. La cooperación previa no era altruismo, sino un equilibrio sostenido por la repetición indefinida. Solo funciona alterar los pagos del último turno (retención contingente) o preservar incertidumbre sobre el final.',
    modeloMental:
      'La cooperación depende de la sombra del futuro, no de la gratitud pasada: nunca anuncies una fecha exacta de cierre sin atar los pagos del último turno.',
  },
  {
    id: '1.2',
    bloque: '1',
    titulo: 'El concurso de belleza de Keynes (Razonamiento de Nivel-K)',
    escenario:
      'Participas en una subasta estratégica con 100 directivos financieros. Cada uno debe escribir en secreto un número entero entre 0 y 100. Ganará el premio quien elija el número más cercano a los DOS TERCIOS (2/3) del promedio de todos los números entregados. Sabes que los participantes son analíticos, pero no todos piensan con la misma profundidad. ¿Qué número eliges para maximizar tu probabilidad de ganar?',
    opciones: [
      { id: 'A', texto: '67, porque es dos tercios del máximo posible (100).' },
      { id: 'B', texto: '33, asumiendo que la media del grupo estará cerca de 50.' },
      { id: 'C', texto: '0 o 1, porque es el único equilibrio de Nash cuando todos iteran el razonamiento hasta el final.' },
      { id: 'D', texto: 'Entre 18 y 22, anticipando que la mayoría hará solo 1 o 2 pasos de iteración mental.' },
    ],
    opcionCorrecta: 'D',
    pista: 'Diferencia entre el equilibrio teórico (donde todos son infinitamente racionales y saben que el resto también lo es) y el nivel real de iteración (Nivel-K) de un grupo humano.',
    solucion:
      'La trampa académica es responder 0 (el único equilibrio de Nash por eliminación iterada de estrategias dominadas: nadie debería pasar de 67, luego nadie debería pasar de 44, luego 29... hasta 0). Pero en experimentos reales con directivos y economistas, elegir 0 casi siempre pierde. Los jugadores de Nivel-0 eligen al azar (~50); los de Nivel-1 apuntan a 2/3 de 50 (~33); los de Nivel-2 apuntan a 2/3 de 33 (~22). En la práctica, el número ganador suele situarse entre 18 y 22. En estrategia real no ganas siendo el más listo en abstracto, sino situándote exactamente UN paso por delante del promedio del grupo.',
    modeloMental:
      'Regla de Nivel-K: en mercados y juegos sociales no apuestes al equilibrio de racionalidad infinita; estima cuántos pasos piensa la media y sitúate solo un nivel por delante (K+1).',
  },
  {
    id: '1.3',
    bloque: '1',
    titulo: 'La subasta del dólar de Shubik (Trampa de escalada)',
    escenario:
      'Un inversor subasta un billete de 100 € con una regla peculiar: el postor más alto se lleva los 100 €, pero TANTO el ganador como el segundo postor más alto deben pagar su propia puja al subastador. Empiezas pujando 5 € por diversión y otro participante sube a 10 €. Cuando la puja llega a 95 € (tú estás en 90 € y él en 95 €), te toca decidir tu siguiente movimiento. ¿Cuál es la trampa y cuál era la única jugada ganadora?',
    opciones: [
      { id: 'A', texto: 'Pujar 100 € para empatar en cero y evitar perder los 90 € ya comprometidos.' },
      { id: 'B', texto: 'Pujar 105 € para que el rival vea que vas en serio y abandone antes de seguir subiendo.' },
      { id: 'C', texto: 'No entrar nunca, o retirarte ya y asumir los 90 €: cada nueva puja sólo alarga la escalada.' },
      { id: 'D', texto: 'Pujar de 50 € en 50 € desde el principio para ganar rápido.' },
    ],
    opcionCorrecta: 'C',
    pista: 'Fíjate en qué cambia cuando estás en 90 € frente a 95 €: si te retiras pierdes 90 € seguros; si pujas 96 € y ganas, ganas 4 €. ¿Qué pasa cuando estás en 99 € frente a 100 €?',
    solucion:
      'La subasta de Shubik está diseñada para secuestrar el cálculo marginal. Al principio pujas por codicia (ganar 100 € baratos); a mitad de camino pujas por aversión a la pérdida (en 90 € vs 95 €, subir a 96 € parece racional porque pasar de perder 90 € a ganar 4 € mejora tu resultado en 94 €). En 99 € vs 100 €, pujar 101 € significa perder 1 € en vez de perder 99 €. Así ambos jugadores terminan pagando 200 € o 300 € por un billete de 100 €. Ante juegos donde el segundo paga sin llevarse nada (guerras de precios, litigios destructivos), la única jugada ganadora es negarse a hacer la primera puja o pactar una coalición antes de empezar.',
    modeloMental:
      'Identifica los juegos tipo «subasta del dólar» (donde retirarse cuesta todo lo invertido) antes de hacer la primera jugada: la única victoria es no entrar.',
  },
  {
    id: '1.4',
    bloque: '1',
    titulo: 'Quemar las naves (El valor estratégico de recortar tus opciones)',
    escenario:
      'Negocias la compra de una patente clave. El vendedor sabe que tu empresa puede pagar hasta 500.000 €, pero tú quieres cerrarla en 300.000 €. Si simplemente dices «mi última oferta es 300.000 €», el vendedor sabe que cuando te presione en el último minuto tendrás margen y motivación para subir a 450.000 €. ¿Cómo conviertes tu límite de 300.000 € en una amenaza creíble?',
    opciones: [
      { id: 'A', texto: 'Asegurar verbalmente con firmeza que no subirás ni un euro bajo ningún concepto.' },
      { id: 'B', texto: 'Mantener el máximo de flexibilidad interna para decidir en el último minuto según cómo vaya evolucionando la reunión.' },
      { id: 'C', texto: 'Atarte las manos: que el consejo apruebe un techo irrevocable de 300.000 € y comunicárselo por escrito al vendedor.' },
      { id: 'D', texto: 'Empezar ofreciendo 100.000 € para anclar la negociación más abajo.' },
    ],
    opcionCorrecta: 'C',
    pista: 'Tener más opciones suele parecer mejor, pero en una negociación, si tienes la opción de ceder, tu rival sabe que puede forzarte a usarla. ¿Cómo eliminas tu capacidad de ceder?',
    solucion:
      'Es la Paradoja de Schelling: en situaciones de conflicto o negociación, tener más libertad de acción te debilita si el oponente sabe que cederás para evitar un desastre. Una promesa verbal («no subiré de 300.000 €») es «cheap talk» (hablar sale gratis) porque cuando llegue el momento de la verdad tu interés será pagar 450.000 € antes que perder la patente. Al eliminar de forma verificable e irreversible tu propia opción de subir (quemar las naves), trasladas toda la presión de la decisión al vendedor: ahora él sabe que entre 300.000 € y 0 €, la decisión es solo suya.',
    modeloMental:
      'Paradoja de Schelling: en una negociación, reducir de forma visible e irreversible tu propia libertad de ceder obliga al adversario a adaptarse a tu posición.',
  },
  {
    id: 'tg-chantajista-schelling',
    bloque: '1',
    titulo: 'Cuando el otro ya ha quemado las naves (juego de la gallina)',
    escenario:
      'Dos empresas compiten por un estándar tecnológico. Si ambas ceden y pactan una interfaz común, ganan 5M€ cada una. Si una impone su sistema y la otra cede, la dominante gana 9M€ y la que cede gana 2M€. Si ninguna cede, el mercado se fragmenta y ambas pierden 3M€. Antes de sentarte a negociar, tu rival publica el código en abierto, firma contratos con penalizaciones millonarias si cambia una sola línea de su arquitectura y despide al equipo encargado de hacer adaptaciones. Te llama y te dice: "Adopta mi sistema o nos hundimos los dos". ¿Cuál es el análisis estratégico real de tu situación?',
    opciones: [
      { id: 'A', texto: 'Mantenerte firme y amenazar con fragmentar el mercado; cuando vea que va a perder 3M€, dará marcha atrás.' },
      { id: 'B', texto: 'Hacer exactamente lo mismo que él (destruir tu capacidad de adaptación) para forzar un empate técnico y obligarle a renegociar.' },
      { id: 'C', texto: 'Ceder y aceptar los 2M€; al destruir públicamente su propia libertad de elección, te ha transferido a ti toda la responsabilidad del desastre.' },
    ],
    opcionCorrecta: 'C',
    pista: 'En teoría de juegos, ¿tener más opciones y flexibilidad en una mesa de negociación te hace más fuerte o más débil frente a alguien que ya no puede girar el volante?',
    solucion:
      'Es la Conjetura de Schelling ("La paradoja del poder"). Al atarse las manos de forma irreversible y verificable antes de negociar, tu rival ha eliminado su opción de ceder. Ahora tú ya no estás jugando contra un oponente que decide; estás jugando contra la naturaleza entre dos únicas salidas: ganar 2M€ (cediendo) o perder 3M€ (chocando). Reducir tus propias opciones de forma pública y creíble obliga al actor racional que aún conserva el volante a apartarse.',
    modeloMental:
      'Compromiso de Schelling: En un juego de gallina, gana quien arranca el volante y lo tira por la ventanilla a la vista del otro. Tener menos opciones da ventaja si es irreversible y visible.',
  },
  {
    id: 'tg-maldicion-ganador',
    bloque: '1',
    titulo: 'La subasta del pozo ciego',
    escenario:
      'Cinco consorcios pujan a sobre cerrado por los derechos de explotación de un yacimiento de litio cuyo valor real es desconocido pero idéntico para todos. Tus ingenieros hacen un estudio riguroso e imparcial (sin sesgo al alza ni a la baja) y estiman que el yacimiento vale 40M€. Los otros cuatro competidores tienen equipos igual de buenos pero independientes; sus estimaciones oscilan por azar normal en torno al valor real. Si quieres maximizar tu beneficio esperado y no perder dinero, ¿qué debes pujar?',
    opciones: [
      { id: 'A', texto: 'Pujar 38M€ (justo por debajo de tu estimación de 40M€ para asegurarte un margen neto de 2M€ si ganas).' },
      { id: 'B', texto: 'Pujar bastante por debajo de tu estimación (28-30M€), aunque tu estudio sea imparcial.' },
      { id: 'C', texto: 'Pujar 41M€ si confías en que tu operativa es un 5% más eficiente que la media del sector.' },
    ],
    opcionCorrecta: 'B',
    pista: 'Si los 5 equipos estiman sin sesgo de media (unos se quedan cortos y otros se pasan), ¿quién se lleva el gato al agua en una subasta al mejor postor?',
    solucion:
      'Es la Maldición del Ganador. Aunque cada estimación individual sea insesgada en promedio, el mecanismo de la subasta selecciona como ganador no al que mejor calculó, sino al que cometió el mayor error de sobreestimación. Si ganas la subasta habiendo pujado cerca de tus 40M€, la mera noticia de que has ganado te informa de que los otros cuatro consorcios vieron menos valor que tú; por tanto, el valor real casi seguro es muy inferior a 40M€. Para no arruinarte, debes descontar el sesgo de selección de ganar antes de abrir el sobre.',
    modeloMental:
      'Maldición del Ganador: En una subasta donde el activo vale lo mismo para todos pero hay incertidumbre, ganar pujando tu estimación media garantiza que has pagado de más.',
  },
  {
    id: 'tg-dilema-samaritano',
    bloque: '1',
    titulo: 'El rescate que fabrica náufragos',
    escenario:
      'Diriges un fondo matriz con tres filiales autónomas. Una filial asume un proyecto arriesgado sin cubrir divisas porque ahorra un 4% en costes a corto plazo, sabiendo que tú detestas que una filial del grupo entre en impago público por el daño reputacional a la marca. El mercado gira y la filial tiene un agujero de 10M€. Te piden un rescate interno puntual prometiendo firmar un protocolo estricto para no volver a especular jamás. ¿Qué decisión es estratégicamente óptima a largo plazo?',
    opciones: [
      { id: 'A', texto: 'Rescatarles esta única vez para salvar la reputación del grupo, pero despedir al director financiero y auditarles mensualmente.' },
      { id: 'B', texto: 'Negar el rescate y dejar que la filial quiebre o sufra la ejecución pública, asumiendo hoy el golpe reputacional y financiero.' },
      { id: 'C', texto: 'Rescatarles el 50% del agujero para que sientan parte del dolor y aprendan la lección.' },
    ],
    opcionCorrecta: 'B',
    pista: 'Mira cómo te están observando las otras dos filiales. Si tu preferencia revelada es que el daño reputacional te duele más a ti que a ellos, ¿quién tiene la sartén por el mango?',
    solucion:
      'Es el Dilema del Samaritano de James Buchanan. Si la filial sabe que cuando llegue el desastre tu coste de dejarles caer (daño de marca) es mayor que el coste del rescate, tu amenaza previa de "no os rescataré" no es creíble (inconsistencia temporal). Si los rescatas hoy —incluso castigando a una persona—, confirmas a las demás unidades que las ganancias del riesgo son privadas y las pérdidas extremas están mutualizadas por la matriz. La única forma de cambiar el equilibrio en un juego repetido es demostrar que estás dispuesto a tragarte el daño reputacional hoy.',
    modeloMental:
      'Dilema del Samaritano: Si el rescatador sufre más viendo caer al imprudente que pagando la factura, el imprudente tiene un incentivo racional para no protegerse jamás.',
  },
  {
    id: 'tg-senalizacion-spence',
    bloque: '1',
    titulo: 'Por qué la utilidad destruye la señal',
    escenario:
      'Quieres filtrar proveedores de componentes críticos. Solo el 10% son realmente excelentes (bajo coste de fallos internos) y el 90% son mediocres (alto coste de retrabajo). Creas una certificación voluntaria de entrada. Tu equipo te propone dos diseños para esa certificación: Diseño 1: Un curso formativo muy práctico y fácil que mejora un 15% la calidad de quien lo hace. Diseño 2: Una auditoría burocrática infernal que no enseña nada nuevo, pero que a un proveedor excelente le cuesta 5.000€ superar (porque ya tiene todo en orden) y a uno mediocre le cuesta 80.000€ en parches y horas extra. ¿Cuál eliges para separar el grano de la paja?',
    opciones: [
      { id: 'A', texto: 'El Diseño 1, porque aporta valor real a la cadena de suministro y eleva el nivel medio de todos los proveedores.' },
      { id: 'B', texto: 'El Diseño 2, precisamente porque es un coste puro con asimetría de esfuerzo entre buenos y malos.' },
      { id: 'C', texto: 'Una mezcla de ambos a coste reducido para que todos puedan presentarse y evaluar después.' },
    ],
    opcionCorrecta: 'B',
    pista: '¿Cuándo deja de servir una señal para distinguir a dos grupos? Cuando imitar la señal resulta barato o rentable para el impostor.',
    solucion:
      'Es el Modelo de Señalización de Michael Spence (y el Principio del Hándicap de Zahavi en biología). Para que exista un "equilibrio separador", la señal no necesita aportar valor directo; lo único que necesita es que su coste marginal sea inversamente proporcional a la calidad oculta del emisor. Con el Diseño 1, tanto los buenos como los mediocres harán el curso (equilibrio agrupador) y seguirás sin saber quién es quién. Con el Diseño 2, para el mediocre es irracional gastar 80.000€ en fingir, por lo que se autodescarta antes de que tengas que inspeccionarle.',
    modeloMental:
      'Señalización de Spence: Una señal solo es honesta y separa al competente del farsante si fingirla resulta prohibitivamente más caro para el farsante que para el genuino.',
  },

  // ── BLOQUE 2: Incentivos Perversos y Sistemas ────────────────────────────
  {
    id: '2.1',
    bloque: '2',
    titulo: 'Cazadores de bugs (El Efecto Cobra en ingeniería)',
    escenario:
      'El director de tecnología de una plataforma observa que hay demasiados errores en producción. Para solucionarlo rápido, anuncia un bono de 150 € en efectivo para cualquier desarrollador por cada bug que encuentre y corrija durante el trimestre. Al mes siguiente, el número de bugs resueltos se triplica y el presupuesto de bonos se agota, pero la estabilidad real del sistema empeora. ¿Qué ha ocurrido y cómo debía diseñarse el incentivo?',
    opciones: [
      { id: 'A', texto: 'El bono era demasiado bajo para motivar; había que subirlo a 300 € pero sólo para los bugs graves.' },
      { id: 'B', texto: 'Pagar por bug corregido premia escribir código descuidado y trocear los arreglos para cobrar más.' },
      { id: 'C', texto: 'Había que castigar con multas a quien introdujera un bug en lugar de premiar.' },
      { id: 'D', texto: 'El problema fue no usar herramientas automáticas de detección antes de pagar.' },
    ],
    opcionCorrecta: 'B',
    pista: 'Si pagas por cada serpiente muerta que te entreguen, ¿qué negocio se vuelve inmediatamente rentable para los ciudadanos?',
    solucion:
      'Es el Efecto Cobra. La anécdota que le da nombre (cobras criadas en Delhi para cobrar la recompensa) es popular pero no está documentada; el caso documentado es Hanói en 1902, donde la administración colonial francesa pagaba por cada cola de rata y aparecieron ratas sin cola vivas y criaderos (Michael Vann lo reconstruyó en 2003). En software, pagar por bug cerrado a quienes también escriben el código crea un arbitraje evidente: relajar la calidad inicial, pactar cruces de tickets entre compañeros o fragmentar parches. Nunca debes remunerar la corrección de un problema a quien controla la creación de ese mismo problema. La métrica debe atarse al resultado sistémico (tiempo sin incidencias en producción o reducción de regresiones percibidas por el usuario).',
    modeloMental:
      'Efecto Cobra: nunca pagues por apagar incendios a quien tiene las cerillas; antes de premiar una acción, pregúntate cómo maximizaría el cobro un agente cínico.',
  },
  {
    id: '2.2',
    bloque: '2',
    titulo: 'Urgencias en menos de 4 horas (Ley de Goodhart)',
    escenario:
      'Un sistema público de salud detecta que los pacientes esperan demasiado en urgencias. El ministerio impone una regla estricta: todo hospital donde más del 5 % de los pacientes esperen más de 4 horas para ser atendidos perderá financiación y su director será destituido. Seis meses después, las estadísticas oficiales muestran que el 98 % de los pacientes son atendidos en menos de 3 horas y 59 minutos, pero las quejas de pacientes graves aumentan. ¿Dónde está la trampa del sistema?',
    opciones: [
      { id: 'A', texto: 'Los médicos trabajan peor bajo la presión del objetivo y cometen más errores de diagnóstico.' },
      { id: 'B', texto: 'Los hospitales optimizan el cronómetro, no la atención: hay esperas fuera del edificio y altas forzadas.' },
      { id: 'C', texto: 'El límite de 4 horas era demasiado laxo y debía fijarse en 2 horas.' },
      { id: 'D', texto: 'Faltaban inspectores en las salas de espera para comprobar que el cronómetro se registra bien.' },
    ],
    opcionCorrecta: 'B',
    pista: 'Cuando una medida estadística se convierte en un objetivo con castigos severos, ¿qué es más fácil para la organización: transformar su capacidad médica real o redefinir cuándo empieza y termina el cronómetro?',
    solucion:
      'La Ley de Goodhart establece que «cuando una métrica se convierte en objetivo, deja de ser una buena métrica». Basado en el caso real del NHS británico: para cumplir el umbral de las 4 horas sin presupuesto extra, los hospitales empezaron a hacer esperar a los enfermos dentro de las ambulancias aparcadas (el reloj solo empezaba al cruzar la puerta de admisión), ingresaban en planta a pacientes que no lo necesitaban en el minuto 238 para parar el cronómetro, o priorizaban casos leves rápidos a las 3h 50m sobre casos graves que recién llegaban. Las métricas de umbral único con alta presión destruyen el sistema que intentan medir.',
    modeloMental:
      'Ley de Goodhart: toda métrica sometida a presión extrema será manipulada en sus bordes; usa siempre métricas contrapuestas (velocidad + tasa de reingreso/gravedad).',
  },
  {
    id: '2.3',
    bloque: '2',
    titulo: 'El atajo que colapsó la red (Paradoja de Braess)',
    escenario:
      'En tu empresa, las peticiones de soporte pasan por dos equipos paralelos (Equipo A y Equipo B). Cada equipo combina una fase rápida pero que se satura si recibe mucho volumen, y otra fase de capacidad fija pero lenta (tardan unos 65 minutos de media en total). Para acelerar el sistema, creas una pasarela exprés instantánea que permite saltar de la fase rápida del Equipo A a la fase rápida del Equipo B. Tras abrir el atajo, el tiempo medio de resolución de TODOS los tickets sube a 80 minutos. ¿Por qué añadir capacidad empeoró el rendimiento?',
    opciones: [
      { id: 'A', texto: 'Porque la pasarela exprés introduce costes ocultos de coordinación entre los dos equipos.' },
      { id: 'B', texto: 'Cada ticket elige el atajo porque individualmente parece más rápido, y así satura a la vez los dos tramos congestionables.' },
      { id: 'C', texto: 'Porque al ver una vía rápida entra más volumen total de peticiones al sistema.' },
      { id: 'D', texto: 'Es imposible: añadir una conexión nueva de coste cero nunca puede empeorar el tiempo medio si el volumen de entrada es el mismo.' },
    ],
    opcionCorrecta: 'B',
    pista: 'En una red donde el coste de ciertos tramos depende de cuántos los usen a la vez, ¿coincide el equilibrio donde nadie quiere cambiar de ruta con el óptimo global?',
    solucion:
      'Es la Paradoja de Braess (probada en redes de tráfico en Seúl, Stuttgart y Nueva York, así como en redes eléctricas e informáticas). Antes del atajo, el flujo se repartía al 50 % entre las dos rutas y los cuellos de botella quedaban a media carga. Al abrir la conexión transversal gratuita, para cualquier paquete individual el camino que cruza por los dos tramos sensibles se vuelve una estrategia dominante. Como TODOS toman ese camino siguiendo su interés individual, ambos cuellos de botella se saturan al 100 %, llevando a un equilibrio de Nash donde todos tardan más que cuando el atajo no existía. A veces, eliminar una opción mejora el sistema.',
    modeloMental:
      'Paradoja de Braess: en redes con congestión, añadir un atajo puede empujar a todos hacia un equilibrio egoísta peor; a veces bloquear una ruta acelera el flujo global.',
  },
  {
    id: '2.4',
    bloque: '2',
    titulo: 'La espiral del talento (Selección Adversa de Akerlof)',
    escenario:
      'Una empresa tecnológica decide recortar costes congelando el sueldo de todos sus ingenieros un 15 % por debajo de la media del mercado, asumiendo que «la mayoría se quedará por comodidad y ahorraremos millones». Seis meses después, solo se ha marchado el 20 % de la plantilla, por lo que finanzas celebra el ahorro. Sin embargo, la velocidad de entrega de producto cae un 60 %. ¿Qué fallo de modelo mental cometió la dirección?',
    opciones: [
      { id: 'A', texto: 'No previó que el 80 % que se quedó reduciría su esfuerzo en una huelga encubierta por solidaridad.' },
      { id: 'B', texto: 'El recorte uniforme expulsó primero a quienes tenían ofertas fuera, que suelen ser los más productivos.' },
      { id: 'C', texto: 'El recorte debía haberse hecho del 5 % para que nadie lo notara.' },
      { id: 'D', texto: 'Faltó compensar la congelación salarial con beneficios no monetarios como flexibilidad o formación.' },
    ],
    opcionCorrecta: 'B',
    pista: 'En el «mercado de los limones» de Akerlof, cuando fijas un precio único a la baja para todos los coches usados, ¿qué vendedores aceptan ese precio y cuáles retiran su coche del mercado?',
    solucion:
      'Es Selección Adversa pura. Cuando una organización ofrece condiciones por debajo del valor de mercado sin distinguir la aportación real, el filtro opera al revés de lo deseado: los profesionales con alta empleabilidad externa (que suelen concentrar una fracción desproporcionada del conocimiento crítico y la resolución de problemas complejos) se marchan primero, mientras que quienes tienen menos alternativas en el mercado permanecen. La empresa cree haber retenido el 80 % de su capacidad al 85 % del coste, pero en realidad se ha quedado con los «limones» del mercado pagando de más por unidad de valor entregado.',
    modeloMental:
      'Selección adversa: un recorte o precio uniforme a la baja nunca filtra al azar; expulsa primero la mayor calidad y concentra en tu cartera exactamente lo que nadie más compra.',
  },
  {
    id: 'inc-efecto-peltzman',
    bloque: '2',
    titulo: 'El freno que provoca más accidentes',
    escenario:
      'En un sistema de despliegue de software (o en una línea operativa), introduces una red de validación automática de última generación que reduce en un 70% la probabilidad de que un error humano llegue al cliente final. Seis meses después, analizas los datos globales: el número total de incidentes graves que llegan al cliente apenas ha bajado un 5%, pero la velocidad de entregas chapuceras y cambios de última hora sin revisar se ha triplicado. ¿Qué ha ocurrido en el sistema?',
    opciones: [
      { id: 'A', texto: 'La herramienta automática tiene fallos ocultos que no se detectaron en las pruebas iniciales.' },
      { id: 'B', texto: 'Los equipos han gastado el margen de seguridad extra en ir más rápido y revisar menos.' },
      { id: 'C', texto: 'Es una regresión a la media normal tras implantar una mejora; en unos meses se verá el efecto real.' },
    ],
    opcionCorrecta: 'B',
    pista: 'Cada persona tiene un nivel de riesgo con el que se siente cómoda (su "termostato de peligro"). Si le pones un casco de acero y frenos ABS, ¿conduce igual de despacio sobre hielo?',
    solucion:
      'Es el Efecto Peltzman (compensación del riesgo). Los agentes no buscan minimizar el riesgo a cero: buscan su retorno (velocidad, comodidad, menos esfuerzo) con un riesgo percibido que les resulte tolerable. Si añades una barrera de seguridad visible sin cambiar el coste individual de fallar en origen, parte de la mejora se convierte en velocidad o descuido. La evidencia empírica respalda una compensación parcial; la versión fuerte (la homeostasis del riesgo de Wilde, que devolvería el riesgo exactamente a su nivel original) no está bien sostenida, así que lo prudente es esperar que se pierda una parte del beneficio, no todo.',
    modeloMental:
      'Efecto Peltzman: cuando bajas el peligro percibido, la gente gasta parte del margen en ir más deprisa; cuenta con esa compensación al estimar el beneficio de una medida de seguridad.',
  },
  {
    id: 'inc-holmstrom-equipos',
    bloque: '2',
    titulo: 'La trampa del bonus compartido',
    escenario:
      'Tienes un equipo de 5 especialistas donde el resultado final depende del esfuerzo conjunto, pero es imposible medir con precisión cuánto ha aportado cada individuo sin vigilarlos cada minuto. Quieres diseñar un sistema de incentivos que cumpla tres condiciones a la vez: 1) Que nadie se escaquee (cero parasitismo), 2) Que todo el valor generado se reparta íntegramente entre los 5 (presupuesto equilibrado, sin que la empresa se quede parte ni ponga dinero extra), y 3) Que el sistema sea estable. ¿Cómo repartes el bonus cuando el proyecto sale bien?',
    opciones: [
      { id: 'A', texto: 'Reparto equitativo (20 % para cada uno), condicionado a que el equipo supere el objetivo común del proyecto.' },
      { id: 'B', texto: 'Reparto proporcional a una evaluación cruzada y anónima entre los propios miembros del equipo.' },
      { id: 'C', texto: 'Ninguno: si siempre se reparte todo, habrá escaqueo; hace falta un tercero que retenga el bonus si se falla.' },
    ],
    opcionCorrecta: 'C',
    pista: 'Si todo lo que producen se reparte siempre entre ellos (100%), cada vez que uno trabaja una hora extra sufre el 100% del cansancio pero solo se lleva el 20% del premio.',
    solucion:
      'Es el Teorema de Holmström (Nobel de Economía 2016) sobre riesgo moral en equipos. Si el presupuesto es cerrado (todo el resultado se reparte entre los miembros), siempre existirá incentivo para el free-riding, porque el coste del esfuerzo es individual pero el retorno se diluye entre N. La única forma matemática de forzar el esfuerzo óptimo sin medir el trabajo individual es introducir una asimetría punitiva: si el producto conjunto baja un milímetro del umbral, el grupo pierde todo el bonus y se lo queda un tercero (un "principal" con capacidad de quemar o quedarse el excedente).',
    modeloMental:
      'Teorema de Holmström: En un equipo donde el esfuerzo individual es invisible, no puedes evitar el parasitismo si repartes siempre el 100% del pastel entre sus miembros.',
  },
  {
    id: 'inc-efecto-trinquete',
    bloque: '2',
    titulo: 'El castigo silencioso a la excelencia',
    escenario:
      'Una planta tiene asignado un objetivo anual de reducción de defectos del 10%. Gracias a una reorganización brillante a mitad de año, el equipo descubre la forma de reducirlos un 35% de golpe. Sin embargo, a partir de septiembre el rendimiento se frena misteriosamente y cierran diciembre en un 11,5% clavado, guardándose las mejoras restantes en un cajón. No hay pereza ni sabotaje malicioso. ¿Qué fallo de diseño de incentivos explica esta frenada racional?',
    opciones: [
      { id: 'A', texto: 'El síndrome del impostor o miedo a que despidan personal si el proceso se vuelve demasiado eficiente.' },
      { id: 'B', texto: 'Saben que el récord de este año se convertirá en el objetivo mínimo del siguiente, sin recompensa extra.' },
      { id: 'C', texto: 'Falta de alineación cultural con la visión a largo plazo de la compañía.' },
    ],
    opcionCorrecta: 'B',
    pista: 'En las fábricas soviéticas, si superabas tu cuota un 50% en el año T, ¿qué cuota te ponía el ministerio en el año T+1?',
    solucion:
      'Es el Efecto Trinquete (Ratchet Effect). Cuando el regulador o la dirección utiliza el rendimiento histórico observado para fijar el estándar mínimo del siguiente periodo, revela una trampa dinámica: esforzarse al máximo hoy destruye tus propios márgenes futuros y eleva permanentemente tu exigencia base. Ante un trinquete, cualquier agente racional ocultará su capacidad real y dosificará las mejoras a cuentagotas. Solo se rompe comprometiéndose por contrato a no tocar la línea base durante varios años (regulación price-cap a plazo fijo).',
    modeloMental:
      'Efecto Trinquete: Si premias un récord extraordinario convirtiéndolo en el nuevo mínimo exigible del año siguiente, enseñas a tus mejores piezas a esconder su capacidad real.',
  },
  {
    id: 'inc-anticomunes-heller',
    bloque: '2',
    titulo: 'Cuando diez llaves bloquean la puerta',
    escenario:
      'Para evitar que un área tome decisiones precipitadas al lanzar un producto, creas un comité de garantías donde 6 departamentos distintos (Calidad, Legal, Compras, Seguridad, Finanzas, Ingeniería) tienen derecho de veto independiente: hace falta la firma de los 6 para avanzar. Cada departamento no cobra por el éxito global del lanzamiento, sino que es penalizado si hay un problema en su parcela. ¿Cuál es el resultado sistémico predecible?',
    opciones: [
      { id: 'A', texto: 'Los productos saldrán al mercado más despacio, pero con una robustez y una excelencia técnica muy superiores.' },
      { id: 'B', texto: 'Bloqueo: cada firmante asume el riesgo de su parcela sin ganar nada por lanzar, así que le conviene vetar.' },
      { id: 'C', texto: 'Los 6 departamentos negociarán entre sí intercambiando favores para agilizar los trámites.' },
    ],
    opcionCorrecta: 'B',
    pista: 'Si en la "Tragedia de los Comunes" un recurso se sobreexplota porque todos tienen derecho a usarlo y nadie a impedirlo, ¿qué pasa cuando nadie tiene derecho a usarlo pero seis tienen derecho a impedirlo?',
    solucion:
      'Es la Tragedia de los Anticomunes de Michael Heller (el espejo exacto de la Tragedia de los Comunes). Cuando fragmentas los derechos de exclusión o veto entre múltiples agentes independientes con incentivos asimétricos (castigo por error propio vs. indiferencia ante el coste de oportunidad del retraso), cada agente exige un "peaje" de seguridad máximo. La suma de seis prudencias racionales individuales produce una parálisis colectiva irracional donde proyectos de altísimo valor neto jamás ven la luz.',
    modeloMental:
      'Tragedia de los Anticomunes: Cuando demasiados agentes tienen derecho de veto independiente pero ninguno captura el beneficio del éxito global, el recurso muere por bloqueo e infrautilización.',
  },

  // ── BLOQUE 3: Paradojas de Decisión y Lógica ─────────────────────────────
  {
    id: '3.1',
    bloque: '3',
    titulo: 'El proyecto que nadie quería (Paradoja de Abilene)',
    escenario:
      'En una reunión de comité, el director comenta de pasada: «Podríamos migrar toda nuestra base de datos este verano, ¿cómo lo veis?». En privado, el director tiene dudas; el jefe de arquitectura piensa que es un suicidio técnico pero cree que el director está ilusionado; la jefa de producto lo ve inútil pero al ver que arquitectura no protesta, dice «¡Gran idea!». Al final se aprueba por unanimidad. Seis meses después, tras el desastre, todos confiesan que estaban en contra desde el minuto uno. ¿Qué fenómeno ocurrió?',
    opciones: [
      { id: 'A', texto: 'Pensamiento grupal: el autoritarismo del director impidió cualquier crítica en la reunión.' },
      { id: 'B', texto: 'Todos se oponían en privado, pero cada uno creyó que los demás lo querían y nadie lo dijo.' },
      { id: 'C', texto: 'Dilema del prisionero: cada departamento buscaba quedar bien a costa de los demás.' },
      { id: 'D', texto: 'Falta de capacidad técnica del equipo para evaluar los riesgos reales de la migración.' },
    ],
    opcionCorrecta: 'B',
    pista: 'No están en conflicto entre sí: todos quieren exactamente lo mismo (no migrar), pero terminan votando lo contrario. ¿Por qué nadie verbalizó su verdadera preferencia?',
    solucion:
      'Formulada por Jerry Harvey, la Paradoja de Abilene ocurre cuando un grupo toma colectivamente una decisión que contradice las preferencias de absolutamente todos sus miembros individuales. A diferencia del conflicto (donde las personas discrepan), aquí hay un acuerdo tácito oculto, pero el miedo a parecer desleal o aguafiestas lleva a cada individuo a validar en público lo que cree que el grupo desea. Para romper el viaje a Abilene basta con que el líder pida objeciones por escrito ANTES de opinar o pregunte: «¿Qué razones tenemos para NO hacer esto ahora?».',
    modeloMental:
      'Paradoja de Abilene: el silencio o el asentimiento educado no es consenso; exige siempre disenso anónimo o previo antes de dar por buena una decisión unánime.',
  },
  {
    id: '3.2',
    bloque: '3',
    titulo: 'La trampa de la eficiencia (Paradoja de Jevons)',
    escenario:
      'Tu equipo de datos gasta 20.000 € al mes en consultas a la nube. Tras un mes de ingeniería brillante, optimizáis el motor para que cada consulta sea un 70 % más barata y rápida. Finanzas proyecta que la factura mensual bajará a 6.000 €. Sin embargo, tres meses después, la factura de la nube sube a 35.000 € al mes. Nadie ha cometido errores ni ha subido la tarifa unitaria. ¿Por qué la mejora de eficiencia disparó el gasto total?',
    opciones: [
      { id: 'A', texto: 'Porque el proveedor de nube aplica recargos ocultos cuando baja el consumo medio por consulta.' },
      { id: 'B', texto: 'Al abaratar cada consulta, se volvieron rentables usos que antes no compensaban y el volumen se disparó.' },
      { id: 'C', texto: 'Porque los ingenieros dejaron procesos en bucle encendidos por descuido durante las pruebas de la optimización.' },
      { id: 'D', texto: 'Es una anomalía temporal que se corregirá sola al mes siguiente.' },
    ],
    opcionCorrecta: 'B',
    pista: 'En el siglo XIX, cuando James Watt hizo las máquinas de vapor mucho más eficientes quemando carbón, ¿bajó el consumo nacional de carbón en Inglaterra o subió?',
    solucion:
      'Es la Paradoja de Jevons (o efecto rebote extremo): cuando el progreso tecnológico aumenta la eficiencia con la que se usa un recurso, el coste efectivo de ese recurso cae. Si la demanda es elástica, la caída del coste por unidad induce a lanzar análisis cada 5 minutos en lugar de una vez al día, a entrenar modelos más grandes y a incorporar el recurso en productos donde antes era prohibitivo. Ojo con generalizar: en la mayoría de los casos estudiados el rebote es parcial (parte del ahorro se pierde, no todo), y el consumo total sólo sube cuando la demanda es muy elástica, como aquí, donde había muchos usos esperando a que el precio bajara.',
    modeloMental:
      'Paradoja de Jevons: si la demanda es elástica, abaratar un recurso puede aumentar su consumo total; si quieres ahorrar de verdad, acompaña la eficiencia con un tope de capacidad.',
  },
  {
    id: '3.3',
    bloque: '3',
    titulo: 'El dilema del viajero de Basu (Racionalidad extrema vs sentido común)',
    escenario:
      'Una aerolínea pierde dos maletas idénticas tuya y de otro pasajero (no os conocéis). Para indemnizaros sin recibo, el director os separa y os pide escribir un número entero entre 2 € y 100 €. Si escribís el mismo número, ambos cobráis esa cifra. Si uno escribe un número menor que el otro, el que escribió el número MENOR recibe su cifra + 2 € de premio por honestidad, y el que escribió el mayor recibe la cifra menor − 2 € de multa. ¿Qué número escribes para maximizar tu cobro real?',
    opciones: [
      { id: 'A', texto: '2 €, que es el único equilibrio de Nash del juego por eliminación iterativa.' },
      { id: 'B', texto: '100 €, confiando en que el otro tampoco querrá rebajar el pago común que os beneficia a ambos.' },
      { id: 'C', texto: '97 € o 98 €: la tentación de rebajar vale 2 €, y bajar hasta el fondo cuesta casi 100 €.' },
      { id: 'D', texto: '50 €, para partir la diferencia en el punto medio.' },
    ],
    opcionCorrecta: 'C',
    pista: 'Si el otro escribe 100, tu mejor respuesta es 99 (ganas 101). Si sabes que él sabe eso, tu mejor respuesta es 98... La lógica pura lleva hasta 2 €. Pero ¿de verdad alguien escribe 2 € cuando hay casi 100 € en juego?',
    solucion:
      'Ideado por el economista Kaushik Basu para mostrar los límites de la inducción hacia atrás estricta. Aunque 2 € es el único equilibrio de Nash (porque para cualquier número N > 2 que creas que pondrá el rival, te conviene poner N − 1), en la realidad casi nadie elige 2 €. La penalización marginal por no llegar al fondo es de apenas 2 €, mientras que la pérdida acumulada por espiral descendente es de 98 €. En experimentos reales (incluso entre teóricos de juegos), las respuestas se agrupan entre 95 € y 100 €, siendo 97–98 € la jugada que maximiza el valor esperado real.',
    modeloMental:
      'Dilema de Basu: cuando la cadena de inducción lógica exige decenas de pasos con premios minúsculos para llegar a un equilibrio absurdo, apuesta por la cooperación cercana al techo.',
  },
  {
    id: '3.4',
    bloque: '3',
    titulo: 'El predictor y las dos cajas (Paradoja de Newcomb)',
    debate: true,
    escenario:
      'Un algoritmo de perfilado psicológico, que ha acertado el 99 % de las veces con miles de candidatos, te presenta dos cajas: la caja transparente contiene 1.000 € seguros; la caja opaca contiene o bien 1.000.000 € o bien nada. Puedes llevarte SÓLO la opaca o llevarte LAS DOS. Ayer el algoritmo predijo tu decisión: si predijo que cogerías las dos, dejó la opaca vacía; si predijo que cogerías sólo la opaca, metió el millón. El dinero ya está dentro. ¿Qué haces?',
    opciones: [
      { id: 'A', texto: 'Coger las dos: el dinero ya está puesto y mi decisión de hoy no cambia el pasado; con las dos siempre tengo 1.000 € más.' },
      { id: 'B', texto: 'Coger sólo la opaca: quienes eligen así encuentran el millón el 99 % de las veces, y quienes cogen las dos casi nunca.' },
    ],
    opcionCorrecta: null,
    pista: 'No hay respuesta oficial: es un problema abierto. Antes de elegir, decide qué te importa más, que tu decisión cause lo mejor o que sea la que mejor te va como tipo de decisor.',
    solucion:
      'Reto de debate: no tiene respuesta correcta y no cuenta como acierto ni como fallo. Robert Nozick lo publicó en 1969 y sigue dividiendo a la teoría de la decisión. La teoría causal elige las dos cajas: tu decisión no puede cambiar lo que ya hay dentro, y con las dos siempre ganas 1.000 € más (dominancia). La teoría evidencial, y la «funcional» de Yudkowsky y Soares, eligen una: tu decisión es casi una prueba de lo que predijo el algoritmo, y quienes eligen una caja acaban más ricos. En la encuesta PhilPapers de 2020 los filósofos se reparten sin mayoría clara, con algo más de partidarios de las dos cajas. Fuera del experimento, la versión práctica es la reputación: si los demás predicen bien tu conducta, ser alguien que no aprovecha la última jugada abre puertas que el oportunista no ve.',
    modeloMental:
      'Newcomb: decidir por causas (dos cajas) y decidir por lo que tu decisión revela de ti (una caja) pueden chocar; cuando otros predicen tu conducta, la segunda pesa más de lo que parece.',
  },
  {
    id: 'par-parrondo',
    bloque: '3',
    titulo: 'Ganar alternando dos estrategias perdedoras',
    escenario:
      'Te ofrecen dos estrategias de inversión/operación, A y B. Si juegas solo a la estrategia A de forma continua, a largo plazo pierdes dinero con certeza matemática. A es una moneda ligeramente desfavorable (ganas el 49,5 % de las veces). B depende de tu capital: si es múltiplo de 3, ganas sólo el 9,5 % de las veces; si no, el 74,5 %. Jugada sola, B también pierde a largo plazo, porque pasas demasiado tiempo atascado en los múltiplos de 3. Sin embargo, un matemático te propone jugar dos rondas a A, dos rondas a B, dos a A, dos a B... sin cambiar nada más. ¿Qué ocurre con tu capital?',
    opciones: [
      { id: 'A', texto: 'Pierdes dinero a una velocidad intermedia entre la pérdida de A y la de B (la suma lineal de dos expectativas negativas siempre es negativa).' },
      { id: 'B', texto: 'El capital tiende a crecer: alternar dos juegos perdedores acoplados por el estado puede dar un juego ganador.' },
      { id: 'C', texto: 'Te quedas exactamente a cero (empate perpetuo por cancelación de varianzas).' },
    ],
    opcionCorrecta: 'B',
    pista: 'Piensa en un trinquete mecánico (como el escape de un reloj): una pieza sola deja caer el peso hacia atrás, pero si metes y sacas un diente a destiempo, ¿hacia dónde se mueve la rueda?',
    solucion:
      'Es la Paradoja de Parrondo (formulada por el físico español Juan Manuel Rodríguez Parrondo en 1996, inspirada en el trinquete browniano de Feynman). Cuando las probabilidades de uno de los juegos (B) dependen del estado actual (por ejemplo, es muy favorable cuando tu capital no es múltiplo de 3, y muy desfavorable cuando sí lo es), jugar solo a B te deja atrapado en los estados malos. Al intercalar el juego A (que pierde un poquito pero añade "ruido" y te saca de los múltiplos de 3), rompes el estancamiento en las zonas tóxicas de B y rectificas el movimiento hacia arriba. Dos dinámicas deficitarias por separado pueden ser superavitarias al combinarse.',
    modeloMental:
      'Paradoja de Parrondo: En sistemas donde el rendimiento depende del estado actual, alternar dos estrategias que fracasan por separado puede generar una estrategia ganadora al romper los ciclos de bloqueo.',
  },
  {
    id: 'par-berkson',
    bloque: '3',
    titulo: 'Por qué los restaurantes con buenas vistas tienen peor comida',
    escenario:
      'Analizas todos los proveedores activos de tu cartera actual (o todos los restaurantes que llevan más de 5 años abiertos en tu ciudad). Descubres una correlación estadística negativa clarísima: cuanto más barato es un proveedor en tu cartera, peor es su puntualidad de entrega; y cuanto más puntual es, más caro resulta. Concluyes que en el mercado general es imposible encontrar proveedores que sean a la vez baratos y puntuales. ¿Dónde está el fallo lógico de tu conclusión?',
    opciones: [
      { id: 'A', texto: 'La muestra es demasiado pequeña para extraer una ley general del mercado.' },
      { id: 'B', texto: 'Tu cartera ya está filtrada: los caros e impuntuales se descartaron, y eso fabrica una correlación negativa entre los que quedan.' },
      { id: 'C', texto: 'Es una consecuencia natural de la frontera de eficiencia de Pareto; calidad y precio siempre son inversamente proporcionales en la realidad.' },
    ],
    opcionCorrecta: 'B',
    pista: 'Dibuja un cuadrante con (Barato/Caro) y (Puntual/Impuntual). En el mundo real esas dos cosas pueden no tener nada que ver. Pero si tú borras de un plumazo la esquina de "Caro + Impuntual" porque no trabajas con ellos, ¿qué forma geométrica tienen los tres cuadrantes que te quedan en la tabla?',
    solucion:
      'Es la Paradoja de Berkson (sesgo de colisionador). Dos variables completamente independientes en la población general se vuelven negativamente correlacionadas en cuanto condicionas tu observación a que hayan superado un filtro común (por ejemplo, que la suma de ambas supere un umbral de supervivencia). Un restaurante con comida horrible Y vistas horribles cierra; por tanto, entre los restaurantes abiertos que tienen vistas espectaculares te encontrarás muchos con comida mediocre (porque las vistas los salvan), y los que tienen vistas a un callejón oscuro solo siguen abiertos si su comida es sublime. La correlación negativa no existe en el mundo: la ha fabricado tu filtro de admisión.',
    modeloMental:
      'Paradoja de Berkson: Si seleccionas elementos que superan un filtro combinando dos cualidades independientes, dentro de tus elegidos parecerá que tener una cualidad implica carecer de la otra.',
  },
  {
    id: 'par-inspector-espera',
    bloque: '3',
    titulo: 'Por qué el autobús siempre tarda más que su frecuencia media',
    escenario:
      'Un servicio de trenes (o un proceso de lote en una máquina) pasa con un promedio exacto de 10 minutos a lo largo del día, pero no es un reloj suizo: a veces pasan dos seguidos a los 2 minutos y luego hay un hueco de 18 minutos (la media sigue siendo 10: (2+18)/2 = 10). Si tú llegas a la estación en un instante completamente aleatorio del día sin mirar el horario, ¿cuánto tiempo esperarás de media hasta que pase el siguiente tren?',
    opciones: [
      { id: 'A', texto: '5 minutos, la mitad exacta del intervalo medio de 10 minutos, porque llegas en un instante al azar.' },
      { id: 'B', texto: 'Más de 5 minutos (unos 8): llegando al azar es mucho más fácil caer en el hueco de 18 que en el de 2.' },
      { id: 'C', texto: '10 minutos exactos sólo si la distribución es normal; con otras distribuciones, menos de 5.' },
    ],
    opcionCorrecta: 'B',
    pista: 'Si el día tiene un hueco corto de 2 minutos y un hueco largo de 18 minutos y lanzas un dardo al azar contra la línea del tiempo del día, ¿qué probabilidad tienes de caer en el hueco de 18 minutos frente al de 2?',
    solucion:
      'Es la Paradoja del Inspector (o paradoja del tiempo de espera). Cuando muestreas intervalos llegando al azar, no todos los intervalos tienen la misma probabilidad de ser "visitados" por ti: un intervalo de 18 minutos ocupa 9 veces más tiempo del reloj que uno de 2 minutos, así que caerás en el hueco largo el 90% de las veces (18/20) y en el corto solo el 10% (2/20). Tu espera media no es la mitad de la media (5 min), sino (0,9 × 9) + (0,1 × 1) = 8,2 minutos. Cuanta más varianza e irregularidad tenga un proceso, mayor será el tiempo medio de espera percibido por quien llega al azar, aunque la media oficial del proveedor sea impecable.',
    modeloMental:
      'Paradoja del Inspector: Al observar un proceso en instantes aleatorios, siempre sobremuestreas los intervalos más largos y lentos simplemente porque ocupan más espacio en el tiempo.',
  },
  {
    id: 'par-bella-durmiente',
    bloque: '3',
    titulo: 'El despertar amnésico y la moneda justa',
    escenario:
      'Participas en un experimento el domingo. Te duermen y lanzan una moneda perfecta al aire. Si sale CARA, te despiertan solo el lunes, te hacen una entrevista y el experimento termina. Si sale CRUZ, te despiertan el lunes, te entrevistan, te dan una droga que borra tu memoria de ese lunes y te vuelven a despertar el martes para otra entrevista idéntica. Cuando te despiertan en la habitación sin ventanas (no sabes si es lunes o martes), el investigador te pregunta: "¿En qué apuestas tu dinero ahora mismo: a que la moneda salió CARA o a que salió CRUZ?".',
    opciones: [
      { id: 'A', texto: 'Da igual (50 % Cara, 50 % Cruz): la moneda es justa y despertarte era seguro, así que no aprendes nada nuevo.' },
      { id: 'B', texto: 'Apostar a CRUZ: con una apuesta en cada despertar, si sale cruz cobras dos veces y si sale cara pierdes una.' },
      { id: 'C', texto: 'Apostar a CARA, porque el lunes ocurre siempre, salga lo que salga la moneda, y es el despertar más probable.' },
    ],
    opcionCorrecta: 'B',
    pista: 'Si repitieras este experimento 100 semanas seguidas y en cada despertar apostaras 100€ a CRUZ, ¿cuántas veces cobrarías y cuántas pagarías?',
    solucion:
      'Es el problema de la Bella Durmiente, planteado por Adam Elga en 2000. La pregunta por la apuesta tiene respuesta: si apuestas en cada despertar, en 100 semanas habrá unas 50 caras (50 apuestas que ganas diciendo cara) y unas 50 cruces (100 apuestas que ganas diciendo cruz). Apostar a cruz gana, y en eso coinciden todos. Lo que sigue abierto es otra cosa: cuánto debes CREER que salió cara al despertar. Los «tercistas» (Elga) dicen 1/3; los «mitadistas» (David Lewis) dicen 1/2 y explican la apuesta porque el protocolo te hace cobrar dos veces cuando sale cruz. Que la apuesta óptima no coincida con tu probabilidad es justo la lección.',
    modeloMental:
      'Separa creencia y apuesta: cuando el número de veces que apuestas depende del resultado, la apuesta óptima puede no coincidir con tu probabilidad.',
  },

  // ── BLOQUE 4: Sesgos y Modelos Mentales ──────────────────────────────────
  {
    id: '4.1',
    bloque: '4',
    titulo: 'Los agujeros en el fuselaje (Sesgo de Supervivencia de Wald)',
    escenario:
      'Eres responsable de producto y quieres reducir la tasa de abandono de clientes (churn). Envías una encuesta detallada a tu base de usuarios activos actuales y realizas 30 entrevistas con tus clientes más fieles. El 80 % coincide en que quieren un panel de informes más avanzado. Inviertes seis meses en construir ese panel, pero las bajas de nuevos clientes en su primera semana siguen exactamente igual. ¿Dónde estuvo el fallo de diagnóstico?',
    opciones: [
      { id: 'A', texto: 'La muestra de 30 entrevistas era estadísticamente demasiado pequeña para sacar conclusiones sobre el abandono.' },
      { id: 'B', texto: 'Los usuarios dijeron en la encuesta lo que creen que quieren, no lo que realmente usan.' },
      { id: 'C', texto: 'Sólo preguntaste a quienes superaron la primera semana; los que abandonan no estaban en tu muestra.' },
      { id: 'D', texto: 'El panel de informes se lanzó con demasiados errores técnicos.' },
    ],
    opcionCorrecta: 'C',
    pista: 'Recuerda a Abraham Wald en la Segunda Guerra Mundial: cuando los bombarderos volvían a la base llenos de impactos en las alas y ninguno en el motor, ¿dónde había que poner el blindaje extra?',
    solucion:
      'Durante la Segunda Guerra Mundial, los militares querían blindar las zonas de los aviones que regresaban con más impactos de bala (las alas y la cola). El estadístico Abraham Wald señaló que solo estaban viendo los aviones que sobrevivían: los aviones alcanzados en el motor no tenían agujeros en el taller porque yacían en el fondo del canal de la Mancha. Al encuestar a tus clientes activos para entender el abandono, solo escuchas las peticiones de sofisticación de quienes sobrevivieron al onboarding, ignorando el «motor» (la fricción inicial) que derribó a los que se marcharon en silencio.',
    modeloMental:
      'Sesgo de supervivencia de Wald: antes de sacar conclusiones de los datos que tienes delante, pregúntate qué casos quedaron destruidos por el filtro y por eso no están en la sala.',
  },
  {
    id: '4.2',
    bloque: '4',
    titulo: 'El rescate del proyecto zombi (Falacia de Costes Hundidos)',
    escenario:
      'Lideras el desarrollo de una nueva línea de negocio en la que ya habéis invertido 800.000 € y 14 meses de trabajo. Faltan 200.000 € para terminarla, pero un competidor acaba de lanzar una alternativa gratuita superior; el nuevo cálculo realista estima que vuestro producto, una vez terminado, solo generará 120.000 € en ingresos totales. Al mismo tiempo, tienes otro proyecto nuevo que con esos mismos 200.000 € generaría 350.000 €. Tu comité dice: «No podemos tirar a la basura los 800.000 € ya gastados, hay que terminarlo». ¿Qué decides?',
    opciones: [
      { id: 'A', texto: 'Terminar el primer proyecto para recuperar al menos 120.000 € de los 800.000 € invertidos y no tirarlo todo.' },
      { id: 'B', texto: 'Repartir 100.000 € a cada proyecto para no cancelar ninguno.' },
      { id: 'C', texto: 'Cancelar el primer proyecto y poner los 200.000 € en el segundo: los 800.000 € ya están perdidos.' },
      { id: 'D', texto: 'Pedir 400.000 € adicionales para rediseñar el primer proyecto y superar al competidor.' },
    ],
    opcionCorrecta: 'C',
    pista: 'Imagina que llegas hoy nuevo al puesto sin haber vivido los últimos 14 meses y tienes 200.000 € en la mano: ¿comprarías un flujo futuro de 120.000 € o uno de 350.000 €?',
    solucion:
      'Los 800.000 € son un coste hundido: se han ido para siempre tanto si continúas como si cancelas. La decisión real hoy es exclusivamente prospectiva: gastar 200.000 € nuevos para recibir 120.000 € (perdiendo 80.000 € adicionales de valor neto) frente a gastar esos 200.000 € para recibir 350.000 € (ganando 150.000 € netos). La escalada de compromiso ocurre porque cancelar obliga a admitir públicamente que el gasto pasado fue un error, mientras que seguir inyectando dinero permite posponer el duelo contable.',
    modeloMental:
      'Test de borrado de memoria: los recursos ya gastados pertenecen al pasado; evalúa cada euro o minuto adicional como si acabaras de llegar hoy al problema.',
  },
  {
    id: '4.3',
    bloque: '4',
    titulo: 'La regla absurda en el código (La Valla de Chesterton)',
    escenario:
      'Acabas de asumir la dirección de operaciones de una empresa logística. Revisando el flujo de almacén, descubres un paso manual extraño: antes de cerrar cualquier palé internacional, un operario imprime una hoja física y la sella a mano, lo que retrasa cada envío 8 minutos. Nadie en el turno actual recuerda por qué se puso esa norma hace cinco años y parece burocracia obsoleta de la antigua etapa. ¿Cuál es la decisión correcta?',
    opciones: [
      { id: 'A', texto: 'Eliminar el paso hoy mismo para ganar 8 minutos por palé y demostrar agilidad ejecutiva.' },
      { id: 'B', texto: 'No tocar jamás ninguna norma antigua por precaución.' },
      { id: 'C', texto: 'No eliminarlo hasta averiguar qué problema concreto (aduanas, auditoría, seguro) llevó a crearlo.' },
      { id: 'D', texto: 'Sustituir la hoja impresa por un botón en una tablet sin investigar para qué servía el sello.' },
    ],
    opcionCorrecta: 'C',
    pista: 'Las reglas estúpidas rara vez nacen por capricho; suelen ser cicatrices de un incidente pasado olvidado. ¿Qué pasa si quitas un fusible sin saber qué cortocircuito protegía?',
    solucion:
      'El principio de la Valla de Chesterton dicta: «No derribes nunca una valla en medio de un camino hasta que sepas con exactitud por qué la levantaron». Quien entra nuevo en un sistema complejo suele ver solo el coste de primer orden (los 8 minutos perdidos) y es ciego al riesgo de segundo orden o de cola (por ejemplo, que una aduana específica confisque la mercancía cada seis meses si no lleva sello húmedo en papel para la póliza del seguro). Solo cuando comprendes la función original que cumplía la restricción tienes derecho a eliminarla o rediseñarla.',
    modeloMental:
      'Valla de Chesterton: nunca elimines un proceso, cláusula o bloque de código heredado que te parezca inútil hasta haber averiguado qué problema resolvía cuando se creó.',
  },
  {
    id: '4.4',
    bloque: '4',
    titulo: 'El lanzamiento imprudente que salió bien (Sesgo de Resultado)',
    escenario:
      'Un gestor de fondos ignora todos los controles de riesgo y concentra el 90 % del capital de sus clientes en una sola acción biotecnológica altamente especulativa antes de un ensayo clínico cuya probabilidad real de éxito era del 15 %. Contra todo pronóstico, el ensayo sale bien y el fondo gana un 300 %. Al mismo tiempo, otra gestora sigue un proceso riguroso con una inversión de valor esperado muy positivo (80 % de probabilidad de ganar), pero un terremoto imprevisto hace caer su posición un 10 %. Como comité de evaluación, ¿cómo juzgas a ambos?',
    opciones: [
      { id: 'A', texto: 'Ascender y dar el bono máximo al primer gestor por su visión ganadora, y despedir a la segunda por haber perdido dinero.' },
      { id: 'B', texto: 'Sancionar al primero por saltarse el control de riesgo en una apuesta de valor esperado negativo y respaldar a la segunda.' },
      { id: 'C', texto: 'Premiar a ambos por igual para no desmotivar al equipo.' },
      { id: 'D', texto: 'Copiar la estrategia del primer gestor para el próximo trimestre.' },
    ],
    opcionCorrecta: 'B',
    pista: 'Si alguien juega a la ruleta rusa por 1.000 € y no sale la bala, ¿ha tomado una buena decisión financiera porque ahora tiene 1.000 € más?',
    solucion:
      'Es el Sesgo de Resultado (Outcome Bias, documentado por Baron y Hershey y popularizado por Annie Duke como «resulting»): la tendencia humana a juzgar la calidad de una decisión por su desenlace final en lugar de por la información y las probabilidades disponibles en el instante de decidir. En entornos con azar, una decisión pésima puede tener un resultado brillante el 15 % de las veces, y una decisión óptima puede fallar el 20 % de las veces. Si premias al imprudente afortunado, garantizas que repita la apuesta hasta llevar la empresa a la ruina.',
    modeloMental:
      'Separación proceso-resultado: nunca evalúes la calidad de una decisión bajo incertidumbre por cómo cayó la moneda al final; audita la lógica y el riesgo en el momento de decidir.',
  },
  {
    id: 'ses-desplazamiento-intrinseco',
    bloque: '4',
    titulo: 'Cómo destruir un hábito pagando por él',
    escenario:
      'En las guarderías de Haifa (estudio real de Gneezy y Rustichini), algunos padres llegaban tarde a recoger a sus hijos porque se sentían culpables pero el tráfico los retrasaba. Para reducir los retrasos, la dirección implantó una multa económica de unos 3€ a todo padre que llegara más de 10 minutos tarde. Tres semanas después de poner la multa, ¿qué pasó con los retrasos, y qué pasó meses después cuando decidieron quitar la multa al ver el resultado?',
    opciones: [
      { id: 'A', texto: 'Los retrasos bajaron un 40% con la multa, y al quitarla volvieron a su nivel original.' },
      { id: 'B', texto: 'Los retrasos aumentaron con la multa y, al retirarla, no volvieron a bajar.' },
      { id: 'C', texto: 'La multa no tuvo ningún efecto porque 3€ era una cantidad demasiado pequeña.' },
    ],
    opcionCorrecta: 'B',
    pista: 'Antes de la multa, llegar tarde rompía un contrato social moral ("estoy fastidiando a la profesora"). ¿Qué tipo de contrato es cuando le pones una tarifa en euros?',
    solucion:
      'Es el desplazamiento de normas sociales por normas de mercado (Motivational Crowding-Out). Antes de la multa, la puntualidad estaba regulada por la culpa y la reciprocidad ética. En el momento en que pones un precio de 3€, destruyes el marco moral y lo sustituyes por una transacción mercantil limpia: "Por 3€ compro media hora extra de guardería sin sentirme culpable". Lo más llamativo es que, al retirar la multa, los retrasos siguieron altos durante el resto del estudio: la norma moral no volvió sola. Es un único estudio de unas semanas, así que «irreversible» sería exagerar, pero basta para no tratar las normas sociales como si se pudieran apagar y encender.',
    modeloMental:
      'Desplazamiento de Normas: Nunca introduzcas pequeños incentivos o multas económicas donde ya funciona una norma de honor o compromiso ético; transformarás un deber moral en una tarifa barata de mercado.',
  },
  {
    id: 'ses-proporcionalidad-causa',
    bloque: '4',
    titulo: 'Grandes desastres no exigen grandes conspiraciones',
    escenario:
      'Un sistema crítico que lleva 5 años funcionando sin fallos sufre de repente una caída catastrófica que paraliza tres plantas durante una semana entera y cuesta millones. En la reunión de crisis, la dirección rechaza el informe preliminar de ingeniería que apunta a un simple conector oxidado de 0,20€ mal encajado en un armario secundario, exigiendo buscar "un fallo estructural profundo en el diseño de la arquitectura o un sabotaje coordinado" acorde a la magnitud del desastre. ¿Qué sesgo cognitivo está bloqueando el diagnóstico?',
    opciones: [
      { id: 'A', texto: 'Pensamiento sistémico de causa raíz (los fallos grandes nunca tienen causas simples).' },
      { id: 'B', texto: 'Suponer que una consecuencia enorme tiene que tener una causa igual de grande o compleja.' },
      { id: 'C', texto: 'Sesgo retrospectivo: tras el desastre, todo parece haber sido previsible desde el principio.' },
    ],
    opcionCorrecta: 'B',
    pista: 'En un sistema complejo fuertemente acoplado (como una avalancha de nieve o una red eléctrica), ¿hace falta una bomba atómica para derrumbar la montaña o basta un copo en el punto crítico?',
    solucion:
      'Es el Sesgo de Proporcionalidad (estudiado por Leman y Cinnirella). Nuestro cerebro evolucionó en un entorno físico lineal (si una piedra te hace un chichón grande, alguien la lanzó con mucha fuerza). Nos produce una enorme disonancia cognitiva aceptar que un evento que cambia la historia o destruye millones de euros sea fruto de una banalidad ridícula (un tornillo flojo, un typo en una línea de configuración). En sistemas complejos no lineales, las causas diminutas producen efectos masivos constantemente; buscar "grandes culpables" para grandes efectos suele llevar a inventar fantasmas y no arreglar el conector.',
    modeloMental:
      'Sesgo de Proporcionalidad: En sistemas complejos acoplados, consecuencias gigantescas suelen nacer de causas triviales; no busques explicaciones aparatosas solo porque el daño haya sido enorme.',
  },
  {
    id: 'ses-maldicion-conocimiento',
    bloque: '4',
    titulo: 'El ritmo que solo suena en tu cabeza',
    escenario:
      'Redactas una especificación técnica o una instrucción operativa para un proveedor externo. Como tú llevas dos semanas dándole vueltas al problema, el documento de una página te parece meridianamente claro y sin ambigüedad posible. En el experimento clásico de Elizabeth Newton en Stanford, una persona tamborilea con los nudillos en la mesa el ritmo de "Cumpleaños Feliz" y cree que el oyente lo adivinará el 50% de las veces. ¿Qué porcentaje real de oyentes adivina la canción, y por qué?',
    opciones: [
      { id: 'A', texto: 'El 25 %, porque sin la melodía (notas agudas y graves) se pierde más o menos la mitad de la información.' },
      { id: 'B', texto: 'Apenas un 2,5 %: quien golpea oye la melodía en su cabeza y no puede imaginar oír sólo los golpes.' },
      { id: 'C', texto: 'El 40%, muy cerca de lo estimado cuando se trata de canciones universalmente conocidas.' },
    ],
    opcionCorrecta: 'B',
    pista: 'Intenta golpear una mesa pensando en una canción: tú oyes la letra y las notas en tu mente entre golpe y golpe. ¿Qué oye exactamente la persona que está enfrente?',
    solucion:
      'Es la Maldición del Conocimiento combinada con la Ilusión de Transparencia. Una vez que tu cerebro posee el contexto, el historial del problema y el modelo mental completo, te resulta cognitivamente imposible simular cómo lee ese mismo texto alguien que empieza en blanco. El "golpeador" oye la canción completa en su córtex auditivo y cree que sus nudillos la están transmitiendo; el "oyente" solo escucha un código Morse incomprensible. Siempre que diseñes un procedimiento o un prompt, asume que el receptor oye golpes secos a menos que explicites el contexto que tú das por obvio.',
    modeloMental:
      'Maldición del Conocimiento: Es imposible recordar cómo se veía un problema antes de entenderlo; lo que para ti es una instrucción cristalina, para quien no está en tu cabeza son golpes inconexos en una mesa.',
  },
  {
    id: 'ses-falacia-mcnamara',
    bloque: '4',
    titulo: 'Medir lo fácil y declarar que lo demás no existe',
    escenario:
      'Quieres evaluar la fiabilidad real de tres plantas o equipos. El indicador más fácil de extraer del ERP es el "tiempo de cierre de tickets en el sistema" (cuántas horas tardan en dar por cerrado un expediente). Lo conviertes en el KPI estrella del cuadro de mando. Al cabo de un año, el tiempo de cierre ha bajado de 10 días a 24 horas (todo en verde brillante), pero los clientes están furiosos porque las soluciones son parches superficiales que vuelven a romperse a la semana siguiente (algo difícil de medir en el ERP porque abren un ticket nuevo con otro código). ¿Cómo se llama esta patología de gestión?',
    opciones: [
      { id: 'A', texto: 'Medir sólo lo fácil de cuantificar y actuar como si lo que no aparece en el panel no existiera.' },
      { id: 'B', texto: 'Sesgo de disponibilidad: decidir con la información que primero viene a la cabeza, la del ERP.' },
      { id: 'C', texto: 'Paradoja de Simpson: al agregar los tickets de las tres plantas, la tendencia se invierte.' },
    ],
    opcionCorrecta: 'A',
    pista: 'Daniel Yankelovich la bautizó viendo cómo el Pentágono usaba el "recuento de bajas enemigas" en Vietnam para demostrar matemáticamente en Excel que estaban ganando una guerra que estaban perdiendo en el terreno.',
    solucion:
      'Es la Falacia de McNamara (hermana gemela de la Ley de Goodhart). Sigue cuatro pasos letales: 1) Medir lo que sea fácil de medir; 2) Descartar lo que es difícil de medir (la calidad real de la causa raíz, la fricción oculta, la confianza) dándole un valor arbitrario; 3) Presumir que lo que no se puede medir fácilmente no es importante; y 4) Asegurar que lo que no se puede medir directamente no existe. Es el suicidio de la dirección por cuadros de mando cuando se confunde el mapa numérico con el territorio físico.',
    modeloMental:
      'Falacia de McNamara: Que una variable crítica sea difícil de meter en una celda de Excel no la hace irrelevante; optimizar solo lo fácil de medir te hará ganar en el panel de control mientras pierdes en la realidad.',
  },
];

export function fuenteRetos(ahora: Date): Fuente {
  return nuevo(
    {
      titulo: 'Catálogo de Retos · Juegos, Incentivos, Paradojas y Sesgos',
      tipo: 'curso' as const,
      url: '',
      capitulos: BLOQUES_RETOS.map((b) => ({
        id: b.id,
        titulo: b.titulo,
        ejercicios: CATALOGO_RETOS.filter((r) => r.bloque === b.id && !r.debate).length,
      })),
    },
    ahora,
    ID_FUENTE_RETOS,
  );
}

/** Estado del último intento registrado para un reto del catálogo, o `null` si aún no se ha intentado. */
export function estadoDeReto(retoId: string, intentos: readonly Intento[]): EstadoIntento | null {
  const ultimos = ultimosIntentos(intentos.filter((i) => i.fuenteId === ID_FUENTE_RETOS));
  return ultimos.find((i) => i.ejercicio === retoId)?.estado ?? null;
}

export interface InspeccionReto {
  reto: Reto;
  intento: Intento;
  opcionElegida: string | null;
  logica: string;
  /** Siempre `false` en los retos de debate. */
  acertada: boolean;
}

export interface OpcionVisible extends OpcionReto {
  /** Letra que ve el usuario según la posición barajada; `id` es la letra con la que se guarda. */
  letra: string;
}

const LETRAS = ['A', 'B', 'C', 'D'] as const;

/* Orden barajado y fijo por reto: en el catálogo la correcta solía ser la B, y la posición no debe delatarla.
   Es determinista (semilla = id del reto) para que la revisión y el historial muestren siempre las mismas letras. */
export function opcionesVisibles(reto: Reto): OpcionVisible[] {
  let h = 2166136261;
  for (const c of reto.id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const azar = () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const orden = [...reto.opciones];
  for (let i = orden.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [orden[i], orden[j]] = [orden[j] as OpcionReto, orden[i] as OpcionReto];
  }
  return orden.map((o, i) => ({ ...o, letra: LETRAS[i] ?? o.id }));
}

/** Letra visible de una opción guardada, o `null` si no existe. */
export function letraVisible(reto: Reto, id: string | null): string | null {
  return opcionesVisibles(reto).find((o) => o.id === id)?.letra ?? null;
}

/* El estado lo deduce la app, no se declara después de ver la solución. Si la jugada fijada antes de la pista
   ya era la correcta, cuenta como «sin ayuda» aunque luego se abriera la pista. */
export function estadoAutomatico(reto: Reto, inicial: string, final: string, pistaVista: boolean): EstadoIntento {
  if (reto.debate) return pistaVista ? 'con_pista' : 'sin_ayuda';
  if (inicial === reto.opcionCorrecta) return 'sin_ayuda';
  return pistaVista && final === reto.opcionCorrecta ? 'con_pista' : 'solucion';
}

/** Intentos que cuentan en las métricas: fuera los de retos de debate, que no tienen acierto posible. */
export function intentosContables(intentos: readonly Intento[]): Intento[] {
  const debate = new Set(CATALOGO_RETOS.filter((r) => r.debate).map((r) => r.id));
  return intentos.filter((i) => !(i.fuenteId === ID_FUENTE_RETOS && debate.has(i.ejercicio)));
}

/**
 * Reconstruye el detalle completo de un reto ya respondido (escenario, opción elegida por el usuario,
 * opción óptima, si acertó o cayó en la trampa, explicación y regla mental) para el Modo Revisión.
 */
export function inspeccionarRetoCompletado(retoId: string, intentos: readonly Intento[]): InspeccionReto | null {
  const reto = CATALOGO_RETOS.find((r) => r.id === retoId);
  if (!reto) return null;
  const ultimos = ultimosIntentos(intentos.filter((i) => i.fuenteId === ID_FUENTE_RETOS));
  const intento = ultimos.find((i) => i.ejercicio === retoId);
  if (!intento) return null;

  const matchJugada = intento.notaError.match(/Jugada:\s*([A-D])/i);
  const opcionElegida = matchJugada?.[1]?.toUpperCase() ?? (intento.estado === 'sin_ayuda' ? reto.opcionCorrecta : null);
  const matchLogica = intento.notaError.match(/Lógica:\s*(.+)$/i);
  const logica = matchLogica?.[1]?.trim() ?? '';
  const acertada = !reto.debate && opcionElegida === reto.opcionCorrecta;

  return {
    reto,
    intento,
    opcionElegida,
    logica,
    acertada,
  };
}

/**
 * Devuelve el siguiente reto pendiente del catálogo (opcionalmente filtrado por bloque):
 * 1. Primero busca el primer reto que nunca se haya intentado.
 * 2. Si todos se han intentado, devuelve el primero cuyo último intento fue `no_resuelto` o `solucion`.
 * 3. Si todos están superados (`sin_ayuda` o `con_pista`), devuelve el primero del filtro para poder rejugarlo.
 */
export function siguienteRetoPendiente(intentos: readonly Intento[], bloqueFiltro?: string): Reto {
  const candidatos = bloqueFiltro && bloqueFiltro !== 'todos'
    ? CATALOGO_RETOS.filter((r) => r.bloque === bloqueFiltro)
    : CATALOGO_RETOS;
  const lista = candidatos.length > 0 ? candidatos : CATALOGO_RETOS;
  const ultimos = new Map<string, EstadoIntento>();
  for (const i of ultimosIntentos(intentos.filter((x) => x.fuenteId === ID_FUENTE_RETOS))) {
    ultimos.set(i.ejercicio, i.estado);
  }
  const sinIntentar = lista.find((r) => !ultimos.has(r.id));
  if (sinIntentar) return sinIntentar;
  const porReforzar = lista.find((r) => {
    const e = ultimos.get(r.id);
    return e === 'no_resuelto' || e === 'solucion';
  });
  return porReforzar ?? lista[0] ?? CATALOGO_RETOS[0];
}
