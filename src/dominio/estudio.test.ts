import { describe, expect, it } from 'vitest';
import { fuentesIniciales } from './ajustes';
import { ID_FUENTE_RETOS } from './catalogo-retos';
import { desgloseResolucion, progresoPorCapitulo, proporcionSinAyuda, ultimosIntentos } from './estudio';
import { nuevo } from './registro';
import type { EstadoIntento, Intento } from './tipos';

const [catalogo] = fuentesIniciales(new Date('2026-10-26T09:00:00Z'));
if (!catalogo) throw new Error('falta catálogo de retos');
const intento = (capitulo: string, ejercicio: string, estado: EstadoIntento, min: number): Intento =>
  nuevo({ fuenteId: ID_FUENTE_RETOS, capitulo, ejercicio, estado, segundos: 120, notaError: '', dia: '2026-10-26' }, new Date(Date.UTC(2026, 9, 26, 9, min)));

describe('estudio / retos', () => {
  it('el estado de un reto es el de su último intento', () => {
    const u = ultimosIntentos([intento('1', '1.1', 'no_resuelto', 0), intento('1', '1.1', 'sin_ayuda', 5)]);
    expect(u).toHaveLength(1);
    expect(u[0]?.estado).toBe('sin_ayuda');
  });

  it('progreso por bloque temático (4 bloques; el 3 tiene un reto de debate que no cuenta)', () => {
    const p = progresoPorCapitulo(catalogo, [
      intento('1', '1.1', 'sin_ayuda', 0),
      intento('1', '1.2', 'con_pista', 1),
      intento('2', '2.1', 'solucion', 2),
    ]);
    expect(p).toHaveLength(4);
    expect(p[0]).toMatchObject({ intentados: 2, sinAyuda: 1, conPista: 1, conSolucion: 0, total: 8 });
    expect(p[1]).toMatchObject({ intentados: 1, sinAyuda: 0, conPista: 0, conSolucion: 1, total: 8 });
    expect(p[2]).toMatchObject({ intentados: 0, total: 7 });
  });

  it('proporción sin ayuda y desglose de resolución sobre todos los intentos', () => {
    expect(proporcionSinAyuda([])).toBeNull();
    const lista = [intento('1', '1.1', 'sin_ayuda', 0), intento('1', '1.2', 'con_pista', 1), intento('2', '2.1', 'solucion', 2)];
    expect(proporcionSinAyuda(lista)).toBeCloseTo(1 / 3);
    expect(desgloseResolucion(lista)).toMatchObject({
      total: 3,
      sinAyuda: 1,
      conPista: 1,
      solucion: 1,
      noResuelto: 0,
    });
  });
});
