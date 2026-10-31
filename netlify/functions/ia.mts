/* /api/ia: audita una síntesis 3x1 de lectura («Abogado del Diablo») llamando a OpenRouter.
   Protegida con BG_TOKEN en tiempo constante (timingSafeEqual), límite de entrada (3.000 caracteres) y salida (max_tokens: 1500). */
import type { Config } from '@netlify/functions';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  MAX_CARACTERES_IA,
  MODELO_IA_POR_DEFECTO,
  construirPayloadOpenRouter,
  extraerContenidoOpenRouter,
  parsearRespuestaIa,
  validarPeticionIa,
  type PeticionIa,
} from '../../src/dominio/ia';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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

  const apiKey = leerEnv('OPENROUTER_API_KEY');
  if (!apiKey) {
    return json({ error: 'Falta configurar OPENROUTER_API_KEY en el servidor de Netlify' }, 500);
  }
  // Se usa el modelo configurado tal cual: si el identificador no existe, OpenRouter lo dice y el error llega a la app.
  const model = leerEnv('OPENROUTER_MODEL') ?? MODELO_IA_POR_DEFECTO;

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(construirPayloadOpenRouter(model, peticion)),
    });
  } catch (e) {
    return json(
      { error: `Error de red al conectar con OpenRouter (modelo: ${model}): ${e instanceof Error ? e.message : 'fallo de conexión'}` },
      502,
    );
  }

  const cuerpoTexto = await res.text().catch(() => '');
  let cuerpoJson: unknown = null;
  if (cuerpoTexto) {
    try {
      cuerpoJson = JSON.parse(cuerpoTexto);
    } catch {
      /* no era JSON */
    }
  }

  if (!res.ok) {
    const extraido = cuerpoJson ? extraerContenidoOpenRouter(cuerpoJson) : null;
    const detalle = extraido?.errorDetalle || cuerpoTexto.slice(0, 240) || 'sin detalle adicional';
    return json(
      { error: `OpenRouter HTTP ${res.status} (modelo: ${model}): ${detalle}` },
      502,
    );
  }

  const { texto, finishReason, errorDetalle } = extraerContenidoOpenRouter(cuerpoJson);
  if (errorDetalle) {
    return json({ error: `OpenRouter error (modelo: ${model}): ${errorDetalle}` }, 502);
  }
  if (!texto) {
    return json(
      {
        error: `La respuesta del modelo llegó vacía desde OpenRouter (HTTP ${res.status}, modelo: ${model}, finish_reason: ${finishReason ?? 'sin indicar'}). Revisa si el ID de OPENROUTER_MODEL es válido.`,
      },
      502,
    );
  }

  try {
    const resultado = parsearRespuestaIa(texto);
    return json(resultado, 200);
  } catch (e) {
    return json(
      { error: `Error al procesar respuesta (modelo: ${model}): ${e instanceof Error ? e.message : 'formato inválido'}` },
      502,
    );
  }
};

export const config: Config = { path: '/api/ia' };

/* Comparación en tiempo constante sobre los resúmenes SHA-256, para no filtrar la longitud ni el contenido del token. */
function autorizado(cabecera: string | null): boolean {
  const esperado = leerEnv('BG_TOKEN');
  if (!esperado || esperado.length < 32 || !cabecera?.startsWith('Bearer ')) return false;
  const recibido = cabecera.slice(7).trim();
  const a = createHash('sha256').update(recibido).digest();
  const b = createHash('sha256').update(esperado).digest();
  return timingSafeEqual(a, b);
}

function leerEnv(clave: string): string | undefined {
  const netlifyEnv = (globalThis as { Netlify?: { env?: { get(k: string): string | undefined } } }).Netlify?.env;
  const valor = netlifyEnv?.get(clave) ?? process.env[clave];
  return valor?.trim() || undefined;
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
