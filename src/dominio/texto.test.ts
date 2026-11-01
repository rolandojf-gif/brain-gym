import { describe, expect, it } from 'vitest';
import { contarPalabras, separarPregunta } from './texto';

describe('contarPalabras', () => {
  it.each([
    ['', 0],
    ['   ', 0],
    ['El argumento central es débil.', 5],
    ['Bayes, Laplace y Jeffreys: 3 enfoques', 6],
    ["l'argument, un no-sé-qué", 3],
    ['línea uno\nlínea dos', 4],
  ])('%j → %i', (t, n) => expect(contarPalabras(t)).toBe(n));
});

describe('separarPregunta', () => {
  it.each([
    ['Pujas 90 € y él 95 €. Te toca decidir. ¿Cuál es la trampa?', 'Pujas 90 € y él 95 €. Te toca decidir.', '¿Cuál es la trampa?'],
    ['El dinero ya está dentro. Si te retiras, ¿qué haces?', 'El dinero ya está dentro.', 'Si te retiras, ¿qué haces?'],
    ['Primero esto. ¿Y aquello? ¿Por qué?', 'Primero esto. ¿Y aquello?', '¿Por qué?'],
    ['Un escenario sin pregunta final.', 'Un escenario sin pregunta final.', ''],
    ['¿Sólo una pregunta?', '¿Sólo una pregunta?', ''],
    ['Si la cosa sigue, ¿qué haces?', 'Si la cosa sigue, ¿qué haces?', ''],
    ['  Texto con espacios. ¿Pregunta?  ', 'Texto con espacios.', '¿Pregunta?'],
  ])('%j', (escenario, cuerpo, pregunta) => expect(separarPregunta(escenario)).toEqual({ cuerpo, pregunta }));
});
