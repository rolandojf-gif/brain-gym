import { describe, expect, it } from 'vitest';
import {
  BLOQUES_RETOS,
  CATALOGO_RETOS,
  ID_FUENTE_RETOS,
  estadoAutomatico,
  estadoDeReto,
  fuenteRetos,
  inspeccionarRetoCompletado,
  intentosContables,
  letraVisible,
  opcionesVisibles,
  siguienteRetoPendiente,
  temaSiguiente,
  type Reto,
} from './catalogo-retos';
import { nuevo } from './registro';
import { coleccionesVacias, type EstadoIntento, type Intento } from './tipos';
import { renderPanelRevision } from '../vistas/estudio';
import type { Ctx } from '../app';

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
      if (r.debate) {
        expect(r.opcionCorrecta).toBeNull();
        expect(r.opciones.length).toBeGreaterThanOrEqual(2);
      } else {
        expect(r.opciones.length).toBeGreaterThanOrEqual(3);
        expect(r.opciones.some((o) => o.id === r.opcionCorrecta)).toBe(true);
      }
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

  it('genera la fuente integrada con 4 capítulos; los retos de debate no cuentan en el total', () => {
    const f = fuenteRetos(T0);
    expect(f.id).toBe(ID_FUENTE_RETOS);
    expect(f.capitulos).toHaveLength(4);
    expect(f.capitulos.map((c) => c.ejercicios)).toEqual([8, 8, 7, 8]);
  });

  it('la longitud de las opciones no delata la correcta', () => {
    const conRespuesta = CATALOGO_RETOS.filter((r) => !r.debate);
    let masLarga = 0;
    for (const r of conRespuesta) {
      const ok = r.opciones.find((o) => o.id === r.opcionCorrecta);
      if (!ok) throw new Error(r.id);
      const maxOtra = Math.max(...r.opciones.filter((o) => o !== ok).map((o) => o.texto.length));
      expect(ok.texto.length, r.id).toBeLessThanOrEqual(maxOtra * 1.2);
      if (ok.texto.length >= maxOtra) masLarga++;
    }
    // Al azar, con 3-4 opciones, la correcta sería la más larga en torno a un 30 % de los retos.
    const proporcion = masLarga / conRespuesta.length;
    expect(proporcion).toBeGreaterThan(0.15);
    expect(proporcion).toBeLessThan(0.4);
  });

  it('baraja las opciones de forma estable y reparte la correcta entre posiciones', () => {
    const r = CATALOGO_RETOS[0];
    expect(opcionesVisibles(r)).toEqual(opcionesVisibles(r));
    expect(opcionesVisibles(r).map((o) => o.letra)).toEqual(['A', 'B', 'C', 'D']);
    expect(opcionesVisibles(r).map((o) => o.id).sort()).toEqual(r.opciones.map((o) => o.id).sort());
    const conRespuesta = CATALOGO_RETOS.filter((x) => !x.debate);
    const posiciones = new Map<string, number>();
    for (const x of conRespuesta) {
      const l = letraVisible(x, x.opcionCorrecta) ?? '?';
      posiciones.set(l, (posiciones.get(l) ?? 0) + 1);
    }
    for (const n of posiciones.values()) expect(n / conRespuesta.length).toBeLessThan(0.4);
  });

  it('deduce el estado del intento: la jugada fijada antes de la pista decide', () => {
    const r = CATALOGO_RETOS.find((x) => x.id === '1.2') as Reto; // correcta: D
    expect(estadoAutomatico(r, 'D', 'D', false)).toBe('sin_ayuda');
    expect(estadoAutomatico(r, 'D', 'D', true)).toBe('sin_ayuda');
    expect(estadoAutomatico(r, 'C', 'D', true)).toBe('con_pista');
    expect(estadoAutomatico(r, 'C', 'C', true)).toBe('solucion');
    expect(estadoAutomatico(r, 'C', 'C', false)).toBe('solucion');
    const debate = CATALOGO_RETOS.find((x) => x.debate) as Reto;
    expect(estadoAutomatico(debate, 'A', 'A', false)).toBe('sin_ayuda');
    expect(estadoAutomatico(debate, 'A', 'B', true)).toBe('con_pista');
  });

  it('los retos de debate no cuentan en las métricas ni como acierto', () => {
    const debate = CATALOGO_RETOS.find((x) => x.debate) as Reto;
    const deDebate = { ...intento(debate.id, 'sin_ayuda'), notaError: 'Jugada: B (correcta: debate)' };
    const normal = intento('1.1', 'sin_ayuda');
    expect(intentosContables([deDebate, normal])).toEqual([normal]);
    expect(inspeccionarRetoCompletado(debate.id, [deDebate])?.acertada).toBe(false);
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

  it('permite inspeccionar un reto completado (Modo Revisión) mostrando escenario, jugada, explicación, regla y acciones', () => {
    const intentoKeynes: Intento = nuevo(
      {
        fuenteId: ID_FUENTE_RETOS,
        capitulo: '1',
        ejercicio: '1.2',
        estado: 'solucion',
        segundos: 95,
        notaError: 'Jugada: C (correcta: D) · Lógica: Equilibrio de Nash en cero',
        dia: '2026-10-26',
      },
      T0,
    );
    const insp = inspeccionarRetoCompletado('1.2', [intentoKeynes]);
    if (!insp) throw new Error('Se esperaba inspección de reto 1.2');
    expect(insp.opcionElegida).toBe('C');
    expect(insp.acertada).toBe(false);
    expect(insp.logica).toBe('Equilibrio de Nash en cero');
    expect(insp.reto.opcionCorrecta).toBe('D');

    const ctxFalso = { datos: coleccionesVacias() } as unknown as Ctx;
    const html = renderPanelRevision(ctxFalso, insp);
    expect(html).toContain(insp.reto.escenario);
    const c = letraVisible(insp.reto, 'C') ?? '';
    const d = letraVisible(insp.reto, 'D') ?? '';
    expect(html).toContain(`Marcaste la opción ${c} (trampa); la jugada óptima era la ${d}`);
    expect(html).toContain(insp.reto.solucion);
    expect(html).toContain(insp.reto.modeloMental);
    expect(html).toContain('[ + Crear tarjeta FSRS con esta regla ]');
    expect(html).toContain('[ Reintentar reto ]');
    expect(html).toContain('Lo que escribiste: «Equilibrio de Nash en cero»');
  });

  it('lee el texto escrito antes de ver las opciones (formato actual), aunque cambiara de jugada', () => {
    const i: Intento = nuevo(
      {
        fuenteId: ID_FUENTE_RETOS, capitulo: '1', ejercicio: '1.2', estado: 'con_pista', segundos: 60, dia: '2026-10-31',
        notaError: 'Jugada: D (correcta: D) · Inicial: C · Antes de ver opciones: castigar al que no coopera · y vigilar',
      },
      T0,
    );
    const insp = inspeccionarRetoCompletado('1.2', [i]);
    expect(insp?.opcionElegida).toBe('D');
    expect(insp?.logica).toBe('castigar al que no coopera · y vigilar');
  });
});

