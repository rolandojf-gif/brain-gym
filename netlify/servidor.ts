/* Piezas compartidas por las funciones de IA: token, variables de entorno, llamada a OpenRouter y cupo diario.
   Vive fuera de netlify/functions porque Netlify publicaría como función cualquier archivo de esa carpeta. */
import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { extraerContenidoOpenRouter } from '../src/dominio/ia';
import { MAX_LLAMADAS_IA_DIA, reservarCupo, type Cupo } from '../src/dominio/retos-ia';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const CLAVE_CUPO = 'cupo-ia';

export function leerEnv(clave: string): string | undefined {
  const netlifyEnv = (globalThis as { Netlify?: { env?: { get(k: string): string | undefined } } }).Netlify?.env;
  const valor = netlifyEnv?.get(clave) ?? process.env[clave];
  return valor?.trim() || undefined;
}

/* Comparación en tiempo constante sobre los resúmenes SHA-256, para no filtrar la longitud ni el contenido del token. */
export function autorizado(cabecera: string | null): boolean {
  const esperado = leerEnv('BG_TOKEN');
  if (!esperado || esperado.length < 32 || !cabecera?.startsWith('Bearer ')) return false;
  const recibido = cabecera.slice(7).trim();
  const a = createHash('sha256').update(recibido).digest();
  const b = createHash('sha256').update(esperado).digest();
  return timingSafeEqual(a, b);
}

export function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Error con el código HTTP que debe devolver la función. */
export class ErrorServidor extends Error {
  override name = 'ErrorServidor';
  constructor(public readonly status: number, mensaje: string) {
    super(mensaje);
  }
}

/** Llama a OpenRouter y devuelve el texto de la respuesta. Los errores llevan el código, el modelo y el detalle real. */
export async function llamarOpenRouter(payload: Record<string, unknown>): Promise<string> {
  return (await llamarOpenRouterConFin(payload)).texto;
}

/**
 * Como `llamarOpenRouter`, pero con el `finish_reason`: «length» significa que la respuesta se cortó por max_tokens
 * (y el texto puede ser el razonamiento del modelo, no la respuesta).
 */
export async function llamarOpenRouterConFin(payload: Record<string, unknown>): Promise<{ texto: string; finishReason?: string }> {
  const apiKey = leerEnv('OPENROUTER_API_KEY');
  if (!apiKey) throw new ErrorServidor(500, 'Falta configurar OPENROUTER_API_KEY en el servidor de Netlify');
  const model = String(payload.model);

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new ErrorServidor(502, `Error de red al conectar con OpenRouter (modelo: ${model}): ${e instanceof Error ? e.message : 'fallo de conexión'}`);
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
    const detalle = (cuerpoJson ? extraerContenidoOpenRouter(cuerpoJson).errorDetalle : '') || cuerpoTexto.slice(0, 240) || 'sin detalle adicional';
    throw new ErrorServidor(502, `OpenRouter HTTP ${res.status} (modelo: ${model}): ${detalle}`);
  }
  const { texto, finishReason, errorDetalle } = extraerContenidoOpenRouter(cuerpoJson);
  if (errorDetalle) throw new ErrorServidor(502, `OpenRouter error (modelo: ${model}): ${errorDetalle}`);
  if (!texto) {
    throw new ErrorServidor(
      502,
      `La respuesta del modelo llegó vacía desde OpenRouter (HTTP ${res.status}, modelo: ${model}, finish_reason: ${finishReason ?? 'sin indicar'}). Revisa si el ID de OPENROUTER_MODEL es válido.`,
    );
  }
  return { texto, ...(finishReason ? { finishReason } : {}) };
}

/**
 * Reserva `n` llamadas a la IA del cupo diario (UTC), compartido por todas las funciones. Escritura condicional en
 * Netlify Blobs para que dos peticiones simultáneas no cuenten de menos. Lanza 429 si no caben.
 */
export async function consumirCupo(n = 1, ahora = new Date()): Promise<void> {
  const store = getStore({ name: 'brain-gym', consistency: 'strong' });
  const dia = ahora.toISOString().slice(0, 10);
  for (let i = 0; i < 5; i++) {
    const guardado = await store.getWithMetadata(CLAVE_CUPO, { type: 'json' });
    const nuevo = reservarCupo((guardado?.data as Cupo | undefined) ?? null, dia, n);
    if (!nuevo) throw new ErrorServidor(429, `Tope diario de ${MAX_LLAMADAS_IA_DIA} llamadas a la IA alcanzado. Vuelve mañana.`);
    const escrito = guardado?.etag
      ? await store.setJSON(CLAVE_CUPO, nuevo, { onlyIfMatch: guardado.etag })
      : await store.setJSON(CLAVE_CUPO, nuevo, { onlyIfNew: true });
    if (escrito.modified) return;
  }
  throw new ErrorServidor(409, 'No se pudo reservar el cupo de IA; vuelve a intentarlo.');
}
