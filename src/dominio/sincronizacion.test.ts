import { describe, expect, it } from 'vitest';
import { actualizar, borrar, nuevo } from './registro';
import { aplicarCambios, estadoVacio, fusionar, fusionarColeccion, ganador } from './sincronizacion';
import { COLECCIONES, coleccionesDeEsquema, coleccionesVacias, type Base } from './tipos';

type R = Base & { v: string };
const t = (min: number) => new Date(Date.UTC(2026, 9, 26, 9, min));
const r = (id: string, v: string, min = 0): R => nuevo({ v }, t(min), id);

describe('fusión de sincronización', () => {
  it('gana el cambio más reciente', () => {
    const a = r('x', 'viejo');
    const b = actualizar(a, { v: 'nuevo' }, t(5));
    expect(ganador(a, b).v).toBe('nuevo');
    expect(ganador(b, a).v).toBe('nuevo');
  });

  it('un borrado posterior gana a una edición anterior', () => {
    const a = r('x', 'a');
    const editado = actualizar(a, { v: 'b' }, t(1));
    const borrado = borrar(a, t(2));
    expect(fusionarColeccion([editado], [borrado])[0]?.borrado).toBe(true);
  });

  it('empate exacto: ambos lados eligen lo mismo', () => {
    const a = r('x', 'a', 3), b = r('x', 'b', 3);
    expect(ganador(a, b)).toBe(ganador(b, a));
  });

  it('es conmutativa, asociativa e idempotente', () => {
    const A = [r('1', 'a', 1), r('2', 'a', 5)];
    const B = [r('1', 'b', 2), r('3', 'b', 1)];
    const C = [r('2', 'c', 4), r('3', 'c', 3)];
    const f = fusionarColeccion<R>;
    expect(f(A, B)).toEqual(f(B, A));
    expect(f(f(A, B), C)).toEqual(f(A, f(B, C)));
    expect(f(f(A, B), B)).toEqual(f(A, B));
    expect(f(f(A, B), C).map((x) => `${x.id}${x.v}`)).toEqual(['1b', '2a', '3c']);
  });

  it('fusiona todas las colecciones', () => {
    const a = coleccionesVacias(), b = coleccionesVacias();
    const res = fusionar(a, b);
    expect(Object.values(res).every((l) => Array.isArray(l) && l.length === 0)).toBe(true);
  });
});

describe('servidor de sincronización', () => {
  const tarjeta = (id: string, v: string, min: number) => ({ coleccion: 'tarjetas' as const, registro: r(id, v, min) });

  it('el primer envío se guarda y no se devuelve al mismo dispositivo', () => {
    const { estado, respuesta, modificado } = aplicarCambios(estadoVacio(), { desde: 0, cambios: [tarjeta('a', 'mac', 1)] });
    expect(modificado).toBe(true);
    expect(estado.seq).toBe(1);
    expect(respuesta).toEqual({ seq: 1, cambios: [] });
  });

  it('otro dispositivo recibe lo que no tiene', () => {
    const e1 = aplicarCambios(estadoVacio(), { desde: 0, cambios: [tarjeta('a', 'mac', 1)] }).estado;
    const { respuesta } = aplicarCambios(e1, { desde: 0, cambios: [tarjeta('b', 'movil', 2)] });
    expect(respuesta.seq).toBe(2);
    expect(respuesta.cambios.map((c) => c.registro.id)).toEqual(['a']);
  });

  it('sólo devuelve lo posterior al cursor', () => {
    let e = aplicarCambios(estadoVacio(), { desde: 0, cambios: [tarjeta('a', 'x', 1)] }).estado;
    e = aplicarCambios(e, { desde: 1, cambios: [tarjeta('b', 'y', 2)] }).estado;
    expect(aplicarCambios(e, { desde: 1, cambios: [] }).respuesta.cambios.map((c) => c.registro.id)).toEqual(['b']);
    expect(aplicarCambios(e, { desde: 2, cambios: [] }).respuesta.cambios).toEqual([]);
  });

  it('un cambio más antiguo no pisa y el dispositivo recibe la versión ganadora', () => {
    const e = aplicarCambios(estadoVacio(), { desde: 0, cambios: [tarjeta('a', 'nuevo', 5)] }).estado;
    const { estado, respuesta, modificado } = aplicarCambios(e, { desde: 1, cambios: [tarjeta('a', 'viejo', 1)] });
    expect(modificado).toBe(false);
    expect((estado.registros.tarjetas?.a?.registro as R).v).toBe('nuevo');
    expect(respuesta.cambios.map((c) => (c.registro as R).v)).toEqual(['nuevo']);
  });

  it('reenviar lo mismo no cambia nada (idempotente)', () => {
    const e = aplicarCambios(estadoVacio(), { desde: 0, cambios: [tarjeta('a', 'x', 1)] }).estado;
    const otra = aplicarCambios(e, { desde: 1, cambios: [tarjeta('a', 'x', 1)] });
    expect(otra.modificado).toBe(false);
    expect(otra.respuesta.cambios).toEqual([]);
  });

  it('ignora colecciones desconocidas', () => {
    const { modificado } = aplicarCambios(estadoVacio(), { desde: 0, cambios: [{ coleccion: 'rara' as never, registro: r('a', 'x') }] });
    expect(modificado).toBe(false);
  });

  it('una app v1 (sin esquema) no recibe colecciones que no conoce; una v2 sí', () => {
    const conReto = aplicarCambios(estadoVacio(), {
      desde: 0,
      esquema: 2,
      cambios: [{ coleccion: 'retos', registro: r('g1', 'reto') }, { coleccion: 'tarjetas', registro: r('t1', 'tarjeta') }],
    }).estado;
    const v1 = aplicarCambios(conReto, { desde: 0, cambios: [] }).respuesta.cambios.map((c) => c.coleccion);
    expect(v1).toEqual(['tarjetas']);
    const v2 = aplicarCambios(conReto, { desde: 0, cambios: [], esquema: 2 }).respuesta.cambios.map((c) => c.coleccion).sort();
    expect(v2).toEqual(['retos', 'tarjetas']);
  });

  it('colecciones por esquema: v1 sin retos; actual o futura, todas', () => {
    expect(coleccionesDeEsquema(1)).not.toContain('retos');
    expect(coleccionesDeEsquema(1)).toHaveLength(COLECCIONES.length - 1);
    expect(coleccionesDeEsquema(2)).toEqual(COLECCIONES);
    expect(coleccionesDeEsquema(99)).toEqual(COLECCIONES);
  });
});
