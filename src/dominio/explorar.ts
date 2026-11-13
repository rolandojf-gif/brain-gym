/* Dominio puro de /api/explorar: la IA responde a la hipótesis que el usuario escribió sobre una pregunta propia.
   Sin red ni DOM: valida la petición, construye el cuerpo para OpenRouter y parsea el JSON de vuelta. Las fuentes
   las comprueba el servidor (que la URL responda) antes de devolverlas. */
import { MAX_TOKENS_IA, extraerSubcadenaJson } from './ia';
import { urlSegura } from '../lib/html';
import type { Curiosidad, ExploracionIa } from './tipos';

export const MAX_CARACTERES_PREGUNTA = 300;
export const MAX_CARACTERES_HIPOTESIS = 1200;
/** Una o dos frases: lo que te llevas, no un resumen. */
export const MAX_CARACTERES_CONCLUSION = 400;
export const MAX_FUENTES = 3;

export const SYSTEM_PROMPT_EXPLORAR = `Eres un compañero de investigación exigente, experto en teoría de juegos, diseño de incentivos, la carrera por la AGI y psicología (sesgos, decisión, ciencia cognitiva).
El usuario se ha hecho una pregunta y, antes de mirar nada, ha escrito su hipótesis. Tu trabajo es contrastar su hipótesis con lo que se sabe, no dar una lección.

REGLAS (ESTRICTAS):
- Castellano. Cero adulación, cero saludos y cero frases vacías. Entra en materia en la primera palabra.
- Responde a SU hipótesis: qué acierta y qué falla o se le escapa. Si la hipótesis es «no lo sé» o está vacía de contenido, dilo en una frase y céntrate en la investigación.
- En "investigacion", lo que dice la investigación o la teoría sobre la pregunta, con nombres concretos (autores, modelos, experimentos, datos). Distingue lo establecido de lo discutido. Si la pregunta no tiene respuesta conocida, dilo.
- No inventes. Si no estás seguro de un dato o de una referencia, no lo incluyas.
- En "fuentes", hasta ${MAX_FUENTES} lecturas para profundizar con URL estable que estés seguro de que existe (Stanford Encyclopedia of Philosophy, Wikipedia, arXiv, la web del autor, la página del artículo en la revista). Mejor una fuente segura que tres dudosas; una lista vacía es aceptable.
- Responde ÚNICAMENTE con el objeto JSON crudo, sin bloques markdown ni texto introductorio.

{
  "acierta": "(Máx 60 palabras) Lo que la hipótesis del usuario acierta, con el porqué",
  "falla": "(Máx 70 palabras) Lo que falla o se le escapa: la pieza del mecanismo que falta, el contraejemplo o el matiz",
  "investigacion": "(Máx 140 palabras) Qué dice la investigación o la teoría",
  "fuentes": [{"titulo": "Título y autor", "url": "https://…"}]
}`;

export interface PeticionExplorar {
  pregunta: string;
  hipotesis: string;
}

export class ErrorExplorar extends Error {
  override name = 'ErrorExplorar';
}

export function validarPeticionExplorar(entrada: unknown): PeticionExplorar {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) throw new ErrorExplorar('El cuerpo de la petición debe ser un objeto JSON.');
  const o = entrada as Record<string, unknown>;
  const pregunta = typeof o.pregunta === 'string' ? o.pregunta.trim() : '';
  const hipotesis = typeof o.hipotesis === 'string' ? o.hipotesis.trim() : '';
  if (!pregunta) throw new ErrorExplorar('Falta la pregunta.');
  // Primero piensas tú: sin hipótesis no hay exploración.
  if (!hipotesis) throw new ErrorExplorar('Escribe tu hipótesis antes de explorar.');
  if (pregunta.length > MAX_CARACTERES_PREGUNTA) throw new ErrorExplorar(`La pregunta no puede pasar de ${MAX_CARACTERES_PREGUNTA} caracteres.`);
  if (hipotesis.length > MAX_CARACTERES_HIPOTESIS) throw new ErrorExplorar(`La hipótesis no puede pasar de ${MAX_CARACTERES_HIPOTESIS} caracteres.`);
  return { pregunta, hipotesis };
}

export function payloadExplorar(model: string, p: PeticionExplorar): Record<string, unknown> {
  return {
    model,
    max_tokens: MAX_TOKENS_IA,
    temperature: 0.3,
    reasoning: { effort: 'low' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_EXPLORAR },
      { role: 'user', content: `=== PREGUNTA ===\n${p.pregunta}\n\n=== HIPÓTESIS DEL USUARIO (escrita antes de mirar nada) ===\n${p.hipotesis}` },
    ],
  };
}

export type RespuestaExplorar = Omit<ExploracionIa, 'modelo' | 'fecha'>;

/** Sin las tres piezas de texto no hay exploración: mejor un error claro que enseñar el borrador del modelo. */
export function parsearExploracion(texto: string): RespuestaExplorar {
  const limpio = extraerSubcadenaJson(texto);
  let r: Record<string, unknown> | null = null;
  if (limpio) {
    try {
      const v: unknown = JSON.parse(limpio);
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) r = v as Record<string, unknown>;
    } catch {
      /* cae al error inferior */
    }
  }
  const campo = (k: string) => {
    const v = r?.[k];
    return typeof v === 'string' ? v.trim() : '';
  };
  const acierta = campo('acierta'), falla = campo('falla'), investigacion = campo('investigacion');
  if (!acierta || !falla || !investigacion) throw new ErrorExplorar('El modelo no devolvió la exploración en el formato esperado. Vuelve a intentarlo.');
  return { acierta, falla, investigacion, fuentes: leerFuentes(r?.fuentes) };
}

/** Las fuentes son un extra: las que no traigan título y URL http(s) se ignoran, sin romper la exploración. */
function leerFuentes(valor: unknown): { titulo: string; url: string }[] {
  if (!Array.isArray(valor)) return [];
  const vistas = new Set<string>();
  return valor
    .map((f) => (typeof f === 'object' && f !== null ? (f as Record<string, unknown>) : {}))
    .map((f) => ({ titulo: typeof f.titulo === 'string' ? f.titulo.trim() : '', url: typeof f.url === 'string' ? urlSegura(f.url.trim()) : '' }))
    .filter((f) => {
      if (!f.titulo || !f.url || vistas.has(f.url)) return false;
      vistas.add(f.url);
      return true;
    })
    .slice(0, MAX_FUENTES);
}

/* ── Pasos de una curiosidad ─────────────────────────────────────────── */

export type PasoCuriosidad = 'hipotesis' | 'explorar' | 'conclusion' | 'cerrada';

/** El paso se deduce de lo escrito: nada se marca a mano. */
export function pasoCuriosidad(c: Pick<Curiosidad, 'hipotesis' | 'exploracion' | 'conclusion'>): PasoCuriosidad {
  if (c.conclusion.trim()) return 'cerrada';
  if (c.exploracion) return 'conclusion';
  if (c.hipotesis.trim()) return 'explorar';
  return 'hipotesis';
}

/** Curiosidades vivas: primero las abiertas (la más reciente arriba) y luego las cerradas. */
export function ordenarCuriosidades(lista: readonly Curiosidad[]): Curiosidad[] {
  return lista
    .filter((c) => !c.borrado)
    .sort((a, b) => Number(pasoCuriosidad(a) === 'cerrada') - Number(pasoCuriosidad(b) === 'cerrada') || b.actualizado.localeCompare(a.actualizado));
}
