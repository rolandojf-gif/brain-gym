/* Calendario de continuidad: qué actividades se hicieron cada día. Es un dato, no una recompensa. */
import { sumarDias } from './sesion';
import type { Actividad, Sesion } from './tipos';

export interface DiaCalendario {
  dia: string;
  actividades: Actividad[];
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
