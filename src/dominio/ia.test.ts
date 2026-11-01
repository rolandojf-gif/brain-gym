import { describe, expect, it } from 'vitest';
import {
  ErrorValidacionIa,
  MAX_CARACTERES_IA,
  MAX_TOKENS_IA,
  SYSTEM_PROMPT_ABOGADO_DIABLO,
  construirMensajeUsuario,
  construirPayloadOpenRouter,
  extraerContenidoOpenRouter,
  parsearRespuestaIa,
  validarPeticionIa,
} from './ia';

describe('ia (Abogado del Diablo)', () => {
  it('incluye el system prompt con las 3 claves exactas requeridas', () => {
    expect(SYSTEM_PROMPT_ABOGADO_DIABLO).toContain('auditor lógico implacable');
    expect(SYSTEM_PROMPT_ABOGADO_DIABLO).toContain('"diagnostico"');
    expect(SYSTEM_PROMPT_ABOGADO_DIABLO).toContain('"contraataque"');
    expect(SYSTEM_PROMPT_ABOGADO_DIABLO).toContain('"modeloMentalSugerido"');
  });

  it('valida una petición correcta y recorta espacios', () => {
    const p = validarPeticionIa({
      titulo: '  Meditations on Moloch  ',
      medio: ' Astral Codex Ten ',
      tema: ' Coordinación ',
      resumen: 'Tesis central: La competencia multipolar sacrifica todo valor humano.',
      objecion: 'Los estados pueden regular la carrera.',
    });
    expect(p).toEqual({
      titulo: 'Meditations on Moloch',
      medio: 'Astral Codex Ten',
      tema: 'Coordinación',
      resumen: 'Tesis central: La competencia multipolar sacrifica todo valor humano.',
      objecion: 'Los estados pueden regular la carrera.',
    });
    expect(construirMensajeUsuario(p)).toContain('Meditations on Moloch (Astral Codex Ten · Coordinación)');
  });

  it('rechaza peticiones vacías, mal formadas o que superen los 3.000 caracteres', () => {
    expect(() => validarPeticionIa(null)).toThrow(ErrorValidacionIa);
    expect(() => validarPeticionIa({ titulo: 'A', resumen: '', objecion: 'B' })).toThrow(/Faltan campos/);
    expect(() =>
      validarPeticionIa({
        titulo: 'A',
        resumen: 'x'.repeat(MAX_CARACTERES_IA),
        objecion: 'B',
      }),
    ).toThrow(/supera el límite de 3000 caracteres/);
  });

  it('construye el payload con el modelo por defecto deepseek/deepseek-v4.1-flash-1017 y max_tokens: 6000', () => {
    const p = { titulo: 'T', resumen: 'R', objecion: 'O' };
    const payload = construirPayloadOpenRouter('deepseek/deepseek-v4.1-flash-1017', p);
    expect(payload.model).toBe('deepseek/deepseek-v4.1-flash-1017');
    expect(payload.max_tokens).toBe(MAX_TOKENS_IA);
    expect(payload.max_tokens).toBe(6000);
    expect(payload).not.toHaveProperty('response_format');
  });

  it('parsea el JSON del modelo limpio, envuelto en markdown o precedido de texto', () => {
    const jsonValido = JSON.stringify({
      diagnostico: 'Capturas el equilibrio pero omites el coste de verificación.',
      contraataque: 'Un regulador local sufre arbitraje jurisdiccional inmediato.',
      modeloMentalSugerido: 'Trampa multipolar: Sin coacción global verificable, el desertor marca el estándar.',
    });
    expect(parsearRespuestaIa(jsonValido)).toEqual({
      diagnostico: 'Capturas el equilibrio pero omites el coste de verificación.',
      contraataque: 'Un regulador local sufre arbitraje jurisdiccional inmediato.',
      modeloMentalSugerido: 'Trampa multipolar: Sin coacción global verificable, el desertor marca el estándar.',
    });

    const conFencesYTexto = `Aquí tienes la auditoría solicitada:\n\`\`\`json\n${jsonValido}\n\`\`\`\nFin del análisis.`;
    expect(parsearRespuestaIa(conFencesYTexto)).toEqual({
      diagnostico: 'Capturas el equilibrio pero omites el coste de verificación.',
      contraataque: 'Un regulador local sufre arbitraje jurisdiccional inmediato.',
      modeloMentalSugerido: 'Trampa multipolar: Sin coacción global verificable, el desertor marca el estándar.',
    });
  });

  it('extrae texto cuando content es un array de bloques, pero nunca del razonamiento', () => {
    const jsonValido = JSON.stringify({
      diagnostico: 'Diagnóstico en bloque.',
      contraataque: 'Contraataque en bloque.',
      modeloMentalSugerido: 'Regla en bloque: Acción.',
    });
    const desdeBloques = extraerContenidoOpenRouter({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: [{ type: 'text', text: `\`\`\`json\n${jsonValido}\n\`\`\`` }],
          },
        },
      ],
    });
    expect(parsearRespuestaIa(desdeBloques.texto).diagnostico).toBe('Diagnóstico en bloque.');

    // Cortado razonando: el razonamiento es el borrador del modelo, no la respuesta.
    const cortado = extraerContenidoOpenRouter({
      choices: [{ finish_reason: 'length', message: { content: null, reasoning: 'Let me audit this. ' + jsonValido } }],
    });
    expect(cortado).toEqual({ texto: '', finishReason: 'length' });
  });

  it('sin el JSON de la auditoría lanza un error en vez de enseñar texto suelto', () => {
    expect(() => parsearRespuestaIa('')).toThrow(ErrorValidacionIa);
    expect(() => parsearRespuestaIa('   ')).toThrow(/vacía/);
    expect(() => parsearRespuestaIa('Let me audit this. The user says...')).toThrow(/formato esperado/);
    expect(() => parsearRespuestaIa('{"otra": "cosa"}')).toThrow(/formato esperado/);
  });

  it('razona acotado y con margen de tokens', () => {
    expect(construirPayloadOpenRouter('x/y', { titulo: 't', resumen: 'r', objecion: 'o' })).toMatchObject({ reasoning: { effort: 'low' }, max_tokens: 6000 });
  });
});
