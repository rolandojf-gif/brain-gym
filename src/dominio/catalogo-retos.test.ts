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
  nombreReto,
  opcionesVisibles,
  retoDeGenerado,
  retosJugables,
  siguienteRetoPendiente,
  temaSiguiente,
  temasPorReponer,
  todosLosRetos,
  vistosDeTema,
  type Reto,
} from './catalogo-retos';
import { actualizar, borrar, nuevo } from './registro';
import { coleccionesVacias, type EstadoIntento, type Intento, type RetoGenerado, type TemaReto } from './tipos';
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

/** Reto generado mínimo pero válido del tema dado, creado `min` minutos después de T0. */
const generado = (tema: TemaReto, min: number, extra: Partial<RetoGenerado> = {}): RetoGenerado => ({
  ...nuevo(
    {
      tema,
      titulo: `Generado ${tema}.${min}`,
      escenario: 'Escenario generado con datos suficientes para resolverlo.',
      opciones: (['A', 'B', 'C', 'D'] as const).map((id) => ({ id, texto: `Opción ${id}`, porQue: `Por qué ${id}` })),
      opcionCorrecta: 'B' as const,
      pista: 'Pista.',
      solucion: 'Solución.',
      modeloMental: 'Regla: algo accionable.',
      fuente: { titulo: 'Fuente', url: 'https://es.wikipedia.org/wiki/Teor%C3%ADa_de_juegos' },
      modelo: 'gen/x',
      revision: 'Correcto.',
    },
    new Date(T0.getTime() + min * 60_000),
  ),
  ...extra,
});

