/* Dominio puro del «Sparring de IA / Abogado del Diablo» para auditar síntesis 3x1 de lectura.
   Sin red ni DOM: valida el payload de entrada (máx. 3.000 caracteres), construye el cuerpo para OpenRouter,
   extrae contenido de respuestas string o bloques y parsea el JSON con fallback inteligente. */

export const MAX_CARACTERES_IA = 3000;
export const MAX_TOKENS_IA = 1500;
export const MODELO_IA_POR_DEFECTO = 'deepseek/deepseek-v4.1-flash-1017';

export const SYSTEM_PROMPT_ABOGADO_DIABLO = `Eres un auditor lógico implacable, experto en Teoría de Juegos, Diseño de Incentivos, Sistemas Complejos y Sesgos Cognitivos.
El usuario acaba de leer un ensayo exigente y ha redactado de memoria una síntesis quirúrgica en 3 partes:
1. Tesis central
2. Mecanismo / Incentivo subyacente
3. Punto ciego / Objeción propuesta por el usuario

REGLAS DE ESTILO (ESTRICTAS):
- Cero adulación, cero saludos y cero frases vacías ("Buen resumen", "Interesante punto"). Entra directo al bisturí en la primera palabra.
- Tono directo, técnico, analítico y ligeramente irónico si el argumento del usuario es ingenuo. Habla siempre en castellano.
- NUNCA reescribas el resumen del usuario. Audita sus fisuras lógicas.
- Sólo recibes el título y la síntesis, no el texto. Juzga sobre todo la lógica interna: si el mecanismo explica de verdad la tesis y si la objeción la ataca. Afirma qué dice la obra sólo si la conoces bien; si no, dilo en una frase y no lo inventes.
- Responde ÚNICAMENTE con el objeto JSON crudo, sin bloques markdown (\`\`\`json) ni texto introductorio.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con estas 3 claves exactas:
{
  "diagnostico": "(Máx 60 palabras) Evalúa si el mecanismo que propone el usuario explica de verdad su tesis o sólo la repite con otras palabras. Señala la pieza del incentivo o del modelo causal que falta. Si conoces bien la obra, di si la síntesis la traiciona; si no, no lo supongas.",
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

/**
 * Construye el payload para OpenRouter.
 * Omite `response_format: { type: 'json_object' }` para máxima compatibilidad con proveedores de DeepSeek y Anthropic
 * en OpenRouter, forzando el JSON desde el prompt y extrayéndolo con `extraerSubcadenaJson`.
 */
export function construirPayloadOpenRouter(model: string, peticion: PeticionIa): Record<string, unknown> {
  return {
    model,
    max_tokens: MAX_TOKENS_IA,
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_ABOGADO_DIABLO },
      { role: 'user', content: construirMensajeUsuario(peticion) },
    ],
  };
}

/**
 * Extrae el texto útil del objeto devuelto por OpenRouter:
 * soporta `message.content` como string, como array de bloques `[{ type: 'text', text: '...' }]`,
 * `choice.text` o fallback a `message.reasoning` / `message.reasoning_content` si el modelo agotó tokens pensando.
 */
export function extraerContenidoOpenRouter(cuerpo: unknown): { texto: string; finishReason?: string; errorDetalle?: string } {
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return { texto: '', errorDetalle: 'Respuesta de OpenRouter no es un objeto JSON.' };
  }
  const data = cuerpo as {
    error?: { message?: unknown; code?: unknown };
    choices?: {
      finish_reason?: unknown;
      text?: unknown;
      message?: {
        content?: unknown;
        reasoning?: unknown;
        reasoning_content?: unknown;
      };
    }[];
  };

  if (data.error) {
    const msg = typeof data.error.message === 'string' ? data.error.message : JSON.stringify(data.error);
    const code = data.error.code !== undefined ? ` (código ${String(data.error.code)})` : '';
    return { texto: '', errorDetalle: `${msg}${code}` };
  }

  const choice = data.choices?.[0];
  const finishReason = typeof choice?.finish_reason === 'string' ? choice.finish_reason : undefined;
  if (!choice) {
    return { texto: '', ...(finishReason ? { finishReason } : {}), errorDetalle: 'OpenRouter devolvió choices vacío.' };
  }

  const content = choice.message?.content;
  const extraido = aTextoPlano(content)
    || aTextoPlano(choice.text)
    || aTextoPlano(choice.message?.reasoning)
    || aTextoPlano(choice.message?.reasoning_content);

  return {
    texto: extraido.trim(),
    ...(finishReason ? { finishReason } : {}),
  };
}

function aTextoPlano(valor: unknown): string {
  if (typeof valor === 'string') return valor.trim();
  if (Array.isArray(valor)) {
    return valor
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null && 'text' in item && typeof (item as { text?: unknown }).text === 'string') {
          return (item as { text: string }).text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return '';
}

/**
 * Extrae el JSON buscando el primer `{` y el último `}` (anti-markdown).
 * Si el modelo responde con texto válido en español pero no en formato JSON exacto,
 * hace un fallback inteligente asignando el texto recibido a `diagnostico`.
 */
export function parsearRespuestaIa(contenido: unknown): RespuestaAbogadoDiablo {
  const texto = aTextoPlano(contenido);
  if (!texto) {
    throw new ErrorValidacionIa('La respuesta del modelo está vacía.');
  }

  const limpio = extraerSubcadenaJson(texto);
  if (limpio) {
    try {
      const parsed: unknown = JSON.parse(limpio);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const r = parsed as Record<string, unknown>;
        const diagnostico = typeof r.diagnostico === 'string' ? r.diagnostico.trim() : '';
        const contraataque = typeof r.contraataque === 'string' ? r.contraataque.trim() : '';
        const modeloMentalSugerido = typeof r.modeloMentalSugerido === 'string' ? r.modeloMentalSugerido.trim() : '';
        if (diagnostico || contraataque || modeloMentalSugerido) {
          return {
            diagnostico: diagnostico || 'Sin diagnóstico adicional.',
            contraataque: contraataque || 'Sin contraataque adicional.',
            modeloMentalSugerido: modeloMentalSugerido || 'Auditoría lógica: Revisa los supuestos implícitos de tu síntesis.',
          };
        }
      }
    } catch {
      /* Si el bloque entre llaves no era JSON válido, cae al fallback de texto plano inferior */
    }
  }

  // Fallback inteligente cuando el modelo responde en texto libre sin JSON válido
  const textoSinFences = texto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return {
    diagnostico: textoSinFences,
    contraataque: 'El modelo devolvió su auditoría en formato de texto continuo (ver diagnóstico superior).',
    modeloMentalSugerido: 'Auditoría directa: Contrasta las fisuras señaladas arriba con tu punto ciego original.',
  };
}

export function extraerSubcadenaJson(texto: string): string | null {
  const sinFences = texto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const primerCorchete = sinFences.indexOf('{');
  const ultimoCorchete = sinFences.lastIndexOf('}');
  if (primerCorchete !== -1 && ultimoCorchete > primerCorchete) {
    return sinFences.slice(primerCorchete, ultimoCorchete + 1);
  }
  return null;
}
