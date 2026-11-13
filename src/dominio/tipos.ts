/* Modelo de datos v3 (ver docs/arquitectura.md). Un cambio incompatible (quitar o renombrar un campo, cambiar su
   significado o añadir una colección) exige subir ESQUEMA_VERSION y añadir una migración en migraciones.ts. Un campo
   opcional nuevo no: los registros sin él siguen siendo válidos y una app anterior lo conserva al sincronizar. */

export const ESQUEMA_VERSION = 3;

/** Campos comunes: identidad estable entre dispositivos, fusión «gana el último» y borrado lógico. */
export interface Base {
  id: string;
  creado: string;
  actualizado: string;
  borrado: boolean;
}

export type Actividad = 'estudio' | 'lectura' | 'repaso' | 'calibracion' | 'concepto';

/** Lunes = 0 … domingo = 6, como `diaSemana` de src/lib/dia.ts. */
export type PlanSemanal = Record<0 | 1 | 2 | 3 | 4 | 5 | 6, Actividad[]>;

export interface Ajustes extends Base {
  planSemanal: PlanSemanal;
  horaCorte: number;
}

export interface Capitulo {
  id: string;
  titulo: string;
  ejercicios?: number;
}

export interface Fuente extends Base {
  titulo: string;
  tipo: 'libro' | 'curso' | 'otro';
  url: string;
  capitulos: Capitulo[];
}

export type EstadoIntento = 'sin_ayuda' | 'con_pista' | 'solucion' | 'no_resuelto';

export interface Intento extends Base {
  fuenteId: string;
  capitulo: string;
  ejercicio: string;
  estado: EstadoIntento;
  segundos: number;
  notaError: string;
  dia: string;
  tarjetaId?: string;
  /** Confianza declarada en la jugada inicial (0–1), antes de ver pista o solución. Alimenta la calibración. */
  confianza?: number;
}

export type EstadoLectura = 'pendiente' | 'leida' | 'escrita' | 'descartada';

export interface Lectura extends Base {
  url: string;
  titulo: string;
  medio: string;
  tema: string;
  estado: EstadoLectura;
  leidaEl?: string;
}

/** Tarjeta que propone el Abogado del Diablo; se edita antes de guardarla y entonces lleva el id de la tarjeta. */
export interface TarjetaPropuesta {
  pregunta: string;
  respuesta: string;
  tarjetaId?: string;
}

export type VeredictoReplica = 'concede' | 'matiza' | 'mantiene';

/** Un solo asalto: la réplica del usuario a la auditoría y la respuesta del Abogado del Diablo. */
export interface ReplicaIa {
  texto: string;
  veredicto: VeredictoReplica;
  respuesta: string;
  fecha: string;
}

export interface FeedbackIa {
  diagnostico: string;
  contraataque: string;
  modeloMentalSugerido: string;
  fecha: string;
  /** Desde el 2026-11-01; las auditorías anteriores no las traen. */
  tarjetas?: TarjetaPropuesta[];
  replica?: ReplicaIa;
}

export interface Escrito extends Base {
  lecturaId: string;
  resumen: string;
  objecion: string;
  palabras: number;
  enviadoEl: string;
  feedbackIa?: FeedbackIa;
}

/** Estado FSRS serializable: el `Card` de ts-fsrs con las fechas en ISO. */
export interface EstadoFsrs {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}

export interface Tarjeta extends Base {
  tipo: 'basica';
  anverso: string;
  reverso: string;
  origen?: { coleccion: Coleccion; id: string };
  fsrs: EstadoFsrs;
}

/** 1 = otra vez, 2 = difícil, 3 = bien, 4 = fácil (escala de FSRS). */
export type Nota = 1 | 2 | 3 | 4;

/** Registro inmutable de un repaso: nunca se edita, así que no entra en conflicto al sincronizar. */
export interface Repaso extends Base {
  tarjetaId: string;
  nota: Nota;
  repasadoEl: string;
  estadoPrevio: EstadoFsrs;
}

export type Resultado = 'si' | 'no' | 'anulada';

export interface Prediccion extends Base {
  enunciado: string;
  /** Probabilidad de «sí», entre 0 y 1. */
  probabilidad: number;
  venceEl: string;
  categoria: string;
  resolucion?: { resultado: Resultado; resueltaEl: string };
}

export interface Sesion extends Base {
  dia: string;
  actividad: Actividad;
  inicio: string;
  fin?: string;
  segundos: number;
}

