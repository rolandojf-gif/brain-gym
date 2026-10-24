import { describe, expect, it } from 'vitest';
import { nuevaTarjeta, repasar } from './fsrs';
import { calendario, madurezMazo } from './progreso';
import { nuevo } from './registro';
import type { Actividad } from './tipos';

const s = (dia: string, actividad: Actividad) => nuevo({ dia, actividad, inicio: dia, segundos: 60 }, new Date());

describe('calendario', () => {
  it('semanas completas de lunes a domingo que acaban en la semana de hoy', () => {
    const c = calendario([], '2026-10-28', 2); // miércoles
    expect(c).toHaveLength(14);
    expect(c[0]?.dia).toBe('2026-10-19');
    expect(c[13]?.dia).toBe('2026-11-01');
  });
  it('agrupa actividades por día sin duplicar e ignora borradas', () => {
    const c = calendario([s('2026-10-26', 'estudio'), s('2026-10-26', 'estudio'), s('2026-10-26', 'repaso'), { ...s('2026-10-27', 'lectura'), borrado: true }], '2026-10-26', 1);
    expect(c[0]?.actividades.sort()).toEqual(['estudio', 'repaso']);
    expect(c[1]?.actividades).toEqual([]);
  });
});

describe('madurezMazo', () => {
  it('calcula tarjetas aprendidas y tasa de retención', () => {
    const t0 = new Date('2026-10-26T09:00:00Z');
    const c1 = nuevaTarjeta('p1', 'r1', t0);
    const c2 = nuevaTarjeta('p2', 'r2', t0);
    const r1 = repasar(c1, 3, t0);
    const r2 = repasar(c2, 1, t0);
    const m = madurezMazo([r1.tarjeta, r2.tarjeta], [r1.repaso, r2.repaso]);
    expect(m.totalTarjetas).toBe(2);
    expect(m.aprendidas).toBe(1);
    expect(m.totalRepasos).toBe(2);
    expect(m.retencion).toBe(0.5);
  });
});
