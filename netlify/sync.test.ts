/* Fuera de netlify/functions: Netlify publicaría como función cualquier archivo de esa carpeta. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* Netlify Blobs en memoria, con etag y escritura condicional como el real. `interferir` simula que otro
   dispositivo escribe justo entre la lectura y la escritura. */
const blobs = vi.hoisted(() => {
  const m = { valor: undefined as unknown, etag: 0, interferir: 0 };
  const store = {
    async getWithMetadata() {
      return m.valor === undefined ? null : { data: structuredClone(m.valor), etag: String(m.etag), metadata: {} };
    },
    async setJSON(_k: string, v: unknown, o: { onlyIfMatch?: string; onlyIfNew?: boolean }) {
      if (m.interferir > 0) { m.interferir--; m.etag++; return { modified: false }; }
      if (o.onlyIfNew && m.valor !== undefined) return { modified: false };
      if (o.onlyIfMatch !== undefined && o.onlyIfMatch !== String(m.etag)) return { modified: false };
      m.valor = structuredClone(v); m.etag++;
      return { modified: true, etag: String(m.etag) };
    },
  };
  return { m, store };
});
vi.mock('@netlify/blobs', () => ({ getStore: () => blobs.store }));

const { default: handler } = await import('./functions/sync.mjs');
const TOKEN = 'k'.repeat(44);
const registro = { id: 'a', creado: 'x', actualizado: '2026-10-26T09:00:00.000Z', borrado: false };
const peticion = (cuerpo: unknown, token = TOKEN, method = 'POST') =>
  new Request('https://x/api/sync', { method, headers: { Authorization: `Bearer ${token}` }, ...(method === 'POST' ? { body: JSON.stringify(cuerpo) } : {}) });

beforeEach(() => {
  Object.assign(blobs.m, { valor: undefined, etag: 0, interferir: 0 });
  process.env.BG_TOKEN = TOKEN;
});

describe('/api/sync', () => {
  it('rechaza sin token o con token incorrecto', async () => {
    expect((await handler(peticion({ desde: 0, cambios: [] }, 'otro'))).status).toBe(401);
    expect((await handler(new Request('https://x/api/sync', { method: 'POST', body: '{}' }))).status).toBe(401);
  });

  it('rechaza si BG_TOKEN no está configurado o es corto', async () => {
    process.env.BG_TOKEN = 'corto';
    expect((await handler(peticion({ desde: 0, cambios: [] }, 'corto'))).status).toBe(401);
  });

  it('sólo admite POST y cuerpos bien formados', async () => {
    expect((await handler(peticion(null, TOKEN, 'GET'))).status).toBe(405);
    expect((await handler(peticion({ desde: 'x', cambios: [] }))).status).toBe(400);
    expect((await handler(peticion({ desde: 0, cambios: [{ coleccion: 'tarjetas', registro: {} }] }))).status).toBe(400);
    expect((await handler(peticion({ desde: 0, cambios: [], esquema: 'dos' }))).status).toBe(400);
    expect((await handler(peticion({ desde: 0, cambios: [], esquema: 2 }))).status).toBe(200);
  });

  it('guarda los cambios y los devuelve a otro dispositivo', async () => {
    const r1 = await handler(peticion({ desde: 0, cambios: [{ coleccion: 'tarjetas', registro }] }));
    expect(await r1.json()).toEqual({ seq: 1, cambios: [] });
    const r2 = await handler(peticion({ desde: 0, cambios: [] }));
    expect(await r2.json()).toEqual({ seq: 1, cambios: [{ coleccion: 'tarjetas', registro }] });
  });

  it('si otro dispositivo escribe a la vez, vuelve a leer y reintenta', async () => {
    blobs.m.interferir = 2;
    const r = await handler(peticion({ desde: 0, cambios: [{ coleccion: 'tarjetas', registro }] }));
    expect(r.status).toBe(200);
    expect(blobs.m.valor).toMatchObject({ seq: 1 });
  });

  it('tras demasiados conflictos responde 409 sin escribir', async () => {
    blobs.m.interferir = 99;
    const r = await handler(peticion({ desde: 0, cambios: [{ coleccion: 'tarjetas', registro }] }));
    expect(r.status).toBe(409);
    expect(blobs.m.valor).toBeUndefined();
  });
});
