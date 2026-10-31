/* /api/retos: genera un reto con IA sobre un tema. Un intento por petición: generar → validar → comprobar que la
   fuente responde → revisar con una segunda llamada. Si algo falla responde 422 con el motivo y la app vuelve a pedir
   más tarde (los retos se generan en segundo plano, así que no hace falta reintentar aquí y alargar la petición).
   Cada petición gasta como mucho dos llamadas del cupo diario de IA. */
import type { Config } from '@netlify/functions';
import { MODELO_IA_POR_DEFECTO } from '../../src/dominio/ia';
import {
  ErrorRetoIa,
  MAX_TOKENS_GENERAR,
  MAX_TOKENS_REVISAR,
  parsearRetoGenerado,
  parsearRevision,
  payloadGenerar,
  payloadRevisar,
  validarPeticionReto,
  type PeticionReto,
} from '../../src/dominio/retos-ia';
import { ErrorServidor, autorizado, consumirCupo, json, leerEnv, llamarOpenRouterConFin } from '../servidor';

const MAX_CUERPO = 8000;
const TIEMPO_FUENTE_MS = 6000;

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (!autorizado(req.headers.get('authorization'))) return json({ error: 'No autorizado' }, 401);

  let peticion: PeticionReto;
  try {
    const crudo = await req.text();
    if (crudo.length > MAX_CUERPO) return json({ error: 'Petición demasiado grande' }, 400);
    peticion = validarPeticionReto(JSON.parse(crudo));
  } catch (e) {
    return json({ error: e instanceof ErrorRetoIa ? e.message : 'Petición mal formada' }, 400);
  }

  const model = leerEnv('OPENROUTER_MODEL') ?? MODELO_IA_POR_DEFECTO;
  // Un revisor de otra familia de modelos detecta mejor los errores del generador; por defecto, el mismo.
  const revisor = leerEnv('OPENROUTER_MODEL_REVISOR') ?? model;
  try {
    if (!leerEnv('OPENROUTER_API_KEY')) throw new ErrorServidor(500, 'Falta configurar OPENROUTER_API_KEY en el servidor de Netlify');
    await consumirCupo();
    const generado = await llamarOpenRouterConFin(payloadGenerar(model, peticion));
    // Cortada por longitud, lo que llega puede ser el razonamiento del modelo y no el reto: no se intenta leer.
    if (generado.finishReason === 'length') return descartado('formato', `la respuesta de ${model} se cortó al llegar a ${MAX_TOKENS_GENERAR} tokens`);
    let reto;
    try {
      reto = parsearRetoGenerado(generado.texto, peticion.tema);
    } catch (e) {
      return descartado('formato', `${e instanceof Error ? e.message : 'formato inválido'} (modelo: ${model})`);
    }

    const fuente = await comprobarFuente(reto.fuente.url);
    if (!fuente.ok) return descartado('fuente', `la fuente no responde (${fuente.detalle}): ${reto.fuente.url}`);

    await consumirCupo();
    const respuestaRevisor = await llamarOpenRouterConFin(payloadRevisar(revisor, reto));
    if (respuestaRevisor.finishReason === 'length') return descartado('revisor', `la respuesta de ${revisor} se cortó al llegar a ${MAX_TOKENS_REVISAR} tokens`);
    const revision = parsearRevision(respuestaRevisor.texto);
    if (!revision.aprobado) return descartado('revisor', revision.motivo);

    return json({ reto: { ...reto, modelo: model, revision: revision.motivo } });
  } catch (e) {
    if (e instanceof ErrorServidor) return json({ error: e.message }, e.status);
    throw e;
  }
};

export const config: Config = { path: '/api/retos' };

function descartado(motivo: 'formato' | 'fuente' | 'revisor', detalle: string): Response {
  return json({ error: `Reto descartado (${motivo}): ${detalle}`, motivo }, 422);
}

/**
 * ¿La URL existe? Basta con que responda: 2xx/3xx, o 401/403/429 (existe pero bloquea a robots, como muchas revistas).
 * Un 404, un 410, un 5xx o un dominio que no resuelve la descartan. No se lee el cuerpo: sólo importa el código.
 */
async function comprobarFuente(url: string): Promise<{ ok: boolean; detalle: string }> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(TIEMPO_FUENTE_MS),
      headers: { 'User-Agent': 'BrainGym/1.0 (verificacion de fuentes)', Accept: 'text/html,application/xhtml+xml,*/*' },
    });
    await res.body?.cancel().catch(() => undefined);
    const ok = res.status < 400 || [401, 403, 429].includes(res.status);
    return { ok, detalle: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, detalle: e instanceof Error ? e.name : 'error de red' };
  }
}
