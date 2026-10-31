import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { nuevaTarjeta } from '../dominio/fsrs';
import { actualizar, nuevo } from '../dominio/registro';
import { aplicarCambios, estadoVacio, type EstadoServidor, type PeticionSync } from '../dominio/sincronizacion';
import { ESQUEMA_VERSION, type RetoGenerado, type Tarjeta } from '../dominio/tipos';
import { Almacen } from './almacen';
import { ErrorDeSync, sincronizar } from './sincronizar';

const T0 = new Date('2026-10-26T09:00:00Z');
const abiertos: Almacen[] = [];
let n = 0;
async function abrir(nombre = `bg-test-${n++}`, ahora = T0): Promise<Almacen> {
  const a = await Almacen.abrir(nombre, ahora);
  abiertos.push(a);
  return a;
}
afterEach(() => abiertos.splice(0).forEach((a) => a.cerrar()));

/** Servidor en memoria con la misma lógica que la función de Netlify. */
function servidor() {
  let estado: EstadoServidor = estadoVacio();
  const fetch = (async (_url: string, init?: RequestInit) => {
    const r = aplicarCambios(estado, JSON.parse(String(init?.body)) as PeticionSync);
    estado = r.estado;
    return new Response(JSON.stringify(r.respuesta), { status: 200 });
  }) as typeof globalThis.fetch;
  return { fetch, estado: () => estado };
}

describe('Almacen', () => {
  it('la primera vez siembra ajustes, fuentes y las 12 lecturas semilla, y no los duplica al reabrir', async () => {
    const nombre = 'bg-siembra';
    const a = await abrir(nombre);
    expect(await a.leer('ajustes')).toHaveLength(1);
    expect((await a.leer('fuentes')).map((f) => f.id)).toEqual(['catalogo-retos']);
    const lecturas = await a.leer('lecturas');
    expect(lecturas).toHaveLength(12);
    expect(lecturas[0]?.titulo).toContain('Meditations on Moloch');
    expect(lecturas[11]?.titulo).toContain('Action Bias');
    a.cerrar();
    const b = await abrir(nombre);
    expect(await b.leer('fuentes')).toHaveLength(1);
    expect(await b.leer('lecturas')).toHaveLength(12);
    expect(await b.meta('esquema')).toBe(ESQUEMA_VERSION);
  });

  it('guardar apunta el cambio como pendiente y confirmar lo quita', async () => {
    const a = await abrir();
    const t = nuevaTarjeta('a', 'b', T0);
    await a.guardar({ coleccion: 'tarjetas', registro: t });
    const p = await a.pendientes();
    expect(p).toHaveLength(1);
    await a.confirmarEnviados(p);
    expect(await a.pendientes()).toHaveLength(0);
  });

  it('una edición durante el envío sigue pendiente', async () => {
    const a = await abrir();
    const t = nuevaTarjeta('a', 'b', T0);
    await a.guardar({ coleccion: 'tarjetas', registro: t });
    const enviados = await a.pendientes();
    await a.guardar({ coleccion: 'tarjetas', registro: actualizar(t, { reverso: 'c' }, new Date(T0.getTime() + 1000)) });
    await a.confirmarEnviados(enviados);
    expect(await a.pendientes()).toHaveLength(1);
  });

  it('exportar e importar (sustituir) conserva los datos', async () => {
    const a = await abrir();
    await a.guardar({ coleccion: 'tarjetas', registro: nuevaTarjeta('a', 'b', T0) });
    const exp = JSON.parse(JSON.stringify(await a.exportar(T0)));
    const b = await abrir();
    await b.importar(exp, 'sustituir', T0);
    expect(await b.leerTodo()).toEqual(await a.leerTodo());
    expect(await b.copiaPrevia()).toBeDefined();
  });

  it('importar fusionando conserva lo local y lo importado', async () => {
    const a = await abrir();
    await a.guardar({ coleccion: 'tarjetas', registro: nuevaTarjeta('de a', 'x', T0) });
    const b = await abrir();
    await b.guardar({ coleccion: 'tarjetas', registro: nuevaTarjeta('de b', 'y', T0) });
    await b.importar(await a.exportar(T0), 'fusionar', T0);
    expect((await b.leer('tarjetas')).map((t) => t.anverso).sort()).toEqual(['de a', 'de b']);
  });

  it('rechaza una importación inválida sin tocar los datos', async () => {
    const a = await abrir();
    await a.guardar({ coleccion: 'tarjetas', registro: nuevaTarjeta('a', 'b', T0) });
    await expect(a.importar({ app: 'otra' }, 'sustituir')).rejects.toThrow(/no es una exportación/);
    expect(await a.leer('tarjetas')).toHaveLength(1);
  });

  it('abre una base v1 (IndexedDB 1, esquema 1): crea la tienda de retos, conserva los datos y vuelve a pedir todo al servidor', async () => {
    const nombre = 'bg-v1';
    const v1 = ['ajustes', 'fuentes', 'intentos', 'lecturas', 'escritos', 'tarjetas', 'repasos', 'predicciones', 'sesiones', 'aprendizajes'];
    const db = await openDB(nombre, 1, {
      upgrade(d) {
        for (const c of v1) d.createObjectStore(c, { keyPath: 'id' });
        d.createObjectStore('meta');
        d.createObjectStore('pendientes');
      },
    });
    const tarjeta = nuevaTarjeta('de la v1', 'r', T0);
    await db.put('tarjetas', tarjeta);
    await db.put('meta', 1, 'esquema');
    await db.put('meta', 7, 'cursor');
    db.close();

    const a = await abrir(nombre);
    expect(await a.leer('retos')).toEqual([]);
    expect(await a.leer('tarjetas')).toEqual([tarjeta]);
    expect(await a.meta('esquema')).toBe(ESQUEMA_VERSION);
    expect(await a.meta('cursor')).toBe(0);
    expect((await a.copiaPrevia())?.esquema).toBe(1);
  });

  it('se niega a abrir datos de un esquema más nuevo', async () => {
    const nombre = 'bg-futuro';
    const a = await abrir(nombre);
    await a.ponerMeta('esquema', ESQUEMA_VERSION + 1);
    a.cerrar();
    await expect(Almacen.abrir(nombre)).rejects.toThrow(/más nueva/);
  });
});

