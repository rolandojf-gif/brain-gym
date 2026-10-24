/* Modelo de datos v1 (ver docs/arquitectura.md). Cualquier cambio de forma exige subir ESQUEMA_VERSION
   y añadir una migración en migraciones.ts. */

export const ESQUEMA_VERSION = 1;

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

export interface FeedbackIa {
  diagnostico: string;
  contraataque: string;
  modeloMentalSugerido: string;
  fecha: string;
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
}

export type Coleccion = keyof Colecciones;

export const COLECCIONES: readonly Coleccion[] = [
  'ajustes', 'fuentes', 'intentos', 'lecturas', 'escritos', 'tarjetas', 'repasos', 'predicciones', 'sesiones', 'aprendizajes',
];

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
    tarjetas: [], repasos: [], predicciones: [], sesiones: [], aprendizajes: [],
  };
}
