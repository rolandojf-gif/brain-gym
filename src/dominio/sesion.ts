/* Sesión del día: qué toca según el plan, qué hay pendiente y qué ya está hecho. Pura: recibe la hora. */
import { diaLogico, diaSemana } from '../lib/dia';
import { porResolver } from './calibracion';
import { vencidas } from './fsrs';
import type { Actividad, Ajustes, Colecciones, Prediccion, Tarjeta } from './tipos';

export interface SesionDeHoy {
  dia: string;
  actividades: { actividad: Actividad; hecha: boolean }[];
  pendiente: {
    tarjetasVencidas: Tarjeta[];
    prediccionesPorResolver: Prediccion[];
    /** Hoy no toca calibración, pero no se ha hecho en los últimos 7 días. */
    calibracionAtrasada: boolean;
  };
}

export function sesionDeHoy(ahora: Date, ajustes: Ajustes, datos: Pick<Colecciones, 'sesiones' | 'tarjetas' | 'predicciones'>): SesionDeHoy {
  const dia = diaLogico(ahora, ajustes.horaCorte);
  const semana = diaSemana(ahora, ajustes.horaCorte) as keyof Ajustes['planSemanal'];
  const hechas = new Set(datos.sesiones.filter((s) => !s.borrado && s.dia === dia).map((s) => s.actividad));
  const plan = ajustes.planSemanal[semana] ?? [];

  // La calibración es semanal: si hoy no toca y no se ha hecho en los últimos 7 días, se ofrece como pendiente.
  const haceSeis = sumarDias(dia, -6);
  const calibradaEnLaSemana = datos.sesiones.some((s) => !s.borrado && s.actividad === 'calibracion' && s.dia >= haceSeis && s.dia <= dia);
  const calibracionAtrasada = !plan.includes('calibracion') && !calibradaEnLaSemana;

  return {
    dia,
    actividades: plan.map((actividad) => ({ actividad, hecha: hechas.has(actividad) })),
    pendiente: {
      tarjetasVencidas: vencidas(datos.tarjetas, ahora),
      prediccionesPorResolver: porResolver(datos.predicciones, dia),
      calibracionAtrasada,
    },
  };
}

/** Suma días a una fecha AAAA-MM-DD sin depender de la zona horaria. */
export function sumarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
