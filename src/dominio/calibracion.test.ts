import { describe, expect, it } from 'vitest';
import { brier, brierPorCategoria, curva, porResolver, resueltas } from './calibracion';
import { nuevo } from './registro';
import type { Prediccion, Resultado } from './tipos';

const T0 = new Date('2026-10-26T09:00:00Z');
const pred = (probabilidad: number, resultado?: Resultado, venceEl = '2026-11-01'): Prediccion =>
  nuevo({
    enunciado: 'x', probabilidad, venceEl, categoria: 'general',
    ...(resultado ? { resolucion: { resultado, resueltaEl: '2026-11-02T10:00:00Z' } } : {}),
  }, T0);

describe('brier', () => {
  it('sin predicciones resueltas no hay puntuación', () => {
    expect(brier([])).toBeNull();
  });
  it('acierto seguro es 0 y fallo seguro es 1', () => {
    expect(brier([{ probabilidad: 1, ocurrio: true }])).toBe(0);
    expect(brier([{ probabilidad: 1, ocurrio: false }])).toBe(1);
  });
  it('decir siempre 50 % da 0,25', () => {
    expect(brier([{ probabilidad: 0.5, ocurrio: true }, { probabilidad: 0.5, ocurrio: false }])).toBe(0.25);
  });
  it('media de errores al cuadrado', () => {
    // (0,8−1)² = 0,04 ; (0,3−0)² = 0,09 → media 0,065
    expect(brier([{ probabilidad: 0.8, ocurrio: true }, { probabilidad: 0.3, ocurrio: false }])).toBeCloseTo(0.065, 10);
  });
});

describe('resueltas', () => {
  it('excluye anuladas, sin resolver y borradas', () => {
    const lista = [pred(0.7, 'si'), pred(0.6, 'no'), pred(0.9, 'anulada'), pred(0.5), { ...pred(0.4, 'si'), borrado: true }];
    expect(resueltas(lista)).toEqual([{ probabilidad: 0.7, ocurrio: true }, { probabilidad: 0.6, ocurrio: false }]);
  });
});

describe('curva', () => {
  it('reparte por tramos con media y frecuencia', () => {
    const t = curva([
      { probabilidad: 0.72, ocurrio: true },
      { probabilidad: 0.78, ocurrio: false },
      { probabilidad: 0.05, ocurrio: false },
    ]);
    expect(t).toHaveLength(10);
    expect(t[7]).toMatchObject({ n: 2, frecuencia: 0.5 });
    expect(t[7]?.media).toBeCloseTo(0.75, 10);
    expect(t[0]).toMatchObject({ n: 1, frecuencia: 0 });
    expect(t[5]).toMatchObject({ n: 0, media: null, frecuencia: null });
  });
  it('el 100 % cae en el último tramo', () => {
    expect(curva([{ probabilidad: 1, ocurrio: true }], 5)[4]?.n).toBe(1);
  });
});

describe('porResolver', () => {
  it('sólo las vencidas hasta hoy y sin resolver, la más antigua primero', () => {
    const lista = [pred(0.5, undefined, '2026-11-03'), pred(0.5, undefined, '2026-10-30'), pred(0.5, 'si', '2026-10-01'), pred(0.5, undefined, '2026-11-01')];
    expect(porResolver(lista, '2026-11-01').map((p) => p.venceEl)).toEqual(['2026-10-30', '2026-11-01']);
  });
});

describe('brierPorCategoria', () => {
  it('agrupa, ignora categorías sin resueltas y ordena por número', () => {
    const conCat = (p: Prediccion, categoria: string) => ({ ...p, categoria });
    const g = brierPorCategoria([
      conCat(pred(0.9, 'si'), 'trabajo'), conCat(pred(0.6, 'no'), 'trabajo'),
      conCat(pred(0.5, 'si'), 'política'), conCat(pred(0.7), 'ciencia'),
    ]);
    expect(g.map((x) => x.categoria)).toEqual(['trabajo', 'política']);
    expect(g[0]?.brier).toBeCloseTo((0.01 + 0.36) / 2, 10);
  });
});
