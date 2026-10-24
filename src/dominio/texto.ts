/** Palabras de un texto: secuencias de letras o números (incluye tildes, ñ y apóstrofos internos). */
export function contarPalabras(texto: string): number {
  return texto.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}
