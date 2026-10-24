import { describe, expect, it } from 'vitest';
import {
  BLOQUES_RETOS,
  CATALOGO_RETOS,
  ID_FUENTE_RETOS,
  estadoDeReto,
  fuenteRetos,
  siguienteRetoPendiente,
} from './catalogo-retos';
import { nuevo } from './registro';
import type { EstadoIntento, Intento } from './tipos';

const T0 = new Date('2026-10-26T09:00:00Z');
const intento = (ejercicio: string, estado: EstadoIntento, min = 0): Intento =>
  nuevo(
    {
      fuenteId: ID_FUENTE_RETOS,
      capitulo: ejercicio.split('.')[0] ?? '1',
      ejercicio,
      estado,
      segundos: 120,
      notaError: '',
      dia: '2026-10-26',
    },
    new Date(T0.getTime() + min * 60_000),
  );

describe('catalogo-retos', () => {
  it('contiene exactamente 4 bloques y 32 retos completos (8 por bloque)', () => {
    expect(BLOQUES_RETOS).toHaveLength(4);
    expect(CATALOGO_RETOS).toHaveLength(32);
    for (const b of BLOQUES_RETOS) {
      const delBloque = CATALOGO_RETOS.filter((r) => r.bloque === b.id);
      expect(delBloque).toHaveLength(8);
    }
  });

  it('cada reto tiene ID único, escenario, opciones válidas, pista, solución y modelo mental', () => {
    const ids = new Set<string>();
    for (const r of CATALOGO_RETOS) {
      expect(ids.has(r.id)).toBe(false);
      ids.add(r.id);
      expect(r.titulo.length).toBeGreaterThan(5);
      expect(r.escenario.length).toBeGreaterThan(80);
      expect(r.opciones.length).toBeGreaterThanOrEqual(3);
      expect(r.opciones.some((o) => o.id === r.opcionCorrecta)).toBe(true);
      expect(r.pista.length).toBeGreaterThan(20);
      expect(r.solucion.length).toBeGreaterThan(80);
      expect(r.modeloMental.length).toBeGreaterThan(20);
    }
  });

  it('incluye los 16 retos iniciales y los 16 retos avanzados sin IDs duplicados', () => {
    const esperados = [
      '1.1', '1.2', '1.3', '1.4',
      'tg-chantajista-schelling', 'tg-maldicion-ganador', 'tg-dilema-samaritano', 'tg-senalizacion-spence',
      '2.1', '2.2', '2.3', '2.4',
      'inc-efecto-peltzman', 'inc-holmstrom-equipos', 'inc-efecto-trinquete', 'inc-anticomunes-heller',
      '3.1', '3.2', '3.3', '3.4',
      'par-parrondo', 'par-berkson', 'par-inspector-espera', 'par-bella-durmiente',
      '4.1', '4.2', '4.3', '4.4',
      'ses-desplazamiento-intrinseco', 'ses-proporcionalidad-causa', 'ses-maldicion-conocimiento', 'ses-falacia-mcnamara',
    ];
    expect(CATALOGO_RETOS.map((r) => r.id)).toEqual(esperados);
  });

  it('genera la fuente integrada con 4 capítulos de 8 retos', () => {
    const f = fuenteRetos(T0);
    expect(f.id).toBe(ID_FUENTE_RETOS);
    expect(f.capitulos).toHaveLength(4);
    expect(f.capitulos.every((c) => c.ejercicios === 8)).toBe(true);
  });

  it('selecciona el siguiente reto pendiente y respeta el filtro de bloque', () => {
    expect(siguienteRetoPendiente([]).id).toBe('1.1');
    expect(siguienteRetoPendiente([], '3').id).toBe('3.1');
    const conPrimeroHecho = [intento('1.1', 'sin_ayuda')];
    expect(siguienteRetoPendiente(conPrimeroHecho).id).toBe('1.2');
    expect(estadoDeReto('1.1', conPrimeroHecho)).toBe('sin_ayuda');
    expect(estadoDeReto('1.2', conPrimeroHecho)).toBeNull();
  });

  it('prioriza retos con solución vista cuando todos han sido intentados', () => {
    const todos = CATALOGO_RETOS.map((r, idx) =>
      intento(r.id, r.id === '2.3' ? 'solucion' : 'sin_ayuda', idx),
    );
    expect(siguienteRetoPendiente(todos).id).toBe('2.3');
  });
});
