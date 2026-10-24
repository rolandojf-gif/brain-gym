import { describe, expect, it } from 'vitest';
import { actualizar, borrar, nuevo } from './registro';
import { fusionar, fusionarColeccion, ganador } from './sincronizacion';
import { coleccionesVacias, type Base } from './tipos';

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
