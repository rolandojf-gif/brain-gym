import { describe, expect, it } from 'vitest';
import { NIVELES_CONFIANZA, brier, brierPorCategoria, calibracionRetos, curva, pideConfianza, porResolver, resueltas, resueltasDeRetos } from './calibracion';
import { ID_FUENTE_RETOS } from './catalogo-retos';
import { nuevo } from './registro';
import type { EstadoIntento, Intento, Prediccion, Resultado } from './tipos';

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

describe('calibración en retos', () => {
  const T = (min: number) => new Date(Date.UTC(2026, 9, 31, 9, min));
  const intento = (ejercicio: string, estado: EstadoIntento, min: number, confianza?: number): Intento =>
    nuevo({
      fuenteId: ID_FUENTE_RETOS, capitulo: ejercicio.split('.')[0] ?? '1', ejercicio, estado, segundos: 60, notaError: '', dia: '2026-10-31',
      ...(confianza === undefined ? {} : { confianza }),
    }, T(min));

  it('acierto = jugada inicial correcta (estado «sin ayuda»); pista o solución cuentan como fallo', () => {
    expect(resueltasDeRetos([
      intento('1.1', 'sin_ayuda', 0, 0.9),
      intento('1.2', 'con_pista', 1, 0.6),
      intento('1.3', 'solucion', 2, 0.3),
    ])).toEqual([
      { probabilidad: 0.9, ocurrio: true },
      { probabilidad: 0.6, ocurrio: false },
      { probabilidad: 0.3, ocurrio: false },
    ]);
  });

  it('sólo cuenta el primer intento de cada reto, aunque el primero no tenga confianza', () => {
    expect(resueltasDeRetos([intento('1.1', 'sin_ayuda', 5, 0.9), intento('1.1', 'solucion', 0, 0.6)])).toEqual([
      { probabilidad: 0.6, ocurrio: false },
    ]);
    // Primer intento anterior a la confianza: el reintento ya conoce la solución y no cuenta.
    expect(resueltasDeRetos([intento('1.2', 'solucion', 0), intento('1.2', 'sin_ayuda', 5, 0.9)])).toEqual([]);
  });

  it('excluye debates, borrados, otras fuentes y confianzas fuera de rango', () => {
    const otraFuente: Intento = { ...intento('1.4', 'sin_ayuda', 3, 0.9), fuenteId: 'otra' };
    expect(resueltasDeRetos([
      intento('3.4', 'sin_ayuda', 0, 0.9), // debate (Newcomb)
      { ...intento('1.1', 'sin_ayuda', 1, 0.9), borrado: true },
      otraFuente,
      intento('1.2', 'sin_ayuda', 2, 1.5),
      intento('1.3', 'sin_ayuda', 4, Number.NaN),
    ])).toEqual([]);
  });

  it('el borrado del primer intento deja contar al siguiente', () => {
    expect(resueltasDeRetos([{ ...intento('1.1', 'solucion', 0, 0.6), borrado: true }, intento('1.1', 'sin_ayuda', 5, 0.9)])).toEqual([
      { probabilidad: 0.9, ocurrio: true },
    ]);
  });

  it('resumen: Brier, referencia, sesgo, margen y niveles', () => {
    const c = calibracionRetos([
      intento('1.1', 'sin_ayuda', 0, 0.9),
      intento('1.2', 'solucion', 1, 0.9),
      intento('1.3', 'con_pista', 2, 0.6),
      intento('1.5', 'sin_ayuda', 3, 0.3),
    ]);
    expect(c.n).toBe(4);
    // (0,01 + 0,81 + 0,36 + 0,49) / 4
    expect(c.brier).toBeCloseTo(0.4175, 10);
    expect(c.tasaAcierto).toBe(0.5);
    expect(c.referencia).toBe(0.25);
    expect(c.confianzaMedia).toBeCloseTo(0.675, 10);
    expect(c.sesgo).toBeCloseTo(0.175, 10);
    // 2·√(0,09 + 0,09 + 0,24 + 0,21) / 4
    expect(c.margen).toBeCloseTo((2 * Math.sqrt(0.63)) / 4, 10);
    expect(c.niveles).toEqual([
      { confianza: 0.3, n: 1, aciertos: 1 },
      { confianza: 0.6, n: 1, aciertos: 0 },
      { confianza: 0.9, n: 2, aciertos: 1 },
    ]);
  });

  it('sin datos, todo nulo', () => {
    expect(calibracionRetos([])).toMatchObject({ n: 0, brier: null, sesgo: null, margen: null, niveles: [] });
  });

  it('pide confianza sólo en el primer intento de un reto con respuesta correcta', () => {
    const reto = { id: '1.1', debate: false };
    expect(pideConfianza(reto, [])).toBe(true);
    expect(pideConfianza(reto, [intento('1.1', 'solucion', 0)])).toBe(false);
    expect(pideConfianza(reto, [{ ...intento('1.1', 'solucion', 0), borrado: true }])).toBe(true);
    expect(pideConfianza(reto, [intento('1.2', 'solucion', 0)])).toBe(true);
    expect(pideConfianza({ id: '3.4', debate: true }, [])).toBe(false);
  });

  it('los niveles empiezan por encima del azar de cuatro opciones', () => {
    expect(NIVELES_CONFIANZA[0]).toBeGreaterThan(0.25);
    expect([...NIVELES_CONFIANZA]).toEqual([...NIVELES_CONFIANZA].sort((a, b) => a - b));
  });
});
