/* Cliente de sincronización: envía los cambios pendientes a /api/sync y aplica los que llegan. */
import type { PeticionSync, RespuestaSync } from '../dominio/sincronizacion';
import type { Almacen } from './almacen';

export class ErrorDeSync extends Error {
  override name = 'ErrorDeSync';
  constructor(public readonly motivo: 'sin-token' | 'token' | 'red' | 'servidor', mensaje: string) {
    super(mensaje);
  }
}

export interface Opciones {
  url?: string;
  fetch?: typeof globalThis.fetch;
}

export async function sincronizar(almacen: Almacen, { url = '/api/sync', fetch = globalThis.fetch }: Opciones = {}): Promise<{ enviados: number; recibidos: number }> {
  const token = await almacen.meta('token');
  if (!token) throw new ErrorDeSync('sin-token', 'Falta la clave de sincronización de este dispositivo.');
  const cambios = await almacen.pendientes();
  const peticion: PeticionSync = { desde: (await almacen.meta('cursor')) ?? 0, cambios };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(peticion),
    });
  } catch {
    throw new ErrorDeSync('red', 'Sin conexión: los cambios se enviarán más tarde.');
  }
  if (res.status === 401) throw new ErrorDeSync('token', 'La clave de sincronización no es válida.');
  if (!res.ok) throw new ErrorDeSync('servidor', `El servidor de sincronización respondió ${res.status}.`);

  const respuesta = (await res.json()) as RespuestaSync;
  const recibidos = await almacen.aplicarRemotos(respuesta.cambios);
  await almacen.confirmarEnviados(cambios);
  await almacen.ponerMeta('cursor', respuesta.seq);
  return { enviados: cambios.length, recibidos };
}
