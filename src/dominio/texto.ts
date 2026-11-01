/** Palabras de un texto: secuencias de letras o números (incluye tildes, ñ y apóstrofos internos). */
export function contarPalabras(texto: string): number {
  return texto.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

/**
 * Separa la pregunta final de un escenario («…te toca decidir. ¿Qué haces?») para destacarla en Hoy. Si la pregunta
 * empieza a mitad de frase («Si te retiras, ¿qué haces?»), se lleva la frase entera. Sin pregunta final, todo es cuerpo.
 */
export function separarPregunta(escenario: string): { cuerpo: string; pregunta: string } {
  const t = escenario.trim();
  let inicio = t.endsWith('?') ? t.lastIndexOf('¿') : -1;
  if (inicio < 0) return { cuerpo: t, pregunta: '' };
  const antes = t.slice(0, inicio).trimEnd();
  if (antes && !/[.!?:…]$/.test(antes)) {
    const corte = /[.!?…]\s+(?=[^.!?…]*$)/.exec(antes);
    inicio = corte ? corte.index + corte[0].length : 0;
  }
  if (inicio === 0) return { cuerpo: t, pregunta: '' };
  return { cuerpo: t.slice(0, inicio).trim(), pregunta: t.slice(inicio).trim() };
}
