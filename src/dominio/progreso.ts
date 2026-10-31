/* Madurez del mazo FSRS: datos reales, sin gamificación. */
import type { Repaso, Tarjeta } from './tipos';

export interface MadurezMazo {
  totalTarjetas: number;
  /** Tarjetas que ya han sido repasadas al menos una vez y tienen estabilidad consolidada (reps >= 1 y state >= 2, o reps >= 1). */
  aprendidas: number;
  totalRepasos: number;
  /** Proporción de repasos superados (nota >= 2) sobre el total de repasos. */
  retencion: number | null;
}

/** Calcula la madurez del mazo FSRS y la tasa de retención real en los repasos. */
export function madurezMazo(tarjetas: readonly Tarjeta[], repasos: readonly Repaso[]): MadurezMazo {
  const vivas = tarjetas.filter((t) => !t.borrado);
  const aprendidas = vivas.filter((t) => t.fsrs.reps >= 1 && (t.fsrs.scheduled_days >= 1 || t.fsrs.stability >= 1)).length;
  const repVivos = repasos.filter((r) => !r.borrado);
  const exitosos = repVivos.filter((r) => r.nota >= 2).length;
  return {
    totalTarjetas: vivas.length,
    aprendidas,
    totalRepasos: repVivos.length,
    retencion: repVivos.length > 0 ? exitosos / repVivos.length : null,
  };
}
