import { describe, expect, it } from 'vitest';
import { calendario } from './progreso';
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
