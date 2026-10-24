import { describe, expect, it } from 'vitest';
import {
  ErrorValidacionIa,
  MAX_CARACTERES_IA,
  SYSTEM_PROMPT_ABOGADO_DIABLO,
  construirMensajeUsuario,
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

  it('parsea el JSON del modelo tanto limpio como envuelto en bloques markdown', () => {
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

    const conFences = `\`\`\`json\n${jsonValido}\n\`\`\``;
    expect(parsearRespuestaIa(conFences).modeloMentalSugerido).toContain('Trampa multipolar:');
  });

  it('rechaza respuestas vacías, no JSON o sin las 3 claves', () => {
    expect(() => parsearRespuestaIa('')).toThrow(ErrorValidacionIa);
    expect(() => parsearRespuestaIa('no es json')).toThrow(/no es un JSON válido/);
    expect(() => parsearRespuestaIa(JSON.stringify({ diagnostico: 'a', contraataque: 'b' }))).toThrow(/3 claves requeridas/);
  });
});