describe('sincronizar', () => {
  it('sin token no intenta nada', async () => {
    const a = await abrir();
    await expect(sincronizar(a, { fetch: servidor().fetch })).rejects.toThrow(ErrorDeSync);
  });

  it('Mac y móvil acaban con los mismos datos', async () => {
    const srv = servidor();
    const mac = await abrir(), movil = await abrir('bg-movil', new Date(T0.getTime() + 60_000));
    for (const d of [mac, movil]) await d.ponerMeta('token', 'x'.repeat(40));

    await mac.guardar({ coleccion: 'tarjetas', registro: nuevaTarjeta('del mac', 'a', T0) });
    await movil.guardar({ coleccion: 'tarjetas', registro: nuevaTarjeta('del móvil', 'b', T0) });

    expect(await sincronizar(mac, { fetch: srv.fetch })).toEqual({ enviados: 1, recibidos: 0 });
    expect(await sincronizar(movil, { fetch: srv.fetch })).toMatchObject({ enviados: 1 });
    await sincronizar(mac, { fetch: srv.fetch });

    const nombres = async (d: Almacen) => (await d.leer('tarjetas')).map((t) => t.anverso).sort();
    expect(await nombres(mac)).toEqual(['del mac', 'del móvil']);
    expect(await nombres(movil)).toEqual(['del mac', 'del móvil']);
    expect(await mac.pendientes()).toHaveLength(0);
    // Ajustes, fuentes y lecturas semilla sembrados en los dos dispositivos se funden en uno sin duplicarse.
    expect(await mac.leer('fuentes')).toHaveLength(1);
    expect(await mac.leer('lecturas')).toHaveLength(12);
  });

  it('un reto generado en el Mac llega al móvil', async () => {
    const srv = servidor();
    const mac = await abrir(), movil = await abrir();
    for (const d of [mac, movil]) await d.ponerMeta('token', 'x'.repeat(40));
    const reto: RetoGenerado = nuevo({
      tema: '5', titulo: 'Pausa unilateral', escenario: 'e', opciones: [], opcionCorrecta: null, pista: 'p', solucion: 's',
      modeloMental: 'm', fuente: { titulo: 'f', url: 'https://example.org' }, modelo: 'x', revision: 'ok',
    }, T0);
    await mac.guardar({ coleccion: 'retos', registro: reto });
    await sincronizar(mac, { fetch: srv.fetch });
    await sincronizar(movil, { fetch: srv.fetch });
    expect(await movil.leer('retos')).toEqual([reto]);
  });

  it('una edición posterior en el móvil gana a la del Mac', async () => {
    const srv = servidor();
    const mac = await abrir(), movil = await abrir();
    for (const d of [mac, movil]) await d.ponerMeta('token', 'x'.repeat(40));
    const t = nuevaTarjeta('p', 'r', T0);
    await mac.guardar({ coleccion: 'tarjetas', registro: t });
    await sincronizar(mac, { fetch: srv.fetch });
    await sincronizar(movil, { fetch: srv.fetch });

    await mac.guardar({ coleccion: 'tarjetas', registro: actualizar(t, { reverso: 'mac' }, new Date(T0.getTime() + 1000)) });
    await movil.guardar({ coleccion: 'tarjetas', registro: actualizar(t, { reverso: 'móvil' }, new Date(T0.getTime() + 2000)) });
    await sincronizar(mac, { fetch: srv.fetch });
    await sincronizar(movil, { fetch: srv.fetch });
    await sincronizar(mac, { fetch: srv.fetch });

    const reverso = async (d: Almacen) => ((await d.leer('tarjetas')) as Tarjeta[])[0]?.reverso;
    expect(await reverso(mac)).toBe('móvil');
    expect(await reverso(movil)).toBe('móvil');
  });

  it('un fallo de red deja los cambios pendientes', async () => {
    const a = await abrir();
    await a.ponerMeta('token', 'x'.repeat(40));
    await a.guardar({ coleccion: 'tarjetas', registro: nuevaTarjeta('a', 'b', T0) });
    const caido = (async () => { throw new TypeError('offline'); }) as typeof globalThis.fetch;
    await expect(sincronizar(a, { fetch: caido })).rejects.toMatchObject({ motivo: 'red' });
    expect(await a.pendientes()).toHaveLength(1);
  });

  it('un 401 se distingue como clave inválida', async () => {
    const a = await abrir();
    await a.ponerMeta('token', 'mala');
    const f = (async () => new Response('{}', { status: 401 })) as typeof globalThis.fetch;
    await expect(sincronizar(a, { fetch: f })).rejects.toMatchObject({ motivo: 'token' });
  });
});
