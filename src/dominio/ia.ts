/* Dominio puro del «Sparring de IA / Abogado del Diablo» para auditar síntesis 3x1 de lectura.
   Sin red ni DOM: valida el payload de entrada (máx. 3.000 caracteres), construye el prompt y parsea el JSON devuelto. */

export const MAX_CARACTERES_IA = 3000;

export const SYSTEM_PROMPT_ABOGADO_DIABLO = `Eres un auditor lógico implacable, experto en Teoría de Juegos, Diseño de Incentivos, Sistemas Complejos y Sesgos Cognitivos.
El usuario acaba de leer un ensayo exigente y ha redactado de memoria una síntesis quirúrgica en 3 partes:
1. Tesis central
2. Mecanismo / Incentivo subyacente
3. Punto ciego / Objeción propuesta por el usuario

REGLAS DE ESTILO (ESTRICTAS):
- Cero adulación, cero saludos y cero frases vacías ("Buen resumen", "Interesante punto"). Entra directo al bisturí en la primera palabra.
- Tono directo, técnico, analítico y ligeramente irónico si el argumento del usuario es ingenuo. Habla siempre en castellano.
- NUNCA reescribas el resumen del usuario. Audita sus fisuras lógicas.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con estas 3 claves exactas:
{
  "diagnostico": "(Máx 60 palabras) Evalúa si el usuario ha capturado el mecanismo causal real de la obra o si se ha quedado en la superficie. Señala si falta alguna pieza crítica del incentivo o modelo mental.",
  "contraataque": "(Máx 80 palabras) Ataca su 'Punto ciego / Objeción'. Si su objeción es blanda o convencional, destrúyela explicando cómo el autor se defendería, y revela cuál es la verdadera vulnerabilidad de segundo orden o el caso límite donde la tesis original colapsa de verdad.",
  "modeloMentalSugerido": "(Máx 25 palabras) Una regla mental afilada en una sola frase (formato: 'Nombre del principio: Regla accionable') que capture el ángulo oculto o el contraataque, lista para guardarse como tarjeta de memoria FSRS."
}`;

export interface PeticionIa {
  titulo: string;
  medio?: string;
  tema?: string;
  resumen: string;
  objecion: string;
}

export interface RespuestaAbogadoDiablo {
  diagnostico: string;
  contraataque: string;
  modeloMentalSugerido: string;
}

export class ErrorValidacionIa extends Error {
  override name = 'ErrorValidacionIa';
}

export function validarPeticionIa(entrada: unknown): PeticionIa {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
    throw new ErrorValidacionIa('El cuerpo de la petición debe ser un objeto JSON.');
  }
  const raw = JSON.stringify(entrada);
  if (raw.length > MAX_CARACTERES_IA) {
    throw new ErrorValidacionIa(`El payload supera el límite de ${MAX_CARACTERES_IA} caracteres.`);
  }
  const obj = entrada as Record<string, unknown>;
  const titulo = typeof obj.titulo === 'string' ? obj.titulo.trim() : '';
  const medio = typeof obj.medio === 'string' ? obj.medio.trim() : undefined;
  const tema = typeof obj.tema === 'string' ? obj.tema.trim() : undefined;
  const resumen = typeof obj.resumen === 'string' ? obj.resumen.trim() : '';
  const objecion = typeof obj.objecion === 'string' ? obj.objecion.trim() : '';

  if (!titulo || !resumen || !objecion) {
    throw new ErrorValidacionIa('Faltan campos obligatorios (titulo, resumen u objecion).');
  }

  return {
    titulo,
    ...(medio ? { medio } : {}),
    ...(tema ? { tema } : {}),
    resumen,
    objecion,
  };
}

export function construirMensajeUsuario(p: PeticionIa): string {
  const meta = [p.medio, p.tema].filter(Boolean).join(' · ');
  return [
    `Obra / Ensayo: ${p.titulo}${meta ? ` (${meta})` : ''}`,
    '',
    '=== SÍNTESIS DEL USUARIO (Tesis y Mecanismo) ===',
    p.resumen,
    '',
    '=== PUNTO CIEGO / OBJECIÓN DEL USUARIO ===',
    p.objecion,
  ].join('\n');
}

export function parsearRespuestaIa(contenido: unknown): RespuestaAbogadoDiablo {
  if (typeof contenido !== 'string' || !contenido.trim()) {
    throw new ErrorValidacionIa('La respuesta del modelo está vacía.');
  }
  const limpio = limpiarBloqueJson(contenido.trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(limpio);
  } catch {
    throw new ErrorValidacionIa('La respuesta del modelo no es un JSON válido.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ErrorValidacionIa('El JSON devuelto no es un objeto.');
  }
  const r = parsed as Record<string, unknown>;
  const diagnostico = typeof r.diagnostico === 'string' ? r.diagnostico.trim() : '';
  const contraataque = typeof r.contraataque === 'string' ? r.contraataque.trim() : '';
  const modeloMentalSugerido = typeof r.modeloMentalSugerido === 'string' ? r.modeloMentalSugerido.trim() : '';

  if (!diagnostico || !contraataque || !modeloMentalSugerido) {
    throw new ErrorValidacionIa('El JSON devuelto no contiene las 3 claves requeridas (diagnostico, contraataque, modeloMentalSugerido).');
  }

  return { diagnostico, contraataque, modeloMentalSugerido };
}

function limpiarBloqueJson(texto: string): string {
  const match = texto.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (match?.[1]) return match[1].trim();
  const inicio = texto.indexOf('{');
  const fin = texto.lastIndexOf('}');
  if (inicio !== -1 && fin > inicio) return texto.slice(inicio, fin + 1);
  return texto;
}
