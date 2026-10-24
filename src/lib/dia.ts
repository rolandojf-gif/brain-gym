/* El «día» de la rutina no acaba a medianoche: una sesión a la 01:30 cuenta para el día anterior.
   El corte es configurable (por defecto, las 04:00 hora local, como Anki). */

export const CORTE_POR_DEFECTO = 4;

/** Día lógico en formato AAAA-MM-DD, en hora local, con el corte indicado. */
export function diaLogico(ahora: Date, horaCorte = CORTE_POR_DEFECTO): string {
  const d = new Date(ahora.getTime());
  if (d.getHours() < horaCorte) d.setDate(d.getDate() - 1);
  return isoLocal(d);
}

/** Día de la semana del día lógico: 0 = lunes … 6 = domingo. */
export function diaSemana(ahora: Date, horaCorte = CORTE_POR_DEFECTO): number {
  const d = new Date(ahora.getTime());
  if (d.getHours() < horaCorte) d.setDate(d.getDate() - 1);
  return (d.getDay() + 6) % 7;
}

function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
