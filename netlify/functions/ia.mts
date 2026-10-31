/* /api/ia: audita una síntesis 3x1 de lectura («Abogado del Diablo») llamando a OpenRouter.
   Protegida con BG_TOKEN en tiempo constante, límite de entrada (3.000 caracteres) y salida (max_tokens: 1500), y
   descuenta una llamada del cupo diario de IA. */
import type { Config } from '@netlify/functions';
import {
  MAX_CARACTERES_IA,
  MODELO_IA_POR_DEFECTO,
  construirPayloadOpenRouter,
  parsearRespuestaIa,
  validarPeticionIa,
  type PeticionIa,
} from '../../src/dominio/ia';
import { ErrorServidor, autorizado, consumirCupo, json, leerEnv, llamarOpenRouter } from '../servidor';

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (!autorizado(req.headers.get('authorization'))) return json({ error: 'No autorizado' }, 401);

  let textoCrudo: string;
  try {
    textoCrudo = await req.text();
  } catch {
    return json({ error: 'No se pudo leer la petición' }, 400);
  }

  if (textoCrudo.length > MAX_CARACTERES_IA) {
    return json({ error: `El payload supera el límite de ${MAX_CARACTERES_IA} caracteres` }, 400);
  }

  let peticion: PeticionIa;
  try {
    peticion = validarPeticionIa(JSON.parse(textoCrudo));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Petición mal formada' }, 400);
  }

  // Se usa el modelo configurado tal cual: si el identificador no existe, OpenRouter lo dice y el error llega a la app.
  const model = leerEnv('OPENROUTER_MODEL') ?? MODELO_IA_POR_DEFECTO;
  try {
    if (!leerEnv('OPENROUTER_API_KEY')) throw new ErrorServidor(500, 'Falta configurar OPENROUTER_API_KEY en el servidor de Netlify');
    await consumirCupo();
    const texto = await llamarOpenRouter(construirPayloadOpenRouter(model, peticion));
    try {
      return json(parsearRespuestaIa(texto), 200);
    } catch (e) {
      return json({ error: `Error al procesar respuesta (modelo: ${model}): ${e instanceof Error ? e.message : 'formato inválido'}` }, 502);
    }
  } catch (e) {
    if (e instanceof ErrorServidor) return json({ error: e.message }, e.status);
    throw e;
  }
};

export const config: Config = { path: '/api/ia' };
