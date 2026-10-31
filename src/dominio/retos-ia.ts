/* Retos generados por IA: temas, prompts del generador y del revisor, y validación estricta de lo que devuelve el
   modelo. Puro: la red (OpenRouter, comprobación de la fuente) y el cupo diario viven en netlify/. */
import { extraerSubcadenaJson } from './ia';
import type { LetraOpcion, RetoGenerado, TemaReto } from './tipos';

/* Holgados a propósito: en los modelos que razonan antes de responder, el razonamiento también gasta de aquí, y una
   respuesta cortada se pierde entera. Con modelos «flash» el coste es despreciable. */
export const MAX_TOKENS_GENERAR = 4000;
export const MAX_TOKENS_REVISAR = 1200;
/** Tope de llamadas a la IA por día (UTC) entre todas las funciones: limita el gasto si algo entra en bucle. */
export const MAX_LLAMADAS_IA_DIA = 40;
/** Llamadas del cupo diario que los retos no pueden usar: quedan siempre para el Abogado del Diablo. */
export const RESERVA_ABOGADO = 10;
export const MAX_LLAMADAS_RETOS_DIA = MAX_LLAMADAS_IA_DIA - RESERVA_ABOGADO;
/** Con cuatro opciones, la correcta no puede ser mucho más larga que la distractora más larga: delataría la respuesta. */
export const RATIO_MAX_LONGITUD = 1.3;

export interface TemaIa {
  nombre: string;
  /** Qué cubre el tema, para orientar al generador. */
  enfoque: string;
}

export const TEMAS_IA: Readonly<Record<TemaReto, TemaIa>> = {
  '1': {
    nombre: 'Teoría de juegos',
    enfoque: 'equilibrios de Nash y subjuego perfecto, compromiso creíble, juegos repetidos, señalización, subastas, negociación, coordinación y nivel-k',
  },
  '2': {
    nombre: 'Incentivos perversos',
    enfoque: 'ley de Goodhart, efecto cobra, riesgo moral, selección adversa, problemas principal-agente, captura regulatoria y métricas que se corrompen',
  },
  '3': {
    nombre: 'Paradojas de decisión',
    enfoque: 'paradojas de la decisión y de la probabilidad (Simpson, Braess, Allais, Ellsberg, Parrondo, Jevons, dos sobres), precompromiso e inconsistencia temporal',
  },
  '4': {
    nombre: 'Psicología y sesgos',
    enfoque: 'sesgos cognitivos y heurísticos con evidencia sólida, juicio bajo incertidumbre, aversión a la pérdida, anclaje, sesgo de supervivencia y de resultado; evita efectos que no han replicado (priming social, agotamiento del ego) salvo para explicar que no replicaron',
  },
  '5': {
    nombre: 'Carrera por la AGI',
    enfoque: 'dinámicas de carrera entre laboratorios y Estados, dilemas de seguridad frente a velocidad, compromisos verificables, pausas unilaterales, carrera hacia el abismo (Armstrong, Bostrom y Shulman), gobernanza de cómputo, divulgación y asimetrías de información',
  },
};

export const TEMAS: readonly TemaReto[] = ['1', '2', '3', '4', '5'];

export function esTema(v: unknown): v is TemaReto {
  return typeof v === 'string' && (TEMAS as readonly string[]).includes(v);
}

export class ErrorRetoIa extends Error {
  override name = 'ErrorRetoIa';
}

/* ── Petición ─────────────────────────────────────────────────────────── */

export interface PeticionReto {
  tema: TemaReto;
  /** Títulos de retos ya vistos en ese tema, para no repetir concepto. */
  vistos: string[];
}

export const MAX_VISTOS = 60;

export function validarPeticionReto(entrada: unknown): PeticionReto {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) throw new ErrorRetoIa('La petición debe ser un objeto JSON.');
  const { tema, vistos } = entrada as Record<string, unknown>;
  if (!esTema(tema)) throw new ErrorRetoIa('Tema desconocido.');
  if (vistos !== undefined && !Array.isArray(vistos)) throw new ErrorRetoIa('«vistos» debe ser una lista.');
  const lista = (vistos ?? [])
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim().slice(0, 120))
    .filter(Boolean)
    .slice(-MAX_VISTOS);
  return { tema, vistos: lista };
}

/* ── Generador ────────────────────────────────────────────────────────── */

