/* Cliente del «Abogado del Diablo (IA)»: envía una síntesis 3x1 ya guardada a /api/ia y devuelve el dictamen estructurado. */
import { parsearRespuestaIa, validarPeticionIa, type PeticionIa } from '../dominio/ia';
import type { FeedbackIa } from '../dominio/tipos';
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

export async function auditarConIa(
  almacen: Almacen,
  entrada: PeticionIa,
  { url = '/api/ia', fetch = globalThis.fetch, ahora = new Date() }: OpcionesIa = {},
): Promise<FeedbackIa> {
  const token = await almacen.meta('token');
  if (!token) {
    throw new ErrorDeIa('sin-token', 'Configura primero la clave BG_TOKEN en la pestaña Datos para usar el Abogado del Diablo.');
  }

  let peticion: PeticionIa;
  try {
    peticion = validarPeticionIa(entrada);
  } catch (e) {
    throw new ErrorDeIa('validacion', e instanceof Error ? e.message : 'Datos de síntesis no válidos.');
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(peticion),
    });
  } catch {
    throw new ErrorDeIa('red', 'Sin conexión: no se pudo contactar con el Abogado del Diablo (/api/ia).');
  }

  if (res.status === 401) {
    throw new ErrorDeIa('token', 'La clave BG_TOKEN no es válida.');
  }
  if (!res.ok) {
    let detalle = `El servidor de IA respondió ${res.status}.`;
    try {
      const errJson = (await res.json()) as { error?: string };
      if (errJson.error) detalle = errJson.error;
    } catch { /* se usa el mensaje por defecto */ }
    throw new ErrorDeIa('servidor', detalle);
  }

  try {
    const raw = await res.text();
    const parsed = parsearRespuestaIa(raw);
    return {
      ...parsed,
      fecha: ahora.toISOString(),
    };
  } catch (e) {
    throw new ErrorDeIa('servidor', e instanceof Error ? e.message : 'Respuesta de IA mal formada.');
  }
}
