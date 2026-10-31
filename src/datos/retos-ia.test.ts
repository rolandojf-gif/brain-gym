import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { nuevo } from '../dominio/registro';
import { coleccionesVacias, type Colecciones, type RetoGenerado, type TemaReto } from '../dominio/tipos';
import { Almacen, type GastoRetos } from './almacen';
import { MAX_DESCARTES_SEGUIDOS, MAX_DESCARTES_TEMA, MAX_PETICIONES_DIA, Reponedor, pedirReto, type MemoriaGasto, type ResultadoReto } from './retos-ia';

const T0 = new Date('2026-10-31T10:00:00Z');
let n = 0;
async function almacenCon(token?: string): Promise<Almacen> {
  const a = await Almacen.abrir(`bg-test-retos-ia-${n++}`);
  if (token) await a.ponerMeta('token', token);
  return a;
}

const propuesto = {
  titulo: 'La pausa que nadie firma',
  escenario: 'Dos laboratorios compiten por el mismo hito y cada uno puede pausar seis meses para auditar.',
  opciones: (['A', 'B', 'C', 'D'] as const).map((id) => ({ id, texto: `Opción ${id} de longitud parecida`, porQue: `Por qué ${id}` })),
  opcionCorrecta: 'A',
  pista: 'Piensa en la verificación.',
  solucion: 'Sin verificación, seguir domina.',
  modeloMental: 'Compromiso verificable: una promesa sólo cambia el juego si incumplirla se detecta.',
  fuente: { titulo: 'Carrera armamentista', url: 'https://es.wikipedia.org/wiki/Carrera_armamentista' },
};

const responder = (status: number, cuerpo: unknown) => vi.fn(async () => new Response(JSON.stringify(cuerpo), { status }));

