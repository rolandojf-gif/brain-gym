/* /api/sync: recibe los cambios de un dispositivo, los fusiona con lo guardado en Netlify Blobs y devuelve lo que
   ese dispositivo aún no tiene. Protegida con el token de BG_TOKEN. */
import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import { createHash, timingSafeEqual } from 'node:crypto';
import { aplicarCambios, estadoVacio, type EstadoServidor, type PeticionSync } from '../../src/dominio/sincronizacion';

const CLAVE = 'estado';
const REINTENTOS = 5;

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (!autorizado(req.headers.get('authorization'))) return json({ error: 'No autorizado' }, 401);

  let peticion: PeticionSync;
  try {
    peticion = validar(await req.json());
  } catch {
    return json({ error: 'Petición mal formada' }, 400);
  }

  const store = getStore({ name: 'brain-gym', consistency: 'strong' });
  // Escritura condicional: si otro dispositivo ha escrito entre la lectura y la escritura, se vuelve a empezar.
  for (let i = 0; i < REINTENTOS; i++) {
    const guardado = await store.getWithMetadata(CLAVE, { type: 'json' });
    const estado = (guardado?.data as EstadoServidor | undefined) ?? estadoVacio();
    const { estado: nuevo, respuesta, modificado } = aplicarCambios(estado, peticion);
    if (!modificado) return json(respuesta);
    const escrito = guardado?.etag
      ? await store.setJSON(CLAVE, nuevo, { onlyIfMatch: guardado.etag })
      : await store.setJSON(CLAVE, nuevo, { onlyIfNew: true });
    if (escrito.modified) return json(respuesta);
  }
  return json({ error: 'Conflicto persistente; vuelve a intentarlo' }, 409);
};

export const config: Config = { path: '/api/sync' };

/* Comparación en tiempo constante sobre los resúmenes SHA-256, para no filtrar la longitud ni el contenido del token. */
function autorizado(cabecera: string | null): boolean {
  const esperado = process.env.BG_TOKEN;
  if (!esperado || esperado.length < 32 || !cabecera?.startsWith('Bearer ')) return false;
  const a = createHash('sha256').update(cabecera.slice(7)).digest();
  const b = createHash('sha256').update(esperado).digest();
  return timingSafeEqual(a, b);
}

function validar(v: unknown): PeticionSync {
  const p = v as Partial<PeticionSync> | null;
  if (!p || typeof p.desde !== 'number' || !Array.isArray(p.cambios)) throw new Error('forma');
  for (const c of p.cambios) {
    if (typeof c?.coleccion !== 'string' || typeof c.registro?.id !== 'string' || typeof c.registro.actualizado !== 'string') throw new Error('cambio');
  }
  return p as PeticionSync;
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
