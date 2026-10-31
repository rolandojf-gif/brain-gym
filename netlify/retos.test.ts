/* Tests de /api/retos (fuera de netlify/functions: Netlify publicaría como función cualquier archivo de esa carpeta). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_LLAMADAS_IA_DIA, SYSTEM_PROMPT_GENERAR, SYSTEM_PROMPT_REVISAR } from '../src/dominio/retos-ia';

/* Netlify Blobs en memoria (para el cupo), con escritura condicional como el real. */
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

const { default: handler } = await import('./functions/retos.mjs');
const TOKEN = 't'.repeat(44);
const FUENTE = 'https://es.wikipedia.org/wiki/Carrera_armamentista';

const reto = {
  titulo: 'La pausa que nadie firma',
  escenario: 'Dos laboratorios compiten por el mismo hito. Cada uno puede pausar seis meses para auditar o seguir.',
  opciones: ['A', 'B', 'C', 'D'].map((id, i) => ({ id, texto: `Opción ${id} con una longitud parecida ${i}`, porQue: `Por qué ${id}` })),
  opcionCorrecta: 'B',
  pista: 'Piensa en la verificación.',
  solucion: 'Sin verificación, seguir domina.',
  modeloMental: 'Compromiso verificable: una promesa sólo cambia el juego si incumplirla se detecta.',
  fuente: { titulo: 'Carrera armamentista', url: FUENTE },
};

const respuestaModelo = (texto: string) => new Response(JSON.stringify({ choices: [{ message: { content: texto } }] }), { status: 200 });

/** fetch simulado: OpenRouter responde en orden con `modelo`; la fuente, con `estadoFuente`. */
function simular(modelo: string[], estadoFuente: number | 'red' = 200) {
  const cola = [...modelo];
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (String(url).startsWith('https://openrouter.ai/')) return respuestaModelo(cola.shift() ?? '');
    if (estadoFuente === 'red') throw new TypeError('fetch failed');
    return new Response('<html></html>', { status: estadoFuente });
  });
}

const peticion = (cuerpo: unknown, token = TOKEN, method = 'POST') =>
  new Request('https://x/api/retos', {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(cuerpo) } : {}),
  });

const llamadasOpenRouter = (spy: ReturnType<typeof simular>) =>
  spy.mock.calls.filter(([u]) => String(u).startsWith('https://openrouter.ai/')).map(([, init]) => JSON.parse(String(init?.body)) as { model: string; messages: { content: string }[] });

beforeEach(() => {
  Object.assign(blobs.m, { valor: undefined, etag: 0 });
  process.env.BG_TOKEN = TOKEN;
  process.env.OPENROUTER_API_KEY = 'sk-or-test';
  process.env.OPENROUTER_MODEL = 'generador/x';
  delete process.env.OPENROUTER_MODEL_REVISOR;
  vi.restoreAllMocks();
});

describe('/api/retos', () => {
  it('exige token, POST y un tema válido', async () => {
    expect((await handler(peticion({ tema: '1' }, 'otro'))).status).toBe(401);
    expect((await handler(peticion(null, TOKEN, 'GET'))).status).toBe(405);
    expect((await handler(peticion({ tema: '9' }))).status).toBe(400);
  });

  it('genera, comprueba la fuente, revisa y devuelve el reto con modelo y veredicto', async () => {
    process.env.OPENROUTER_MODEL_REVISOR = 'revisor/y';
    const spy = simular([`\`\`\`json\n${JSON.stringify(reto)}\n\`\`\``, '{"aprobado": true, "motivo": "Una sola opción defendible."}']);
    const res = await handler(peticion({ tema: '5', vistos: ['Otro reto'] }));
    expect(res.status).toBe(200);
    const { reto: r } = (await res.json()) as { reto: Record<string, unknown> };
    expect(r).toMatchObject({ tema: '5', titulo: reto.titulo, opcionCorrecta: 'B', modelo: 'generador/x', revision: 'Una sola opción defendible.' });

    const [gen, rev] = llamadasOpenRouter(spy);
    expect(gen?.model).toBe('generador/x');
    expect(gen?.messages[0]?.content).toBe(SYSTEM_PROMPT_GENERAR);
    expect(gen?.messages[1]?.content).toContain('Otro reto');
    expect(rev?.model).toBe('revisor/y');
    expect(rev?.messages[0]?.content).toBe(SYSTEM_PROMPT_REVISAR);
    expect(spy.mock.calls.some(([u]) => String(u) === FUENTE)).toBe(true);
    expect(blobs.m.valor).toMatchObject({ usadas: 2 });
  });

  it('descarta un reto mal formado sin gastar la llamada del revisor', async () => {
    const spy = simular([JSON.stringify({ ...reto, opciones: reto.opciones.slice(0, 3) })]);
    const res = await handler(peticion({ tema: '1' }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ motivo: 'formato' });
    expect(llamadasOpenRouter(spy)).toHaveLength(1);
    expect(blobs.m.valor).toMatchObject({ usadas: 1 });
  });

  it.each([[404], [410], [500], ['red' as const]])('descarta si la fuente responde %s', async (estado) => {
    const spy = simular([JSON.stringify(reto)], estado);
    const res = await handler(peticion({ tema: '1' }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ motivo: 'fuente' });
    expect(llamadasOpenRouter(spy)).toHaveLength(1);
  });

  it('acepta una fuente que existe pero bloquea a robots (403)', async () => {
    simular([JSON.stringify(reto), '{"aprobado": true, "motivo": "ok"}'], 403);
    expect((await handler(peticion({ tema: '1' }))).status).toBe(200);
  });

  it('descarta lo que rechaza el revisor, con su motivo', async () => {
    simular([JSON.stringify(reto), '{"aprobado": false, "motivo": "B y C son defendibles."}']);
    const res = await handler(peticion({ tema: '2' }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ motivo: 'revisor', error: expect.stringContaining('B y C son defendibles.') });
  });

  it('con el cupo diario agotado responde 429 sin llamar a OpenRouter', async () => {
    blobs.m.valor = { dia: new Date().toISOString().slice(0, 10), usadas: MAX_LLAMADAS_IA_DIA };
    const spy = simular([JSON.stringify(reto)]);
    const res = await handler(peticion({ tema: '1' }));
    expect(res.status).toBe(429);
    expect(llamadasOpenRouter(spy)).toHaveLength(0);
  });

  it('sin OPENROUTER_API_KEY responde 500 sin gastar cupo', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const res = await handler(peticion({ tema: '1' }));
    expect(res.status).toBe(500);
    expect(blobs.m.valor).toBeUndefined();
  });
});
