/* Progreso de retos: el estado de un reto es el de su último intento. «Sin ayuda» es la métrica de dominio real. */
import type { EstadoIntento, Fuente, Intento } from './tipos';

export interface ProgresoCapitulo {
  capitulo: string;
  titulo: string;
  /** Retos distintos intentados en este bloque. */
  intentados: number;
  /** De ellos, cuántos tienen como último intento «sin ayuda». */
  sinAyuda: number;
  /** De ellos, cuántos tienen como último intento «con pista». */
  conPista: number;
  /** De ellos, cuántos tienen como último intento «solucion». */
  conSolucion: number;
  /** Total de retos del bloque, si se conoce. */
  total: number | null;
}

export interface DesgloseResolucion {
  total: number;
  sinAyuda: number;
  conPista: number;
  solucion: number;
  noResuelto: number;
  tasaSinAyuda: number | null;
}

/** Último intento de cada reto/ejercicio (por fuente, capítulo y ejercicio). */
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
      conPista: delCap.filter((i) => i.estado === 'con_pista').length,
      conSolucion: delCap.filter((i) => i.estado === 'solucion').length,
      total: c.ejercicios ?? null,
    };
  });
}

/** Proporción de intentos resueltos sin ayuda (sobre todos los intentos vivos). */
export function proporcionSinAyuda(intentos: readonly Intento[]): number | null {
  const vivos = intentos.filter((i) => !i.borrado);
  if (vivos.length === 0) return null;
  return vivos.filter((i) => i.estado === 'sin_ayuda').length / vivos.length;
}

/** Desglose de resolución sobre todos los intentos vivos. */
export function desgloseResolucion(intentos: readonly Intento[]): DesgloseResolucion {
  const vivos = intentos.filter((i) => !i.borrado);
  const sinAyuda = vivos.filter((i) => i.estado === 'sin_ayuda').length;
  const conPista = vivos.filter((i) => i.estado === 'con_pista').length;
  const solucion = vivos.filter((i) => i.estado === 'solucion').length;
  const noResuelto = vivos.filter((i) => i.estado === 'no_resuelto').length;
  return {
    total: vivos.length,
    sinAyuda,
    conPista,
    solucion,
    noResuelto,
    tasaSinAyuda: vivos.length > 0 ? sinAyuda / vivos.length : null,
  };
}

export const ETIQUETA_ESTADO: Record<EstadoIntento, string> = {
  sin_ayuda: 'Sin ayuda',
  con_pista: 'Con pista',
  solucion: 'Trampa / Solución',
  no_resuelto: 'No resuelto',
};
