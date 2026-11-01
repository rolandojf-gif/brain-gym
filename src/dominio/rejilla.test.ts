import { describe, expect, it } from 'vitest';
import { COOPERA, TRAICIONA, pagos, pasoRejilla, proporcionCooperadores, rejillaAleatoria, type Rejilla } from './rejilla';

function conTraidores(ancho: number, alto: number, ...posiciones: [number, number][]): Rejilla {
  const celdas = new Uint8Array(ancho * alto);
  for (const [x, y] of posiciones) celdas[y * ancho + x] = TRAICIONA;
  return { ancho, alto, celdas };
}

function traidores(r: Rejilla): [number, number][] {
  const salida: [number, number][] = [];
  r.celdas.forEach((c, i) => {
    if (c === TRAICIONA) salida.push([i % r.ancho, Math.floor(i / r.ancho)]);
  });
  return salida;
}

describe('pagos', () => {
  it('un traidor rodeado de cooperadores gana 8b; sus vecinos, 8; el resto, 9', () => {
    const r = conTraidores(7, 7, [3, 3]);
    const g = pagos(r, 1.85);
    expect(g[3 * 7 + 3]).toBeCloseTo(8 * 1.85);
    expect(g[2 * 7 + 2]).toBe(8);
    expect(g[0]).toBe(9);
  });
});

describe('pasoRejilla', () => {
  it('una rejilla de cooperadores se queda como está', () => {
    const r = conTraidores(6, 5);
    expect(traidores(pasoRejilla(r, 1.85))).toEqual([]);
  });

  it('con b entre 1,8 y 2, un traidor solitario se convierte en un bloque de 3×3', () => {
    const r = pasoRejilla(conTraidores(9, 9, [4, 4]), 1.85);
    const esperado: [number, number][] = [];
    for (let y = 3; y <= 5; y++) for (let x = 3; x <= 5; x++) esperado.push([x, y]);
    expect(traidores(r)).toEqual(esperado);
  });

  it('con poca tentación (8b < 9), un traidor solitario no se extiende', () => {
    // Sus vecinos ven más allá a cooperadores que ganan 9; él sigue traicionando porque sus vecinos sólo ganan 8.
    expect(traidores(pasoRejilla(conTraidores(9, 9, [4, 4]), 1.1))).toEqual([[4, 4]]);
  });

  it('los bordes se tocan: un traidor en una esquina contagia a las otras tres', () => {
    const r = pasoRejilla(conTraidores(6, 6, [0, 0]), 1.85);
    for (const [x, y] of [[5, 5], [0, 5], [5, 0], [1, 1]] as const) expect(r.celdas[y * 6 + x]).toBe(TRAICIONA);
    expect(r.celdas[3 * 6 + 3]).toBe(COOPERA);
  });

  it('no modifica la rejilla de entrada', () => {
    const r = conTraidores(5, 5, [2, 2]);
    const antes = Array.from(r.celdas);
    pasoRejilla(r, 1.85);
    expect(Array.from(r.celdas)).toEqual(antes);
  });

  it('desde un reparto al azar, cooperadores y traidores siguen conviviendo con b = 1,85', () => {
    let r = rejillaAleatoria(40, 16, 0.1, 20261101);
    for (let i = 0; i < 200; i++) r = pasoRejilla(r, 1.85);
    const p = proporcionCooperadores(r);
    expect(p).toBeGreaterThan(0.05);
    expect(p).toBeLessThan(0.95);
  });
});

describe('rejillaAleatoria', () => {
  it('es reproducible con la misma semilla y respeta más o menos la proporción', () => {
    const a = rejillaAleatoria(40, 16, 0.1, 7);
    const b = rejillaAleatoria(40, 16, 0.1, 7);
    expect(Array.from(a.celdas)).toEqual(Array.from(b.celdas));
    expect(1 - proporcionCooperadores(a)).toBeGreaterThan(0.04);
    expect(1 - proporcionCooperadores(a)).toBeLessThan(0.18);
  });
});
