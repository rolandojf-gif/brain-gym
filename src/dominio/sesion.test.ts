import { describe, expect, it } from 'vitest';
import { idSesion, registrarSesion } from './sesion';

const lunes = new Date(2026, 9, 26, 18, 0);

describe('registrarSesion', () => {
  it('crea la sesión del día con id fijo y acumula tiempo', () => {
    const a = registrarSesion(undefined, '2026-10-26', 'estudio', 600, lunes);
    expect(a.id).toBe(idSesion('2026-10-26', 'estudio'));
    const b = registrarSesion(a, '2026-10-26', 'estudio', 300, new Date(lunes.getTime() + 1000));
    expect(b.segundos).toBe(900);
    expect(b.actualizado > a.actualizado).toBe(true);
  });
});
