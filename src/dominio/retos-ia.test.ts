import { describe, expect, it } from 'vitest';
import {
  ErrorRetoIa,
  MAX_LLAMADAS_IA_DIA,
  MAX_VISTOS,
  TEMAS,
  TEMAS_IA,
  mensajeGenerar,
  parsearRetoGenerado,
  parsearRevision,
  payloadGenerar,
  reservarCupo,
  urlFuenteValida,
  validarPeticionReto,
  validarRetoPropuesto,
} from './retos-ia';

const valido = () => ({
  titulo: 'La pausa que nadie firma',
  escenario: 'Dos laboratorios compiten por el mismo hito. Cada uno puede pausar seis meses para auditar la seguridad o seguir. Si uno pausa y el otro no, el que sigue gana la carrera.',
  opciones: [
    { id: 'A', texto: 'Pausar sólo si existe un mecanismo creíble para verificar que el otro también pausa.', porQue: 'La verificación convierte la promesa en compromiso.' },
    { id: 'B', texto: 'Pausar de forma unilateral para dar ejemplo moral al resto del sector.', porQue: 'Sin reciprocidad, el que pausa sólo pierde la carrera.' },
    { id: 'C', texto: 'Seguir a toda velocidad, porque el otro hará lo mismo pase lo que pase.', porQue: 'Ignora que la verificación cambia los pagos del juego.' },
    { id: 'D', texto: 'Anunciar una pausa sin intención de cumplirla para ganar tiempo.', porQue: 'Un farol detectable destruye la confianza futura.' },
  ],
  opcionCorrecta: 'A',
  pista: 'Piensa en qué cambia si incumplir se puede detectar.',
  solucion: 'Sin verificación, el juego es un dilema del prisionero y seguir domina. Con verificación y represalia creíble, pausar se vuelve sostenible.',
  modeloMental: 'Compromiso verificable: una promesa sólo cambia el juego si incumplirla se detecta.',
  fuente: { titulo: 'Racing to the precipice (Armstrong, Bostrom y Shulman, 2016)', url: 'https://link.springer.com/article/10.1007/s00146-015-0590-y' },
});

describe('petición de reto', () => {
  it('acepta un tema conocido y limpia la lista de vistos', () => {
    expect(validarPeticionReto({ tema: '5', vistos: ['  A  ', '', 3, 'B'] })).toEqual({ tema: '5', vistos: ['A', 'B'] });
    expect(validarPeticionReto({ tema: '1' })).toEqual({ tema: '1', vistos: [] });
  });
  it('recorta la lista de vistos a los más recientes', () => {
    const vistos = Array.from({ length: MAX_VISTOS + 5 }, (_, i) => `r${i}`);
    const p = validarPeticionReto({ tema: '2', vistos });
    expect(p.vistos).toHaveLength(MAX_VISTOS);
    expect(p.vistos.at(-1)).toBe(`r${MAX_VISTOS + 4}`);
  });
  it.each([null, [], { tema: '9' }, { tema: 1 }, { tema: '1', vistos: 'x' }])('rechaza %j', (entrada) => {
    expect(() => validarPeticionReto(entrada)).toThrow(ErrorRetoIa);
  });
  it('cada tema tiene nombre y enfoque, y el mensaje evita los vistos', () => {
    for (const t of TEMAS) expect(TEMAS_IA[t].nombre && TEMAS_IA[t].enfoque).toBeTruthy();
    const m = mensajeGenerar({ tema: '5', vistos: ['La pausa que nadie firma'] });
    expect(m).toContain('Carrera por la AGI');
    expect(m).toContain('La pausa que nadie firma');
    expect(payloadGenerar('x/y', { tema: '1', vistos: [] })).toMatchObject({ model: 'x/y', max_tokens: expect.any(Number) });
  });
});

