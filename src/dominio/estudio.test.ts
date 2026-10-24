import { describe, expect, it } from 'vitest';
import { fuentesIniciales } from './ajustes';
import { progresoPorCapitulo, proporcionSinAyuda, ultimosIntentos } from './estudio';
import { nuevo } from './registro';
import type { EstadoIntento, Intento } from './tipos';

const [stat110] = fuentesIniciales(new Date('2026-10-26T09:00:00Z'));
if (!stat110) throw new Error('falta Stat 110');
const intento = (capitulo: string, ejercicio: string, estado: EstadoIntento, min: number): Intento =>
  nuevo({ fuenteId: 'stat110', capitulo, ejercicio, estado, segundos: 600, notaError: '', dia: '2026-10-26' }, new Date(Date.UTC(2026, 9, 26, 9, min)));

describe('estudio', () => {
  it('el estado de un ejercicio es el de su último intento', () => {
    const u = ultimosIntentos([intento('1', '1.1', 'no_resuelto', 0), intento('1', '1.1', 'sin_ayuda', 5)]);
    expect(u).toHaveLength(1);
    expect(u[0]?.estado).toBe('sin_ayuda');
  });

  it('progreso por capítulo', () => {
    const p = progresoPorCapitulo(stat110, [
      intento('1', '1.1', 'sin_ayuda', 0), intento('1', '1.2', 'con_pista', 1), intento('2', '2.1', 'sin_ayuda', 2),
    ]);
    expect(p).toHaveLength(13);
    expect(p[0]).toMatchObject({ intentados: 2, sinAyuda: 1, total: null });
    expect(p[1]).toMatchObject({ intentados: 1, sinAyuda: 1 });
    expect(p[2]).toMatchObject({ intentados: 0 });
  });

  it('proporción sin ayuda sobre todos los intentos', () => {
    expect(proporcionSinAyuda([])).toBeNull();
    expect(proporcionSinAyuda([intento('1', 'a', 'sin_ayuda', 0), intento('1', 'b', 'solucion', 1)])).toBe(0.5);
  });
});
