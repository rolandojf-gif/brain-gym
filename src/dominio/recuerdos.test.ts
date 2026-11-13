import { describe, expect, it } from 'vitest';
import { CATALOGO_RETOS } from './catalogo-retos';
import { haceCuanto, hayOtroRecuerdo, recuerdoDelDia, recuerdos, type Recuerdo } from './recuerdos';
import { nuevo } from './registro';
import type { Aprendizaje, Curiosidad, Escrito, Intento, Lectura } from './tipos';

const reto = CATALOGO_RETOS.find((r) => !r.debate) ?? CATALOGO_RETOS[0];
if (!reto) throw new Error('catálogo vacío');
const en = (dia: string) => new Date(`${dia}T10:00:00Z`);

const intento = (dia: string, nota: string, estado: Intento['estado'] = 'solucion'): Intento =>
  nuevo({ fuenteId: 'catalogo-retos', capitulo: reto.bloque, ejercicio: reto.id, estado, segundos: 30, notaError: nota, dia }, en(dia));
const lectura: Lectura = nuevo({ url: 'https://x.org', titulo: 'Meditations on Moloch', medio: '', tema: '', estado: 'escrita' as const }, en('2026-10-20'));
const escrito = (dia: string, feedback = true): Escrito =>
  nuevo(
    {
      lecturaId: lectura.id, resumen: 'Tesis central: …', objecion: 'La coordinación sí aparece cuando hay un tercero que castiga.', palabras: 20, enviadoEl: en(dia).toISOString(),
      ...(feedback ? { feedbackIa: { diagnostico: 'd', contraataque: 'Ese tercero también compite.', modeloMentalSugerido: 'm', fecha: en(dia).toISOString() } } : {}),
    },
    en(dia),
  );
const curiosidad = (dia: string, hipotesis: string, conclusion = ''): Curiosidad => nuevo({ pregunta: '¿Por qué no pactan?', hipotesis, conclusion }, en(dia));
const idea = (dia: string, texto: string): Aprendizaje => nuevo({ dia, texto }, en(dia));

const vacio = { intentos: [], escritos: [], lecturas: [lectura], curiosidades: [], aprendizajes: [] };

describe('recuerdos', () => {
  it('saca lo que escribiste antes de ver las opciones, con el resultado y el modelo mental del reto', () => {
    const [r] = recuerdos({ ...vacio, intentos: [intento('2026-10-25', 'Jugada: B (correcta: A) · Antes de ver opciones: Bajaría el ritmo y avisaría al cliente.')] }, CATALOGO_RETOS);
    expect(r).toMatchObject({ tuyo: 'Bajaría el ritmo y avisaría al cliente.', desenlace: { etiqueta: 'Caíste en la trampa', texto: reto.modeloMental } });
    expect(r?.contexto).toContain(reto.titulo);
  });

  it('ignora los intentos sin texto libre, los textos demasiado cortos y lo borrado', () => {
    const borrada = { ...idea('2026-10-25', 'Una idea suficientemente larga para contar.'), borrado: true };
    const lista = recuerdos(
      { ...vacio, intentos: [intento('2026-10-25', 'Jugada: B (correcta: A)'), intento('2026-10-26', 'Jugada: B · Antes de ver opciones: no sé')], aprendizajes: [borrada] },
      CATALOGO_RETOS,
    );
    expect(lista).toEqual([]);
  });

  it('objeciones con la respuesta del Abogado del Diablo, hipótesis con lo que te llevaste e ideas sin desenlace', () => {
    const lista = recuerdos(
      {
        ...vacio,
        escritos: [escrito('2026-10-26')],
        curiosidades: [curiosidad('2026-10-27', 'Porque el que frena pierde la carrera.', 'Sin verificación no hay pacto creíble.'), curiosidad('2026-10-28', '')],
        aprendizajes: [idea('2026-10-24', 'Ley de Goodhart: la métrica perseguida deja de medir.')],
      },
      CATALOGO_RETOS,
    );
    expect(lista.map((r) => r.id.split(':')[0])).toEqual(['aprendizajes', 'escritos', 'curiosidades']);
    expect(lista[0]?.desenlace).toBeUndefined();
    expect(lista[1]).toMatchObject({ contexto: 'Tu objeción a «Meditations on Moloch»', desenlace: { texto: 'Ese tercero también compite.' } });
    expect(lista[2]?.desenlace).toEqual({ etiqueta: 'Lo que te llevaste', texto: 'Sin verificación no hay pacto creíble.' });
  });
});

describe('recuerdoDelDia', () => {
  const r = (id: string, dia: string, desenlace = true): Recuerdo => ({
    id, fecha: en(dia).toISOString(), contexto: 'c', tuyo: 'Un texto mío de entonces.', enlace: '#x', ...(desenlace ? { desenlace: { etiqueta: 'e', texto: 't' } } : {}),
  });

  it('es el mismo todo el día y nunca uno de hoy', () => {
    const todos = [r('a', '2026-10-20'), r('b', '2026-10-25'), r('c', '2026-11-01'), r('hoy', '2026-11-13')];
    const elegido = recuerdoDelDia(todos, '2026-11-13');
    expect(elegido).toEqual(recuerdoDelDia(todos, '2026-11-13'));
    expect(elegido?.id).not.toBe('hoy');
  });

  it('prefiere los de hace una semana o más, y entre ellos los que tienen desenlace', () => {
    const todos = [r('viejo-sin', '2026-10-20', false), r('viejo-con', '2026-10-21'), r('reciente', '2026-11-11')];
    for (const hoy of ['2026-11-13', '2026-11-14', '2026-11-15']) expect(recuerdoDelDia(todos, hoy)?.id).toBe('viejo-con');
  });

  it('si no hay ninguno con distancia, vale uno de días anteriores; sin nada, null', () => {
    expect(recuerdoDelDia([r('ayer', '2026-11-12')], '2026-11-13')?.id).toBe('ayer');
    expect(recuerdoDelDia([r('hoy', '2026-11-13')], '2026-11-13')).toBeNull();
    expect(recuerdoDelDia([], '2026-11-13')).toBeNull();
  });

  it('«otro» recorre todos los candidatos y vuelve al primero', () => {
    const todos = [r('a', '2026-10-20'), r('b', '2026-10-21'), r('c', '2026-10-22')];
    const vistos = [0, 1, 2, 3].map((s) => recuerdoDelDia(todos, '2026-11-13', s)?.id);
    expect(new Set(vistos.slice(0, 3)).size).toBe(3);
    expect(vistos[3]).toBe(vistos[0]);
    expect(hayOtroRecuerdo(todos, '2026-11-13')).toBe(true);
    expect(hayOtroRecuerdo(todos.slice(0, 1), '2026-11-13')).toBe(false);
  });
});

describe('haceCuanto', () => {
  it.each([
    ['2026-11-12', 'ayer'],
    ['2026-11-09', 'hace 4 días'],
    ['2026-11-05', 'hace una semana'],
    ['2026-10-23', 'hace 3 semanas'],
    ['2026-08-13', 'hace 3 meses'],
    ['2025-11-10', 'hace un año'],
  ])('%s → %s', (fecha, texto) => {
    expect(haceCuanto(`${fecha}T10:00:00Z`, '2026-11-13')).toBe(texto);
  });
});