describe('validación del reto generado', () => {
  it('acepta un reto bien formado y le pone el tema', () => {
    const r = validarRetoPropuesto(valido(), '5');
    expect(r.tema).toBe('5');
    expect(r.opciones.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('acepta un debate (sin respuesta correcta)', () => {
    expect(validarRetoPropuesto({ ...valido(), opcionCorrecta: null }, '3').opcionCorrecta).toBeNull();
  });

  it('ordena las opciones por letra y asigna letras por posición si faltan', () => {
    const v = valido();
    const desordenadas = { ...v, opciones: [v.opciones[2], v.opciones[0], v.opciones[3], v.opciones[1]] };
    expect(validarRetoPropuesto(desordenadas, '1').opciones.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D']);
    const sinId = { ...v, opciones: v.opciones.map(({ texto, porQue }) => ({ texto, porQue })) };
    expect(validarRetoPropuesto(sinId, '1').opciones[0]?.texto).toBe(v.opciones[0]?.texto);
  });

  it.each([
    ['tres opciones', (v: ReturnType<typeof valido>) => ({ ...v, opciones: v.opciones.slice(0, 3) })],
    ['opción sin porQue', (v: ReturnType<typeof valido>) => ({ ...v, opciones: v.opciones.map((o, i) => (i === 1 ? { ...o, porQue: '' } : o)) })],
    ['ids repetidos', (v: ReturnType<typeof valido>) => ({ ...v, opciones: v.opciones.map((o) => ({ ...o, id: 'A' })) })],
    ['opciones repetidas', (v: ReturnType<typeof valido>) => ({ ...v, opciones: v.opciones.map((o) => ({ ...o, texto: 'igual' })) })],
    ['correcta inválida', (v: ReturnType<typeof valido>) => ({ ...v, opcionCorrecta: 'E' })],
    ['correcta delatada por longitud', (v: ReturnType<typeof valido>) => ({ ...v, opciones: v.opciones.map((o) => (o.id === 'A' ? { ...o, texto: o.texto.repeat(2) } : o)) })],
    ['sin fuente', (v: ReturnType<typeof valido>) => ({ ...v, fuente: undefined })],
    ['fuente http', (v: ReturnType<typeof valido>) => ({ ...v, fuente: { titulo: 't', url: 'http://es.wikipedia.org/wiki/X' } })],
    ['escenario vacío', (v: ReturnType<typeof valido>) => ({ ...v, escenario: '  ' })],
  ])('rechaza: %s', (_nombre, cambiar) => {
    expect(() => validarRetoPropuesto(cambiar(valido()), '1')).toThrow(ErrorRetoIa);
  });

  it('tolera claves renombradas, sin tildes o en inglés, y un objeto envoltorio', () => {
    const v = valido();
    const renombrado = {
      Título: v.titulo,
      situación: v.escenario,
      options: v.opciones.map(({ id, texto, porQue }) => ({ letra: id.toLowerCase(), text: texto, por_qué: porQue })),
      respuesta_correcta: ' a ',
      hint: v.pista,
      solución: v.solucion,
      modelo_mental: v.modeloMental,
      source: { title: v.fuente.titulo, link: v.fuente.url },
    };
    const r = validarRetoPropuesto(renombrado, '5');
    expect(r).toMatchObject({ titulo: v.titulo, escenario: v.escenario, opcionCorrecta: 'A', pista: v.pista, fuente: v.fuente });
    expect(r.opciones[0]).toEqual({ id: 'A', texto: v.opciones[0]?.texto, porQue: v.opciones[0]?.porQue });
    expect(validarRetoPropuesto({ reto: v }, '1').titulo).toBe(v.titulo);
  });

  it('si falta un campo, el error dice qué claves llegaron', () => {
    const sinEscenario: Record<string, unknown> = { ...valido(), descripcionLarga: 'x' };
    delete sinEscenario.escenario;
    expect(() => validarRetoPropuesto(sinEscenario, '1')).toThrow(/Falta «escenario»\. Claves recibidas: titulo, opciones, .*descripcionLarga/);
  });

  it('extrae el JSON aunque venga envuelto en markdown', () => {
    const r = parsearRetoGenerado(`Aquí va:\n\`\`\`json\n${JSON.stringify(valido())}\n\`\`\``, '5');
    expect(r.titulo).toBe('La pausa que nadie firma');
    expect(() => parsearRetoGenerado('no hay json', '5')).toThrow(/no devolvió JSON/);
    expect(() => parsearRetoGenerado('{ roto', '5')).toThrow(ErrorRetoIa);
  });
});

describe('URL de la fuente', () => {
  it.each([
    ['https://es.wikipedia.org/wiki/Ley_de_Goodhart', true],
    ['https://plato.stanford.edu/entries/prisoner-dilemma/', true],
    ['http://es.wikipedia.org/wiki/X', false],
    ['https://localhost/x', false],
    ['https://127.0.0.1/x', false],
    ['https://[::1]/x', false],
    ['https://intranet/x', false],
    ['https://usuario:clave@ejemplo.org/x', false],
    ['https://ejemplo.org:8443/x', false],
    ['no es una url', false],
  ])('%s → %s', (url, esperado) => {
    expect(urlFuenteValida(url)).toBe(esperado);
  });
});

describe('revisión', () => {
  it('lee el veredicto y rechaza lo ilegible', () => {
    expect(parsearRevision('{"aprobado": true, "motivo": "Correcto."}')).toEqual({ aprobado: true, motivo: 'Correcto.' });
    expect(parsearRevision('```json\n{"aprobado": false, "motivo": "Dos opciones defendibles."}\n```').aprobado).toBe(false);
    expect(parsearRevision('{"aprobado": "sí"}')).toEqual({ aprobado: false, motivo: 'Sin motivo.' });
    expect(parsearRevision('vale').aprobado).toBe(false);
  });
});

describe('cupo diario', () => {
  it('cuenta por día y se reinicia al cambiar de día', () => {
    expect(reservarCupo(null, '2026-10-31')).toEqual({ dia: '2026-10-31', usadas: 1 });
    expect(reservarCupo({ dia: '2026-10-31', usadas: 3 }, '2026-10-31', 2)).toEqual({ dia: '2026-10-31', usadas: 5 });
    expect(reservarCupo({ dia: '2026-10-30', usadas: MAX_LLAMADAS_IA_DIA }, '2026-10-31')).toEqual({ dia: '2026-10-31', usadas: 1 });
  });
  it('no deja pasar del tope', () => {
    expect(reservarCupo({ dia: '2026-10-31', usadas: MAX_LLAMADAS_IA_DIA - 1 }, '2026-10-31')).not.toBeNull();
    expect(reservarCupo({ dia: '2026-10-31', usadas: MAX_LLAMADAS_IA_DIA }, '2026-10-31')).toBeNull();
    expect(reservarCupo({ dia: '2026-10-31', usadas: MAX_LLAMADAS_IA_DIA - 1 }, '2026-10-31', 2)).toBeNull();
  });
  it('devuelve llamadas con n negativo, también con el tope lleno, sin bajar de cero', () => {
    expect(reservarCupo({ dia: '2026-10-31', usadas: MAX_LLAMADAS_IA_DIA }, '2026-10-31', -1)).toEqual({ dia: '2026-10-31', usadas: MAX_LLAMADAS_IA_DIA - 1 });
    // Si el día cambió entre reservar y devolver, el día nuevo empieza en cero y se queda en cero.
    expect(reservarCupo({ dia: '2026-10-30', usadas: 5 }, '2026-10-31', -1)).toEqual({ dia: '2026-10-31', usadas: 0 });
  });
});
