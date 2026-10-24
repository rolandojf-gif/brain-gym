/* Calendario de continuidad y métricas de madurez del mazo FSRS. Datos reales, sin gamificación. */
import { sumarDias } from './sesion';
import type { Actividad, Repaso, Sesion, Tarjeta } from './tipos';

export interface DiaCalendario {
  dia: string;
  actividades: Actividad[];
}

export interface MadurezMazo {
  totalTarjetas: number;
  /** Tarjetas que ya han sido repasadas al menos una vez y tienen estabilidad consolidada (reps >= 1 y state >= 2, o reps >= 1). */
  aprendidas: number;
  totalRepasos: number;
  /** Proporción de repasos superados (nota >= 2) sobre el total de repasos. */
  retencion: number | null;
}

/** Las `semanas` semanas completas (lunes a domingo) que terminan en la semana de `hoy`. */
export function calendario(sesiones: readonly Sesion[], hoy: string, semanas = 12): DiaCalendario[] {
  const porDia = new Map<string, Set<Actividad>>();
  for (const s of sesiones) {
    if (s.borrado) continue;
    let set = porDia.get(s.dia);
    if (!set) porDia.set(s.dia, (set = new Set()));
    set.add(s.actividad);
  }
  const diaSemana = (new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7;
  const inicio = sumarDias(hoy, -diaSemana - 7 * (semanas - 1));
  return Array.from({ length: semanas * 7 }, (_, i) => {
    const dia = sumarDias(inicio, i);
    return { dia, actividades: [...(porDia.get(dia) ?? [])] };
  });
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
