import { describe, expect, it } from 'vitest';
import { nuevaTarjeta, repasar } from './fsrs';
import { madurezMazo } from './progreso';

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