describe('catalogo-retos', () => {
  it('5 temas: 32 retos del catálogo en los 4 primeros (8 por tema) y la carrera por la AGI sólo con generados', () => {
    expect(BLOQUES_RETOS.map((b) => b.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(CATALOGO_RETOS).toHaveLength(32);
    for (const b of BLOQUES_RETOS) {
      const delBloque = CATALOGO_RETOS.filter((r) => r.bloque === b.id);
      expect(delBloque).toHaveLength(b.id === '5' ? 0 : 8);
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

  it('genera la fuente integrada con un capítulo por tema; los retos de debate no cuentan en el total', () => {
    const f = fuenteRetos(T0);
    expect(f.id).toBe(ID_FUENTE_RETOS);
    expect(f.capitulos.map((c) => c.ejercicios)).toEqual([8, 8, 7, 8, 0]);
    expect(fuenteRetos(T0, [...CATALOGO_RETOS, retoDeGenerado(generado('5', 0))]).capitulos.map((c) => c.ejercicios)).toEqual([8, 8, 7, 8, 1]);
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
    expect(intentosContables([deDebate, normal], CATALOGO_RETOS)).toEqual([normal]);
    expect(inspeccionarRetoCompletado(debate.id, [deDebate], CATALOGO_RETOS)?.acertada).toBe(false);
  });

  it('selecciona el siguiente reto pendiente y respeta el filtro de bloque', () => {
    expect(siguienteRetoPendiente([], CATALOGO_RETOS)?.id).toBe('1.1');
    expect(siguienteRetoPendiente([], CATALOGO_RETOS, '3')?.id).toBe('3.1');
    expect(siguienteRetoPendiente([], CATALOGO_RETOS, '5')).toBeNull();
    const conPrimeroHecho = [intento('1.1', 'sin_ayuda')];
    expect(siguienteRetoPendiente(conPrimeroHecho, CATALOGO_RETOS)?.id).toBe('1.2');
    expect(estadoDeReto('1.1', conPrimeroHecho)).toBe('sin_ayuda');
    expect(estadoDeReto('1.2', conPrimeroHecho)).toBeNull();
  });

  it('prioriza retos con solución vista cuando todos han sido intentados', () => {
    const todos = CATALOGO_RETOS.map((r, idx) =>
      intento(r.id, r.id === '2.3' ? 'solucion' : 'sin_ayuda', idx),
    );
    expect(siguienteRetoPendiente(todos, CATALOGO_RETOS)?.id).toBe('2.3');
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
    const insp = inspeccionarRetoCompletado('1.2', [intentoKeynes], CATALOGO_RETOS);
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
    const insp = inspeccionarRetoCompletado('1.2', [i], CATALOGO_RETOS);
    expect(insp?.opcionElegida).toBe('D');
    expect(insp?.logica).toBe('castigar al que no coopera · y vigilar');
  });
});

describe('rotación de temas', () => {
  const todosDe = (bloque: string, min = 0) =>
    CATALOGO_RETOS.filter((r) => r.bloque === bloque).map((r, k) => intento(r.id, 'sin_ayuda', min + k));

  it('sin historial empieza por el primer tema', () => {
    expect(temaSiguiente([], CATALOGO_RETOS)).toBe('1');
  });

  it('toca el tema siguiente al del último reto jugado, en círculo', () => {
    expect(temaSiguiente([intento('1.1', 'sin_ayuda', 0)], CATALOGO_RETOS)).toBe('2');
    expect(temaSiguiente([intento('1.1', 'sin_ayuda', 5), intento('2.1', 'solucion', 0)], CATALOGO_RETOS)).toBe('2');
    expect(temaSiguiente([intento('4.1', 'solucion', 0)], CATALOGO_RETOS)).toBe('1');
  });

  it('salta los temas sin retos por estrenar e ignora los borrados', () => {
    const bloque2 = todosDe('2');
    expect(temaSiguiente([...bloque2, intento('1.1', 'sin_ayuda', 100)], CATALOGO_RETOS)).toBe('3');
    expect(temaSiguiente([{ ...intento('1.1', 'sin_ayuda', 0), borrado: true }], CATALOGO_RETOS)).toBe('1');
  });

  it('con todo jugado rota sin saltar', () => {
    const todo = BLOQUES_RETOS.flatMap((b, i) => todosDe(b.id, i * 10));
    expect(temaSiguiente([...todo, intento('3.1', 'solucion', 500)], CATALOGO_RETOS)).toBe('4');
  });

  it('cada tema tiene nombre corto para el selector', () => {
    expect(BLOQUES_RETOS.every((b) => b.corto.length > 0 && b.corto.length <= 20)).toBe(true);
  });
});

describe('retos generados junto al catálogo', () => {
  const jugarG = (g: RetoGenerado, estado: EstadoIntento, min: number): Intento => ({ ...intento(g.id, estado, min), capitulo: g.tema });

  it('un generado toma la forma de un reto del catálogo, y sin respuesta correcta es de debate', () => {
    const g = generado('5', 0);
    const r = retoDeGenerado(g);
    expect(r).toMatchObject({ id: g.id, bloque: '5', opcionCorrecta: 'B', generado: { modelo: 'gen/x', reportado: false } });
    expect(r.debate).toBeUndefined();
    expect(r.opciones[0]?.porQue).toBe('Por qué A');
    expect(retoDeGenerado({ ...g, opcionCorrecta: null }).debate).toBe(true);
    expect(nombreReto(r)).toBe(g.titulo);
    expect(nombreReto(CATALOGO_RETOS[0])).toBe(`Reto 1.1 · ${CATALOGO_RETOS[0].titulo}`);
  });

  it('une catálogo y generados vivos (del más antiguo al más nuevo); los reportados no se ofrecen', () => {
    const viejo = generado('1', 5), nuevoG = generado('1', 9), borradoG = borrar(generado('2', 1), T0);
    const reportado = actualizar(generado('3', 2), { reporte: { nota: 'C también vale', el: T0.toISOString() } }, T0);
    const todos = todosLosRetos([nuevoG, borradoG, reportado, viejo]);
    expect(todos.slice(CATALOGO_RETOS.length).map((r) => r.id)).toEqual([reportado.id, viejo.id, nuevoG.id]);
    expect(retosJugables(todos).map((r) => r.id)).not.toContain(reportado.id);
    expect(retosJugables(todos)).toHaveLength(CATALOGO_RETOS.length + 2);
  });

  it('alterna en cada tema: catálogo, generado, catálogo… y si falta uno de los dos, el otro', () => {
    const g1 = generado('1', 0), g2 = generado('1', 1);
    const retos = retosJugables(todosLosRetos([g1, g2]));
    expect(siguienteRetoPendiente([], retos, '1')?.id).toBe('1.1');
    const tras11 = [intento('1.1', 'sin_ayuda', 10)];
    expect(siguienteRetoPendiente(tras11, retos, '1')?.id).toBe(g1.id);
    const trasG1 = [...tras11, jugarG(g1, 'solucion', 11)];
    expect(siguienteRetoPendiente(trasG1, retos, '1')?.id).toBe('1.2');
    // Lo jugado en otro tema no cuenta para alternar en este.
    expect(siguienteRetoPendiente([...trasG1, intento('2.1', 'sin_ayuda', 12)], retos, '1')?.id).toBe('1.2');
    // Sin generados listos, sigue el catálogo.
    const sinListos = [...trasG1, intento('1.2', 'sin_ayuda', 12), jugarG(g2, 'sin_ayuda', 13)];
    expect(siguienteRetoPendiente(sinListos, retos, '1')?.id).toBe('1.3');
    // Con el catálogo del tema agotado, sólo generados.
    const catalogo1 = CATALOGO_RETOS.filter((r) => r.bloque === '1').map((r, k) => intento(r.id, 'sin_ayuda', 20 + k));
    const g3 = generado('1', 2);
    const conG3 = retosJugables(todosLosRetos([g1, g2, g3]));
    expect(siguienteRetoPendiente([...catalogo1, jugarG(g1, 'sin_ayuda', 40)], conG3, '1')?.id).toBe(g2.id);
  });

  it('la carrera por la AGI sólo tiene generados y entra en la rotación cuando hay uno listo', () => {
    const g = generado('5', 0);
    const conAgi = retosJugables(todosLosRetos([g]));
    expect(siguienteRetoPendiente([], conAgi, '5')?.id).toBe(g.id);
    expect(temaSiguiente([intento('4.1', 'solucion', 0)], conAgi)).toBe('5');
    expect(temaSiguiente([intento('4.1', 'solucion', 0)], CATALOGO_RETOS)).toBe('1');
    expect(temaSiguiente([jugarG(g, 'sin_ayuda', 5)], conAgi)).toBe('1');
    const reportado = actualizar(g, { reporte: { nota: '', el: T0.toISOString() } }, T0);
    expect(siguienteRetoPendiente([], retosJugables(todosLosRetos([reportado])), '5')).toBeNull();
  });

  it('los intentos de un generado reportado no cuentan; los de uno sano, sí', () => {
    const sano = generado('2', 0);
    const malo = actualizar(generado('2', 1), { reporte: { nota: 'Dos opciones valen', el: T0.toISOString() } }, T0);
    const iSano = jugarG(sano, 'sin_ayuda', 2), iMalo = jugarG(malo, 'solucion', 3);
    expect(intentosContables([iSano, iMalo], todosLosRetos([sano, malo]))).toEqual([iSano]);
    expect(inspeccionarRetoCompletado(malo.id, [iMalo], todosLosRetos([sano, malo]))?.reto.generado?.reportado).toBe(true);
  });
});

describe('reponer retos generados', () => {
  it('pide uno por tema, primero los temas sin nada nuevo; uno jugado o reportado ya no cuenta como listo', () => {
    expect(temasPorReponer(CATALOGO_RETOS, [])).toEqual(['5', '1', '2', '3', '4']);
    const g1 = generado('1', 0), g5 = generado('5', 1);
    const retos = todosLosRetos([g1, g5]);
    expect(temasPorReponer(retos, [])).toEqual(['2', '3', '4']);
    const jugado: Intento = { ...intento(g5.id, 'sin_ayuda', 2), capitulo: '5' };
    expect(temasPorReponer(retos, [jugado])).toEqual(['5', '2', '3', '4']);
    const reportado = actualizar(g1, { reporte: { nota: '', el: T0.toISOString() } }, T0);
    expect(temasPorReponer(todosLosRetos([reportado, g5]), [])).toEqual(['1', '2', '3', '4']);
    // Con el catálogo del tema 2 agotado, el tema 2 pasa delante.
    const catalogo2 = CATALOGO_RETOS.filter((r) => r.bloque === '2').map((r, k) => intento(r.id, 'sin_ayuda', 10 + k));
    expect(temasPorReponer(retos, catalogo2)).toEqual(['2', '3', '4']);
    expect(temasPorReponer(CATALOGO_RETOS, catalogo2).slice(0, 2)).toEqual(['2', '5']);
  });

  it('los títulos vistos del tema incluyen catálogo y generados, los generados al final', () => {
    const g = generado('1', 0);
    const vistos = vistosDeTema('1', todosLosRetos([g, generado('2', 1)]));
    expect(vistos).toHaveLength(9);
    expect(vistos.at(-1)).toBe(g.titulo);
    expect(vistosDeTema('5', CATALOGO_RETOS)).toEqual([]);
  });
});
