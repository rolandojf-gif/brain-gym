import { describe, expect, it } from 'vitest';
import {
  ErrorExplorar,
  MAX_CARACTERES_HIPOTESIS,
  MAX_FUENTES,
  ordenarCuriosidades,
  parsearExploracion,
  pasoCuriosidad,
  payloadExplorar,
  validarPeticionExplorar,
} from './explorar';
import { nuevo } from './registro';
import type { Curiosidad } from './tipos';

const T0 = new Date('2026-11-13T18:00:00Z');
const respuesta = {
  acierta: 'Ves bien que es un dilema del prisionero: pactar es lo mejor para todos.',
  falla: 'Te falta la verificación: sin poder comprobar lo que hace el otro, el pacto no es creíble.',
  investigacion: 'Armstrong, Bostrom y Shulman (2016) modelan la carrera y muestran que más competidores reducen la seguridad.',
  fuentes: [
    { titulo: 'Racing to the Precipice', url: 'https://link.springer.com/article/10.1007/s00146-015-0590-y' },
    { titulo: 'Malicioso', url: 'javascript:alert(1)' },
    { titulo: 'Repetida', url: 'https://link.springer.com/article/10.1007/s00146-015-0590-y' },
    { titulo: '', url: 'https://ejemplo.org' },
  ],
};

describe('validarPeticionExplorar', () => {
  it('acepta pregunta e hipótesis recortadas', () => {
    expect(validarPeticionExplorar({ pregunta: ' ¿Por qué? ', hipotesis: ' Porque sí. ' })).toEqual({ pregunta: '¿Por qué?', hipotesis: 'Porque sí.' });
  });

  it('sin hipótesis no hay exploración: primero piensas tú', () => {
    expect(() => validarPeticionExplorar({ pregunta: '¿Por qué?', hipotesis: '  ' })).toThrow(/hipótesis/);
  });

  it.each([
    [null, /objeto JSON/],
    [[], /objeto JSON/],
    [{ hipotesis: 'x' }, /Falta la pregunta/],
    [{ pregunta: 'x'.repeat(301), hipotesis: 'x' }, /pregunta no puede pasar/],
    [{ pregunta: 'x', hipotesis: 'x'.repeat(MAX_CARACTERES_HIPOTESIS + 1) }, /hipótesis no puede pasar/],
  ])('rechaza entradas inválidas (%#)', (entrada, mensaje) => {
    expect(() => validarPeticionExplorar(entrada)).toThrow(ErrorExplorar);
    expect(() => validarPeticionExplorar(entrada)).toThrow(mensaje);
  });
});

describe('payloadExplorar', () => {
  it('manda la pregunta y la hipótesis, con razonamiento acotado', () => {
    const p = payloadExplorar('m', { pregunta: '¿P?', hipotesis: 'H.' });
    expect(p).toMatchObject({ model: 'm', reasoning: { effort: 'low' } });
    const mensajes = p.messages as { role: string; content: string }[];
    expect(mensajes[1]?.content).toContain('¿P?');
    expect(mensajes[1]?.content).toContain('H.');
  });
});

describe('parsearExploracion', () => {
  it('lee el JSON aunque venga con markdown y limpia las fuentes', () => {
    const r = parsearExploracion('```json\n' + JSON.stringify(respuesta) + '\n```');
    expect(r.acierta).toBe(respuesta.acierta);
    expect(r.fuentes).toEqual([respuesta.fuentes[0]]);
  });

  it('no pasa de tres fuentes', () => {
    const fuentes = Array.from({ length: 6 }, (_, i) => ({ titulo: `F${i}`, url: `https://ejemplo.org/${i}` }));
    expect(parsearExploracion(JSON.stringify({ ...respuesta, fuentes })).fuentes).toHaveLength(MAX_FUENTES);
  });

  it('sin fuentes también vale', () => {
    expect(parsearExploracion(JSON.stringify({ ...respuesta, fuentes: undefined })).fuentes).toEqual([]);
  });

  it.each([
    ['El modelo pensando en voz alta, sin JSON'],
    [JSON.stringify({ acierta: 'a', falla: 'b' })],
    ['{ roto'],
  ])('sin las tres piezas lanza un error en vez de enseñar texto suelto (%#)', (texto) => {
    expect(() => parsearExploracion(texto)).toThrow(/formato esperado/);
  });
});

describe('pasos de una curiosidad', () => {
  const base = (campos: Partial<Curiosidad> = {}, ahora = T0): Curiosidad =>
    ({ ...nuevo({ pregunta: '¿P?', hipotesis: '', conclusion: '' }, ahora), ...campos });
  const exploracion = { acierta: 'a', falla: 'f', investigacion: 'i', fuentes: [], modelo: 'm', fecha: T0.toISOString() };

  it('se deducen de lo escrito', () => {
    expect(pasoCuriosidad(base())).toBe('hipotesis');
    expect(pasoCuriosidad(base({ hipotesis: '  ' }))).toBe('hipotesis');
    expect(pasoCuriosidad(base({ hipotesis: 'H' }))).toBe('explorar');
    expect(pasoCuriosidad(base({ hipotesis: 'H', exploracion }))).toBe('conclusion');
    expect(pasoCuriosidad(base({ hipotesis: 'H', exploracion, conclusion: 'C' }))).toBe('cerrada');
  });

  it('ordena: abiertas primero (la más reciente arriba), luego las cerradas; sin las borradas', () => {
    const vieja = base({ id: 'vieja', actualizado: '2026-11-01T00:00:00Z' });
    const nueva = base({ id: 'nueva', actualizado: '2026-11-10T00:00:00Z' });
    const cerrada = base({ id: 'cerrada', conclusion: 'C', actualizado: '2026-11-12T00:00:00Z' });
    const borrada = base({ id: 'borrada', borrado: true });
    expect(ordenarCuriosidades([cerrada, vieja, borrada, nueva]).map((c) => c.id)).toEqual(['nueva', 'vieja', 'cerrada']);
  });
});