describe('pedirReto', () => {
  it('sin clave no llama al servidor', async () => {
    const fetch = vi.fn();
    const r = await pedirReto(await almacenCon(), '5', [], { fetch });
    expect(r).toMatchObject({ tipo: 'parar', motivo: 'sin-token' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('envía tema, vistos y token, y devuelve un registro listo para guardar', async () => {
    const fetch = responder(200, { reto: { ...propuesto, tema: '1', modelo: 'gen/x', revision: 'Una sola defendible.' } });
    const r = await pedirReto(await almacenCon('tok'), '5', ['Otro'], { fetch, ahora: T0 });
    if (r.tipo !== 'ok') throw new Error(JSON.stringify(r));
    // El tema lo pone quien pide, no la respuesta.
    expect(r.reto).toMatchObject({ tema: '5', titulo: propuesto.titulo, modelo: 'gen/x', revision: 'Una sola defendible.', creado: T0.toISOString() });
    expect(r.reto.id).toBeTruthy();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/retos');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
    expect(JSON.parse(String(init.body))).toEqual({ tema: '5', vistos: ['Otro'] });
  });

  it.each([
    [422, { error: 'Reto descartado (fuente): 404', motivo: 'fuente' }, { tipo: 'descartado' }],
    [429, { error: 'Tope diario de 40 llamadas a la IA alcanzado. Vuelve mañana.' }, { tipo: 'parar', motivo: 'cupo' }],
    [401, { error: 'No autorizado' }, { tipo: 'parar', motivo: 'token' }],
    [500, { error: 'Falta configurar OPENROUTER_API_KEY en el servidor de Netlify' }, { tipo: 'parar', motivo: 'servidor', mensaje: expect.stringContaining('OPENROUTER_API_KEY') }],
    [200, { reto: { ...propuesto, opciones: propuesto.opciones.slice(0, 3) } }, { tipo: 'descartado' }],
  ])('responde %i → %j', async (status, cuerpo, esperado) => {
    expect(await pedirReto(await almacenCon('tok'), '1', [], { fetch: responder(status, cuerpo) })).toMatchObject(esperado);
  });

  it('sin red, para', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await pedirReto(await almacenCon('tok'), '1', [], { fetch })).toMatchObject({ tipo: 'parar', motivo: 'red' });
  });
});

describe('Reponedor', () => {
  const generado = (tema: TemaReto, k: number): RetoGenerado =>
    nuevo({ ...propuesto, opcionCorrecta: 'A' as const, tema, titulo: `G${tema}.${k}`, modelo: 'gen/x', revision: 'ok' }, new Date(T0.getTime() + k * 1000));

  /** Lo que el almacén guarda en `meta`: sobrevive a reabrir la app (un Reponedor nuevo). */
  function memoriaEnLocal(): MemoriaGasto & { valor?: GastoRetos } {
    const m: MemoriaGasto & { valor?: GastoRetos } = {
      leer: async () => m.valor,
      guardar: async (g) => {
        m.valor = g;
      },
    };
    return m;
  }

  function montar(
    respuestas: (tema: TemaReto) => ResultadoReto,
    reloj = () => T0.getTime(),
    { memoria = memoriaEnLocal(), guardarRetos = true } = {},
  ) {
    const datos: Colecciones = coleccionesVacias();
    const pedidos: TemaReto[] = [];
    let k = 0;
    const pedir = vi.fn(async (_a: Almacen, tema: TemaReto) => {
      pedidos.push(tema);
      return respuestas(tema);
    });
    const guardar = vi.fn(async (r: RetoGenerado) => {
      if (guardarRetos) datos.retos.push(r);
    });
    const abrir = () => new Reponedor({ almacen: {} as Almacen, leer: () => datos, guardar, pedir: pedir as never, reloj, gasto: memoria });
    return { reponedor: abrir(), abrir, memoria, datos, pedidos, guardar, siguiente: (tema: TemaReto) => generado(tema, k++) };
  }

  it('llena un reto por tema, de uno en uno, empezando por la carrera por la AGI', async () => {
    const m = montar((tema) => ({ tipo: 'ok', reto: m.siguiente(tema) }));
    await m.reponedor.reponer();
    expect(m.pedidos).toEqual(['5', '1', '2', '3', '4']);
    expect(m.datos.retos.map((r) => r.tema)).toEqual(['5', '1', '2', '3', '4']);
    expect(m.reponedor.estado).toContain('G4');
    // Con todo lleno no vuelve a pedir.
    await m.reponedor.reponer();
    expect(m.pedidos).toHaveLength(5);
  });

  it('avisa de cada cambio de estado: mientras pide y al terminar', async () => {
    const vistos: string[] = [];
    const datos: Colecciones = coleccionesVacias();
    let k = 0;
    const reponedor: Reponedor = new Reponedor({
      almacen: {} as Almacen,
      leer: () => datos,
      guardar: async (r) => { datos.retos.push(r); },
      pedir: (async (_a: Almacen, tema: TemaReto) => ({ tipo: 'ok', reto: generado(tema, k++) })) as never,
      reloj: () => T0.getTime(),
      gasto: memoriaEnLocal(),
      alCambiarEstado: () => vistos.push(reponedor.estado),
    });
    await reponedor.reponer();
    expect(vistos[0]).toBe('Pidiendo un reto de Carrera por la AGI…');
    expect(vistos[1]).toContain('Último reto generado');
    expect(vistos).toHaveLength(10);
  });

  it('dos llamadas a la vez comparten la misma reposición', async () => {
    const m = montar((tema) => ({ tipo: 'ok', reto: m.siguiente(tema) }));
    await Promise.all([m.reponedor.reponer(), m.reponedor.reponer()]);
    expect(m.pedidos).toHaveLength(5);
  });

  it(`un tema descartado ${MAX_DESCARTES_TEMA} veces se deja para otra sesión y los demás siguen`, async () => {
    const m = montar((tema) => (tema === '5' ? { tipo: 'descartado', mensaje: 'Reto descartado (revisor): B y C valen.' } : { tipo: 'ok', reto: m.siguiente(tema) }));
    await m.reponedor.reponer();
    expect(m.pedidos).toEqual(['5', '5', '1', '2', '3', '4']);
    expect(m.datos.retos.map((r) => r.tema)).toEqual(['1', '2', '3', '4']);
  });

  it(`tras ${MAX_DESCARTES_SEGUIDOS} descartes seguidos para hasta mañana (UTC), aunque se reabra la app`, async () => {
    let ahora = T0.getTime();
    let r: (tema: TemaReto) => ResultadoReto = () => ({ tipo: 'descartado', mensaje: 'Reto descartado (formato): Falta «escenario».' });
    const m = montar((tema) => r(tema), () => ahora);
    await m.reponedor.reponer();
    expect(m.pedidos).toEqual(['5', '5', '1']);
    expect(m.reponedor.estado).toContain('Falta «escenario»');
    expect(m.reponedor.estado).toContain('hasta mañana');
    // Reabrir la app no reinicia el tope: el estado (con el último motivo) se ve sin gastar nada.
    const reabierto = m.abrir();
    await reabierto.reponer();
    expect(m.pedidos).toHaveLength(3);
    expect(reabierto.estado).toContain('Falta «escenario»');
    // Al día siguiente vuelve a intentarlo.
    ahora = Date.UTC(2026, 10, 1, 0, 0, 1);
    r = (tema) => ({ tipo: 'ok', reto: m.siguiente(tema) });
    await m.abrir().reponer();
    expect(m.datos.retos).toHaveLength(5);
  });

  it(`no pasa de ${MAX_PETICIONES_DIA} peticiones al día por dispositivo, aunque se reabra la app`, async () => {
    let ahora = T0.getTime();
    // Retos que no llegan a guardarse: el tema sigue vacío y el reponedor querría pedir sin fin.
    const m = montar((tema) => ({ tipo: 'ok', reto: m.siguiente(tema) }), () => ahora, { guardarRetos: false });
    await m.reponedor.reponer();
    expect(m.pedidos).toHaveLength(MAX_PETICIONES_DIA);
    await m.abrir().reponer();
    expect(m.pedidos).toHaveLength(MAX_PETICIONES_DIA);
    expect(m.memoria.valor).toMatchObject({ dia: '2026-10-31', peticiones: MAX_PETICIONES_DIA, descartesSeguidos: 0 });
    ahora = Date.UTC(2026, 10, 1, 9, 0, 0);
    await m.abrir().reponer();
    expect(m.pedidos).toHaveLength(2 * MAX_PETICIONES_DIA);
  });

  it('un reto generado reinicia la cuenta de descartes seguidos', async () => {
    // 5: descarte y generado; 1: dos descartes (se salta); 2, 3 y 4: generados. Sin el reinicio, serían tres seguidos.
    const resultados: (ResultadoReto | null)[] = [{ tipo: 'descartado', mensaje: 'revisor' }, null, { tipo: 'descartado', mensaje: 'revisor' }, { tipo: 'descartado', mensaje: 'revisor' }];
    const m = montar((tema) => resultados.shift() ?? { tipo: 'ok', reto: m.siguiente(tema) });
    await m.reponedor.reponer();
    expect(m.pedidos).toEqual(['5', '5', '1', '1', '2', '3', '4']);
    expect(m.memoria.valor).toMatchObject({ peticiones: 7, descartesSeguidos: 0 });
  });

  it('con el cupo agotado espera al día siguiente (UTC)', async () => {
    let ahora = T0.getTime();
    let agotado = true;
    const m = montar((tema) => (agotado ? { tipo: 'parar', motivo: 'cupo', mensaje: 'Tope diario' } : { tipo: 'ok', reto: m.siguiente(tema) }), () => ahora);
    await m.reponedor.reponer();
    expect(m.pedidos).toEqual(['5']);
    agotado = false;
    await m.reponedor.reponer();
    expect(m.pedidos).toEqual(['5']);
    ahora = Date.UTC(2026, 10, 1, 0, 0, 1);
    await m.reponedor.reponer();
    expect(m.pedidos).toHaveLength(6);
  });

  it('sin red lo vuelve a intentar en la próxima ocasión; con el servidor roto, no hasta reiniciar', async () => {
    let r: ResultadoReto = { tipo: 'parar', motivo: 'red', mensaje: 'Sin conexión' };
    const m = montar(() => r);
    await m.reponedor.reponer();
    await m.reponedor.reponer();
    expect(m.pedidos).toEqual(['5', '5']);
    r = { tipo: 'parar', motivo: 'servidor', mensaje: 'Falta configurar OPENROUTER_API_KEY' };
    await m.reponedor.reponer();
    await m.reponedor.reponer();
    expect(m.pedidos).toHaveLength(3);
    expect(m.reponedor.estado).toContain('OPENROUTER_API_KEY');
    m.reponedor.reiniciar();
    await m.reponedor.reponer();
    expect(m.pedidos).toHaveLength(4);
  });

  it('lo que no llega al modelo (sin clave, sin red, cupo) no gasta peticiones del día', async () => {
    let conClave = false;
    const m = montar((tema) => (conClave ? { tipo: 'ok', reto: m.siguiente(tema) } : { tipo: 'parar', motivo: 'sin-token', mensaje: 'Sin clave' }));
    for (let i = 0; i < MAX_PETICIONES_DIA + 2; i++) await m.reponedor.reponer();
    expect(m.memoria.valor).toBeUndefined();
    conClave = true;
    await m.reponedor.reponer();
    expect(m.datos.retos).toHaveLength(5);
  });
});
