import { describe, expect, it } from 'vitest';
import { CONFIG, CONFIG_PRACTICA, aPrima, cerrar, esObjetivo, nuevaPartida, pulsar, rastro, siguienteDigito, type Partida } from './secuencias';

/** Azar que no inserta ninguna secuencia ni señuelo y saca el dígito pedido como relleno (2 + floor(x·8)). */
function relleno(digito: number): () => number {
  const valores = [0.99, 0.99, (digito - 2) / 8 + 0.01];
  return () => valores.shift() ?? 0.5;
}

/** Muestra una lista concreta de dígitos, uno cada `cada` ms desde `t0`. Devuelve el instante del último. */
function mostrar(p: Partida, digitos: number[], t0 = 0, cada = 600): number {
  let t = t0;
  digitos.forEach((d, i) => {
    t = t0 + i * cada;
    siguienteDigito(p, t, relleno(d));
  });
  return t;
}

describe('esObjetivo', () => {
  it('reconoce las tres secuencias y sólo con los tres últimos dígitos', () => {
    expect(esObjetivo([2, 4, 6])).toBe(true);
    expect(esObjetivo([9, 3, 5, 7])).toBe(true);
    expect(esObjetivo([4, 6, 8])).toBe(true);
    expect(esObjetivo([2, 4, 6, 9])).toBe(false);
    expect(esObjetivo([6, 4, 2])).toBe(false);
    expect(esObjetivo([4, 6])).toBe(false);
  });
});

describe('siguienteDigito', () => {
  it('da dígitos del 2 al 9', () => {
    const p = nuevaPartida(0);
    for (let i = 0; i < 500; i++) siguienteDigito(p, i * 600);
    expect(p.digitos.every((d) => d >= 2 && d <= 9 && Number.isInteger(d))).toBe(true);
  });

  it('inserta unas 8 secuencias por cada 100 dígitos', () => {
    let s = 7;
    const azar = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const p = nuevaPartida(0);
    let objetivos = 0;
    for (let i = 0; i < 10_000; i++) {
      siguienteDigito(p, i * 600, azar);
      if (esObjetivo(p.digitos)) objetivos++;
    }
    expect(objetivos / 100).toBeGreaterThan(7);
    expect(objetivos / 100).toBeLessThan(11);
  });

  it('una secuencia insertada sale completa y seguida', () => {
    const valores = [0.01, 0.99]; // inserta, y elige la tercera secuencia (4-6-8)
    const p = nuevaPartida(0);
    siguienteDigito(p, 0, () => valores.shift() ?? 0.5);
    siguienteDigito(p, 600, () => 0.5);
    siguienteDigito(p, 1200, () => 0.5);
    expect(p.digitos).toEqual([4, 6, 8]);
  });
});

describe('pulsar', () => {
  it('acierta dentro de la ventana aunque ya haya salido el dígito siguiente', () => {
    const p = nuevaPartida(0);
    const t = mostrar(p, [9, 2, 4, 6, 9]);
    const r = pulsar(p, t + 100); // 700 ms después del 6
    expect(r).toEqual({ tipo: 'acierto', reaccion: 700 });
    expect(p.aciertos).toBe(1);
  });

  it('pulsar sin secuencia es un falso positivo', () => {
    const p = nuevaPartida(0);
    mostrar(p, [9, 3, 5]);
    expect(pulsar(p, 1300).tipo).toBe('falso-positivo');
    expect(p.falsosPositivos).toBe(1);
  });

  it('pulsar dos veces por la misma secuencia: la segunda es falso positivo', () => {
    const p = nuevaPartida(0);
    mostrar(p, [3, 5, 7]);
    expect(pulsar(p, 1500).tipo).toBe('acierto');
    expect(pulsar(p, 1600).tipo).toBe('falso-positivo');
  });

  it('la secuencia que pasa sin respuesta es una omisión; dentro de la ventana de 1,8 s aún vale', () => {
    const p = nuevaPartida(0);
    mostrar(p, [2, 4, 6, 9, 9]); // el 6 sale en 1200; el último 9, en 2400
    expect(p.omisiones).toBe(0);
    expect(pulsar(p, 1200 + CONFIG.ventana - 1).tipo).toBe('acierto');
    const q = nuevaPartida(0);
    mostrar(q, [2, 4, 6, 9, 9, 9]); // en 3000 se cumplen los 1800: el aviso sale con el tercer dígito posterior
    expect(q.omisiones).toBe(1);
    expect(q.omitidas).toEqual([{ digitos: [2, 4, 6], fin: 2 }]);
  });

  it('recuerda cuál se escapó cuando sólo se caza una de dos encadenadas', () => {
    const p = nuevaPartida(0);
    mostrar(p, [2, 4, 6, 8]);
    pulsar(p, 1500); // responde a 2-4-6
    mostrar(p, [9, 9, 9, 9], 2400);
    expect(p.omitidas).toEqual([{ digitos: [4, 6, 8], fin: 3 }]);
  });

  it('el rastro enseña la secuencia escapada entre los dígitos de antes y de después', () => {
    const p = nuevaPartida(0);
    mostrar(p, [9, 8, 7, 3, 5, 7, 2, 9, 4]);
    const o = p.omitidas[0];
    if (!o) throw new Error('debía haber una omisión');
    expect(rastro(p, o).map((x) => (x.deLaSecuencia ? `[${x.digito}]` : String(x.digito))).join(' ')).toBe('8 7 [3] [5] [7] 2 9 4');
  });

  it('2-4-6-8 son dos secuencias', () => {
    const p = nuevaPartida(0);
    mostrar(p, [2, 4, 6, 8]);
    expect(pulsar(p, 1500).tipo).toBe('acierto');
    expect(pulsar(p, 2200).tipo).toBe('acierto');
  });

  it('un señuelo sale con los dos primeros dígitos de una secuencia y un tercero que no la cierra', () => {
    // No inserta secuencia, sí señuelo, elige 2-4-6 y el primero de los otros (2).
    const valores = [0.99, 0.01, 0.0, 0.0];
    const p = nuevaPartida(0);
    for (let i = 0; i < 3; i++) siguienteDigito(p, i * 600, () => valores.shift() ?? 0.99);
    expect(p.digitos).toEqual([2, 4, 2]);
    expect(p.abiertos).toHaveLength(0);
  });

  it('el ritmo es fijo: ni los aciertos ni los fallos lo cambian', () => {
    const p = nuevaPartida(0);
    const t = mostrar(p, [2, 4, 6]);
    pulsar(p, t + 300);
    pulsar(p, t + 400);
    expect(p.config.intervalo).toBe(600);
  });
});