export interface Aprendizaje extends Base {
  dia: string;
  texto: string;
  fuenteUrl?: string;
  tarjetaId?: string;
}

/** Tema de un reto: los bloques 1–4 del catálogo y la carrera por la AGI (5), que sólo tiene retos generados. */
export type TemaReto = '1' | '2' | '3' | '4' | '5';

export type LetraOpcion = 'A' | 'B' | 'C' | 'D';

/** Reto generado por IA (v2). Se juega igual que uno del catálogo: sus intentos van a `intentos` con `ejercicio = id`.
    Se guarda entero porque es contenido propio de la app, no externo. */
export interface RetoGenerado extends Base {
  tema: TemaReto;
  titulo: string;
  escenario: string;
  /** `porQue`: por qué la opción es buena o mala; se enseña al resolver. */
  opciones: { id: LetraOpcion; texto: string; porQue: string }[];
  /** `null` en los retos de debate (problemas abiertos sin respuesta correcta). */
  opcionCorrecta: LetraOpcion | null;
  pista: string;
  solucion: string;
  modeloMental: string;
  fuente: { titulo: string; url: string };
  /** Modelo de IA que lo generó y veredicto del revisor, para poder auditarlo. */
  modelo: string;
  revision: string;
  /** «Esto está mal»: el reto sale de las estadísticas y queda marcado con la nota del usuario. */
  reporte?: { nota: string; el: string };
}

/** Lo que devuelve /api/explorar: la IA responde a la hipótesis del usuario. Sólo fuentes que respondían al pedirlas. */
export interface ExploracionIa {
  acierta: string;
  falla: string;
  investigacion: string;
  fuentes: { titulo: string; url: string }[];
  modelo: string;
  fecha: string;
}

/**
 * Una pregunta propia (v3). Cuatro pasos: hipótesis (antes de mirar nada), exploración con IA, «lo que me llevo»
 * con tus palabras y, si quieres, tarjeta. El paso en que está se deduce de los campos; no hay estado «pendiente».
 */
export interface Curiosidad extends Base {
  pregunta: string;
  hipotesis: string;
  exploracion?: ExploracionIa;
  conclusion: string;
  tarjetaId?: string;
}

export interface Colecciones {
  ajustes: Ajustes[];
  fuentes: Fuente[];
  intentos: Intento[];
  lecturas: Lectura[];
  escritos: Escrito[];
  tarjetas: Tarjeta[];
  repasos: Repaso[];
  predicciones: Prediccion[];
  sesiones: Sesion[];
  aprendizajes: Aprendizaje[];
  retos: RetoGenerado[];
  curiosidades: Curiosidad[];
}

export type Coleccion = keyof Colecciones;

export const COLECCIONES: readonly Coleccion[] = [
  'ajustes', 'fuentes', 'intentos', 'lecturas', 'escritos', 'tarjetas', 'repasos', 'predicciones', 'sesiones', 'aprendizajes', 'retos',
  'curiosidades',
];

/** Colecciones que conoce cada versión del esquema. El servidor sólo envía a un dispositivo las de su versión: una app
    anterior que recibiera una colección sin tienda en IndexedDB fallaría al sincronizar. */
const COLECCIONES_POR_ESQUEMA: Readonly<Record<number, readonly Coleccion[]>> = {
  1: COLECCIONES.filter((c) => c !== 'retos' && c !== 'curiosidades'),
  2: COLECCIONES.filter((c) => c !== 'curiosidades'),
  3: COLECCIONES,
};

export function coleccionesDeEsquema(esquema: number): readonly Coleccion[] {
  if (esquema >= ESQUEMA_VERSION) return COLECCIONES;
  return COLECCIONES_POR_ESQUEMA[esquema] ?? COLECCIONES_POR_ESQUEMA[1] ?? [];
}

/** Forma de la exportación JSON y de los datos sobre los que trabajan las migraciones. */
export interface Exportacion {
  app: 'brain-gym';
  esquema: number;
  exportadoEl: string;
  datos: Colecciones;
}

export function coleccionesVacias(): Colecciones {
  return {
    ajustes: [], fuentes: [], intentos: [], lecturas: [], escritos: [],
    tarjetas: [], repasos: [], predicciones: [], sesiones: [], aprendizajes: [], retos: [], curiosidades: [],
  };
}
