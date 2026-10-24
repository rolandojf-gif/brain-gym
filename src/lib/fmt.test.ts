import { describe, expect, it } from 'vitest';
import { fmtDuracion, fmtPct, fmtRelativo, fmtReloj } from './fmt';

describe('fmt', () => {
  it('duraciones', () => {
    expect(fmtDuracion(20)).toBe('menos de 1 min');
    expect(fmtDuracion(45 * 60)).toBe('45 min');
    expect(fmtDuracion(65 * 60)).toBe('1 h 5 min');
    expect(fmtDuracion(120 * 60)).toBe('2 h');
  });
  it('relativo entre días', () => {
    expect(fmtRelativo('2026-10-26', '2026-10-26')).toBe('hoy');
    expect(fmtRelativo('2026-10-27', '2026-10-26')).toBe('mañana');
    expect(fmtRelativo('2026-10-25', '2026-10-26')).toBe('ayer');
    expect(fmtRelativo('2026-11-05', '2026-10-26')).toBe('en 10 d');
    expect(fmtRelativo('2026-10-20T10:00:00Z', '2026-10-26')).toBe('hace 6 d');
  });
  it('reloj y porcentajes', () => {
    expect(fmtReloj(65)).toBe('01:05');
    expect(fmtReloj(3725)).toBe('1:02:05');
    expect(fmtPct(0.256, 1)).toBe('25,6 %');
    expect(fmtPct(null)).toBe('—');
  });
});
