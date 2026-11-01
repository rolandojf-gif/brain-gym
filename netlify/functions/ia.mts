/* /api/ia: audita una síntesis 3x1 de lectura («Abogado del Diablo») llamando a OpenRouter, o responde a la réplica del lector.
   Protegida con BG_TOKEN en tiempo constante, límite de entrada (3.000 caracteres) y salida (MAX_TOKENS_IA), y
   descuenta una llamada del cupo diario de IA. */
import type { Config } from '@netlify/functions';
import {
  MAX_CARACTERES_REPLICA,
  MAX_TOKENS_IA,
  MODELO_IA_POR_DEFECTO,
  construirPayloadOpenRouter,
  construirPayloadReplica,
  parsearReplica,
  parsearRespuestaIa,
  validarPeticionIa,
  validarPeticionReplica,
} from '../../src/dominio/ia';
import { ErrorServidor, autorizado, json, leerEnv, llamarConCupo } from '../servidor';

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (!autorizado(req.headers.get('authorization'))) return json({ error: 'No autorizado' }, 401);

  let textoCrudo: string;
  try {
    textoCrudo = await req.text();
  } catch {
    return json({ error: 'No se pudo leer la petición' }, 400);
  }

  if (textoCrudo.length > MAX_CARACTERES_REPLICA) {
    return json({ error: `El payload supera el límite de ${MAX_CARACTERES_REPLICA} caracteres` }, 400);
  }

  // Con `replica`, es un asalto más sobre una auditoría ya hecha; sin ella, la auditoría (límite propio de 3.000).
  let payload: (model: string) => Record<string, unknown>;
  let parsear: (texto: string) => unknown;
  let que: string;
  try {
    const crudo: unknown = JSON.parse(textoCrudo);
    if (typeof crudo === 'object' && crudo !== null && 'replica' in crudo) {
      const p = validarPeticionReplica(crudo);
      payload = (m) => construirPayloadReplica(m, p);
      parsear = parsearReplica;
      que = 'La respuesta a tu réplica';
    } else {
      const p = validarPeticionIa(crudo);
      payload = (m) => construirPayloadOpenRouter(m, p);
      parsear = parsearRespuestaIa;
      que = 'La auditoría';
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Petición mal formada' }, 400);
  }

  // Se usa el modelo configurado tal cual: si el identificador no existe, OpenRouter lo dice y el error llega a la app.
  const model = leerEnv('OPENROUTER_MODEL') ?? MODELO_IA_POR_DEFECTO;
  try {
    if (!leerEnv('OPENROUTER_API_KEY')) throw new ErrorServidor(500, 'Falta configurar OPENROUTER_API_KEY en el servidor de Netlify');
    const { texto, finishReason } = await llamarConCupo(payload(model));
    // Cortada, lo que llega puede ser medio JSON o el razonamiento: mejor un error claro que una auditoría rota.
    if (finishReason === 'length') {
      return json({ error: `${que} de ${model} se cortó al llegar a ${MAX_TOKENS_IA} tokens. Vuelve a intentarlo.` }, 502);
    }
    try {
      return json(parsear(texto), 200);
    } catch (e) {
      return json({ error: `Error al procesar respuesta (modelo: ${model}): ${e instanceof Error ? e.message : 'formato inválido'}` }, 502);
    }
  } catch (e) {
    if (e instanceof ErrorServidor) return json({ error: e.message }, e.status);
    throw e;
  }
};

export const config: Config = { path: '/api/ia' };
