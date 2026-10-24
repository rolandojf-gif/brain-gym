import { describe, expect, it } from 'vitest';
import { diaLogico, diaSemana } from './dia';

describe('diaLogico', () => {
  it('antes del corte cuenta como el día anterior', () => {
    expect(diaLogico(new Date(2026, 9, 27, 1, 30))).toBe('2026-10-26');
  });
  it('a partir del corte es el día natural', () => {
    expect(diaLogico(new Date(2026, 9, 27, 4, 0))).toBe('2026-10-27');
  });
  it('cruza meses y años', () => {
    expect(diaLogico(new Date(2027, 0, 1, 2, 0))).toBe('2026-12-31');
  });
  it('respeta un corte configurado', () => {
    expect(diaLogico(new Date(2026, 9, 27, 1, 30), 0)).toBe('2026-10-27');
  });
});

describe('diaSemana', () => {
  it('lunes es 0 y domingo 6', () => {
    expect(diaSemana(new Date(2026, 9, 26, 12))).toBe(0); // lunes 26 oct 2026
    expect(diaSemana(new Date(2026, 10, 1, 12))).toBe(6); // domingo 1 nov 2026
  });
  it('la madrugada del martes sigue siendo lunes', () => {
    expect(diaSemana(new Date(2026, 9, 27, 2))).toBe(0);
  });
});
