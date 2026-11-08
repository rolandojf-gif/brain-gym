import { describe, expect, it } from 'vitest';
import { CONFIG, cerrar, esObjetivo, mediana, nuevaPartida, pulsar, siguienteDigito, type Partida } from './secuencias';

/** Azar que no inserta ninguna secuencia y saca el dígito pedido como relleno (2 + floor(x·8)). */
function relleno(digito: number): () => number {
  const valores = [0.99, (digito - 2) / 8 + 0.01];
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

  it('pulsar sin secuencia es un falso positivo y frena el ritmo', () => {
    const p = nuevaPartida(0);
    mostrar(p, [9, 3, 5]);
    expect(pulsar(p, 1300).tipo).toBe('falso-positivo');
    expect(p.falsosPositivos).toBe(1);
    expect(p.intervalo).toBe(CONFIG.intervaloInicial + CONFIG.paso);
  });

  it('pulsar dos veces por la misma secuencia: la segunda es falso positivo', () => {
    const p = nuevaPartida(0);
    mostrar(p, [3, 5, 7]);
    expect(pulsar(p, 1500).tipo).toBe('acierto');
    expect(pulsar(p, 1600).tipo).toBe('falso-positivo');
  });

  it('la secuencia que pasa sin respuesta es una omisión y frena el ritmo', () => {
    const p = nuevaPartida(0);
    mostrar(p, [2, 4, 6, 9, 9, 9, 9]); // el 6 sale en 1200; en 3600 ya pasó la ventana
    expect(p.omisiones).toBe(1);
    expect(p.intervalo).toBe(CONFIG.intervaloInicial + CONFIG.paso);
  });

  it('2-4-6-8 son dos secuencias', () => {
    const p = nuevaPartida(0);
    mostrar(p, [2, 4, 6, 8]);
    expect(pulsar(p, 1500).tipo).toBe('acierto');
    expect(pulsar(p, 2200).tipo).toBe('acierto');
  });

  it('cinco aciertos seguidos aceleran un paso; un fallo reinicia la cuenta', () => {
    const p = nuevaPartida(0);
    let t = 0;
    for (let i = 0; i < 5; i++) {
      t = mostrar(p, [9, 2, 4, 6], t + 600);
      pulsar(p, t + 400);
    }
    expect(p.intervalo).toBe(CONFIG.intervaloInicial - CONFIG.paso);
    pulsar(p, t + 500); // falso positivo
    expect(p.racha).toBe(0);
    expect(p.intervalo).toBe(CONFIG.intervaloInicial);
  });

  it('el ritmo no sale de sus límites', () => {
    const p = nuevaPartida(0);
    for (let i = 0; i < 50; i++) pulsar(p, i);
    expect(p.intervalo).toBe(CONFIG.intervaloMax);

    const q = nuevaPartida(0);
    let t = 0;
    for (let i = 0; i < 100; i++) {
      t = mostrar(q, [9, 4, 6, 8], t + 600);
      pulsar(q, t + 300);
    }
    expect(q.intervalo).toBe(CONFIG.intervaloMin);
    expect(cerrar(q, t + 600).intervaloMin).toBe(CONFIG.intervaloMin);
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

  it('resume aciertos, omisiones, falsos positivos y la mediana de reacción', () => {
    const p = nuevaPartida(0);
    let t = mostrar(p, [3, 5, 7]);
    pulsar(p, t + 400);
    t = mostrar(p, [9, 4, 6, 8], t + 600);
    pulsar(p, t + 600);
    pulsar(p, t + 900); // falso positivo
    t = mostrar(p, [2, 4, 6, 9, 9, 9, 9], t + 600); // omisión
    const r = cerrar(p, t + 600);
    expect(r).toMatchObject({ aciertos: 2, omisiones: 1, falsosPositivos: 1, objetivos: 3, reaccionMediana: 500 });
  });
});

describe('mediana', () => {
  it('par, impar y vacía', () => {
    expect(mediana([])).toBeNull();
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 3, 2])).toBe(2.5);
  });
});
