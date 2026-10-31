/* Tests de /api/ia y del cliente auditarConIa (fuera de netlify/functions para que Netlify no lo publique como función). */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Almacen } from '../src/datos/almacen';
import { ErrorDeIa, auditarConIa } from '../src/datos/ia';
import { MAX_CARACTERES_IA, SYSTEM_PROMPT_ABOGADO_DIABLO } from '../src/dominio/ia';
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

const { default: handler } = await import('./functions/ia.mjs');

const TOKEN = 't'.repeat(44);
const cuerpoValido = {
  titulo: 'The Market for Lemons',
  medio: 'QJE',
  tema: 'Asimetría informativa',
  resumen: 'Tesis central: La asimetría de información expulsa los bienes de calidad.\n\nMecanismo / Incentivo: El comprador ofrece el precio medio.',
  objecion: 'Las garantías privadas eliminan el problema sin coste.',
};

const respuestaModelo = {
  diagnostico: 'Identificas el descuento por incertidumbre pero ignoras que el vendedor conoce el estado privado del activo.',
  contraataque: 'Una garantía sólo es creíble si el emisor sobrevive a largo plazo y verificar el defecto no induce riesgo moral del comprador.',
  modeloMentalSugerido: 'Fallo de garantía: Una promesa de reembolso no corrige la selección adversa si reclamar cuesta más que el defecto.',
};

const peticion = (cuerpo: unknown, token = TOKEN, method = 'POST') =>
  new Request('https://x/api/ia', {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) } : {}),
  });

beforeEach(() => {
  Object.assign(blobs.m, { valor: undefined, etag: 0 });
  process.env.BG_TOKEN = TOKEN;
  process.env.OPENROUTER_API_KEY = 'sk-or-test-key';
  process.env.OPENROUTER_MODEL = 'deepseek/deepseek-v4.1-flash-1017';
  vi.restoreAllMocks();
});

describe('/api/ia', () => {
  it('rechaza peticiones sin token o con token inválido en tiempo constante', async () => {
    expect((await handler(peticion(cuerpoValido, 'incorrecto'))).status).toBe(401);
    expect((await handler(new Request('https://x/api/ia', { method: 'POST', body: '{}' }))).status).toBe(401);
  });

  it('sólo admite POST y rechaza payloads mayores de 3.000 caracteres', async () => {
    expect((await handler(peticion(null, TOKEN, 'GET'))).status).toBe(405);
    const gigante = { ...cuerpoValido, resumen: 'x'.repeat(MAX_CARACTERES_IA + 10) };
    const r = await handler(peticion(gigante));
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ error: expect.stringMatching(/3000 caracteres/) });
  });

  it('envía max_tokens: 1500, temperature: 0.3, sin response_format en Claude, y soporta bloques de contenido', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: [{ type: 'text', text: `\`\`\`json\n${JSON.stringify(respuestaModelo)}\n\`\`\`` }],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const res = await handler(peticion(cuerpoValido));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(respuestaModelo);

    expect(spy).toHaveBeenCalledOnce();
    const [url, init] = spy.mock.calls[0] ?? [];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const enviado = JSON.parse(String(init?.body)) as {
      model: string;
      max_tokens: number;
      temperature: number;
      response_format?: unknown;
      messages: { role: string; content: string }[];
    };
    expect(enviado.model).toBe('deepseek/deepseek-v4.1-flash-1017');
    expect(enviado.max_tokens).toBe(1500);
    expect(enviado.temperature).toBe(0.3);
    expect(enviado.response_format).toBeUndefined();
    expect(enviado.messages[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT_ABOGADO_DIABLO });
  });

  it('incluye código HTTP, OPENROUTER_MODEL y mensaje real de OpenRouter cuando el proveedor devuelve error', async () => {
    process.env.OPENROUTER_MODEL = 'anthropic/modelo-inexistente-test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: 'anthropic/modelo-inexistente-test is not a valid model ID', code: 400 },
        }),
        { status: 400 },
      ),
    );

    const res = await handler(peticion(cuerpoValido));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('HTTP 400');
    expect(body.error).toContain('anthropic/modelo-inexistente-test');
    expect(body.error).toContain('is not a valid model ID');
  });

  it('descuenta del cupo diario compartido y responde 429 cuando se agota', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(respuestaModelo) } }] }), { status: 200 }),
    );
    expect((await handler(peticion(cuerpoValido))).status).toBe(200);
    expect(blobs.m.valor).toMatchObject({ usadas: 1 });

    blobs.m.valor = { dia: new Date().toISOString().slice(0, 10), usadas: MAX_LLAMADAS_IA_DIA };
    spy.mockClear();
    const res = await handler(peticion(cuerpoValido));
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: string }).error).toContain('Tope diario');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('cliente auditarConIa', () => {
  it('exige token en el almacén y devuelve FeedbackIa con fecha ISO', async () => {
    const almacen = await Almacen.abrir('bg-test-ia-1');
    try {
      await expect(auditarConIa(almacen, cuerpoValido)).rejects.toThrow(ErrorDeIa);
      await almacen.ponerMeta('token', TOKEN);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(respuestaModelo) } }],
          }),
          { status: 200 },
        ),
      );
      const ahora = new Date('2026-10-26T12:00:00.000Z');
      const fb = await auditarConIa(almacen, cuerpoValido, {
        fetch: (reqUrl, init) => handler(new Request(`https://x${String(reqUrl)}`, init)),
        ahora,
      });
      expect(fb).toEqual({
        ...respuestaModelo,
        fecha: '2026-10-26T12:00:00.000Z',
      });
    } finally {
      almacen.cerrar();
    }
  });
});
