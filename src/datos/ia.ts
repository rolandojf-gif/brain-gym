/* Cliente de la IA: el «Abogado del Diablo» (envía una síntesis 3x1 ya guardada a /api/ia y devuelve el dictamen
   estructurado, o la réplica del usuario a ese dictamen) y la exploración de curiosidades (/api/explorar). */
import { parsearExploracion, validarPeticionExplorar, type PeticionExplorar } from '../dominio/explorar';
import { parsearReplica, parsearRespuestaIa, validarPeticionIa, validarPeticionReplica, type PeticionIa, type PeticionReplica } from '../dominio/ia';
import type { ExploracionIa, FeedbackIa, ReplicaIa } from '../dominio/tipos';
import type { Almacen } from './almacen';

export class ErrorDeIa extends Error {
  override name = 'ErrorDeIa';
  constructor(
    public readonly motivo: 'sin-token' | 'token' | 'red' | 'servidor' | 'validacion',
    mensaje: string,
  ) {
    super(mensaje);
  }
}

export interface OpcionesIa {
  url?: string;
  fetch?: typeof globalThis.fetch;
  ahora?: Date;
}

export async function auditarConIa(almacen: Almacen, entrada: PeticionIa, opciones: OpcionesIa = {}): Promise<FeedbackIa> {
  let peticion: PeticionIa;
  try {
    peticion = validarPeticionIa(entrada);
  } catch (e) {
    throw new ErrorDeIa('validacion', e instanceof Error ? e.message : 'Datos de síntesis no válidos.');
  }
  const raw = await pedirIa(almacen, peticion, opciones);
  try {
    return { ...parsearRespuestaIa(raw), fecha: (opciones.ahora ?? new Date()).toISOString() };
  } catch (e) {
    throw new ErrorDeIa('servidor', e instanceof Error ? e.message : 'Respuesta de IA mal formada.');
  }
}

/** Un asalto más: la réplica del usuario a la auditoría. */
export async function replicarConIa(almacen: Almacen, entrada: PeticionReplica, opciones: OpcionesIa = {}): Promise<ReplicaIa> {
  let peticion: PeticionReplica;
  try {
    peticion = validarPeticionReplica(entrada);
  } catch (e) {
    throw new ErrorDeIa('validacion', e instanceof Error ? e.message : 'Réplica no válida.');
  }
  const raw = await pedirIa(almacen, peticion, opciones);
  try {
    return { texto: peticion.replica, ...parsearReplica(raw), fecha: (opciones.ahora ?? new Date()).toISOString() };
  } catch (e) {
    throw new ErrorDeIa('servidor', e instanceof Error ? e.message : 'Respuesta de IA mal formada.');
  }
}

/** Contrasta la hipótesis de una curiosidad. Las fuentes llegan ya comprobadas por el servidor. */
export async function explorarConIa(almacen: Almacen, entrada: PeticionExplorar, opciones: OpcionesIa = {}): Promise<ExploracionIa> {
  let peticion: PeticionExplorar;
  try {
    peticion = validarPeticionExplorar(entrada);
  } catch (e) {
    throw new ErrorDeIa('validacion', e instanceof Error ? e.message : 'Curiosidad no válida.');
  }
  const raw = await pedirIa(almacen, peticion, { url: '/api/explorar', ...opciones });
  try {
    const r = JSON.parse(raw) as { modelo?: unknown };
    return {
      ...parsearExploracion(raw),
      modelo: typeof r.modelo === 'string' ? r.modelo : '',
      fecha: (opciones.ahora ?? new Date()).toISOString(),
    };
  } catch (e) {
    throw new ErrorDeIa('servidor', e instanceof Error ? e.message : 'Respuesta de IA mal formada.');
  }
}

async function pedirIa(almacen: Almacen, cuerpo: unknown, { url = '/api/ia', fetch = globalThis.fetch }: OpcionesIa): Promise<string> {
  const token = await almacen.meta('token');
  if (!token) {
    throw new ErrorDeIa('sin-token', 'Configura primero la clave BG_TOKEN en Datos (menú «Más») para usar la IA.');
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorDeIa('red', `Sin conexión: no se pudo contactar con la IA (${url}).`);
  }

  if (res.status === 401) throw new ErrorDeIa('token', 'La clave BG_TOKEN no es válida.');
  if (!res.ok) {
    let detalle = `El servidor de IA respondió ${res.status}.`;
    try {
      const errJson = (await res.json()) as { error?: string };
      if (errJson.error) detalle = errJson.error;
    } catch { /* se usa el mensaje por defecto */ }
    throw new ErrorDeIa('servidor', detalle);
  }
  return res.text();
}