describe('rotación de temas', () => {
  const todosDe = (bloque: string, min = 0) =>
    CATALOGO_RETOS.filter((r) => r.bloque === bloque).map((r, k) => intento(r.id, 'sin_ayuda', min + k));

  it('sin historial empieza por el primer tema', () => {
    expect(temaSiguiente([])).toBe('1');
  });

  it('toca el tema siguiente al del último reto jugado, en círculo', () => {
    expect(temaSiguiente([intento('1.1', 'sin_ayuda', 0)])).toBe('2');
    expect(temaSiguiente([intento('1.1', 'sin_ayuda', 5), intento('2.1', 'solucion', 0)])).toBe('2');
    expect(temaSiguiente([intento('4.1', 'solucion', 0)])).toBe('1');
  });

  it('salta los temas sin retos por estrenar e ignora los borrados', () => {
    const bloque2 = todosDe('2');
    expect(temaSiguiente([...bloque2, intento('1.1', 'sin_ayuda', 100)])).toBe('3');
    expect(temaSiguiente([{ ...intento('1.1', 'sin_ayuda', 0), borrado: true }])).toBe('1');
  });

  it('con todo jugado rota sin saltar', () => {
    const todo = BLOQUES_RETOS.flatMap((b, i) => todosDe(b.id, i * 10));
    expect(temaSiguiente([...todo, intento('3.1', 'solucion', 500)])).toBe('4');
  });

  it('cada tema tiene nombre corto para el selector', () => {
    expect(BLOQUES_RETOS.every((b) => b.corto.length > 0 && b.corto.length <= 20)).toBe(true);
  });
});
