import { describe, expect, it } from 'vitest';
import { aCard, aEstado, nuevaTarjeta, previsualizar, repasar, vencidas } from './fsrs';

const T0 = new Date('2026-10-26T09:00:00Z');
const dias = (n: number) => new Date(T0.getTime() + n * 86_400_000);

describe('FSRS', () => {
  it('una tarjeta nueva vence en el acto', () => {
    const t = nuevaTarjeta('¿P(A|B)?', 'P(A∩B)/P(B)', T0);
    expect(t.fsrs.reps).toBe(0);
    expect(vencidas([t], T0)).toHaveLength(1);
  });

  it('el estado se serializa y se recupera sin pérdidas', () => {
    const t = repasar(nuevaTarjeta('a', 'b', T0), 3, T0).tarjeta;
    expect(aEstado(aCard(t.fsrs))).toEqual(t.fsrs);
  });

  it('«bien» aleja el siguiente repaso más que «otra vez»', () => {
    const t = repasar(nuevaTarjeta('a', 'b', T0), 3, T0).tarjeta;
    const bien = repasar(t, 3, dias(1)).tarjeta;
    const otra = repasar(t, 1, dias(1)).tarjeta;
    expect(bien.fsrs.due > otra.fsrs.due).toBe(true);
    expect(otra.fsrs.lapses).toBe(0); // un fallo en aprendizaje no es un lapso
  });

  it('los intervalos crecen con repasos correctos sucesivos', () => {
    let t = nuevaTarjeta('a', 'b', T0);
    let ahora = T0;
    const intervalos: number[] = [];
    for (let i = 0; i < 5; i++) {
      t = repasar(t, 3, ahora).tarjeta;
      const vence = new Date(t.fsrs.due);
      intervalos.push(vence.getTime() - ahora.getTime());
      ahora = vence;
    }
    for (let i = 2; i < intervalos.length; i++) expect(intervalos[i]).toBeGreaterThan(intervalos[i - 1] ?? 0);
  });

  it('el repaso guarda el estado previo y la nota', () => {
    const t = nuevaTarjeta('a', 'b', T0);
    const { repaso } = repasar(t, 4, T0);
    expect(repaso.tarjetaId).toBe(t.id);
    expect(repaso.nota).toBe(4);
    expect(repaso.estadoPrevio).toEqual(t.fsrs);
  });

  it('vencidas ignora las borradas y las futuras, y ordena por atraso', () => {
    const a = repasar(nuevaTarjeta('a', 'b', T0), 3, T0).tarjeta;
    const b = { ...nuevaTarjeta('c', 'd', T0), borrado: true };
    const c = nuevaTarjeta('e', 'f', dias(-3));
    expect(vencidas([a, b, c], T0).map((x) => x.anverso)).toEqual(['e']);
    expect(vencidas([a, b, c], dias(30)).map((x) => x.anverso)).toEqual(['e', 'a']);
  });

  it('previsualizar da una fecha por nota, ordenadas', () => {
    const p = previsualizar(nuevaTarjeta('a', 'b', T0), T0);
    expect(p[1] <= p[2] && p[2] <= p[3] && p[3] <= p[4]).toBe(true);
  });
});
