/* Tests de /api/explorar y del cliente explorarConIa (fuera de netlify/functions para que Netlify no lo publique). */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Almacen } from '../src/datos/almacen';
import { ErrorDeIa, explorarConIa } from '../src/datos/ia';
import { MAX_LLAMADAS_IA_DIA } from '../src/dominio/retos-ia';

/* Netlify Blobs en memoria para el cupo diario de IA, con escritura condicional como el real. */
const blobs = vi.hoisted(() => {
  const m = { valor: undefined as unknown, etag: 0 };
  const store = {
    async getWithMetadata() {
      return m.valor === undefined ? null : { data: structuredClone(m.valor), etag: String(m.etag), metadata: {} };
    },
    async setJSON(_k: string, v: unknown, o: { onlyIfMatch?: string; onlyIfNew?: boolean }) {
      if (o.onlyIfNew && m.valor !== undefined) return { modified: false };
      if (o.onlyIfMatch !== undefined && o.onlyIfMatch !== String(m.etag)) return { modified: false };
      m.valor = structuredClone(v);
      m.etag++;
      return { modified: true, etag: String(m.etag) };
    },
  };
  return { m, store };
});
vi.mock('@netlify/blobs', () => ({ getStore: () => blobs.store }));

const { default: handler } = await import('./functions/explorar.mjs');

const TOKEN = 't'.repeat(44);
const cuerpo = { pregunta: '¿Por qué los laboratorios de IA no pactan ir más despacio?', hipotesis: 'Porque el que frena pierde la carrera.' };
const BUENA = 'https://link.springer.com/article/10.1007/s00146-015-0590-y';
const INVENTADA = 'https://ejemplo.org/no-existe';
const respuestaModelo = {
  acierta: 'Es un dilema del prisionero: frenar sólo conviene si el otro también frena.',
  falla: 'Falta la verificación: sin poder comprobar al otro, el pacto no es creíble.',
  investigacion: 'Armstrong, Bostrom y Shulman (2016) modelan la carrera hacia la IA como un juego.',
  fuentes: [
    { titulo: 'Racing to the Precipice', url: BUENA },
    { titulo: 'Inventada', url: INVENTADA },
  ],
};

const peticion = (c: unknown, token = TOKEN, method = 'POST') =>
  new Request('https://x/api/explorar', {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(c) } : {}),
  });

/** OpenRouter responde con el modelo; las fuentes, según la URL. */
function simularRed(contenido: unknown = respuestaModelo, finish = 'stop') {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (entrada) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    if (url.includes('openrouter.ai')) {
      return new Response(JSON.stringify({ choices: [{ finish_reason: finish, message: { content: typeof contenido === 'string' ? contenido : JSON.stringify(contenido) } }] }), { status: 200 });
    }
    return new Response('', { status: url === BUENA ? 200 : 404 });
  });
}

beforeEach(() => {
  Object.assign(blobs.m, { valor: undefined, etag: 0 });
  process.env.BG_TOKEN = TOKEN;
  process.env.OPENROUTER_API_KEY = 'sk-or-test-key';
  process.env.OPENROUTER_MODEL = 'deepseek/deepseek-v4.1-flash-1017';
  vi.restoreAllMocks();
});

describe('/api/explorar', () => {
  it('exige token, POST y una hipótesis', async () => {
    expect((await handler(peticion(cuerpo, 'incorrecto'))).status).toBe(401);
    expect((await handler(peticion(null, TOKEN, 'GET'))).status).toBe(405);
    const sinHipotesis = await handler(peticion({ ...cuerpo, hipotesis: '' }));
    expect(sinHipotesis.status).toBe(400);
    expect(((await sinHipotesis.json()) as { error: string }).error).toMatch(/hipótesis/);
  });

  it('devuelve la exploración sólo con las fuentes que responden', async () => {
    const spy = simularRed();
    const res = await handler(peticion(cuerpo));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { fuentes: { url: string }[]; descartadas: number; modelo: string; acierta: string };
    expect(body.acierta).toBe(respuestaModelo.acierta);
    expect(body.fuentes.map((f) => f.url)).toEqual([BUENA]);
    expect(body.descartadas).toBe(1);
    expect(body.modelo).toBe('deepseek/deepseek-v4.1-flash-1017');
    // La pregunta y la hipótesis llegan al modelo.
    const enviado = JSON.parse(String((spy.mock.calls[0]?.[1] as RequestInit).body)) as { messages: { content: string }[] };
    expect(enviado.messages[1]?.content).toContain(cuerpo.hipotesis);
    expect(blobs.m.valor).toMatchObject({ usadas: 1 });
  });

  it('una respuesta cortada o sin formato responde 502 sin enseñar el borrador', async () => {
    simularRed('Pensemos: la carrera…', 'length');
    const cortada = await handler(peticion(cuerpo));
    expect(cortada.status).toBe(502);
    expect(((await cortada.json()) as { error: string }).error).toContain('se cortó');

    vi.restoreAllMocks();
    simularRed('Pensemos: la carrera…');
    const rota = await handler(peticion(cuerpo));
    expect(rota.status).toBe(502);
    expect(((await rota.json()) as { error: string }).error).not.toContain('Pensemos');
  });

  it('gasta del cupo diario general y responde 429 al agotarse', async () => {
    const spy = simularRed();
    blobs.m.valor = { dia: new Date().toISOString().slice(0, 10), usadas: MAX_LLAMADAS_IA_DIA };
    const res = await handler(peticion(cuerpo));
    expect(res.status).toBe(429);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('explorarConIa', () => {
  let n = 0;
  const abrir = () => Almacen.abrir(`bg-explorar-${n++}`);

  it('sin clave en el dispositivo avisa de que hay que configurarla', async () => {
    const a = await abrir();
    await expect(explorarConIa(a, cuerpo)).rejects.toMatchObject({ motivo: 'sin-token' });
  });

  it('valida antes de llamar y devuelve la exploración con modelo y fecha', async () => {
    const a = await abrir();
    await a.ponerMeta('token', TOKEN);
    await expect(explorarConIa(a, { ...cuerpo, hipotesis: ' ' })).rejects.toBeInstanceOf(ErrorDeIa);
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ...respuestaModelo, fuentes: [respuestaModelo.fuentes[0]], modelo: 'm' }), { status: 200 }));
    const x = await explorarConIa(a, cuerpo, { fetch, ahora: new Date('2026-11-13T18:00:00Z') });
    expect(fetch).toHaveBeenCalledWith('/api/explorar', expect.objectContaining({ method: 'POST' }));
    expect(x).toMatchObject({ acierta: respuestaModelo.acierta, modelo: 'm', fecha: '2026-11-13T18:00:00.000Z', fuentes: [{ url: BUENA }] });
  });
});
