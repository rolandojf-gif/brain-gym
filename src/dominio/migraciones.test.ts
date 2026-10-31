import { describe, expect, it } from 'vitest';
import { ajustesPorDefecto } from './ajustes';
import { ErrorDeDatos, exportar, migrar, type Migracion } from './migraciones';
import { ESQUEMA_VERSION, coleccionesVacias } from './tipos';

const T0 = new Date('2026-10-26T09:00:00Z');

describe('migrar', () => {
  it('una exportación actual vuelve igual (ida y vuelta)', () => {
    const datos = { ...coleccionesVacias(), ajustes: [ajustesPorDefecto(T0)] };
    const exp = exportar(datos, T0);
    expect(migrar(JSON.parse(JSON.stringify(exp)))).toEqual(exp);
  });

  it('completa colecciones ausentes y descarta las desconocidas', () => {
    const r = migrar({ app: 'brain-gym', esquema: ESQUEMA_VERSION, exportadoEl: '', datos: { rarezas: [] } });
    expect(Object.keys(r.datos).sort()).toEqual(Object.keys(coleccionesVacias()).sort());
  });

  it('encadena migraciones hasta la versión objetivo', () => {
    const migraciones: Record<number, Migracion> = {
      1: (d) => ({ ...d, esquema: 2, datos: { ...d.datos, predicciones: d.datos.predicciones?.map((p) => ({ ...(p as object), categoria: 'general' })) ?? [] } }),
      2: (d) => ({ ...d, esquema: 3 }),
    };
    const v1 = { app: 'brain-gym', esquema: 1, exportadoEl: 'x', datos: { predicciones: [{ id: 'p', actualizado: 'x' }] } };
    const r = migrar(v1, migraciones, 3);
    expect(r.esquema).toBe(3);
    expect(r.datos.predicciones[0]).toMatchObject({ id: 'p', categoria: 'general' });
  });

  it('v1 → v2: añade la colección de retos generados y no toca lo demás', () => {
    const intento = { id: 'i', creado: 'x', actualizado: 'x', borrado: false, ejercicio: '1.1', estado: 'sin_ayuda' };
    const v1 = { app: 'brain-gym', esquema: 1, exportadoEl: 'x', datos: { intentos: [intento], ajustes: [] } };
    const r = migrar(v1);
    expect(r.esquema).toBe(2);
    expect(r.datos.retos).toEqual([]);
    expect(r.datos.intentos).toEqual([intento]);
  });

  it('falla si falta un eslabón', () => {
    expect(() => migrar({ app: 'brain-gym', esquema: 1, exportadoEl: '', datos: {} }, {}, 2)).toThrow(/Falta la migración/);
    expect(() => migrar({ app: 'brain-gym', esquema: 2, exportadoEl: '', datos: {} }, {}, 3)).toThrow(/Falta la migración de la versión 2/);
  });

  it.each([
    [null, /no es una exportación/],
    [{ app: 'otra' }, /no es una exportación/],
    [{ app: 'brain-gym', esquema: 0, datos: {} }, /versión de esquema/],
    [{ app: 'brain-gym', esquema: 99, datos: {} }, /más nueva/],
    [{ app: 'brain-gym', esquema: 1 }, /no contiene datos/],
    [{ app: 'brain-gym', esquema: 1, datos: { tarjetas: {} } }, /no es una lista/],
    [{ app: 'brain-gym', esquema: 1, datos: { tarjetas: [{ anverso: 'a' }] } }, /no tiene id/],
  ])('rechaza entradas inválidas (%#)', (entrada, mensaje) => {
    expect(() => migrar(entrada)).toThrow(ErrorDeDatos);
    expect(() => migrar(entrada)).toThrow(mensaje);
  });
});