export const SYSTEM_PROMPT_GENERAR = `Diseñas retos de razonamiento para una persona curiosa y con formación, en castellano de España, sin paja ni adulación.

Un reto es una situación concreta y realista en la que la intuición inmediata lleva a una trampa y el modelo correcto lleva a otra respuesta. Reglas:
- Escenario de 60 a 130 palabras, con los datos necesarios para resolverlo y sin nombrar el concepto que se pone a prueba.
- Exactamente 4 opciones (A, B, C, D). Si hay una mejor respuesta según la literatura establecida, una sola es claramente la mejor y las otras tres son trampas plausibles: la intuitiva, la que suena sofisticada y una tercera razonable pero peor.
- Las cuatro opciones tienen longitud parecida (la correcta nunca es claramente la más larga), no repiten el nombre del concepto y no usan «siempre» o «nunca» como pista.
- Si la pregunta es un problema abierto sin consenso (por ejemplo, Newcomb), es un reto de debate: "opcionCorrecta": null, y cada opción es una postura defendible.
- "porQue" de cada opción: una o dos frases que expliquen por qué es buena o mala.
- "pista": orienta sin dar la respuesta (máx. 35 palabras).
- "solucion": explica el mecanismo y por qué la trampa engaña (80 a 160 palabras). Si hay matices o la evidencia es discutida, dilo.
- "modeloMental": una regla con formato «Nombre: regla accionable» (máx. 25 palabras).
- "fuente": una obra real y concreta que respalde la solución, con una URL pública que exista hoy: preferentemente es.wikipedia.org o en.wikipedia.org, plato.stanford.edu, arxiv.org, doi.org o la web oficial del autor. No inventes URLs: si no estás seguro de una URL exacta, usa la página de Wikipedia del concepto.
- Precisión antes que ingenio: no atribuyas cifras, fechas ni citas que no conozcas con seguridad.

Responde ÚNICAMENTE con un objeto JSON, sin markdown ni texto alrededor, con estas claves exactas:
{"titulo": "...", "escenario": "...", "opciones": [{"id": "A", "texto": "...", "porQue": "..."}, {"id": "B", ...}, {"id": "C", ...}, {"id": "D", ...}], "opcionCorrecta": "A" | "B" | "C" | "D" | null, "pista": "...", "solucion": "...", "modeloMental": "...", "fuente": {"titulo": "...", "url": "https://..."}}`;

export function mensajeGenerar(p: PeticionReto): string {
  const tema = TEMAS_IA[p.tema];
  return [
    `Tema: ${tema.nombre}.`,
    `Abarca: ${tema.enfoque}.`,
    p.vistos.length ? `No repitas el concepto central de estos retos ya vistos:\n- ${p.vistos.join('\n- ')}` : 'Aún no hay retos vistos en este tema.',
    'Genera un reto nuevo.',
  ].join('\n\n');
}

export function payloadGenerar(model: string, p: PeticionReto): Record<string, unknown> {
  return {
    model,
    max_tokens: MAX_TOKENS_GENERAR,
    temperature: 0.8,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_GENERAR },
      { role: 'user', content: mensajeGenerar(p) },
    ],
  };
}

/** Lo que valida el generador: un reto sin campos de registro ni de auditoría. */
export type RetoPropuesto = Omit<RetoGenerado, 'id' | 'creado' | 'actualizado' | 'borrado' | 'modelo' | 'revision' | 'reporte'>;

const LETRAS: readonly LetraOpcion[] = ['A', 'B', 'C', 'D'];

function texto(v: unknown, campo: string, max: number): string {
  if (typeof v !== 'string' || !v.trim()) throw new ErrorRetoIa(`Falta «${campo}».`);
  const t = v.trim();
  if (t.length > max) throw new ErrorRetoIa(`«${campo}» supera ${max} caracteres.`);
  return t;
}

/** URL de fuente aceptable a simple vista: https, con dominio (no IP ni localhost). Que exista lo comprueba el servidor. */
export function urlFuenteValida(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) return false;
  // IPv4 o IPv6 literales: la fuente debe ser un sitio público con nombre.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) return false;
  return true;
}

type Objeto = Record<string, unknown>;

const esObjeto = (v: unknown): v is Objeto => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Clave sin tildes, mayúsculas ni separadores: «porQue», «por_qué» y «PorQue» son la misma. */
const normalizar = (k: string): string => k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/* Nombres alternativos que usan los modelos aunque el prompt fije las claves. Tolerarlos cuesta poco; lo que importa
   (una sola respuesta defendible, una fuente real) lo comprueban la validación y el revisor. */
