import { describe, expect, it } from 'vitest';
import { contarPalabras } from './texto';

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
