/* Progreso de estudio: el estado de un ejercicio es el de su último intento. «Sin ayuda» es la métrica del brief. */
import type { EstadoIntento, Fuente, Intento } from './tipos';

export interface ProgresoCapitulo {
  capitulo: string;
  titulo: string;
  /** Ejercicios distintos intentados. */
  intentados: number;
  /** De ellos, cuántos tienen como último intento «sin ayuda». */
  sinAyuda: number;
  /** Total de ejercicios del capítulo, si se conoce. */
  total: number | null;
}

/** Último intento de cada ejercicio (por fuente, capítulo y ejercicio). */
export function ultimosIntentos(intentos: readonly Intento[]): Intento[] {
  const ultimo = new Map<string, Intento>();
  for (const i of intentos) {
    if (i.borrado) continue;
    const k = `${i.fuenteId}|${i.capitulo}|${i.ejercicio}`;
    const previo = ultimo.get(k);
    if (!previo || i.creado > previo.creado) ultimo.set(k, i);
  }
  return [...ultimo.values()];
}

export function progresoPorCapitulo(fuente: Fuente, intentos: readonly Intento[]): ProgresoCapitulo[] {
  const ultimos = ultimosIntentos(intentos.filter((i) => i.fuenteId === fuente.id));
  return fuente.capitulos.map((c) => {
    const delCap = ultimos.filter((i) => i.capitulo === c.id);
    return {
      capitulo: c.id,
      titulo: c.titulo,
      intentados: delCap.length,
      sinAyuda: delCap.filter((i) => i.estado === 'sin_ayuda').length,
      total: c.ejercicios ?? null,
    };
  });
}

/** Proporción de intentos resueltos sin ayuda (sobre todos los intentos, no sólo los últimos). */
export function proporcionSinAyuda(intentos: readonly Intento[]): number | null {
  const vivos = intentos.filter((i) => !i.borrado);
  if (vivos.length === 0) return null;
  return vivos.filter((i) => i.estado === 'sin_ayuda').length / vivos.length;
}

export const ETIQUETA_ESTADO: Record<EstadoIntento, string> = {
  sin_ayuda: 'Sin ayuda',
  con_pista: 'Con pista',
  solucion: 'Mirando la solución',
  no_resuelto: 'No resuelto',
};