const ALIAS: Record<string, readonly string[]> = {
  titulo: ['titulo', 'title', 'nombre'],
  escenario: ['escenario', 'situacion', 'planteamiento', 'enunciado', 'contexto', 'caso', 'problema', 'scenario', 'pregunta'],
  opciones: ['opciones', 'options', 'alternativas', 'respuestas'],
  id: ['id', 'letra', 'letter'],
  texto: ['texto', 'text', 'opcion', 'descripcion', 'contenido'],
  porQue: ['porque', 'explicacion', 'justificacion', 'razon', 'motivo', 'why', 'explanation'],
  opcionCorrecta: ['opcioncorrecta', 'correcta', 'respuestacorrecta', 'correct', 'correctoption', 'answer', 'solucioncorrecta'],
  pista: ['pista', 'hint'],
  solucion: ['solucion', 'resolucion', 'solution', 'explicacionsolucion'],
  modeloMental: ['modelomental', 'regla', 'reglamental', 'mentalmodel'],
  fuente: ['fuente', 'source', 'referencia', 'reference'],
  url: ['url', 'enlace', 'link', 'href'],
};

/** Valor de un campo por su nombre o sus alias. Distingue «no está» (undefined) de un `null` explícito. */
function campo(o: Objeto, nombre: keyof typeof ALIAS): unknown {
  const buscados = ALIAS[nombre] ?? [normalizar(nombre)];
  for (const [k, v] of Object.entries(o)) if (buscados.includes(normalizar(k))) return v;
  return undefined;
}

/** Algunos modelos envuelven la respuesta: {"reto": {...}}. Si el objeto no trae el reto pero un hijo sí, se usa el hijo. */
function desenvolver(o: Objeto): Objeto {
  const traeReto = (x: Objeto) => campo(x, 'escenario') !== undefined || campo(x, 'opciones') !== undefined;
  if (traeReto(o)) return o;
  return Object.values(o).filter(esObjeto).find(traeReto) ?? o;
}

/** Valida y normaliza la salida del generador. Lanza ErrorRetoIa con el motivo si no sirve. */
export function validarRetoPropuesto(entrada: unknown, tema: TemaReto): RetoPropuesto {
  if (!esObjeto(entrada)) throw new ErrorRetoIa('El reto no es un objeto.');
  const r = desenvolver(entrada);
  try {
    return validarCampos(r, tema);
  } catch (e) {
    // Con las claves recibidas a la vista se sabe si el modelo renombró un campo o se quedó a medias.
    if (e instanceof ErrorRetoIa && e.message.startsWith('Falta')) {
      throw new ErrorRetoIa(`${e.message} Claves recibidas: ${Object.keys(r).join(', ') || 'ninguna'}.`);
    }
    throw e;
  }
}