describe('práctica', () => {
  it('marca los dígitos de una secuencia sólo durante la primera mitad', () => {
    const insertar = () => { const v = [0.01, 0.0]; return () => v.shift() ?? 0.99; };
    const p = nuevaPartida(0, CONFIG_PRACTICA);
    siguienteDigito(p, 0, insertar());
    expect(p.pista).toBe(true);
    siguienteDigito(p, 600, () => 0.99);
    expect(p.pista).toBe(true);
    siguienteDigito(p, 1200, () => 0.99);
    expect(p.pista).toBe(true);
    siguienteDigito(p, 1800, relleno(9));
    expect(p.pista).toBe(false);
    siguienteDigito(p, CONFIG_PRACTICA.pistasHasta + 600, insertar());
    expect(p.pista).toBe(false);
  });

  it('en una partida normal no hay pistas', () => {
    const v = [0.01, 0.0];
    const p = nuevaPartida(0);
    siguienteDigito(p, 0, () => v.shift() ?? 0.99);
    expect(p.pista).toBe(false);
  });
});

describe('cerrar', () => {
  it('no cuenta como omisión una secuencia que aún estaba en su ventana', () => {
    const p = nuevaPartida(0);
    const t = mostrar(p, [2, 4, 6]);
    const r = cerrar(p, t + 200);
    expect(r.omisiones).toBe(0);
    expect(r.objetivos).toBe(0);
  });

  it('resume aciertos, omisiones, falsos positivos, latencia media y A′', () => {
    const p = nuevaPartida(0);
    let t = mostrar(p, [3, 5, 7]);
    pulsar(p, t + 400);
    t = mostrar(p, [9, 4, 6, 8], t + 600);
    pulsar(p, t + 600);
    pulsar(p, t + 900); // falso positivo
    t = mostrar(p, [2, 4, 6, 9, 9, 9, 9], t + 600); // omisión
    const r = cerrar(p, t + 600);
    expect(r).toMatchObject({ aciertos: 2, omisiones: 1, falsosPositivos: 1, objetivos: 3, latenciaMedia: 500 });
    // h = 2/3; f = 1 falsa alarma entre 11 dígitos que no cerraban secuencia.
    expect(r.tasaFalsasAlarmas).toBeCloseTo(1 / 11);
    expect(r.aPrima).toBeCloseTo(aPrima(2 / 3, 1 / 11));
  });
});

describe('aPrima', () => {
  it('1 con todo aciertos y sin falsas alarmas; 0,5 al azar; por debajo si pulsas más donde no toca', () => {
    expect(aPrima(1, 0)).toBe(1);
    expect(aPrima(0.5, 0.5)).toBe(0.5);
    expect(aPrima(0, 0)).toBe(0.5);
    expect(aPrima(0.9, 0.1)).toBeCloseTo(0.944, 3);
    expect(aPrima(0.1, 0.9)).toBeCloseTo(0.056, 3);
  });

  it('sin objetivos no hay A′', () => {
    const p = nuevaPartida(0);
    expect(cerrar(p, 0).aPrima).toBeNull();
  });
});