function validarCampos(r: Objeto, tema: TemaReto): RetoPropuesto {
  const titulo = texto(campo(r, 'titulo'), 'titulo', 140);
  const escenario = texto(campo(r, 'escenario'), 'escenario', 1400);
  const lista = campo(r, 'opciones');
  if (!Array.isArray(lista) || lista.length !== 4) throw new ErrorRetoIa('Hacen falta exactamente 4 opciones.');
  // Sin ids, la posición decide la letra; con ids, deben ser A–D sin repetir (el orden da igual: la app baraja).
  const crudas = lista.map((o) => (esObjeto(o) ? o : {}));
  const ids = crudas.map((o) => campo(o, 'id'));
  const conId = ids.every((id) => id !== undefined);
  if (conId && new Set(ids.map((id) => String(id).trim().toUpperCase())).size !== 4) throw new ErrorRetoIa('Los ids de las opciones se repiten.');
  const opciones = crudas
    .map((op, i) => {
      const id = (conId ? String(ids[i]).trim().toUpperCase() : LETRAS[i]) as LetraOpcion;
      if (!LETRAS.includes(id)) throw new ErrorRetoIa('Los ids de las opciones deben ser A, B, C y D.');
      return { id, texto: texto(campo(op, 'texto'), `opción ${id}`, 400), porQue: texto(campo(op, 'porQue'), `porQue de ${id}`, 500) };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(opciones.map((o) => o.texto.toLowerCase())).size !== 4) throw new ErrorRetoIa('Hay opciones repetidas.');
  const crudaCorrecta = campo(r, 'opcionCorrecta');
  const correcta = typeof crudaCorrecta === 'string' ? crudaCorrecta.trim().toUpperCase() : (crudaCorrecta ?? null);
  if (correcta !== null && !LETRAS.includes(correcta as LetraOpcion)) throw new ErrorRetoIa('«opcionCorrecta» debe ser A, B, C, D o null.');
  const opcionCorrecta = correcta as LetraOpcion | null;
  if (opcionCorrecta) {
    const larga = opciones.find((o) => o.id === opcionCorrecta)?.texto.length ?? 0;
    const maxOtra = Math.max(...opciones.filter((o) => o.id !== opcionCorrecta).map((o) => o.texto.length));
    if (larga > RATIO_MAX_LONGITUD * maxOtra) throw new ErrorRetoIa('La opción correcta es mucho más larga que las demás: delataría la respuesta.');
  }
  const crudaFuente = campo(r, 'fuente');
  const f = esObjeto(crudaFuente) ? crudaFuente : {};
  const fuente = { titulo: texto(campo(f, 'titulo'), 'fuente.titulo', 200), url: texto(campo(f, 'url'), 'fuente.url', 500) };
  if (!urlFuenteValida(fuente.url)) throw new ErrorRetoIa('La URL de la fuente no es una dirección https pública.');
  return {
    tema,
    titulo,
    escenario,
    opciones,
    opcionCorrecta,
    pista: texto(campo(r, 'pista'), 'pista', 400),
    solucion: texto(campo(r, 'solucion'), 'solucion', 2000),
    modeloMental: texto(campo(r, 'modeloMental'), 'modeloMental', 300),
    fuente,
  };
}

/** Extrae el JSON del texto del modelo (tolera markdown alrededor) y lo valida. */
export function parsearRetoGenerado(textoModelo: string, tema: TemaReto): RetoPropuesto {
  const bloque = extraerSubcadenaJson(textoModelo);
  if (!bloque) throw new ErrorRetoIa('El modelo no devolvió JSON.');
  let datos: unknown;
  try {
    datos = JSON.parse(bloque);
  } catch {
    throw new ErrorRetoIa('El JSON del modelo no es válido.');
  }
  return validarRetoPropuesto(datos, tema);
}

/* ── Revisor ──────────────────────────────────────────────────────────── */

export const SYSTEM_PROMPT_REVISAR = `Eres un revisor exigente de retos de razonamiento. Recibes un reto en JSON y decides si se puede publicar.
Recházalo si ocurre cualquiera de estas cosas:
- Hay más de una opción defendible como la mejor (salvo que sea un reto de debate, con "opcionCorrecta": null).
- La opción marcada como correcta no lo es según la literatura establecida, o la solución contiene un error de hecho.
- El escenario es ambiguo o le faltan datos para resolverlo.
- Por lo que sabes, la fuente citada no respalda la solución o no es una obra real.
- Es un reto de debate sobre algo que sí tiene respuesta establecida, o al revés.
Sé breve. Responde ÚNICAMENTE con JSON: {"aprobado": true | false, "motivo": "una o dos frases"}`;

export function payloadRevisar(model: string, reto: RetoPropuesto): Record<string, unknown> {
  return {
    model,
    max_tokens: MAX_TOKENS_REVISAR,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_REVISAR },
      { role: 'user', content: JSON.stringify(reto) },
    ],
  };
}

export interface Revision {
  aprobado: boolean;
  motivo: string;
}

/** Ante una respuesta ilegible, rechaza: un reto sin revisar no se publica. */
export function parsearRevision(textoModelo: string): Revision {
  const bloque = extraerSubcadenaJson(textoModelo);
  if (!bloque) return { aprobado: false, motivo: 'El revisor no devolvió JSON.' };
  try {
    const r = JSON.parse(bloque) as Record<string, unknown>;
    const motivo = typeof r.motivo === 'string' && r.motivo.trim() ? r.motivo.trim().slice(0, 400) : 'Sin motivo.';
    return { aprobado: r.aprobado === true, motivo };
  } catch {
    return { aprobado: false, motivo: 'El JSON del revisor no es válido.' };
  }
}

/* ── Cupo diario ──────────────────────────────────────────────────────── */

export interface Cupo {
  dia: string;
  usadas: number;
}

/**
 * Reserva `n` llamadas del día `dia` (AAAA-MM-DD, UTC); con `n` negativo las devuelve (nunca por debajo de 0).
 * Devuelve el cupo nuevo o null si no caben.
 */
export function reservarCupo(actual: Cupo | null, dia: string, n = 1, max = MAX_LLAMADAS_IA_DIA): Cupo | null {
  const usadas = actual && actual.dia === dia ? actual.usadas : 0;
  return n > 0 && usadas + n > max ? null : { dia, usadas: Math.max(0, usadas + n) };
}
